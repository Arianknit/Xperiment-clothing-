from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date, timedelta
import barcode
from barcode.writer import ImageWriter
import qrcode
from qrcode.image.pil import PilImage
import io
import hashlib
import jwt
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory for catalog images
UPLOADS_DIR = ROOT_DIR / "uploads" / "catalog_images"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'garment-manufacturing-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Password hashing
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# JWT Token functions
def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# User Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    full_name: str
    role: str = "user"  # admin, user
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None


# Define Models
class FabricLot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lot_number: str
    entry_date: datetime
    fabric_type: str
    supplier_name: str
    color: str
    quantity: float  # in kg
    rib_quantity: float  # in kg
    rate_per_kg: float
    total_amount: float
    remaining_quantity: float
    remaining_rib_quantity: float
    number_of_rolls: Optional[int] = 1
    roll_numbers: Optional[List[str]] = []
    roll_weights: Optional[List[float]] = []  # Individual weight of each roll
    scale_readings: Optional[List[float]] = []  # Cumulative scale reading after each roll
    created_by: Optional[str] = None  # Username who created
    updated_by: Optional[str] = None  # Username who last updated
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FabricLotCreate(BaseModel):
    lot_number: Optional[str] = None  # Auto-generated if not provided
    entry_date: datetime
    fabric_type: str
    supplier_name: str
    color: str
    rib_quantity: float
    rate_per_kg: float
    number_of_rolls: Optional[int] = 1

class FabricReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fabric_lot_id: str
    lot_number: str
    returned_rolls: List[str]  # Roll numbers being returned
    quantity_returned: float
    reason: str
    comments: Optional[str] = ""
    return_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FabricReturnCreate(BaseModel):
    returned_rolls: List[str]
    quantity_returned: float
    reason: str
    comments: Optional[str] = ""

# Customer/Production Returns Models
class CustomerReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_type: str  # 'dispatch', 'outsourcing', 'ironing'
    source_id: str  # Reference to dispatch/order ID
    return_date: datetime
    quantity: int
    reason: str
    notes: Optional[str] = ""
    status: str = "Pending"  # Pending, Accepted, Rejected
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    stock_restored: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerReturnCreate(BaseModel):
    source_type: str
    source_id: str
    return_date: datetime
    quantity: int
    reason: str
    notes: Optional[str] = ""

class CuttingOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cutting_lot_number: Optional[str] = ""
    cutting_master_name: Optional[str] = ""
    cutting_date: datetime
    fabric_lot_id: Optional[str] = None
    lot_number: Optional[str] = None
    color: Optional[str] = ""
    category: str  # Kids, Mens, Women
    style_type: str
    fabric_taken: float
    fabric_returned: float
    fabric_used: float
    rib_taken: float
    rib_returned: float
    rib_used: float
    size_distribution: Dict[str, int]  # {"S": 10, "M": 20, ...}
    bundle_distribution: Optional[Dict[str, int]] = {}  # {"Front": 100, "Back": 100, ...}
    total_quantity: int
    cutting_rate_per_pcs: Optional[float] = 0.0
    total_cutting_amount: Optional[float] = 0.0
    amount_paid: Optional[float] = 0.0
    balance: Optional[float] = 0.0
    payment_status: Optional[str] = "Unpaid"  # Unpaid, Partial, Paid
    total_fabric_cost: float
    used_in_catalog: Optional[bool] = False
    catalog_id: Optional[str] = None
    catalog_name: Optional[str] = None
    sent_to_ironing: Optional[bool] = False
    completed_operations: Optional[List[str]] = []  # Track operations done (Printing, Stitching, etc.)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CuttingOrderCreate(BaseModel):
    cutting_lot_number: Optional[str] = None  # Auto-generated if not provided
    cutting_master_name: str
    cutting_date: datetime
    fabric_lot_id: Optional[str] = None  # Optional for old cutting lots
    lot_number: Optional[str] = None  # Optional for old cutting lots
    color: Optional[str] = ""
    category: str
    style_type: str
    fabric_taken: Optional[float] = 0.0
    fabric_returned: Optional[float] = 0.0
    rib_taken: Optional[float] = 0.0
    rib_returned: Optional[float] = 0.0
    size_distribution: Dict[str, int]
    bundle_distribution: Optional[Dict[str, int]] = {}
    cutting_rate_per_pcs: float
    is_old_lot: Optional[bool] = False  # Flag for old cutting lots without fabric entry

class CuttingOrderUpdate(BaseModel):
    cutting_lot_number: Optional[str] = None
    cutting_master_name: Optional[str] = None
    cutting_date: Optional[datetime] = None
    category: Optional[str] = None
    style_type: Optional[str] = None
    fabric_taken: Optional[float] = None
    fabric_returned: Optional[float] = None
    rib_taken: Optional[float] = None
    rib_returned: Optional[float] = None
    cutting_rate_per_pcs: Optional[float] = None
    size_distribution: Optional[Dict[str, int]] = None

class PaymentRecord(BaseModel):
    amount: float
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_method: Optional[str] = "Cash"
    notes: Optional[str] = ""

class OutsourcingOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dc_number: str
    dc_date: datetime
    cutting_order_id: str  # Primary cutting order ID (for backward compatibility)
    cutting_order_ids: Optional[List[str]] = []  # Multiple cutting order IDs
    cutting_lot_number: Optional[str] = ""
    cutting_lot_numbers: Optional[List[str]] = []  # Multiple lot numbers
    lot_details: Optional[List[Dict]] = []  # Lot-wise details: [{lot_number, cutting_lot_number, category, style_type, color, size_distribution, quantity}]
    lot_number: str  # Fabric lot number
    color: Optional[str] = ""
    category: str
    style_type: str
    operation_type: str  # Printing, Embroidery, Stone, Sequins, Sticker
    unit_name: str
    size_distribution: Dict[str, int]
    total_quantity: int
    rate_per_pcs: float
    total_amount: float
    notes: Optional[str] = ""  # Comments/Notes for DC
    amount_paid: Optional[float] = 0.0
    balance: Optional[float] = 0.0
    payment_status: Optional[str] = "Unpaid"  # Unpaid, Partial, Paid
    status: str  # Sent, Received, Partial
    whatsapp_sent: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingOrderCreate(BaseModel):
    dc_date: datetime
    cutting_order_ids: List[str]  # Multiple cutting order IDs
    operation_type: str
    unit_name: str
    rate_per_pcs: float
    notes: Optional[str] = ""

# Nominated Outsourcing Unit Model
class OutsourcingUnit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_name: str
    operations: List[str]  # List of operations this unit handles (Printing, Embroidery, etc.)
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingUnitCreate(BaseModel):
    unit_name: str
    operations: List[str]
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""

class OutsourcingOrderUpdate(BaseModel):
    dc_date: Optional[datetime] = None
    operation_type: Optional[str] = None
    unit_name: Optional[str] = None
    rate_per_pcs: Optional[float] = None
    size_distribution: Optional[Dict[str, int]] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # Allow updating status

class OutsourcingReceipt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    outsourcing_order_id: str
    dc_number: str
    receipt_date: datetime
    unit_name: str
    operation_type: str
    sent_distribution: Dict[str, int]
    received_distribution: Dict[str, int]
    shortage_distribution: Dict[str, int]
    mistake_distribution: Optional[Dict[str, int]] = {}  # Mistakes in received goods
    total_sent: int
    total_received: int
    total_shortage: int
    total_mistakes: Optional[int] = 0  # Total mistake pieces
    rate_per_pcs: float
    shortage_debit_amount: float
    mistake_debit_amount: Optional[float] = 0.0  # Debit for mistakes
    sent_to_ironing: Optional[bool] = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingReceiptCreate(BaseModel):
    outsourcing_order_id: str
    receipt_date: datetime
    received_distribution: Dict[str, int]
    mistake_distribution: Optional[Dict[str, int]] = {}  # Mistakes in received goods

class IroningOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dc_number: str
    dc_date: datetime
    receipt_id: str  # outsourcing_receipt_id
    cutting_lot_number: str
    color: Optional[str] = ""
    category: str
    style_type: str
    unit_name: str
    size_distribution: Dict[str, int]
    total_quantity: int
    rate_per_pcs: float
    total_amount: float
    master_pack_ratio: Optional[Dict[str, int]] = {}  # e.g., {"S": 2, "M": 2, "L": 2, "XL": 2}
    complete_packs: Optional[int] = 0
    loose_pieces: Optional[int] = 0
    amount_paid: Optional[float] = 0.0
    balance: Optional[float] = 0.0
    payment_status: Optional[str] = "Unpaid"
    status: str  # Sent, Received
    whatsapp_sent: bool = False
    stock_lot_name: Optional[str] = ""  # Custom lot name for stock entry
    stock_color: Optional[str] = ""  # Custom color for stock entry
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IroningOrderCreate(BaseModel):
    dc_date: datetime
    receipt_id: str
    unit_name: str
    rate_per_pcs: float
    master_pack_ratio: Optional[Dict[str, int]] = {}
    stock_lot_name: Optional[str] = ""  # Custom lot name for stock entry
    stock_color: Optional[str] = ""  # Custom color for stock entry

class IroningReceipt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ironing_order_id: str
    dc_number: str
    receipt_date: datetime
    unit_name: str
    sent_distribution: Dict[str, int]
    received_distribution: Dict[str, int]
    shortage_distribution: Dict[str, int]
    mistake_distribution: Optional[Dict[str, int]] = {}  # Mistakes in received goods
    total_sent: int
    total_received: int
    total_shortage: int
    total_mistakes: Optional[int] = 0  # Total mistake pieces
    rate_per_pcs: float
    shortage_debit_amount: float
    mistake_debit_amount: Optional[float] = 0.0  # Debit for mistakes
    master_pack_ratio: Optional[Dict[str, int]] = {}
    complete_packs: Optional[int] = 0
    loose_pieces: Optional[int] = 0
    loose_pieces_distribution: Optional[Dict[str, int]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IroningReceiptCreate(BaseModel):
    ironing_order_id: str
    receipt_date: datetime
    received_distribution: Dict[str, int]
    mistake_distribution: Optional[Dict[str, int]] = {}  # Mistakes in received goods


# Catalog Models
class Catalog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    catalog_name: str
    catalog_code: str
    description: Optional[str] = None
    color: Optional[str] = ""
    image_url: Optional[str] = None  # URL to catalog product image
    lot_numbers: List[str]  # List of cutting lot numbers
    total_quantity: int
    available_stock: int
    size_distribution: Dict[str, int]
    master_pack_ratio: Optional[Dict[str, int]] = {}  # e.g., {"M": 1, "L": 1, "XL": 1, "XXL": 1}
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Stock Models
class Stock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stock_code: str  # Unique stock identifier
    lot_number: str  # Can be from cutting or historical
    source: str  # "cutting", "ironing", "historical"
    category: str  # Mens, Ladies, Kids
    style_type: str  # Round Neck, Polo, etc.
    color: Optional[str] = ""
    size_distribution: Dict[str, int]  # {"M": 100, "L": 100, ...}
    total_quantity: int
    available_quantity: int
    master_pack_ratio: Optional[Dict[str, int]] = {}  # {"M": 2, "L": 2, ...}
    notes: Optional[str] = None
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class StockCreate(BaseModel):
    lot_number: str
    category: str
    style_type: str
    color: Optional[str] = ""
    size_distribution: Dict[str, int]
    master_pack_ratio: Optional[Dict[str, int]] = {}
    notes: Optional[str] = None

class StockDispatch(BaseModel):
    master_packs: int
    loose_pcs: Dict[str, int]
    customer_name: str
    bora_number: str
    notes: Optional[str] = None

class CatalogCreate(BaseModel):
    catalog_name: str
    catalog_code: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    lot_numbers: List[str]

class CatalogDispatch(BaseModel):
    master_packs: int  # Number of complete master packs to dispatch
    loose_pcs: Dict[str, int]  # Loose pieces per size (e.g., {"M": 5, "L": 3})
    customer_name: str
    dispatch_date: datetime
    bora_number: str  # Bundle/Batch number
    color: str  # T-shirt color
    lot_number: str  # The lot being dispatched from
    notes: Optional[str] = None

# Bulk Dispatch Models - For dispatching multiple items at once
class BulkDispatchItem(BaseModel):
    stock_id: str
    stock_code: str
    lot_number: str
    category: str
    style_type: str
    color: Optional[str] = ""
    master_packs: int
    loose_pcs: Dict[str, int]  # {"M": 5, "L": 3}
    master_pack_ratio: Optional[Dict[str, int]] = {}
    size_distribution: Dict[str, int]  # Total dispatched per size
    total_quantity: int

class BulkDispatch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dispatch_number: str  # Auto-generated dispatch number
    dispatch_date: datetime
    customer_name: str
    bora_number: str
    items: List[BulkDispatchItem]
    total_items: int
    grand_total_quantity: int
    notes: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BulkDispatchCreate(BaseModel):
    dispatch_date: datetime
    customer_name: str
    bora_number: str
    items: List[Dict]  # [{stock_id, master_packs, loose_pcs}]
    notes: Optional[str] = None
    remarks: Optional[str] = None


# Helper function to calculate master packs
def calculate_master_packs(size_distribution: Dict[str, int], master_pack_ratio: Dict[str, int]):
    """
    Calculate complete master packs and loose pieces
    Example: size_distribution = {"S": 10, "M": 19, "L": 15, "XL": 8}
             master_pack_ratio = {"S": 2, "M": 2, "L": 2, "XL": 2}
    Result: 4 complete packs (using 8S, 8M, 8L, 8XL), 20 loose pieces (2S, 11M, 7L, 0XL)
    """
    if not master_pack_ratio or not size_distribution:
        return 0, sum(size_distribution.values()), size_distribution.copy()
    
    # Calculate how many complete packs we can make
    complete_packs = float('inf')
    for size, ratio_qty in master_pack_ratio.items():
        if ratio_qty > 0:
            available_qty = size_distribution.get(size, 0)
            possible_packs = available_qty // ratio_qty
            complete_packs = min(complete_packs, possible_packs)
    
    # If no valid packs, return all as loose
    if complete_packs == float('inf') or complete_packs == 0:
        return 0, sum(size_distribution.values()), size_distribution.copy()
    
    # Calculate loose pieces
    loose_pieces_distribution = {}
    total_loose = 0
    for size, qty in size_distribution.items():
        used_in_packs = complete_packs * master_pack_ratio.get(size, 0)
        loose = qty - used_in_packs
        loose_pieces_distribution[size] = loose
        total_loose += loose
    
    return int(complete_packs), total_loose, loose_pieces_distribution

# Helper function to generate DC number
def generate_dc_number():
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"DC-{timestamp}"

# Helper function to generate fabric lot number
async def generate_fabric_lot_number():
    count = await db.fabric_lots.count_documents({})
    return f"lot {str(count + 1).zfill(3)}"

# Helper function to generate cutting lot number
async def generate_cutting_lot_number():
    count = await db.cutting_orders.count_documents({})
    return f"cut {str(count + 1).zfill(3)}"


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    """Register a new user (admin only for first user, then requires admin)"""
    # Check if any users exist
    user_count = await db.users.count_documents({})
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # First user is automatically admin
    role = "admin" if user_count == 0 else user_data.role
    
    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=role
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return {
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": role
        }
    }

@api_router.post("/auth/login")
async def login_user(credentials: UserLogin):
    """Login and get JWT token"""
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Update last login
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    token = create_token(user['id'], user['username'], user['role'])
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "role": user['role']
        }
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current logged in user info"""
    return {
        "id": current_user['id'],
        "username": current_user['username'],
        "full_name": current_user['full_name'],
        "role": current_user['role']
    }

@api_router.get("/auth/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users

@api_router.put("/auth/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Enable/disable a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get('is_active', True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    
    return {"message": f"User {'enabled' if new_status else 'disabled'} successfully"}

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: dict, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    new_role = role_data.get('role')
    if new_role not in ['admin', 'user']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'user'")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing the main admin's role
    if user.get('username') == 'admin':
        raise HTTPException(status_code=400, detail="Cannot change the main admin's role")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    
    return {"message": f"User role updated to '{new_role}' successfully"}


# ==================== FABRIC LOT ROUTES ====================

@api_router.post("/fabric-lots", response_model=FabricLot)
async def create_fabric_lot(lot: FabricLotCreate):
    lot_dict = lot.model_dump()
    
    # Auto-generate lot number if not provided
    if not lot_dict.get('lot_number'):
        lot_dict['lot_number'] = await generate_fabric_lot_number()
    
    # Generate roll numbers
    lot_number = lot_dict['lot_number']
    color = lot_dict['color'].replace(' ', '')  # Remove spaces from color name
    number_of_rolls = lot_dict.get('number_of_rolls', 1)
    
    roll_numbers = []
    for i in range(1, number_of_rolls + 1):
        roll_number = f"{lot_number}{color}{i}"
        roll_numbers.append(roll_number)
    
    lot_dict['roll_numbers'] = roll_numbers
    
    # Initialize quantity to 0 - will be calculated from roll weights
    lot_dict['quantity'] = 0
    lot_dict['remaining_quantity'] = 0
    lot_dict['total_amount'] = 0  # Will be updated when roll weights are added
    lot_dict['remaining_rib_quantity'] = lot_dict['rib_quantity']
    
    lot_obj = FabricLot(**lot_dict)
    
    doc = lot_obj.model_dump()
    doc['entry_date'] = doc['entry_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.fabric_lots.insert_one(doc)
    return lot_obj

@api_router.get("/fabric-lots", response_model=List[FabricLot])
async def get_fabric_lots():
    lots = await db.fabric_lots.find({}, {"_id": 0}).to_list(1000)
    
    for lot in lots:
        if isinstance(lot['entry_date'], str):
            lot['entry_date'] = datetime.fromisoformat(lot['entry_date'])
        if isinstance(lot['created_at'], str):
            lot['created_at'] = datetime.fromisoformat(lot['created_at'])
    
    return lots

@api_router.get("/fabric-lots/{lot_id}", response_model=FabricLot)
async def get_fabric_lot(lot_id: str):
    lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    if isinstance(lot['entry_date'], str):
        lot['entry_date'] = datetime.fromisoformat(lot['entry_date'])
    if isinstance(lot['created_at'], str):
        lot['created_at'] = datetime.fromisoformat(lot['created_at'])
    
    return lot

@api_router.post("/fabric-lots/{lot_id}/return", response_model=FabricReturn)
async def return_fabric_to_supplier(lot_id: str, fabric_return: FabricReturnCreate):
    """
    Partial return of fabric to supplier
    Allows returning specific rolls with reason and reduces inventory
    """
    fabric_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not fabric_lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    # Validate returned rolls exist
    lot_rolls = fabric_lot.get('roll_numbers', [])
    for roll in fabric_return.returned_rolls:
        if roll not in lot_rolls:
            raise HTTPException(
                status_code=400,
                detail=f"Roll {roll} not found in fabric lot {fabric_lot.get('lot_number', 'N/A')}"
            )
    
    # Validate quantity
    if fabric_return.quantity_returned > fabric_lot.get('remaining_quantity', 0):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot return {fabric_return.quantity_returned}kg. Only {fabric_lot.get('remaining_quantity', 0)}kg remaining in lot."
        )
    
    # Create return record
    return_dict = fabric_return.model_dump()
    return_dict['id'] = str(uuid.uuid4())
    return_dict['fabric_lot_id'] = lot_id
    return_dict['lot_number'] = fabric_lot.get('lot_number', 'N/A')
    return_dict['return_date'] = datetime.now(timezone.utc)
    
    return_obj = FabricReturn(**return_dict)
    
    # Save return record
    doc = return_obj.model_dump()
    doc['return_date'] = doc['return_date'].isoformat()
    await db.fabric_returns.insert_one(doc)
    
    # Update fabric lot - reduce quantity
    new_remaining_qty = fabric_lot.get('remaining_quantity', 0) - fabric_return.quantity_returned
    new_total_qty = fabric_lot.get('quantity', 0) - fabric_return.quantity_returned
    
    # Remove returned rolls from roll_numbers
    updated_roll_numbers = [roll for roll in lot_rolls if roll not in fabric_return.returned_rolls]
    
    # Update roll weights if they exist
    updated_roll_weights = []
    if fabric_lot.get('roll_weights'):
        for i, roll in enumerate(lot_rolls):
            if roll not in fabric_return.returned_rolls:
                updated_roll_weights.append(fabric_lot['roll_weights'][i])
    
    await db.fabric_lots.update_one(
        {"id": lot_id},
        {"$set": {
            "quantity": round(new_total_qty, 2),
            "remaining_quantity": round(new_remaining_qty, 2),
            "roll_numbers": updated_roll_numbers,
            "roll_weights": updated_roll_weights,
            "number_of_rolls": len(updated_roll_numbers)
        }}
    )
    
    return return_obj

@api_router.delete("/fabric-lots/{lot_id}")
async def delete_fabric_lot(lot_id: str):
    """
    Full return/Delete a fabric lot (for wrong fabric received or mistakes)
    """
    # Check if fabric has been used in any cutting orders
    fabric_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not fabric_lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    # Check if fabric has been used
    cutting_orders = await db.cutting_orders.find(
        {"fabric_lot_id": lot_id},
        {"_id": 0}
    ).to_list(10)
    
    if cutting_orders:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot return fabric lot {fabric_lot.get('lot_number', 'N/A')}. It has been used in {len(cutting_orders)} cutting order(s). Please delete those orders first."
        )
    
    result = await db.fabric_lots.delete_one({"id": lot_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    return {
        "message": f"Fabric lot {fabric_lot.get('lot_number', 'N/A')} returned successfully",
        "lot_number": fabric_lot.get('lot_number', 'N/A'),
        "quantity_returned": fabric_lot.get('quantity', 0)
    }


class FabricLotUpdate(BaseModel):
    fabric_type: Optional[str] = None
    supplier_name: Optional[str] = None
    color: Optional[str] = None
    rate_per_kg: Optional[float] = None
    remaining_quantity: Optional[float] = None
    remaining_rib_quantity: Optional[float] = None

@api_router.put("/fabric-lots/{lot_id}")
async def update_fabric_lot(lot_id: str, update_data: FabricLotUpdate, current_user: dict = Depends(get_current_user)):
    """Update fabric lot details (Admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    fabric_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not fabric_lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    # Build update dict with only provided fields
    update_dict = {}
    if update_data.fabric_type is not None:
        update_dict['fabric_type'] = update_data.fabric_type
    if update_data.supplier_name is not None:
        update_dict['supplier_name'] = update_data.supplier_name
    if update_data.color is not None:
        update_dict['color'] = update_data.color
    if update_data.rate_per_kg is not None:
        update_dict['rate_per_kg'] = update_data.rate_per_kg
        # Recalculate total amount
        update_dict['total_amount'] = round(update_data.rate_per_kg * fabric_lot.get('quantity', 0), 2)
    if update_data.remaining_quantity is not None:
        update_dict['remaining_quantity'] = update_data.remaining_quantity
    if update_data.remaining_rib_quantity is not None:
        update_dict['remaining_rib_quantity'] = update_data.remaining_rib_quantity
    
    if update_dict:
        update_dict['updated_by'] = current_user['username']
        await db.fabric_lots.update_one({"id": lot_id}, {"$set": update_dict})
    
    updated_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    return updated_lot


class RollWeightsUpdate(BaseModel):
    scale_readings: List[float]  # Cumulative scale readings after each roll
    restart_points: Optional[List[int]] = []  # Indices where scale was restarted (new roll placed fresh)

@api_router.put("/fabric-lots/{lot_id}/roll-weights")
async def update_roll_weights(lot_id: str, weights_update: RollWeightsUpdate):
    """
    Update roll weights using cumulative scale readings with restart support.
    
    Example without restart:
    - Roll 1 on scale: 22 kg → scale_readings[0] = 22, roll_weight[0] = 22
    - Roll 2 added: 45 kg → scale_readings[1] = 45, roll_weight[1] = 23 (45-22)
    - Roll 3 added: 70 kg → scale_readings[2] = 70, roll_weight[2] = 25 (70-45)
    
    Example with restart at roll 3 (scale capacity reached):
    - Roll 1 on scale: 22 kg → roll_weight[0] = 22
    - Roll 2 added: 45 kg → roll_weight[1] = 23 (45-22)
    - Scale restarted, Roll 3 fresh: 25 kg → roll_weight[2] = 25 (fresh reading)
    - restart_points = [2] (index of roll 3)
    """
    fabric_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not fabric_lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    scale_readings = weights_update.scale_readings
    restart_points = weights_update.restart_points or []
    number_of_rolls = fabric_lot.get('number_of_rolls', len(fabric_lot.get('roll_numbers', [])))
    
    # Validate number of readings matches number of rolls
    if len(scale_readings) != number_of_rolls:
        raise HTTPException(
            status_code=400,
            detail=f"Number of scale readings ({len(scale_readings)}) must match number of rolls ({number_of_rolls})"
        )
    
    # Validate readings are in ascending order within each segment (between restarts)
    for i in range(1, len(scale_readings)):
        if i in restart_points:
            # New segment starts here, skip validation
            continue
        
        if scale_readings[i] <= scale_readings[i-1]:
            raise HTTPException(
                status_code=400,
                detail=f"Scale readings must be ascending within a segment. Reading {i+1} ({scale_readings[i]}) is not greater than reading {i} ({scale_readings[i-1]}). Did you forget to mark a restart point?"
            )
    
    # Calculate individual roll weights from cumulative readings with restart support
    roll_weights = []
    for i, reading in enumerate(scale_readings):
        if i == 0 or i in restart_points:
            # First roll or restart point: weight is just the reading
            roll_weight = reading
        else:
            # Subsequent rolls: current reading - previous reading
            roll_weight = reading - scale_readings[i-1]
        roll_weights.append(round(roll_weight, 2))
    
    # Calculate total from individual weights
    total_calculated = sum(roll_weights)
    
    # Calculate total amount based on rate_per_kg
    rate_per_kg = fabric_lot.get('rate_per_kg', 0)
    total_amount = round(total_calculated * rate_per_kg, 2)
    
    # Update fabric lot
    await db.fabric_lots.update_one(
        {"id": lot_id},
        {"$set": {
            "scale_readings": scale_readings,
            "roll_weights": roll_weights,
            "quantity": round(total_calculated, 2),
            "remaining_quantity": round(total_calculated, 2),
            "total_amount": total_amount
        }}
    )
    
    updated_lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    
    return {
        "message": "Roll weights updated successfully",
        "lot_number": updated_lot.get('lot_number'),
        "scale_readings": scale_readings,
        "roll_weights": roll_weights,
        "total_weight": round(total_calculated, 2),
        "roll_details": [
            {
                "roll_number": updated_lot['roll_numbers'][i],
                "weight": roll_weights[i],
                "scale_reading": scale_readings[i]
            }
            for i in range(len(roll_weights))
        ]
    }


# Cutting Order Routes
@api_router.post("/cutting-orders", response_model=CuttingOrder)
async def create_cutting_order(order: CuttingOrderCreate):
    order_dict = order.model_dump()
    
    # Auto-generate cutting lot number if not provided
    if not order_dict.get('cutting_lot_number'):
        order_dict['cutting_lot_number'] = await generate_cutting_lot_number()
    
    # Calculate fabric and rib used
    fabric_used = order_dict.get('fabric_taken', 0) - order_dict.get('fabric_returned', 0)
    rib_used = order_dict.get('rib_taken', 0) - order_dict.get('rib_returned', 0)
    
    order_dict['fabric_used'] = round(fabric_used, 2)
    order_dict['rib_used'] = round(rib_used, 2)
    
    # Calculate total quantity from size distribution
    total_quantity = sum(order_dict['size_distribution'].values())
    order_dict['total_quantity'] = total_quantity
    
    # Calculate total cutting amount
    total_cutting_amount = total_quantity * order_dict['cutting_rate_per_pcs']
    order_dict['total_cutting_amount'] = round(total_cutting_amount, 2)
    
    # Initialize payment fields
    order_dict['amount_paid'] = 0.0
    order_dict['balance'] = total_cutting_amount
    order_dict['payment_status'] = "Unpaid"
    
    # Check if this is an old cutting lot (no fabric entry)
    if order_dict.get('is_old_lot') or not order_dict.get('fabric_lot_id'):
        # For old lots, set fabric cost to 0 and skip fabric validation
        order_dict['total_fabric_cost'] = 0.0
        order_dict['lot_number'] = order_dict.get('lot_number') or 'N/A'
        order_dict['fabric_lot_id'] = None
        
    else:
        # Get fabric lot to calculate cost and validate availability
        fabric_lot = await db.fabric_lots.find_one({"id": order_dict['fabric_lot_id']}, {"_id": 0})
        if not fabric_lot:
            raise HTTPException(status_code=404, detail="Fabric lot not found")
        
        # Validate fabric taken doesn't exceed available quantity
        if order_dict['fabric_taken'] > fabric_lot.get('remaining_quantity', 0):
            raise HTTPException(
                status_code=400, 
                detail=f"Fabric taken ({order_dict['fabric_taken']} kg) exceeds available fabric ({fabric_lot.get('remaining_quantity', 0)} kg) in lot {fabric_lot.get('lot_number')}"
            )
        
        # Validate rib taken doesn't exceed available rib quantity
        if order_dict['rib_taken'] > fabric_lot.get('remaining_rib_quantity', 0):
            raise HTTPException(
                status_code=400, 
                detail=f"Rib taken ({order_dict['rib_taken']} kg) exceeds available rib ({fabric_lot.get('remaining_rib_quantity', 0)} kg) in lot {fabric_lot.get('lot_number')}"
            )
        
        # Calculate total fabric cost
        total_fabric_cost = fabric_used * fabric_lot['rate_per_kg']
        order_dict['total_fabric_cost'] = round(total_fabric_cost, 2)
        
        # Auto-populate color from fabric lot if not provided
        if not order_dict.get('color'):
            order_dict['color'] = fabric_lot.get('color', '')
        
        # Update fabric lot remaining quantities
        new_remaining_qty = fabric_lot['remaining_quantity'] - fabric_used
        new_remaining_rib_qty = fabric_lot['remaining_rib_quantity'] - rib_used
        
        await db.fabric_lots.update_one(
            {"id": order_dict['fabric_lot_id']},
            {"$set": {
                "remaining_quantity": round(new_remaining_qty, 2),
                "remaining_rib_quantity": round(new_remaining_rib_qty, 2)
            }}
        )
    
    order_obj = CuttingOrder(**order_dict)
    
    doc = order_obj.model_dump()
    doc['cutting_date'] = doc['cutting_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.cutting_orders.insert_one(doc)
    
    return order_obj

@api_router.get("/cutting-orders", response_model=List[CuttingOrder])
async def get_cutting_orders(exclude_ironing: bool = False):
    """
    Get cutting orders with optional filtering
    exclude_ironing: If True, excludes orders that have been sent to ironing
    """
    query = {}
    if exclude_ironing:
        query["sent_to_ironing"] = {"$ne": True}
    
    orders = await db.cutting_orders.find(query, {"_id": 0}).to_list(1000)
    
    for order in orders:
        if isinstance(order['cutting_date'], str):
            order['cutting_date'] = datetime.fromisoformat(order['cutting_date'])
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.get("/cutting-orders/{order_id}", response_model=CuttingOrder)
async def get_cutting_order(order_id: str):
    order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    if isinstance(order['cutting_date'], str):
        order['cutting_date'] = datetime.fromisoformat(order['cutting_date'])
    if isinstance(order['created_at'], str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order

@api_router.put("/cutting-orders/{order_id}", response_model=CuttingOrder)
async def update_cutting_order(order_id: str, order_update: CuttingOrderUpdate):
    # Get existing order
    existing_order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    update_data = {k: v for k, v in order_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # If fabric/rib quantities changed, recalculate
    if 'fabric_taken' in update_data or 'fabric_returned' in update_data:
        fabric_taken = update_data.get('fabric_taken', existing_order['fabric_taken'])
        fabric_returned = update_data.get('fabric_returned', existing_order['fabric_returned'])
        fabric_used = fabric_taken - fabric_returned
        update_data['fabric_used'] = round(fabric_used, 2)
        
        # Update fabric lot quantities
        old_fabric_used = existing_order['fabric_used']
        fabric_diff = fabric_used - old_fabric_used
        
        await db.fabric_lots.update_one(
            {"id": existing_order['fabric_lot_id']},
            {"$inc": {"remaining_quantity": -fabric_diff}}
        )
    
    if 'rib_taken' in update_data or 'rib_returned' in update_data:
        rib_taken = update_data.get('rib_taken', existing_order['rib_taken'])
        rib_returned = update_data.get('rib_returned', existing_order['rib_returned'])
        rib_used = rib_taken - rib_returned
        update_data['rib_used'] = round(rib_used, 2)
        
        # Update rib lot quantities
        old_rib_used = existing_order['rib_used']
        rib_diff = rib_used - old_rib_used
        
        await db.fabric_lots.update_one(
            {"id": existing_order['fabric_lot_id']},
            {"$inc": {"remaining_rib_quantity": -rib_diff}}
        )
    
    # Recalculate totals if size distribution or rate changed
    if 'size_distribution' in update_data:
        total_quantity = sum(update_data['size_distribution'].values())
        update_data['total_quantity'] = total_quantity
        
        cutting_rate = update_data.get('cutting_rate_per_pcs', existing_order.get('cutting_rate_per_pcs', 0))
        update_data['total_cutting_amount'] = round(total_quantity * cutting_rate, 2)
        
        fabric_lot = await db.fabric_lots.find_one({"id": existing_order['fabric_lot_id']}, {"_id": 0})
        fabric_used = update_data.get('fabric_used', existing_order['fabric_used'])
        update_data['total_fabric_cost'] = round(fabric_used * fabric_lot['rate_per_kg'], 2)
    
    if 'cutting_rate_per_pcs' in update_data:
        total_quantity = update_data.get('total_quantity', existing_order['total_quantity'])
        update_data['total_cutting_amount'] = round(total_quantity * update_data['cutting_rate_per_pcs'], 2)
    
    # Serialize datetime if present
    if 'cutting_date' in update_data and update_data['cutting_date']:
        update_data['cutting_date'] = update_data['cutting_date'].isoformat()
    
    result = await db.cutting_orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    return await get_cutting_order(order_id)

@api_router.delete("/cutting-orders/{order_id}")
async def delete_cutting_order(order_id: str):
    order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    # Restore fabric lot quantities
    await db.fabric_lots.update_one(
        {"id": order['fabric_lot_id']},
        {"$inc": {
            "remaining_quantity": order['fabric_used'],
            "remaining_rib_quantity": order['rib_used']
        }}
    )
    
    result = await db.cutting_orders.delete_one({"id": order_id})
    return {"message": "Cutting order deleted successfully"}


# ==================== LOT QR CODE ROUTES ====================

@api_router.get("/cutting-orders/{order_id}/qrcode")
async def get_cutting_lot_qrcode(order_id: str):
    """Generate QR code for cutting lot"""
    order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    lot_number = order.get('cutting_lot_number') or order.get('lot_number', '')
    
    # QR data contains essential info for scanning
    qr_data = json.dumps({
        "type": "lot",
        "id": order_id,
        "lot": lot_number,
        "category": order.get('category'),
        "style": order.get('style_type'),
        "color": order.get('color', ''),
        "total": order.get('total_quantity', 0)
    })
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return Response(content=buffer.getvalue(), media_type="image/png")


@api_router.get("/lot/by-number/{lot_number}")
async def get_lot_by_number(lot_number: str):
    """Get cutting lot by lot number (for QR scan lookup)"""
    order = await db.cutting_orders.find_one({
        "$or": [
            {"cutting_lot_number": lot_number},
            {"lot_number": lot_number}
        ]
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Get current status
    lot_num = order.get('cutting_lot_number') or order.get('lot_number', '')
    
    # Check outsourcing status
    outsourcing = await db.outsourcing_orders.find_one(
        {"cutting_lot_number": lot_num}, {"_id": 0}
    )
    
    # Check ironing status
    ironing = await db.ironing_orders.find_one(
        {"cutting_lot_number": lot_num}, {"_id": 0}
    )
    
    # Check stock status
    stock = await db.stock.find_one({
        "lot_number": lot_num,
        "is_active": True
    }, {"_id": 0})
    
    # Determine current stage
    if stock:
        stage = "stock"
    elif ironing:
        if ironing.get('status') == 'Received':
            stage = "ironing-received"
        else:
            stage = "ironing"
    elif outsourcing:
        if outsourcing.get('status') == 'Received':
            stage = "received"
        else:
            stage = "outsourcing"
    else:
        stage = "cutting"
    
    return {
        "order": order,
        "stage": stage,
        "outsourcing": outsourcing,
        "ironing": ironing,
        "stock": stock
    }


@api_router.post("/scan/send-outsourcing")
async def scan_send_outsourcing(
    lot_number: str,
    unit_name: str,
    operation_type: str,
    rate_per_pcs: float = 0,
    expected_return_date: str = None
):
    """Quick send to outsourcing by scanning lot QR"""
    # Find cutting order
    order = await db.cutting_orders.find_one({
        "$or": [
            {"cutting_lot_number": lot_number},
            {"lot_number": lot_number}
        ]
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    lot_num = order.get('cutting_lot_number') or order.get('lot_number', '')
    
    # Check if already sent
    existing = await db.outsourcing_orders.find_one({"cutting_lot_number": lot_num})
    if existing:
        raise HTTPException(status_code=400, detail="Lot already sent to outsourcing")
    
    # Generate DC number
    count = await db.outsourcing_orders.count_documents({})
    dc_number = f"DC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Parse expected return date
    exp_date = None
    if expected_return_date:
        exp_date = datetime.fromisoformat(expected_return_date)
    else:
        exp_date = datetime.now(timezone.utc) + timedelta(days=7)
    
    outsourcing_dict = {
        "id": str(uuid.uuid4()),
        "dc_number": dc_number,
        "cutting_lot_number": lot_num,
        "unit_name": unit_name,
        "operation_type": operation_type,
        "size_distribution": order.get('bundle_distribution', {}),
        "total_quantity": sum(order.get('bundle_distribution', {}).values()),
        "rate_per_pcs": rate_per_pcs,
        "total_amount": sum(order.get('bundle_distribution', {}).values()) * rate_per_pcs,
        "amount_paid": 0,
        "status": "Sent",
        "sent_date": datetime.now(timezone.utc).isoformat(),
        "expected_return_date": exp_date.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.outsourcing_orders.insert_one(outsourcing_dict)
    
    return {"message": "Sent to outsourcing successfully", "dc_number": dc_number}


@api_router.post("/scan/receive-outsourcing")
async def scan_receive_outsourcing(data: dict):
    """Quick receive from outsourcing by scanning lot QR"""
    lot_number = data.get('lot_number')
    received_distribution = data.get('received_distribution', {})
    mistake_distribution = data.get('mistake_distribution', {})
    
    # Find outsourcing order
    order = await db.outsourcing_orders.find_one({
        "cutting_lot_number": lot_number,
        "status": {"$ne": "Received"}
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="No pending outsourcing order found for this lot")
    
    # Calculate shortage
    shortage_distribution = {}
    for size, sent_qty in order['size_distribution'].items():
        received_qty = received_distribution.get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    total_received = sum(received_distribution.values())
    total_shortage = sum(shortage_distribution.values())
    total_mistakes = sum((mistake_distribution or {}).values())
    
    # Calculate debit
    rate = order.get('rate_per_pcs', 0)
    shortage_debit = round(total_shortage * rate, 2)
    mistake_debit = round(total_mistakes * rate, 2)
    
    # Create receipt
    receipt_dict = {
        "id": str(uuid.uuid4()),
        "outsourcing_order_id": order['id'],
        "dc_number": order['dc_number'],
        "unit_name": order['unit_name'],
        "receipt_date": datetime.now(timezone.utc).isoformat(),
        "received_distribution": received_distribution,
        "mistake_distribution": mistake_distribution or {},
        "shortage_distribution": shortage_distribution,
        "total_sent": order['total_quantity'],
        "total_received": total_received,
        "total_shortage": total_shortage,
        "total_mistakes": total_mistakes,
        "rate_per_pcs": rate,
        "shortage_debit_amount": shortage_debit,
        "mistake_debit_amount": mistake_debit,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.outsourcing_receipts.insert_one(receipt_dict)
    
    # Update order status
    new_status = 'Received' if total_shortage == 0 else 'Partial'
    await db.outsourcing_orders.update_one(
        {"id": order['id']},
        {"$set": {"status": new_status}}
    )
    
    return {"message": "Receipt recorded successfully", "received": total_received, "shortage": total_shortage}


@api_router.post("/scan/create-ironing")
async def scan_create_ironing(
    lot_number: str,
    unit_name: str,
    master_pack_ratio: Dict[str, int],
    rate_per_pcs: float = 0
):
    """Quick create ironing order by scanning lot QR"""
    # Find cutting order
    order = await db.cutting_orders.find_one({
        "$or": [
            {"cutting_lot_number": lot_number},
            {"lot_number": lot_number}
        ]
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    lot_num = order.get('cutting_lot_number') or order.get('lot_number', '')
    
    # Check if already exists
    existing = await db.ironing_orders.find_one({"cutting_lot_number": lot_num})
    if existing:
        raise HTTPException(status_code=400, detail="Ironing order already exists for this lot")
    
    # Get size distribution from outsourcing receipt or cutting
    outsourcing_receipt = await db.outsourcing_receipts.find_one({
        "dc_number": {"$regex": lot_num, "$options": "i"}
    }, {"_id": 0})
    
    if outsourcing_receipt:
        size_dist = outsourcing_receipt.get('received_distribution', {})
    else:
        size_dist = order.get('bundle_distribution', {})
    
    total_qty = sum(size_dist.values())
    
    # Generate DC number
    dc_number = f"IR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    ironing_dict = {
        "id": str(uuid.uuid4()),
        "dc_number": dc_number,
        "cutting_lot_number": lot_num,
        "unit_name": unit_name,
        "size_distribution": size_dist,
        "total_quantity": total_qty,
        "master_pack_ratio": master_pack_ratio,
        "rate_per_pcs": rate_per_pcs,
        "total_amount": total_qty * rate_per_pcs,
        "amount_paid": 0,
        "status": "Sent",
        "sent_date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ironing_orders.insert_one(ironing_dict)
    
    return {"message": "Ironing order created successfully", "dc_number": dc_number}


@api_router.post("/scan/receive-ironing")
async def scan_receive_ironing(
    lot_number: str,
    received_distribution: Dict[str, int],
    mistake_distribution: Dict[str, int] = None
):
    """Quick receive from ironing by scanning lot QR - AUTO-CREATES STOCK ENTRY"""
    # Find ironing order
    ironing_order = await db.ironing_orders.find_one({
        "cutting_lot_number": lot_number,
        "status": {"$ne": "Received"}
    }, {"_id": 0})
    
    if not ironing_order:
        raise HTTPException(status_code=404, detail="No pending ironing order found for this lot")
    
    # Calculate shortage
    shortage_distribution = {}
    for size, sent_qty in ironing_order['size_distribution'].items():
        received_qty = received_distribution.get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    total_received = sum(received_distribution.values())
    total_shortage = sum(shortage_distribution.values())
    total_mistakes = sum((mistake_distribution or {}).values())
    
    # Calculate debit
    rate = ironing_order.get('rate_per_pcs', 0)
    shortage_debit = round(total_shortage * rate, 2)
    mistake_debit = round(total_mistakes * rate, 2)
    
    # Calculate master packs
    master_pack_ratio = ironing_order.get('master_pack_ratio', {})
    if master_pack_ratio:
        complete_packs, loose_pieces, loose_dist = calculate_master_packs(received_distribution, master_pack_ratio)
    else:
        complete_packs = 0
        loose_pieces = total_received
        loose_dist = received_distribution.copy()
    
    # Create receipt
    receipt_id = str(uuid.uuid4())
    receipt_dict = {
        "id": receipt_id,
        "ironing_order_id": ironing_order['id'],
        "dc_number": ironing_order['dc_number'],
        "unit_name": ironing_order['unit_name'],
        "receipt_date": datetime.now(timezone.utc).isoformat(),
        "received_distribution": received_distribution,
        "mistake_distribution": mistake_distribution or {},
        "shortage_distribution": shortage_distribution,
        "sent_distribution": ironing_order['size_distribution'],
        "total_sent": ironing_order['total_quantity'],
        "total_received": total_received,
        "total_shortage": total_shortage,
        "total_mistakes": total_mistakes,
        "rate_per_pcs": rate,
        "shortage_debit_amount": shortage_debit,
        "mistake_debit_amount": mistake_debit,
        "master_pack_ratio": master_pack_ratio,
        "complete_packs": complete_packs,
        "loose_pieces": loose_pieces,
        "loose_pieces_distribution": loose_dist,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ironing_receipts.insert_one(receipt_dict)
    
    # Update ironing order status
    await db.ironing_orders.update_one(
        {"id": ironing_order['id']},
        {"$set": {"status": "Received"}}
    )
    
    # AUTO-CREATE STOCK ENTRY
    cutting_order = await db.cutting_orders.find_one({
        "$or": [
            {"cutting_lot_number": lot_number},
            {"lot_number": lot_number}
        ]
    }, {"_id": 0})
    
    stock_count = await db.stock.count_documents({})
    stock_code = f"STK-{str(stock_count + 1).zfill(4)}"
    
    # Use custom stock_lot_name and stock_color from ironing order if provided
    stock_lot_name = ironing_order.get('stock_lot_name', '') or lot_number
    stock_color = ironing_order.get('stock_color', '') or ironing_order.get('color', '') or (cutting_order.get('color', '') if cutting_order else '')
    
    stock_entry = {
        "id": str(uuid.uuid4()),
        "stock_code": stock_code,
        "lot_number": stock_lot_name,  # Use custom lot name if provided
        "source": "ironing",
        "source_ironing_receipt_id": receipt_id,
        "category": ironing_order.get('category', '') or (cutting_order.get('category', 'Mens') if cutting_order else 'Mens'),
        "style_type": ironing_order.get('style_type', '') or (cutting_order.get('style_type', '') if cutting_order else ''),
        "color": stock_color,  # Use custom color if provided
        "size_distribution": received_distribution,
        "total_quantity": total_received,
        "available_quantity": total_received,
        "master_pack_ratio": master_pack_ratio,
        "complete_packs": complete_packs,
        "loose_pieces": loose_pieces,
        "notes": f"Auto-created from ironing - DC: {ironing_order['dc_number']}",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock.insert_one(stock_entry)
    
    return {
        "message": "Ironing receipt recorded & Stock created!",
        "received": total_received,
        "shortage": total_shortage,
        "stock_code": stock_code,
        "complete_packs": complete_packs,
        "loose_pieces": loose_pieces
    }


# ==================== OUTSOURCING UNIT ROUTES ====================

@api_router.get("/outsourcing-units", response_model=List[OutsourcingUnit])
async def get_outsourcing_units():
    """Get all nominated outsourcing units"""
    units = await db.outsourcing_units.find({}, {"_id": 0}).to_list(100)
    return units

@api_router.get("/outsourcing-units/by-operation/{operation}")
async def get_units_by_operation(operation: str):
    """Get units that handle a specific operation"""
    units = await db.outsourcing_units.find(
        {"operations": operation, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    return units

@api_router.post("/outsourcing-units", response_model=OutsourcingUnit)
async def create_outsourcing_unit(unit: OutsourcingUnitCreate):
    """Create a new nominated outsourcing unit"""
    # Check if unit name already exists
    existing = await db.outsourcing_units.find_one({"unit_name": unit.unit_name})
    if existing:
        raise HTTPException(status_code=400, detail="Unit with this name already exists")
    
    unit_obj = OutsourcingUnit(**unit.model_dump())
    doc = unit_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.outsourcing_units.insert_one(doc)
    return unit_obj

@api_router.put("/outsourcing-units/{unit_id}")
async def update_outsourcing_unit(unit_id: str, unit: OutsourcingUnitCreate):
    """Update an outsourcing unit"""
    existing = await db.outsourcing_units.find_one({"id": unit_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    await db.outsourcing_units.update_one(
        {"id": unit_id},
        {"$set": unit.model_dump()}
    )
    return {"message": "Unit updated successfully"}

@api_router.delete("/outsourcing-units/{unit_id}")
async def delete_outsourcing_unit(unit_id: str):
    """Delete an outsourcing unit"""
    result = await db.outsourcing_units.delete_one({"id": unit_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"message": "Unit deleted successfully"}

@api_router.put("/outsourcing-units/{unit_id}/toggle-status")
async def toggle_unit_status(unit_id: str):
    """Toggle active/inactive status of a unit"""
    unit = await db.outsourcing_units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    new_status = not unit.get('is_active', True)
    await db.outsourcing_units.update_one(
        {"id": unit_id},
        {"$set": {"is_active": new_status}}
    )
    return {"message": f"Unit {'activated' if new_status else 'deactivated'} successfully"}


# Outsourcing Order Routes
@api_router.post("/outsourcing-orders", response_model=OutsourcingOrder)
async def create_outsourcing_order(order: OutsourcingOrderCreate):
    """Create a new outsourcing order with multiple cutting lots"""
    order_dict = order.model_dump()
    
    cutting_order_ids = order_dict['cutting_order_ids']
    operation_type = order_dict['operation_type']
    
    if not cutting_order_ids:
        raise HTTPException(status_code=400, detail="At least one cutting lot must be selected")
    
    # Fetch all cutting orders
    cutting_orders = await db.cutting_orders.find(
        {"id": {"$in": cutting_order_ids}},
        {"_id": 0}
    ).to_list(100)
    
    if not cutting_orders:
        raise HTTPException(status_code=404, detail="No valid cutting orders found")
    
    # Check for duplicate operations and collect data
    cutting_lot_numbers = []
    lot_numbers = set()
    colors = set()
    categories = set()
    style_types = set()
    combined_size_distribution = {}
    lot_details = []  # Store individual lot details
    
    for cutting_order in cutting_orders:
        # Check if this operation has already been done on this cutting lot
        completed_operations = cutting_order.get('completed_operations', [])
        
        if operation_type in completed_operations:
            existing_order = await db.outsourcing_orders.find_one(
                {"cutting_order_id": cutting_order['id'], "operation_type": operation_type},
                {"_id": 0}
            )
            error_msg = f"Lot {cutting_order.get('cutting_lot_number', 'N/A')} has already been sent for '{operation_type}'."
            if existing_order:
                error_msg += f" Previously sent to: {existing_order.get('unit_name', 'Unknown Unit')}"
            raise HTTPException(status_code=400, detail=error_msg)
        
        cutting_lot_numbers.append(cutting_order.get('cutting_lot_number', ''))
        lot_numbers.add(cutting_order.get('lot_number', ''))
        colors.add(cutting_order.get('color', ''))
        categories.add(cutting_order.get('category', ''))
        style_types.add(cutting_order.get('style_type', ''))
        
        # Store individual lot details
        lot_size_dist = cutting_order.get('size_distribution', {})
        lot_details.append({
            "cutting_order_id": cutting_order['id'],
            "cutting_lot_number": cutting_order.get('cutting_lot_number', ''),
            "lot_number": cutting_order.get('lot_number', ''),
            "category": cutting_order.get('category', ''),
            "style_type": cutting_order.get('style_type', ''),
            "color": cutting_order.get('color', ''),
            "size_distribution": lot_size_dist,
            "quantity": sum(lot_size_dist.values())
        })
        
        # Combine size distributions
        for size, qty in lot_size_dist.items():
            combined_size_distribution[size] = combined_size_distribution.get(size, 0) + qty
    
    # Generate DC number
    order_dict['dc_number'] = generate_dc_number()
    order_dict['lot_details'] = lot_details
    
    # Store both single (for backward compatibility) and multiple IDs
    order_dict['cutting_order_id'] = cutting_order_ids[0]
    order_dict['cutting_order_ids'] = cutting_order_ids
    order_dict['cutting_lot_number'] = ', '.join(cutting_lot_numbers)
    order_dict['cutting_lot_numbers'] = cutting_lot_numbers
    order_dict['lot_number'] = ', '.join(lot_numbers)
    order_dict['color'] = ', '.join(filter(None, colors))
    order_dict['category'] = ', '.join(categories)
    order_dict['style_type'] = ', '.join(style_types)
    order_dict['size_distribution'] = combined_size_distribution
    
    # Calculate total quantity
    total_quantity = sum(combined_size_distribution.values())
    order_dict['total_quantity'] = total_quantity
    
    # Calculate total amount
    total_amount = total_quantity * order_dict['rate_per_pcs']
    order_dict['total_amount'] = round(total_amount, 2)
    
    # Initialize payment fields
    order_dict['amount_paid'] = 0.0
    order_dict['balance'] = total_amount
    order_dict['payment_status'] = "Unpaid"
    
    order_dict['status'] = 'Sent'
    order_dict['whatsapp_sent'] = False
    
    order_obj = OutsourcingOrder(**order_dict)
    
    doc = order_obj.model_dump()
    doc['dc_date'] = doc['dc_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.outsourcing_orders.insert_one(doc)
    
    # Mark this operation as completed on ALL selected cutting orders
    for cutting_order_id in cutting_order_ids:
        await db.cutting_orders.update_one(
            {"id": cutting_order_id},
            {"$addToSet": {"completed_operations": operation_type}}
        )
    
    return order_obj

@api_router.get("/outsourcing-orders", response_model=List[OutsourcingOrder])
async def get_outsourcing_orders():
    orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    
    for order in orders:
        if isinstance(order['dc_date'], str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.get("/outsourcing-orders/{order_id}", response_model=OutsourcingOrder)
async def get_outsourcing_order(order_id: str):
    order = await db.outsourcing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    if isinstance(order['dc_date'], str):
        order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    if isinstance(order['created_at'], str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order

@api_router.get("/outsourcing-orders/overdue/reminders")
async def get_overdue_outsourcing_orders():
    """
    Get outsourcing orders that have been sent but not received for more than 7 days
    """
    # Calculate cutoff date (7 days ago)
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
    
    # Find orders with status 'Sent' and dc_date older than 7 days
    orders = await db.outsourcing_orders.find(
        {"status": "Sent"},
        {"_id": 0}
    ).to_list(1000)
    
    overdue_orders = []
    
    for order in orders:
        # Parse dc_date
        dc_date = order.get('dc_date')
        if isinstance(dc_date, str):
            dc_date = datetime.fromisoformat(dc_date)
        
        # Check if overdue (more than 7 days)
        if dc_date and dc_date < cutoff_date:
            days_pending = (datetime.now(timezone.utc) - dc_date).days
            
            overdue_orders.append({
                "id": order['id'],
                "dc_number": order['dc_number'],
                "cutting_lot_number": order.get('cutting_lot_number', 'N/A'),
                "operation_type": order['operation_type'],
                "unit_name": order['unit_name'],
                "dc_date": dc_date.isoformat(),
                "days_pending": days_pending,
                "total_quantity": order.get('total_quantity', 0),
                "category": order.get('category', ''),
                "style_type": order.get('style_type', '')
            })
    
    # Sort by days_pending (most overdue first)
    overdue_orders.sort(key=lambda x: x['days_pending'], reverse=True)
    
    return {
        "count": len(overdue_orders),
        "overdue_orders": overdue_orders
    }

@api_router.put("/outsourcing-orders/{order_id}", response_model=OutsourcingOrder)
async def update_outsourcing_order(order_id: str, order_update: OutsourcingOrderUpdate):
    # Get existing order
    existing_order = await db.outsourcing_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    update_data = {k: v for k, v in order_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Recalculate totals if size distribution or rate changed
    if 'size_distribution' in update_data:
        total_quantity = sum(update_data['size_distribution'].values())
        update_data['total_quantity'] = total_quantity
        
        rate = update_data.get('rate_per_pcs', existing_order.get('rate_per_pcs', 0))
        total_amount = total_quantity * rate
        update_data['total_amount'] = round(total_amount, 2)
        
        # Update balance if amount changed
        amount_paid = existing_order.get('amount_paid', 0)
        update_data['balance'] = round(total_amount - amount_paid, 2)
    
    if 'rate_per_pcs' in update_data and 'size_distribution' not in update_data:
        total_quantity = update_data.get('total_quantity', existing_order.get('total_quantity', 0))
        total_amount = total_quantity * update_data['rate_per_pcs']
        update_data['total_amount'] = round(total_amount, 2)
        
        # Update balance
        amount_paid = existing_order.get('amount_paid', 0)
        update_data['balance'] = round(total_amount - amount_paid, 2)
    
    # Serialize datetime if present
    if 'dc_date' in update_data and update_data['dc_date']:
        update_data['dc_date'] = update_data['dc_date'].isoformat()
    
    result = await db.outsourcing_orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    return await get_outsourcing_order(order_id)

@api_router.delete("/outsourcing-orders/{order_id}")
async def delete_outsourcing_order(order_id: str):
    result = await db.outsourcing_orders.delete_one({"id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    return {"message": "Outsourcing order deleted successfully"}


# Outsourcing Receipt Routes
@api_router.post("/outsourcing-receipts", response_model=OutsourcingReceipt)
async def create_outsourcing_receipt(receipt: OutsourcingReceiptCreate):
    receipt_dict = receipt.model_dump()
    
    # Get the outsourcing order
    outsourcing_order = await db.outsourcing_orders.find_one({"id": receipt_dict['outsourcing_order_id']}, {"_id": 0})
    if not outsourcing_order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    # Convert datetime fields if they're strings
    if isinstance(outsourcing_order['dc_date'], str):
        outsourcing_order['dc_date'] = datetime.fromisoformat(outsourcing_order['dc_date'])
    
    receipt_dict['dc_number'] = outsourcing_order['dc_number']
    receipt_dict['unit_name'] = outsourcing_order['unit_name']
    receipt_dict['operation_type'] = outsourcing_order['operation_type']
    receipt_dict['sent_distribution'] = outsourcing_order['size_distribution']
    receipt_dict['rate_per_pcs'] = outsourcing_order['rate_per_pcs']
    
    # Calculate shortage
    shortage_distribution = {}
    for size, sent_qty in outsourcing_order['size_distribution'].items():
        received_qty = receipt_dict['received_distribution'].get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    receipt_dict['shortage_distribution'] = shortage_distribution
    
    # Handle mistakes (if provided)
    mistake_distribution = receipt_dict.get('mistake_distribution', {})
    total_mistakes = sum(mistake_distribution.values()) if mistake_distribution else 0
    receipt_dict['mistake_distribution'] = mistake_distribution
    receipt_dict['total_mistakes'] = total_mistakes
    
    # Calculate totals
    total_sent = sum(outsourcing_order['size_distribution'].values())
    total_received = sum(receipt_dict['received_distribution'].values())
    total_shortage = sum(shortage_distribution.values())
    
    receipt_dict['total_sent'] = total_sent
    receipt_dict['total_received'] = total_received
    receipt_dict['total_shortage'] = total_shortage
    
    # Calculate shortage debit amount
    shortage_debit_amount = total_shortage * receipt_dict['rate_per_pcs']
    receipt_dict['shortage_debit_amount'] = round(shortage_debit_amount, 2)
    
    # Calculate mistake debit amount
    mistake_debit_amount = total_mistakes * receipt_dict['rate_per_pcs']
    receipt_dict['mistake_debit_amount'] = round(mistake_debit_amount, 2)
    
    receipt_obj = OutsourcingReceipt(**receipt_dict)
    
    doc = receipt_obj.model_dump()
    doc['receipt_date'] = doc['receipt_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.outsourcing_receipts.insert_one(doc)
    
    # Update outsourcing order status
    new_status = 'Received' if total_shortage == 0 else 'Partial'
    await db.outsourcing_orders.update_one(
        {"id": receipt_dict['outsourcing_order_id']},
        {"$set": {"status": new_status}}
    )
    
    return receipt_obj

@api_router.get("/outsourcing-receipts", response_model=List[OutsourcingReceipt])
async def get_outsourcing_receipts():
    receipts = await db.outsourcing_receipts.find({}, {"_id": 0}).to_list(1000)
    
    for receipt in receipts:
        if isinstance(receipt['receipt_date'], str):
            receipt['receipt_date'] = datetime.fromisoformat(receipt['receipt_date'])
        if isinstance(receipt['created_at'], str):
            receipt['created_at'] = datetime.fromisoformat(receipt['created_at'])
    
    return receipts


@api_router.put("/outsourcing-receipts/{receipt_id}")
async def update_outsourcing_receipt(receipt_id: str, receipt_update: OutsourcingReceiptCreate):
    """Edit an outsourcing receipt - allows correcting wrong entries"""
    # Get existing receipt
    existing_receipt = await db.outsourcing_receipts.find_one({"id": receipt_id}, {"_id": 0})
    if not existing_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    # Get the outsourcing order for calculations
    outsourcing_order = await db.outsourcing_orders.find_one(
        {"id": existing_receipt['outsourcing_order_id']}, {"_id": 0}
    )
    if not outsourcing_order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    # Calculate new shortage
    shortage_distribution = {}
    for size, sent_qty in outsourcing_order['size_distribution'].items():
        received_qty = receipt_update.received_distribution.get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    # Handle mistakes
    mistake_distribution = receipt_update.mistake_distribution or {}
    total_mistakes = sum(mistake_distribution.values()) if mistake_distribution else 0
    
    # Calculate totals
    total_sent = sum(outsourcing_order['size_distribution'].values())
    total_received = sum(receipt_update.received_distribution.values())
    total_shortage = sum(shortage_distribution.values())
    
    # Calculate debit amounts
    rate_per_pcs = existing_receipt.get('rate_per_pcs', 0)
    shortage_debit_amount = round(total_shortage * rate_per_pcs, 2)
    mistake_debit_amount = round(total_mistakes * rate_per_pcs, 2)
    
    # Update the receipt
    update_data = {
        "receipt_date": receipt_update.receipt_date.isoformat(),
        "received_distribution": receipt_update.received_distribution,
        "mistake_distribution": mistake_distribution,
        "shortage_distribution": shortage_distribution,
        "total_received": total_received,
        "total_shortage": total_shortage,
        "total_mistakes": total_mistakes,
        "shortage_debit_amount": shortage_debit_amount,
        "mistake_debit_amount": mistake_debit_amount
    }
    
    await db.outsourcing_receipts.update_one(
        {"id": receipt_id},
        {"$set": update_data}
    )
    
    # Update outsourcing order status
    new_status = 'Received' if total_shortage == 0 else 'Partial'
    await db.outsourcing_orders.update_one(
        {"id": existing_receipt['outsourcing_order_id']},
        {"$set": {"status": new_status}}
    )
    
    return {"message": "Receipt updated successfully", "total_received": total_received, "total_shortage": total_shortage}


# Delivery Challan Print
@api_router.get("/outsourcing-orders/{order_id}/dc", response_class=HTMLResponse)
async def get_delivery_challan(order_id: str):
    order = await db.outsourcing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    if isinstance(order['dc_date'], str):
        order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Generate HTML for DC
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Delivery Challan - {order['dc_number']}</title>
        <style>
            @media print {{
                @page {{ margin: 1cm; }}
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
            body {{
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
            }}
            .header {{
                text-align: center;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .info-section {{
                margin: 20px 0;
            }}
            .info-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #ddd;
            }}
            .info-label {{
                font-weight: bold;
                width: 40%;
            }}
            .info-value {{
                width: 60%;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            th, td {{
                border: 1px solid #000;
                padding: 10px;
                text-align: left;
            }}
            th {{
                background-color: #f0f0f0;
                font-weight: bold;
            }}
            .total-row {{
                font-weight: bold;
                background-color: #f9f9f9;
            }}
            .footer {{
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #000;
            }}
            .signature-section {{
                display: flex;
                justify-content: space-between;
                margin-top: 60px;
            }}
            .signature-box {{
                text-align: center;
                width: 45%;
            }}
            .signature-line {{
                border-top: 1px solid #000;
                margin-top: 50px;
                padding-top: 5px;
            }}
            .print-button {{
                background-color: #4F46E5;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px 0;
            }}
            .print-button:hover {{
                background-color: #4338CA;
            }}
        </style>
    </head>
    <body>
        <button class="print-button no-print" onclick="window.print()">Print Delivery Challan</button>
        
        <div class="header">
            <h1>DELIVERY CHALLAN</h1>
            <p>Garment Manufacturing Pro</p>
        </div>
        
        <div class="info-section">
            <div class="info-row">
                <div class="info-label">DC Number:</div>
                <div class="info-value">{order['dc_number']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">DC Date:</div>
                <div class="info-value">{order['dc_date'].strftime('%d-%m-%Y')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Unit Name:</div>
                <div class="info-value" style="font-weight: bold;">{order['unit_name']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Operation Type:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order['operation_type']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Total Lots:</div>
                <div class="info-value">{len(order.get('lot_details', [])) or 1} Lot(s)</div>
            </div>
        </div>
    """
    
    # Check if lot_details exists for multi-lot orders
    lot_details = order.get('lot_details', [])
    
    if lot_details and len(lot_details) > 0:
        # Multi-lot DC - show lot-wise details
        html_content += """
        <h3 style="background-color: #EEF2FF; padding: 10px; border-radius: 5px; margin-top: 20px;">📦 Lot-wise Details</h3>
        """
        
        for idx, lot in enumerate(lot_details, 1):
            lot_sizes = lot.get('size_distribution', {})
            lot_qty = lot.get('quantity', sum(lot_sizes.values()))
            
            html_content += f"""
        <div style="border: 1px solid #ddd; border-radius: 5px; margin: 10px 0; overflow: hidden;">
            <div style="background-color: #f8f9fa; padding: 10px; border-bottom: 1px solid #ddd;">
                <strong style="font-size: 16px;">{lot.get('cutting_lot_number', 'N/A')}</strong>
                <span style="margin-left: 10px; color: #666;">
                    {lot.get('category', '')} | {lot.get('style_type', '')}
                    {f" | 🎨 {lot.get('color')}" if lot.get('color') else ''}
                </span>
                <span style="float: right; font-weight: bold; color: #4F46E5;">{lot_qty} pcs</span>
            </div>
            <table style="margin: 0; border: none;">
                <thead>
                    <tr>
                        <th style="border: none; border-bottom: 1px solid #ddd;">Size</th>
                        <th style="border: none; border-bottom: 1px solid #ddd;">Qty</th>
                    </tr>
                </thead>
                <tbody>
            """
            
            for size, qty in lot_sizes.items():
                if qty > 0:
                    html_content += f"""
                    <tr>
                        <td style="border: none; border-bottom: 1px solid #eee;">{size}</td>
                        <td style="border: none; border-bottom: 1px solid #eee;">{qty}</td>
                    </tr>
                    """
            
            html_content += f"""
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td style="border: none;">Subtotal</td>
                        <td style="border: none;">{lot_qty}</td>
                    </tr>
                </tbody>
            </table>
        </div>
            """
        
        # Grand total section
        html_content += f"""
        <div style="background-color: #4F46E5; color: white; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 18px; font-weight: bold;">GRAND TOTAL ({len(lot_details)} Lots)</span>
                <span style="font-size: 24px; font-weight: bold;">{order['total_quantity']} pcs</span>
            </div>
        </div>
        """
    else:
        # Single lot DC - original format
        html_content += f"""
        <div class="info-section">
            <div class="info-row">
                <div class="info-label">Cutting Lot Number:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order.get('cutting_lot_number', 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Fabric Lot Number:</div>
                <div class="info-value">{order['lot_number']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Category:</div>
                <div class="info-value">{order['category']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Style Type:</div>
                <div class="info-value">{order['style_type']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Color:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order.get('color', 'N/A')}</div>
            </div>
        </div>
        
        <h3>Size-wise Quantity Details</h3>
        <table>
            <thead>
                <tr>
                    <th>Size</th>
                    <th>Quantity (Pieces)</th>
                </tr>
            </thead>
            <tbody>
        """
        
        for size, qty in order['size_distribution'].items():
            if qty > 0:
                html_content += f"""
                <tr>
                    <td>{size}</td>
                    <td>{qty}</td>
                </tr>
                """
        
        html_content += f"""
                <tr class="total-row">
                    <td>TOTAL</td>
                    <td>{order['total_quantity']}</td>
                </tr>
            </tbody>
        </table>
        """
    
    html_content += f"""
        
        <div class="info-section">
            <div class="info-row">
                <div class="info-label">Rate per Piece:</div>
                <div class="info-value">₹ {order['rate_per_pcs']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Total Amount:</div>
                <div class="info-value">₹ {order['total_amount']}</div>
            </div>
        </div>
        
        {f'''
        <div class="info-section" style="margin-top: 30px;">
            <h3>Comments/Notes:</h3>
            <div style="border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; border-radius: 5px; min-height: 60px;">
                {order.get('notes', '')}
            </div>
        </div>
        ''' if order.get('notes') else ''}
        
        <div class="footer">
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line">Sender's Signature</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line">Receiver's Signature</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


# WhatsApp Message Simulation
@api_router.post("/outsourcing-orders/{order_id}/send-whatsapp")
async def send_whatsapp_message(order_id: str):
    order = await db.outsourcing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    # In production, integrate with WhatsApp Business API
    # For now, just mark as sent
    message = f"""
    📦 *Delivery Challan*
    
    DC No: {order['dc_number']}
    Lot: {order['lot_number']}
    Operation: {order['operation_type']}
    Total Qty: {order['total_quantity']} pcs
    Amount: ₹{order['total_amount']}
    
    Please acknowledge receipt.
    """
    
    await db.outsourcing_orders.update_one(
        {"id": order_id},
        {"$set": {"whatsapp_sent": True}}
    )
    
    return {
        "message": "WhatsApp message sent successfully",
        "preview": message
    }


# Barcode Generation
@api_router.get("/fabric-lots/{lot_id}/barcode")
async def get_lot_barcode(lot_id: str):
    lot = await db.fabric_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    # Generate barcode using Code128
    code128 = barcode.get_barcode_class('code128')
    barcode_instance = code128(lot['lot_number'], writer=ImageWriter())
    
    # Generate barcode image in memory
    buffer = io.BytesIO()
    barcode_instance.write(buffer, options={
        'module_width': 0.3,
        'module_height': 10,
        'font_size': 10,
        'text_distance': 5,
        'quiet_zone': 3
    })
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="image/png")


# Payment Routes for Cutting Orders
@api_router.post("/cutting-orders/{order_id}/payment")
async def add_cutting_payment(order_id: str, payment: PaymentRecord):
    order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    # Update payment details
    new_amount_paid = order.get('amount_paid', 0) + payment.amount
    total_amount = order.get('total_cutting_amount', 0)
    new_balance = total_amount - new_amount_paid
    
    # Determine payment status
    if new_balance <= 0:
        payment_status = "Paid"
        new_balance = 0
    elif new_amount_paid > 0:
        payment_status = "Partial"
    else:
        payment_status = "Unpaid"
    
    await db.cutting_orders.update_one(
        {"id": order_id},
        {"$set": {
            "amount_paid": round(new_amount_paid, 2),
            "balance": round(new_balance, 2),
            "payment_status": payment_status
        }}
    )
    
    return {"message": "Payment recorded successfully", "balance": round(new_balance, 2)}


# Ironing Order Routes
@api_router.post("/ironing-orders", response_model=IroningOrder)
async def create_ironing_order(order: IroningOrderCreate):
    order_dict = order.model_dump()
    
    # Get outsourcing receipt
    receipt = await db.outsourcing_receipts.find_one({"id": order_dict['receipt_id']}, {"_id": 0})
    if not receipt:
        raise HTTPException(status_code=404, detail="Outsourcing receipt not found")
    
    # Convert datetime if needed
    if isinstance(receipt.get('receipt_date'), str):
        receipt['receipt_date'] = datetime.fromisoformat(receipt['receipt_date'])
    
    # Get the original outsourcing order to get cutting_lot_number and color
    outsourcing_order = await db.outsourcing_orders.find_one({"id": receipt['outsourcing_order_id']}, {"_id": 0})
    
    order_dict['cutting_lot_number'] = outsourcing_order.get('cutting_lot_number', '')
    order_dict['color'] = outsourcing_order.get('color', '')
    order_dict['category'] = outsourcing_order.get('category', '')
    order_dict['style_type'] = outsourcing_order.get('style_type', '')
    order_dict['size_distribution'] = receipt['received_distribution']
    
    # Generate DC number
    order_dict['dc_number'] = generate_dc_number()
    
    # Calculate total quantity
    total_quantity = sum(receipt['received_distribution'].values())
    order_dict['total_quantity'] = total_quantity
    
    # Calculate total amount
    total_amount = total_quantity * order_dict['rate_per_pcs']
    order_dict['total_amount'] = round(total_amount, 2)
    
    # Calculate master packs if ratio is provided
    if order_dict.get('master_pack_ratio'):
        complete_packs, loose_pieces, _ = calculate_master_packs(
            receipt['received_distribution'], 
            order_dict['master_pack_ratio']
        )
        order_dict['complete_packs'] = complete_packs
        order_dict['loose_pieces'] = loose_pieces
    else:
        order_dict['complete_packs'] = 0
        order_dict['loose_pieces'] = total_quantity
    
    # Initialize payment fields
    order_dict['amount_paid'] = 0.0
    order_dict['balance'] = total_amount
    order_dict['payment_status'] = "Unpaid"
    
    order_dict['status'] = 'Sent'
    order_dict['whatsapp_sent'] = False
    
    order_obj = IroningOrder(**order_dict)
    
    doc = order_obj.model_dump()
    doc['dc_date'] = doc['dc_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.ironing_orders.insert_one(doc)
    
    # Mark receipt as sent to ironing
    await db.outsourcing_receipts.update_one(
        {"id": order_dict['receipt_id']},
        {"$set": {"sent_to_ironing": True}}
    )
    
    # Mark the cutting order as sent to ironing
    await db.cutting_orders.update_one(
        {"cutting_lot_number": order_dict['cutting_lot_number']},
        {"$set": {"sent_to_ironing": True}}
    )
    
    return order_obj

@api_router.get("/ironing-orders", response_model=List[IroningOrder])
async def get_ironing_orders():
    orders = await db.ironing_orders.find({}, {"_id": 0}).to_list(1000)
    
    for order in orders:
        if isinstance(order['dc_date'], str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.get("/ironing-orders/{order_id}", response_model=IroningOrder)
async def get_ironing_order(order_id: str):
    order = await db.ironing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    if isinstance(order['dc_date'], str):
        order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    if isinstance(order['created_at'], str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order

@api_router.delete("/ironing-orders/{order_id}")
async def delete_ironing_order(order_id: str):
    order = await db.ironing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    # Unmark receipt
    await db.outsourcing_receipts.update_one(
        {"id": order['receipt_id']},
        {"$set": {"sent_to_ironing": False}}
    )
    
    result = await db.ironing_orders.delete_one({"id": order_id})
    return {"message": "Ironing order deleted successfully"}

# Ironing Receipt Routes
@api_router.post("/ironing-receipts", response_model=IroningReceipt)
async def create_ironing_receipt(receipt: IroningReceiptCreate):
    receipt_dict = receipt.model_dump()
    
    # Get the ironing order
    ironing_order = await db.ironing_orders.find_one({"id": receipt_dict['ironing_order_id']}, {"_id": 0})
    if not ironing_order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    if isinstance(ironing_order['dc_date'], str):
        ironing_order['dc_date'] = datetime.fromisoformat(ironing_order['dc_date'])
    
    receipt_dict['dc_number'] = ironing_order['dc_number']
    receipt_dict['unit_name'] = ironing_order['unit_name']
    receipt_dict['sent_distribution'] = ironing_order['size_distribution']
    receipt_dict['rate_per_pcs'] = ironing_order['rate_per_pcs']
    
    # Calculate shortage
    shortage_distribution = {}
    for size, sent_qty in ironing_order['size_distribution'].items():
        received_qty = receipt_dict['received_distribution'].get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    receipt_dict['shortage_distribution'] = shortage_distribution
    
    # Handle mistakes (if provided)
    mistake_distribution = receipt_dict.get('mistake_distribution', {})
    total_mistakes = sum(mistake_distribution.values()) if mistake_distribution else 0
    receipt_dict['mistake_distribution'] = mistake_distribution
    receipt_dict['total_mistakes'] = total_mistakes
    
    # Calculate totals
    total_sent = sum(ironing_order['size_distribution'].values())
    total_received = sum(receipt_dict['received_distribution'].values())
    total_shortage = sum(shortage_distribution.values())
    
    receipt_dict['total_sent'] = total_sent
    receipt_dict['total_received'] = total_received
    receipt_dict['total_shortage'] = total_shortage
    
    # Calculate shortage debit amount
    shortage_debit_amount = total_shortage * receipt_dict['rate_per_pcs']
    receipt_dict['shortage_debit_amount'] = round(shortage_debit_amount, 2)
    
    # Calculate mistake debit amount
    mistake_debit_amount = total_mistakes * receipt_dict['rate_per_pcs']
    receipt_dict['mistake_debit_amount'] = round(mistake_debit_amount, 2)
    
    # Calculate master packs from ironing order's ratio
    master_pack_ratio = ironing_order.get('master_pack_ratio', {})
    if master_pack_ratio:
        complete_packs, loose_pieces, loose_pieces_dist = calculate_master_packs(
            receipt_dict['received_distribution'], 
            master_pack_ratio
        )
        receipt_dict['master_pack_ratio'] = master_pack_ratio
        receipt_dict['complete_packs'] = complete_packs
        receipt_dict['loose_pieces'] = loose_pieces
        receipt_dict['loose_pieces_distribution'] = loose_pieces_dist
    else:
        receipt_dict['master_pack_ratio'] = {}
        receipt_dict['complete_packs'] = 0
        receipt_dict['loose_pieces'] = total_received
        receipt_dict['loose_pieces_distribution'] = receipt_dict['received_distribution'].copy()
    
    receipt_obj = IroningReceipt(**receipt_dict)
    
    doc = receipt_obj.model_dump()
    doc['receipt_date'] = doc['receipt_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.ironing_receipts.insert_one(doc)
    
    # Update ironing order status
    new_status = 'Received'
    await db.ironing_orders.update_one(
        {"id": receipt_dict['ironing_order_id']},
        {"$set": {"status": new_status}}
    )
    
    # AUTO-CREATE STOCK ENTRY after ironing receipt
    # Get cutting order details for stock entry
    cutting_lot_number = ironing_order.get('cutting_lot_number', '')
    cutting_order = await db.cutting_orders.find_one({
        "$or": [
            {"cutting_lot_number": cutting_lot_number},
            {"lot_number": cutting_lot_number}
        ]
    }, {"_id": 0})
    
    # Generate stock code
    stock_count = await db.stock.count_documents({})
    stock_code = f"STK-{str(stock_count + 1).zfill(4)}"
    
    # Use custom stock_lot_name and stock_color from ironing order if provided, else fallback to cutting order values
    stock_lot_name = ironing_order.get('stock_lot_name', '') or cutting_lot_number
    stock_color = ironing_order.get('stock_color', '') or ironing_order.get('color', '') or (cutting_order.get('color', '') if cutting_order else '')
    
    # Create stock entry from ironing receipt
    stock_entry = {
        "id": str(uuid.uuid4()),
        "stock_code": stock_code,
        "lot_number": stock_lot_name,  # Use custom lot name if provided
        "source": "ironing",
        "source_ironing_receipt_id": receipt_obj.id,  # Use receipt_obj.id instead of receipt_dict['id']
        "category": ironing_order.get('category', '') or (cutting_order.get('category', 'Mens') if cutting_order else 'Mens'),
        "style_type": ironing_order.get('style_type', '') or (cutting_order.get('style_type', '') if cutting_order else ''),
        "color": stock_color,  # Use custom color if provided
        "size_distribution": receipt_dict['received_distribution'],
        "total_quantity": total_received,
        "available_quantity": total_received,
        "master_pack_ratio": master_pack_ratio,
        "complete_packs": receipt_dict.get('complete_packs', 0),
        "loose_pieces": receipt_dict.get('loose_pieces', 0),
        "notes": f"Auto-created from ironing receipt - DC: {ironing_order['dc_number']}",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock.insert_one(stock_entry)
    
    # Add stock_id to the receipt response
    receipt_obj_dict = receipt_obj.model_dump()
    receipt_obj_dict['stock_id'] = stock_entry['id']
    receipt_obj_dict['stock_code'] = stock_code
    
    return receipt_obj

@api_router.get("/ironing-receipts", response_model=List[IroningReceipt])
async def get_ironing_receipts():
    receipts = await db.ironing_receipts.find({}, {"_id": 0}).to_list(1000)
    
    for receipt in receipts:
        if isinstance(receipt['receipt_date'], str):
            receipt['receipt_date'] = datetime.fromisoformat(receipt['receipt_date'])
        if isinstance(receipt['created_at'], str):
            receipt['created_at'] = datetime.fromisoformat(receipt['created_at'])
    
    return receipts


@api_router.put("/ironing-receipts/{receipt_id}")
async def update_ironing_receipt(receipt_id: str, receipt_update: IroningReceiptCreate):
    """Edit an ironing receipt - allows correcting wrong entries"""
    # Get existing receipt
    existing_receipt = await db.ironing_receipts.find_one({"id": receipt_id}, {"_id": 0})
    if not existing_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    # Get the ironing order for calculations
    ironing_order = await db.ironing_orders.find_one(
        {"id": existing_receipt['ironing_order_id']}, {"_id": 0}
    )
    if not ironing_order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    # Calculate new shortage
    shortage_distribution = {}
    for size, sent_qty in ironing_order['size_distribution'].items():
        received_qty = receipt_update.received_distribution.get(size, 0)
        shortage = sent_qty - received_qty
        if shortage > 0:
            shortage_distribution[size] = shortage
    
    # Handle mistakes
    mistake_distribution = receipt_update.mistake_distribution or {}
    total_mistakes = sum(mistake_distribution.values()) if mistake_distribution else 0
    
    # Calculate totals
    total_sent = sum(ironing_order['size_distribution'].values())
    total_received = sum(receipt_update.received_distribution.values())
    total_shortage = sum(shortage_distribution.values())
    
    # Calculate debit amounts
    rate_per_pcs = existing_receipt.get('rate_per_pcs', 0)
    shortage_debit_amount = round(total_shortage * rate_per_pcs, 2)
    mistake_debit_amount = round(total_mistakes * rate_per_pcs, 2)
    
    # Calculate master packs if ratio exists
    master_pack_ratio = ironing_order.get('master_pack_ratio', {})
    if master_pack_ratio:
        complete_packs, loose_pieces, loose_pieces_dist = calculate_master_packs(
            receipt_update.received_distribution, 
            master_pack_ratio
        )
    else:
        complete_packs = 0
        loose_pieces = total_received
        loose_pieces_dist = receipt_update.received_distribution.copy()
    
    # Update the receipt
    update_data = {
        "receipt_date": receipt_update.receipt_date.isoformat(),
        "received_distribution": receipt_update.received_distribution,
        "mistake_distribution": mistake_distribution,
        "shortage_distribution": shortage_distribution,
        "total_received": total_received,
        "total_shortage": total_shortage,
        "total_mistakes": total_mistakes,
        "shortage_debit_amount": shortage_debit_amount,
        "mistake_debit_amount": mistake_debit_amount,
        "complete_packs": complete_packs,
        "loose_pieces": loose_pieces,
        "loose_pieces_distribution": loose_pieces_dist
    }
    
    await db.ironing_receipts.update_one(
        {"id": receipt_id},
        {"$set": update_data}
    )
    
    return {"message": "Receipt updated successfully", "total_received": total_received, "total_shortage": total_shortage}


# Payment Routes for Ironing Orders
@api_router.post("/ironing-orders/{order_id}/payment")
async def add_ironing_payment(order_id: str, payment: PaymentRecord):
    order = await db.ironing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    # Update payment details
    new_amount_paid = order.get('amount_paid', 0) + payment.amount
    total_amount = order.get('total_amount', 0)
    new_balance = total_amount - new_amount_paid
    
    # Determine payment status
    if new_balance <= 0:
        payment_status = "Paid"
        new_balance = 0
    elif new_amount_paid > 0:
        payment_status = "Partial"
    else:
        payment_status = "Unpaid"
    
    await db.ironing_orders.update_one(
        {"id": order_id},
        {"$set": {
            "amount_paid": round(new_amount_paid, 2),
            "balance": round(new_balance, 2),
            "payment_status": payment_status
        }}
    )
    
    return {"message": "Payment recorded successfully", "balance": round(new_balance, 2)}

# Ironing DC Generation
@api_router.get("/ironing-orders/{order_id}/dc", response_class=HTMLResponse)
async def get_ironing_dc(order_id: str):
    order = await db.ironing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ironing order not found")
    
    if isinstance(order['dc_date'], str):
        order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Generate HTML for DC (similar to outsourcing DC)
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ironing DC - {order['dc_number']}</title>
        <style>
            /* Same styles as outsourcing DC */
            @media print {{
                @page {{ margin: 1cm; }}
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
            body {{
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
            }}
            .header {{
                text-align: center;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .info-section {{
                margin: 20px 0;
            }}
            .info-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #ddd;
            }}
            .info-label {{
                font-weight: bold;
                width: 40%;
            }}
            .info-value {{
                width: 60%;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            th, td {{
                border: 1px solid #000;
                padding: 10px;
                text-align: left;
            }}
            th {{
                background-color: #f0f0f0;
                font-weight: bold;
            }}
            .total-row {{
                font-weight: bold;
                background-color: #f9f9f9;
            }}
            .print-button {{
                background-color: #4F46E5;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px 0;
            }}
            .print-button:hover {{
                background-color: #4338CA;
            }}
        </style>
    </head>
    <body>
        <button class="print-button no-print" onclick="window.print()">Print DC</button>
        
        <div class="header">
            <h1>IRONING DELIVERY CHALLAN</h1>
            <p>Garment Manufacturing Pro</p>
        </div>
        
        <div class="info-section">
            <div class="info-row">
                <div class="info-label">DC Number:</div>
                <div class="info-value">{order['dc_number']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">DC Date:</div>
                <div class="info-value">{order['dc_date'].strftime('%d-%m-%Y')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Cutting Lot Number:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order.get('cutting_lot_number', 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Unit Name:</div>
                <div class="info-value">{order['unit_name']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Category:</div>
                <div class="info-value">{order['category']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Style Type:</div>
                <div class="info-value">{order['style_type']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Color:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order.get('color', 'N/A')}</div>
            </div>
        </div>
        
        <h3>Size-wise Quantity Details</h3>
        <table>
            <thead>
                <tr>
                    <th>Size</th>
                    <th>Quantity (Pieces)</th>
                </tr>
            </thead>
            <tbody>
    """
    
    # Add size distribution rows
    for size, qty in order['size_distribution'].items():
        if qty > 0:
            html_content += f"""
                <tr>
                    <td>{size}</td>
                    <td>{qty}</td>
                </tr>
            """
    
    html_content += f"""
                <tr class="total-row">
                    <td>TOTAL</td>
                    <td>{order['total_quantity']}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="info-section">
            <div class="info-row">
                <div class="info-label">Rate per Piece:</div>
                <div class="info-value">₹ {order['rate_per_pcs']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Total Amount:</div>
                <div class="info-value">₹ {order['total_amount']}</div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

# Payment Routes for Outsourcing Orders
@api_router.post("/outsourcing-orders/{order_id}/payment")
async def add_outsourcing_payment(order_id: str, payment: PaymentRecord):
    order = await db.outsourcing_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Outsourcing order not found")
    
    # Update payment details
    new_amount_paid = order.get('amount_paid', 0) + payment.amount
    total_amount = order.get('total_amount', 0)
    new_balance = total_amount - new_amount_paid
    
    # Determine payment status
    if new_balance <= 0:
        payment_status = "Paid"
        new_balance = 0
    elif new_amount_paid > 0:
        payment_status = "Partial"
    else:
        payment_status = "Unpaid"
    
    await db.outsourcing_orders.update_one(
        {"id": order_id},
        {"$set": {
            "amount_paid": round(new_amount_paid, 2),
            "balance": round(new_balance, 2),
            "payment_status": payment_status
        }}
    )
    
    return {"message": "Payment recorded successfully", "balance": round(new_balance, 2)}


# Bill Report Generation
@api_router.get("/reports/bills/unit-wise", response_class=HTMLResponse)
async def generate_unit_wise_bill(unit_name: str):
    # Get outsourcing orders for this unit
    outsourcing_orders = await db.outsourcing_orders.find({"unit_name": unit_name}, {"_id": 0}).to_list(1000)
    
    # Convert dates
    for order in outsourcing_orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Get receipts and shortage for outsourcing
    outsourcing_receipts = []
    total_outsourcing_shortage = 0
    total_outsourcing_shortage_debit = 0
    for order in outsourcing_orders:
        receipts = await db.outsourcing_receipts.find({"outsourcing_order_id": order['id']}, {"_id": 0}).to_list(1000)
        for r in receipts:
            if isinstance(r.get('receipt_date'), str):
                r['receipt_date'] = datetime.fromisoformat(r['receipt_date'])
        outsourcing_receipts.extend(receipts)
        total_outsourcing_shortage += sum(r.get('total_shortage', 0) for r in receipts)
        total_outsourcing_shortage_debit += sum(r.get('shortage_debit_amount', 0) for r in receipts)
    
    # Get ironing orders for this unit
    ironing_orders = await db.ironing_orders.find({"unit_name": unit_name}, {"_id": 0}).to_list(1000)
    
    # Convert dates
    for order in ironing_orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Get receipts and shortage for ironing
    ironing_receipts = []
    total_ironing_shortage = 0
    total_ironing_shortage_debit = 0
    for order in ironing_orders:
        receipts = await db.ironing_receipts.find({"ironing_order_id": order['id']}, {"_id": 0}).to_list(1000)
        for r in receipts:
            if isinstance(r.get('receipt_date'), str):
                r['receipt_date'] = datetime.fromisoformat(r['receipt_date'])
        ironing_receipts.extend(receipts)
        total_ironing_shortage += sum(r.get('total_shortage', 0) for r in receipts)
        total_ironing_shortage_debit += sum(r.get('shortage_debit_amount', 0) for r in receipts)
    
    # Calculate totals
    total_outsourcing_amount = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    total_outsourcing_paid = sum(o.get('paid_amount', 0) for o in outsourcing_orders)
    total_outsourcing_balance = total_outsourcing_amount - total_outsourcing_paid
    
    total_ironing_amount = sum(o.get('total_amount', 0) for o in ironing_orders)
    total_ironing_paid = sum(o.get('amount_paid', 0) for o in ironing_orders)
    total_ironing_balance = sum(o.get('balance', 0) for o in ironing_orders)
    
    # Calculate net amount (after shortage debit)
    net_outsourcing_amount = total_outsourcing_amount - total_outsourcing_shortage_debit
    net_ironing_amount = total_ironing_amount - total_ironing_shortage_debit
    total_net_amount = net_outsourcing_amount + net_ironing_amount
    
    # Generate HTML report
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Unit Bill - {unit_name}</title>
        <style>
            @media print {{ @page {{ margin: 1cm; }} body {{ margin: 0; }} .no-print {{ display: none; }} }}
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }}
            .header h1 {{ margin: 0; color: #4F46E5; font-size: 28px; }}
            .header p {{ margin: 5px 0; color: #666; }}
            .unit-info {{ background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; }}
            .unit-info h3 {{ margin: 0 0 10px 0; color: #1e40af; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th {{ background: #4F46E5; color: white; padding: 12px; text-align: left; font-size: 13px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e0e0e0; font-size: 12px; }}
            tr:hover {{ background: #f5f5f5; }}
            .section-title {{ font-size: 20px; color: #4F46E5; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #4F46E5; }}
            .summary {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; margin-top: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }}
            .summary-item {{ background: rgba(255,255,255,0.15); padding: 15px; border-radius: 6px; text-align: center; }}
            .summary-label {{ font-size: 13px; opacity: 0.9; }}
            .summary-value {{ font-size: 22px; font-weight: bold; margin-top: 5px; }}
            .grand-total {{ text-align: center; padding-top: 20px; border-top: 2px solid rgba(255,255,255,0.3); }}
            .grand-total-label {{ font-size: 16px; opacity: 0.9; }}
            .grand-total-value {{ font-size: 36px; font-weight: bold; margin-top: 10px; }}
            .print-btn {{ background: #4F46E5; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }}
            .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }}
            .badge-green {{ background: #10b981; color: white; }}
            .badge-red {{ background: #ef4444; color: white; }}
        </style>
    </head>
    <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Bill</button>
        
        <div class="header">
            <h1>UNIT BILL REPORT</h1>
            <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">Unit: {unit_name}</p>
            <p>Report Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
        </div>
        
        <div class="unit-info">
            <h3>Summary</h3>
            <p><strong>Total Orders:</strong> {len(outsourcing_orders) + len(ironing_orders)} (Outsourcing: {len(outsourcing_orders)}, Ironing: {len(ironing_orders)})</p>
            <p><strong>Total Amount:</strong> ₹{total_outsourcing_amount + total_ironing_amount:.2f}</p>
            <p><strong>Total Shortage Debit:</strong> ₹{total_outsourcing_shortage_debit + total_ironing_shortage_debit:.2f} ({total_outsourcing_shortage + total_ironing_shortage} pcs)</p>
            <p><strong>Net Amount:</strong> ₹{total_net_amount:.2f}</p>
        </div>
        
        <!-- Outsourcing Orders -->
        {'<h2 class="section-title">📦 OUTSOURCING OPERATIONS</h2>' if outsourcing_orders else ''}
        {'''<table>
            <thead>
                <tr>
                    <th>DC Number</th>
                    <th>Date</th>
                    <th>Operation</th>
                    <th>Lot</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Shortage</th>
                    <th>Debit</th>
                    <th>Net Amount</th>
                </tr>
            </thead>
            <tbody>''' if outsourcing_orders else ''}
                {''.join([f'''
                <tr>
                    <td><strong>{o.get('dc_number', 'N/A')}</strong></td>
                    <td>{o.get('dc_date').strftime('%d %b %Y') if o.get('dc_date') else 'N/A'}</td>
                    <td>{o.get('operation_type', 'N/A')}</td>
                    <td>{o.get('cutting_lot_number', 'N/A')}</td>
                    <td>{o.get('total_quantity', 0)} pcs</td>
                    <td>₹{o.get('rate_per_pcs', 0):.2f}</td>
                    <td>₹{o.get('total_amount', 0):.2f}</td>
                    <td style="color: red;">{sum(r.get('total_shortage', 0) for r in outsourcing_receipts if r.get('outsourcing_order_id') == o.get('id'))} pcs</td>
                    <td style="color: red;">₹{sum(r.get('shortage_debit_amount', 0) for r in outsourcing_receipts if r.get('outsourcing_order_id') == o.get('id')):.2f}</td>
                    <td><strong>₹{o.get('total_amount', 0) - sum(r.get('shortage_debit_amount', 0) for r in outsourcing_receipts if r.get('outsourcing_order_id') == o.get('id')):.2f}</strong></td>
                </tr>
                ''' for o in outsourcing_orders])}
            {'</tbody></table>' if outsourcing_orders else '<p style="text-align: center; color: #666; padding: 20px;">No outsourcing operations for this unit</p>'}
        
        <!-- Ironing Orders -->
        {'<h2 class="section-title">🔥 IRONING OPERATIONS</h2>' if ironing_orders else ''}
        {'''<table>
            <thead>
                <tr>
                    <th>DC Number</th>
                    <th>Date</th>
                    <th>Lot</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Shortage</th>
                    <th>Debit</th>
                    <th>Net Amount</th>
                </tr>
            </thead>
            <tbody>''' if ironing_orders else ''}
                {''.join([f'''
                <tr>
                    <td><strong>{o.get('dc_number', 'N/A')}</strong></td>
                    <td>{o.get('dc_date').strftime('%d %b %Y') if o.get('dc_date') else 'N/A'}</td>
                    <td>{o.get('cutting_lot_number', 'N/A')}</td>
                    <td>{o.get('category', 'N/A')}</td>
                    <td>{o.get('total_quantity', 0)} pcs</td>
                    <td>₹{o.get('rate_per_pcs', 0):.2f}</td>
                    <td>₹{o.get('total_amount', 0):.2f}</td>
                    <td style="color: red;">{sum(r.get('total_shortage', 0) for r in ironing_receipts if r.get('ironing_order_id') == o.get('id'))} pcs</td>
                    <td style="color: red;">₹{sum(r.get('shortage_debit_amount', 0) for r in ironing_receipts if r.get('ironing_order_id') == o.get('id')):.2f}</td>
                    <td><strong>₹{o.get('total_amount', 0) - sum(r.get('shortage_debit_amount', 0) for r in ironing_receipts if r.get('ironing_order_id') == o.get('id')):.2f}</strong></td>
                </tr>
                ''' for o in ironing_orders])}
            {'</tbody></table>' if ironing_orders else '<p style="text-align: center; color: #666; padding: 20px;">No ironing operations for this unit</p>'}
        
        <!-- Summary -->
        <div class="summary">
            <h3 style="margin: 0 0 20px 0; text-align: center;">BILLING SUMMARY</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Outsourcing Amount</div>
                    <div class="summary-value">₹{total_outsourcing_amount:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Ironing Amount</div>
                    <div class="summary-value">₹{total_ironing_amount:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Amount</div>
                    <div class="summary-value">₹{total_outsourcing_amount + total_ironing_amount:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Outsourcing Shortage</div>
                    <div class="summary-value">(-) ₹{total_outsourcing_shortage_debit:.2f}</div>
                    <div class="summary-label" style="font-size: 11px; margin-top: 5px;">{total_outsourcing_shortage} pcs</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Ironing Shortage</div>
                    <div class="summary-value">(-) ₹{total_ironing_shortage_debit:.2f}</div>
                    <div class="summary-label" style="font-size: 11px; margin-top: 5px;">{total_ironing_shortage} pcs</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">₹{total_outsourcing_paid + total_ironing_paid:.2f}</div>
                </div>
            </div>
            <div class="grand-total">
                <div class="grand-total-label">NET PAYABLE AMOUNT</div>
                <div class="grand-total-value">₹{total_net_amount:.2f}</div>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 10px;">
                    Outstanding Balance: ₹{total_outsourcing_balance + total_ironing_balance:.2f}
                </div>
            </div>
        </div>
        
        <div style="margin-top: 50px; border-top: 2px solid #ddd; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between;">
                <div style="text-align: center; width: 45%;">
                    <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                        Prepared By
                    </div>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                        Authorized Signature
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@api_router.get("/reports/bills", response_class=HTMLResponse)
async def generate_bill_report():
    # Get all cutting orders
    cutting_orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Get all outsourcing orders
    outsourcing_orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate fabric costs
    total_fabric_cost = sum(o.get('total_fabric_cost', 0) for o in cutting_orders)
    
    # Calculate totals
    total_cutting_amount = sum(o.get('total_cutting_amount', 0) for o in cutting_orders)
    total_cutting_paid = sum(o.get('amount_paid', 0) for o in cutting_orders)
    total_cutting_balance = sum(o.get('balance', 0) for o in cutting_orders)
    
    total_outsourcing_amount = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    total_outsourcing_paid = sum(o.get('paid_amount', 0) for o in outsourcing_orders)
    total_outsourcing_balance = sum(o.get('balance', 0) for o in outsourcing_orders)
    
    # Calculate shortage debit
    receipts = await db.outsourcing_receipts.find({}, {"_id": 0, "shortage_debit_amount": 1}).to_list(1000)
    total_shortage_debit = sum(r.get('shortage_debit_amount', 0) for r in receipts)
    
    # Calculate comprehensive total
    comprehensive_total = (total_fabric_cost + total_cutting_amount + total_outsourcing_amount) - total_shortage_debit
    
    # Generate HTML report
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bill Report - All Operations</title>
        <style>
            @media print {{
                @page {{ margin: 1cm; }}
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
            body {{
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 1200px;
                margin: 0 auto;
            }}
            .header {{
                text-align: center;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .summary {{
                background: #f5f5f5;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
            }}
            .summary-grid {{
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
            }}
            .summary-item {{
                background: white;
                padding: 10px;
                border-radius: 5px;
                border-left: 4px solid #4F46E5;
            }}
            .summary-item h3 {{
                margin: 0 0 5px 0;
                font-size: 14px;
                color: #666;
            }}
            .summary-item p {{
                margin: 0;
                font-size: 20px;
                font-weight: bold;
                color: #333;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }}
            th {{
                background-color: #4F46E5;
                color: white;
                font-weight: bold;
            }}
            tr:nth-child(even) {{
                background-color: #f9f9f9;
            }}
            .section-title {{
                margin-top: 40px;
                margin-bottom: 10px;
                font-size: 22px;
                color: #4F46E5;
                border-bottom: 2px solid #4F46E5;
                padding-bottom: 5px;
            }}
            .status-badge {{
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            }}
            .status-paid {{
                background: #10b981;
                color: white;
            }}
            .status-partial {{
                background: #f59e0b;
                color: white;
            }}
            .status-unpaid {{
                background: #ef4444;
                color: white;
            }}
            .print-button {{
                background-color: #4F46E5;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px 0;
            }}
            .print-button:hover {{
                background-color: #4338CA;
            }}
            .total-row {{
                background-color: #e0e7ff !important;
                font-weight: bold;
            }}
        </style>
    </head>
    <body>
        <button class="print-button no-print" onclick="window.print()">Print Report</button>
        
        <div class="header">
            <h1>BILL REPORT - ALL OPERATIONS</h1>
            <p>Garment Manufacturing Pro</p>
            <p>Generated on: {datetime.now(timezone.utc).strftime('%d-%m-%Y %H:%M')}</p>
        </div>
        
        <div class="summary">
            <h2 style="margin-top:0;">Overall Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <h3>Fabric Cost</h3>
                    <p>₹{total_fabric_cost:.2f}</p>
                </div>
                <div class="summary-item">
                    <h3>Total Cutting Amount</h3>
                    <p>₹{total_cutting_amount:.2f}</p>
                </div>
                <div class="summary-item">
                    <h3>Total Outsourcing Amount</h3>
                    <p>₹{total_outsourcing_amount:.2f}</p>
                </div>
                <div class="summary-item">
                    <h3>Shortage Debit</h3>
                    <p style="color: #ef4444;">(-) ₹{total_shortage_debit:.2f}</p>
                </div>
                <div class="summary-item" style="grid-column: span 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <h3 style="color: white;">COMPREHENSIVE TOTAL</h3>
                    <p style="color: white; font-size: 28px;">₹{comprehensive_total:.2f}</p>
                    <p style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Fabric + Cutting + Outsourcing - Shortage Debit</p>
                </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; color: #1e40af;">Payment Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <div>
                        <p style="margin: 5px 0; color: #64748b;">Cutting Paid: <strong style="color: #10b981;">₹{total_cutting_paid:.2f}</strong></p>
                        <p style="margin: 5px 0; color: #64748b;">Cutting Balance: <strong style="color: #ef4444;">₹{total_cutting_balance:.2f}</strong></p>
                    </div>
                    <div>
                        <p style="margin: 5px 0; color: #64748b;">Outsourcing Paid: <strong style="color: #10b981;">₹{total_outsourcing_paid:.2f}</strong></p>
                        <p style="margin: 5px 0; color: #64748b;">Outsourcing Balance: <strong style="color: #ef4444;">₹{total_outsourcing_balance:.2f}</strong></p>
                    </div>
                </div>
            </div>
        </div>
        
        <h2 class="section-title">Cutting Operations</h2>
        <table>
            <thead>
                <tr>
                    <th>Lot Number</th>
                    <th>Cutting Master</th>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th>Fabric Cost</th>
                    <th>Cutting Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """
    
    # Add cutting orders
    for order in cutting_orders:
        cutting_date = order.get('cutting_date')
        if isinstance(cutting_date, str):
            cutting_date = datetime.fromisoformat(cutting_date)
        
        status_class = {
            'Paid': 'status-paid',
            'Partial': 'status-partial',
            'Unpaid': 'status-unpaid'
        }.get(order.get('payment_status', 'Unpaid'), 'status-unpaid')
        
        html_content += f"""
                <tr>
                    <td>{order.get('cutting_lot_number', 'N/A')}</td>
                    <td>{order.get('cutting_master_name', 'N/A')}</td>
                    <td>{cutting_date.strftime('%d-%m-%Y')}</td>
                    <td>{order.get('total_quantity', 0)} pcs</td>
                    <td>₹{order.get('total_fabric_cost', 0):.2f}</td>
                    <td>₹{order.get('total_cutting_amount', 0):.2f}</td>
                    <td>₹{order.get('amount_paid', 0):.2f}</td>
                    <td>₹{order.get('balance', 0):.2f}</td>
                    <td><span class="status-badge {status_class}">{order.get('payment_status', 'Unpaid')}</span></td>
                </tr>
        """
    
    html_content += f"""
                <tr class="total-row">
                    <td colspan="4">TOTAL</td>
                    <td>₹{total_fabric_cost:.2f}</td>
                    <td>₹{total_cutting_amount:.2f}</td>
                    <td>₹{total_cutting_paid:.2f}</td>
                    <td>₹{total_cutting_balance:.2f}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        
        <h2 class="section-title">Outsourcing Operations</h2>
        <table>
            <thead>
                <tr>
                    <th>DC Number</th>
                    <th>Cutting Lot</th>
                    <th>Unit Name</th>
                    <th>Operation</th>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th>Total Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """
    
    # Add outsourcing orders
    for order in outsourcing_orders:
        dc_date = order.get('dc_date')
        if isinstance(dc_date, str):
            dc_date = datetime.fromisoformat(dc_date)
        
        status_class = {
            'Paid': 'status-paid',
            'Partial': 'status-partial',
            'Unpaid': 'status-unpaid'
        }.get(order.get('payment_status', 'Unpaid'), 'status-unpaid')
        
        html_content += f"""
                <tr>
                    <td>{order.get('dc_number', 'N/A')}</td>
                    <td style="font-weight: bold; color: #4F46E5;">{order.get('cutting_lot_number', 'N/A')}</td>
                    <td>{order.get('unit_name', 'N/A')}</td>
                    <td>{order.get('operation_type', 'N/A')}</td>
                    <td>{dc_date.strftime('%d-%m-%Y')}</td>
                    <td>{order.get('total_quantity', 0)} pcs</td>
                    <td>₹{order.get('total_amount', 0):.2f}</td>
                    <td>₹{order.get('amount_paid', 0):.2f}</td>
                    <td>₹{order.get('balance', 0):.2f}</td>
                    <td><span class="status-badge {status_class}">{order.get('payment_status', 'Unpaid')}</span></td>
                </tr>
        """
    
    html_content += f"""
                <tr class="total-row">
                    <td colspan="6">TOTAL</td>
                    <td>₹{total_outsourcing_amount:.2f}</td>
                    <td>₹{total_outsourcing_paid:.2f}</td>
                    <td>₹{total_outsourcing_balance:.2f}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        
        <h2 class="section-title">Shortage Debit Summary</h2>
        <div style="background: #fee; padding: 20px; border-radius: 8px; border: 2px solid #fcc;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; color: #dc2626;">Total Shortage Debit</h3>
                    <p style="margin: 5px 0 0 0; color: #64748b;">Amount to be recovered from units</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: #dc2626;">₹{total_shortage_debit:.2f}</p>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
            <h2 style="margin: 0 0 15px 0; color: white; text-align: center; font-size: 24px;">COMPREHENSIVE TOTAL BREAKDOWN</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Fabric Cost</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold;">₹{total_fabric_cost:.2f}</p>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Cutting Cost</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold;">₹{total_cutting_amount:.2f}</p>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Outsourcing Cost</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold;">₹{total_outsourcing_amount:.2f}</p>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Shortage Debit</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold;">(-) ₹{total_shortage_debit:.2f}</p>
                </div>
            </div>
            <div style="border-top: 2px solid rgba(255,255,255,0.3); padding-top: 20px; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 18px; opacity: 0.9;">GRAND TOTAL</p>
                <p style="margin: 0; font-size: 42px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">₹{comprehensive_total:.2f}</p>
            </div>
        </div>
        
        <div style="margin-top: 50px; border-top: 2px solid #000; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between;">
                <div style="text-align: center; width: 45%;">
                    <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                        Prepared By
                    </div>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                        Authorized Signature
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


# Lot-wise Report
@api_router.get("/cutting-orders/{order_id}/lot-report", response_class=HTMLResponse)
async def get_lot_wise_report(order_id: str):
    # Get cutting order
    cutting_order = await db.cutting_orders.find_one({"id": order_id}, {"_id": 0})
    if not cutting_order:
        raise HTTPException(status_code=404, detail="Cutting order not found")
    
    # Convert datetime if needed
    if isinstance(cutting_order.get('cutting_date'), str):
        cutting_order['cutting_date'] = datetime.fromisoformat(cutting_order['cutting_date'])
    
    # Get fabric lot details
    fabric_lot = await db.fabric_lots.find_one({"id": cutting_order['fabric_lot_id']}, {"_id": 0})
    
    # Get all outsourcing orders for this cutting lot
    outsourcing_orders = await db.outsourcing_orders.find(
        {"cutting_lot_number": cutting_order['cutting_lot_number']}, 
        {"_id": 0}
    ).to_list(1000)
    
    # Get outsourcing receipts
    outsourcing_receipts = []
    total_outsourcing_shortage = 0
    for order in outsourcing_orders:
        receipts = await db.outsourcing_receipts.find(
            {"outsourcing_order_id": order['id']}, 
            {"_id": 0}
        ).to_list(1000)
        outsourcing_receipts.extend(receipts)
        total_outsourcing_shortage += sum(r.get('total_shortage', 0) for r in receipts)
    
    # Get ironing orders for this cutting lot
    ironing_orders = await db.ironing_orders.find(
        {"cutting_lot_number": cutting_order['cutting_lot_number']}, 
        {"_id": 0}
    ).to_list(1000)
    
    # Get ironing receipts
    ironing_receipts = []
    total_ironing_shortage = 0
    for order in ironing_orders:
        receipts = await db.ironing_receipts.find(
            {"ironing_order_id": order['id']}, 
            {"_id": 0}
        ).to_list(1000)
        ironing_receipts.extend(receipts)
        total_ironing_shortage += sum(r.get('total_shortage', 0) for r in receipts)
    
    # Calculate costs
    fabric_cost = cutting_order.get('total_fabric_cost', 0)
    cutting_cost = cutting_order.get('total_cutting_amount', 0)
    outsourcing_cost = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    ironing_cost = sum(o.get('total_amount', 0) for o in ironing_orders)
    outsourcing_shortage_debit = sum(r.get('shortage_debit_amount', 0) for r in outsourcing_receipts)
    ironing_shortage_debit = sum(r.get('shortage_debit_amount', 0) for r in ironing_receipts)
    
    total_cost = fabric_cost + cutting_cost + outsourcing_cost + ironing_cost - outsourcing_shortage_debit - ironing_shortage_debit
    
    # Generate HTML
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Lot-wise Report - {cutting_order['cutting_lot_number']}</title>
        <style>
            @media print {{
                @page {{ margin: 1cm; }}
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
            body {{
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 1000px;
                margin: 0 auto;
                background: #f5f5f5;
            }}
            .report-container {{
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .header {{
                text-align: center;
                border-bottom: 3px solid #4F46E5;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            .header h1 {{
                margin: 0;
                color: #4F46E5;
                font-size: 28px;
            }}
            .header p {{
                margin: 10px 0 0 0;
                color: #666;
                font-size: 16px;
            }}
            .section {{
                margin-bottom: 30px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            }}
            .section-header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                font-weight: bold;
                font-size: 16px;
            }}
            .section-content {{
                padding: 20px;
            }}
            .info-grid {{
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 15px;
            }}
            .info-item {{
                padding: 10px;
                background: #f9f9f9;
                border-radius: 4px;
                border-left: 3px solid #4F46E5;
            }}
            .info-label {{
                font-size: 12px;
                color: #666;
                margin-bottom: 5px;
            }}
            .info-value {{
                font-size: 14px;
                font-weight: bold;
                color: #333;
            }}
            .size-distribution {{
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }}
            .size-badge {{
                background: #4F46E5;
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: bold;
            }}
            .operation-card {{
                background: #f9f9f9;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 10px;
            }}
            .operation-header {{
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }}
            .operation-type {{
                background: #10B981;
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }}
            .cost-summary {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin-top: 30px;
            }}
            .cost-grid {{
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }}
            .cost-item {{
                background: rgba(255,255,255,0.15);
                padding: 15px;
                border-radius: 6px;
                text-align: center;
            }}
            .cost-label {{
                font-size: 13px;
                opacity: 0.9;
                margin-bottom: 5px;
            }}
            .cost-value {{
                font-size: 22px;
                font-weight: bold;
            }}
            .grand-total {{
                text-align: center;
                padding-top: 20px;
                border-top: 2px solid rgba(255,255,255,0.3);
            }}
            .grand-total-label {{
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 10px;
            }}
            .grand-total-value {{
                font-size: 36px;
                font-weight: bold;
            }}
            .shortage-alert {{
                background: #FEE2E2;
                border-left: 4px solid #EF4444;
                padding: 12px;
                border-radius: 4px;
                margin-top: 10px;
            }}
            .print-button {{
                background: #4F46E5;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                margin: 20px auto;
                display: block;
            }}
            .print-button:hover {{
                background: #4338CA;
            }}
            @media print {{
                .print-button {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="report-container">
            <button class="print-button no-print" onclick="window.print()">🖨️ Print Report</button>
            
            <div class="header">
                <h1>LOT-WISE PRODUCTION REPORT</h1>
                <p>Cutting Lot: <strong>{cutting_order['cutting_lot_number']}</strong></p>
                <p>Report Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
            </div>
            
            <!-- Fabric Details -->
            <div class="section">
                <div class="section-header">📦 FABRIC LOT DETAILS</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Lot Number</div>
                            <div class="info-value">{fabric_lot.get('lot_number', 'N/A') if fabric_lot else 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Fabric Type</div>
                            <div class="info-value">{fabric_lot.get('fabric_type', 'N/A') if fabric_lot else 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Color</div>
                            <div class="info-value">{fabric_lot.get('color', 'N/A') if fabric_lot else 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Supplier</div>
                            <div class="info-value">{fabric_lot.get('supplier_name', 'N/A') if fabric_lot else 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Rate per Kg</div>
                            <div class="info-value">₹{fabric_lot.get('rate_per_kg', 0) if fabric_lot else 0:.2f}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Fabric Used</div>
                            <div class="info-value">{cutting_order.get('fabric_used', 0):.2f} kg</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Cutting Details -->
            <div class="section">
                <div class="section-header">✂️ CUTTING DETAILS</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Cutting Master</div>
                            <div class="info-value">{cutting_order.get('cutting_master_name', 'N/A')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Category</div>
                            <div class="info-value">{cutting_order.get('category', 'N/A')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Style Type</div>
                            <div class="info-value">{cutting_order.get('style_type', 'N/A')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Total Quantity</div>
                            <div class="info-value">{cutting_order.get('total_quantity', 0)} pcs</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Cutting Rate</div>
                            <div class="info-value">₹{cutting_order.get('cutting_rate_per_pcs', 0):.2f}/pc</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Cutting Cost</div>
                            <div class="info-value">₹{cutting_cost:.2f}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Size Distribution</div>
                        <div class="size-distribution">
                            {''.join([f'<span class="size-badge">{size}: {qty}</span>' for size, qty in cutting_order.get('size_distribution', {}).items() if qty > 0])}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Outsourcing Operations -->
            <div class="section">
                <div class="section-header">🏭 OUTSOURCING OPERATIONS ({len(outsourcing_orders)})</div>
                <div class="section-content">
                    {''.join([f'''
                    <div class="operation-card">
                        <div class="operation-header">
                            <div>
                                <span class="operation-type">{order.get('operation_type', 'N/A')}</span>
                                <strong style="margin-left: 10px;">DC: {order.get('dc_number', 'N/A')}</strong>
                            </div>
                            <div><strong>₹{order.get('total_amount', 0):.2f}</strong></div>
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Unit Name</div>
                                <div class="info-value">{order.get('unit_name', 'N/A')}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Quantity</div>
                                <div class="info-value">{order.get('total_quantity', 0)} pcs</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Rate</div>
                                <div class="info-value">₹{order.get('rate_per_pcs', 0):.2f}/pc</div>
                            </div>
                        </div>
                        {''.join([f'<div class="shortage-alert"><strong>⚠️ Shortage:</strong> {receipt.get("total_shortage", 0)} pcs (₹{receipt.get("shortage_debit_amount", 0):.2f} debit)</div>' for receipt in outsourcing_receipts if receipt.get('outsourcing_order_id') == order.get('id') and receipt.get('total_shortage', 0) > 0])}
                    </div>
                    ''' for order in outsourcing_orders]) if outsourcing_orders else '<p style="text-align: center; color: #666;">No outsourcing operations</p>'}
                </div>
            </div>
            
            <!-- Ironing Operations -->
            <div class="section">
                <div class="section-header">🔥 IRONING OPERATIONS ({len(ironing_orders)})</div>
                <div class="section-content">
                    {''.join([f'''
                    <div class="operation-card">
                        <div class="operation-header">
                            <div><strong>DC: {order.get('dc_number', 'N/A')}</strong></div>
                            <div><strong>₹{order.get('total_amount', 0):.2f}</strong></div>
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Unit Name</div>
                                <div class="info-value">{order.get('unit_name', 'N/A')}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Quantity</div>
                                <div class="info-value">{order.get('total_quantity', 0)} pcs</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Rate</div>
                                <div class="info-value">₹{order.get('rate_per_pcs', 0):.2f}/pc</div>
                            </div>
                        </div>
                        {''.join([f'<div class="shortage-alert"><strong>⚠️ Shortage:</strong> {receipt.get("total_shortage", 0)} pcs (₹{receipt.get("shortage_debit_amount", 0):.2f} debit)</div>' for receipt in ironing_receipts if receipt.get('ironing_order_id') == order.get('id') and receipt.get('total_shortage', 0) > 0])}
                    </div>
                    ''' for order in ironing_orders]) if ironing_orders else '<p style="text-align: center; color: #666;">No ironing operations</p>'}
                </div>
            </div>
            
            <!-- Cost Summary -->
            <div class="cost-summary">
                <h3 style="margin: 0 0 20px 0; text-align: center; font-size: 20px;">💰 COST BREAKDOWN</h3>
                <div class="cost-grid">
                    <div class="cost-item">
                        <div class="cost-label">Fabric Cost</div>
                        <div class="cost-value">₹{fabric_cost:.2f}</div>
                    </div>
                    <div class="cost-item">
                        <div class="cost-label">Cutting Cost</div>
                        <div class="cost-value">₹{cutting_cost:.2f}</div>
                    </div>
                    <div class="cost-item">
                        <div class="cost-label">Outsourcing Cost</div>
                        <div class="cost-value">₹{outsourcing_cost:.2f}</div>
                    </div>
                    <div class="cost-item">
                        <div class="cost-label">Ironing Cost</div>
                        <div class="cost-value">₹{ironing_cost:.2f}</div>
                    </div>
                    <div class="cost-item">
                        <div class="cost-label">Outsourcing Shortage</div>
                        <div class="cost-value">(-) ₹{outsourcing_shortage_debit:.2f}</div>
                        <div class="cost-label" style="margin-top: 5px; font-size: 11px;">{total_outsourcing_shortage} pcs</div>
                    </div>
                    <div class="cost-item">
                        <div class="cost-label">Ironing Shortage</div>
                        <div class="cost-value">(-) ₹{ironing_shortage_debit:.2f}</div>
                        <div class="cost-label" style="margin-top: 5px; font-size: 11px;">{total_ironing_shortage} pcs</div>
                    </div>
                </div>
                <div class="grand-total">
                    <div class="grand-total-label">TOTAL COST FOR LOT</div>
                    <div class="grand-total-value">₹{total_cost:.2f}</div>
                    <div style="font-size: 12px; opacity: 0.9; margin-top: 10px;">
                        Cost per piece: ₹{(total_cost / cutting_order.get('total_quantity', 1)):.2f}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 50px; border-top: 2px solid #ddd; padding-top: 20px;">
                <div style="display: flex; justify-content: space-between;">
                    <div style="text-align: center; width: 45%;">
                        <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                            Prepared By
                        </div>
                    </div>
                    <div style="text-align: center; width: 45%;">
                        <div style="border-top: 1px solid #000; margin-top: 50px; padding-top: 5px;">
                            Authorized Signature
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


# Catalog Image Upload
@api_router.post("/upload/catalog-image")
async def upload_catalog_image(file: UploadFile = File(...)):
    """Upload a catalog product image"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: JPEG, PNG, WebP"
        )
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(
            status_code=400,
            detail="File size too large. Maximum size is 5MB"
        )
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Return the URL path
    image_url = f"/api/uploads/{unique_filename}"
    
    return {"image_url": image_url, "filename": unique_filename}


# Stock Routes
@api_router.get("/stock", response_model=List[Stock])
async def get_all_stock():
    """Get all stock entries with calculated master packs"""
    stocks = await db.stock.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    # Calculate master packs for each stock
    for stock in stocks:
        if stock.get('master_pack_ratio') and stock.get('size_distribution'):
            packs, loose, loose_dist = calculate_master_packs(
                stock['size_distribution'], 
                stock['master_pack_ratio']
            )
            stock['complete_packs'] = packs
            stock['loose_pieces'] = loose
            stock['loose_distribution'] = loose_dist
    
    return stocks


@api_router.post("/stock", response_model=Stock)
async def create_stock(stock: StockCreate, username: str = None):
    """Add historical stock entry"""
    # Generate unique stock code
    count = await db.stock.count_documents({})
    stock_code = f"STK-{str(count + 1).zfill(4)}"
    
    total_qty = sum(stock.size_distribution.values())
    
    stock_dict = {
        "id": str(uuid.uuid4()),
        "stock_code": stock_code,
        "lot_number": stock.lot_number,
        "source": "historical",
        "category": stock.category,
        "style_type": stock.style_type,
        "color": stock.color or "",
        "size_distribution": stock.size_distribution,
        "total_quantity": total_qty,
        "available_quantity": total_qty,
        "master_pack_ratio": stock.master_pack_ratio or {},
        "notes": stock.notes,
        "is_active": True,
        "created_by": username,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.stock.insert_one(stock_dict)
    return stock_dict


@api_router.get("/stock/{stock_id}")
async def get_stock(stock_id: str):
    """Get single stock entry"""
    stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Calculate master packs
    if stock.get('master_pack_ratio') and stock.get('size_distribution'):
        packs, loose, loose_dist = calculate_master_packs(
            stock['size_distribution'], 
            stock['master_pack_ratio']
        )
        stock['complete_packs'] = packs
        stock['loose_pieces'] = loose
        stock['loose_distribution'] = loose_dist
    
    return stock


@api_router.put("/stock/{stock_id}")
async def update_stock(stock_id: str, stock_update: StockCreate):
    """Update stock entry"""
    existing = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_qty = sum(stock_update.size_distribution.values())
    
    update_data = {
        "lot_number": stock_update.lot_number,
        "category": stock_update.category,
        "style_type": stock_update.style_type,
        "color": stock_update.color or "",
        "size_distribution": stock_update.size_distribution,
        "total_quantity": total_qty,
        "available_quantity": total_qty,
        "master_pack_ratio": stock_update.master_pack_ratio or {},
        "notes": stock_update.notes,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock.update_one({"id": stock_id}, {"$set": update_data})
    return {"message": "Stock updated successfully"}


@api_router.delete("/stock/{stock_id}")
async def delete_stock(stock_id: str):
    """Delete (deactivate) stock entry"""
    result = await db.stock.update_one(
        {"id": stock_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Stock not found")
    return {"message": "Stock deleted successfully"}


@api_router.post("/stock/{stock_id}/dispatch")
async def dispatch_from_stock(stock_id: str, dispatch: StockDispatch):
    """Dispatch from stock using master packs and loose pieces"""
    stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Get master pack ratio
    master_pack_ratio = stock.get('master_pack_ratio', {})
    size_distribution = stock.get('size_distribution', {})
    
    # If no ratio, create default (1 of each size)
    if not master_pack_ratio:
        master_pack_ratio = {size: 1 for size in size_distribution.keys()}
    
    # Calculate dispatch quantities
    dispatch_quantity = {}
    for size in size_distribution.keys():
        pack_qty = dispatch.master_packs * master_pack_ratio.get(size, 0)
        loose_qty = dispatch.loose_pcs.get(size, 0)
        dispatch_quantity[size] = pack_qty + loose_qty
    
    total_dispatch = sum(dispatch_quantity.values())
    
    if total_dispatch > stock.get('available_quantity', 0):
        raise HTTPException(status_code=400, detail="Insufficient stock for dispatch")
    
    # Validate per-size availability
    for size, qty in dispatch_quantity.items():
        available = size_distribution.get(size, 0)
        if qty > available:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for size {size}")
    
    # Update stock
    new_size_dist = size_distribution.copy()
    for size, qty in dispatch_quantity.items():
        if size in new_size_dist:
            new_size_dist[size] = max(0, new_size_dist[size] - qty)
    
    new_available = stock.get('available_quantity', 0) - total_dispatch
    
    await db.stock.update_one(
        {"id": stock_id},
        {"$set": {
            "size_distribution": new_size_dist,
            "available_quantity": new_available,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Record dispatch
    dispatch_record = {
        "id": str(uuid.uuid4()),
        "stock_id": stock_id,
        "stock_code": stock.get('stock_code'),
        "lot_number": stock.get('lot_number'),
        "master_packs": dispatch.master_packs,
        "loose_pcs": dispatch.loose_pcs,
        "dispatch_quantity": dispatch_quantity,
        "total_dispatched": total_dispatch,
        "customer_name": dispatch.customer_name,
        "bora_number": dispatch.bora_number,
        "dispatch_date": datetime.now(timezone.utc).isoformat(),
        "notes": dispatch.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_dispatches.insert_one(dispatch_record)
    
    return {"message": "Dispatch recorded successfully", "dispatched": total_dispatch, "remaining": new_available}


@api_router.post("/stock/{stock_id}/create-catalog")
async def create_catalog_from_stock(stock_id: str, catalog_name: str, catalog_code: str, description: str = None):
    """Create a catalog from stock entry"""
    stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    catalog_dict = {
        "id": str(uuid.uuid4()),
        "catalog_name": catalog_name,
        "catalog_code": catalog_code,
        "description": description,
        "color": stock.get('color', ''),
        "image_url": None,
        "lot_numbers": [stock.get('lot_number')],
        "total_quantity": stock.get('available_quantity'),
        "available_stock": stock.get('available_quantity'),
        "size_distribution": stock.get('size_distribution', {}),
        "master_pack_ratio": stock.get('master_pack_ratio', {}),
        "source_stock_id": stock_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.catalogs.insert_one(catalog_dict)
    
    # Mark stock as used in catalog
    await db.stock.update_one(
        {"id": stock_id},
        {"$set": {"used_in_catalog": catalog_name, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Catalog created successfully", "catalog_id": catalog_dict['id']}


@api_router.get("/stock/report/summary")
async def get_stock_summary():
    """Get stock summary report"""
    stocks = await db.stock.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    total_stock = 0
    total_packs = 0
    total_loose = 0
    by_category = {}
    by_style = {}
    
    for stock in stocks:
        qty = stock.get('available_quantity', 0)
        total_stock += qty
        
        # Calculate packs
        if stock.get('master_pack_ratio'):
            packs, loose, _ = calculate_master_packs(
                stock.get('size_distribution', {}),
                stock.get('master_pack_ratio', {})
            )
            total_packs += packs
            total_loose += loose
        else:
            total_loose += qty
        
        # Group by category
        cat = stock.get('category', 'Unknown')
        by_category[cat] = by_category.get(cat, 0) + qty
        
        # Group by style
        style = stock.get('style_type', 'Unknown')
        by_style[style] = by_style.get(style, 0) + qty
    
    return {
        "total_stock": total_stock,
        "total_packs": total_packs,
        "total_loose": total_loose,
        "by_category": by_category,
        "by_style": by_style,
        "stock_count": len(stocks)
    }


@api_router.get("/stock/{stock_id}/qrcode")
async def get_stock_qrcode(stock_id: str):
    """Generate QR code for stock entry"""
    stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # QR data contains essential info for scanning
    qr_data = json.dumps({
        "type": "stock",
        "id": stock_id,
        "code": stock.get('stock_code'),
        "lot": stock.get('lot_number'),
        "category": stock.get('category'),
        "style": stock.get('style_type'),
        "color": stock.get('color', ''),
        "ratio": stock.get('master_pack_ratio', {})
    })
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return Response(content=buffer.getvalue(), media_type="image/png")


@api_router.post("/stock/{stock_id}/quick-dispatch")
async def quick_dispatch_one_pack(stock_id: str, customer_name: str = "Walk-in", bora_number: str = None):
    """Quick dispatch exactly 1 master pack from stock"""
    stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    master_pack_ratio = stock.get('master_pack_ratio', {})
    size_distribution = stock.get('size_distribution', {})
    
    if not master_pack_ratio:
        master_pack_ratio = {size: 1 for size in size_distribution.keys()}
    
    # Calculate 1 pack dispatch
    dispatch_quantity = {}
    total_dispatch = 0
    for size, ratio_qty in master_pack_ratio.items():
        if ratio_qty > 0:
            available = size_distribution.get(size, 0)
            if available < ratio_qty:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for size {size}")
            dispatch_quantity[size] = ratio_qty
            total_dispatch += ratio_qty
    
    if total_dispatch == 0:
        raise HTTPException(status_code=400, detail="Cannot dispatch - no valid pack ratio")
    
    # Update stock
    new_size_dist = size_distribution.copy()
    for size, qty in dispatch_quantity.items():
        new_size_dist[size] = max(0, new_size_dist[size] - qty)
    
    new_available = stock.get('available_quantity', 0) - total_dispatch
    
    # Generate bora number if not provided
    if not bora_number:
        bora_number = f"QD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    await db.stock.update_one(
        {"id": stock_id},
        {"$set": {
            "size_distribution": new_size_dist,
            "available_quantity": new_available,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Record dispatch
    dispatch_record = {
        "id": str(uuid.uuid4()),
        "stock_id": stock_id,
        "stock_code": stock.get('stock_code'),
        "lot_number": stock.get('lot_number'),
        "master_packs": 1,
        "loose_pcs": {},
        "dispatch_quantity": dispatch_quantity,
        "total_dispatched": total_dispatch,
        "customer_name": customer_name,
        "bora_number": bora_number,
        "dispatch_date": datetime.now(timezone.utc).isoformat(),
        "quick_dispatch": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_dispatches.insert_one(dispatch_record)
    
    return {
        "message": "Quick dispatch successful",
        "dispatched": total_dispatch,
        "remaining": new_available,
        "bora_number": bora_number
    }


@api_router.get("/stock/by-code/{stock_code}")
async def get_stock_by_code(stock_code: str):
    """Get stock by stock code (for QR scan lookup)"""
    stock = await db.stock.find_one({"stock_code": stock_code, "is_active": True}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Calculate master packs
    if stock.get('master_pack_ratio') and stock.get('size_distribution'):
        packs, loose, loose_dist = calculate_master_packs(
            stock['size_distribution'], 
            stock['master_pack_ratio']
        )
        stock['complete_packs'] = packs
        stock['loose_pieces'] = loose
        stock['loose_distribution'] = loose_dist
    
    return stock


@api_router.post("/stock/copy-from/{source_stock_id}")
async def create_stock_from_existing(source_stock_id: str, stock: StockCreate):
    """Create new stock by copying settings from existing stock"""
    source = await db.stock.find_one({"id": source_stock_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source stock not found")
    
    # Generate unique stock code
    count = await db.stock.count_documents({})
    stock_code = f"STK-{str(count + 1).zfill(4)}"
    
    total_qty = sum(stock.size_distribution.values())
    
    stock_dict = {
        "id": str(uuid.uuid4()),
        "stock_code": stock_code,
        "lot_number": stock.lot_number,
        "source": "historical",
        "category": stock.category or source.get('category'),
        "style_type": stock.style_type or source.get('style_type'),
        "color": stock.color or source.get('color', ''),
        "size_distribution": stock.size_distribution,
        "total_quantity": total_qty,
        "available_quantity": total_qty,
        "master_pack_ratio": stock.master_pack_ratio or source.get('master_pack_ratio', {}),
        "notes": stock.notes,
        "copied_from": source_stock_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock.insert_one(stock_dict)
    return stock_dict


# ==================== BULK DISPATCH ROUTES ====================

def generate_dispatch_number():
    """Generate a unique dispatch number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"DSP-{timestamp}"

@api_router.post("/bulk-dispatches")
async def create_bulk_dispatch(dispatch: BulkDispatchCreate):
    """Create a bulk dispatch with multiple stock items"""
    dispatch_dict = dispatch.model_dump()
    
    # Generate dispatch number
    dispatch_dict['id'] = str(uuid.uuid4())
    dispatch_dict['dispatch_number'] = generate_dispatch_number()
    dispatch_dict['dispatch_date'] = dispatch_dict['dispatch_date'].isoformat() if isinstance(dispatch_dict['dispatch_date'], datetime) else dispatch_dict['dispatch_date']
    
    # Process each item
    processed_items = []
    grand_total = 0
    
    for item in dispatch_dict['items']:
        stock_id = item['stock_id']
        master_packs = item.get('master_packs', 0)
        loose_pcs = item.get('loose_pcs', {})
        
        # Get stock details
        stock = await db.stock.find_one({"id": stock_id}, {"_id": 0})
        if not stock:
            raise HTTPException(status_code=404, detail=f"Stock {stock_id} not found")
        
        # Calculate dispatch quantities
        master_pack_ratio = stock.get('master_pack_ratio', {})
        dispatch_distribution = {}
        total_from_packs = 0
        
        # Calculate from master packs
        if master_packs > 0 and master_pack_ratio:
            for size, ratio in master_pack_ratio.items():
                qty = master_packs * ratio
                dispatch_distribution[size] = dispatch_distribution.get(size, 0) + qty
                total_from_packs += qty
        
        # Add loose pieces
        total_loose = 0
        for size, qty in loose_pcs.items():
            if qty > 0:
                dispatch_distribution[size] = dispatch_distribution.get(size, 0) + qty
                total_loose += qty
        
        total_quantity = total_from_packs + total_loose
        
        if total_quantity == 0:
            continue  # Skip items with 0 quantity
        
        # Verify stock availability
        available = stock.get('available_quantity', 0)
        if total_quantity > available:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {stock['stock_code']}. Available: {available}, Requested: {total_quantity}"
            )
        
        # Update stock quantities
        new_available = available - total_quantity
        new_size_distribution = {}
        for size, qty in stock.get('size_distribution', {}).items():
            dispatched = dispatch_distribution.get(size, 0)
            new_size_distribution[size] = max(0, qty - dispatched)
        
        await db.stock.update_one(
            {"id": stock_id},
            {"$set": {
                "available_quantity": new_available,
                "size_distribution": new_size_distribution,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create processed item
        processed_item = {
            "stock_id": stock_id,
            "stock_code": stock.get('stock_code', ''),
            "lot_number": stock.get('lot_number', ''),
            "category": stock.get('category', ''),
            "style_type": stock.get('style_type', ''),
            "color": stock.get('color', ''),
            "master_packs": master_packs,
            "loose_pcs": loose_pcs,
            "master_pack_ratio": master_pack_ratio,
            "size_distribution": dispatch_distribution,
            "total_quantity": total_quantity
        }
        processed_items.append(processed_item)
        grand_total += total_quantity
    
    if not processed_items:
        raise HTTPException(status_code=400, detail="No valid items to dispatch")
    
    # Save bulk dispatch
    dispatch_dict['items'] = processed_items
    dispatch_dict['total_items'] = len(processed_items)
    dispatch_dict['grand_total_quantity'] = grand_total
    dispatch_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.bulk_dispatches.insert_one(dispatch_dict)
    
    return {
        "message": "Bulk dispatch created successfully",
        "dispatch_number": dispatch_dict['dispatch_number'],
        "total_items": len(processed_items),
        "grand_total_quantity": grand_total,
        "id": dispatch_dict['id']
    }

@api_router.get("/bulk-dispatches")
async def get_bulk_dispatches():
    """Get all bulk dispatches"""
    dispatches = await db.bulk_dispatches.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return dispatches

@api_router.get("/bulk-dispatches/{dispatch_id}")
async def get_bulk_dispatch(dispatch_id: str):
    """Get a single bulk dispatch by ID"""
    dispatch = await db.bulk_dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch

@api_router.delete("/bulk-dispatches/{dispatch_id}")
async def delete_bulk_dispatch(dispatch_id: str):
    """Delete a bulk dispatch (and restore stock quantities)"""
    dispatch = await db.bulk_dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    # Restore stock quantities
    for item in dispatch.get('items', []):
        stock = await db.stock.find_one({"id": item['stock_id']}, {"_id": 0})
        if stock:
            # Restore available quantity
            new_available = stock.get('available_quantity', 0) + item['total_quantity']
            
            # Restore size distribution
            new_size_distribution = {}
            for size, qty in stock.get('size_distribution', {}).items():
                restored = item.get('size_distribution', {}).get(size, 0)
                new_size_distribution[size] = qty + restored
            
            await db.stock.update_one(
                {"id": item['stock_id']},
                {"$set": {
                    "available_quantity": new_available,
                    "size_distribution": new_size_distribution,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    await db.bulk_dispatches.delete_one({"id": dispatch_id})
    return {"message": "Dispatch deleted and stock restored"}

@api_router.get("/bulk-dispatches/{dispatch_id}/print")
async def print_bulk_dispatch(dispatch_id: str):
    """Generate printable HTML dispatch sheet"""
    dispatch = await db.bulk_dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    # Build items table rows
    items_html = ""
    for idx, item in enumerate(dispatch.get('items', []), 1):
        # Format size distribution
        sizes = ", ".join([f"{s}:{q}" for s, q in item.get('size_distribution', {}).items() if q > 0])
        # Format loose pcs
        loose = ", ".join([f"{s}:{q}" for s, q in item.get('loose_pcs', {}).items() if q > 0]) or "-"
        
        items_html += f"""
        <tr>
            <td>{idx}</td>
            <td><strong>{item.get('stock_code', '')}</strong></td>
            <td>{item.get('lot_number', '')}</td>
            <td>{item.get('category', '')}</td>
            <td>{item.get('style_type', '')}</td>
            <td>{item.get('color', '')}</td>
            <td style="text-align:center;">{item.get('master_packs', 0)}</td>
            <td>{loose}</td>
            <td>{sizes}</td>
            <td style="text-align:right;font-weight:bold;">{item.get('total_quantity', 0)}</td>
        </tr>
        """
    
    # Parse dispatch date
    dispatch_date = dispatch.get('dispatch_date', '')
    if isinstance(dispatch_date, str):
        try:
            dispatch_date = datetime.fromisoformat(dispatch_date.replace('Z', '+00:00')).strftime('%d-%m-%Y')
        except:
            pass
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dispatch Sheet - {dispatch.get('dispatch_number', '')}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
            .header {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            .header h1 {{ margin: 0; color: #4F46E5; font-size: 24px; }}
            .header h2 {{ margin: 5px 0; font-size: 18px; }}
            .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }}
            .info-item {{ padding: 8px; background: #f5f5f5; border-radius: 4px; }}
            .info-item strong {{ color: #333; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #4F46E5; color: white; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .total-row {{ background-color: #e8e8e8 !important; font-weight: bold; }}
            .grand-total {{ font-size: 18px; text-align: right; margin-top: 10px; padding: 15px; background: #4F46E5; color: white; border-radius: 4px; }}
            .notes-section {{ margin-top: 20px; padding: 15px; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 4px; }}
            .signature-section {{ margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }}
            .signature-box {{ border-top: 1px solid #333; padding-top: 10px; text-align: center; }}
            @media print {{
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏭 Arian Knit Fab Production Pro</h1>
            <h2>📦 DISPATCH SHEET</h2>
        </div>
        
        <div class="info-grid">
            <div class="info-item"><strong>Dispatch No:</strong> {dispatch.get('dispatch_number', '')}</div>
            <div class="info-item"><strong>Date:</strong> {dispatch_date}</div>
            <div class="info-item"><strong>Customer:</strong> {dispatch.get('customer_name', '')}</div>
            <div class="info-item"><strong>Bora No:</strong> {dispatch.get('bora_number', '')}</div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Stock Code</th>
                    <th>Lot Name</th>
                    <th>Category</th>
                    <th>Style</th>
                    <th>Color</th>
                    <th>Master Packs</th>
                    <th>Loose Pcs</th>
                    <th>Size Distribution</th>
                    <th>Total Qty</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
                <tr class="total-row">
                    <td colspan="6" style="text-align:right;">TOTAL ITEMS: {dispatch.get('total_items', 0)}</td>
                    <td colspan="3"></td>
                    <td style="text-align:right;">{dispatch.get('grand_total_quantity', 0)}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="grand-total">
            📦 GRAND TOTAL: {dispatch.get('grand_total_quantity', 0)} Pieces
        </div>
        
        {"<div class='notes-section'><strong>📝 Notes:</strong> " + dispatch.get('notes', '') + "</div>" if dispatch.get('notes') else ""}
        {"<div class='notes-section' style='background:#fef2f2;border-color:#ef4444;'><strong>⚠️ Remarks:</strong> " + dispatch.get('remarks', '') + "</div>" if dispatch.get('remarks') else ""}
        
        <div class="signature-section">
            <div class="signature-box">Prepared By</div>
            <div class="signature-box">Received By</div>
        </div>
        
        <div style="text-align:center;margin-top:30px;color:#666;font-size:10px;">
            Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')} | Arian Knit Fab Production Pro
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@api_router.get("/stock/labels/print")
async def print_stock_labels(stock_ids: str = ""):
    """Generate printable labels for stock items"""
    ids = stock_ids.split(",") if stock_ids else []
    
    if ids:
        stocks = await db.stock.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
    else:
        # Get all active stock items
        stocks = await db.stock.find({"available_quantity": {"$gt": 0}}, {"_id": 0}).to_list(100)
    
    labels_html = ""
    for stock in stocks:
        sizes = ", ".join([f"{k}:{v}" for k, v in stock.get('size_distribution', {}).items() if v > 0])
        labels_html += f"""
        <div class="label">
            <div class="label-header">{stock.get('stock_code', '')}</div>
            <div class="label-lot">{stock.get('lot_number', '')}</div>
            <div class="label-info">
                <span>{stock.get('category', '')} | {stock.get('style_type', '')}</span>
                <span class="color">{stock.get('color', '')}</span>
            </div>
            <div class="label-qty">
                <span class="big">{stock.get('available_quantity', 0)}</span>
                <span>pcs</span>
            </div>
            <div class="label-sizes">{sizes}</div>
            <div class="label-packs">
                Packs: {stock.get('complete_packs', 0)} | Loose: {stock.get('loose_pieces', 0)}
            </div>
            <div class="label-barcode">
                <img src="/api/stock/{stock.get('id')}/qr" alt="QR" style="width:60px;height:60px;" />
            </div>
        </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Stock Labels - Arian Knit Fab</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 10px; }}
            .labels-container {{ display: flex; flex-wrap: wrap; gap: 10px; }}
            .label {{
                width: 280px;
                height: 180px;
                border: 2px solid #333;
                border-radius: 8px;
                padding: 10px;
                position: relative;
                page-break-inside: avoid;
            }}
            .label-header {{
                font-size: 18px;
                font-weight: bold;
                color: #4F46E5;
                border-bottom: 2px solid #4F46E5;
                padding-bottom: 5px;
                margin-bottom: 5px;
            }}
            .label-lot {{
                font-size: 14px;
                font-weight: bold;
                color: #333;
            }}
            .label-info {{
                font-size: 11px;
                color: #666;
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
            }}
            .label-info .color {{
                background: #8B5CF6;
                color: white;
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 10px;
            }}
            .label-qty {{
                font-size: 12px;
                margin: 5px 0;
            }}
            .label-qty .big {{
                font-size: 24px;
                font-weight: bold;
                color: #059669;
            }}
            .label-sizes {{
                font-size: 10px;
                color: #666;
                margin: 5px 0;
            }}
            .label-packs {{
                font-size: 10px;
                color: #666;
            }}
            .label-barcode {{
                position: absolute;
                bottom: 10px;
                right: 10px;
            }}
            @media print {{
                .no-print {{ display: none; }}
                .label {{ margin: 5px; }}
            }}
        </style>
    </head>
    <body>
        <div class="no-print" style="margin-bottom:20px;">
            <button onclick="window.print()" style="padding:10px 20px;background:#4F46E5;color:white;border:none;border-radius:4px;cursor:pointer;">
                🖨️ Print Labels
            </button>
            <span style="margin-left:10px;color:#666;">{len(stocks)} labels</span>
        </div>
        <div class="labels-container">
            {labels_html}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Catalog Routes
@api_router.post("/catalogs", response_model=Catalog)
async def create_catalog(catalog: CatalogCreate):
    # Get cutting orders for the selected lot numbers
    cutting_orders = await db.cutting_orders.find(
        {"cutting_lot_number": {"$in": catalog.lot_numbers}},
        {"_id": 0}
    ).to_list(1000)
    
    if not cutting_orders:
        raise HTTPException(status_code=404, detail="No cutting orders found for the specified lot numbers")
    
    # Check if any lot is already used in another catalog
    already_used = []
    for order in cutting_orders:
        if order.get('used_in_catalog') and order.get('catalog_name'):
            already_used.append(f"{order['cutting_lot_number']} (already in catalog: {order['catalog_name']})")
    
    if already_used:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot create catalog. The following lots are already used: {', '.join(already_used)}"
        )
    
    # Calculate total quantity and size distribution
    total_quantity = sum(order.get('total_quantity', 0) for order in cutting_orders)
    size_distribution = {}
    
    for order in cutting_orders:
        for size, qty in order.get('size_distribution', {}).items():
            size_distribution[size] = size_distribution.get(size, 0) + qty
    
    # Get color from first cutting order (assuming all lots in catalog have same color)
    color = cutting_orders[0].get('color', '') if cutting_orders else ''
    
    # Create catalog
    catalog_dict = catalog.model_dump()
    catalog_dict['id'] = str(uuid.uuid4())
    catalog_dict['total_quantity'] = total_quantity
    catalog_dict['available_stock'] = total_quantity
    catalog_dict['size_distribution'] = size_distribution
    catalog_dict['color'] = color
    catalog_dict['created_at'] = datetime.now(timezone.utc)
    
    catalog_obj = Catalog(**catalog_dict)
    doc = catalog_obj.model_dump()
    await db.catalogs.insert_one(doc)
    
    # Mark cutting orders as used in this catalog
    for lot_number in catalog.lot_numbers:
        await db.cutting_orders.update_many(
            {"cutting_lot_number": lot_number},
            {"$set": {
                "used_in_catalog": True,
                "catalog_id": catalog_dict['id'],
                "catalog_name": catalog.catalog_name
            }}
        )
    
    return catalog_obj


@api_router.get("/catalogs", response_model=List[Catalog])
async def get_catalogs():
    catalogs = await db.catalogs.find({}, {"_id": 0}).to_list(1000)
    return catalogs


@api_router.get("/catalogs/{catalog_id}", response_model=Catalog)
async def get_catalog(catalog_id: str):
    catalog = await db.catalogs.find_one({"id": catalog_id}, {"_id": 0})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return catalog


@api_router.put("/catalogs/{catalog_id}", response_model=Catalog)
async def update_catalog(catalog_id: str, catalog_update: CatalogCreate):
    existing_catalog = await db.catalogs.find_one({"id": catalog_id}, {"_id": 0})
    if not existing_catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    
    # Get old lot numbers to unmark them
    old_lot_numbers = existing_catalog.get('lot_numbers', [])
    
    # Get cutting orders for the new lot numbers
    cutting_orders = await db.cutting_orders.find(
        {"cutting_lot_number": {"$in": catalog_update.lot_numbers}},
        {"_id": 0}
    ).to_list(1000)
    
    if not cutting_orders:
        raise HTTPException(status_code=404, detail="No cutting orders found for the specified lot numbers")
    
    # Check if any NEW lot is already used in another catalog
    already_used = []
    for order in cutting_orders:
        if order.get('used_in_catalog') and order.get('catalog_id') != catalog_id:
            already_used.append(f"{order['cutting_lot_number']} (already in catalog: {order['catalog_name']})")
    
    if already_used:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot update catalog. The following lots are already used: {', '.join(already_used)}"
        )
    
    # Recalculate total quantity and size distribution
    total_quantity = sum(order.get('total_quantity', 0) for order in cutting_orders)
    size_distribution = {}
    
    for order in cutting_orders:
        for size, qty in order.get('size_distribution', {}).items():
            size_distribution[size] = size_distribution.get(size, 0) + qty
    
    # Get color from first cutting order (assuming all lots in catalog have same color)
    color = cutting_orders[0].get('color', '') if cutting_orders else ''
    
    # Calculate available stock based on previous dispatches
    dispatched_quantity = existing_catalog.get('total_quantity', 0) - existing_catalog.get('available_stock', 0)
    available_stock = total_quantity - dispatched_quantity
    
    # Update catalog
    update_dict = {
        "catalog_name": catalog_update.catalog_name,
        "catalog_code": catalog_update.catalog_code,
        "description": catalog_update.description,
        "color": color,
        "lot_numbers": catalog_update.lot_numbers,
        "total_quantity": total_quantity,
        "available_stock": max(0, available_stock),
        "size_distribution": size_distribution
    }
    
    await db.catalogs.update_one(
        {"id": catalog_id},
        {"$set": update_dict}
    )
    
    # Unmark old lots that are no longer in this catalog
    removed_lots = [lot for lot in old_lot_numbers if lot not in catalog_update.lot_numbers]
    if removed_lots:
        await db.cutting_orders.update_many(
            {"cutting_lot_number": {"$in": removed_lots}, "catalog_id": catalog_id},
            {"$set": {
                "used_in_catalog": False,
                "catalog_id": None,
                "catalog_name": None
            }}
        )
    
    # Mark new lots as used in this catalog
    for lot_number in catalog_update.lot_numbers:
        await db.cutting_orders.update_many(
            {"cutting_lot_number": lot_number},
            {"$set": {
                "used_in_catalog": True,
                "catalog_id": catalog_id,
                "catalog_name": catalog_update.catalog_name
            }}
        )
    
    updated_catalog = await db.catalogs.find_one({"id": catalog_id}, {"_id": 0})
    return updated_catalog


@api_router.post("/catalogs/{catalog_id}/dispatch")
async def dispatch_from_catalog(catalog_id: str, dispatch: CatalogDispatch):
    catalog = await db.catalogs.find_one({"id": catalog_id}, {"_id": 0})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    
    # Get master pack ratio from catalog or use default (1 of each size)
    master_pack_ratio = catalog.get('master_pack_ratio', {})
    size_distribution = catalog.get('size_distribution', {})
    
    # If no master pack ratio is set, create a default one (1 of each available size)
    if not master_pack_ratio:
        master_pack_ratio = {size: 1 for size in size_distribution.keys()}
    
    # Calculate size-wise dispatch quantities from master packs and loose pcs
    dispatch_quantity = {}
    for size in size_distribution.keys():
        # Quantity from master packs
        pack_qty = dispatch.master_packs * master_pack_ratio.get(size, 0)
        # Add loose pieces for this size
        loose_qty = dispatch.loose_pcs.get(size, 0)
        dispatch_quantity[size] = pack_qty + loose_qty
    
    # Calculate total dispatch quantity
    total_dispatch = sum(dispatch_quantity.values())
    
    if total_dispatch > catalog.get('available_stock', 0):
        raise HTTPException(status_code=400, detail="Insufficient stock for dispatch")
    
    # Validate dispatch doesn't exceed available size-wise quantities
    for size, qty in dispatch_quantity.items():
        available_qty = size_distribution.get(size, 0)
        if qty > available_qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for size {size}. Available: {available_qty}, Requested: {qty}")
    
    # Update available stock and size distribution
    new_available_stock = catalog.get('available_stock', 0) - total_dispatch
    new_size_distribution = size_distribution.copy()
    
    for size, qty in dispatch_quantity.items():
        if size in new_size_distribution:
            new_size_distribution[size] = max(0, new_size_distribution[size] - qty)
    
    await db.catalogs.update_one(
        {"id": catalog_id},
        {
            "$set": {
                "available_stock": new_available_stock,
                "size_distribution": new_size_distribution
            }
        }
    )
    
    # Record dispatch history
    dispatch_record = {
        "id": str(uuid.uuid4()),
        "catalog_id": catalog_id,
        "catalog_name": catalog.get('catalog_name'),
        "lot_number": dispatch.lot_number,
        "master_packs": dispatch.master_packs,
        "loose_pcs": dispatch.loose_pcs,
        "dispatch_quantity": dispatch_quantity,  # Calculated size-wise quantities
        "total_dispatched": total_dispatch,
        "customer_name": dispatch.customer_name,
        "dispatch_date": dispatch.dispatch_date,
        "bora_number": dispatch.bora_number,
        "color": dispatch.color,
        "notes": dispatch.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.catalog_dispatches.insert_one(dispatch_record)
    
    return {"message": "Dispatch recorded successfully", "new_available_stock": new_available_stock, "dispatched_qty": dispatch_quantity}


@api_router.delete("/catalogs/{catalog_id}")
async def delete_catalog(catalog_id: str):
    # Get the catalog to find its lots
    catalog = await db.catalogs.find_one({"id": catalog_id}, {"_id": 0})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    
    # Unmark cutting orders
    await db.cutting_orders.update_many(
        {"catalog_id": catalog_id},
        {"$set": {
            "used_in_catalog": False,
            "catalog_id": None,
            "catalog_name": None
        }}
    )
    
    # Delete the catalog
    result = await db.catalogs.delete_one({"id": catalog_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return {"message": "Catalog deleted successfully"}


@api_router.get("/catalogs/{catalog_id}/dispatches")
async def get_catalog_dispatches(catalog_id: str):
    dispatches = await db.catalog_dispatches.find(
        {"catalog_id": catalog_id},
        {"_id": 0}
    ).to_list(1000)
    return dispatches


# Reports Endpoints
def generate_cutting_rows(orders, lot_status):
    rows = []
    for o in orders:
        lot_num = o.get('cutting_lot_number', 'N/A')
        date_str = o.get('cutting_date').strftime('%d %b %Y') if o.get('cutting_date') else 'N/A'
        cutting_amt = o.get('total_cutting_amount', 0)
        balance = o.get('balance', 0)
        balance_color = 'green' if balance == 0 else 'red'
        
        # Build status badges
        status_html = '<span class="status-badge status-cutting">✂️ Cut</span>'
        
        # Add outsourcing statuses
        lot_info = lot_status.get(lot_num, {})
        for os_item in lot_info.get('outsourcing', []):
            badge_class = 'status-received' if os_item['status'] == 'Received' else 'status-outsourcing'
            status_html += f'<span class="status-badge {badge_class}">{os_item["operation"]} ({os_item["status"]})</span>'
        
        # Add ironing status
        ironing_info = lot_info.get('ironing')
        if ironing_info:
            ironing_status = ironing_info.get('status', 'N/A')
            badge_class = 'status-complete' if ironing_status == 'Received' else 'status-ironing'
            status_html += f'<span class="status-badge {badge_class}">🔥 Ironing ({ironing_status})</span>'
        
        rows.append(f"""
        <tr>
            <td><strong>{lot_num}</strong></td>
            <td>{date_str}</td>
            <td>{o.get('cutting_master_name', 'N/A')}</td>
            <td>{o.get('category', 'N/A')}</td>
            <td>{o.get('style_type', 'N/A')}</td>
            <td><strong>{o.get('total_quantity', 0)}</strong></td>
            <td>{status_html}</td>
            <td>₹{cutting_amt:.2f}</td>
            <td style="color: {balance_color};">₹{balance:.2f}</td>
        </tr>
        """)
    return ''.join(rows)


def generate_fabric_rows(lots, fabric_usage):
    rows = []
    for l in lots:
        lot_num = l.get('lot_number', '')
        # Calculate total from rolls if total_quantity not set
        rolls = l.get('rolls', [])
        total_qty = l.get('total_quantity', 0)
        if total_qty == 0 and rolls:
            total_qty = sum(r.get('weight', 0) for r in rolls)
        
        remaining_qty = l.get('remaining_quantity', 0)
        
        # Get actual used quantity from cutting orders
        used_qty = fabric_usage.get(lot_num, 0)
        
        # If we have remaining but no total, estimate total = remaining + used
        if total_qty == 0 and (remaining_qty > 0 or used_qty > 0):
            total_qty = remaining_qty + used_qty
        
        status_class = 'in-stock' if remaining_qty > 0 else 'exhausted'
        status_text = 'In Stock' if remaining_qty > 0 else 'Exhausted'
        rows.append(f"""
        <tr>
            <td><strong>{l.get('lot_number', 'N/A')}</strong></td>
            <td>{l.get('supplier_name', 'N/A')}</td>
            <td>{l.get('fabric_type', 'N/A')}</td>
            <td>{l.get('color', 'N/A')}</td>
            <td>{len(rolls)}</td>
            <td>{total_qty:.2f}</td>
            <td>{used_qty:.2f}</td>
            <td><strong>{remaining_qty:.2f}</strong></td>
            <td><span class="{status_class}">{status_text}</span></td>
        </tr>
        """)
    return ''.join(rows)


@api_router.get("/reports/fabric-inventory", response_class=HTMLResponse)
async def get_fabric_inventory_report(
    status: str = None,
    supplier: str = None
):
    """Generate fabric inventory report"""
    lots = await db.fabric_lots.find({}, {"_id": 0}).to_list(1000)
    
    # Get cutting orders to calculate fabric usage
    cutting_orders = await db.cutting_orders.find({}, {"_id": 0, "lot_number": 1, "fabric_used": 1}).to_list(1000)
    
    # Calculate fabric usage per lot from cutting orders
    fabric_usage = {}
    for co in cutting_orders:
        lot_num = co.get('lot_number', '')
        used = co.get('fabric_used', 0) or 0
        if lot_num:
            fabric_usage[lot_num] = fabric_usage.get(lot_num, 0) + used
    
    # Apply filters
    if status == "in_stock":
        lots = [l for l in lots if l.get('remaining_quantity', 0) > 0]
    elif status == "exhausted":
        lots = [l for l in lots if l.get('remaining_quantity', 0) <= 0]
    
    if supplier:
        lots = [l for l in lots if supplier.lower() in l.get('supplier_name', '').lower()]
    
    # Calculate totals
    total_lots = len(lots)
    total_rolls = sum(len(l.get('rolls', [])) for l in lots)
    total_remaining = sum(l.get('remaining_quantity', 0) for l in lots)
    total_used = sum(fabric_usage.get(l.get('lot_number', ''), 0) for l in lots)
    total_quantity = total_remaining + total_used
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fabric Inventory Report</title>
        <style>
            @media print {{ @page {{ margin: 1cm; }} body {{ margin: 0; }} .no-print {{ display: none; }} }}
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; border-bottom: 3px solid #8B5CF6; padding-bottom: 20px; margin-bottom: 30px; }}
            .header h1 {{ margin: 0; color: #8B5CF6; font-size: 28px; }}
            .filters {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #8B5CF6; color: white; padding: 12px; text-align: left; font-size: 12px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }}
            tr:hover {{ background: #f5f5f5; }}
            .in-stock {{ background: #D1FAE5; color: #065F46; padding: 4px 8px; border-radius: 4px; font-weight: bold; }}
            .exhausted {{ background: #FEE2E2; color: #991B1B; padding: 4px 8px; border-radius: 4px; font-weight: bold; }}
            .summary {{ background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; }}
            .summary-item {{ text-align: center; }}
            .summary-label {{ font-size: 13px; opacity: 0.9; }}
            .summary-value {{ font-size: 24px; font-weight: bold; margin-top: 5px; }}
            .print-btn {{ background: #8B5CF6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
        
        <div class="header">
            <h1>📦 FABRIC INVENTORY REPORT</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Arian Knit Fab | Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
        </div>
        
        <div class="filters">
            <strong>Filters:</strong> Status: {status or 'All'} | Supplier: {supplier or 'All'}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Lot Number</th>
                    <th>Supplier</th>
                    <th>Fabric Type</th>
                    <th>Color</th>
                    <th>Rolls</th>
                    <th>Total Qty (kg)</th>
                    <th>Used (kg)</th>
                    <th>Remaining (kg)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {generate_fabric_rows(lots, fabric_usage) if lots else '<tr><td colspan="9" style="text-align: center; padding: 20px;">No records found</td></tr>'}
            </tbody>
        </table>
        
        <div class="summary">
            <h3 style="margin: 0 0 20px 0; text-align: center;">INVENTORY SUMMARY</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Total Lots</div>
                    <div class="summary-value">{total_lots}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Rolls</div>
                    <div class="summary-value">{total_rolls}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">{total_quantity:.2f} kg</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Used</div>
                    <div class="summary-value">{total_used:.2f} kg</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Remaining</div>
                    <div class="summary-value">{total_remaining:.2f} kg</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@api_router.get("/reports/cutting", response_class=HTMLResponse)
async def get_cutting_report(
    start_date: str = None,
    end_date: str = None,
    cutting_master: str = None
):
    query = {}
    
    # Get all cutting orders first (dates are stored as strings)
    orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Get outsourcing and ironing data for status tracking
    outsourcing_orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    ironing_orders = await db.ironing_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Build status lookup for each cutting lot
    lot_status = {}
    for o in outsourcing_orders:
        lot_nums = o.get('lot_details', [])
        for lot in lot_nums:
            lot_num = lot.get('cutting_lot_number') or o.get('cutting_lot_number')
            if lot_num:
                current = lot_status.get(lot_num, {'outsourcing': [], 'ironing': None})
                current['outsourcing'].append({
                    'operation': o.get('operation_type'),
                    'status': o.get('status'),
                    'unit': o.get('unit_name')
                })
                lot_status[lot_num] = current
    
    for i in ironing_orders:
        lot_num = i.get('cutting_lot_number')
        if lot_num:
            if lot_num not in lot_status:
                lot_status[lot_num] = {'outsourcing': [], 'ironing': None}
            lot_status[lot_num]['ironing'] = {
                'status': i.get('status'),
                'unit': i.get('unit_name')
            }
    
    # Apply filters in Python since dates are strings
    if start_date and end_date:
        start = datetime.fromisoformat(start_date).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        filtered_orders = []
        for order in orders:
            order_date = datetime.fromisoformat(order['cutting_date']) if isinstance(order['cutting_date'], str) else order['cutting_date']
            if start <= order_date <= end:
                filtered_orders.append(order)
        orders = filtered_orders
    
    # Apply cutting master filter
    if cutting_master:
        orders = [o for o in orders if o.get('cutting_master_name') == cutting_master]
    
    # Convert dates
    for order in orders:
        if isinstance(order.get('cutting_date'), str):
            order['cutting_date'] = datetime.fromisoformat(order['cutting_date'])
    
    # Calculate totals
    total_quantity = sum(o.get('total_quantity', 0) for o in orders)
    total_fabric_cost = sum(o.get('total_fabric_cost', 0) for o in orders)
    total_cutting_cost = sum(o.get('total_cutting_amount', 0) for o in orders)
    total_paid = sum(o.get('amount_paid', 0) for o in orders)
    total_balance = sum(o.get('balance', 0) for o in orders)
    
    # Generate HTML report
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cutting Report</title>
        <style>
            @media print {{ @page {{ margin: 1cm; }} body {{ margin: 0; }} .no-print {{ display: none; }} }}
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }}
            .header h1 {{ margin: 0; color: #4F46E5; font-size: 28px; }}
            .filters {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #4F46E5; color: white; padding: 12px; text-align: left; font-size: 12px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }}
            tr:hover {{ background: #f5f5f5; }}
            .status-badge {{ padding: 4px 8px; border-radius: 4px; font-size: 10px; margin: 2px; display: inline-block; }}
            .status-cutting {{ background: #FEF3C7; color: #92400E; }}
            .status-outsourcing {{ background: #DBEAFE; color: #1E40AF; }}
            .status-received {{ background: #D1FAE5; color: #065F46; }}
            .status-ironing {{ background: #FDE68A; color: #92400E; }}
            .status-complete {{ background: #10B981; color: white; }}
            .summary {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }}
            .summary-item {{ text-align: center; }}
            .summary-label {{ font-size: 13px; opacity: 0.9; }}
            .summary-value {{ font-size: 24px; font-weight: bold; margin-top: 5px; }}
            .print-btn {{ background: #4F46E5; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
        
        <div class="header">
            <h1>CUTTING REPORT</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Report Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
        </div>
        
        <div class="filters">
            <strong>Filters Applied:</strong> 
            Date: {start_date or 'All'} to {end_date or 'All'} | 
            Master: {cutting_master or 'All'}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Lot Number</th>
                    <th>Date</th>
                    <th>Master</th>
                    <th>Category</th>
                    <th>Style</th>
                    <th>Qty</th>
                    <th>Current Status / Step</th>
                    <th>Cutting Cost</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
                {generate_cutting_rows(orders, lot_status) if orders else '<tr><td colspan="9" style="text-align: center; padding: 20px;">No records found</td></tr>'}
            </tbody>
        </table>
        
        <div class="summary">
            <h3 style="margin: 0 0 20px 0; text-align: center;">SUMMARY</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Total Orders</div>
                    <div class="summary-value">{len(orders)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">{total_quantity} pcs</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Fabric Cost</div>
                    <div class="summary-value">₹{total_fabric_cost:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Cutting Cost</div>
                    <div class="summary-value">₹{total_cutting_cost:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">₹{total_paid:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Balance</div>
                    <div class="summary-value">₹{total_balance:.2f}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@api_router.get("/reports/outsourcing", response_class=HTMLResponse)
async def get_outsourcing_report(
    start_date: str = None,
    end_date: str = None,
    unit_name: str = None,
    operation_type: str = None
):
    # Get all outsourcing orders first (dates are stored as strings)
    orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Apply filters in Python since dates are strings
    if start_date and end_date:
        start = datetime.fromisoformat(start_date).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        filtered_orders = []
        for order in orders:
            order_date = datetime.fromisoformat(order['dc_date']) if isinstance(order['dc_date'], str) else order['dc_date']
            if start <= order_date <= end:
                filtered_orders.append(order)
        orders = filtered_orders
    
    # Apply unit filter
    if unit_name:
        orders = [o for o in orders if o.get('unit_name') == unit_name]
    
    # Apply operation type filter
    if operation_type:
        orders = [o for o in orders if o.get('operation_type') == operation_type]
    
    # Convert dates
    for order in orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Get receipts for shortage calculation
    total_shortage_debit = 0
    total_shortage_pcs = 0
    for order in orders:
        receipts = await db.outsourcing_receipts.find({"outsourcing_order_id": order['id']}, {"_id": 0}).to_list(1000)
        order['receipts'] = receipts
        total_shortage_debit += sum(r.get('shortage_debit_amount', 0) for r in receipts)
        total_shortage_pcs += sum(r.get('total_shortage', 0) for r in receipts)
    
    # Calculate totals
    total_quantity = sum(o.get('total_quantity', 0) for o in orders)
    total_cost = sum(o.get('total_amount', 0) for o in orders)
    total_paid = sum(o.get('paid_amount', 0) for o in orders)
    total_balance = sum(o.get('total_amount', 0) - o.get('paid_amount', 0) for o in orders)
    
    # Generate HTML report
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Outsourcing Report</title>
        <style>
            @media print {{ @page {{ margin: 1cm; }} body {{ margin: 0; }} .no-print {{ display: none; }} }}
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; border-bottom: 3px solid #10B981; padding-bottom: 20px; margin-bottom: 30px; }}
            .header h1 {{ margin: 0; color: #10B981; font-size: 28px; }}
            .filters {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #10B981; color: white; padding: 12px; text-align: left; font-size: 12px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }}
            tr:hover {{ background: #f5f5f5; }}
            .summary {{ background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }}
            .summary-item {{ text-align: center; }}
            .summary-label {{ font-size: 13px; opacity: 0.9; }}
            .summary-value {{ font-size: 24px; font-weight: bold; margin-top: 5px; }}
            .print-btn {{ background: #10B981; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }}
            .op-badge {{ display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; background: #e0e0e0; }}
        </style>
    </head>
    <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
        
        <div class="header">
            <h1>OUTSOURCING REPORT</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Report Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
        </div>
        
        <div class="filters">
            <strong>Filters Applied:</strong> 
            Date: {start_date or 'All'} to {end_date or 'All'} | 
            Unit: {unit_name or 'All'} | 
            Operation: {operation_type or 'All'}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>DC Number</th>
                    <th>Date</th>
                    <th>Operation</th>
                    <th>Unit</th>
                    <th>Lot</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Shortage</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {''.join([f'''
                <tr>
                    <td><strong>{o.get('dc_number', 'N/A')}</strong></td>
                    <td>{o.get('dc_date').strftime('%d %b %Y') if o.get('dc_date') else 'N/A'}</td>
                    <td><span class="op-badge">{o.get('operation_type', 'N/A')}</span></td>
                    <td>{o.get('unit_name', 'N/A')}</td>
                    <td>{o.get('cutting_lot_number', 'N/A')}</td>
                    <td><strong>{o.get('total_quantity', 0)}</strong></td>
                    <td>₹{o.get('rate_per_pcs', 0):.2f}</td>
                    <td>₹{o.get('total_amount', 0):.2f}</td>
                    <td style="color: red;">{sum(r.get('total_shortage', 0) for r in o.get('receipts', []))} pcs</td>
                    <td>{o.get('status', 'N/A')}</td>
                </tr>
                ''' for o in orders]) if orders else '<tr><td colspan="10" style="text-align: center; padding: 20px;">No records found</td></tr>'}
            </tbody>
        </table>
        
        <div class="summary">
            <h3 style="margin: 0 0 20px 0; text-align: center;">SUMMARY</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Total Orders</div>
                    <div class="summary-value">{len(orders)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">{total_quantity} pcs</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Cost</div>
                    <div class="summary-value">₹{total_cost:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">₹{total_paid:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Balance</div>
                    <div class="summary-value">₹{total_balance:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Shortage Debit</div>
                    <div class="summary-value">₹{total_shortage_debit:.2f}</div>
                    <div class="summary-label" style="margin-top: 5px; font-size: 11px;">{total_shortage_pcs} pcs</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@api_router.get("/reports/ironing", response_class=HTMLResponse)
async def get_ironing_report(
    start_date: str = None,
    end_date: str = None,
    unit_name: str = None
):
    # Get all ironing orders first (dates are stored as strings)
    orders = await db.ironing_orders.find({}, {"_id": 0}).to_list(1000)
    
    # Apply filters in Python since dates are strings
    if start_date and end_date:
        start = datetime.fromisoformat(start_date).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        filtered_orders = []
        for order in orders:
            order_date = datetime.fromisoformat(order['dc_date']) if isinstance(order['dc_date'], str) else order['dc_date']
            if start <= order_date <= end:
                filtered_orders.append(order)
        orders = filtered_orders
    
    # Apply unit filter
    if unit_name:
        orders = [o for o in orders if o.get('unit_name') == unit_name]
    
    # Convert dates
    for order in orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Get receipts for shortage calculation
    total_shortage_debit = 0
    total_shortage_pcs = 0
    for order in orders:
        receipts = await db.ironing_receipts.find({"ironing_order_id": order['id']}, {"_id": 0}).to_list(1000)
        order['receipts'] = receipts
        total_shortage_debit += sum(r.get('shortage_debit_amount', 0) for r in receipts)
        total_shortage_pcs += sum(r.get('total_shortage', 0) for r in receipts)
    
    # Calculate totals
    total_quantity = sum(o.get('total_quantity', 0) for o in orders)
    total_cost = sum(o.get('total_amount', 0) for o in orders)
    total_paid = sum(o.get('amount_paid', 0) for o in orders)
    total_balance = sum(o.get('balance', 0) for o in orders)
    
    # Generate HTML report
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ironing Report</title>
        <style>
            @media print {{ @page {{ margin: 1cm; }} body {{ margin: 0; }} .no-print {{ display: none; }} }}
            body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }}
            .header {{ text-align: center; border-bottom: 3px solid #F59E0B; padding-bottom: 20px; margin-bottom: 30px; }}
            .header h1 {{ margin: 0; color: #F59E0B; font-size: 28px; }}
            .filters {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #F59E0B; color: white; padding: 12px; text-align: left; font-size: 12px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }}
            tr:hover {{ background: #f5f5f5; }}
            .summary {{ background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }}
            .summary-item {{ text-align: center; }}
            .summary-label {{ font-size: 13px; opacity: 0.9; }}
            .summary-value {{ font-size: 24px; font-weight: bold; margin-top: 5px; }}
            .print-btn {{ background: #F59E0B; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
        
        <div class="header">
            <h1>IRONING REPORT</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Report Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %I:%M %p')}</p>
        </div>
        
        <div class="filters">
            <strong>Filters Applied:</strong> 
            Date: {start_date or 'All'} to {end_date or 'All'} | 
            Unit: {unit_name or 'All'}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>DC Number</th>
                    <th>Date</th>
                    <th>Unit</th>
                    <th>Lot</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Shortage</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {''.join([f'''
                <tr>
                    <td><strong>{o.get('dc_number', 'N/A')}</strong></td>
                    <td>{o.get('dc_date').strftime('%d %b %Y') if o.get('dc_date') else 'N/A'}</td>
                    <td>{o.get('unit_name', 'N/A')}</td>
                    <td>{o.get('cutting_lot_number', 'N/A')}</td>
                    <td>{o.get('category', 'N/A')}</td>
                    <td><strong>{o.get('total_quantity', 0)}</strong></td>
                    <td>₹{o.get('rate_per_pcs', 0):.2f}</td>
                    <td>₹{o.get('total_amount', 0):.2f}</td>
                    <td style="color: red;">{sum(r.get('total_shortage', 0) for r in o.get('receipts', []))} pcs</td>
                    <td>{o.get('status', 'N/A')}</td>
                </tr>
                ''' for o in orders]) if orders else '<tr><td colspan="10" style="text-align: center; padding: 20px;">No records found</td></tr>'}
            </tbody>
        </table>
        
        <div class="summary">
            <h3 style="margin: 0 0 20px 0; text-align: center;">SUMMARY</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Total Orders</div>
                    <div class="summary-value">{len(orders)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">{total_quantity} pcs</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Cost</div>
                    <div class="summary-value">₹{total_cost:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">₹{total_paid:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Balance</div>
                    <div class="summary-value">₹{total_balance:.2f}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Shortage Debit</div>
                    <div class="summary-value">₹{total_shortage_debit:.2f}</div>
                    <div class="summary-label" style="margin-top: 5px; font-size: 11px;">{total_shortage_pcs} pcs</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


# ==================== NEW COMPREHENSIVE REPORTS ====================

# Stock Report - Summary, Movement, Low Stock
@api_router.get("/reports/stock")
async def get_stock_report(
    format: str = "html",  # html or csv
    category: Optional[str] = None,
    low_stock_threshold: int = 50
):
    """Generate comprehensive stock report"""
    query = {}
    if category:
        query["category"] = category
    
    stocks = await db.stock.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_quantity = sum(s.get('total_quantity', 0) for s in stocks)
    total_available = sum(s.get('available_quantity', 0) for s in stocks)
    total_dispatched = total_quantity - total_available
    low_stock_items = [s for s in stocks if s.get('available_quantity', 0) < low_stock_threshold and s.get('available_quantity', 0) > 0]
    out_of_stock = [s for s in stocks if s.get('available_quantity', 0) == 0]
    
    # Category-wise summary
    category_summary = {}
    for s in stocks:
        cat = s.get('category', 'Unknown')
        if cat not in category_summary:
            category_summary[cat] = {'total': 0, 'available': 0, 'items': 0}
        category_summary[cat]['total'] += s.get('total_quantity', 0)
        category_summary[cat]['available'] += s.get('available_quantity', 0)
        category_summary[cat]['items'] += 1
    
    if format == "csv":
        # Generate CSV
        csv_content = "Stock Code,Lot Number,Category,Style,Color,Total Qty,Available,Dispatched,Master Packs,Loose Pcs,Status\n"
        for s in stocks:
            status = "Out of Stock" if s.get('available_quantity', 0) == 0 else ("Low Stock" if s.get('available_quantity', 0) < low_stock_threshold else "In Stock")
            csv_content += f"{s.get('stock_code','')},{s.get('lot_number','')},{s.get('category','')},{s.get('style_type','')},{s.get('color','')},{s.get('total_quantity',0)},{s.get('available_quantity',0)},{s.get('total_quantity',0)-s.get('available_quantity',0)},{s.get('complete_packs',0)},{s.get('loose_pieces',0)},{status}\n"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=stock_report.csv"}
        )
    
    # Generate HTML
    stock_rows = ""
    for s in stocks:
        status = "Out of Stock" if s.get('available_quantity', 0) == 0 else ("Low Stock" if s.get('available_quantity', 0) < low_stock_threshold else "In Stock")
        status_class = "out-of-stock" if status == "Out of Stock" else ("low-stock" if status == "Low Stock" else "in-stock")
        sizes = ", ".join([f"{k}:{v}" for k, v in s.get('size_distribution', {}).items() if v > 0])
        stock_rows += f"""
        <tr class="{status_class}">
            <td><strong>{s.get('stock_code', '')}</strong></td>
            <td>{s.get('lot_number', '')}</td>
            <td>{s.get('category', '')}</td>
            <td>{s.get('style_type', '')}</td>
            <td>{s.get('color', '')}</td>
            <td class="text-right">{s.get('total_quantity', 0)}</td>
            <td class="text-right"><strong>{s.get('available_quantity', 0)}</strong></td>
            <td class="text-right">{s.get('total_quantity', 0) - s.get('available_quantity', 0)}</td>
            <td>{sizes}</td>
            <td><span class="status-badge {status_class}">{status}</span></td>
        </tr>
        """
    
    category_rows = ""
    for cat, data in category_summary.items():
        category_rows += f"""
        <tr>
            <td><strong>{cat}</strong></td>
            <td class="text-right">{data['items']}</td>
            <td class="text-right">{data['total']}</td>
            <td class="text-right">{data['available']}</td>
            <td class="text-right">{data['total'] - data['available']}</td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Stock Report - Arian Knit Fab</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
            .header {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            .header h1 {{ margin: 0; color: #4F46E5; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }}
            .summary-card {{ padding: 15px; border-radius: 8px; text-align: center; }}
            .summary-card.total {{ background: #e0e7ff; border: 1px solid #818cf8; }}
            .summary-card.available {{ background: #d1fae5; border: 1px solid #34d399; }}
            .summary-card.dispatched {{ background: #fef3c7; border: 1px solid #fbbf24; }}
            .summary-card.low {{ background: #fee2e2; border: 1px solid #f87171; }}
            .summary-card h3 {{ margin: 0; font-size: 24px; }}
            .summary-card p {{ margin: 5px 0 0 0; color: #666; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #4F46E5; color: white; }}
            .text-right {{ text-align: right; }}
            .status-badge {{ padding: 2px 8px; border-radius: 4px; font-size: 10px; }}
            .in-stock {{ background: #d1fae5; color: #065f46; }}
            .low-stock {{ background: #fef3c7; color: #92400e; }}
            .out-of-stock {{ background: #fee2e2; color: #991b1b; }}
            tr.low-stock {{ background: #fffbeb; }}
            tr.out-of-stock {{ background: #fef2f2; }}
            .section-title {{ margin: 20px 0 10px 0; padding: 10px; background: #f3f4f6; border-left: 4px solid #4F46E5; }}
            @media print {{ .no-print {{ display: none; }} }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📦 Stock Report</h1>
            <p>Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card total">
                <h3>{total_quantity}</h3>
                <p>Total Stock (pcs)</p>
            </div>
            <div class="summary-card available">
                <h3>{total_available}</h3>
                <p>Available (pcs)</p>
            </div>
            <div class="summary-card dispatched">
                <h3>{total_dispatched}</h3>
                <p>Dispatched (pcs)</p>
            </div>
            <div class="summary-card low">
                <h3>{len(low_stock_items)} / {len(out_of_stock)}</h3>
                <p>Low Stock / Out of Stock</p>
            </div>
        </div>
        
        <h3 class="section-title">📊 Category-wise Summary</h3>
        <table>
            <thead>
                <tr><th>Category</th><th>Items</th><th>Total Qty</th><th>Available</th><th>Dispatched</th></tr>
            </thead>
            <tbody>{category_rows}</tbody>
        </table>
        
        <h3 class="section-title">📋 Stock Details ({len(stocks)} items)</h3>
        <table>
            <thead>
                <tr><th>Stock Code</th><th>Lot Name</th><th>Category</th><th>Style</th><th>Color</th><th>Total</th><th>Available</th><th>Dispatched</th><th>Sizes</th><th>Status</th></tr>
            </thead>
            <tbody>{stock_rows}</tbody>
        </table>
        
        <div style="text-align:center;margin-top:20px;color:#666;">
            Arian Knit Fab Production Pro | Stock Report
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Dispatch Report - Customer-wise, Date-wise
@api_router.get("/reports/dispatch")
async def get_dispatch_report(
    format: str = "html",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    customer_name: Optional[str] = None
):
    """Generate dispatch report with filters"""
    query = {}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["dispatch_date"] = date_query
    
    if customer_name:
        query["customer_name"] = {"$regex": customer_name, "$options": "i"}
    
    dispatches = await db.bulk_dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate totals
    total_dispatches = len(dispatches)
    total_items = sum(d.get('total_items', 0) for d in dispatches)
    total_quantity = sum(d.get('grand_total_quantity', 0) for d in dispatches)
    
    # Customer-wise summary
    customer_summary = {}
    for d in dispatches:
        cust = d.get('customer_name', 'Unknown')
        if cust not in customer_summary:
            customer_summary[cust] = {'dispatches': 0, 'items': 0, 'quantity': 0}
        customer_summary[cust]['dispatches'] += 1
        customer_summary[cust]['items'] += d.get('total_items', 0)
        customer_summary[cust]['quantity'] += d.get('grand_total_quantity', 0)
    
    if format == "csv":
        csv_content = "Dispatch No,Date,Customer,Bora No,Items,Total Qty,Notes,Remarks\n"
        for d in dispatches:
            date_str = d.get('dispatch_date', '')[:10] if d.get('dispatch_date') else ''
            csv_content += f"{d.get('dispatch_number','')},{date_str},{d.get('customer_name','')},{d.get('bora_number','')},{d.get('total_items',0)},{d.get('grand_total_quantity',0)},{d.get('notes','')},{d.get('remarks','')}\n"
        
        # Add item details
        csv_content += "\n\nDISPATCH ITEM DETAILS\n"
        csv_content += "Dispatch No,Stock Code,Lot Name,Category,Color,Master Packs,Total Qty\n"
        for d in dispatches:
            for item in d.get('items', []):
                csv_content += f"{d.get('dispatch_number','')},{item.get('stock_code','')},{item.get('lot_number','')},{item.get('category','')},{item.get('color','')},{item.get('master_packs',0)},{item.get('total_quantity',0)}\n"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=dispatch_report.csv"}
        )
    
    # Generate HTML
    dispatch_rows = ""
    for d in dispatches:
        date_str = d.get('dispatch_date', '')[:10] if d.get('dispatch_date') else ''
        items_preview = ", ".join([f"{i.get('stock_code','')}({i.get('total_quantity',0)})" for i in d.get('items', [])[:3]])
        if len(d.get('items', [])) > 3:
            items_preview += f" +{len(d.get('items', [])) - 3} more"
        dispatch_rows += f"""
        <tr>
            <td><strong>{d.get('dispatch_number', '')}</strong></td>
            <td>{date_str}</td>
            <td>{d.get('customer_name', '')}</td>
            <td>{d.get('bora_number', '')}</td>
            <td class="text-right">{d.get('total_items', 0)}</td>
            <td class="text-right"><strong>{d.get('grand_total_quantity', 0)}</strong></td>
            <td style="font-size:10px;">{items_preview}</td>
        </tr>
        """
    
    customer_rows = ""
    for cust, data in sorted(customer_summary.items(), key=lambda x: x[1]['quantity'], reverse=True):
        customer_rows += f"""
        <tr>
            <td><strong>{cust}</strong></td>
            <td class="text-right">{data['dispatches']}</td>
            <td class="text-right">{data['items']}</td>
            <td class="text-right"><strong>{data['quantity']}</strong></td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dispatch Report - Arian Knit Fab</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
            .header {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            .header h1 {{ margin: 0; color: #059669; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }}
            .summary-card {{ padding: 15px; border-radius: 8px; text-align: center; background: #d1fae5; border: 1px solid #34d399; }}
            .summary-card h3 {{ margin: 0; font-size: 24px; color: #065f46; }}
            .summary-card p {{ margin: 5px 0 0 0; color: #666; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #059669; color: white; }}
            .text-right {{ text-align: right; }}
            .section-title {{ margin: 20px 0 10px 0; padding: 10px; background: #f3f4f6; border-left: 4px solid #059669; }}
            .filter-info {{ background: #f0fdf4; padding: 10px; border-radius: 4px; margin-bottom: 15px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚚 Dispatch Report</h1>
            <p>Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}</p>
        </div>
        
        <div class="filter-info">
            <strong>Filters:</strong> 
            {f"From: {start_date}" if start_date else ""} 
            {f"To: {end_date}" if end_date else ""} 
            {f"Customer: {customer_name}" if customer_name else ""}
            {" (No filters applied)" if not start_date and not end_date and not customer_name else ""}
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <h3>{total_dispatches}</h3>
                <p>Total Dispatches</p>
            </div>
            <div class="summary-card">
                <h3>{total_items}</h3>
                <p>Total Items</p>
            </div>
            <div class="summary-card">
                <h3>{total_quantity}</h3>
                <p>Total Quantity (pcs)</p>
            </div>
        </div>
        
        <h3 class="section-title">👤 Customer-wise Summary</h3>
        <table>
            <thead>
                <tr><th>Customer</th><th>Dispatches</th><th>Items</th><th>Total Qty</th></tr>
            </thead>
            <tbody>{customer_rows}</tbody>
        </table>
        
        <h3 class="section-title">📋 Dispatch Details ({total_dispatches} dispatches)</h3>
        <table>
            <thead>
                <tr><th>Dispatch No</th><th>Date</th><th>Customer</th><th>Bora No</th><th>Items</th><th>Total Qty</th><th>Items Preview</th></tr>
            </thead>
            <tbody>{dispatch_rows}</tbody>
        </table>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Catalogue Report
@api_router.get("/reports/catalogue")
async def get_catalogue_report(format: str = "html"):
    """Generate catalogue performance report"""
    catalogs = await db.catalogs.find({}, {"_id": 0}).to_list(1000)
    
    total_catalogs = len(catalogs)
    total_quantity = sum(c.get('total_quantity', 0) for c in catalogs)
    total_available = sum(c.get('available_stock', 0) for c in catalogs)
    total_dispatched = total_quantity - total_available
    
    if format == "csv":
        csv_content = "Catalog Name,Catalog Code,Category,Color,Total Qty,Available,Dispatched,Lots Count,Description\n"
        for c in catalogs:
            csv_content += f"{c.get('catalog_name','')},{c.get('catalog_code','')},{c.get('category','')},{c.get('color','')},{c.get('total_quantity',0)},{c.get('available_stock',0)},{c.get('total_quantity',0)-c.get('available_stock',0)},{len(c.get('lot_numbers',[]))},{c.get('description','')}\n"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=catalogue_report.csv"}
        )
    
    # Generate HTML
    catalog_rows = ""
    for c in catalogs:
        dispatched = c.get('total_quantity', 0) - c.get('available_stock', 0)
        dispatch_pct = (dispatched / c.get('total_quantity', 1)) * 100 if c.get('total_quantity', 0) > 0 else 0
        status = "Fully Dispatched" if c.get('available_stock', 0) == 0 else ("High Demand" if dispatch_pct > 50 else "Available")
        status_class = "dispatched" if status == "Fully Dispatched" else ("high-demand" if status == "High Demand" else "available")
        catalog_rows += f"""
        <tr>
            <td><strong>{c.get('catalog_name', '')}</strong></td>
            <td>{c.get('catalog_code', '')}</td>
            <td>{c.get('category', '')}</td>
            <td>{c.get('color', '')}</td>
            <td class="text-right">{c.get('total_quantity', 0)}</td>
            <td class="text-right">{c.get('available_stock', 0)}</td>
            <td class="text-right">{dispatched}</td>
            <td class="text-right">{dispatch_pct:.0f}%</td>
            <td>{len(c.get('lot_numbers', []))}</td>
            <td><span class="status-badge {status_class}">{status}</span></td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Catalogue Report - Arian Knit Fab</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
            .header {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            .header h1 {{ margin: 0; color: #7c3aed; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }}
            .summary-card {{ padding: 15px; border-radius: 8px; text-align: center; background: #ede9fe; border: 1px solid #a78bfa; }}
            .summary-card h3 {{ margin: 0; font-size: 24px; color: #5b21b6; }}
            .summary-card p {{ margin: 5px 0 0 0; color: #666; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #7c3aed; color: white; }}
            .text-right {{ text-align: right; }}
            .status-badge {{ padding: 2px 8px; border-radius: 4px; font-size: 10px; }}
            .available {{ background: #d1fae5; color: #065f46; }}
            .high-demand {{ background: #fef3c7; color: #92400e; }}
            .dispatched {{ background: #fee2e2; color: #991b1b; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📚 Catalogue Report</h1>
            <p>Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <h3>{total_catalogs}</h3>
                <p>Total Catalogues</p>
            </div>
            <div class="summary-card">
                <h3>{total_quantity}</h3>
                <p>Total Quantity</p>
            </div>
            <div class="summary-card">
                <h3>{total_available}</h3>
                <p>Available</p>
            </div>
            <div class="summary-card">
                <h3>{total_dispatched}</h3>
                <p>Dispatched</p>
            </div>
        </div>
        
        <table>
            <thead>
                <tr><th>Catalogue Name</th><th>Code</th><th>Category</th><th>Color</th><th>Total</th><th>Available</th><th>Dispatched</th><th>Dispatch %</th><th>Lots</th><th>Status</th></tr>
            </thead>
            <tbody>{catalog_rows}</tbody>
        </table>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_lots = await db.fabric_lots.count_documents({})
    total_cutting_orders = await db.cutting_orders.count_documents({})
    total_outsourcing_orders = await db.outsourcing_orders.count_documents({})
    pending_outsourcing = await db.outsourcing_orders.count_documents({"status": "Sent"})
    total_ironing_orders = await db.ironing_orders.count_documents({})
    pending_ironing = await db.ironing_orders.count_documents({"status": "Sent"})
    
    # Calculate total fabric in stock
    lots = await db.fabric_lots.find({}, {"_id": 0, "remaining_quantity": 1, "remaining_rib_quantity": 1}).to_list(1000)
    total_fabric_stock = sum(lot.get('remaining_quantity', 0) for lot in lots)
    total_rib_stock = sum(lot.get('remaining_rib_quantity', 0) for lot in lots)
    
    # Calculate total production by category
    orders = await db.cutting_orders.find({}, {"_id": 0, "category": 1, "total_quantity": 1, "total_fabric_cost": 1, "total_cutting_amount": 1}).to_list(1000)
    kids_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Kids')
    mens_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Mens')
    women_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Women')
    total_production_cost = sum(o.get('total_fabric_cost', 0) for o in orders)
    total_cutting_cost = sum(o.get('total_cutting_amount', 0) for o in orders)
    
    # Calculate outsourcing costs and shortages
    outsourcing_orders = await db.outsourcing_orders.find({}, {"_id": 0, "total_amount": 1}).to_list(1000)
    total_outsourcing_cost = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    
    receipts = await db.outsourcing_receipts.find({}, {"_id": 0, "shortage_debit_amount": 1, "total_shortage": 1}).to_list(1000)
    total_shortage_debit = sum(r.get('shortage_debit_amount', 0) for r in receipts)
    total_shortage_pcs = sum(r.get('total_shortage', 0) for r in receipts)
    
    # Calculate ironing costs
    ironing_orders = await db.ironing_orders.find({}, {"_id": 0, "total_amount": 1}).to_list(1000)
    total_ironing_cost = sum(o.get('total_amount', 0) for o in ironing_orders)
    
    ironing_receipts = await db.ironing_receipts.find({}, {"_id": 0, "shortage_debit_amount": 1, "total_shortage": 1}).to_list(1000)
    total_ironing_shortage_debit = sum(r.get('shortage_debit_amount', 0) for r in ironing_receipts)
    total_ironing_shortage_pcs = sum(r.get('total_shortage', 0) for r in ironing_receipts)
    
    # Calculate comprehensive total amount
    # Total Amount = Fabric Cost + Cutting Cost + Outsourcing Cost + Ironing Cost - Shortage Debit - Ironing Shortage Debit
    comprehensive_total = (total_production_cost + total_cutting_cost + total_outsourcing_cost + total_ironing_cost) - total_shortage_debit - total_ironing_shortage_debit
    
    return {
        "total_lots": total_lots,
        "total_fabric_stock": round(total_fabric_stock, 2),
        "total_rib_stock": round(total_rib_stock, 2),
        "total_cutting_orders": total_cutting_orders,
        "kids_production": kids_qty,
        "mens_production": mens_qty,
        "women_production": women_qty,
        "total_production_cost": round(total_production_cost, 2),
        "total_cutting_cost": round(total_cutting_cost, 2),
        "total_outsourcing_orders": total_outsourcing_orders,
        "pending_outsourcing": pending_outsourcing,
        "total_outsourcing_cost": round(total_outsourcing_cost, 2),
        "total_shortage_debit": round(total_shortage_debit, 2),
        "total_shortage_pcs": total_shortage_pcs,
        "total_ironing_orders": total_ironing_orders,
        "pending_ironing": pending_ironing,
        "total_ironing_cost": round(total_ironing_cost, 2),
        "total_ironing_shortage_debit": round(total_ironing_shortage_debit, 2),
        "total_ironing_shortage_pcs": total_ironing_shortage_pcs,
        "comprehensive_total": round(comprehensive_total, 2)
    }


# ==================== ANALYTICS & NOTIFICATIONS ====================

@api_router.get("/dashboard/analytics")
async def get_dashboard_analytics():
    """Get analytics data for charts"""
    
    # Category-wise production data
    cutting_orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    category_data = {}
    for order in cutting_orders:
        cat = order.get('category', 'Unknown')
        if cat not in category_data:
            category_data[cat] = {'quantity': 0, 'cost': 0}
        category_data[cat]['quantity'] += order.get('total_quantity', 0)
        category_data[cat]['cost'] += order.get('total_fabric_cost', 0) + order.get('total_cutting_amount', 0)
    
    production_by_category = [
        {'name': cat, 'quantity': data['quantity'], 'cost': round(data['cost'], 2)}
        for cat, data in category_data.items()
    ]
    
    # Stock status data
    stocks = await db.stock.find({}, {"_id": 0}).to_list(1000)
    in_stock = sum(1 for s in stocks if s.get('available_quantity', 0) >= 50)
    low_stock = sum(1 for s in stocks if 0 < s.get('available_quantity', 0) < 50)
    out_of_stock = sum(1 for s in stocks if s.get('available_quantity', 0) == 0)
    
    stock_status_data = [
        {'name': 'In Stock', 'value': in_stock, 'color': '#10B981'},
        {'name': 'Low Stock', 'value': low_stock, 'color': '#F59E0B'},
        {'name': 'Out of Stock', 'value': out_of_stock, 'color': '#EF4444'}
    ]
    
    # Dispatch trend (last 7 days)
    dispatches = await db.bulk_dispatches.find({}, {"_id": 0}).to_list(1000)
    dispatch_by_date = {}
    for d in dispatches:
        date_str = d.get('dispatch_date', '')[:10] if d.get('dispatch_date') else ''
        if date_str:
            if date_str not in dispatch_by_date:
                dispatch_by_date[date_str] = {'quantity': 0, 'dispatches': 0}
            dispatch_by_date[date_str]['quantity'] += d.get('grand_total_quantity', 0)
            dispatch_by_date[date_str]['dispatches'] += 1
    
    dispatch_trend = [
        {'date': date, 'quantity': data['quantity'], 'dispatches': data['dispatches']}
        for date, data in sorted(dispatch_by_date.items())[-7:]
    ]
    
    # Cost breakdown
    outsourcing_orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    ironing_orders = await db.ironing_orders.find({}, {"_id": 0}).to_list(1000)
    
    total_fabric_cost = sum(o.get('total_fabric_cost', 0) for o in cutting_orders)
    total_cutting_cost = sum(o.get('total_cutting_amount', 0) for o in cutting_orders)
    total_outsourcing_cost = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    total_ironing_cost = sum(o.get('total_amount', 0) for o in ironing_orders)
    
    cost_breakdown = [
        {'name': 'Fabric', 'value': round(total_fabric_cost, 2), 'color': '#6366F1'},
        {'name': 'Cutting', 'value': round(total_cutting_cost, 2), 'color': '#3B82F6'},
        {'name': 'Outsourcing', 'value': round(total_outsourcing_cost, 2), 'color': '#8B5CF6'},
        {'name': 'Ironing', 'value': round(total_ironing_cost, 2), 'color': '#F59E0B'}
    ]
    
    # Operation-wise outsourcing
    operation_data = {}
    for o in outsourcing_orders:
        op = o.get('operation_type', 'Unknown')
        if op not in operation_data:
            operation_data[op] = {'quantity': 0, 'cost': 0}
        operation_data[op]['quantity'] += o.get('total_quantity', 0)
        operation_data[op]['cost'] += o.get('total_amount', 0)
    
    outsourcing_by_operation = [
        {'name': op, 'quantity': data['quantity'], 'cost': round(data['cost'], 2)}
        for op, data in operation_data.items()
    ]
    
    return {
        "production_by_category": production_by_category,
        "stock_status": stock_status_data,
        "dispatch_trend": dispatch_trend,
        "cost_breakdown": cost_breakdown,
        "outsourcing_by_operation": outsourcing_by_operation
    }


@api_router.get("/dashboard/notifications")
async def get_notifications():
    """Get system notifications and alerts"""
    notifications = []
    
    # Low stock alerts
    stocks = await db.stock.find({}, {"_id": 0}).to_list(1000)
    for stock in stocks:
        if 0 < stock.get('available_quantity', 0) < 50:
            notifications.append({
                "type": "warning",
                "title": "Low Stock Alert",
                "message": f"{stock.get('stock_code')}: {stock.get('lot_number')} has only {stock.get('available_quantity')} pcs left",
                "category": "stock"
            })
        elif stock.get('available_quantity', 0) == 0:
            notifications.append({
                "type": "error",
                "title": "Out of Stock",
                "message": f"{stock.get('stock_code')}: {stock.get('lot_number')} is out of stock",
                "category": "stock"
            })
    
    # Pending outsourcing (overdue > 7 days)
    from datetime import timedelta
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    pending_outsourcing = await db.outsourcing_orders.find(
        {"status": "Sent"},
        {"_id": 0}
    ).to_list(1000)
    
    for order in pending_outsourcing:
        dc_date = order.get('dc_date')
        if dc_date:
            if isinstance(dc_date, str):
                try:
                    dc_date = datetime.fromisoformat(dc_date.replace('Z', '+00:00'))
                except:
                    continue
            if dc_date < seven_days_ago:
                notifications.append({
                    "type": "warning",
                    "title": "Overdue Outsourcing",
                    "message": f"DC {order.get('dc_number')} to {order.get('unit_name')} is pending for over 7 days",
                    "category": "outsourcing"
                })
    
    # Pending ironing
    pending_ironing = await db.ironing_orders.find(
        {"status": "Sent"},
        {"_id": 0}
    ).to_list(1000)
    
    for order in pending_ironing:
        dc_date = order.get('dc_date')
        if dc_date:
            if isinstance(dc_date, str):
                try:
                    dc_date = datetime.fromisoformat(dc_date.replace('Z', '+00:00'))
                except:
                    continue
            if dc_date < seven_days_ago:
                notifications.append({
                    "type": "warning",
                    "title": "Overdue Ironing",
                    "message": f"DC {order.get('dc_number')} to {order.get('unit_name')} is pending for over 7 days",
                    "category": "ironing"
                })
    
    # Unpaid bills alerts
    unpaid_outsourcing = await db.outsourcing_orders.find(
        {"payment_status": "Unpaid", "balance": {"$gt": 1000}},
        {"_id": 0}
    ).to_list(100)
    
    for order in unpaid_outsourcing[:5]:  # Limit to 5
        notifications.append({
            "type": "info",
            "title": "Pending Payment",
            "message": f"₹{order.get('balance', 0)} pending for {order.get('unit_name')} ({order.get('dc_number')})",
            "category": "payment"
        })
    
    return {
        "notifications": notifications,
        "total": len(notifications),
        "by_type": {
            "error": sum(1 for n in notifications if n['type'] == 'error'),
            "warning": sum(1 for n in notifications if n['type'] == 'warning'),
            "info": sum(1 for n in notifications if n['type'] == 'info')
        }
    }


@api_router.get("/reports/profit-loss")
async def get_profit_loss_report(format: str = "html"):
    """Generate profit/loss report based on costs and dispatches"""
    
    # Get all costs
    cutting_orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    outsourcing_orders = await db.outsourcing_orders.find({}, {"_id": 0}).to_list(1000)
    ironing_orders = await db.ironing_orders.find({}, {"_id": 0}).to_list(1000)
    receipts = await db.outsourcing_receipts.find({}, {"_id": 0}).to_list(1000)
    ironing_receipts = await db.ironing_receipts.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate total costs
    fabric_cost = sum(o.get('total_fabric_cost', 0) for o in cutting_orders)
    cutting_cost = sum(o.get('total_cutting_amount', 0) for o in cutting_orders)
    outsourcing_cost = sum(o.get('total_amount', 0) for o in outsourcing_orders)
    ironing_cost = sum(o.get('total_amount', 0) for o in ironing_orders)
    
    # Shortage deductions
    outsourcing_shortage = sum(r.get('shortage_debit_amount', 0) for r in receipts)
    ironing_shortage = sum(r.get('shortage_debit_amount', 0) for r in ironing_receipts)
    total_shortage_deduction = outsourcing_shortage + ironing_shortage
    
    total_cost = fabric_cost + cutting_cost + outsourcing_cost + ironing_cost - total_shortage_deduction
    
    # Get total production
    total_pieces_produced = sum(o.get('total_quantity', 0) for o in cutting_orders)
    
    # Calculate cost per piece
    cost_per_piece = total_cost / total_pieces_produced if total_pieces_produced > 0 else 0
    
    # Get dispatches (potential revenue indicator)
    dispatches = await db.bulk_dispatches.find({}, {"_id": 0}).to_list(1000)
    total_dispatched = sum(d.get('grand_total_quantity', 0) for d in dispatches)
    
    # Stock value
    stocks = await db.stock.find({}, {"_id": 0}).to_list(1000)
    total_stock_quantity = sum(s.get('available_quantity', 0) for s in stocks)
    estimated_stock_value = total_stock_quantity * cost_per_piece
    
    if format == "csv":
        csv_content = "Category,Amount\n"
        csv_content += f"Fabric Cost,{fabric_cost}\n"
        csv_content += f"Cutting Cost,{cutting_cost}\n"
        csv_content += f"Outsourcing Cost,{outsourcing_cost}\n"
        csv_content += f"Ironing Cost,{ironing_cost}\n"
        csv_content += f"Shortage Deduction,-{total_shortage_deduction}\n"
        csv_content += f"Total Cost,{total_cost}\n"
        csv_content += f"Total Pieces Produced,{total_pieces_produced}\n"
        csv_content += f"Cost Per Piece,{cost_per_piece}\n"
        csv_content += f"Total Dispatched,{total_dispatched}\n"
        csv_content += f"Current Stock,{total_stock_quantity}\n"
        csv_content += f"Estimated Stock Value,{estimated_stock_value}\n"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=profit_loss_report.csv"}
        )
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Profit & Loss Report - Arian Knit Fab</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
            .header {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            .header h1 {{ margin: 0; color: #059669; }}
            .section {{ margin-bottom: 30px; }}
            .section-title {{ background: #f3f4f6; padding: 10px; border-left: 4px solid #059669; margin-bottom: 15px; font-weight: bold; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
            th {{ background-color: #059669; color: white; }}
            .amount {{ text-align: right; font-family: monospace; }}
            .total-row {{ background: #d1fae5; font-weight: bold; }}
            .deduction {{ color: #dc2626; }}
            .highlight {{ background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
            .highlight h2 {{ margin: 0; font-size: 24px; }}
            .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }}
            .card {{ background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #86efac; text-align: center; }}
            .card h3 {{ margin: 0; font-size: 24px; color: #059669; }}
            .card p {{ margin: 5px 0 0 0; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>💰 Profit & Loss Report</h1>
            <p>Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}</p>
        </div>
        
        <div class="section">
            <div class="section-title">📊 Cost Breakdown</div>
            <table>
                <tr><th>Category</th><th class="amount">Amount (₹)</th></tr>
                <tr><td>Fabric Cost</td><td class="amount">{fabric_cost:,.2f}</td></tr>
                <tr><td>Cutting Cost</td><td class="amount">{cutting_cost:,.2f}</td></tr>
                <tr><td>Outsourcing Cost</td><td class="amount">{outsourcing_cost:,.2f}</td></tr>
                <tr><td>Ironing Cost</td><td class="amount">{ironing_cost:,.2f}</td></tr>
                <tr class="deduction"><td>Less: Shortage Deduction</td><td class="amount">-{total_shortage_deduction:,.2f}</td></tr>
                <tr class="total-row"><td><strong>Total Cost</strong></td><td class="amount"><strong>₹{total_cost:,.2f}</strong></td></tr>
            </table>
        </div>
        
        <div class="highlight">
            <h2>Cost Per Piece: ₹{cost_per_piece:.2f}</h2>
            <p>Based on {total_pieces_produced:,} pieces produced</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>{total_pieces_produced:,}</h3>
                <p>Total Produced</p>
            </div>
            <div class="card">
                <h3>{total_dispatched:,}</h3>
                <p>Total Dispatched</p>
            </div>
            <div class="card">
                <h3>{total_stock_quantity:,}</h3>
                <p>Current Stock</p>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">📦 Stock Valuation</div>
            <table>
                <tr><td>Current Stock Quantity</td><td class="amount">{total_stock_quantity:,} pcs</td></tr>
                <tr><td>Cost Per Piece</td><td class="amount">₹{cost_per_piece:.2f}</td></tr>
                <tr class="total-row"><td><strong>Estimated Stock Value</strong></td><td class="amount"><strong>₹{estimated_stock_value:,.2f}</strong></td></tr>
            </table>
        </div>
        
        <div style="text-align:center;margin-top:30px;color:#666;">
            Arian Knit Fab Production Pro | Profit & Loss Report
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# ==================== PHASE 3: ORDER TRACKING, RETURNS, QUALITY, EXPORT, ACTIVITY LOG, SETTINGS ====================

# Order/Lot Journey Tracking
@api_router.get("/tracking/lot/{lot_number}")
async def track_lot_journey(lot_number: str):
    """Track complete journey of a lot from cutting to dispatch"""
    journey = {
        "lot_number": lot_number,
        "stages": [],
        "current_stage": "Unknown",
        "total_quantity": 0,
        "dispatched_quantity": 0
    }
    
    # 1. Find in Cutting Orders
    cutting = await db.cutting_orders.find_one(
        {"$or": [{"cutting_lot_number": lot_number}, {"lot_number": lot_number}]},
        {"_id": 0}
    )
    if cutting:
        journey["stages"].append({
            "stage": "Cutting",
            "status": "Completed",
            "date": cutting.get('date', cutting.get('created_at', '')),
            "details": {
                "category": cutting.get('category'),
                "style_type": cutting.get('style_type'),
                "color": cutting.get('color'),
                "quantity": cutting.get('total_quantity', 0),
                "fabric_lot": cutting.get('fabric_lot_id')
            }
        })
        journey["total_quantity"] = cutting.get('total_quantity', 0)
        journey["current_stage"] = "Cutting"
    
    # 2. Find in Outsourcing Orders
    outsourcing = await db.outsourcing_orders.find(
        {"cutting_lot_number": lot_number},
        {"_id": 0}
    ).to_list(100)
    
    for order in outsourcing:
        journey["stages"].append({
            "stage": f"Outsourcing - {order.get('operation_type', '')}",
            "status": order.get('status', 'Sent'),
            "date": order.get('dc_date', ''),
            "details": {
                "dc_number": order.get('dc_number'),
                "unit_name": order.get('unit_name'),
                "quantity": order.get('total_quantity', 0),
                "rate": order.get('rate_per_pcs', 0),
                "amount": order.get('total_amount', 0)
            }
        })
        if order.get('status') == 'Sent':
            journey["current_stage"] = f"At {order.get('unit_name')} ({order.get('operation_type')})"
        elif order.get('status') == 'Received':
            journey["current_stage"] = f"Received from {order.get('operation_type')}"
    
    # 3. Find in Outsourcing Receipts
    receipts = await db.outsourcing_receipts.find(
        {"cutting_lot_number": lot_number},
        {"_id": 0}
    ).to_list(100)
    
    for receipt in receipts:
        total_received = sum(receipt.get('received_distribution', {}).values())
        journey["stages"].append({
            "stage": f"Receipt - {receipt.get('operation_type', '')}",
            "status": "Completed",
            "date": receipt.get('receipt_date', ''),
            "details": {
                "dc_number": receipt.get('dc_number'),
                "received": total_received,
                "shortage": receipt.get('total_shortage', 0)
            }
        })
    
    # 4. Find in Ironing Orders
    ironing = await db.ironing_orders.find(
        {"cutting_lot_number": lot_number},
        {"_id": 0}
    ).to_list(100)
    
    for order in ironing:
        journey["stages"].append({
            "stage": "Ironing",
            "status": order.get('status', 'Sent'),
            "date": order.get('dc_date', ''),
            "details": {
                "dc_number": order.get('dc_number'),
                "unit_name": order.get('unit_name'),
                "quantity": order.get('total_quantity', 0)
            }
        })
        if order.get('status') == 'Sent':
            journey["current_stage"] = f"At Ironing - {order.get('unit_name')}"
        elif order.get('status') == 'Received':
            journey["current_stage"] = "Ironing Complete"
    
    # 5. Find in Stock
    stock = await db.stock.find_one(
        {"lot_number": lot_number},
        {"_id": 0}
    )
    if stock:
        journey["stages"].append({
            "stage": "Stock",
            "status": "In Stock",
            "date": stock.get('created_at', ''),
            "details": {
                "stock_code": stock.get('stock_code'),
                "available": stock.get('available_quantity', 0),
                "total": stock.get('total_quantity', 0)
            }
        })
        journey["current_stage"] = "In Stock"
    
    # 6. Find in Dispatches
    dispatches = await db.bulk_dispatches.find({}, {"_id": 0}).to_list(1000)
    dispatched_qty = 0
    for dispatch in dispatches:
        for item in dispatch.get('items', []):
            if item.get('lot_number') == lot_number:
                dispatched_qty += item.get('total_quantity', 0)
                journey["stages"].append({
                    "stage": "Dispatch",
                    "status": "Dispatched",
                    "date": dispatch.get('dispatch_date', ''),
                    "details": {
                        "dispatch_number": dispatch.get('dispatch_number'),
                        "customer": dispatch.get('customer_name'),
                        "quantity": item.get('total_quantity', 0)
                    }
                })
    
    journey["dispatched_quantity"] = dispatched_qty
    if dispatched_qty > 0:
        journey["current_stage"] = f"Partially Dispatched ({dispatched_qty} pcs)"
    if stock and stock.get('available_quantity', 0) == 0 and dispatched_qty > 0:
        journey["current_stage"] = "Fully Dispatched"
    
    return journey


# Returns/Rejection Management
class ReturnCreate(BaseModel):
    source_type: str  # 'dispatch', 'outsourcing', 'ironing'
    source_id: str
    return_date: datetime
    quantity: int
    reason: str
    notes: Optional[str] = ""

@api_router.post("/returns")
async def create_return(return_data: ReturnCreate, current_user: dict = Depends(get_current_user)):
    """Record a return/rejection"""
    return_dict = return_data.model_dump()
    return_dict['id'] = str(uuid.uuid4())
    return_dict['return_date'] = return_dict['return_date'].isoformat()
    return_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    return_dict['status'] = 'Pending'
    return_dict['created_by'] = current_user.get('username', 'system')
    return_dict['stock_restored'] = False
    
    await db.returns.insert_one(return_dict)
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "Return Recorded",
        "entity_type": "return",
        "entity_id": return_dict['id'],
        "details": f"Return from {return_data.source_type}: {return_data.quantity} pcs - {return_data.reason}",
        "user": current_user.get('username', 'system'),
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": "Return recorded", "id": return_dict['id']}

@api_router.get("/returns")
async def get_returns(current_user: dict = Depends(get_current_user)):
    """Get all returns"""
    returns = await db.returns.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return returns

@api_router.put("/returns/{return_id}/process")
async def process_return(return_id: str, action: str = "accept", current_user: dict = Depends(get_current_user)):
    """Process a return - accept or reject"""
    if action not in ['accept', 'reject']:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")
    
    return_doc = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not return_doc:
        raise HTTPException(status_code=404, detail="Return not found")
    
    if return_doc.get('status') != 'Pending':
        raise HTTPException(status_code=400, detail="Return has already been processed")
    
    new_status = "Accepted" if action == "accept" else "Rejected"
    update_data = {
        "status": new_status,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": current_user.get('username', 'system')
    }
    
    # If accepted from dispatch, restore stock
    stock_restored = False
    if action == "accept" and return_doc.get('source_type') == 'dispatch':
        source_id = return_doc.get('source_id')
        quantity = return_doc.get('quantity', 0)
        
        # Find the bulk dispatch and associated stock items
        dispatch = await db.bulk_dispatches.find_one({"id": source_id}, {"_id": 0})
        if dispatch and dispatch.get('items'):
            # Add returned quantity to first stock item in dispatch
            first_item = dispatch['items'][0] if dispatch['items'] else None
            if first_item and first_item.get('stock_id'):
                stock_item = await db.stock_items.find_one({"id": first_item['stock_id']}, {"_id": 0})
                if stock_item:
                    new_available = stock_item.get('available_quantity', 0) + quantity
                    await db.stock_items.update_one(
                        {"id": first_item['stock_id']},
                        {"$set": {"available_quantity": new_available, "updated_at": datetime.now(timezone.utc)}}
                    )
                    stock_restored = True
    
    update_data['stock_restored'] = stock_restored
    
    await db.returns.update_one(
        {"id": return_id},
        {"$set": update_data}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"Return {new_status}",
        "entity_type": "return",
        "entity_id": return_id,
        "details": f"Return {new_status.lower()} by {current_user.get('username', 'system')}" + (" - Stock restored" if stock_restored else ""),
        "user": current_user.get('username', 'system'),
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": f"Return {new_status.lower()}", "stock_restored": stock_restored}

@api_router.delete("/returns/{return_id}")
async def delete_return(return_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a return record (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete returns")
    
    return_record = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")
    
    result = await db.returns.delete_one({"id": return_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Return not found")
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "Return Deleted",
        "entity_type": "return",
        "entity_id": return_id,
        "details": "Return record deleted",
        "user": current_user.get('username', 'system'),
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": "Return deleted"}


# Quality Check Module
class QualityCheckCreate(BaseModel):
    lot_number: str
    check_date: datetime
    check_type: str  # 'pre-production', 'in-process', 'final'
    parameters: Dict[str, str]  # {'stitching': 'Pass', 'color': 'Pass', etc.}
    overall_status: str  # 'Pass', 'Fail', 'Conditional'
    defects_found: Optional[List[str]] = []
    notes: Optional[str] = ""

@api_router.post("/quality-checks")
async def create_quality_check(check: QualityCheckCreate):
    """Create a quality check record"""
    check_dict = check.model_dump()
    check_dict['id'] = str(uuid.uuid4())
    check_dict['check_date'] = check_dict['check_date'].isoformat()
    check_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.quality_checks.insert_one(check_dict)
    return {"message": "Quality check recorded", "id": check_dict['id']}

@api_router.get("/quality-checks")
async def get_quality_checks(lot_number: Optional[str] = None):
    """Get quality checks, optionally filtered by lot"""
    query = {}
    if lot_number:
        query["lot_number"] = lot_number
    
    checks = await db.quality_checks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return checks

@api_router.delete("/quality-checks/{check_id}")
async def delete_quality_check(check_id: str):
    """Delete a quality check"""
    result = await db.quality_checks.delete_one({"id": check_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quality check not found")
    return {"message": "Quality check deleted"}


# Data Export/Backup
@api_router.get("/export/all")
async def export_all_data():
    """Export all data as JSON for backup"""
    data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "fabric_lots": await db.fabric_lots.find({}, {"_id": 0}).to_list(10000),
        "cutting_orders": await db.cutting_orders.find({}, {"_id": 0}).to_list(10000),
        "outsourcing_orders": await db.outsourcing_orders.find({}, {"_id": 0}).to_list(10000),
        "outsourcing_receipts": await db.outsourcing_receipts.find({}, {"_id": 0}).to_list(10000),
        "ironing_orders": await db.ironing_orders.find({}, {"_id": 0}).to_list(10000),
        "ironing_receipts": await db.ironing_receipts.find({}, {"_id": 0}).to_list(10000),
        "stock": await db.stock.find({}, {"_id": 0}).to_list(10000),
        "catalogs": await db.catalogs.find({}, {"_id": 0}).to_list(10000),
        "bulk_dispatches": await db.bulk_dispatches.find({}, {"_id": 0}).to_list(10000),
        "outsourcing_units": await db.outsourcing_units.find({}, {"_id": 0}).to_list(1000),
        "returns": await db.returns.find({}, {"_id": 0}).to_list(10000),
        "quality_checks": await db.quality_checks.find({}, {"_id": 0}).to_list(10000),
        "activity_logs": await db.activity_logs.find({}, {"_id": 0}).to_list(10000),
        "settings": await db.settings.find({}, {"_id": 0}).to_list(100)
    }
    
    return Response(
        content=json.dumps(data, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )

@api_router.get("/export/csv/{collection}")
async def export_collection_csv(collection: str):
    """Export a specific collection as CSV"""
    valid_collections = ['fabric_lots', 'cutting_orders', 'outsourcing_orders', 'outsourcing_receipts', 
                         'ironing_orders', 'ironing_receipts', 'stock', 'catalogs', 'bulk_dispatches']
    
    if collection not in valid_collections:
        raise HTTPException(status_code=400, detail=f"Invalid collection. Valid: {valid_collections}")
    
    data = await db[collection].find({}, {"_id": 0}).to_list(10000)
    
    if not data:
        return Response(content="No data", media_type="text/csv")
    
    # Get all keys from all documents
    all_keys = set()
    for doc in data:
        all_keys.update(doc.keys())
    keys = sorted(list(all_keys))
    
    csv_content = ",".join(keys) + "\n"
    for doc in data:
        row = []
        for key in keys:
            val = doc.get(key, '')
            if isinstance(val, (dict, list)):
                val = json.dumps(val)
            row.append(str(val).replace(',', ';').replace('\n', ' '))
        csv_content += ",".join(row) + "\n"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={collection}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# Activity Log
@api_router.post("/activity-log")
async def log_activity(action: str, entity_type: str, entity_id: str, details: str = "", user: str = "system"):
    """Log an activity"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "user": user,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_entry)
    return {"message": "Activity logged"}

@api_router.get("/activity-logs")
async def get_activity_logs(limit: int = 100, entity_type: Optional[str] = None):
    """Get recent activity logs"""
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs


# Settings
@api_router.get("/settings")
async def get_settings():
    """Get application settings"""
    settings = await db.settings.find_one({"type": "app_settings"}, {"_id": 0})
    if not settings:
        # Return defaults
        settings = {
            "type": "app_settings",
            "company_name": "Arian Knit Fab",
            "sizes": {
                "Mens": ["M", "L", "XL", "XXL"],
                "Womens": ["S", "M", "L", "XL"],
                "Kids": ["2/3", "3/4", "5/6", "7/8", "9/10", "11/12", "13/14"]
            },
            "categories": ["Mens", "Womens", "Kids"],
            "operations": ["Stitching", "Overlock", "Button", "Packaging", "Checking"],
            "default_master_pack_ratio": {"M": 2, "L": 2, "XL": 2, "XXL": 2},
            "low_stock_threshold": 50,
            "currency_symbol": "₹"
        }
    return settings

@api_router.put("/settings")
async def update_settings(settings: Dict):
    """Update application settings"""
    settings["type"] = "app_settings"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"type": "app_settings"},
        {"$set": settings},
        upsert=True
    )
    return {"message": "Settings updated"}


# Unit Payment Endpoint
class UnitPayment(BaseModel):
    unit_name: str
    amount: float
    transaction_type: str = "credit"  # "credit" for payment, "debit" for adding charge
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_method: Optional[str] = "Cash"
    notes: Optional[str] = ""

@api_router.get("/units/{unit_name}/pending-bills")
async def get_unit_pending_bills(unit_name: str):
    """Get summary of pending bills for a specific unit"""
    # Get outsourcing orders
    outsourcing_orders = await db.outsourcing_orders.find(
        {
            "unit_name": unit_name,
            "payment_status": {"$in": ["Unpaid", "Partial"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Get ironing orders
    ironing_orders = await db.ironing_orders.find(
        {
            "unit_name": unit_name,
            "payment_status": {"$in": ["Unpaid", "Partial"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate totals
    outsourcing_pending = sum(order.get('balance', 0) for order in outsourcing_orders)
    ironing_pending = sum(order.get('balance', 0) for order in ironing_orders)
    total_pending = outsourcing_pending + ironing_pending
    
    # Prepare bill details
    bills = []
    for order in outsourcing_orders:
        bills.append({
            "type": "outsourcing",
            "dc_number": order['dc_number'],
            "date": order['dc_date'] if isinstance(order['dc_date'], str) else order['dc_date'].isoformat(),
            "total_amount": order.get('total_amount', 0),
            "paid": order.get('amount_paid', 0),
            "balance": order.get('balance', 0),
            "status": order.get('payment_status', 'Unpaid')
        })
    
    for order in ironing_orders:
        bills.append({
            "type": "ironing",
            "dc_number": order['dc_number'],
            "date": order['dc_date'] if isinstance(order['dc_date'], str) else order['dc_date'].isoformat(),
            "total_amount": order.get('total_amount', 0),
            "paid": order.get('amount_paid', 0),
            "balance": order.get('balance', 0),
            "status": order.get('payment_status', 'Unpaid')
        })
    
    # Sort by date
    bills.sort(key=lambda x: x['date'])
    
    # Get debit transactions for this unit
    debit_transactions = await db.unit_transactions.find(
        {"unit_name": unit_name, "transaction_type": "debit"},
        {"_id": 0}
    ).to_list(1000)
    total_debits = sum(t.get('amount', 0) for t in debit_transactions)
    
    # Get credit transactions (payments already made via transaction system)
    credit_transactions = await db.unit_transactions.find(
        {"unit_name": unit_name, "transaction_type": "credit"},
        {"_id": 0}
    ).to_list(1000)
    total_credits = sum(t.get('amount', 0) for t in credit_transactions)
    
    # Add debit entries to bills
    for debit in debit_transactions:
        bills.append({
            "type": "debit",
            "dc_number": f"DEBIT-{debit.get('id', '')[:8]}",
            "date": debit.get('transaction_date', ''),
            "total_amount": debit.get('amount', 0),
            "paid": 0,
            "balance": debit.get('amount', 0),
            "status": "Debit",
            "notes": debit.get('notes', '')
        })
    
    effective_pending = total_pending + total_debits
    
    return {
        "unit_name": unit_name,
        "outsourcing_pending": round(outsourcing_pending, 2),
        "ironing_pending": round(ironing_pending, 2),
        "total_debits": round(total_debits, 2),
        "total_pending": round(effective_pending, 2),
        "bills_count": len(bills),
        "bills": bills
    }

@api_router.post("/units/payment")
async def record_unit_payment(payment: UnitPayment):
    """
    Record payment (credit) or debit for a unit
    Credit: Payment to unit, reduces pending balance
    Debit: Additional charge/advance to unit, increases pending balance
    """
    unit_name = payment.unit_name
    amount = payment.amount
    transaction_type = payment.transaction_type  # "credit" or "debit"
    
    # Record transaction in unit_transactions collection
    transaction_record = {
        "id": str(uuid.uuid4()),
        "unit_name": unit_name,
        "amount": amount,
        "transaction_type": transaction_type,
        "payment_method": payment.payment_method,
        "notes": payment.notes,
        "transaction_date": payment.payment_date.isoformat() if isinstance(payment.payment_date, datetime) else payment.payment_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.unit_transactions.insert_one(transaction_record)
    
    # Handle DEBIT transaction (add charge to unit)
    if transaction_type == "debit":
        # Create a debit record that increases pending balance
        return {
            "message": f"Debit of ₹{amount} recorded for {unit_name}",
            "unit_name": unit_name,
            "transaction_type": "debit",
            "amount": amount,
            "notes": payment.notes
        }
    
    # Handle CREDIT transaction (payment to unit)
    # Get all outsourcing orders for this unit with pending balance
    outsourcing_orders = await db.outsourcing_orders.find(
        {
            "unit_name": unit_name,
            "payment_status": {"$in": ["Unpaid", "Partial"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Convert dates
    for order in outsourcing_orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Get all ironing orders for this unit with pending balance
    ironing_orders = await db.ironing_orders.find(
        {
            "unit_name": unit_name,
            "payment_status": {"$in": ["Unpaid", "Partial"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Convert dates
    for order in ironing_orders:
        if isinstance(order.get('dc_date'), str):
            order['dc_date'] = datetime.fromisoformat(order['dc_date'])
    
    # Calculate total pending for this unit
    total_pending = 0
    for order in outsourcing_orders:
        total_pending += order.get('balance', 0)
    for order in ironing_orders:
        total_pending += order.get('balance', 0)
    
    # Get total debits for this unit
    debit_transactions = await db.unit_transactions.find(
        {"unit_name": unit_name, "transaction_type": "debit"},
        {"_id": 0}
    ).to_list(1000)
    total_debits = sum(t.get('amount', 0) for t in debit_transactions)
    
    # Get total credits already paid
    credit_transactions = await db.unit_transactions.find(
        {"unit_name": unit_name, "transaction_type": "credit"},
        {"_id": 0}
    ).to_list(1000)
    # Exclude current transaction from count
    total_credits_paid = sum(t.get('amount', 0) for t in credit_transactions) - amount
    
    # Effective pending = order pending + debits - credits already paid
    effective_pending = total_pending + total_debits - max(0, total_credits_paid)
    
    if effective_pending <= 0 and total_pending == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No pending bills found for unit: {unit_name}"
        )
    
    if amount > effective_pending and effective_pending > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount (₹{amount}) exceeds total pending (₹{effective_pending:.2f}) for unit: {unit_name}"
        )
    
    # Allocate payment to orders (oldest first)
    all_orders = []
    for order in outsourcing_orders:
        all_orders.append({"type": "outsourcing", "order": order})
    for order in ironing_orders:
        all_orders.append({"type": "ironing", "order": order})
    
    # Sort by date (oldest first)
    all_orders.sort(key=lambda x: x['order']['dc_date'])
    
    remaining_payment = amount
    allocations = []
    
    for item in all_orders:
        if remaining_payment <= 0:
            break
        
        order = item['order']
        order_type = item['type']
        balance = order.get('balance', 0)
        
        if balance <= 0:
            continue
        
        # Allocate payment to this order
        allocation = min(remaining_payment, balance)
        new_amount_paid = order.get('amount_paid', 0) + allocation
        new_balance = balance - allocation
        
        # Determine new payment status
        if new_balance <= 0:
            payment_status = "Paid"
            new_balance = 0
        elif new_amount_paid > 0:
            payment_status = "Partial"
        else:
            payment_status = "Unpaid"
        
        # Update the order
        collection = db.outsourcing_orders if order_type == "outsourcing" else db.ironing_orders
        await collection.update_one(
            {"id": order['id']},
            {"$set": {
                "amount_paid": round(new_amount_paid, 2),
                "balance": round(new_balance, 2),
                "payment_status": payment_status
            }}
        )
        
        allocations.append({
            "order_type": order_type,
            "dc_number": order['dc_number'],
            "allocated_amount": round(allocation, 2),
            "new_balance": round(new_balance, 2)
        })
        
        remaining_payment -= allocation
    
    return {
        "message": "Payment recorded successfully",
        "unit_name": unit_name,
        "transaction_type": "credit",
        "total_payment": amount,
        "total_pending_before": round(total_pending, 2),
        "total_pending_after": round(total_pending - amount, 2),
        "allocations": allocations
    }


# Include the router in the main app
app.include_router(api_router)

# Mount static files for serving uploaded images
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()