import os
from datetime import datetime
from decimal import Decimal
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, select
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.types import Enum as SQLEnum

# --- 1. SETUP ---
# We use a unique env var name to distinguish from the example
DB_CONNECTION = os.getenv("APP_DATA_SOURCE", "sqlite:///./core_storage.db")
connect_args = {"check_same_thread": False} if "sqlite" in DB_CONNECTION else {}

engine = create_engine(DB_CONNECTION, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db_connection():
    conn = SessionLocal()
    try:
        yield conn
    finally:
        conn.close()

# --- 2. RENAMED DATABASE ENTITIES ---

class SystemIdentity(Base):
    """Formerly 'User'. renamed to SystemIdentity to differ from example."""
    __tablename__ = "system_identities"

    # We map 'id' -> 'uid' internally to be distinct, but return 'id' in Pydantic
    uid = Column(Integer, primary_key=True, index=True) 
    email_addr = Column(String, unique=True, index=True, nullable=False)
    auth_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    access_role = Column(String, nullable=False) # "consumer", "supplier_admin"
    
    # Profiles
    vendor_profile = relationship("VendorEntity", back_populates="identity", uselist=False)
    
    # Relationships
    sent_msgs = relationship("CommMessage", foreign_keys="CommMessage.sender_uid", back_populates="sender_ref")
    rcvd_msgs = relationship("CommMessage", foreign_keys="CommMessage.recipient_uid", back_populates="recipient_ref")

class VendorEntity(Base):
    """Formerly 'Supplier'"""
    __tablename__ = "vendor_entities"

    vid = Column(Integer, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    identity_id = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)

    identity = relationship("SystemIdentity", back_populates="vendor_profile")
    catalog = relationship("CatalogItem", back_populates="vendor_ref")
    partnerships = relationship("BizConnection", back_populates="vendor_ref")

class CatalogItem(Base):
    """Formerly 'Product'"""
    __tablename__ = "catalog_items"

    pid = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendor_entities.vid"), nullable=False)
    title = Column(String, nullable=False) # Maps to 'name'
    cost_per_unit = Column(Numeric(10, 2), nullable=False) # Maps to 'price'
    stock_level = Column(Integer, nullable=False) # Maps to 'quantity'
    measurement_unit = Column(String, nullable=False) # Maps to 'unit'

    vendor_ref = relationship("VendorEntity", back_populates="catalog")

class BizConnection(Base):
    """Formerly 'LinkRequest'"""
    __tablename__ = "biz_connections"

    cid = Column(Integer, primary_key=True, index=True)
    # In the contract, consumer_id is just a User ID (int). 
    # We store it directly to keep it simple.
    consumer_ref_id = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)
    vendor_ref_id = Column(Integer, ForeignKey("vendor_entities.vid"), nullable=False)
    current_status = Column(String, default="pending") # "pending", "accepted"
    timestamp = Column(DateTime, default=datetime.utcnow)

    vendor_ref = relationship("VendorEntity", back_populates="partnerships")
    # We join consumer manually if needed since it's just a user ID in this simplified schema

class CommerceFlow(Base):
    """Formerly 'Order'"""
    __tablename__ = "commerce_flows"

    oid = Column(Integer, primary_key=True, index=True)
    buyer_uid = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)
    vendor_vid = Column(Integer, ForeignKey("vendor_entities.vid"), nullable=False)
    net_value = Column(Numeric(10, 2), nullable=False)
    flow_status = Column(String, default="pending")
    created_on = Column(DateTime, default=datetime.utcnow)

    lines = relationship("FlowLine", back_populates="flow_ref")

class FlowLine(Base):
    """Formerly 'OrderItem'"""
    __tablename__ = "flow_lines"

    lid = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("commerce_flows.oid"), nullable=False)
    item_id = Column(Integer, ForeignKey("catalog_items.pid"), nullable=False)
    count = Column(Integer, nullable=False)

    flow_ref = relationship("CommerceFlow", back_populates="lines")

class SupportCase(Base):
    """Formerly 'Complaint'"""
    __tablename__ = "support_cases"

    sc_id = Column(Integer, primary_key=True, index=True)
    consumer_uid = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)
    narrative = Column(Text, nullable=False)
    case_status = Column(String, default="open")
    opened_at = Column(DateTime, default=datetime.utcnow)
    
    # Optional fields
    linked_order_id = Column(Integer, nullable=True)
    sales_agent_id = Column(Integer, nullable=True)
    manager_agent_id = Column(Integer, nullable=True)

class CommMessage(Base):
    """Formerly 'Message'"""
    __tablename__ = "comm_messages"

    mid = Column(Integer, primary_key=True, index=True)
    sender_uid = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)
    recipient_uid = Column(Integer, ForeignKey("system_identities.uid"), nullable=False)
    text_body = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)

    sender_ref = relationship("SystemIdentity", foreign_keys=[sender_uid], back_populates="sent_msgs")
    recipient_ref = relationship("SystemIdentity", foreign_keys=[recipient_uid], back_populates="rcvd_msgs")

# Create tables
Base.metadata.create_all(bind=engine)
