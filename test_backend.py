import pytest
from fastapi.testclient import TestClient
from app_runner import app
from data_storage import Base, engine, get_db_connection, SessionLocal

# --- Setup: Reset Database for fresh testing ---
# This ensures every test run starts with a clean slate (empty tables)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

# Global variables to store IDs across tests
supplier_token = None
consumer_token = None
supplier_id = None
product_id = None

def test_1_register_supplier():
    global supplier_id
    response = client.post(
        "/auth/register",
        params={
            "email": "supplier@corp.com",
            "password": "pass",
            "name": "MegaCorp",
            "role": "supplier_admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "supplier@corp.com"
    assert data["role"] == "supplier_admin"
    supplier_id = data["id"]

def test_2_login_supplier():
    global supplier_token
    response = client.post(
        "/auth/token",
        data={"username": "supplier@corp.com", "password": "pass"}
    )
    assert response.status_code == 200
    supplier_token = response.json()["access_token"]

def test_3_create_product():
    global product_id
    # Must use the supplier token
    headers = {"Authorization": f"Bearer {supplier_token}"}
    payload = {
        "name": "Super Widget",
        "price": 10.50,
        "quantity": 100,
        "unit": "box"
    }
    response = client.post("/products", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Super Widget"
    product_id = data["id"]

def test_4_register_and_login_consumer():
    global consumer_token
    # Register
    client.post(
        "/auth/register",
        params={
            "email": "buyer@local.com",
            "password": "pass",
            "name": "Local Buyer",
            "role": "consumer"
        }
    )
    # Login
    response = client.post(
        "/auth/token",
        data={"username": "buyer@local.com", "password": "pass"}
    )
    assert response.status_code == 200
    consumer_token = response.json()["access_token"]

def test_5_place_order():
    # Must use the consumer token
    headers = {"Authorization": f"Bearer {consumer_token}"}
    payload = {
        "supplier_id": 1,  # Assuming first supplier is ID 1
        "items": [
            {"product_id": product_id, "quantity": 5}
        ]
    }
    response = client.post("/orders", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    # Price check: 5 items * 10.50 = 52.50
    assert data["total_amount"] == 52.50

def test_6_verify_supplier_products_list():
    # Public endpoint, no auth needed in the contract? 
    # (If your code requires auth, add headers)
    response = client.get(f"/products/supplier/1") 
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["name"] == "Super Widget"

def test_7_unauthorized_access():
    # Try to create a product without a token
    response = client.post("/products", json={"name": "Bad", "price": 1, "quantity": 1, "unit": "x"})
    assert response.status_code == 401


# --- EDGE CASE & NEGATIVE TESTING ---

def test_8_register_duplicate_email():
    # Try to register the same supplier email from test_1
    response = client.post(
        "/auth/register",
        params={
            "email": "supplier@corp.com", # Already exists
            "password": "newpass",
            "name": "Imposter",
            "role": "supplier_admin"
        }
    )
    # Backend should catch this and return 400
    assert response.status_code == 400
    assert response.json()["detail"] == "Email exists"

def test_9_login_wrong_password():
    response = client.post(
        "/auth/token",
        data={"username": "supplier@corp.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Bad credentials"

def test_10_consumer_cannot_create_products():
    # Use the CONSUMER token to try to create a product
    # (Only suppliers should be able to do this)
    headers = {"Authorization": f"Bearer {consumer_token}"}
    payload = {
        "name": "Illegal Item", 
        "price": 100.0, 
        "quantity": 1, 
        "unit": "kg"
    }
    response = client.post("/products", json=payload, headers=headers)
    
    # The backend logic checks for a Vendor profile, finds none for this user, and raises 403
    assert response.status_code == 403

def test_11_supplier_cannot_request_links():
    # Use the SUPPLIER token to try to request a link to another supplier
    # (Only consumers can request links)
    headers = {"Authorization": f"Bearer {supplier_token}"}
    payload = {"supplier_id": 1}
    
    response = client.post("/links", json=payload, headers=headers)
    
    # The backend explicitly checks user.access_role != "consumer"
    assert response.status_code == 403
    assert response.json()["detail"] == "Consumers only"

def test_12_get_nonexistent_supplier_products():
    # Try to get products for a supplier ID that doesn't exist (e.g., 9999)
    response = client.get("/products/supplier/9999")
    
    assert response.status_code == 200
    data = response.json()
    # Should return an empty list, not crash
    assert data == []
