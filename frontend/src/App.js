import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, TrendingUp, ClipboardList, Plus, Pencil, Trash2, Factory, Barcode } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [fabrics, setFabrics] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Fabric form state
  const [fabricForm, setFabricForm] = useState({
    patch_number: "",
    name: "",
    fabric_type: "",
    color: "",
    quantity: "",
    unit: "kg",
    supplier: ""
  });
  const [editingFabric, setEditingFabric] = useState(null);
  const [fabricDialogOpen, setFabricDialogOpen] = useState(false);
  const [barcodeView, setBarcodeView] = useState(null);
  
  // Production order form state
  const [orderForm, setOrderForm] = useState({
    order_number: "",
    garment_type: "",
    fabric_id: "",
    fabric_name: "",
    fabric_quantity: "",
    production_quantity: "",
    status: "Pending",
    priority: "Medium",
    notes: ""
  });
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchFabrics();
    fetchProductionOrders();
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

  const fetchFabrics = async () => {
    try {
      const response = await axios.get(`${API}/fabrics`);
      setFabrics(response.data);
    } catch (error) {
      console.error("Error fetching fabrics:", error);
      toast.error("Failed to fetch fabrics");
    }
  };

  const fetchProductionOrders = async () => {
    try {
      const response = await axios.get(`${API}/production-orders`);
      setProductionOrders(response.data);
    } catch (error) {
      console.error("Error fetching production orders:", error);
      toast.error("Failed to fetch production orders");
    }
  };

  const handleFabricSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingFabric) {
        await axios.put(`${API}/fabrics/${editingFabric.id}`, {
          ...fabricForm,
          quantity: parseFloat(fabricForm.quantity)
        });
        toast.success("Fabric updated successfully");
      } else {
        await axios.post(`${API}/fabrics`, {
          ...fabricForm,
          quantity: parseFloat(fabricForm.quantity)
        });
        toast.success("Fabric added successfully");
      }
      
      setFabricDialogOpen(false);
      setFabricForm({
        name: "",
        fabric_type: "",
        color: "",
        quantity: "",
        unit: "meters",
        supplier: ""
      });
      setEditingFabric(null);
      fetchFabrics();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving fabric:", error);
      toast.error("Failed to save fabric");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFabric = async (fabricId) => {
    if (!window.confirm("Are you sure you want to delete this fabric?")) return;
    
    try {
      await axios.delete(`${API}/fabrics/${fabricId}`);
      toast.success("Fabric deleted successfully");
      fetchFabrics();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting fabric:", error);
      toast.error("Failed to delete fabric");
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingOrder) {
        await axios.put(`${API}/production-orders/${editingOrder.id}`, {
          status: orderForm.status,
          priority: orderForm.priority,
          notes: orderForm.notes,
          completion_date: orderForm.status === "Completed" ? new Date().toISOString() : null
        });
        toast.success("Production order updated successfully");
      } else {
        await axios.post(`${API}/production-orders`, {
          ...orderForm,
          fabric_quantity: parseFloat(orderForm.fabric_quantity),
          production_quantity: parseInt(orderForm.production_quantity)
        });
        toast.success("Production order created successfully");
      }
      
      setOrderDialogOpen(false);
      setOrderForm({
        order_number: "",
        garment_type: "",
        fabric_id: "",
        fabric_name: "",
        fabric_quantity: "",
        production_quantity: "",
        status: "Pending",
        priority: "Medium",
        notes: ""
      });
      setEditingOrder(null);
      fetchProductionOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to save production order");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this production order?")) return;
    
    try {
      await axios.delete(`${API}/production-orders/${orderId}`);
      toast.success("Production order deleted successfully");
      fetchProductionOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete production order");
    }
  };

  const openEditFabric = (fabric) => {
    setEditingFabric(fabric);
    setFabricForm({
      patch_number: fabric.patch_number,
      name: fabric.name,
      fabric_type: fabric.fabric_type,
      color: fabric.color,
      quantity: fabric.quantity.toString(),
      unit: fabric.unit,
      supplier: fabric.supplier
    });
    setFabricDialogOpen(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder(order);
    setOrderForm({
      order_number: order.order_number,
      garment_type: order.garment_type,
      fabric_id: order.fabric_id,
      fabric_name: order.fabric_name,
      fabric_quantity: order.fabric_quantity.toString(),
      production_quantity: order.production_quantity.toString(),
      status: order.status,
      priority: order.priority,
      notes: order.notes || ""
    });
    setOrderDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const variants = {
      "Pending": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
      "Completed": "bg-green-100 text-green-800 border-green-200",
      "Cancelled": "bg-red-100 text-red-800 border-red-200"
    };
    return <Badge className={`${variants[status]} border`} data-testid={`status-badge-${status.toLowerCase().replace(' ', '-')}`}>{status}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const variants = {
      "Low": "bg-gray-100 text-gray-700 border-gray-200",
      "Medium": "bg-orange-100 text-orange-700 border-orange-200",
      "High": "bg-red-100 text-red-700 border-red-200"
    };
    return <Badge className={`${variants[priority]} border`} data-testid={`priority-badge-${priority.toLowerCase()}`}>{priority}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg">
                <Factory className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800" data-testid="app-title">Garment Manufacturing Tracker</h1>
                <p className="text-sm text-slate-500">Fabric & Production Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto mb-8 bg-white shadow-md" data-testid="main-tabs">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white" data-testid="tab-dashboard">
              <TrendingUp className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="fabrics" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white" data-testid="tab-fabrics">
              <Package className="h-4 w-4 mr-2" />
              Fabrics
            </TabsTrigger>
            <TabsTrigger value="production" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white" data-testid="tab-production">
              <ClipboardList className="h-4 w-4 mr-2" />
              Production
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" data-testid="dashboard-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Dashboard Overview</h2>
              </div>

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-lg hover:shadow-xl transition-shadow" data-testid="stat-card-fabrics">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Total Fabrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-blue-600" data-testid="total-fabrics-count">{stats.total_fabrics}</div>
                      <p className="text-sm text-slate-600 mt-1">{stats.total_fabric_quantity} units in stock</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg hover:shadow-xl transition-shadow" data-testid="stat-card-completed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-green-600" />
                        Completed Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-green-600" data-testid="completed-orders-count">{stats.completed_orders}</div>
                      <p className="text-sm text-slate-600 mt-1">Total: {stats.total_orders} orders</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-lg hover:shadow-xl transition-shadow" data-testid="stat-card-active">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-orange-600" />
                        Active Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-orange-600" data-testid="active-orders-count">{stats.active_orders}</div>
                      <p className="text-sm text-slate-600 mt-1">{stats.pending_orders} pending orders</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <Card className="shadow-lg" data-testid="recent-fabrics-card">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-800">Recent Fabrics</CardTitle>
                    <CardDescription>Latest fabric inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {fabrics.slice(0, 5).map((fabric) => (
                        <div key={fabric.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`fabric-item-${fabric.id}`}>
                          <div>
                            <p className="font-semibold text-slate-800">{fabric.name}</p>
                            <p className="text-sm text-slate-500">{fabric.fabric_type} - {fabric.color}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{fabric.quantity} {fabric.unit}</p>
                            <p className="text-xs text-slate-500">{fabric.supplier}</p>
                          </div>
                        </div>
                      ))}
                      {fabrics.length === 0 && (
                        <p className="text-center text-slate-500 py-6" data-testid="no-fabrics-message">No fabrics added yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg" data-testid="recent-orders-card">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-800">Recent Production Orders</CardTitle>
                    <CardDescription>Latest production activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {productionOrders.slice(0, 5).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`order-item-${order.id}`}>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{order.order_number}</p>
                            <p className="text-sm text-slate-500">{order.garment_type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getPriorityBadge(order.priority)}
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      ))}
                      {productionOrders.length === 0 && (
                        <p className="text-center text-slate-500 py-6" data-testid="no-orders-message">No production orders yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Fabrics Tab */}
          <TabsContent value="fabrics" data-testid="fabrics-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Fabric Inventory</h2>
                <Dialog open={fabricDialogOpen} onOpenChange={setFabricDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg" onClick={() => { setEditingFabric(null); setFabricForm({ patch_number: "", name: "", fabric_type: "", color: "", quantity: "", unit: "kg", supplier: "" }); }} data-testid="add-fabric-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Fabric
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]" data-testid="fabric-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingFabric ? "Edit Fabric" : "Add New Fabric"}</DialogTitle>
                      <DialogDescription>Enter fabric details below</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFabricSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="patch-number">Patch Number</Label>
                        <Input id="patch-number" value={fabricForm.patch_number} onChange={(e) => setFabricForm({...fabricForm, patch_number: e.target.value})} placeholder="Auto-generated if left empty" data-testid="patch-number-input" />
                        <p className="text-xs text-slate-500">Leave empty to auto-generate</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fabric-name">Fabric Name</Label>
                        <Input id="fabric-name" value={fabricForm.name} onChange={(e) => setFabricForm({...fabricForm, name: e.target.value})} placeholder="Cotton Blend" required data-testid="fabric-name-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fabric-type">Type</Label>
                          <Input id="fabric-type" value={fabricForm.fabric_type} onChange={(e) => setFabricForm({...fabricForm, fabric_type: e.target.value})} placeholder="Cotton, Silk, etc." required data-testid="fabric-type-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fabric-color">Color</Label>
                          <Input id="fabric-color" value={fabricForm.color} onChange={(e) => setFabricForm({...fabricForm, color: e.target.value})} placeholder="Blue, Red, etc." required data-testid="fabric-color-input" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fabric-quantity">Quantity</Label>
                          <Input id="fabric-quantity" type="number" step="0.01" value={fabricForm.quantity} onChange={(e) => setFabricForm({...fabricForm, quantity: e.target.value})} placeholder="100" required data-testid="fabric-quantity-input" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fabric-unit">Unit</Label>
                          <Select value={fabricForm.unit} onValueChange={(value) => setFabricForm({...fabricForm, unit: value})}>
                            <SelectTrigger id="fabric-unit" data-testid="fabric-unit-select">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">Kilograms (kg)</SelectItem>
                              <SelectItem value="meters">Meters</SelectItem>
                              <SelectItem value="yards">Yards</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fabric-supplier">Supplier</Label>
                        <Input id="fabric-supplier" value={fabricForm.supplier} onChange={(e) => setFabricForm({...fabricForm, supplier: e.target.value})} placeholder="Supplier Name" required data-testid="fabric-supplier-input" />
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setFabricDialogOpen(false)} data-testid="fabric-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading} data-testid="fabric-submit-button">
                          {loading ? "Saving..." : editingFabric ? "Update" : "Add Fabric"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fabrics.map((fabric) => (
                  <Card key={fabric.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`fabric-card-${fabric.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-slate-800">{fabric.name}</CardTitle>
                          <CardDescription>{fabric.fabric_type}</CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditFabric(fabric)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-fabric-${fabric.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteFabric(fabric.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" data-testid={`delete-fabric-${fabric.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="bg-slate-100 p-2 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Barcode className="h-4 w-4 text-slate-600" />
                            <span className="text-xs font-mono text-slate-700">{fabric.patch_number}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-blue-600 hover:bg-blue-50"
                            onClick={() => setBarcodeView(fabric)}
                            data-testid={`view-barcode-${fabric.id}`}
                          >
                            View
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Color:</span>
                          <span className="font-semibold text-slate-800">{fabric.color}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Quantity:</span>
                          <span className="font-bold text-blue-600" data-testid={`fabric-quantity-${fabric.id}`}>{fabric.quantity} {fabric.unit}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Supplier:</span>
                          <span className="text-sm font-medium text-slate-700">{fabric.supplier}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {fabrics.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg" data-testid="empty-fabrics-message">No fabrics in inventory</p>
                    <p className="text-slate-400 text-sm">Click "Add Fabric" to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Production Tab */}
          <TabsContent value="production" data-testid="production-content">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Production Orders</h2>
                <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg" onClick={() => { setEditingOrder(null); setOrderForm({ order_number: "", garment_type: "", fabric_id: "", fabric_name: "", fabric_quantity: "", production_quantity: "", status: "Pending", priority: "Medium", notes: "" }); }} data-testid="add-order-button">
                      <Plus className="h-4 w-4 mr-2" />
                      New Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]" data-testid="order-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingOrder ? "Edit Production Order" : "Create Production Order"}</DialogTitle>
                      <DialogDescription>Enter production order details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleOrderSubmit} className="space-y-4">
                      {!editingOrder && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="order-number">Order Number</Label>
                            <Input id="order-number" value={orderForm.order_number} onChange={(e) => setOrderForm({...orderForm, order_number: e.target.value})} placeholder="ORD-001" required data-testid="order-number-input" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="garment-type">Garment Type</Label>
                            <Input id="garment-type" value={orderForm.garment_type} onChange={(e) => setOrderForm({...orderForm, garment_type: e.target.value})} placeholder="T-Shirt, Pants, etc." required data-testid="garment-type-input" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fabric-select">Select Fabric</Label>
                            <Select value={orderForm.fabric_id} onValueChange={(value) => {
                              const selectedFabric = fabrics.find(f => f.id === value);
                              setOrderForm({...orderForm, fabric_id: value, fabric_name: selectedFabric ? selectedFabric.name : ""});
                            }} required>
                              <SelectTrigger id="fabric-select" data-testid="fabric-select">
                                <SelectValue placeholder="Choose fabric" />
                              </SelectTrigger>
                              <SelectContent>
                                {fabrics.map((fabric) => (
                                  <SelectItem key={fabric.id} value={fabric.id}>
                                    {fabric.name} ({fabric.quantity} {fabric.unit} available)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="fabric-quantity">Fabric Quantity</Label>
                              <Input id="fabric-quantity" type="number" step="0.01" value={orderForm.fabric_quantity} onChange={(e) => setOrderForm({...orderForm, fabric_quantity: e.target.value})} placeholder="10" required data-testid="order-fabric-quantity-input" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="production-quantity">Production Qty</Label>
                              <Input id="production-quantity" type="number" value={orderForm.production_quantity} onChange={(e) => setOrderForm({...orderForm, production_quantity: e.target.value})} placeholder="100" required data-testid="production-quantity-input" />
                            </div>
                          </div>
                        </>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="order-status">Status</Label>
                          <Select value={orderForm.status} onValueChange={(value) => setOrderForm({...orderForm, status: value})} required>
                            <SelectTrigger id="order-status" data-testid="order-status-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="In Progress">In Progress</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="order-priority">Priority</Label>
                          <Select value={orderForm.priority} onValueChange={(value) => setOrderForm({...orderForm, priority: value})} required>
                            <SelectTrigger id="order-priority" data-testid="order-priority-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="order-notes">Notes</Label>
                        <Textarea id="order-notes" value={orderForm.notes} onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})} placeholder="Additional notes..." rows={3} data-testid="order-notes-input" />
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOrderDialogOpen(false)} data-testid="order-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading} data-testid="order-submit-button">
                          {loading ? "Saving..." : editingOrder ? "Update" : "Create Order"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {productionOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`order-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">{order.order_number}</h3>
                            {getPriorityBadge(order.priority)}
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-500">Garment Type</p>
                              <p className="font-semibold text-slate-800">{order.garment_type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Fabric</p>
                              <p className="font-semibold text-slate-800">{order.fabric_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Fabric Used</p>
                              <p className="font-semibold text-blue-600" data-testid={`order-fabric-used-${order.id}`}>{order.fabric_quantity} units</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Production Qty</p>
                              <p className="font-semibold text-slate-800" data-testid={`order-production-qty-${order.id}`}>{order.production_quantity} pieces</p>
                            </div>
                          </div>
                          {order.notes && (
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-xs text-slate-500 mb-1">Notes</p>
                              <p className="text-sm text-slate-700">{order.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button size="icon" variant="ghost" onClick={() => openEditOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-order-${order.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteOrder(order.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" data-testid={`delete-order-${order.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {productionOrders.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <ClipboardList className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg" data-testid="empty-orders-message">No production orders</p>
                    <p className="text-slate-400 text-sm">Click "New Order" to create one</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;