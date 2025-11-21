from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from jose import jwt, JWTError
from passlib.context import CryptContext

# Import our unique data layer
from data_storage import (
    get_db_connection, SystemIdentity, VendorEntity, CatalogItem, 
    BizConnection, CommerceFlow, FlowLine, SupportCase, CommMessage
)

# --- CONFIGURATION ---
AUTH_SECRET = "SUPER_SECRET_KEY_CHANGE_ME"
ALGO = "HS256"
TOKEN_LIFE = 60

security_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

app = FastAPI(title="SCP Core", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ==========================================
# 1. API CONTRACT (Exactly as provided)
# ==========================================

# --- Authentication ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str

# --- Users ---
class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: str

# --- Suppliers ---
class SupplierRead(BaseModel):
    id: int
    name: str
    verification_status: bool

# --- Products ---
class ProductBase(BaseModel):
    name: str
    price: Decimal
    quantity: int
    unit: str

class ProductCreate(ProductBase):
    pass

class ProductRead(ProductBase):
    id: int
    supplier_id: int

# --- Link Requests ---
class LinkRequestCreate(BaseModel):
    supplier_id: int

class LinkRequestRead(BaseModel):
    id: int
    consumer_id: int
    supplier_id: int
    status: str
    created_at: datetime
    supplier_name: Optional[str] = None

class LinkRequestUpdate(BaseModel):
    status: str

# --- Orders ---
class OrderItem(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    supplier_id: int
    items: List[OrderItem]

class OrderRead(BaseModel):
    id: int
    consumer_id: int
    supplier_id: int
    total_amount: float
    status: str
    created_at: datetime

# --- Complaints ---
class ComplaintCreate(BaseModel):
    order_id: Optional[int] = None
    details: str

class ComplaintRead(BaseModel):
    id: int
    consumer_id: int
    details: str
    status: str
    created_at: datetime
    assigned_sales_id: Optional[int] = None
    assigned_manager_id: Optional[int] = None

# --- Chat ---
class MessageCreate(BaseModel):
    recipient_id: int
    content: str

class MessageRead(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    timestamp: datetime


# ==========================================
# 2. IMPLEMENTATION (Using Internal Logic)
# ==========================================

# --- Helpers ---
def hash_pass(p): return security_ctx.hash(p)
def check_pass(p, h): return security_ctx.verify(p, h)

def get_current_actor(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_connection)):
    try:
        payload = jwt.decode(token, AUTH_SECRET, algorithms=[ALGO])
        email = payload.get("sub")
        if not email: raise HTTPException(401)
    except JWTError:
        raise HTTPException(401, detail="Invalid Token")
    
    # Modern SQLAlchemy 2.0 execute syntax
    actor = db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == email)).scalars().first()
    if not actor: raise HTTPException(401)
    return actor

# --- A. Auth Endpoints ---

@app.post("/auth/token", response_model=Token)
def generate_token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db_connection)):
    user = db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == form.username)).scalars().first()
    if not user or not check_pass(form.password, user.auth_hash):
        raise HTTPException(401, detail="Bad credentials")
    
    # Create JWT
    exp = datetime.utcnow() + timedelta(minutes=TOKEN_LIFE)
    token = jwt.encode({"sub": user.email_addr, "exp": exp}, AUTH_SECRET, algorithm=ALGO)
    
    return {
        "access_token": token, "token_type": "bearer",
        "user_id": user.uid, "role": user.access_role
    }

@app.post("/auth/register", response_model=UserRead)
def register_user(email: str, password: str, name: str, role: str, db: Session = Depends(get_db_connection)):
    if db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == email)).scalars().first():
        raise HTTPException(400, detail="Email exists")
    
    new_id = SystemIdentity(
        email_addr=email, auth_hash=hash_pass(password),
        full_name=name, access_role=role
    )
    db.add(new_id)
    db.commit()
    db.refresh(new_id)
    
    # If supplier admin, create profile immediately
    if role == "supplier_admin":
        db.add(VendorEntity(display_name=name, identity_id=new_id.uid))
        db.commit()

    return {"id": new_id.uid, "email": new_id.email_addr, "name": new_id.full_name, "role": new_id.access_role}

# --- B. Discovery & Linking ---

@app.get("/suppliers", response_model=List[SupplierRead])
def list_all_suppliers(db: Session = Depends(get_db_connection)):
    vendors = db.execute(select(VendorEntity)).scalars().all()
    # Direct mapping: Internal 'vid' -> External 'id'
    return [{"id": v.vid, "name": v.display_name, "verification_status": v.is_verified} for v in vendors]

@app.post("/links", response_model=LinkRequestRead)
def request_link(req: LinkRequestCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    if user.access_role != "consumer": raise HTTPException(403, detail="Consumers only")
    
    conn = BizConnection(consumer_ref_id=user.uid, vendor_ref_id=req.supplier_id)
    db.add(conn)
    db.commit()
    db.refresh(conn)
    
    return {
        "id": conn.cid, "consumer_id": conn.consumer_ref_id, "supplier_id": conn.vendor_ref_id,
        "status": conn.current_status, "created_at": conn.timestamp
    }

@app.get("/links/my-requests", response_model=List[LinkRequestRead])
def get_my_links(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    # Join with Vendor to get the name
    results = db.execute(
        select(BizConnection, VendorEntity)
        .join(VendorEntity, BizConnection.vendor_ref_id == VendorEntity.vid)
        .where(BizConnection.consumer_ref_id == user.uid)
    ).all()
    
    return [
        {
            "id": l.cid, "consumer_id": l.consumer_ref_id, "supplier_id": l.vendor_ref_id,
            "status": l.current_status, "created_at": l.timestamp, "supplier_name": v.display_name
        } for l, v in results
    ]

# --- C. Supplier Dashboard ---

@app.get("/supplier/links", response_model=List[LinkRequestRead])
def get_incoming_links(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: return []
    
    links = db.execute(select(BizConnection).where(BizConnection.vendor_ref_id == vendor.vid)).scalars().all()
    return [
        {
            "id": l.cid, "consumer_id": l.consumer_ref_id, "supplier_id": l.vendor_ref_id,
            "status": l.current_status, "created_at": l.timestamp
        } for l in links
    ]

@app.put("/supplier/links/{link_id}", response_model=LinkRequestRead)
def respond_link(link_id: int, update: LinkRequestUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    conn = db.execute(select(BizConnection).where(BizConnection.cid == link_id)).scalars().first()
    if not conn: raise HTTPException(404)
    
    conn.current_status = update.status
    db.commit()
    return {
        "id": conn.cid, "consumer_id": conn.consumer_ref_id, "supplier_id": conn.vendor_ref_id,
        "status": conn.current_status, "created_at": conn.timestamp
    }

@app.post("/products", response_model=ProductRead)
def add_product(prod: ProductCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)

    # Map External 'price' -> Internal 'cost_per_unit'
    item = CatalogItem(
        vendor_id=vendor.vid, title=prod.name, cost_per_unit=prod.price,
        stock_level=prod.quantity, measurement_unit=prod.unit
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return {
        "id": item.pid, "supplier_id": item.vendor_id, "name": item.title,
        "price": item.cost_per_unit, "quantity": item.stock_level, "unit": item.measurement_unit
    }

@app.get("/products/my-catalog", response_model=List[ProductRead])
def my_catalog(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: return []
    
    items = db.execute(select(CatalogItem).where(CatalogItem.vendor_id == vendor.vid)).scalars().all()
    return [
        {"id": i.pid, "supplier_id": i.vendor_id, "name": i.title, "price": i.cost_per_unit, "quantity": i.stock_level, "unit": i.measurement_unit}
        for i in items
    ]

# --- D. Marketplace ---

@app.get("/products/supplier/{supplier_id}", response_model=List[ProductRead])
def public_catalog(supplier_id: int, db: Session = Depends(get_db_connection)):
    items = db.execute(select(CatalogItem).where(CatalogItem.vendor_id == supplier_id)).scalars().all()
    return [
        {"id": i.pid, "supplier_id": i.vendor_id, "name": i.title, "price": i.cost_per_unit, "quantity": i.stock_level, "unit": i.measurement_unit}
        for i in items
    ]

@app.post("/orders", response_model=OrderRead)
def place_order(order: OrderCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    # 1. Calculate total
    total_cost = 0
    for item in order.items:
        p = db.execute(select(CatalogItem).where(CatalogItem.pid == item.product_id)).scalars().first()
        if p: total_cost += (p.cost_per_unit * item.quantity)

    # 2. Create Flow (Order)
    flow = CommerceFlow(
        buyer_uid=user.uid, vendor_vid=order.supplier_id, 
        net_value=total_cost, flow_status="pending"
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)

    # 3. Add lines (optional for simple MVP return, but good for data)
    for item in order.items:
        db.add(FlowLine(flow_id=flow.oid, item_id=item.product_id, count=item.quantity))
    db.commit()

    return {
        "id": flow.oid, "consumer_id": user.uid, "supplier_id": order.supplier_id,
        "total_amount": flow.net_value, "status": flow.flow_status, "created_at": flow.created_on
    }

# --- E. Incident Management ---

@app.post("/complaints", response_model=ComplaintRead)
def submit_complaint(comp: ComplaintCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    case = SupportCase(
        consumer_uid=user.uid, narrative=comp.details, linked_order_id=comp.order_id
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    
    return {
        "id": case.sc_id, "consumer_id": case.consumer_uid, "details": case.narrative,
        "status": case.case_status, "created_at": case.opened_at
    }

@app.get("/complaints", response_model=List[ComplaintRead])
def list_complaints(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    cases = db.execute(select(SupportCase).where(SupportCase.consumer_uid == user.uid)).scalars().all()
    return [
        {"id": c.sc_id, "consumer_id": c.consumer_uid, "details": c.narrative, "status": c.case_status, "created_at": c.opened_at}
        for c in cases
    ]

@app.put("/complaints/{id}/escalate", response_model=ComplaintRead)
def escalate_case(id: int, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    # Simple logic: Any authorized user can update status for MVP
    case = db.execute(select(SupportCase).where(SupportCase.sc_id == id)).scalars().first()
    if not case: raise HTTPException(404)
    
    case.case_status = "investigating"
    # Auto-assign if the user is staff (logic simplified for MVP)
    if user.access_role in ["supplier_sales", "supplier_manager"]:
        case.sales_agent_id = user.uid
        
    db.commit()
    return {
        "id": case.sc_id, "consumer_id": case.consumer_uid, "details": case.narrative,
        "status": case.case_status, "created_at": case.opened_at,
        "assigned_sales_id": case.sales_agent_id
    }

# --- F. Chat ---

@app.get("/chat/{other_user_id}", response_model=List[MessageRead])
def get_chat_history(other_user_id: int, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    msgs = db.execute(select(CommMessage).where(
        or_(
            (CommMessage.sender_uid == user.uid) & (CommMessage.recipient_uid == other_user_id),
            (CommMessage.sender_uid == other_user_id) & (CommMessage.recipient_uid == user.uid)
        )
    ).order_by(CommMessage.sent_at)).scalars().all()
    
    return [
        {"id": m.mid, "sender_id": m.sender_uid, "recipient_id": m.recipient_uid, "content": m.text_body, "timestamp": m.sent_at}
        for m in msgs
    ]

@app.post("/chat", response_model=MessageRead)
def send_msg(msg: MessageCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    m = CommMessage(sender_uid=user.uid, recipient_uid=msg.recipient_id, text_body=msg.content)
    db.add(m)
    db.commit()
    db.refresh(m)
    
    return {
        "id": m.mid, "sender_id": m.sender_uid, "recipient_id": m.recipient_uid,
        "content": m.text_body, "timestamp": m.sent_at
    }
