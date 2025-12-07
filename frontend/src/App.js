import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";

// Suppress ResizeObserver errors (harmless browser warnings)
const debounce = (callback, delay) => {
  let tid;
  return function (...args) {
    const ctx = self;
    tid && clearTimeout(tid);
    tid = setTimeout(() => {
      callback.apply(ctx, args);
    }, delay);
  };
};

const _ = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends _ {
  constructor(callback) {
    callback = debounce(callback, 20);
    super(callback);
  }
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, TrendingUp, Scissors, Plus, Trash2, Factory, Barcode, Users, Send, Printer, PackageCheck, AlertCircle, Pencil } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SIZE_CONFIG = {
  Kids: ['2/3', '3/4', '5/6', '7/8', '9/10', '11/12', '13/14'],
  Mens: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'],
  Women: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL']
};

const OPERATION_TYPES = ['Printing', 'Embroidery', 'Stone', 'Sequins', 'Sticker'];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [fabricLots, setFabricLots] = useState([]);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [outsourcingOrders, setOutsourcingOrders] = useState([]);
  const [outsourcingReceipts, setOutsourcingReceipts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Fabric lot form state
  const [lotForm, setLotForm] = useState({
    lot_number: "",
    entry_date: new Date().toISOString().split('T')[0],
    fabric_type: "",
    supplier_name: "",
    color: "",
    quantity: "",
    rib_quantity: "",
    rate_per_kg: ""
  });
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  
  // Cutting order form state
  const [cuttingForm, setCuttingForm] = useState({
    cutting_lot_number: "",
    cutting_date: new Date().toISOString().split('T')[0],
    fabric_lot_id: "",
    lot_number: "",
    category: "Kids",
    style_type: "",
    fabric_taken: "",
    fabric_returned: "",
    rib_taken: "",
    rib_returned: "",
    cutting_rate_per_pcs: "",
    size_distribution: {}
  });
  const [cuttingDialogOpen, setCuttingDialogOpen] = useState(false);
  const [editingCuttingOrder, setEditingCuttingOrder] = useState(null);
  
  // Outsourcing order form state
  const [outsourcingForm, setOutsourcingForm] = useState({
    dc_date: new Date().toISOString().split('T')[0],
    cutting_order_id: "",
    lot_number: "",
    category: "Kids",
    style_type: "",
    operation_type: "Printing",
    unit_name: "",
    rate_per_pcs: "",
    size_distribution: {}
  });
  const [outsourcingDialogOpen, setOutsourcingDialogOpen] = useState(false);
  
  // Receipt form state
  const [receiptForm, setReceiptForm] = useState({
    outsourcing_order_id: "",
    receipt_date: new Date().toISOString().split('T')[0],
    received_distribution: {}
  });
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedOutsourcingOrder, setSelectedOutsourcingOrder] = useState(null);
  
  const [barcodeView, setBarcodeView] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchFabricLots();
    fetchCuttingOrders();
    fetchOutsourcingOrders();
    fetchOutsourcingReceipts();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to fetch dashboard stats");
    }
  };

  const fetchFabricLots = async () => {
    try {
      const response = await axios.get(`${API}/fabric-lots`);
      setFabricLots(response.data);
    } catch (error) {
      console.error("Error fetching fabric lots:", error);
      toast.error("Failed to fetch fabric lots");
    }
  };

  const fetchCuttingOrders = async () => {
    try {
      const response = await axios.get(`${API}/cutting-orders`);
      setCuttingOrders(response.data);
    } catch (error) {
      console.error("Error fetching cutting orders:", error);
      toast.error("Failed to fetch cutting orders");
    }
  };

  const fetchOutsourcingOrders = async () => {
    try {
      const response = await axios.get(`${API}/outsourcing-orders`);
      setOutsourcingOrders(response.data);
    } catch (error) {
      console.error("Error fetching outsourcing orders:", error);
      toast.error("Failed to fetch outsourcing orders");
    }
  };

  const fetchOutsourcingReceipts = async () => {
    try {
      const response = await axios.get(`${API}/outsourcing-receipts`);
      setOutsourcingReceipts(response.data);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast.error("Failed to fetch receipts");
    }
  };

  const handleLotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/fabric-lots`, {
        ...lotForm,
        entry_date: new Date(lotForm.entry_date).toISOString(),
        quantity: parseFloat(lotForm.quantity),
        rib_quantity: parseFloat(lotForm.rib_quantity),
        rate_per_kg: parseFloat(lotForm.rate_per_kg)
      });
      toast.success("Fabric lot added successfully");
      
      setLotDialogOpen(false);
      setLotForm({
        lot_number: "",
        entry_date: new Date().toISOString().split('T')[0],
        fabric_type: "",
        supplier_name: "",
        color: "",
        quantity: "",
        rib_quantity: "",
        rate_per_kg: ""
      });
      fetchFabricLots();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving fabric lot:", error);
      toast.error("Failed to save fabric lot");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLot = async (lotId) => {
    if (!window.confirm("Are you sure you want to delete this fabric lot?")) return;
    
    try {
      await axios.delete(`${API}/fabric-lots/${lotId}`);
      toast.success("Fabric lot deleted successfully");
      fetchFabricLots();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting fabric lot:", error);
      toast.error("Failed to delete fabric lot");
    }
  };

  const handleCuttingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingCuttingOrder) {
        await axios.put(`${API}/cutting-orders/${editingCuttingOrder.id}`, {
          cutting_lot_number: cuttingForm.cutting_lot_number,
          cutting_date: new Date(cuttingForm.cutting_date).toISOString(),
          category: cuttingForm.category,
          style_type: cuttingForm.style_type,
          fabric_taken: parseFloat(cuttingForm.fabric_taken),
          fabric_returned: parseFloat(cuttingForm.fabric_returned),
          rib_taken: parseFloat(cuttingForm.rib_taken),
          rib_returned: parseFloat(cuttingForm.rib_returned),
          cutting_rate_per_pcs: parseFloat(cuttingForm.cutting_rate_per_pcs),
          size_distribution: cuttingForm.size_distribution
        });
        toast.success("Cutting order updated successfully");
      } else {
        await axios.post(`${API}/cutting-orders`, {
          ...cuttingForm,
          cutting_date: new Date(cuttingForm.cutting_date).toISOString(),
          fabric_taken: parseFloat(cuttingForm.fabric_taken),
          fabric_returned: parseFloat(cuttingForm.fabric_returned),
          rib_taken: parseFloat(cuttingForm.rib_taken),
          rib_returned: parseFloat(cuttingForm.rib_returned),
          cutting_rate_per_pcs: parseFloat(cuttingForm.cutting_rate_per_pcs)
        });
        toast.success("Cutting order created successfully");
      }
      
      setCuttingDialogOpen(false);
      setCuttingForm({
        cutting_lot_number: "",
        cutting_date: new Date().toISOString().split('T')[0],
        fabric_lot_id: "",
        lot_number: "",
        category: "Kids",
        style_type: "",
        fabric_taken: "",
        fabric_returned: "",
        rib_taken: "",
        rib_returned: "",
        cutting_rate_per_pcs: "",
        size_distribution: {}
      });
      setEditingCuttingOrder(null);
      fetchCuttingOrders();
      fetchFabricLots();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving cutting order:", error);
      toast.error("Failed to save cutting order");
    } finally {
      setLoading(false);
    }
  };

  const openEditCuttingOrder = (order) => {
    setEditingCuttingOrder(order);
    setCuttingForm({
      cutting_lot_number: order.cutting_lot_number || "",
      cutting_date: new Date(order.cutting_date).toISOString().split('T')[0],
      fabric_lot_id: order.fabric_lot_id,
      lot_number: order.lot_number,
      category: order.category,
      style_type: order.style_type,
      fabric_taken: order.fabric_taken.toString(),
      fabric_returned: order.fabric_returned.toString(),
      rib_taken: order.rib_taken.toString(),
      rib_returned: order.rib_returned.toString(),
      cutting_rate_per_pcs: (order.cutting_rate_per_pcs || 0).toString(),
      size_distribution: order.size_distribution
    });
    setCuttingDialogOpen(true);
  };

  const handleDeleteCuttingOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this cutting order?")) return;
    
    try {
      await axios.delete(`${API}/cutting-orders/${orderId}`);
      toast.success("Cutting order deleted successfully");
      fetchCuttingOrders();
      fetchFabricLots();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting cutting order:", error);
      toast.error("Failed to delete cutting order");
    }
  };

  const handleOutsourcingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/outsourcing-orders`, {
        ...outsourcingForm,
        dc_date: new Date(outsourcingForm.dc_date).toISOString(),
        rate_per_pcs: parseFloat(outsourcingForm.rate_per_pcs)
      });
      toast.success("Outsourcing order created successfully");
      
      setOutsourcingDialogOpen(false);
      setOutsourcingForm({
        dc_date: new Date().toISOString().split('T')[0],
        cutting_order_id: "",
        lot_number: "",
        category: "Kids",
        style_type: "",
        operation_type: "Printing",
        unit_name: "",
        rate_per_pcs: "",
        size_distribution: {}
      });
      fetchOutsourcingOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving outsourcing order:", error);
      toast.error("Failed to save outsourcing order");
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/outsourcing-receipts`, {
        ...receiptForm,
        receipt_date: new Date(receiptForm.receipt_date).toISOString()
      });
      toast.success("Receipt recorded successfully");
      
      setReceiptDialogOpen(false);
      setReceiptForm({
        outsourcing_order_id: "",
        receipt_date: new Date().toISOString().split('T')[0],
        received_distribution: {}
      });
      setSelectedOutsourcingOrder(null);
      fetchOutsourcingOrders();
      fetchOutsourcingReceipts();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving receipt:", error);
      toast.error("Failed to save receipt");
    } finally {
      setLoading(false);
    }
  };

  const handleSizeChange = (size, value, formSetter, currentForm) => {
    formSetter({
      ...currentForm,
      size_distribution: {
        ...currentForm.size_distribution,
        [size]: parseInt(value) || 0
      }
    });
  };

  const getTotalQty = (sizeDistribution) => {
    return Object.values(sizeDistribution).reduce((sum, val) => sum + (val || 0), 0);
  };

  const handlePrintDC = (orderId) => {
    window.open(`${API}/outsourcing-orders/${orderId}/dc`, '_blank');
  };

  const handleSendWhatsApp = async (orderId) => {
    try {
      const response = await axios.post(`${API}/outsourcing-orders/${orderId}/send-whatsapp`);
      toast.success("WhatsApp message sent!");
      toast.info(response.data.preview, { duration: 5000 });
      fetchOutsourcingOrders();
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      toast.error("Failed to send WhatsApp message");
    }
  };

  const openReceiptDialog = (order) => {
    setSelectedOutsourcingOrder(order);
    setReceiptForm({
      outsourcing_order_id: order.id,
      receipt_date: new Date().toISOString().split('T')[0],
      received_distribution: {}
    });
    setReceiptDialogOpen(true);
  };

  const getCategoryBadge = (category) => {
    const variants = {
      "Kids": "bg-purple-100 text-purple-800 border-purple-200",
      "Mens": "bg-blue-100 text-blue-800 border-blue-200",
      "Women": "bg-pink-100 text-pink-800 border-pink-200"
    };
    return <Badge className={`${variants[category]} border`} data-testid={`category-badge-${category.toLowerCase()}`}>{category}</Badge>;
  };

  const getStatusBadge = (status) => {
    const variants = {
      "Sent": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Received": "bg-green-100 text-green-800 border-green-200",
      "Partial": "bg-orange-100 text-orange-800 border-orange-200"
    };
    return <Badge className={`${variants[status]} border`} data-testid={`status-badge-${status.toLowerCase()}`}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2.5 rounded-xl shadow-lg">
                <Factory className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800" data-testid="app-title">Garment Manufacturing Pro</h1>
                <p className="text-sm text-slate-500">Complete Production Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 max-w-4xl mx-auto mb-8 bg-white shadow-md" data-testid="main-tabs">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-dashboard">
              <TrendingUp className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="fabric-lots" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-fabric-lots">
              <Package className="h-4 w-4 mr-2" />
              Fabric
            </TabsTrigger>
            <TabsTrigger value="cutting" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-cutting">
              <Scissors className="h-4 w-4 mr-2" />
              Cutting
            </TabsTrigger>
            <TabsTrigger value="outsourcing" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-outsourcing">
              <Send className="h-4 w-4 mr-2" />
              Outsourcing
            </TabsTrigger>
            <TabsTrigger value="receipts" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-receipts">
              <PackageCheck className="h-4 w-4 mr-2" />
              Receipts
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" data-testid="dashboard-content">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Dashboard Overview</h2>

              {stats && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-lg" data-testid="stat-card-lots">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                          <Package className="h-4 w-4 text-indigo-600" />
                          Fabric Lots
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-indigo-600">{stats.total_lots}</div>
                        <p className="text-xs text-slate-600 mt-1">{stats.total_fabric_stock} kg stock</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-lg" data-testid="stat-card-cutting">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                          <Scissors className="h-4 w-4 text-blue-600" />
                          Cutting Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.total_cutting_orders}</div>
                        <p className="text-xs text-slate-600 mt-1">₹{stats.total_cutting_cost} cutting cost</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-lg" data-testid="stat-card-outsourcing">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                          <Send className="h-4 w-4 text-orange-600" />
                          Outsourcing
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-600">{stats.total_outsourcing_orders}</div>
                        <p className="text-xs text-slate-600 mt-1">{stats.pending_outsourcing} pending</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200 shadow-lg" data-testid="stat-card-shortage">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          Shortage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600">{stats.total_shortage_pcs}</div>
                        <p className="text-xs text-slate-600 mt-1">₹{stats.total_shortage_debit} debit</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="shadow-lg" data-testid="production-summary">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Production Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            {getCategoryBadge('Kids')}
                          </div>
                          <div className="text-3xl font-bold text-purple-600">{stats.kids_production}</div>
                          <p className="text-sm text-slate-600">pieces produced</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            {getCategoryBadge('Mens')}
                          </div>
                          <div className="text-3xl font-bold text-blue-600">{stats.mens_production}</div>
                          <p className="text-sm text-slate-600">pieces produced</p>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                          <div className="flex items-center gap-2 mb-2">
                            {getCategoryBadge('Women')}
                          </div>
                          <div className="text-3xl font-bold text-pink-600">{stats.women_production}</div>
                          <p className="text-sm text-slate-600">pieces produced</p>
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <p className="text-sm text-slate-600">Total Production Cost</p>
                          <p className="text-2xl font-bold text-slate-800">₹{stats.total_production_cost}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <p className="text-sm text-slate-600">Total Outsourcing Cost</p>
                          <p className="text-2xl font-bold text-slate-800">₹{stats.total_outsourcing_cost}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Fabric Lots Tab */}
          <TabsContent value="fabric-lots" data-testid="fabric-lots-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Fabric Lot Inventory</h2>
                <Dialog open={lotDialogOpen} onOpenChange={setLotDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" data-testid="add-lot-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Fabric Lot
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="lot-dialog">
                    <DialogHeader>
                      <DialogTitle>Add New Fabric Lot</DialogTitle>
                      <DialogDescription>Enter fabric lot details below</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLotSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="lot-number">Lot Number</Label>
                          <Input id="lot-number" value={lotForm.lot_number} onChange={(e) => setLotForm({...lotForm, lot_number: e.target.value})} placeholder="LOT-001" required data-testid="lot-number-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entry-date">Entry Date</Label>
                          <Input id="entry-date" type="date" value={lotForm.entry_date} onChange={(e) => setLotForm({...lotForm, entry_date: e.target.value})} required data-testid="entry-date-input" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fabric-type">Fabric Type</Label>
                          <Input id="fabric-type" value={lotForm.fabric_type} onChange={(e) => setLotForm({...lotForm, fabric_type: e.target.value})} placeholder="Cotton" required data-testid="fabric-type-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-name">Supplier Name</Label>
                          <Input id="supplier-name" value={lotForm.supplier_name} onChange={(e) => setLotForm({...lotForm, supplier_name: e.target.value})} placeholder="ABC Textiles" required data-testid="supplier-name-input" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Color</Label>
                        <Input id="color" value={lotForm.color} onChange={(e) => setLotForm({...lotForm, color: e.target.value})} placeholder="Blue" required data-testid="color-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="quantity">Fabric Quantity (kg)</Label>
                          <Input id="quantity" type="number" step="0.01" value={lotForm.quantity} onChange={(e) => setLotForm({...lotForm, quantity: e.target.value})} placeholder="100" required data-testid="quantity-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rib-quantity">Rib Quantity (kg)</Label>
                          <Input id="rib-quantity" type="number" step="0.01" value={lotForm.rib_quantity} onChange={(e) => setLotForm({...lotForm, rib_quantity: e.target.value})} placeholder="20" required data-testid="rib-quantity-input" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rate-per-kg">Rate per kg (₹)</Label>
                        <Input id="rate-per-kg" type="number" step="0.01" value={lotForm.rate_per_kg} onChange={(e) => setLotForm({...lotForm, rate_per_kg: e.target.value})} placeholder="500" required data-testid="rate-per-kg-input" />
                      </div>
                      {lotForm.quantity && lotForm.rate_per_kg && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                          <p className="text-sm text-slate-600">Total Amount:</p>
                          <p className="text-2xl font-bold text-indigo-600">₹{(parseFloat(lotForm.quantity) * parseFloat(lotForm.rate_per_kg)).toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setLotDialogOpen(false)} data-testid="lot-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading} data-testid="lot-submit-button">
                          {loading ? "Saving..." : "Add Lot"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {fabricLots.map((lot) => (
                  <Card key={lot.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`lot-card-${lot.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">{lot.lot_number}</h3>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-xs text-indigo-600 hover:bg-indigo-50"
                              onClick={() => setBarcodeView(lot)}
                              data-testid={`view-barcode-${lot.id}`}
                            >
                              <Barcode className="h-4 w-4 mr-1" />
                              Barcode
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-500">Fabric Type</p>
                              <p className="font-semibold text-slate-800">{lot.fabric_type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Color</p>
                              <p className="font-semibold text-slate-800">{lot.color}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Supplier</p>
                              <p className="font-semibold text-slate-800">{lot.supplier_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Rate</p>
                              <p className="font-semibold text-indigo-600">₹{lot.rate_per_kg}/kg</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                            <div>
                              <p className="text-xs text-slate-500">Original Fabric</p>
                              <p className="font-bold text-green-600">{lot.quantity} kg</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Remaining</p>
                              <p className="font-bold text-blue-600">{lot.remaining_quantity} kg</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Original Rib</p>
                              <p className="font-bold text-green-600">{lot.rib_quantity} kg</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Remaining Rib</p>
                              <p className="font-bold text-blue-600">{lot.remaining_rib_quantity} kg</p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteLot(lot.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" data-testid={`delete-lot-${lot.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {fabricLots.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">No fabric lots in inventory</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Cutting Tab */}
          <TabsContent value="cutting" data-testid="cutting-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Cutting Operations</h2>
                <Dialog open={cuttingDialogOpen} onOpenChange={setCuttingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => { setEditingCuttingOrder(null); setCuttingForm({ cutting_lot_number: "", cutting_date: new Date().toISOString().split('T')[0], fabric_lot_id: "", lot_number: "", category: "Kids", style_type: "", fabric_taken: "", fabric_returned: "", rib_taken: "", rib_returned: "", cutting_rate_per_pcs: "", size_distribution: {} }); }} data-testid="add-cutting-button">
                      <Plus className="h-4 w-4 mr-2" />
                      New Cutting Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="cutting-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingCuttingOrder ? "Edit Cutting Order" : "Create Cutting Order"}</DialogTitle>
                      <DialogDescription>Enter cutting operation details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCuttingSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cutting-lot-number">Cutting Lot Number</Label>
                        <Input id="cutting-lot-number" value={cuttingForm.cutting_lot_number} onChange={(e) => setCuttingForm({...cuttingForm, cutting_lot_number: e.target.value})} placeholder="CUT-001" required data-testid="cutting-lot-number-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cutting-date">Cutting Date</Label>
                          <Input id="cutting-date" type="date" value={cuttingForm.cutting_date} onChange={(e) => setCuttingForm({...cuttingForm, cutting_date: e.target.value})} required data-testid="cutting-date-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fabric-lot">Select Fabric Lot</Label>
                          <Select value={cuttingForm.fabric_lot_id} onValueChange={(value) => {
                            const selectedLot = fabricLots.find(l => l.id === value);
                            setCuttingForm({...cuttingForm, fabric_lot_id: value, lot_number: selectedLot ? selectedLot.lot_number : ""});
                          }} required disabled={!!editingCuttingOrder}>
                            <SelectTrigger id="fabric-lot" data-testid="fabric-lot-select">
                              <SelectValue placeholder="Choose lot" />
                            </SelectTrigger>
                            <SelectContent>
                              {fabricLots.map((lot) => (
                                <SelectItem key={lot.id} value={lot.id}>
                                  {lot.lot_number} - {lot.fabric_type} ({lot.remaining_quantity} kg)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Select value={cuttingForm.category} onValueChange={(value) => setCuttingForm({...cuttingForm, category: value, size_distribution: {}})} required>
                            <SelectTrigger id="category" data-testid="category-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kids">Kids</SelectItem>
                              <SelectItem value="Mens">Mens</SelectItem>
                              <SelectItem value="Women">Women</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="style-type">Style Type</Label>
                          <Input id="style-type" value={cuttingForm.style_type} onChange={(e) => setCuttingForm({...cuttingForm, style_type: e.target.value})} placeholder="T-Shirt" required data-testid="style-type-input" />
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                        <h4 className="font-semibold text-slate-700">Fabric Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fabric-taken">Taken (kg)</Label>
                            <Input id="fabric-taken" type="number" step="0.01" value={cuttingForm.fabric_taken} onChange={(e) => setCuttingForm({...cuttingForm, fabric_taken: e.target.value})} required data-testid="fabric-taken-input" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fabric-returned">Returned (kg)</Label>
                            <Input id="fabric-returned" type="number" step="0.01" value={cuttingForm.fabric_returned} onChange={(e) => setCuttingForm({...cuttingForm, fabric_returned: e.target.value})} required data-testid="fabric-returned-input" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                        <h4 className="font-semibold text-slate-700">Rib Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="rib-taken">Taken (kg)</Label>
                            <Input id="rib-taken" type="number" step="0.01" value={cuttingForm.rib_taken} onChange={(e) => setCuttingForm({...cuttingForm, rib_taken: e.target.value})} required data-testid="rib-taken-input" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rib-returned">Returned (kg)</Label>
                            <Input id="rib-returned" type="number" step="0.01" value={cuttingForm.rib_returned} onChange={(e) => setCuttingForm({...cuttingForm, rib_returned: e.target.value})} required data-testid="rib-returned-input" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cutting-rate">Cutting Rate per Piece (₹)</Label>
                        <Input id="cutting-rate" type="number" step="0.01" value={cuttingForm.cutting_rate_per_pcs} onChange={(e) => setCuttingForm({...cuttingForm, cutting_rate_per_pcs: e.target.value})} placeholder="10" required data-testid="cutting-rate-input" />
                      </div>
                      <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="font-semibold text-slate-700">Size Distribution</h4>
                        <div className="grid grid-cols-4 gap-3">
                          {SIZE_CONFIG[cuttingForm.category].map((size) => (
                            <div key={size} className="space-y-1">
                              <Label htmlFor={`size-${size}`} className="text-xs">{size}</Label>
                              <Input 
                                id={`size-${size}`}
                                type="number" 
                                value={cuttingForm.size_distribution[size] || ''} 
                                onChange={(e) => handleSizeChange(size, e.target.value, setCuttingForm, cuttingForm)}
                                placeholder="0"
                                className="h-8"
                                data-testid={`size-input-${size}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-indigo-200">
                          <p className="text-sm text-slate-600">Total: {getTotalQty(cuttingForm.size_distribution)} pcs</p>
                          {cuttingForm.cutting_rate_per_pcs && (
                            <p className="text-lg font-bold text-indigo-600">Cutting Amount: ₹{(getTotalQty(cuttingForm.size_distribution) * parseFloat(cuttingForm.cutting_rate_per_pcs || 0)).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setCuttingDialogOpen(false)} data-testid="cutting-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || getTotalQty(cuttingForm.size_distribution) === 0} data-testid="cutting-submit-button">
                          {loading ? "Saving..." : "Create Order"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {cuttingOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`cutting-order-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">{order.cutting_lot_number || order.lot_number}</h3>
                            {getCategoryBadge(order.category)}
                            <Badge className="bg-slate-100 text-slate-700 border">{order.style_type}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-xs text-slate-500">Fabric Used</p>
                              <p className="font-bold text-indigo-600">{order.fabric_used} kg</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Rib Used</p>
                              <p className="font-bold text-purple-600">{order.rib_used} kg</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Total Qty</p>
                              <p className="font-bold text-green-600">{order.total_quantity} pcs</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Cutting Rate</p>
                              <p className="font-bold text-blue-600">₹{order.cutting_rate_per_pcs || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Cutting Amt</p>
                              <p className="font-bold text-orange-600">₹{order.total_cutting_amount || 0}</p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditCuttingOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-cutting-order-${order.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteCuttingOrder(order.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" data-testid={`delete-cutting-order-${order.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Outsourcing Tab */}
          <TabsContent value="outsourcing" data-testid="outsourcing-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Outsourcing Operations</h2>
                <Dialog open={outsourcingDialogOpen} onOpenChange={setOutsourcingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" data-testid="add-outsourcing-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Send to Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="outsourcing-dialog">
                    <DialogHeader>
                      <DialogTitle>Create Outsourcing Order</DialogTitle>
                      <DialogDescription>Send pieces to external unit</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleOutsourcingSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dc-date">DC Date</Label>
                          <Input id="dc-date" type="date" value={outsourcingForm.dc_date} onChange={(e) => setOutsourcingForm({...outsourcingForm, dc_date: e.target.value})} required data-testid="dc-date-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cutting-order">Select Cutting Order</Label>
                          <Select value={outsourcingForm.cutting_order_id} onValueChange={(value) => {
                            const selectedOrder = cuttingOrders.find(o => o.id === value);
                            if (selectedOrder) {
                              setOutsourcingForm({
                                ...outsourcingForm,
                                cutting_order_id: value,
                                lot_number: selectedOrder.lot_number,
                                category: selectedOrder.category,
                                style_type: selectedOrder.style_type,
                                size_distribution: selectedOrder.size_distribution
                              });
                            }
                          }} required>
                            <SelectTrigger id="cutting-order" data-testid="cutting-order-select">
                              <SelectValue placeholder="Choose order" />
                            </SelectTrigger>
                            <SelectContent>
                              {cuttingOrders.map((order) => (
                                <SelectItem key={order.id} value={order.id}>
                                  {order.lot_number} - {order.style_type} ({order.total_quantity} pcs)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="operation-type">Operation Type</Label>
                          <Select value={outsourcingForm.operation_type} onValueChange={(value) => setOutsourcingForm({...outsourcingForm, operation_type: value})} required>
                            <SelectTrigger id="operation-type" data-testid="operation-type-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATION_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit-name">Unit Name</Label>
                          <Input id="unit-name" value={outsourcingForm.unit_name} onChange={(e) => setOutsourcingForm({...outsourcingForm, unit_name: e.target.value})} placeholder="Unit Name" required data-testid="unit-name-input" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outsourcing-rate">Rate per Piece (₹)</Label>
                        <Input id="outsourcing-rate" type="number" step="0.01" value={outsourcingForm.rate_per_pcs} onChange={(e) => setOutsourcingForm({...outsourcingForm, rate_per_pcs: e.target.value})} placeholder="15" required data-testid="outsourcing-rate-input" />
                      </div>
                      {outsourcingForm.cutting_order_id && (
                        <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-slate-700">Size Distribution</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(outsourcingForm.size_distribution).map(([size, qty]) => (
                              qty > 0 && (
                                <div key={size} className="bg-white px-3 py-2 rounded border">
                                  <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                  <span className="text-sm font-bold text-indigo-600 ml-1">{qty}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="pt-2 border-t border-indigo-200">
                            <p className="text-sm text-slate-600">Total: {getTotalQty(outsourcingForm.size_distribution)} pcs</p>
                            {outsourcingForm.rate_per_pcs && (
                              <p className="text-lg font-bold text-indigo-600">Total Amount: ₹{(getTotalQty(outsourcingForm.size_distribution) * parseFloat(outsourcingForm.rate_per_pcs || 0)).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOutsourcingDialogOpen(false)} data-testid="outsourcing-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || !outsourcingForm.cutting_order_id} data-testid="outsourcing-submit-button">
                          {loading ? "Saving..." : "Create DC"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {outsourcingOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`outsourcing-order-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">{order.dc_number}</h3>
                            {getStatusBadge(order.status)}
                            <Badge className="bg-purple-100 text-purple-800 border border-purple-200">{order.operation_type}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-500">Lot Number</p>
                              <p className="font-semibold text-slate-800">{order.lot_number}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Unit Name</p>
                              <p className="font-semibold text-slate-800">{order.unit_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Total Qty</p>
                              <p className="font-bold text-green-600">{order.total_quantity} pcs</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Total Amount</p>
                              <p className="font-bold text-orange-600">₹{order.total_amount}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePrintDC(order.id)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              data-testid={`print-dc-${order.id}`}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Print DC
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleSendWhatsApp(order.id)}
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              data-testid={`whatsapp-${order.id}`}
                              disabled={order.whatsapp_sent}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              {order.whatsapp_sent ? "Sent" : "WhatsApp"}
                            </Button>
                            {order.status === 'Sent' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openReceiptDialog(order)}
                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                data-testid={`receive-${order.id}`}
                              >
                                <PackageCheck className="h-4 w-4 mr-1" />
                                Receive
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Receipts Tab */}
          <TabsContent value="receipts" data-testid="receipts-content">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Outsourcing Receipts</h2>

              <div className="space-y-4">
                {outsourcingReceipts.map((receipt) => (
                  <Card key={receipt.id} className="shadow-lg" data-testid={`receipt-card-${receipt.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-slate-800">{receipt.dc_number}</h3>
                          <Badge className="bg-purple-100 text-purple-800 border">{receipt.operation_type}</Badge>
                          {receipt.total_shortage > 0 && (
                            <Badge className="bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Shortage
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Unit</p>
                            <p className="font-semibold text-slate-800">{receipt.unit_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Sent</p>
                            <p className="font-bold text-blue-600">{receipt.total_sent} pcs</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Received</p>
                            <p className="font-bold text-green-600">{receipt.total_received} pcs</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Shortage</p>
                            <p className="font-bold text-red-600">{receipt.total_shortage} pcs</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Debit Amount</p>
                            <p className="font-bold text-red-600">₹{receipt.shortage_debit_amount}</p>
                          </div>
                        </div>
                        {receipt.total_shortage > 0 && (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <p className="text-xs text-slate-600 mb-2">Shortage Details:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(receipt.shortage_distribution).map(([size, qty]) => (
                                <div key={size} className="bg-white px-3 py-1 rounded border border-red-200">
                                  <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                  <span className="text-sm font-bold text-red-600 ml-1">{qty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {outsourcingReceipts.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <PackageCheck className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">No receipts recorded yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="receipt-dialog">
          <DialogHeader>
            <DialogTitle>Record Receipt</DialogTitle>
            <DialogDescription>
              {selectedOutsourcingOrder && `DC: ${selectedOutsourcingOrder.dc_number} - ${selectedOutsourcingOrder.unit_name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedOutsourcingOrder && (
            <form onSubmit={handleReceiptSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt-date">Receipt Date</Label>
                <Input id="receipt-date" type="date" value={receiptForm.receipt_date} onChange={(e) => setReceiptForm({...receiptForm, receipt_date: e.target.value})} required data-testid="receipt-date-input" />
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                <h4 className="font-semibold text-slate-700">Sent Quantities</h4>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(selectedOutsourcingOrder.size_distribution).map(([size, qty]) => (
                    qty > 0 && (
                      <div key={size} className="bg-white px-3 py-2 rounded border">
                        <span className="text-xs font-semibold text-slate-700">{size}:</span>
                        <span className="text-sm font-bold text-blue-600 ml-1">{qty}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
              <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-slate-700">Enter Received Quantities</h4>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(selectedOutsourcingOrder.size_distribution).map(([size, sentQty]) => (
                    sentQty > 0 && (
                      <div key={size} className="space-y-1">
                        <Label htmlFor={`received-${size}`} className="text-xs">{size} (Sent: {sentQty})</Label>
                        <Input 
                          id={`received-${size}`}
                          type="number" 
                          value={receiptForm.received_distribution[size] || ''} 
                          onChange={(e) => setReceiptForm({
                            ...receiptForm,
                            received_distribution: {
                              ...receiptForm.received_distribution,
                              [size]: parseInt(e.target.value) || 0
                            }
                          })}
                          placeholder="0"
                          max={sentQty}
                          className="h-8"
                          data-testid={`received-input-${size}`}
                        />
                      </div>
                    )
                  ))}
                </div>
                <div className="pt-2 border-t border-indigo-200">
                  <p className="text-sm text-slate-600">Total Received: {getTotalQty(receiptForm.received_distribution)} pcs</p>
                  <p className="text-sm text-slate-600">Total Sent: {selectedOutsourcingOrder.total_quantity} pcs</p>
                  {getTotalQty(receiptForm.received_distribution) < selectedOutsourcingOrder.total_quantity && (
                    <p className="text-lg font-bold text-red-600">Shortage: {selectedOutsourcingOrder.total_quantity - getTotalQty(receiptForm.received_distribution)} pcs</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setReceiptDialogOpen(false)} data-testid="receipt-cancel-button">Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading} data-testid="receipt-submit-button">
                  {loading ? "Saving..." : "Record Receipt"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode View Dialog */}
      <Dialog open={!!barcodeView} onOpenChange={(open) => !open && setBarcodeView(null)}>
        <DialogContent className="sm:max-w-[500px]" data-testid="barcode-dialog">
          <DialogHeader>
            <DialogTitle>Lot Barcode</DialogTitle>
            <DialogDescription>
              {barcodeView && `${barcodeView.lot_number} - ${barcodeView.fabric_type}`}
            </DialogDescription>
          </DialogHeader>
          {barcodeView && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-lg border-2 border-slate-200 flex justify-center">
                <img 
                  src={`${API}/fabric-lots/${barcodeView.id}/barcode`} 
                  alt={`Barcode for ${barcodeView.lot_number}`}
                  className="max-w-full"
                  data-testid="barcode-image"
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Lot Number:</span>
                  <span className="font-mono font-bold text-slate-800">{barcodeView.lot_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Fabric Type:</span>
                  <span className="font-semibold text-slate-800">{barcodeView.fabric_type}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setBarcodeView(null)}
                  data-testid="barcode-close-button"
                >
                  Close
                </Button>
                <Button 
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `${API}/fabric-lots/${barcodeView.id}/barcode`;
                    link.download = `barcode-${barcodeView.lot_number}.png`;
                    link.click();
                  }}
                  data-testid="barcode-download-button"
                >
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;