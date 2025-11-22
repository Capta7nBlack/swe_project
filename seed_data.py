# seed_data.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Import your unique models
from data_storage import SystemIdentity, VendorEntity, DB_CONNECTION

# 1. Setup Database Connection
# Uses the same database file as your application
engine = create_engine(DB_CONNECTION, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# 2. Setup Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_hash(password):
    return pwd_context.hash(password)

# 3. Create User Function
def create_account(email, password, name, role):
    # Check if user already exists
    existing = db.query(SystemIdentity).filter_by(email_addr=email).first()
    if existing:
        print(f"⚠️  User {email} already exists. Skipping.")
        return

    print(f"➕ Creating {role}: {email}...")
    
    # Create Identity (User)
    user = SystemIdentity(
        email_addr=email,
        auth_hash=get_hash(password),
        full_name=name,
        access_role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If Supplier, auto-create their Vendor Profile
    if role == "supplier_admin":
        profile = VendorEntity(display_name=f"{name}'s Shop", identity_id=user.uid, is_verified=True)
        db.add(profile)
        db.commit()
    
    print(f"✅ Created user ID: {user.uid}")

if __name__ == "__main__":
    print("--- Starting Data Seed ---")
    
    # 1. Create the Demo Supplier (Matches frontend 'Use Demo' button)
    create_account("supplier@test.com", "123", "Demo Supplier", "supplier_admin")
    
    # 2. Create a Demo Consumer (For testing buyer features)
    create_account("buyer@test.com", "123", "Demo Buyer", "consumer")
    
    print("\n🎉 Data seeding complete! You can now log in.")
