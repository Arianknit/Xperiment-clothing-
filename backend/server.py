from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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
    lot_number: str
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
    cutting_date: datetime
    fabric_lot_id: str
    lot_number: str
    category: str  # Kids, Mens, Women
    style_type: str
    fabric_taken: float
    fabric_returned: float
    fabric_used: float
    rib_taken: float
    rib_returned: float
    rib_used: float
    size_distribution: Dict[str, int]  # {"S": 10, "M": 20, ...}
    total_quantity: int
    total_fabric_cost: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CuttingOrderCreate(BaseModel):
    cutting_date: datetime
    fabric_lot_id: str
    lot_number: str
    category: str
    style_type: str
    fabric_taken: float
    fabric_returned: float
    rib_taken: float
    rib_returned: float
    size_distribution: Dict[str, int]


# Fabric Lot Routes
@api_router.post("/fabric-lots", response_model=FabricLot)
async def create_fabric_lot(lot: FabricLotCreate):
    lot_dict = lot.model_dump()
    
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
    
    # Calculate fabric and rib used
    fabric_used = order_dict['fabric_taken'] - order_dict['fabric_returned']
    rib_used = order_dict['rib_taken'] - order_dict['rib_returned']
    
    order_dict['fabric_used'] = round(fabric_used, 2)
    order_dict['rib_used'] = round(rib_used, 2)
    
    # Calculate total quantity from size distribution
    total_quantity = sum(order_dict['size_distribution'].values())
    order_dict['total_quantity'] = total_quantity
    
    # Get fabric lot to calculate cost
    fabric_lot = await db.fabric_lots.find_one({"id": order_dict['fabric_lot_id']}, {"_id": 0})
    if not fabric_lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found")
    
    # Calculate total fabric cost
    total_fabric_cost = fabric_used * fabric_lot['rate_per_kg']
    order_dict['total_fabric_cost'] = round(total_fabric_cost, 2)
    
    order_obj = CuttingOrder(**order_dict)
    
    doc = order_obj.model_dump()
    doc['cutting_date'] = doc['cutting_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.cutting_orders.insert_one(doc)
    
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


# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_lots = await db.fabric_lots.count_documents({})
    total_cutting_orders = await db.cutting_orders.count_documents({})
    
    # Calculate total fabric in stock
    lots = await db.fabric_lots.find({}, {"_id": 0, "remaining_quantity": 1, "remaining_rib_quantity": 1}).to_list(1000)
    total_fabric_stock = sum(lot.get('remaining_quantity', 0) for lot in lots)
    total_rib_stock = sum(lot.get('remaining_rib_quantity', 0) for lot in lots)
    
    # Calculate total production by category
    orders = await db.cutting_orders.find({}, {"_id": 0, "category": 1, "total_quantity": 1, "total_fabric_cost": 1}).to_list(1000)
    kids_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Kids')
    mens_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Mens')
    women_qty = sum(o.get('total_quantity', 0) for o in orders if o.get('category') == 'Women')
    total_production_cost = sum(o.get('total_fabric_cost', 0) for o in orders)
    
    return {
        "total_lots": total_lots,
        "total_fabric_stock": round(total_fabric_stock, 2),
        "total_rib_stock": round(total_rib_stock, 2),
        "total_cutting_orders": total_cutting_orders,
        "kids_production": kids_qty,
        "mens_production": mens_qty,
        "women_production": women_qty,
        "total_production_cost": round(total_production_cost, 2)
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