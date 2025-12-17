from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date
import barcode
from barcode.writer import ImageWriter
import io


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FabricLotCreate(BaseModel):
    lot_number: Optional[str] = None  # Auto-generated if not provided
    entry_date: datetime
    fabric_type: str
    supplier_name: str
    color: str
    quantity: float
    rib_quantity: float
    rate_per_kg: float

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
    cutting_order_id: str
    cutting_lot_number: Optional[str] = ""
    lot_number: str
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingOrderCreate(BaseModel):
    dc_date: datetime
    cutting_order_id: str
    lot_number: str
    category: str
    style_type: str
    operation_type: str
    unit_name: str
    size_distribution: Dict[str, int]
    rate_per_pcs: float
    notes: Optional[str] = ""

class OutsourcingOrderUpdate(BaseModel):
    dc_date: Optional[datetime] = None
    operation_type: Optional[str] = None
    unit_name: Optional[str] = None
    rate_per_pcs: Optional[float] = None
    size_distribution: Optional[Dict[str, int]] = None

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
    total_sent: int
    total_received: int
    total_shortage: int
    rate_per_pcs: float
    shortage_debit_amount: float
    sent_to_ironing: Optional[bool] = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingReceiptCreate(BaseModel):
    outsourcing_order_id: str
    receipt_date: datetime
    received_distribution: Dict[str, int]

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IroningOrderCreate(BaseModel):
    dc_date: datetime
    receipt_id: str
    unit_name: str
    rate_per_pcs: float
    master_pack_ratio: Optional[Dict[str, int]] = {}

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
    total_sent: int
    total_received: int
    total_shortage: int
    rate_per_pcs: float
    shortage_debit_amount: float
    master_pack_ratio: Optional[Dict[str, int]] = {}
    complete_packs: Optional[int] = 0
    loose_pieces: Optional[int] = 0
    loose_pieces_distribution: Optional[Dict[str, int]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IroningReceiptCreate(BaseModel):
    ironing_order_id: str
    receipt_date: datetime
    received_distribution: Dict[str, int]


# Catalog Models
class Catalog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    catalog_name: str
    catalog_code: str
    description: Optional[str] = None
    color: Optional[str] = ""
    lot_numbers: List[str]  # List of cutting lot numbers
    total_quantity: int
    available_stock: int
    size_distribution: Dict[str, int]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CatalogCreate(BaseModel):
    catalog_name: str
    catalog_code: str
    description: Optional[str] = None
    lot_numbers: List[str]

class CatalogDispatch(BaseModel):
    dispatch_quantity: Dict[str, int]  # Size-wise dispatch quantities
    customer_name: str
    dispatch_date: datetime
    bora_number: str  # Bundle/Batch number
    color: str  # T-shirt color
    notes: Optional[str] = None


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


# Fabric Lot Routes
@api_router.post("/fabric-lots", response_model=FabricLot)
async def create_fabric_lot(lot: FabricLotCreate):
    lot_dict = lot.model_dump()
    
    # Auto-generate lot number if not provided
    if not lot_dict.get('lot_number'):
        lot_dict['lot_number'] = await generate_fabric_lot_number()
    
    # Calculate total amount
    total_amount = lot_dict['quantity'] * lot_dict['rate_per_kg']
    lot_dict['total_amount'] = round(total_amount, 2)
    lot_dict['remaining_quantity'] = lot_dict['quantity']
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

@api_router.delete("/fabric-lots/{lot_id}")
async def delete_fabric_lot(lot_id: str):
    result = await db.fabric_lots.delete_one({"id": lot_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    return {"message": "Fabric lot deleted successfully"}


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
async def get_cutting_orders():
    orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    
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


# Outsourcing Order Routes
@api_router.post("/outsourcing-orders", response_model=OutsourcingOrder)
async def create_outsourcing_order(order: OutsourcingOrderCreate):
    order_dict = order.model_dump()
    
    # Get cutting order to retrieve cutting_lot_number and color
    cutting_order = await db.cutting_orders.find_one({"id": order_dict['cutting_order_id']}, {"_id": 0})
    if cutting_order:
        order_dict['cutting_lot_number'] = cutting_order.get('cutting_lot_number', '')
        order_dict['color'] = cutting_order.get('color', '')
    else:
        order_dict['cutting_lot_number'] = ''
        order_dict['color'] = ''
    
    # Generate DC number
    order_dict['dc_number'] = generate_dc_number()
    
    # Calculate total quantity
    total_quantity = sum(order_dict['size_distribution'].values())
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
                <div class="info-label">Cutting Lot Number:</div>
                <div class="info-value" style="font-weight: bold; color: #4F46E5;">{order.get('cutting_lot_number', 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Fabric Lot Number:</div>
                <div class="info-value">{order['lot_number']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Unit Name:</div>
                <div class="info-value">{order['unit_name']}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Operation Type:</div>
                <div class="info-value">{order['operation_type']}</div>
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
    
    # Calculate total dispatch quantity
    total_dispatch = sum(dispatch.dispatch_quantity.values())
    
    if total_dispatch > catalog.get('available_stock', 0):
        raise HTTPException(status_code=400, detail="Insufficient stock for dispatch")
    
    # Update available stock and size distribution
    new_available_stock = catalog.get('available_stock', 0) - total_dispatch
    new_size_distribution = catalog.get('size_distribution', {}).copy()
    
    for size, qty in dispatch.dispatch_quantity.items():
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
        "dispatch_quantity": dispatch.dispatch_quantity,
        "total_dispatched": total_dispatch,
        "customer_name": dispatch.customer_name,
        "dispatch_date": dispatch.dispatch_date,
        "bora_number": dispatch.bora_number,
        "color": dispatch.color,
        "notes": dispatch.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.catalog_dispatches.insert_one(dispatch_record)
    
    return {"message": "Dispatch recorded successfully", "new_available_stock": new_available_stock}


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
@api_router.get("/reports/cutting", response_class=HTMLResponse)
async def get_cutting_report(
    start_date: str = None,
    end_date: str = None,
    cutting_master: str = None
):
    query = {}
    
    # Get all cutting orders first (dates are stored as strings)
    orders = await db.cutting_orders.find({}, {"_id": 0}).to_list(1000)
    
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
                    <th>Quantity</th>
                    <th>Fabric Cost</th>
                    <th>Cutting Cost</th>
                    <th>Paid</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
                {''.join([f'''
                <tr>
                    <td><strong>{o.get('cutting_lot_number', 'N/A')}</strong></td>
                    <td>{o.get('cutting_date').strftime('%d %b %Y') if o.get('cutting_date') else 'N/A'}</td>
                    <td>{o.get('cutting_master_name', 'N/A')}</td>
                    <td>{o.get('category', 'N/A')}</td>
                    <td>{o.get('style_type', 'N/A')}</td>
                    <td><strong>{o.get('total_quantity', 0)}</strong></td>
                    <td>₹{o.get('total_fabric_cost', 0):.2f}</td>
                    <td>₹{o.get('total_cutting_amount', 0):.2f}</td>
                    <td style="color: green;">₹{o.get('amount_paid', 0):.2f}</td>
                    <td style="color: red;">₹{o.get('balance', 0):.2f}</td>
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


# Unit Payment Endpoint
class UnitPayment(BaseModel):
    unit_name: str
    amount: float
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
    
    return {
        "unit_name": unit_name,
        "outsourcing_pending": round(outsourcing_pending, 2),
        "ironing_pending": round(ironing_pending, 2),
        "total_pending": round(total_pending, 2),
        "bills_count": len(bills),
        "bills": bills
    }

@api_router.post("/units/payment")
async def record_unit_payment(payment: UnitPayment):
    """
    Record payment for a unit across multiple orders (outsourcing and ironing)
    Automatically allocates payment to pending orders for that unit
    """
    unit_name = payment.unit_name
    payment_amount = payment.amount
    
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
    
    if total_pending == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No pending bills found for unit: {unit_name}"
        )
    
    if payment_amount > total_pending:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount (₹{payment_amount}) exceeds total pending bills (₹{total_pending:.2f}) for unit: {unit_name}"
        )
    
    # Allocate payment to orders (oldest first)
    all_orders = []
    for order in outsourcing_orders:
        all_orders.append({"type": "outsourcing", "order": order})
    for order in ironing_orders:
        all_orders.append({"type": "ironing", "order": order})
    
    # Sort by date (oldest first)
    all_orders.sort(key=lambda x: x['order']['dc_date'])
    
    remaining_payment = payment_amount
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
        "total_payment": payment_amount,
        "total_pending_before": round(total_pending, 2),
        "total_pending_after": round(total_pending - payment_amount, 2),
        "allocations": allocations
    }


# Include the router in the main app
app.include_router(api_router)

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