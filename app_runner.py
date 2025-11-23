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

from data_storage import (
    get_db_connection, SystemIdentity, VendorEntity, BuyerProfile, CatalogItem, 
    BizConnection, CommerceFlow, FlowLine, SupportCase, CommMessage
)

# --- CONFIGURATION ---
AUTH_SECRET = "SUPER_SECRET_KEY_CHANGE_ME"
ALGO = "HS256"
TOKEN_LIFE = 60

security_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

app = FastAPI(title="SCP Core", version="2.1.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- SCHEMAS ---

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str

class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: str

class SupplierRead(BaseModel):
    id: int
    name: str
    verification_status: bool
    about: Optional[str] = None
    is_visible: bool

class SupplierUpdate(BaseModel):
    about: str

class ProductBase(BaseModel):
    name: str
    price: float
    quantity: int
    unit: str

class ProductCreate(ProductBase):
    pass

# New Schema for Editing Products
class ProductUpdate(ProductBase):
    pass

class ProductRead(ProductBase):
    id: int
    supplier_id: int
    original_price: Optional[float] = None
    discountPercent: Optional[int] = 0

class LinkRequestCreate(BaseModel):
    supplier_id: int

class LinkRequestRead(BaseModel):
    id: int
    consumer_id: int
    supplier_id: int
    supplier_user_id: Optional[int] = None 
    status: str
    created_at: datetime
    consumer_name: Optional[str] = None # Added to display consumer name
    supplier_name: Optional[str] = None

class LinkRequestUpdate(BaseModel):
    status: str

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

class OrderStatusUpdate(BaseModel):
    status: str

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

class MessageCreate(BaseModel):
    recipient_id: int
    content: str

class MessageRead(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    timestamp: datetime

class DiscountUpdate(BaseModel):
    percent: int

# --- HELPERS ---
def hash_pass(p): return security_ctx.hash(p)
def check_pass(p, h): return security_ctx.verify(p, h)

def get_current_actor(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_connection)):
    try:
        payload = jwt.decode(token, AUTH_SECRET, algorithms=[ALGO])
        email = payload.get("sub")
        if not email: raise HTTPException(401)
    except JWTError:
        raise HTTPException(401, detail="Invalid Token")
    
    actor = db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == email)).scalars().first()
    if not actor: raise HTTPException(401)
    return actor

@app.get("/")
def root():
    return {"status": "SCP Backend Online", "version": "2.1.0"}

# --- ENDPOINTS ---

@app.post("/auth/token", response_model=Token)
def generate_token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db_connection)):
    user = db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == form.username)).scalars().first()
    if not user or not check_pass(form.password, user.auth_hash):
        raise HTTPException(401, detail="Bad credentials")
    
    exp = datetime.utcnow() + timedelta(minutes=TOKEN_LIFE)
    token = jwt.encode({"sub": user.email_addr, "exp": exp}, AUTH_SECRET, algorithm=ALGO)
    return {"access_token": token, "token_type": "bearer", "user_id": user.uid, "role": user.access_role}

@app.post("/auth/register", response_model=UserRead)
def register_user(user_data: UserCreate, db: Session = Depends(get_db_connection)):
    # Changed to accept JSON body (UserCreate model) instead of query params
    if db.execute(select(SystemIdentity).where(SystemIdentity.email_addr == user_data.email)).scalars().first():
        raise HTTPException(400, detail="Email exists")
    
    new_id = SystemIdentity(
        email_addr=user_data.email, 
        auth_hash=hash_pass(user_data.password), 
        full_name=user_data.name, 
        access_role=user_data.role
    )
    db.add(new_id)
    db.commit()
    db.refresh(new_id)
    
    if user_data.role == "supplier_admin":
        db.add(VendorEntity(display_name=user_data.name, identity_id=new_id.uid, is_discoverable=False))
        db.commit()
    elif user_data.role == "consumer":
        db.add(BuyerProfile(org_name=user_data.name, identity_id=new_id.uid))
        db.commit()

    return {"id": new_id.uid, "email": new_id.email_addr, "name": new_id.full_name, "role": new_id.access_role}

# --- SUPPLIER PROFILE MANAGEMENT ---

@app.put("/supplier/profile")
def update_profile(data: SupplierUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403, detail="Not a supplier")
    
    vendor.about_text = data.about
    db.commit()
    return {"status": "updated", "about": vendor.about_text}

@app.post("/supplier/visibility/{action}")
def toggle_visibility(action: str, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)
    
    if action == "show":
        vendor.is_discoverable = True
    elif action == "hide":
        vendor.is_discoverable = False
    else:
        raise HTTPException(400, detail="Action must be 'show' or 'hide'")
        
    db.commit()
    return {"status": "updated", "is_visible": vendor.is_discoverable}

# --- DISCOVERY & LINKING ---

@app.get("/suppliers", response_model=List[SupplierRead])
def list_all_suppliers(db: Session = Depends(get_db_connection)):
    vendors = db.execute(select(VendorEntity).where(VendorEntity.is_discoverable == True)).scalars().all()
    return [
        {
            "id": v.vid, 
            "name": v.display_name, 
            "verification_status": v.is_verified,
            "about": v.about_text,
            "is_visible": v.is_discoverable
        } for v in vendors
    ]

@app.post("/links", response_model=LinkRequestRead)
def request_link(req: LinkRequestCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    if user.access_role != "consumer": raise HTTPException(403, detail="Consumers only")
    
    existing = db.execute(select(BizConnection).where(
        BizConnection.consumer_ref_id == user.uid,
        BizConnection.vendor_ref_id == req.supplier_id
    )).scalars().first()
    
    if existing:
        return {
            "id": existing.cid, "consumer_id": existing.consumer_ref_id, "supplier_id": existing.vendor_ref_id,
            "status": existing.current_status, "created_at": existing.timestamp
        }

    conn = BizConnection(consumer_ref_id=user.uid, vendor_ref_id=req.supplier_id, current_status="pending")
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return {"id": conn.cid, "consumer_id": conn.consumer_ref_id, "supplier_id": conn.vendor_ref_id, "status": conn.current_status, "created_at": conn.timestamp}

@app.get("/links/my-requests", response_model=List[LinkRequestRead])
def get_my_links(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    results = db.execute(
        select(BizConnection, VendorEntity)
        .join(VendorEntity, BizConnection.vendor_ref_id == VendorEntity.vid)
        .where(BizConnection.consumer_ref_id == user.uid)
    ).all()

    return [{
        "id": l.cid, 
        "consumer_id": l.consumer_ref_id, 
        "supplier_id": l.vendor_ref_id,
        "supplier_user_id": v.identity_id,  # <--- ADD THIS (Map Vendor to User ID)
        "status": l.current_status, 
        "created_at": l.timestamp, 
        "supplier_name": v.display_name
    } for l, v in results]


@app.get("/supplier/links", response_model=List[LinkRequestRead])
def get_incoming_links(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: return []
    
    # Join with SystemIdentity to get consumer name
    results = db.execute(
        select(BizConnection, SystemIdentity)
        .join(SystemIdentity, BizConnection.consumer_ref_id == SystemIdentity.uid)
        .where(BizConnection.vendor_ref_id == vendor.vid)
    ).all()
    
    links_data = []
    for conn, identity in results:
        links_data.append({
            "id": conn.cid, 
            "consumer_id": conn.consumer_ref_id, 
            "supplier_id": conn.vendor_ref_id, 
            "status": conn.current_status, 
            "created_at": conn.timestamp,
            "consumer_name": identity.full_name
        })
    return links_data

@app.put("/supplier/links/{link_id}", response_model=LinkRequestRead)
def respond_link(link_id: int, update: LinkRequestUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    conn = db.execute(select(BizConnection).where(BizConnection.cid == link_id)).scalars().first()
    if not conn: raise HTTPException(404)
    
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor or vendor.vid != conn.vendor_ref_id:
        raise HTTPException(403)

    conn.current_status = update.status
    db.commit()
    return {"id": conn.cid, "consumer_id": conn.consumer_ref_id, "supplier_id": conn.vendor_ref_id, "status": conn.current_status, "created_at": conn.timestamp}

# --- PRODUCTS ---

@app.get("/products/supplier/{supplier_id}", response_model=List[ProductRead])
def public_catalog(supplier_id: int, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    # 1. Find the link between Consumer (User) and Supplier (Vendor ID)
    link = db.execute(select(BizConnection).where(
        BizConnection.consumer_ref_id == user.uid,
        BizConnection.vendor_ref_id == supplier_id
    )).scalars().first()

    # 2. Strict Security Check + CASE INSENSITIVE FIX
    # We check .lower() so "Accepted" matches "accepted"
    if not link or link.current_status.lower() != "accepted":
         raise HTTPException(status_code=403, detail="Access denied. You must connect with this supplier first.")

    # 3. Fetch the products
    items = db.execute(select(CatalogItem).where(CatalogItem.vendor_id == supplier_id)).scalars().all()
    
    # 4. Format the results (calculate discounts)
    result = []
    for i in items:
        orig = float(i.cost_per_unit)
        disc = i.discount_percent or 0
        final = orig * (1 - disc / 100.0)
        result.append({
            "id": i.pid, "supplier_id": i.vendor_id, "name": i.title,
            "price": final, "original_price": orig, "discountPercent": disc,
            "quantity": i.stock_level, "unit": i.measurement_unit
        })
    return result



@app.post("/products", response_model=ProductRead)
def add_product(prod: ProductCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)
    item = CatalogItem(vendor_id=vendor.vid, title=prod.name, cost_per_unit=prod.price, stock_level=prod.quantity, measurement_unit=prod.unit)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.pid, "supplier_id": item.vendor_id, "name": item.title, "price": item.cost_per_unit, "quantity": item.stock_level, "unit": item.measurement_unit, "original_price": item.cost_per_unit, "discountPercent": 0}

@app.get("/products/my-catalog", response_model=List[ProductRead])
def my_catalog(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: return []
    
    items = db.execute(select(CatalogItem).where(CatalogItem.vendor_id == vendor.vid)).scalars().all()
    result = []
    for i in items:
        orig = float(i.cost_per_unit)
        disc = i.discount_percent or 0
        final = orig * (1 - disc / 100.0)
        result.append({
            "id": i.pid, "supplier_id": i.vendor_id, "name": i.title,
            "price": final, "original_price": orig, "discountPercent": disc,
            "quantity": i.stock_level, "unit": i.measurement_unit
        })
    return result

@app.put("/products/{pid}/discount")
def apply_discount(pid: int, payload: DiscountUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)
    item = db.execute(select(CatalogItem).where(CatalogItem.pid == pid, CatalogItem.vendor_id == vendor.vid)).scalars().first()
    if not item: raise HTTPException(404)
    item.discount_percent = payload.percent
    db.commit()
    return {"status": "updated", "percent": payload.percent}

# MISSING ENDPOINT: Update Product (Edit button)
@app.put("/products/{pid}", response_model=ProductRead)
def update_product(pid: int, prod: ProductUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)
    
    item = db.execute(select(CatalogItem).where(CatalogItem.pid == pid, CatalogItem.vendor_id == vendor.vid)).scalars().first()
    if not item: raise HTTPException(404)
    
    item.title = prod.name
    item.cost_per_unit = prod.price
    item.stock_level = prod.quantity
    item.measurement_unit = prod.unit
    
    db.commit()
    db.refresh(item)
    
    orig = float(item.cost_per_unit)
    disc = item.discount_percent or 0
    final = orig * (1 - disc / 100.0)
    
    return {
        "id": item.pid, "supplier_id": item.vendor_id, "name": item.title,
        "price": final, "original_price": orig, "discountPercent": disc,
        "quantity": item.stock_level, "unit": item.measurement_unit
    }

# MISSING ENDPOINT: Delete Product
@app.post("/products/delete/{pid}")
def delete_product(pid: int, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403)
    
    item = db.execute(select(CatalogItem).where(CatalogItem.pid == pid, CatalogItem.vendor_id == vendor.vid)).scalars().first()
    if not item: raise HTTPException(404)
    
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": pid}

# --- ORDERING ---

@app.post("/orders", response_model=OrderRead)
def place_order(order: OrderCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    existing_link = db.execute(select(BizConnection).where(
        BizConnection.consumer_ref_id == user.uid,
        BizConnection.vendor_ref_id == order.supplier_id,
        BizConnection.current_status == "accepted"
    )).scalars().first()

    if not existing_link:
        raise HTTPException(status_code=403, detail="Must have accepted connection to order.")

    total_cost = 0.0
    for item in order.items:
        p = db.execute(select(CatalogItem).where(CatalogItem.pid == item.product_id)).scalars().first()
        if p: 
            orig = float(p.cost_per_unit)
            disc = p.discount_percent or 0
            final_price = orig * (1 - disc / 100.0)
            total_cost += (final_price * item.quantity)

    flow = CommerceFlow(buyer_uid=user.uid, vendor_vid=order.supplier_id, net_value=total_cost, flow_status="pending")
    db.add(flow)
    db.commit()
    db.refresh(flow)
    for item in order.items:
        db.add(FlowLine(flow_id=flow.oid, item_id=item.product_id, count=item.quantity))
    db.commit()
    return {"id": flow.oid, "consumer_id": user.uid, "supplier_id": order.supplier_id, "total_amount": flow.net_value, "status": flow.flow_status, "created_at": flow.created_on}

@app.get("/orders", response_model=List[OrderRead])
def get_my_orders(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if vendor:
        # Supplier sees orders for them
        orders = db.execute(select(CommerceFlow).where(CommerceFlow.vendor_vid == vendor.vid)).scalars().all()
    else:
        # Consumer sees orders they placed
        orders = db.execute(select(CommerceFlow).where(CommerceFlow.buyer_uid == user.uid)).scalars().all()
    
    return [{"id": o.oid, "consumer_id": o.buyer_uid, "supplier_id": o.vendor_vid, "total_amount": float(o.net_value), "status": o.flow_status, "created_at": o.created_on} for o in orders]

# MISSING ENDPOINT: Update Order Status (Accept/Reject)
@app.put("/orders/{oid}/status")
def update_order_status(oid: int, status_update: OrderStatusUpdate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    vendor = db.execute(select(VendorEntity).where(VendorEntity.identity_id == user.uid)).scalars().first()
    if not vendor: raise HTTPException(403, detail="Only suppliers can manage orders")
    
    order = db.execute(select(CommerceFlow).where(CommerceFlow.oid == oid, CommerceFlow.vendor_vid == vendor.vid)).scalars().first()
    if not order: raise HTTPException(404)
    
    order.flow_status = status_update.status
    db.commit()
    return {"status": "updated", "order_status": order.flow_status}

# --- CHAT & SUPPORT ---

@app.post("/complaints", response_model=ComplaintRead)
def submit_complaint(comp: ComplaintCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    case = SupportCase(consumer_uid=user.uid, narrative=comp.details, linked_order_id=comp.order_id)
    db.add(case)
    db.commit()
    db.refresh(case)
    return {"id": case.sc_id, "consumer_id": case.consumer_uid, "details": case.narrative, "status": case.case_status, "created_at": case.opened_at}

@app.get("/complaints", response_model=List[ComplaintRead])
def list_complaints(user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    cases = db.execute(select(SupportCase).where(SupportCase.consumer_uid == user.uid)).scalars().all()
    return [{"id": c.sc_id, "consumer_id": c.consumer_uid, "details": c.narrative, "status": c.case_status, "created_at": c.opened_at} for c in cases]

@app.get("/chat/{other_user_id}", response_model=List[MessageRead])
def get_chat_history(other_user_id: int, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    msgs = db.execute(select(CommMessage).where(or_((CommMessage.sender_uid == user.uid) & (CommMessage.recipient_uid == other_user_id), (CommMessage.sender_uid == other_user_id) & (CommMessage.recipient_uid == user.uid))).order_by(CommMessage.sent_at)).scalars().all()
    return [{"id": m.mid, "sender_id": m.sender_uid, "recipient_id": m.recipient_uid, "content": m.text_body, "timestamp": m.sent_at} for m in msgs]

@app.post("/chat", response_model=MessageRead)
def send_msg(msg: MessageCreate, user: SystemIdentity = Depends(get_current_actor), db: Session = Depends(get_db_connection)):
    m = CommMessage(sender_uid=user.uid, recipient_uid=msg.recipient_id, text_body=msg.content)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.mid, "sender_id": m.sender_uid, "recipient_id": m.recipient_uid, "content": m.text_body, "timestamp": m.sent_at}
