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
import { Package, TrendingUp, Scissors, Plus, Trash2, Factory, Barcode, Users, Send, Printer, PackageCheck, AlertCircle, Pencil, DollarSign, FileText, BookOpen } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SIZE_CONFIG = {
  Kids: ['2/3', '3/4', '5/6', '7/8', '9/10', '11/12', '13/14'],
  Mens: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'],
  Women: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL']
};

const BUNDLE_TYPES = ['Front', 'Back', 'Sleeve', 'Rib', 'Patti', 'Collar', 'Front L Panel', 'Front R Panel', 'Back L Panel', 'Back R Panel'];

const OPERATION_TYPES = ['Printing', 'Embroidery', 'Stone', 'Sequins', 'Sticker', 'Stitching'];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [fabricLots, setFabricLots] = useState([]);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [outsourcingOrders, setOutsourcingOrders] = useState([]);
  const [outsourcingReceipts, setOutsourcingReceipts] = useState([]);
  const [ironingOrders, setIroningOrders] = useState([]);
  const [ironingReceipts, setIroningReceipts] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Fabric lot form state
  const [lotForm, setLotForm] = useState({
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
    cutting_master_name: "",
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
    size_distribution: {},
    bundle_distribution: {}
  });
  const [cuttingDialogOpen, setCuttingDialogOpen] = useState(false);
  const [editingCuttingOrder, setEditingCuttingOrder] = useState(null);
  
  // Payment form state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    notes: ""
  });
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState(null);
  const [paymentType, setPaymentType] = useState(""); // "cutting" or "outsourcing"
  
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
  const [editingOutsourcingOrder, setEditingOutsourcingOrder] = useState(null);
  
  // Receipt form state
  const [receiptForm, setReceiptForm] = useState({
    outsourcing_order_id: "",
    receipt_date: new Date().toISOString().split('T')[0],
    received_distribution: {}
  });
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedOutsourcingOrder, setSelectedOutsourcingOrder] = useState(null);
  
  // Ironing form state
  const [ironingForm, setIroningForm] = useState({
    dc_date: new Date().toISOString().split('T')[0],
    receipt_id: "",
    unit_name: "",
    rate_per_pcs: ""
  });
  const [ironingDialogOpen, setIroningDialogOpen] = useState(false);
  
  // Ironing receipt form state
  const [ironingReceiptForm, setIroningReceiptForm] = useState({
    ironing_order_id: "",
    receipt_date: new Date().toISOString().split('T')[0],
    received_distribution: {}
  });
  const [ironingReceiptDialogOpen, setIroningReceiptDialogOpen] = useState(false);
  const [selectedIroningOrder, setSelectedIroningOrder] = useState(null);
  
  // Catalog form state
  const [catalogForm, setCatalogForm] = useState({
    catalog_name: "",
    catalog_code: "",
    description: "",
    lot_numbers: []
  });
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({});
  
  const [barcodeView, setBarcodeView] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchFabricLots();
    fetchCuttingOrders();
    fetchOutsourcingOrders();
    fetchOutsourcingReceipts();
    fetchIroningOrders();
    fetchIroningReceipts();
    fetchCatalogs();
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

  const fetchIroningOrders = async () => {
    try {
      const response = await axios.get(`${API}/ironing-orders`);
      setIroningOrders(response.data);
    } catch (error) {
      console.error("Error fetching ironing orders:", error);
      toast.error("Failed to fetch ironing orders");
    }
  };

  const fetchIroningReceipts = async () => {
    try {
      const response = await axios.get(`${API}/ironing-receipts`);
      setIroningReceipts(response.data);
    } catch (error) {
      console.error("Error fetching ironing receipts:", error);
      toast.error("Failed to fetch ironing receipts");
    }
  };

  const fetchCatalogs = async () => {
    try {
      const response = await axios.get(`${API}/catalogs`);
      setCatalogs(response.data);
    } catch (error) {
      console.error("Error fetching catalogs:", error);
      toast.error("Failed to fetch catalogs");
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
        cutting_master_name: "",
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
      cutting_master_name: order.cutting_master_name || "",
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

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = paymentType === "cutting" 
        ? `${API}/cutting-orders/${selectedPaymentOrder.id}/payment`
        : `${API}/outsourcing-orders/${selectedPaymentOrder.id}/payment`;
      
      await axios.post(endpoint, {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes
      });
      
      toast.success("Payment recorded successfully");
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", payment_method: "Cash", notes: "" });
      setSelectedPaymentOrder(null);
      
      if (paymentType === "cutting") {
        fetchCuttingOrders();
      } else {
        fetchOutsourcingOrders();
      }
      fetchDashboardStats();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (order, type) => {
    setSelectedPaymentOrder(order);
    setPaymentType(type);
    setPaymentForm({ amount: "", payment_method: "Cash", notes: "" });
    setPaymentDialogOpen(true);
  };

  const handleGenerateBillReport = () => {
    window.open(`${API}/reports/bills`, '_blank');
  };

  const getPaymentStatusBadge = (status) => {
    const variants = {
      "Paid": "bg-green-100 text-green-800 border-green-200",
      "Partial": "bg-orange-100 text-orange-800 border-orange-200",
      "Unpaid": "bg-red-100 text-red-800 border-red-200"
    };
    return <Badge className={`${variants[status]} border`} data-testid={`payment-status-${status.toLowerCase()}`}>{status}</Badge>;
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
      if (editingOutsourcingOrder) {
        await axios.put(`${API}/outsourcing-orders/${editingOutsourcingOrder.id}`, {
          dc_date: new Date(outsourcingForm.dc_date).toISOString(),
          operation_type: outsourcingForm.operation_type,
          unit_name: outsourcingForm.unit_name,
          rate_per_pcs: parseFloat(outsourcingForm.rate_per_pcs),
          size_distribution: outsourcingForm.size_distribution
        });
        toast.success("Outsourcing order updated successfully");
      } else {
        await axios.post(`${API}/outsourcing-orders`, {
          ...outsourcingForm,
          dc_date: new Date(outsourcingForm.dc_date).toISOString(),
          rate_per_pcs: parseFloat(outsourcingForm.rate_per_pcs)
        });
        toast.success("Outsourcing order created successfully");
      }
      
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
      setEditingOutsourcingOrder(null);
      fetchOutsourcingOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving outsourcing order:", error);
      toast.error("Failed to save outsourcing order");
    } finally {
      setLoading(false);
    }
  };

  const openEditOutsourcingOrder = (order) => {
    setEditingOutsourcingOrder(order);
    setOutsourcingForm({
      dc_date: new Date(order.dc_date).toISOString().split('T')[0],
      cutting_order_id: order.cutting_order_id,
      lot_number: order.lot_number,
      category: order.category,
      style_type: order.style_type,
      operation_type: order.operation_type,
      unit_name: order.unit_name,
      rate_per_pcs: order.rate_per_pcs.toString(),
      size_distribution: order.size_distribution
    });
    setOutsourcingDialogOpen(true);
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

  const handleIroningSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/ironing-orders`, {
        ...ironingForm,
        dc_date: new Date(ironingForm.dc_date).toISOString(),
        rate_per_pcs: parseFloat(ironingForm.rate_per_pcs)
      });
      toast.success("Ironing order created successfully");
      
      setIroningDialogOpen(false);
      setIroningForm({
        dc_date: new Date().toISOString().split('T')[0],
        receipt_id: "",
        unit_name: "",
        rate_per_pcs: ""
      });
      fetchIroningOrders();
      fetchOutsourcingReceipts();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error creating ironing order:", error);
      toast.error(error.response?.data?.detail || "Failed to create ironing order");
    } finally {
      setLoading(false);
    }
  };

  const handleIroningReceiptSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/ironing-receipts`, {
        ...ironingReceiptForm,
        receipt_date: new Date(ironingReceiptForm.receipt_date).toISOString()
      });
      toast.success("Ironing receipt recorded successfully");
      
      setIroningReceiptDialogOpen(false);
      setIroningReceiptForm({
        ironing_order_id: "",
        receipt_date: new Date().toISOString().split('T')[0],
        received_distribution: {}
      });
      setSelectedIroningOrder(null);
      fetchIroningOrders();
      fetchIroningReceipts();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving ironing receipt:", error);
      toast.error("Failed to save ironing receipt");
    } finally {
      setLoading(false);
    }
  };

  const handleIroningPayment = async (orderId, amount) => {
    try {
      await axios.post(`${API}/ironing-orders/${orderId}/payment`, {
        amount: parseFloat(amount),
        payment_method: "Cash",
        notes: ""
      });
      toast.success("Payment recorded successfully");
      fetchIroningOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handlePrintIroningDC = (orderId) => {
    window.open(`${API}/ironing-orders/${orderId}/dc`, '_blank');
  };

  const handleDeleteIroningOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this ironing order?")) return;
    
    try {
      await axios.delete(`${API}/ironing-orders/${orderId}`);
      toast.success("Ironing order deleted successfully");
      fetchIroningOrders();
      fetchOutsourcingReceipts();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error deleting ironing order:", error);
      toast.error("Failed to delete ironing order");
    }
  };

  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/catalogs`, catalogForm);
      toast.success("Catalog created successfully");
      
      setCatalogDialogOpen(false);
      setCatalogForm({
        catalog_name: "",
        catalog_code: "",
        description: "",
        lot_numbers: []
      });
      fetchCatalogs();
    } catch (error) {
      console.error("Error creating catalog:", error);
      toast.error(error.response?.data?.detail || "Failed to create catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/catalogs/${selectedCatalog.id}/dispatch`, {
        dispatch_quantity: dispatchForm
      });
      toast.success("Dispatch recorded successfully");
      
      setDispatchDialogOpen(false);
      setDispatchForm({});
      setSelectedCatalog(null);
      fetchCatalogs();
    } catch (error) {
      console.error("Error recording dispatch:", error);
      toast.error(error.response?.data?.detail || "Failed to record dispatch");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCatalog = async (catalogId) => {
    if (!window.confirm("Are you sure you want to delete this catalog?")) return;
    
    try {
      await axios.delete(`${API}/catalogs/${catalogId}`);
      toast.success("Catalog deleted successfully");
      fetchCatalogs();
    } catch (error) {
      console.error("Error deleting catalog:", error);
      toast.error("Failed to delete catalog");
    }
  };

  const handleLotToggle = (lotNumber) => {
    setCatalogForm(prev => ({
      ...prev,
      lot_numbers: prev.lot_numbers.includes(lotNumber)
        ? prev.lot_numbers.filter(l => l !== lotNumber)
        : [...prev.lot_numbers, lotNumber]
    }));
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
            <Button 
              onClick={handleGenerateBillReport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
              data-testid="generate-bill-report"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Bill Report
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8 max-w-7xl mx-auto mb-8 bg-white shadow-md" data-testid="main-tabs">
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
            <TabsTrigger value="ironing" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-ironing">
              <Factory className="h-4 w-4 mr-2" />
              Ironing
            </TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-catalog">
              <BookOpen className="h-4 w-4 mr-2" />
              Catalog
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
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
                      <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <p className="text-sm text-slate-600">Fabric Cost</p>
                            <p className="text-xl font-bold text-blue-700">₹{stats.total_production_cost}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <p className="text-sm text-slate-600">Cutting Cost</p>
                            <p className="text-xl font-bold text-green-700">₹{stats.total_cutting_cost}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <p className="text-sm text-slate-600">Outsourcing Cost</p>
                            <p className="text-xl font-bold text-purple-700">₹{stats.total_outsourcing_cost}</p>
                          </div>
                          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <p className="text-sm text-slate-600">Ironing Cost</p>
                            <p className="text-xl font-bold text-amber-700">₹{stats.total_ironing_cost || 0}</p>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 rounded-lg text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm opacity-90">Comprehensive Total</p>
                              <p className="text-xs opacity-75 mt-1">Fabric + Cutting + Outsourcing + Ironing - Shortage Debit</p>
                            </div>
                            <div className="text-right">
                              <p className="text-4xl font-bold">\u20b9{stats.comprehensive_total}</p>
                              {(stats.total_shortage_debit + (stats.total_ironing_shortage_debit || 0)) > 0 && (
                                <p className="text-sm opacity-90 mt-1">(-\u20b9{stats.total_shortage_debit + (stats.total_ironing_shortage_debit || 0)} debit)</p>
                              )}
                            </div>
                          </div>
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
                      <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 mb-4">
                        <p className="text-sm text-indigo-700">
                          <strong>ℹ️ Lot Number:</strong> Will be auto-generated (e.g., lot 001, lot 002, etc.)
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
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
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => { setEditingCuttingOrder(null); setCuttingForm({ cutting_lot_number: "", cutting_master_name: "", cutting_date: new Date().toISOString().split('T')[0], fabric_lot_id: "", lot_number: "", category: "Kids", style_type: "", fabric_taken: "", fabric_returned: "", rib_taken: "", rib_returned: "", cutting_rate_per_pcs: "", size_distribution: {} }); }} data-testid="add-cutting-button">
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
                      <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 mb-4">
                        <p className="text-sm text-indigo-700">
                          <strong>ℹ️ Cutting Lot Number:</strong> Will be auto-generated (e.g., cut 001, cut 002, etc.)
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cutting-master-name">Cutting Master Name</Label>
                          <Input id="cutting-master-name" value={cuttingForm.cutting_master_name} onChange={(e) => setCuttingForm({...cuttingForm, cutting_master_name: e.target.value})} placeholder="Master Name" required data-testid="cutting-master-name-input" />
                        </div>
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
                      <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <h4 className="font-semibold text-slate-700">Bundle Distribution</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {BUNDLE_TYPES.map((bundle) => (
                            <div key={bundle} className="space-y-1">
                              <Label htmlFor={`bundle-${bundle}`} className="text-xs">{bundle}</Label>
                              <Input 
                                id={`bundle-${bundle}`}
                                type="number" 
                                value={cuttingForm.bundle_distribution[bundle] || ''} 
                                onChange={(e) => setCuttingForm({
                                  ...cuttingForm,
                                  bundle_distribution: {
                                    ...cuttingForm.bundle_distribution,
                                    [bundle]: parseInt(e.target.value) || 0
                                  }
                                })}
                                placeholder="0"
                                className="h-8"
                                data-testid={`bundle-input-${bundle}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-amber-200">
                          <p className="text-sm text-slate-600">Total Bundles: {getTotalQty(cuttingForm.bundle_distribution)} pcs</p>
                        </div>
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
                            {getPaymentStatusBadge(order.payment_status || "Unpaid")}
                          </div>
                          {order.cutting_master_name && (
                            <div className="text-sm text-slate-600">
                              <span className="font-semibold">Master:</span> {order.cutting_master_name}
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-xs text-slate-500">Total Qty</p>
                              <p className="font-bold text-green-600">{order.total_quantity} pcs</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Total Amount</p>
                              <p className="font-bold text-indigo-600">₹{order.total_cutting_amount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Paid</p>
                              <p className="font-bold text-green-600">₹{order.amount_paid || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Balance</p>
                              <p className="font-bold text-red-600">₹{order.balance || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Fabric Used</p>
                              <p className="font-bold text-purple-600">{order.fabric_used} kg</p>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            {(order.payment_status !== "Paid") && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openPaymentDialog(order, "cutting")}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                data-testid={`pay-cutting-${order.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Add Payment
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`${API}/cutting-orders/${order.id}/lot-report`, '_blank')}
                            className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            data-testid={`lot-report-${order.id}`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Lot Report
                          </Button>
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
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => { setEditingOutsourcingOrder(null); setOutsourcingForm({ dc_date: new Date().toISOString().split('T')[0], cutting_order_id: "", lot_number: "", category: "Kids", style_type: "", operation_type: "Printing", unit_name: "", rate_per_pcs: "", size_distribution: {} }); }} data-testid="add-outsourcing-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Send to Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="outsourcing-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingOutsourcingOrder ? "Edit Outsourcing Order" : "Create Outsourcing Order"}</DialogTitle>
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
                          }} required disabled={!!editingOutsourcingOrder}>
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
                          {loading ? "Saving..." : editingOutsourcingOrder ? "Update Order" : "Create DC"}
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
                            {getPaymentStatusBadge(order.payment_status || "Unpaid")}
                          </div>
                          {order.cutting_lot_number && (
                            <div className="text-sm text-slate-600 bg-indigo-50 px-3 py-1 rounded inline-block">
                              <span className="font-semibold">Cutting Lot:</span> {order.cutting_lot_number}
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                              <p className="font-bold text-indigo-600">₹{order.total_amount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Paid</p>
                              <p className="font-bold text-green-600">₹{order.amount_paid || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Balance</p>
                              <p className="font-bold text-red-600">₹{order.balance || 0}</p>
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
                            {(order.payment_status !== "Paid") && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openPaymentDialog(order, "outsourcing")}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                data-testid={`pay-outsourcing-${order.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Pay
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditOutsourcingOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-outsourcing-order-${order.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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

          {/* Ironing Tab */}
          <TabsContent value="ironing" data-testid="ironing-content">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Ironing Orders</h2>
                <Dialog open={ironingDialogOpen} onOpenChange={setIroningDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg" data-testid="add-ironing-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Send to Ironing
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]" data-testid="ironing-dialog">
                    <DialogHeader>
                      <DialogTitle>Send to Ironing Unit</DialogTitle>
                      <DialogDescription>Create a new ironing order from received stitching items</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleIroningSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="ironing-dc-date">DC Date</Label>
                        <Input id="ironing-dc-date" type="date" value={ironingForm.dc_date} onChange={(e) => setIroningForm({...ironingForm, dc_date: e.target.value})} required data-testid="ironing-dc-date-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ironing-receipt">Select Stitching Receipt</Label>
                        <Select 
                          value={ironingForm.receipt_id} 
                          onValueChange={(value) => setIroningForm({...ironingForm, receipt_id: value})}
                          data-testid="ironing-receipt-select"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select receipt" />
                          </SelectTrigger>
                          <SelectContent>
                            {outsourcingReceipts
                              .filter(r => {
                                const order = outsourcingOrders.find(o => o.id === r.outsourcing_order_id);
                                return order?.operation_type === 'Stitching' && !r.sent_to_ironing;
                              })
                              .map((receipt) => {
                                const order = outsourcingOrders.find(o => o.id === receipt.outsourcing_order_id);
                                return (
                                  <SelectItem key={receipt.id} value={receipt.id}>
                                    {receipt.dc_number} - {order?.unit_name} ({receipt.total_received} pcs)
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ironing-unit">Ironing Unit Name</Label>
                        <Input id="ironing-unit" value={ironingForm.unit_name} onChange={(e) => setIroningForm({...ironingForm, unit_name: e.target.value})} required placeholder="Enter unit name" data-testid="ironing-unit-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ironing-rate">Rate per Piece (₹)</Label>
                        <Input id="ironing-rate" type="number" step="0.01" value={ironingForm.rate_per_pcs} onChange={(e) => setIroningForm({...ironingForm, rate_per_pcs: e.target.value})} required placeholder="0.00" data-testid="ironing-rate-input" />
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIroningDialogOpen(false)} data-testid="ironing-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={loading} data-testid="ironing-submit-button">
                          {loading ? "Creating..." : "Create Order"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {ironingOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg border-l-4 border-l-amber-500" data-testid={`ironing-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-slate-800">{order.dc_number}</h3>
                              {getCategoryBadge(order.category)}
                              <Badge className="bg-amber-100 text-amber-800 border">{order.status}</Badge>
                              <Badge 
                                className={
                                  order.payment_status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' :
                                  order.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-red-100 text-red-800 border-red-200'
                                }
                              >
                                {order.payment_status}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600">Lot: {order.cutting_lot_number} | Style: {order.style_type}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handlePrintIroningDC(order.id)} data-testid={`print-ironing-dc-${order.id}`}>
                              <Printer className="h-4 w-4 mr-1" />
                              DC
                            </Button>
                            {order.status === 'Sent' && (
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => {
                                  setSelectedIroningOrder(order);
                                  setIroningReceiptForm({
                                    ironing_order_id: order.id,
                                    receipt_date: new Date().toISOString().split('T')[0],
                                    received_distribution: {}
                                  });
                                  setIroningReceiptDialogOpen(true);
                                }}
                                data-testid={`receive-ironing-${order.id}`}
                              >
                                <PackageCheck className="h-4 w-4 mr-1" />
                                Receive
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteIroningOrder(order.id)} data-testid={`delete-ironing-${order.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Unit</p>
                            <p className="font-semibold text-slate-800">{order.unit_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Total Quantity</p>
                            <p className="font-bold text-amber-600">{order.total_quantity} pcs</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Rate per Piece</p>
                            <p className="font-semibold text-slate-800">₹{order.rate_per_pcs}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Total Amount</p>
                            <p className="font-bold text-green-600">₹{order.total_amount}</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-xs text-slate-600 mb-2">Size Distribution:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(order.size_distribution).map(([size, qty]) => (
                              qty > 0 && (
                                <div key={size} className="bg-white px-3 py-1 rounded border">
                                  <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                  <span className="text-sm font-bold text-amber-600 ml-1">{qty}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>

                        {order.payment_status !== 'Paid' && (
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-600">Payment Status</p>
                                <p className="text-lg font-bold text-slate-800">Paid: ₹{order.amount_paid} / Balance: ₹{order.balance}</p>
                              </div>
                              <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => {
                                  const amount = prompt(`Enter payment amount (Balance: ₹${order.balance})`);
                                  if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
                                    handleIroningPayment(order.id, amount);
                                  }
                                }}
                                data-testid={`pay-ironing-${order.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Add Payment
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {ironingOrders.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Factory className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">No ironing orders yet</p>
                    <p className="text-slate-400 text-sm mt-2">Create an order to send items for ironing</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Catalog Tab */}
          <TabsContent value="catalog" data-testid="catalog-content">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Product Catalog</h2>
                <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" data-testid="add-catalog-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Catalog
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="catalog-dialog">
                    <DialogHeader>
                      <DialogTitle>Create New Catalog</DialogTitle>
                      <DialogDescription>Club multiple cutting lots into a catalog and track inventory</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCatalogSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="catalog-name">Catalog Name</Label>
                        <Input id="catalog-name" value={catalogForm.catalog_name} onChange={(e) => setCatalogForm({...catalogForm, catalog_name: e.target.value})} required placeholder="e.g., Summer Collection 2025" data-testid="catalog-name-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="catalog-code">Catalog Code</Label>
                        <Input id="catalog-code" value={catalogForm.catalog_code} onChange={(e) => setCatalogForm({...catalogForm, catalog_code: e.target.value})} required placeholder="e.g., SC-2025-001" data-testid="catalog-code-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="catalog-description">Description (Optional)</Label>
                        <Input id="catalog-description" value={catalogForm.description} onChange={(e) => setCatalogForm({...catalogForm, description: e.target.value})} placeholder="Add description" data-testid="catalog-description-input" />
                      </div>
                      <div className="space-y-2">
                        <Label>Select Cutting Lots</Label>
                        <div className="border rounded-lg p-3 max-h-60 overflow-y-auto bg-slate-50">
                          {cuttingOrders.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No cutting orders available</p>}
                          {cuttingOrders.map((order) => (
                            <div key={order.id} className="flex items-center space-x-3 py-2 border-b last:border-b-0">
                              <input
                                type="checkbox"
                                id={`lot-${order.id}`}
                                checked={catalogForm.lot_numbers.includes(order.cutting_lot_number)}
                                onChange={() => handleLotToggle(order.cutting_lot_number)}
                                className="h-4 w-4 text-indigo-600 rounded"
                              />
                              <label htmlFor={`lot-${order.id}`} className="flex-1 cursor-pointer">
                                <div className="text-sm font-semibold text-slate-800">{order.cutting_lot_number}</div>
                                <div className="text-xs text-slate-600">{order.category} - {order.style_type} | {order.total_quantity} pcs</div>
                              </label>
                            </div>
                          ))}
                        </div>
                        {catalogForm.lot_numbers.length > 0 && (
                          <p className="text-sm text-indigo-600 font-medium">{catalogForm.lot_numbers.length} lot(s) selected</p>
                        )}
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setCatalogDialogOpen(false)} data-testid="catalog-cancel-button">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || catalogForm.lot_numbers.length === 0} data-testid="catalog-submit-button">
                          {loading ? "Creating..." : "Create Catalog"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {catalogs.map((catalog) => (
                  <Card key={catalog.id} className="shadow-lg border-l-4 border-l-indigo-500" data-testid={`catalog-card-${catalog.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-slate-800">{catalog.catalog_name}</h3>
                              <Badge className="bg-indigo-100 text-indigo-800 border">{catalog.catalog_code}</Badge>
                            </div>
                            {catalog.description && <p className="text-sm text-slate-600">{catalog.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                setSelectedCatalog(catalog);
                                setDispatchForm({});
                                setDispatchDialogOpen(true);
                              }}
                              data-testid={`dispatch-catalog-${catalog.id}`}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Dispatch
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteCatalog(catalog.id)} data-testid={`delete-catalog-${catalog.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <p className="text-xs text-slate-600">Total Quantity</p>
                            <p className="text-2xl font-bold text-blue-600">{catalog.total_quantity}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <p className="text-xs text-slate-600">Available Stock</p>
                            <p className="text-2xl font-bold text-green-600">{catalog.available_stock}</p>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <p className="text-xs text-slate-600">Dispatched</p>
                            <p className="text-2xl font-bold text-amber-600">{catalog.total_quantity - catalog.available_stock}</p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <p className="text-xs text-slate-600">Lots Clubbed</p>
                            <p className="text-2xl font-bold text-purple-600">{catalog.lot_numbers.length}</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-xs text-slate-600 mb-2">Lot Numbers:</p>
                          <div className="flex flex-wrap gap-2">
                            {catalog.lot_numbers.map((lot) => (
                              <Badge key={lot} variant="outline" className="bg-white">{lot}</Badge>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-xs text-slate-600 mb-2">Size-wise Stock:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(catalog.size_distribution).map(([size, qty]) => (
                              qty > 0 && (
                                <div key={size} className="bg-white px-3 py-1 rounded border">
                                  <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                  <span className="text-sm font-bold text-indigo-600 ml-1">{qty}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {catalogs.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <BookOpen className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">No catalogs created yet</p>
                    <p className="text-slate-400 text-sm mt-2">Create a catalog by clubbing multiple cutting lots</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" data-testid="reports-content">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Reports</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cutting Report Card */}
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                      <Scissors className="h-5 w-5" />
                      Cutting Report
                    </CardTitle>
                    <CardDescription>View cutting operations with filters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cutting-start-date" className="text-xs">Start Date</Label>
                      <Input id="cutting-start-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cutting-end-date" className="text-xs">End Date</Label>
                      <Input id="cutting-end-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cutting-master-filter" className="text-xs">Cutting Master (Optional)</Label>
                      <Input id="cutting-master-filter" placeholder="Enter master name" className="h-9" />
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        const startDate = document.getElementById('cutting-start-date').value;
                        const endDate = document.getElementById('cutting-end-date').value;
                        const master = document.getElementById('cutting-master-filter').value;
                        let url = `${API}/reports/cutting?`;
                        if (startDate) url += `start_date=${startDate}&`;
                        if (endDate) url += `end_date=${endDate}&`;
                        if (master) url += `cutting_master=${master}&`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                {/* Outsourcing Report Card */}
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Send className="h-5 w-5" />
                      Outsourcing Report
                    </CardTitle>
                    <CardDescription>View outsourcing operations with filters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="outsourcing-start-date" className="text-xs">Start Date</Label>
                      <Input id="outsourcing-start-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outsourcing-end-date" className="text-xs">End Date</Label>
                      <Input id="outsourcing-end-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outsourcing-unit-filter" className="text-xs">Unit Name (Optional)</Label>
                      <Input id="outsourcing-unit-filter" placeholder="Enter unit name" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outsourcing-operation-filter" className="text-xs">Operation Type (Optional)</Label>
                      <Select defaultValue="all" onValueChange={(value) => document.getElementById('outsourcing-operation-filter').setAttribute('data-value', value === 'all' ? '' : value)}>
                        <SelectTrigger id="outsourcing-operation-filter" className="h-9" data-value="">
                          <SelectValue placeholder="Select operation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="Printing">Printing</SelectItem>
                          <SelectItem value="Embroidery">Embroidery</SelectItem>
                          <SelectItem value="Stone">Stone</SelectItem>
                          <SelectItem value="Sequins">Sequins</SelectItem>
                          <SelectItem value="Sticker">Sticker</SelectItem>
                          <SelectItem value="Stitching">Stitching</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        const startDate = document.getElementById('outsourcing-start-date').value;
                        const endDate = document.getElementById('outsourcing-end-date').value;
                        const unit = document.getElementById('outsourcing-unit-filter').value;
                        const operation = document.getElementById('outsourcing-operation-filter').getAttribute('data-value');
                        let url = `${API}/reports/outsourcing?`;
                        if (startDate) url += `start_date=${startDate}&`;
                        if (endDate) url += `end_date=${endDate}&`;
                        if (unit) url += `unit_name=${unit}&`;
                        if (operation) url += `operation_type=${operation}&`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                {/* Ironing Report Card */}
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-amber-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700">
                      <Factory className="h-5 w-5" />
                      Ironing Report
                    </CardTitle>
                    <CardDescription>View ironing operations with filters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ironing-start-date" className="text-xs">Start Date</Label>
                      <Input id="ironing-start-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ironing-end-date" className="text-xs">End Date</Label>
                      <Input id="ironing-end-date" type="date" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ironing-unit-filter" className="text-xs">Unit Name (Optional)</Label>
                      <Input id="ironing-unit-filter" placeholder="Enter unit name" className="h-9" />
                    </div>
                    <Button 
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        const startDate = document.getElementById('ironing-start-date').value;
                        const endDate = document.getElementById('ironing-end-date').value;
                        const unit = document.getElementById('ironing-unit-filter').value;
                        let url = `${API}/reports/ironing?`;
                        if (startDate) url += `start_date=${startDate}&`;
                        if (endDate) url += `end_date=${endDate}&`;
                        if (unit) url += `unit_name=${unit}&`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Unit-wise Bill Section */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Unit-wise Bill Generation</h3>
                <Card className="shadow-lg border-l-4 border-l-purple-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                      <DollarSign className="h-5 w-5" />
                      Generate Bill for Unit
                    </CardTitle>
                    <CardDescription>Create detailed bill for specific outsourcing or ironing unit</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="unit-bill-name" className="text-xs">Unit Name</Label>
                      <Input 
                        id="unit-bill-name" 
                        placeholder="Enter unit name (e.g., satish printing, own)"
                        className="h-9"
                      />
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-xs text-slate-600 mb-2">💡 This will generate a comprehensive bill including:</p>
                      <ul className="text-xs text-slate-600 space-y-1 ml-4">
                        <li>• All outsourcing operations for this unit</li>
                        <li>• All ironing operations for this unit</li>
                        <li>• Shortage deductions</li>
                        <li>• Payment details and outstanding balance</li>
                      </ul>
                    </div>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        const unitName = document.getElementById('unit-bill-name').value.trim();
                        if (unitName) {
                          window.open(`${API}/reports/bills/unit-wise?unit_name=${encodeURIComponent(unitName)}`, '_blank');
                        } else {
                          toast.error('Please enter unit name');
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Unit Bill
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Info Card */}
              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 mt-6">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full">
                      <AlertCircle className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-2">Report Filters</h4>
                      <ul className="text-sm text-slate-600 space-y-1">
                        <li>• Select date range to filter records by date</li>
                        <li>• Use unit/master filters to view specific vendor or worker reports</li>
                        <li>• Leave filters empty to view all records</li>
                        <li>• Reports can be printed or saved as PDF from the browser</li>
                        <li>• <strong>Unit-wise bill:</strong> Enter exact unit name for detailed billing report</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedPaymentOrder && `${paymentType === "cutting" ? selectedPaymentOrder.cutting_lot_number : selectedPaymentOrder.dc_number} - Balance: ₹${selectedPaymentOrder.balance || 0}`}
            </DialogDescription>
          </DialogHeader>
          {selectedPaymentOrder && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Payment Amount (₹)</Label>
                <Input 
                  id="payment-amount" 
                  type="number" 
                  step="0.01" 
                  value={paymentForm.amount} 
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})} 
                  placeholder="Enter amount" 
                  max={selectedPaymentOrder.balance || 0}
                  required 
                  data-testid="payment-amount-input" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm({...paymentForm, payment_method: value})}>
                  <SelectTrigger id="payment-method" data-testid="payment-method-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Input 
                  id="payment-notes" 
                  value={paymentForm.notes} 
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})} 
                  placeholder="Payment notes" 
                  data-testid="payment-notes-input" 
                />
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Total Amount:</span>
                  <span className="font-bold">₹{paymentType === "cutting" ? selectedPaymentOrder.total_cutting_amount : selectedPaymentOrder.total_amount}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Already Paid:</span>
                  <span className="font-bold text-green-600">₹{selectedPaymentOrder.amount_paid || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Current Balance:</span>
                  <span className="font-bold text-red-600">₹{selectedPaymentOrder.balance || 0}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} data-testid="payment-cancel-button">Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading} data-testid="payment-submit-button">
                  {loading ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Catalog Dispatch Dialog */}
      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dispatch-dialog">
          <DialogHeader>
            <DialogTitle>Dispatch from Catalog</DialogTitle>
            <DialogDescription>
              {selectedCatalog && `${selectedCatalog.catalog_name} (${selectedCatalog.catalog_code})`}
            </DialogDescription>
          </DialogHeader>
          {selectedCatalog && (
            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                <p className="text-sm text-slate-700"><strong>Available Stock:</strong> {selectedCatalog.available_stock} pcs</p>
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                <h4 className="font-semibold text-slate-700">Enter Dispatch Quantities</h4>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(selectedCatalog.size_distribution).map(([size, availableQty]) => (
                    availableQty > 0 && (
                      <div key={size} className="space-y-1">
                        <Label htmlFor={`dispatch-${size}`} className="text-xs">{size} (Available: {availableQty})</Label>
                        <Input 
                          id={`dispatch-${size}`}
                          type="number" 
                          value={dispatchForm[size] || ''} 
                          onChange={(e) => setDispatchForm({
                            ...dispatchForm,
                            [size]: parseInt(e.target.value) || 0
                          })}
                          placeholder="0"
                          max={availableQty}
                          className="h-8"
                          data-testid={`dispatch-input-${size}`}
                        />
                      </div>
                    )
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-slate-600">Total Dispatch: {getTotalQty(dispatchForm)} pcs</p>
                  {getTotalQty(dispatchForm) > selectedCatalog.available_stock && (
                    <p className="text-sm text-red-600 font-bold">⚠️ Exceeds available stock!</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDispatchDialogOpen(false)} data-testid="dispatch-cancel-button">Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading || getTotalQty(dispatchForm) === 0 || getTotalQty(dispatchForm) > selectedCatalog.available_stock} data-testid="dispatch-submit-button">
                  {loading ? "Recording..." : "Record Dispatch"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Ironing Receipt Dialog */}
      <Dialog open={ironingReceiptDialogOpen} onOpenChange={setIroningReceiptDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="ironing-receipt-dialog">
          <DialogHeader>
            <DialogTitle>Record Ironing Receipt</DialogTitle>
            <DialogDescription>
              {selectedIroningOrder && `DC: ${selectedIroningOrder.dc_number} - ${selectedIroningOrder.unit_name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedIroningOrder && (
            <form onSubmit={handleIroningReceiptSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ironing-receipt-date">Receipt Date</Label>
                <Input id="ironing-receipt-date" type="date" value={ironingReceiptForm.receipt_date} onChange={(e) => setIroningReceiptForm({...ironingReceiptForm, receipt_date: e.target.value})} required data-testid="ironing-receipt-date-input" />
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                <h4 className="font-semibold text-slate-700">Sent Quantities</h4>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(selectedIroningOrder.size_distribution).map(([size, qty]) => (
                    qty > 0 && (
                      <div key={size} className="bg-white px-3 py-2 rounded border">
                        <span className="text-xs font-semibold text-slate-700">{size}:</span>
                        <span className="text-sm font-bold text-amber-600 ml-1">{qty}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
              <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-slate-700">Enter Received Quantities</h4>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(selectedIroningOrder.size_distribution).map(([size, sentQty]) => (
                    sentQty > 0 && (
                      <div key={size} className="space-y-1">
                        <Label htmlFor={`ironing-received-${size}`} className="text-xs">{size} (Sent: {sentQty})</Label>
                        <Input 
                          id={`ironing-received-${size}`}
                          type="number" 
                          value={ironingReceiptForm.received_distribution[size] || ''} 
                          onChange={(e) => setIroningReceiptForm({
                            ...ironingReceiptForm,
                            received_distribution: {
                              ...ironingReceiptForm.received_distribution,
                              [size]: parseInt(e.target.value) || 0
                            }
                          })}
                          placeholder="0"
                          max={sentQty}
                          className="h-8"
                          data-testid={`ironing-received-input-${size}`}
                        />
                      </div>
                    )
                  ))}
                </div>
                <div className="pt-2 border-t border-amber-200">
                  <p className="text-sm text-slate-600">Total Received: {getTotalQty(ironingReceiptForm.received_distribution)} pcs</p>
                  <p className="text-sm text-slate-600">Total Sent: {selectedIroningOrder.total_quantity} pcs</p>
                  {getTotalQty(ironingReceiptForm.received_distribution) < selectedIroningOrder.total_quantity && (
                    <p className="text-lg font-bold text-red-600">Shortage: {selectedIroningOrder.total_quantity - getTotalQty(ironingReceiptForm.received_distribution)} pcs</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIroningReceiptDialogOpen(false)} data-testid="ironing-receipt-cancel-button">Cancel</Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={loading} data-testid="ironing-receipt-submit-button">
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