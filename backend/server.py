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
    cutting_lot_number: Optional[str] = ""
    cutting_master_name: Optional[str] = ""
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
    cutting_rate_per_pcs: Optional[float] = 0.0
    total_cutting_amount: Optional[float] = 0.0
    amount_paid: Optional[float] = 0.0
    balance: Optional[float] = 0.0
    payment_status: Optional[str] = "Unpaid"  # Unpaid, Partial, Paid
    total_fabric_cost: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CuttingOrderCreate(BaseModel):
    cutting_lot_number: str
    cutting_master_name: str
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
    cutting_rate_per_pcs: float

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
    lot_number: str
    category: str
    style_type: str
    operation_type: str  # Printing, Embroidery, Stone, Sequins, Sticker
    unit_name: str
    size_distribution: Dict[str, int]
    total_quantity: int
    rate_per_pcs: float
    total_amount: float
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutsourcingReceiptCreate(BaseModel):
    outsourcing_order_id: str
    receipt_date: datetime
    received_distribution: Dict[str, int]


# Helper function to generate DC number
def generate_dc_number():
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"DC-{timestamp}"


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
    
    # Calculate total cutting amount
    total_cutting_amount = total_quantity * order_dict['cutting_rate_per_pcs']
    order_dict['total_cutting_amount'] = round(total_cutting_amount, 2)
    
    # Initialize payment fields
    order_dict['amount_paid'] = 0.0
    order_dict['balance'] = total_cutting_amount
    order_dict['payment_status'] = "Unpaid"
    
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
                <div class="info-label">Lot Number:</div>
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
    total_outsourcing_paid = sum(o.get('amount_paid', 0) for o in outsourcing_orders)
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
                    <td colspan="5">TOTAL</td>
                    <td>₹{total_outsourcing_amount:.2f}</td>
                    <td>₹{total_outsourcing_paid:.2f}</td>
                    <td>₹{total_outsourcing_balance:.2f}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        
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


# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_lots = await db.fabric_lots.count_documents({})
    total_cutting_orders = await db.cutting_orders.count_documents({})
    total_outsourcing_orders = await db.outsourcing_orders.count_documents({})
    pending_outsourcing = await db.outsourcing_orders.count_documents({"status": "Sent"})
    
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
    
    # Calculate comprehensive total amount
    # Total Amount = Fabric Cost + Cutting Cost + Outsourcing Cost - Shortage Debit
    comprehensive_total = (total_production_cost + total_cutting_cost + total_outsourcing_cost) - total_shortage_debit
    
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
        "comprehensive_total": round(comprehensive_total, 2)
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