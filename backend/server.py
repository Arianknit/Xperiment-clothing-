from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import barcode
from barcode.writer import ImageWriter
import io
import random


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
class Fabric(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patch_number: str
    name: str
    fabric_type: str
    color: str
    quantity: float
    unit: str  # meters, yards, kg
    supplier: str
    date_added: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FabricCreate(BaseModel):
    name: str
    fabric_type: str
    color: str
    quantity: float
    unit: str
    supplier: str
    patch_number: Optional[str] = None

class FabricUpdate(BaseModel):
    name: Optional[str] = None
    fabric_type: Optional[str] = None
    color: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    supplier: Optional[str] = None
    patch_number: Optional[str] = None

class ProductionOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    garment_type: str
    fabric_id: str
    fabric_name: str
    fabric_quantity: float
    production_quantity: int
    status: str  # Pending, In Progress, Completed, Cancelled
    priority: str  # Low, Medium, High
    start_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completion_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductionOrderCreate(BaseModel):
    order_number: str
    garment_type: str
    fabric_id: str
    fabric_name: str
    fabric_quantity: float
    production_quantity: int
    status: str = "Pending"
    priority: str = "Medium"
    notes: Optional[str] = None

class ProductionOrderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    completion_date: Optional[datetime] = None
    notes: Optional[str] = None


# Fabric Routes
@api_router.post("/fabrics", response_model=Fabric)
async def create_fabric(fabric: FabricCreate):
    fabric_dict = fabric.model_dump()
    fabric_obj = Fabric(**fabric_dict)
    
    doc = fabric_obj.model_dump()
    doc['date_added'] = doc['date_added'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.fabrics.insert_one(doc)
    return fabric_obj

@api_router.get("/fabrics", response_model=List[Fabric])
async def get_fabrics():
    fabrics = await db.fabrics.find({}, {"_id": 0}).to_list(1000)
    
    for fabric in fabrics:
        if isinstance(fabric['date_added'], str):
            fabric['date_added'] = datetime.fromisoformat(fabric['date_added'])
        if isinstance(fabric['updated_at'], str):
            fabric['updated_at'] = datetime.fromisoformat(fabric['updated_at'])
    
    return fabrics

@api_router.get("/fabrics/{fabric_id}", response_model=Fabric)
async def get_fabric(fabric_id: str):
    fabric = await db.fabrics.find_one({"id": fabric_id}, {"_id": 0})
    if not fabric:
        raise HTTPException(status_code=404, detail="Fabric not found")
    
    if isinstance(fabric['date_added'], str):
        fabric['date_added'] = datetime.fromisoformat(fabric['date_added'])
    if isinstance(fabric['updated_at'], str):
        fabric['updated_at'] = datetime.fromisoformat(fabric['updated_at'])
    
    return fabric

@api_router.put("/fabrics/{fabric_id}", response_model=Fabric)
async def update_fabric(fabric_id: str, fabric_update: FabricUpdate):
    update_data = {k: v for k, v in fabric_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.fabrics.update_one(
        {"id": fabric_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fabric not found")
    
    return await get_fabric(fabric_id)

@api_router.delete("/fabrics/{fabric_id}")
async def delete_fabric(fabric_id: str):
    result = await db.fabrics.delete_one({"id": fabric_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fabric not found")
    
    return {"message": "Fabric deleted successfully"}


# Production Order Routes
@api_router.post("/production-orders", response_model=ProductionOrder)
async def create_production_order(order: ProductionOrderCreate):
    order_dict = order.model_dump()
    order_obj = ProductionOrder(**order_dict)
    
    doc = order_obj.model_dump()
    doc['start_date'] = doc['start_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc['completion_date']:
        doc['completion_date'] = doc['completion_date'].isoformat()
    
    await db.production_orders.insert_one(doc)
    return order_obj

@api_router.get("/production-orders", response_model=List[ProductionOrder])
async def get_production_orders():
    orders = await db.production_orders.find({}, {"_id": 0}).to_list(1000)
    
    for order in orders:
        if isinstance(order['start_date'], str):
            order['start_date'] = datetime.fromisoformat(order['start_date'])
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if order.get('completion_date') and isinstance(order['completion_date'], str):
            order['completion_date'] = datetime.fromisoformat(order['completion_date'])
    
    return orders

@api_router.get("/production-orders/{order_id}", response_model=ProductionOrder)
async def get_production_order(order_id: str):
    order = await db.production_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Production order not found")
    
    if isinstance(order['start_date'], str):
        order['start_date'] = datetime.fromisoformat(order['start_date'])
    if isinstance(order['created_at'], str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if order.get('completion_date') and isinstance(order['completion_date'], str):
        order['completion_date'] = datetime.fromisoformat(order['completion_date'])
    
    return order

@api_router.put("/production-orders/{order_id}", response_model=ProductionOrder)
async def update_production_order(order_id: str, order_update: ProductionOrderUpdate):
    update_data = {k: v for k, v in order_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    if 'completion_date' in update_data and update_data['completion_date']:
        update_data['completion_date'] = update_data['completion_date'].isoformat()
    
    result = await db.production_orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Production order not found")
    
    return await get_production_order(order_id)

@api_router.delete("/production-orders/{order_id}")
async def delete_production_order(order_id: str):
    result = await db.production_orders.delete_one({"id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Production order not found")
    
    return {"message": "Production order deleted successfully"}


# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_fabrics = await db.fabrics.count_documents({})
    total_orders = await db.production_orders.count_documents({})
    active_orders = await db.production_orders.count_documents({"status": "In Progress"})
    completed_orders = await db.production_orders.count_documents({"status": "Completed"})
    pending_orders = await db.production_orders.count_documents({"status": "Pending"})
    
    # Calculate total fabric quantity
    fabrics = await db.fabrics.find({}, {"_id": 0, "quantity": 1}).to_list(1000)
    total_fabric_quantity = sum(f.get('quantity', 0) for f in fabrics)
    
    return {
        "total_fabrics": total_fabrics,
        "total_fabric_quantity": round(total_fabric_quantity, 2),
        "total_orders": total_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders
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