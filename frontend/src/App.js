import { useState, useEffect, useMemo, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';

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
import { Package, TrendingUp, Scissors, Plus, Trash2, Factory, Barcode, Users, Send, Printer, PackageCheck, AlertCircle, Pencil, DollarSign, FileText, BookOpen, Weight, ImageIcon, X, Eye, LogOut, User, Lock, UserPlus, MessageCircle, Phone, Search, Filter, Menu, Home, Camera, QrCode, Download, CheckCircle, Truck, Bell, Activity, Settings, History, Shield, Database } from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5Qrcode } from "html5-qrcode";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios defaults for better performance and security
axios.defaults.timeout = 30000; // 30 second timeout
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Request interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please try again.');
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    } else if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

const SIZE_CONFIG = {
  Kids: ['2/3', '3/4', '5/6', '7/8', '9/10', '11/12', '13/14'],
  Mens: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'],
  Women: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL']
};

const BUNDLE_TYPES = ['Front', 'Back', 'Sleeve', 'Rib', 'Patti', 'Collar', 'Front L Panel', 'Front R Panel', 'Back L Panel', 'Back R Panel'];

const OPERATION_TYPES = ['Printing', 'Embroidery', 'Stone', 'Sequins', 'Sticker', 'Stitching'];

// Default Fabric Types (used to seed initial data)
const DEFAULT_FABRIC_TYPES = [
  'Single Jersey',
  'Double Jersey', 
  'Interlock',
  'Rib',
  '1x1 Rib',
  '2x2 Rib',
  'Pique',
  'Fleece',
  'French Terry',
  'Waffle',
  'Pointelle',
  'Jacquard',
  'Lycra Jersey',
  'Cotton Jersey',
  'Cotton Jersey 20s',
  'Cotton Jersey 280gsm',
  'Loopknit Raising',
  'Loopknit Unraising',
  'Polyester',
  'Cotton Blend',
  'Viscose',
  'Modal',
  'Bamboo',
  'Organic Cotton',
  'Other'
];

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  
  // Helper for admin check
  const isAdmin = currentUser?.role === 'admin';
  
  // Mobile state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // User Management state (Admin only)
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [newUserForm, setNewUserForm] = useState({ username: "", password: "", full_name: "", role: "user" });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [fabricLots, setFabricLots] = useState([]);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [outsourcingOrders, setOutsourcingOrders] = useState([]);
  const [outsourcingReceipts, setOutsourcingReceipts] = useState([]);
  const [outsourcingUnits, setOutsourcingUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_name: "", operations: [], contact_person: "", phone: "", address: "" });
  const [editingUnit, setEditingUnit] = useState(null);
  const [ironingOrders, setIroningOrders] = useState([]);
  const [ironingReceipts, setIroningReceipts] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [stockSummary, setStockSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Analytics & Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  
  // Bulk Operations State
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedStockIds, setSelectedStockIds] = useState([]);
  
  // Phase 3 State
  const [lotTrackingDialogOpen, setLotTrackingDialogOpen] = useState(false);
  const [trackingLotNumber, setTrackingLotNumber] = useState("");
  const [lotJourney, setLotJourney] = useState(null);
  const [returns, setReturns] = useState([]);
  const [qualityChecks, setQualityChecks] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  
  // Master Data State (Fabric Types & Suppliers)
  const [fabricTypes, setFabricTypes] = useState(DEFAULT_FABRIC_TYPES);
  const [suppliers, setSuppliers] = useState([]);
  const [masterDataDialogOpen, setMasterDataDialogOpen] = useState(false);
  const [newFabricType, setNewFabricType] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  
  // Returns Management State
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    source_type: 'dispatch',
    source_id: '',
    return_date: new Date().toISOString().split('T')[0],
    quantity: '',
    reason: '',
    notes: ''
  });
  
  const [rollWeightsDialogOpen, setRollWeightsDialogOpen] = useState(false);
  const [selectedLotForWeights, setSelectedLotForWeights] = useState(null);
  const [scaleReadings, setScaleReadings] = useState([]);
  const [restartPoints, setRestartPoints] = useState([]);  // Indices where scale was restarted
  const [returnFabricDialogOpen, setReturnFabricDialogOpen] = useState(false);
  const [selectedLotForReturn, setSelectedLotForReturn] = useState(null);
  const [fabricReturnForm, setFabricReturnForm] = useState({
    returned_rolls: [],
    quantity_returned: '',
    reason: 'Wrong Color',
    comments: ''
  });
  
  // WhatsApp state
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappData, setWhatsappData] = useState({ type: '', data: null, phone: '', useUnitPhone: true });
  
  // Search and Filter state
  const [fabricSearch, setFabricSearch] = useState("");
  const [fabricStatusFilter, setFabricStatusFilter] = useState("all");
  const [cuttingSearch, setCuttingSearch] = useState("");
  const [cuttingCategoryFilter, setCuttingCategoryFilter] = useState("all");
  const [outsourcingSearch, setOutsourcingSearch] = useState("");
  const [outsourcingOperationFilter, setOutsourcingOperationFilter] = useState("all");
  const [outsourcingStatusFilter, setOutsourcingStatusFilter] = useState("all");
  const [receiptsSearch, setReceiptsSearch] = useState("");
  const [receiptsTypeFilter, setReceiptsTypeFilter] = useState("all");
  const [ironingSearch, setIroningSearch] = useState("");
  const [ironingStatusFilter, setIroningStatusFilter] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  
  // Fabric lot form state
  const [lotForm, setLotForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    fabric_type: "",
    supplier_name: "",
    color: "",
    rib_quantity: "",
    rate_per_kg: "",
    number_of_rolls: 1
  });
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [editFabricDialogOpen, setEditFabricDialogOpen] = useState(false);
  const [editingFabricLot, setEditingFabricLot] = useState(null);
  const [editFabricForm, setEditFabricForm] = useState({
    fabric_type: "",
    supplier_name: "",
    color: "",
    rate_per_kg: "",
    remaining_quantity: "",
    remaining_rib_quantity: ""
  });
  const [availableCuttingOrders, setAvailableCuttingOrders] = useState([]);
  
  // Stock state
  const [stockSearch, setStockSearch] = useState("");
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockDispatchDialogOpen, setStockDispatchDialogOpen] = useState(false);
  const [stockCatalogDialogOpen, setStockCatalogDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockForm, setStockForm] = useState({
    lot_number: "",
    category: "Mens",
    style_type: "",
    color: "",
    size_distribution: { M: 0, L: 0, XL: 0, XXL: 0 },
    master_pack_ratio: { M: 1, L: 1, XL: 1, XXL: 1 },
    notes: ""
  });
  const [stockDispatchForm, setStockDispatchForm] = useState({
    master_packs: 0,
    loose_pcs: {},
    customer_name: "",
    bora_number: "",
    notes: ""
  });
  const [stockCatalogForm, setStockCatalogForm] = useState({
    catalog_name: "",
    catalog_code: "",
    description: ""
  });
  
  // QR Scan State
  const [scanMode, setScanMode] = useState(null); // 'dispatch', 'newlot', null
  const [scannedStock, setScannedStock] = useState(null);
  const [scanDispatchDialogOpen, setScanDispatchDialogOpen] = useState(false);
  const [scanNewLotDialogOpen, setScanNewLotDialogOpen] = useState(false);
  const [stockQRDialogOpen, setStockQRDialogOpen] = useState(false);
  const [selectedStockForQR, setSelectedStockForQR] = useState(null);
  const [lastScannedCode, setLastScannedCode] = useState(null); // Prevent duplicate scans
  const [scanDispatchForm, setScanDispatchForm] = useState({
    customer_name: "",
    bora_number: "",
    master_packs: 1,
    loose_pcs: {}
  });
  const [scanNewLotForm, setScanNewLotForm] = useState({
    lot_number: "",
    size_distribution: { M: 0, L: 0, XL: 0, XXL: 0 },
    notes: ""
  });
  
  // Unified Scanner State
  const [unifiedScannerOpen, setUnifiedScannerOpen] = useState(false);
  const [scannedLot, setScannedLot] = useState(null);
  const [lotQRDialogOpen, setLotQRDialogOpen] = useState(false);
  const [selectedLotForQR, setSelectedLotForQR] = useState(null);
  
  // Scan Action Forms
  const [scanSendOutsourcingForm, setScanSendOutsourcingForm] = useState({
    unit_name: "",
    operation_type: "Printing",
    rate_per_pcs: 0
  });
  const [scanReceiveForm, setScanReceiveForm] = useState({
    received_distribution: {},
    mistake_distribution: {}
  });
  const [scanIroningForm, setScanIroningForm] = useState({
    unit_name: "",
    rate_per_pcs: 0,
    master_pack_ratio: { M: 2, L: 2, XL: 2, XXL: 2 }
  });
  const [scanReceiveIroningForm, setScanReceiveIroningForm] = useState({
    received_distribution: {},
    mistake_distribution: {}
  });
  const [scanActionDialog, setScanActionDialog] = useState(null); // 'send', 'receive', 'ironing', 'receive-ironing'
  
  // Bulk Dispatch State
  const [bulkDispatches, setBulkDispatches] = useState([]);
  const [bulkDispatchForm, setBulkDispatchForm] = useState({
    dispatch_date: new Date().toISOString().split('T')[0],
    customer_name: "",
    bora_number: "",
    notes: "",
    remarks: "",
    items: []
  });
  const [bulkDispatchDialogOpen, setBulkDispatchDialogOpen] = useState(false);
  const [selectedStocksForDispatch, setSelectedStocksForDispatch] = useState([]);
  const [dispatchItemForm, setDispatchItemForm] = useState({
    stock_id: "",
    master_packs: 0,
    loose_pcs: {}
  });

  // Cutting order form state
  const [cuttingForm, setCuttingForm] = useState({
    cutting_lot_number: "",
    cutting_master_name: "",
    cutting_date: new Date().toISOString().split('T')[0],
    fabric_lot_id: "",
    lot_number: "",
    color: "",
    category: "Kids",
    style_type: "",
    fabric_taken: "",
    fabric_returned: "",
    rib_taken: "",
    rib_returned: "",
    cutting_rate_per_pcs: "",
    size_distribution: {},
    bundle_distribution: {
      'Front': 0,
      'Back': 0,
      'Sleeve': 0,
      'Rib': 0,
      'Patti': 0,
      'Collar': 0,
      'Front L Panel': 0,
      'Front R Panel': 0,
      'Back L Panel': 0,
      'Back R Panel': 0
    },
    is_old_lot: false
  });
  const [cuttingDialogOpen, setCuttingDialogOpen] = useState(false);
  const [editingCuttingOrder, setEditingCuttingOrder] = useState(null);
  const [lotNumberError, setLotNumberError] = useState("");
  
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
    cutting_order_ids: [],
    lot_number: "",
    category: "Kids",
    style_type: "",
    operation_type: "Printing",
    unit_name: "",
    rate_per_pcs: "",
    notes: "",
    size_distribution: {}
  });
  const [outsourcingDialogOpen, setOutsourcingDialogOpen] = useState(false);
  const [overdueOrders, setOverdueOrders] = useState([]);
  const [editingOutsourcingOrder, setEditingOutsourcingOrder] = useState(null);
  
  // Receipt form state
  const [receiptForm, setReceiptForm] = useState({
    outsourcing_order_id: "",
    receipt_date: new Date().toISOString().split('T')[0],
    received_distribution: {},
    mistake_distribution: {}
  });
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedOutsourcingOrder, setSelectedOutsourcingOrder] = useState(null);
  
  // Ironing form state
  const [ironingForm, setIroningForm] = useState({
    dc_date: new Date().toISOString().split('T')[0],
    receipt_id: "",
    unit_name: "",
    rate_per_pcs: "",
    master_pack_ratio: {},
    stock_lot_name: "",
    stock_color: ""
  });
  const [ironingDialogOpen, setIroningDialogOpen] = useState(false);
  
  // Ironing receipt form state
  const [ironingReceiptForm, setIroningReceiptForm] = useState({
    ironing_order_id: "",
    receipt_date: new Date().toISOString().split('T')[0],
    received_distribution: {},
    mistake_distribution: {}
  });
  const [ironingReceiptDialogOpen, setIroningReceiptDialogOpen] = useState(false);
  const [selectedIroningOrder, setSelectedIroningOrder] = useState(null);
  
  // Edit Receipt state
  const [editReceiptDialogOpen, setEditReceiptDialogOpen] = useState(false);
  const [selectedEditReceipt, setSelectedEditReceipt] = useState(null);
  const [editReceiptForm, setEditReceiptForm] = useState({
    receipt_date: '',
    received_distribution: {},
    mistake_distribution: {}
  });
  
  // Catalog form state
  const [catalogForm, setCatalogForm] = useState({
    catalog_name: "",
    catalog_code: "",
    description: "",
    image_url: "",
    lot_numbers: []
  });
  const [catalogImageFile, setCatalogImageFile] = useState(null);
  const [catalogImagePreview, setCatalogImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewImageDialog, setViewImageDialog] = useState(false);
  const [viewImageUrl, setViewImageUrl] = useState(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    customer_name: '',
    bora_number: '',
    notes: '',
    master_packs: 0,
    loose_pcs: {}
  });
  const [selectedDispatchLot, setSelectedDispatchLot] = useState(null);
  
  const [barcodeView, setBarcodeView] = useState(null);
  
  // Unit Payment state
  const [unitPaymentDialogOpen, setUnitPaymentDialogOpen] = useState(false);
  const [unitPaymentForm, setUnitPaymentForm] = useState({
    unit_name: "",
    amount: "",
    transaction_type: "credit",  // "credit" for payment, "debit" for charge
    payment_method: "Cash",
    notes: ""
  });
  const [pendingBills, setPendingBills] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);

  // Set up axios interceptor for auth token
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Add response interceptor to handle 401 errors
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
    
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Fetch data when authenticated - LAZY LOADING based on active tab
  useEffect(() => {
    if (isAuthenticated) {
      // Always fetch essential data
      fetchDashboardStats();
      fetchNotifications();
    }
  }, [isAuthenticated]);

  // Lazy load data based on active tab
  useEffect(() => {
    if (!isAuthenticated) return;
    
    switch (activeTab) {
      case 'dashboard':
        fetchAnalytics();
        fetchOverdueOrders();
        break;
      case 'fabric-lots':
        fetchFabricLots();
        fetchFabricTypes();
        fetchSuppliers();
        break;
      case 'cutting':
        fetchCuttingOrders();
        fetchFabricLots();
        break;
      case 'outsourcing':
        fetchOutsourcingOrders();
        fetchOutsourcingReceipts();
        fetchOutsourcingUnits();
        fetchCuttingOrders();
        break;
      case 'receipts':
        fetchOutsourcingReceipts();
        fetchOutsourcingOrders();
        break;
      case 'ironing':
        fetchIroningOrders();
        fetchIroningReceipts();
        fetchOutsourcingReceipts();
        break;
      case 'stock':
        fetchStocks();
        fetchStockSummary();
        break;
      case 'dispatch':
        fetchStocks();
        fetchBulkDispatches();
        break;
      case 'catalog':
        fetchCatalogs();
        fetchStocks();
        fetchCuttingOrders();
        break;
      case 'reports':
        fetchCuttingOrders();
        fetchOutsourcingOrders();
        fetchIroningOrders();
        fetchStocks();
        fetchBulkDispatches();
        break;
      case 'returns':
        fetchReturns();
        fetchBulkDispatches();
        break;
      default:
        break;
    }
  }, [isAuthenticated, activeTab]);

  // QR Scanner for Stock (Add Lot and Dispatch)
  useEffect(() => {
    let scanner = null;
    let timeoutId = null;
    
    if (scanMode) {
      // Small delay to ensure DOM element is rendered
      timeoutId = setTimeout(() => {
        // Scanner for Stock tab (Add New Lot)
        if (scanMode === 'newlot') {
          const element = document.getElementById('stock-qr-reader');
          if (element) {
            scanner = new Html5QrcodeScanner('stock-qr-reader', {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
              supportedScanTypes: [
                Html5QrcodeScanType.SCAN_TYPE_CAMERA,
                Html5QrcodeScanType.SCAN_TYPE_FILE
              ],
              rememberLastUsedCamera: true
            });
            
            scanner.render(
              (decodedText) => {
                scanner.clear();
                handleQRScanResult(decodedText);
              },
              (error) => {
                // Ignore scan errors
              }
            );
          }
        }
        
        // Scanner for Dispatch tab (Scan to Add to Dispatch)
        if (scanMode === 'dispatch') {
          const element = document.getElementById('qr-reader-dispatch');
          if (element) {
            // Use Html5Qrcode for continuous scanning
            const html5QrCode = new Html5Qrcode('qr-reader-dispatch');
            scanner = html5QrCode;
            
            // Track processed codes to avoid duplicates within same session
            const processedCodes = new Set();
            
            const onScanSuccess = (decodedText) => {
              // Prevent duplicate processing of same code
              if (processedCodes.has(decodedText)) {
                return;
              }
              processedCodes.add(decodedText);
              
              // Clear after 2 seconds to allow re-scanning same item if needed
              setTimeout(() => processedCodes.delete(decodedText), 2000);
              
              // Try to parse as JSON (stock QR codes contain JSON)
              let stockCode = decodedText;
              try {
                const data = JSON.parse(decodedText);
                if (data.type === 'stock' && data.code) {
                  stockCode = data.code;
                }
              } catch (e) {
                // Not JSON, use as plain text stock code
              }
              
              // Find stock by QR code (stock_code)
              const stock = stocks.find(s => s.stock_code === stockCode);
              if (stock) {
                if (stock.available_quantity > 0) {
                  addItemToDispatch(stock);
                  toast.success(`Added ${stock.stock_code}! Keep scanning or click Done.`);
                } else {
                  toast.error(`${stock.stock_code} has no available quantity`);
                }
              } else {
                toast.error(`Stock not found: ${stockCode}`);
              }
            };
            
            // iOS-optimized camera config
            const cameraConfig = {
              facingMode: "environment"
            };
            
            const scanConfig = { 
              fps: 10, 
              qrbox: { width: 200, height: 200 }, // Smaller for iOS
              videoConstraints: {
                facingMode: "environment",
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 }
              }
            };
            
            // Start camera scanning
            html5QrCode.start(
              cameraConfig,
              scanConfig,
              onScanSuccess,
              () => {} // Ignore errors
            ).catch(err => {
              console.log("Camera not available, showing file upload option");
              // If camera fails, show file upload UI
              element.innerHTML = `
                <div style="padding: 20px; text-align: center; background: rgba(255,255,255,0.1); border-radius: 8px;">
                  <p style="margin-bottom: 15px; color: #fef3c7;">📷 Camera not available. Use file upload:</p>
                  <input type="file" id="qr-file-input" accept="image/*" style="display: none;" />
                  <button id="qr-file-btn" style="background: #f59e0b; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    📁 Select QR Code Image
                  </button>
                </div>
              `;
              
              const fileBtn = document.getElementById('qr-file-btn');
              const fileInput = document.getElementById('qr-file-input');
              
              if (fileBtn && fileInput) {
                fileBtn.onclick = () => fileInput.click();
                fileInput.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    try {
                      const result = await html5QrCode.scanFile(file, true);
                      onScanSuccess(result);
                      fileInput.value = ''; // Reset for next scan
                    } catch (err) {
                      toast.error("Could not read QR code from image");
                    }
                  }
                };
              }
            });
          }
        }
      }, 100);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (scanner) {
        try {
          // Handle both Html5Qrcode and Html5QrcodeScanner cleanup
          const state = scanner.getState ? scanner.getState() : null;
          if (scanner.stop && (state === 2 || state === 3)) { // SCANNING or PAUSED
            scanner.stop().catch(() => {});
          } else if (scanner.clear) {
            scanner.clear().catch(() => {});
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [scanMode, stocks]);

  // Unified Lot QR Scanner
  useEffect(() => {
    let scanner = null;
    let timeoutId = null;
    
    if (unifiedScannerOpen) {
      // Small delay to ensure DOM element is rendered
      timeoutId = setTimeout(() => {
        const element = document.getElementById('unified-qr-reader');
        if (element) {
          // Clear any previous content
          element.innerHTML = '';
          
          // iOS-optimized configuration
          const config = {
            fps: 10,
            qrbox: { width: 200, height: 200 }, // Smaller qrbox works better on iOS
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              Html5QrcodeScanType.SCAN_TYPE_FILE
            ],
            rememberLastUsedCamera: true,
            // iOS needs this to avoid BarcodeDetector issues
            useBarCodeDetectorIfSupported: false,
            videoConstraints: {
              facingMode: "environment",
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            }
          };
          
          scanner = new Html5QrcodeScanner('unified-qr-reader', config, false);
          
          scanner.render(
            (decodedText) => {
              // Stop scanner and process result
              scanner.clear().then(() => {
                // Don't close dialog - just process the scan
                // The scannedLot being set will switch the dialog content automatically
                handleLotQRScan(decodedText);
              }).catch(err => {
                console.log("Clear error:", err);
                handleLotQRScan(decodedText);
              });
            },
            (errorMessage) => {
              // Ignore scan errors - they happen continuously while scanning
            }
          );
        }
      }, 300); // Increased delay for iOS
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (scanner) {
        try {
          const state = scanner.getState ? scanner.getState() : null;
          if (state === 2 || state === 3) { // SCANNING or PAUSED
            scanner.clear().catch(() => {});
          } else if (scanner.clear) {
            scanner.clear().catch(() => {});
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [unifiedScannerOpen]);

  // Mobile Barcode Scanner (bottom nav)
  useEffect(() => {
    let scanner = null;
    let timeoutId = null;
    
    if (scannerDialogOpen) {
      timeoutId = setTimeout(() => {
        const element = document.getElementById('barcode-scanner');
        if (element) {
          element.innerHTML = '';
          
          // iOS-optimized configuration
          const config = {
            fps: 10,
            qrbox: { width: 200, height: 200 },
            aspectRatio: 1.0,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              Html5QrcodeScanType.SCAN_TYPE_FILE
            ],
            rememberLastUsedCamera: true,
            useBarCodeDetectorIfSupported: false,
            videoConstraints: {
              facingMode: "environment",
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            }
          };
          
          console.log("Initializing barcode scanner...");
          scanner = new Html5QrcodeScanner('barcode-scanner', config, false);
          
          scanner.render(
            (decodedText) => {
              console.log("Barcode scanned:", decodedText);
              toast.info("QR code detected! Processing...");
              scanner.clear().then(() => {
                setScannerDialogOpen(false);
                // Handle scanned barcode - try to find matching lot
                handleLotQRScan(decodedText);
              }).catch(err => {
                setScannerDialogOpen(false);
                handleLotQRScan(decodedText);
              });
            },
            (errorMessage) => {
              // Ignore scan errors - they happen continuously while scanning
            }
          );
          console.log("Barcode scanner initialized");
        }
      }, 300);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (scanner) {
        try {
          const state = scanner.getState ? scanner.getState() : null;
          if (state === 2 || state === 3) { // SCANNING or PAUSED
            scanner.clear().catch(() => {});
          } else if (scanner.clear) {
            scanner.clear().catch(() => {});
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [scannerDialogOpen]);

  // Mobile detection and PWA install prompt
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW registration failed'));
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        toast.success('App installed successfully!');
      }
      setInstallPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(`${API}/auth/me`);
      setCurrentUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm);
      const { token, user } = response.data;
      
      localStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setCurrentUser(user);
      setIsAuthenticated(true);
      setLoginForm({ username: "", password: "" });
      toast.success(`Welcome back, ${user.full_name}!`);
    } catch (error) {
      setAuthError(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
  };

  // User Management Functions (Admin only)
  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(`${API}/auth/users`);
      setAllUsers(response.data);
    } catch (error) {
      toast.error("Failed to fetch users");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/register`, newUserForm);
      toast.success(`User "${newUserForm.username}" created successfully!`);
      setNewUserForm({ username: "", password: "", full_name: "", role: "user" });
      fetchAllUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/auth/users/${userId}/toggle-status`);
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchAllUsers();
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/auth/users/${userId}/role`, { role: newRole });
      toast.success(`User role changed to "${newRole}" successfully`);
      fetchAllUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change user role");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to fetch dashboard stats");
    }
  };

  // Fetch Master Data (Fabric Types & Suppliers)
  const fetchFabricTypes = async () => {
    try {
      const response = await axios.get(`${API}/master/fabric-types`);
      if (response.data.length > 0) {
        setFabricTypes(response.data);
      }
    } catch (error) {
      console.error("Error fetching fabric types:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API}/master/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleAddFabricType = async () => {
    if (!newFabricType.trim()) {
      toast.error("Please enter a fabric type name");
      return;
    }
    try {
      await axios.post(`${API}/master/fabric-types`, { name: newFabricType.trim() });
      toast.success("Fabric type added successfully");
      setNewFabricType("");
      fetchFabricTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add fabric type");
    }
  };

  const handleDeleteFabricType = async (name) => {
    if (!window.confirm(`Delete fabric type "${name}"?`)) return;
    try {
      await axios.delete(`${API}/master/fabric-types/${encodeURIComponent(name)}`);
      toast.success("Fabric type deleted");
      fetchFabricTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete fabric type");
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.trim()) {
      toast.error("Please enter a supplier name");
      return;
    }
    try {
      await axios.post(`${API}/master/suppliers`, { name: newSupplier.trim() });
      toast.success("Supplier added successfully");
      setNewSupplier("");
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add supplier");
    }
  };

  const handleDeleteSupplier = async (name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      await axios.delete(`${API}/master/suppliers/${encodeURIComponent(name)}`);
      toast.success("Supplier deleted");
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete supplier");
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

  const fetchAvailableCuttingOrders = async () => {
    try {
      const response = await axios.get(`${API}/cutting-orders?exclude_ironing=true`);
      setAvailableCuttingOrders(response.data);
    } catch (error) {
      console.error("Error fetching available cutting orders:", error);
      toast.error("Failed to fetch available cutting orders");
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

  const fetchOutsourcingUnits = async () => {
    try {
      const response = await axios.get(`${API}/outsourcing-units`);
      setOutsourcingUnits(response.data);
    } catch (error) {
      console.error("Error fetching outsourcing units:", error);
    }
  };

  const fetchUnitsByOperation = async (operation) => {
    if (!operation) {
      setFilteredUnits([]);
      return;
    }
    try {
      const response = await axios.get(`${API}/outsourcing-units/by-operation/${encodeURIComponent(operation)}`);
      setFilteredUnits(response.data);
    } catch (error) {
      console.error("Error fetching units by operation:", error);
      setFilteredUnits([]);
    }
  };

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUnit) {
        await axios.put(`${API}/outsourcing-units/${editingUnit.id}`, unitForm);
        toast.success("Unit updated successfully");
      } else {
        await axios.post(`${API}/outsourcing-units`, unitForm);
        toast.success("Unit added successfully");
      }
      setUnitsDialogOpen(false);
      setUnitForm({ unit_name: "", operations: [], contact_person: "", phone: "", address: "" });
      setEditingUnit(null);
      fetchOutsourcingUnits();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save unit");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (unitId) => {
    if (!window.confirm("Are you sure you want to delete this unit?")) return;
    try {
      await axios.delete(`${API}/outsourcing-units/${unitId}`);
      toast.success("Unit deleted successfully");
      fetchOutsourcingUnits();
    } catch (error) {
      toast.error("Failed to delete unit");
    }
  };

  const fetchOverdueOrders = async () => {
    try {
      const response = await axios.get(`${API}/outsourcing-orders/overdue/reminders`);
      setOverdueOrders(response.data.overdue_orders || []);
    } catch (error) {
      console.error("Error fetching overdue orders:", error);
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

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/analytics`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/notifications`);
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
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

  const fetchStocks = async () => {
    try {
      const response = await axios.get(`${API}/stock`);
      setStocks(response.data);
    } catch (error) {
      console.error("Error fetching stocks:", error);
    }
  };

  const fetchStockSummary = async () => {
    try {
      const response = await axios.get(`${API}/stock/report/summary`);
      setStockSummary(response.data);
    } catch (error) {
      console.error("Error fetching stock summary:", error);
    }
  };

  const fetchBulkDispatches = async () => {
    try {
      const response = await axios.get(`${API}/bulk-dispatches`);
      setBulkDispatches(response.data);
    } catch (error) {
      console.error("Error fetching bulk dispatches:", error);
    }
  };

  // Phase 3 Fetch Functions
  const fetchLotJourney = async (lotNumber) => {
    try {
      const response = await axios.get(`${API}/tracking/lot/${encodeURIComponent(lotNumber)}`);
      setLotJourney(response.data);
    } catch (error) {
      console.error("Error fetching lot journey:", error);
      toast.error("Failed to track lot");
    }
  };

  const fetchReturns = async () => {
    try {
      const response = await axios.get(`${API}/returns`);
      setReturns(response.data);
    } catch (error) {
      console.error("Error fetching returns:", error);
    }
  };

  const fetchQualityChecks = async () => {
    try {
      const response = await axios.get(`${API}/quality-checks`);
      setQualityChecks(response.data);
    } catch (error) {
      console.error("Error fetching quality checks:", error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await axios.get(`${API}/activity-logs?limit=50`);
      setActivityLogs(response.data);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setAppSettings(response.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleLotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/fabric-lots`, {
        ...lotForm,
        entry_date: new Date(lotForm.entry_date).toISOString(),
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
        rib_quantity: "",
        rate_per_kg: "",
        number_of_rolls: 1
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

  const handleRollWeightsSubmit = async () => {
    try {
      setLoading(true);
      await axios.put(`${API}/fabric-lots/${selectedLotForWeights.id}/roll-weights`, {
        scale_readings: scaleReadings,
        restart_points: restartPoints
      });
      toast.success("Roll weights updated successfully!");
      setRollWeightsDialogOpen(false);
      setSelectedLotForWeights(null);
      setScaleReadings([]);
      setRestartPoints([]);
      fetchFabricLots();
    } catch (error) {
      console.error("Error updating roll weights:", error);
      const errorMessage = error.response?.data?.detail || "Failed to update roll weights";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate individual roll weight considering restart points
  const calculateRollWeight = (index) => {
    if (!scaleReadings[index]) return null;
    const reading = parseFloat(scaleReadings[index]);
    
    if (index === 0 || restartPoints.includes(index)) {
      // First roll or restart point - weight is the reading itself
      return reading.toFixed(2);
    } else {
      // Cumulative - subtract previous reading
      const prevReading = parseFloat(scaleReadings[index - 1] || 0);
      return (reading - prevReading).toFixed(2);
    }
  };
  
  // Toggle restart point for a roll
  const toggleRestartPoint = (index) => {
    if (index === 0) return; // Can't restart on first roll
    
    if (restartPoints.includes(index)) {
      setRestartPoints(restartPoints.filter(p => p !== index));
    } else {
      setRestartPoints([...restartPoints, index].sort((a, b) => a - b));
    }
  };

  const handleReturnFabricSubmit = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/fabric-lots/${selectedLotForReturn.id}/return`, fabricReturnForm);
      toast.success(`Fabric returned successfully! ${fabricReturnForm.quantity_returned}kg removed from inventory.`);
      setReturnFabricDialogOpen(false);
      setSelectedLotForReturn(null);
      setFabricReturnForm({
        returned_rolls: [],
        quantity_returned: '',
        reason: 'Wrong Color',
        comments: ''
      });
      fetchFabricLots();
    } catch (error) {
      console.error("Error returning fabric:", error);
      const errorMessage = error.response?.data?.detail || "Failed to return fabric";
      toast.error(errorMessage);
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
    
    // Check for lot number uniqueness error
    if (lotNumberError) {
      toast.error(lotNumberError);
      setLoading(false);
      return;
    }
    
    try {
      // Validate fabric availability
      const selectedLot = fabricLots.find(lot => lot.id === cuttingForm.fabric_lot_id);
      if (selectedLot) {
        const fabricTaken = parseFloat(cuttingForm.fabric_taken);
        const ribTaken = parseFloat(cuttingForm.rib_taken);
        
        if (fabricTaken > selectedLot.remaining_quantity) {
          toast.error(`Fabric taken (${fabricTaken} kg) exceeds available fabric (${selectedLot.remaining_quantity} kg) in lot ${selectedLot.lot_number}`);
          setLoading(false);
          return;
        }
        
        if (ribTaken > selectedLot.remaining_rib_quantity) {
          toast.error(`Rib taken (${ribTaken} kg) exceeds available rib (${selectedLot.remaining_rib_quantity} kg) in lot ${selectedLot.lot_number}`);
          setLoading(false);
          return;
        }
      }
      
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
          size_distribution: cuttingForm.size_distribution,
          bundle_distribution: cuttingForm.bundle_distribution
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
        bundle_distribution: {
          'Front': 0,
          'Back': 0,
          'Sleeve': 0,
          'Rib': 0,
          'Patti': 0,
          'Collar': 0,
          'Front L Panel': 0,
          'Front R Panel': 0,
          'Back L Panel': 0,
          'Back R Panel': 0
        }
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
    setLotNumberError("");
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
      size_distribution: order.size_distribution,
      bundle_distribution: order.bundle_distribution || {
        'Front': 0,
        'Back': 0,
        'Sleeve': 0,
        'Rib': 0,
        'Patti': 0,
        'Collar': 0,
        'Front L Panel': 0,
        'Front R Panel': 0,
        'Back L Panel': 0,
        'Back R Panel': 0
      }
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

  // Admin-only delete functions
  const handleDeleteFabricLot = async (lotId, lotNumber) => {
    if (!window.confirm(`Are you sure you want to delete fabric lot "${lotNumber}"? This action cannot be undone.`)) return;
    
    try {
      await axios.delete(`${API}/fabric-lots/${lotId}`);
      toast.success("Fabric lot deleted successfully");
      fetchFabricLots();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete fabric lot");
    }
  };

  const openEditFabricLot = (lot) => {
    setEditingFabricLot(lot);
    setEditFabricForm({
      fabric_type: lot.fabric_type || "",
      supplier_name: lot.supplier_name || "",
      color: lot.color || "",
      rate_per_kg: lot.rate_per_kg || "",
      remaining_quantity: lot.remaining_quantity || "",
      remaining_rib_quantity: lot.remaining_rib_quantity || ""
    });
    setEditFabricDialogOpen(true);
  };

  const handleEditFabricLot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/fabric-lots/${editingFabricLot.id}`, {
        fabric_type: editFabricForm.fabric_type,
        supplier_name: editFabricForm.supplier_name,
        color: editFabricForm.color,
        rate_per_kg: parseFloat(editFabricForm.rate_per_kg),
        remaining_quantity: parseFloat(editFabricForm.remaining_quantity),
        remaining_rib_quantity: parseFloat(editFabricForm.remaining_rib_quantity)
      });
      toast.success("Fabric lot updated successfully");
      setEditFabricDialogOpen(false);
      setEditingFabricLot(null);
      fetchFabricLots();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update fabric lot");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOutsourcingOrder = async (orderId, dcNumber) => {
    if (!window.confirm(`Are you sure you want to delete outsourcing order "${dcNumber}"? This action cannot be undone.`)) return;
    
    try {
      await axios.delete(`${API}/outsourcing-orders/${orderId}`);
      toast.success("Outsourcing order deleted successfully");
      fetchOutsourcingOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete outsourcing order");
    }
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
          size_distribution: outsourcingForm.size_distribution,
          notes: outsourcingForm.notes || ""
        });
        toast.success("Outsourcing order updated successfully");
      } else {
        await axios.post(`${API}/outsourcing-orders`, {
          cutting_order_ids: outsourcingForm.cutting_order_ids,
          dc_date: new Date(outsourcingForm.dc_date).toISOString(),
          operation_type: outsourcingForm.operation_type,
          unit_name: outsourcingForm.unit_name,
          rate_per_pcs: parseFloat(outsourcingForm.rate_per_pcs),
          notes: outsourcingForm.notes || ""
        });
        toast.success(`Outsourcing order created with ${outsourcingForm.cutting_order_ids.length} lot(s)`);
      }
      
      setOutsourcingDialogOpen(false);
      setOutsourcingForm({
        dc_date: new Date().toISOString().split('T')[0],
        cutting_order_ids: [],
        operation_type: "Printing",
        unit_name: "",
        rate_per_pcs: "",
        notes: ""
      });
      setEditingOutsourcingOrder(null);
      fetchOutsourcingOrders();
      fetchCuttingOrders();
      fetchDashboardStats();
    } catch (error) {
      console.error("Error saving outsourcing order:", error);
      // Show detailed error message from backend if available
      const errorMessage = error.response?.data?.detail || "Failed to save outsourcing order";
      toast.error(errorMessage, { duration: 6000 }); // Show for 6 seconds for longer messages
    } finally {
      setLoading(false);
    }
  };

  const openEditOutsourcingOrder = (order) => {
    setEditingOutsourcingOrder(order);
    setOutsourcingForm({
      dc_date: new Date(order.dc_date).toISOString().split('T')[0],
      cutting_order_ids: order.cutting_order_ids || [order.cutting_order_id],
      operation_type: order.operation_type,
      unit_name: order.unit_name,
      rate_per_pcs: order.rate_per_pcs.toString(),
      notes: order.notes || "",
      size_distribution: order.size_distribution || {}
    });
    fetchUnitsByOperation(order.operation_type);
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
        received_distribution: {},
        mistake_distribution: {}
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
        rate_per_pcs: "",
        master_pack_ratio: {},
        stock_lot_name: "",
        stock_color: ""
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
        received_distribution: {},
        mistake_distribution: {}
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

  // Edit Receipt Handler
  const handleEditReceipt = (receipt) => {
    setSelectedEditReceipt(receipt);
    setEditReceiptForm({
      receipt_date: new Date(receipt.receipt_date).toISOString().split('T')[0],
      received_distribution: { ...receipt.received_distribution },
      mistake_distribution: { ...receipt.mistake_distribution }
    });
    setEditReceiptDialogOpen(true);
  };

  const handleEditReceiptSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = selectedEditReceipt.type === 'Outsourcing' 
        ? `${API}/outsourcing-receipts/${selectedEditReceipt.id}`
        : `${API}/ironing-receipts/${selectedEditReceipt.id}`;
      
      await axios.put(endpoint, {
        outsourcing_order_id: selectedEditReceipt.outsourcing_order_id,
        ironing_order_id: selectedEditReceipt.ironing_order_id,
        receipt_date: new Date(editReceiptForm.receipt_date).toISOString(),
        received_distribution: editReceiptForm.received_distribution,
        mistake_distribution: editReceiptForm.mistake_distribution
      });
      
      toast.success("Receipt updated successfully");
      setEditReceiptDialogOpen(false);
      setSelectedEditReceipt(null);
      
      // Refresh data
      fetchOutsourcingReceipts();
      fetchIroningReceipts();
      fetchOutsourcingOrders();
      fetchIroningOrders();
    } catch (error) {
      console.error("Error updating receipt:", error);
      toast.error(error.response?.data?.detail || "Failed to update receipt");
    } finally {
      setLoading(false);
    }
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

  const handleCatalogImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload JPEG, PNG, or WebP image.');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 5MB.');
        return;
      }
      setCatalogImageFile(file);
      setCatalogImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let imageUrl = catalogForm.image_url;
      
      // Upload image if selected
      if (catalogImageFile) {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', catalogImageFile);
        
        const uploadResponse = await axios.post(`${API}/upload/catalog-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadResponse.data.image_url;
        setUploadingImage(false);
      }
      
      await axios.post(`${API}/catalogs`, { ...catalogForm, image_url: imageUrl });
      toast.success("Catalog created successfully");
      
      setCatalogDialogOpen(false);
      setCatalogForm({
        catalog_name: "",
        catalog_code: "",
        description: "",
        image_url: "",
        lot_numbers: []
      });
      setCatalogImageFile(null);
      setCatalogImagePreview(null);
      fetchCatalogs();
    } catch (error) {
      console.error("Error creating catalog:", error);
      toast.error(error.response?.data?.detail || "Failed to create catalog");
    } finally {
      setLoading(false);
    }
  };

  // Fetch unique units for payment
  const fetchAvailableUnits = async () => {
    try {
      const [outsourcingRes, ironingRes] = await Promise.all([
        axios.get(`${API}/outsourcing-orders`),
        axios.get(`${API}/ironing-orders`)
      ]);
      const outsourcingUnits = outsourcingRes.data.map(o => o.unit_name);
      const ironingUnits = ironingRes.data.map(o => o.unit_name);
      const allUnits = [...new Set([...outsourcingUnits, ...ironingUnits])].filter(Boolean);
      setAvailableUnits(allUnits);
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchPendingBills = async (unitName) => {
    if (!unitName) {
      setPendingBills(null);
      return;
    }
    try {
      const response = await axios.get(`${API}/units/${encodeURIComponent(unitName)}/pending-bills`);
      setPendingBills(response.data);
    } catch (error) {
      console.error("Error fetching pending bills:", error);
      toast.error("Failed to fetch pending bills");
    }
  };

  const handleUnitPaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/units/payment`, {
        unit_name: unitPaymentForm.unit_name,
        amount: parseFloat(unitPaymentForm.amount),
        transaction_type: unitPaymentForm.transaction_type,
        payment_method: unitPaymentForm.payment_method,
        notes: unitPaymentForm.notes
      });
      const actionText = unitPaymentForm.transaction_type === 'debit' ? 'Debit' : 'Payment';
      toast.success(`${actionText} of ₹${unitPaymentForm.amount} recorded for ${unitPaymentForm.unit_name}`);
      setUnitPaymentDialogOpen(false);
      setUnitPaymentForm({ unit_name: "", amount: "", transaction_type: "credit", payment_method: "Cash", notes: "" });
      setPendingBills(null);
      fetchOutsourcingOrders();
      fetchIroningOrders();
    } catch (error) {
      console.error("Error recording transaction:", error);
      toast.error(error.response?.data?.detail || "Failed to record transaction");
    } finally {
      setLoading(false);
    }
  };

  // Stock Handlers
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/stock`, stockForm);
      toast.success("Stock added successfully");
      setStockDialogOpen(false);
      setStockForm({
        lot_number: "",
        category: "Mens",
        style_type: "",
        color: "",
        size_distribution: { M: 0, L: 0, XL: 0, XXL: 0 },
        master_pack_ratio: { M: 1, L: 1, XL: 1, XXL: 1 },
        notes: ""
      });
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error(error.response?.data?.detail || "Failed to add stock");
    } finally {
      setLoading(false);
    }
  };

  const handleStockDispatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/stock/${selectedStock.id}/dispatch`, stockDispatchForm);
      toast.success("Stock dispatched successfully");
      setStockDispatchDialogOpen(false);
      setSelectedStock(null);
      setStockDispatchForm({ master_packs: 0, loose_pcs: {}, customer_name: "", bora_number: "", notes: "" });
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error dispatching stock:", error);
      toast.error(error.response?.data?.detail || "Failed to dispatch stock");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCatalogFromStock = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/stock/${selectedStock.id}/create-catalog?catalog_name=${encodeURIComponent(stockCatalogForm.catalog_name)}&catalog_code=${encodeURIComponent(stockCatalogForm.catalog_code)}&description=${encodeURIComponent(stockCatalogForm.description || '')}`);
      toast.success("Catalog created from stock successfully");
      setStockCatalogDialogOpen(false);
      setSelectedStock(null);
      setStockCatalogForm({ catalog_name: "", catalog_code: "", description: "" });
      fetchStocks();
      fetchCatalogs();
    } catch (error) {
      console.error("Error creating catalog:", error);
      toast.error(error.response?.data?.detail || "Failed to create catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async (stockId) => {
    if (!window.confirm("Are you sure you want to delete this stock?")) return;
    try {
      await axios.delete(`${API}/stock/${stockId}`);
      toast.success("Stock deleted successfully");
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error deleting stock:", error);
      toast.error("Failed to delete stock");
    }
  };

  // QR Code & Scan Handlers
  const handleQuickDispatch = async (stockId) => {
    try {
      const response = await axios.post(`${API}/stock/${stockId}/quick-dispatch`);
      toast.success(`Quick dispatch: ${response.data.dispatched} pcs (Bora: ${response.data.bora_number})`);
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error in quick dispatch:", error);
      toast.error(error.response?.data?.detail || "Quick dispatch failed");
    }
  };

  const handleQRScanResult = async (decodedText) => {
    try {
      const data = JSON.parse(decodedText);
      if (data.type === 'stock' && data.id) {
        // Fetch full stock details
        const response = await axios.get(`${API}/stock/${data.id}`);
        setScannedStock(response.data);
        
        if (scanMode === 'dispatch') {
          setScanDispatchForm({
            customer_name: "",
            bora_number: "",
            master_packs: 1,
            loose_pcs: {}
          });
          setScanDispatchDialogOpen(true);
        } else if (scanMode === 'newlot') {
          setScanNewLotForm({
            lot_number: "",
            size_distribution: { M: 0, L: 0, XL: 0, XXL: 0 },
            notes: ""
          });
          setScanNewLotDialogOpen(true);
        }
        setScanMode(null);
      } else {
        toast.error("Invalid QR code format");
      }
    } catch (error) {
      console.error("Error processing QR scan:", error);
      toast.error("Failed to process QR code");
    }
  };

  const handleScanDispatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/stock/${scannedStock.id}/dispatch`, {
        master_packs: parseInt(scanDispatchForm.master_packs) || 0,
        loose_pcs: scanDispatchForm.loose_pcs,
        customer_name: scanDispatchForm.customer_name,
        bora_number: scanDispatchForm.bora_number,
        notes: ""
      });
      toast.success("Dispatch from scan successful!");
      setScanDispatchDialogOpen(false);
      setScannedStock(null);
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error dispatching from scan:", error);
      toast.error(error.response?.data?.detail || "Dispatch failed");
    } finally {
      setLoading(false);
    }
  };

  const handleScanNewLotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/stock/copy-from/${scannedStock.id}`, {
        lot_number: scanNewLotForm.lot_number,
        category: scannedStock.category,
        style_type: scannedStock.style_type,
        color: scannedStock.color,
        size_distribution: scanNewLotForm.size_distribution,
        master_pack_ratio: scannedStock.master_pack_ratio,
        notes: scanNewLotForm.notes
      });
      toast.success("New lot created from scan!");
      setScanNewLotDialogOpen(false);
      setScannedStock(null);
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error creating lot from scan:", error);
      toast.error(error.response?.data?.detail || "Failed to create lot");
    } finally {
      setLoading(false);
    }
  };

  // Bulk Dispatch Handlers
  const addItemToDispatch = (stock) => {
    setSelectedStocksForDispatch(prevItems => {
      // Check if already added
      if (prevItems.find(s => s.stock_id === stock.id)) {
        toast.error("Item already added to dispatch");
        return prevItems;
      }
      
      const newItem = {
        stock_id: stock.id,
        stock_code: stock.stock_code,
        lot_number: stock.lot_number,
        category: stock.category,
        style_type: stock.style_type,
        color: stock.color,
        available_quantity: stock.available_quantity,
        master_pack_ratio: stock.master_pack_ratio || {},
        master_packs: 0,
        loose_pcs: {}
      };
      toast.success(`Added ${stock.stock_code} to dispatch`);
      return [...prevItems, newItem];
    });
  };

  const removeItemFromDispatch = (stockId) => {
    setSelectedStocksForDispatch(prevItems => prevItems.filter(s => s.stock_id !== stockId));
  };

  const updateDispatchItem = (stockId, field, value) => {
    setSelectedStocksForDispatch(prevItems => prevItems.map(item => {
      if (item.stock_id === stockId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const updateDispatchItemLoosePcs = (stockId, size, qty) => {
    setSelectedStocksForDispatch(prevItems => prevItems.map(item => {
      if (item.stock_id === stockId) {
        return { 
          ...item, 
          loose_pcs: { ...item.loose_pcs, [size]: parseInt(qty) || 0 }
        };
      }
      return item;
    }));
  };

  const calculateItemTotal = (item) => {
    let total = 0;
    // Master packs quantity
    if (item.master_packs > 0 && item.master_pack_ratio) {
      for (const size in item.master_pack_ratio) {
        total += item.master_packs * (item.master_pack_ratio[size] || 0);
      }
    }
    // Loose pieces
    for (const size in item.loose_pcs) {
      total += item.loose_pcs[size] || 0;
    }
    return total;
  };

  const calculateGrandTotal = () => {
    return selectedStocksForDispatch.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleBulkDispatchSubmit = async (e) => {
    e.preventDefault();
    if (selectedStocksForDispatch.length === 0) {
      toast.error("Please add items to dispatch");
      return;
    }
    
    // Validate quantities
    for (const item of selectedStocksForDispatch) {
      const total = calculateItemTotal(item);
      if (total === 0) {
        toast.error(`Please enter quantity for ${item.stock_code}`);
        return;
      }
      if (total > item.available_quantity) {
        toast.error(`${item.stock_code}: Requested ${total} but only ${item.available_quantity} available`);
        return;
      }
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/bulk-dispatches`, {
        dispatch_date: new Date(bulkDispatchForm.dispatch_date).toISOString(),
        customer_name: bulkDispatchForm.customer_name,
        bora_number: bulkDispatchForm.bora_number,
        notes: bulkDispatchForm.notes,
        remarks: bulkDispatchForm.remarks,
        items: selectedStocksForDispatch.map(item => ({
          stock_id: item.stock_id,
          master_packs: item.master_packs,
          loose_pcs: item.loose_pcs
        }))
      });
      
      toast.success(`Dispatch ${response.data.dispatch_number} created! Total: ${response.data.grand_total_quantity} pcs`);
      setBulkDispatchDialogOpen(false);
      setBulkDispatchForm({
        dispatch_date: new Date().toISOString().split('T')[0],
        customer_name: "",
        bora_number: "",
        notes: "",
        remarks: "",
        items: []
      });
      setSelectedStocksForDispatch([]);
      fetchBulkDispatches();
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error creating bulk dispatch:", error);
      toast.error(error.response?.data?.detail || "Failed to create dispatch");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulkDispatch = async (dispatchId) => {
    if (!window.confirm("Delete this dispatch? Stock quantities will be restored.")) return;
    
    try {
      await axios.delete(`${API}/bulk-dispatches/${dispatchId}`);
      toast.success("Dispatch deleted and stock restored");
      fetchBulkDispatches();
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error deleting dispatch:", error);
      toast.error(error.response?.data?.detail || "Failed to delete dispatch");
    }
  };

  const handlePrintDispatch = (dispatchId) => {
    window.open(`${API}/bulk-dispatches/${dispatchId}/print`, '_blank');
  };

  // Bulk Operations Handlers
  const toggleStockSelection = (stockId) => {
    if (selectedStockIds.includes(stockId)) {
      setSelectedStockIds(selectedStockIds.filter(id => id !== stockId));
    } else {
      setSelectedStockIds([...selectedStockIds, stockId]);
    }
  };

  const selectAllStocks = () => {
    if (selectedStockIds.length === stocks.length) {
      setSelectedStockIds([]);
    } else {
      setSelectedStockIds(stocks.map(s => s.id));
    }
  };

  const handleBulkDeleteStock = async () => {
    if (selectedStockIds.length === 0) {
      toast.error("No items selected");
      return;
    }
    
    if (!window.confirm(`Delete ${selectedStockIds.length} selected stock items? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    let deleted = 0;
    let failed = 0;
    
    for (const stockId of selectedStockIds) {
      try {
        await axios.delete(`${API}/stock/${stockId}`);
        deleted++;
      } catch (error) {
        failed++;
        console.error(`Failed to delete stock ${stockId}:`, error);
      }
    }
    
    setLoading(false);
    setSelectedStockIds([]);
    setBulkSelectMode(false);
    fetchStocks();
    fetchStockSummary();
    
    if (failed > 0) {
      toast.warning(`Deleted ${deleted} items, ${failed} failed`);
    } else {
      toast.success(`Deleted ${deleted} items successfully`);
    }
  };

  const handlePrintStockLabels = () => {
    const ids = selectedStockIds.join(',');
    window.open(`${API}/stock/labels/print?stock_ids=${ids}`, '_blank');
  };

  const handleBulkAddToDispatch = () => {
    const selectedItems = stocks.filter(s => selectedStockIds.includes(s.id) && s.available_quantity > 0);
    selectedItems.forEach(stock => {
      if (!selectedStocksForDispatch.find(s => s.stock_id === stock.id)) {
        addItemToDispatch(stock);
      }
    });
    setBulkSelectMode(false);
    setSelectedStockIds([]);
    setBulkDispatchDialogOpen(true);
    toast.success(`Added ${selectedItems.length} items to dispatch`);
  };

  // Phase 3 Handlers
  const handleTrackLot = async () => {
    if (!trackingLotNumber.trim()) {
      toast.error("Please enter a lot number");
      return;
    }
    await fetchLotJourney(trackingLotNumber);
  };

  const handleExportAllData = () => {
    window.open(`${API}/export/all`, '_blank');
    toast.success("Downloading backup...");
  };

  const handleExportCollection = (collection) => {
    window.open(`${API}/export/csv/${collection}`, '_blank');
    toast.success(`Downloading ${collection}...`);
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(`${API}/settings`, appSettings);
      toast.success("Settings saved!");
      setSettingsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  // Returns Management Handlers
  const handleCreateReturn = async (e) => {
    e.preventDefault();
    if (!returnForm.source_id || !returnForm.quantity || !returnForm.reason) {
      toast.error("Please fill all required fields");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/returns`, {
        ...returnForm,
        return_date: new Date(returnForm.return_date).toISOString(),
        quantity: parseInt(returnForm.quantity)
      });
      toast.success("Return recorded successfully!");
      setReturnDialogOpen(false);
      setReturnForm({
        source_type: 'dispatch',
        source_id: '',
        return_date: new Date().toISOString().split('T')[0],
        quantity: '',
        reason: '',
        notes: ''
      });
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record return");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async (returnId, action) => {
    const actionText = action === 'accept' ? 'Accept' : 'Reject';
    if (!window.confirm(`${actionText} this return?`)) return;
    
    try {
      await axios.put(`${API}/returns/${returnId}/process?action=${action}`);
      toast.success(`Return ${action === 'accept' ? 'accepted' : 'rejected'}!`);
      fetchReturns();
      if (action === 'accept') {
        fetchStocks();
        fetchStockSummary();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process return");
    }
  };

  const handleDeleteReturn = async (returnId) => {
    if (!window.confirm("Delete this return record?")) return;
    
    try {
      await axios.delete(`${API}/returns/${returnId}`);
      toast.success("Return deleted");
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete return");
    }
  };

  // Unified Lot QR Scan Handler
  const handleLotQRScan = async (decodedText) => {
    console.log("Scanned text:", decodedText);
    try {
      // First try to parse as JSON
      let data;
      try {
        data = JSON.parse(decodedText);
      } catch (parseError) {
        // Not JSON - treat as plain lot number
        console.log("Not JSON, treating as lot number:", decodedText);
        // Try to find lot by the scanned text directly
        try {
          const response = await axios.get(`${API}/lot/by-number/${encodeURIComponent(decodedText)}`);
          setScannedLot(response.data);
          // Don't close dialog - the scannedLot being set will show lot details in same dialog
          toast.success(`Found: ${decodedText}`);
          return;
        } catch (e) {
          toast.error(`Lot not found: ${decodedText}`);
          return;
        }
      }
      
      if (data.type === 'lot' && data.lot) {
        // Fetch lot details with current status
        const response = await axios.get(`${API}/lot/by-number/${encodeURIComponent(data.lot)}`);
        setScannedLot(response.data);
        toast.success(`Found: ${data.lot}`);
      } else if (data.type === 'stock' && data.code) {
        // Stock QR code scanned
        toast.info(`Stock QR scanned: ${data.code}. Use Dispatch tab to scan stock.`);
      } else {
        toast.error("Invalid QR code format");
      }
    } catch (error) {
      console.error("Error processing lot QR:", error);
      toast.error(error.response?.data?.detail || "Failed to process QR code");
    }
  };

  const handleScanSendOutsourcing = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lotNum = scannedLot.order.cutting_lot_number || scannedLot.order.lot_number;
      await axios.post(`${API}/scan/send-outsourcing`, {
        lot_number: lotNum,
        unit_name: scanSendOutsourcingForm.unit_name,
        operation_type: scanSendOutsourcingForm.operation_type,
        rate_per_pcs: scanSendOutsourcingForm.rate_per_pcs
      });
      toast.success("Sent to outsourcing successfully!");
      setScanActionDialog(null);
      setScannedLot(null);
      fetchOutsourcingOrders();
    } catch (error) {
      console.error("Error sending to outsourcing:", error);
      toast.error(error.response?.data?.detail || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const handleScanReceive = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lotNum = scannedLot.order.cutting_lot_number || scannedLot.order.lot_number;
      await axios.post(`${API}/scan/receive-outsourcing`, {
        lot_number: lotNum,
        received_distribution: scanReceiveForm.received_distribution,
        mistake_distribution: scanReceiveForm.mistake_distribution
      });
      toast.success("Receipt recorded successfully!");
      setScanActionDialog(null);
      setScannedLot(null);
      fetchOutsourcingReceipts();
      fetchOutsourcingOrders();
    } catch (error) {
      console.error("Error receiving:", error);
      toast.error(error.response?.data?.detail || "Failed to receive");
    } finally {
      setLoading(false);
    }
  };

  const handleScanReceiveIroning = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lotNum = scannedLot.order.cutting_lot_number || scannedLot.order.lot_number;
      const response = await axios.post(`${API}/scan/receive-ironing`, {
        lot_number: lotNum,
        received_distribution: scanReceiveIroningForm.received_distribution,
        mistake_distribution: scanReceiveIroningForm.mistake_distribution
      });
      toast.success(`🎉 Ironing received & Stock created! Code: ${response.data.stock_code}`);
      setScanActionDialog(null);
      setScannedLot(null);
      fetchIroningReceipts();
      fetchIroningOrders();
      fetchStocks();
      fetchStockSummary();
    } catch (error) {
      console.error("Error receiving ironing:", error);
      toast.error(error.response?.data?.detail || "Failed to receive from ironing");
    } finally {
      setLoading(false);
    }
  };

  const handleScanCreateIroning = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lotNum = scannedLot.order.cutting_lot_number || scannedLot.order.lot_number;
      await axios.post(`${API}/scan/create-ironing`, {
        lot_number: lotNum,
        unit_name: scanIroningForm.unit_name,
        master_pack_ratio: scanIroningForm.master_pack_ratio,
        rate_per_pcs: scanIroningForm.rate_per_pcs
      });
      toast.success("Ironing order created successfully!");
      setScanActionDialog(null);
      setScannedLot(null);
      fetchIroningOrders();
    } catch (error) {
      console.error("Error creating ironing:", error);
      toast.error(error.response?.data?.detail || "Failed to create ironing");
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Get the color from the selected lot
      const cuttingOrder = cuttingOrders.find(co => co.lot_number === selectedDispatchLot);
      const color = cuttingOrder?.color || 'N/A';
      
      await axios.post(`${API}/catalogs/${selectedCatalog.id}/dispatch`, {
        master_packs: parseInt(dispatchForm.master_packs) || 0,
        loose_pcs: dispatchForm.loose_pcs,
        customer_name: dispatchForm.customer_name,
        dispatch_date: new Date().toISOString(),
        bora_number: dispatchForm.bora_number,
        color: color,
        lot_number: selectedDispatchLot,
        notes: dispatchForm.notes || null
      });
      toast.success("Dispatch recorded successfully");
      
      setDispatchDialogOpen(false);
      setDispatchForm({ customer_name: '', bora_number: '', notes: '', master_packs: 0, loose_pcs: {} });
      setSelectedCatalog(null);
      setSelectedDispatchLot(null);
      fetchCatalogs();
    } catch (error) {
      console.error("Error recording dispatch:", error);
      toast.error(error.response?.data?.detail || "Failed to record dispatch");
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp Functions
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    // Add India country code if not present
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  };

  const generateDCMessage = (order) => {
    const lotDetails = order.lot_details?.length > 0 
      ? order.lot_details.map(lot => 
          `📦 ${lot.cutting_lot_number} (${lot.category}): ${lot.quantity} pcs`
        ).join('\n')
      : `📦 Lot: ${order.cutting_lot_number || 'N/A'}`;
    
    const sizeDetails = Object.entries(order.size_distribution || {})
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => `${size}: ${qty}`)
      .join(' | ');

    return `🏭 *DELIVERY CHALLAN*
━━━━━━━━━━━━━━━━━
📋 *DC Number:* ${order.dc_number}
📅 *Date:* ${new Date(order.dc_date).toLocaleDateString('en-IN')}
🔧 *Operation:* ${order.operation_type}

${lotDetails}

📊 *Size Distribution:*
${sizeDetails}

📦 *Total Qty:* ${order.total_quantity} pcs
💰 *Rate:* ₹${order.rate_per_pcs}/pc
💵 *Total Amount:* ₹${order.total_amount}

${order.notes ? `📝 Notes: ${order.notes}` : ''}
━━━━━━━━━━━━━━━━━
_Arian Knit Fab_`;
  };

  const generateReminderMessage = (order) => {
    const daysPending = Math.floor((new Date() - new Date(order.dc_date)) / (1000 * 60 * 60 * 24));
    return `⚠️ *REMINDER: Pending Order*
━━━━━━━━━━━━━━━━━
📋 *DC Number:* ${order.dc_number}
📅 *Sent Date:* ${new Date(order.dc_date).toLocaleDateString('en-IN')}
⏰ *Pending Since:* ${daysPending} days

🔧 *Operation:* ${order.operation_type}
📦 *Lot:* ${order.cutting_lot_number || order.lot_details?.[0]?.cutting_lot_number || 'N/A'}
📦 *Quantity:* ${order.total_quantity} pcs

🙏 Please arrange delivery at the earliest.
━━━━━━━━━━━━━━━━━
_Arian Knit Fab_`;
  };

  const generatePaymentMessage = (unitName, amount, method, pendingAmount) => {
    return `✅ *PAYMENT CONFIRMATION*
━━━━━━━━━━━━━━━━━
🏢 *Unit:* ${unitName}
💰 *Amount Paid:* ₹${amount}
💳 *Method:* ${method}
📅 *Date:* ${new Date().toLocaleDateString('en-IN')}

${pendingAmount > 0 ? `⏳ *Remaining Balance:* ₹${pendingAmount}` : '✅ *All dues cleared!*'}
━━━━━━━━━━━━━━━━━
Thank you for your service!
_Arian Knit Fab_`;
  };

  const generatePaymentReminderMessage = (unitName, totalPending, billsCount, bills) => {
    const billDetails = bills.slice(0, 5).map(bill => 
      `• ${bill.dc_number} (${bill.type}): ₹${bill.balance}`
    ).join('\n');
    
    return `💰 *PAYMENT REMINDER*
━━━━━━━━━━━━━━━━━
🏢 *Unit:* ${unitName}
📅 *Date:* ${new Date().toLocaleDateString('en-IN')}

⏳ *Total Pending:* ₹${totalPending}
📋 *Bills:* ${billsCount}

${billDetails}${bills.length > 5 ? `\n... and ${bills.length - 5} more` : ''}

🙏 Please arrange payment at the earliest.
━━━━━━━━━━━━━━━━━
_Arian Knit Fab_`;
  };

  const openWhatsApp = (phone, message) => {
    const formattedPhone = formatPhoneForWhatsApp(phone);
    if (!formattedPhone) {
      toast.error("Please enter a valid phone number");
      return;
    }
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
    toast.success("WhatsApp opened!");
  };

  const handleWhatsAppSend = () => {
    const phone = whatsappData.useUnitPhone ? whatsappData.unitPhone : whatsappData.phone;
    let message = '';
    
    if (whatsappData.type === 'dc') {
      message = generateDCMessage(whatsappData.data);
    } else if (whatsappData.type === 'reminder') {
      message = generateReminderMessage(whatsappData.data);
    } else if (whatsappData.type === 'payment') {
      message = generatePaymentMessage(
        whatsappData.data.unitName,
        whatsappData.data.amount,
        whatsappData.data.method,
        whatsappData.data.pendingAmount
      );
    } else if (whatsappData.type === 'payment_reminder') {
      message = generatePaymentReminderMessage(
        whatsappData.data.unitName,
        whatsappData.data.totalPending,
        whatsappData.data.billsCount,
        whatsappData.data.bills
      );
    } else if (whatsappData.type === 'dispatch') {
      message = generateDispatchMessage(whatsappData.data);
    }
    
    openWhatsApp(phone, message);
    setWhatsappDialogOpen(false);
  };

  const generateDispatchMessage = (dispatch) => {
    let message = `🚚 *DISPATCH DETAILS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 *Dispatch No:* ${dispatch.dispatch_number}\n`;
    message += `📅 *Date:* ${new Date(dispatch.dispatch_date).toLocaleDateString()}\n`;
    message += `👤 *Customer:* ${dispatch.customer_name}\n`;
    message += `📦 *Bora No:* ${dispatch.bora_number}\n\n`;
    message += `*📦 ITEMS:*\n`;
    message += `─────────────────────\n`;
    
    dispatch.items?.forEach((item, idx) => {
      message += `${idx + 1}. ${item.stock_code}\n`;
      message += `   Lot: ${item.lot_number}\n`;
      message += `   Color: ${item.color || 'N/A'}\n`;
      message += `   Packs: ${item.master_packs} | Qty: ${item.total_quantity} pcs\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *TOTAL: ${dispatch.grand_total_quantity} pcs*\n`;
    if (dispatch.notes) message += `📝 Notes: ${dispatch.notes}\n`;
    if (dispatch.remarks) message += `⚠️ Remarks: ${dispatch.remarks}\n`;
    message += `\n_Arian Knit Fab Production Pro_`;
    
    return message;
  };

  const openWhatsAppDialog = (type, data, unitPhone = '') => {
    setWhatsappData({
      type,
      data,
      phone: '',
      unitPhone: unitPhone,
      useUnitPhone: !!unitPhone
    });
    setWhatsappDialogOpen(true);
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
      received_distribution: {},
      mistake_distribution: {}
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

  // Calculate Master Packs and Loose Pieces from size distribution
  const calculateMasterPacks = (sizeDistribution, masterPackRatio) => {
    if (!masterPackRatio || !sizeDistribution || Object.keys(masterPackRatio).length === 0) {
      return { completePacks: 0, loosePieces: getTotalQty(sizeDistribution), looseDistribution: sizeDistribution || {} };
    }
    
    // Calculate how many complete packs we can make
    let completePacks = Infinity;
    for (const [size, ratioQty] of Object.entries(masterPackRatio)) {
      if (ratioQty > 0) {
        const availableQty = sizeDistribution[size] || 0;
        const possiblePacks = Math.floor(availableQty / ratioQty);
        completePacks = Math.min(completePacks, possiblePacks);
      }
    }
    
    if (completePacks === Infinity || completePacks === 0) {
      return { completePacks: 0, loosePieces: getTotalQty(sizeDistribution), looseDistribution: sizeDistribution || {} };
    }
    
    // Calculate loose pieces after removing complete packs
    const looseDistribution = {};
    let totalLoose = 0;
    for (const [size, qty] of Object.entries(sizeDistribution)) {
      const usedInPacks = completePacks * (masterPackRatio[size] || 0);
      const loose = qty - usedInPacks;
      if (loose > 0) {
        looseDistribution[size] = loose;
        totalLoose += loose;
      }
    }
    
    return { completePacks, loosePieces: totalLoose, looseDistribution };
  };

  // Get master pack ratio for a cutting lot (from its ironing order if exists)
  const getMasterPackRatioForLot = (lotNumber) => {
    // Find ironing order for this lot
    const ironingOrder = ironingOrders.find(o => o.cutting_lot_number === lotNumber);
    return ironingOrder?.master_pack_ratio || null;
  };

  // Filtered data based on search and filters
  // Memoized filtered lists for better performance
  const filteredFabricLots = useMemo(() => fabricLots.filter(lot => {
    const searchLower = fabricSearch.toLowerCase();
    const matchesSearch = !fabricSearch || 
      lot.lot_number?.toLowerCase().includes(searchLower) ||
      lot.supplier_name?.toLowerCase().includes(searchLower) ||
      lot.color?.toLowerCase().includes(searchLower) ||
      lot.fabric_type?.toLowerCase().includes(searchLower);
    const matchesStatus = fabricStatusFilter === "all" || 
      (fabricStatusFilter === "in_stock" && lot.remaining_quantity > 0) ||
      (fabricStatusFilter === "exhausted" && lot.remaining_quantity <= 0);
    return matchesSearch && matchesStatus;
  }), [fabricLots, fabricSearch, fabricStatusFilter]);

  const filteredCuttingOrders = useMemo(() => cuttingOrders.filter(order => {
    const searchLower = cuttingSearch.toLowerCase();
    const matchesSearch = !cuttingSearch || 
      order.lot_number?.toLowerCase().includes(searchLower) ||
      order.cutting_master_name?.toLowerCase().includes(searchLower) ||
      order.style_type?.toLowerCase().includes(searchLower) ||
      order.color?.toLowerCase().includes(searchLower);
    const matchesCategory = cuttingCategoryFilter === "all" || order.category === cuttingCategoryFilter;
    return matchesSearch && matchesCategory;
  }), [cuttingOrders, cuttingSearch, cuttingCategoryFilter]);

  const filteredOutsourcingOrders = useMemo(() => outsourcingOrders.filter(order => {
    const searchLower = outsourcingSearch.toLowerCase();
    const matchesSearch = !outsourcingSearch || 
      order.dc_number?.toLowerCase().includes(searchLower) ||
      order.unit_name?.toLowerCase().includes(searchLower) ||
      order.cutting_lot_number?.toLowerCase().includes(searchLower) ||
      order.lot_details?.some(l => l.cutting_lot_number?.toLowerCase().includes(searchLower));
    const matchesOperation = outsourcingOperationFilter === "all" || order.operation_type === outsourcingOperationFilter;
    const matchesStatus = outsourcingStatusFilter === "all" || order.status === outsourcingStatusFilter;
    return matchesSearch && matchesOperation && matchesStatus;
  }), [outsourcingOrders, outsourcingSearch, outsourcingOperationFilter, outsourcingStatusFilter]);

  const allReceipts = useMemo(() => [
    ...outsourcingReceipts.map(r => ({ ...r, type: 'Outsourcing' })),
    ...ironingReceipts.map(r => ({ ...r, type: 'Ironing' }))
  ].sort((a, b) => new Date(b.received_date) - new Date(a.received_date)), [outsourcingReceipts, ironingReceipts]);

  const filteredReceipts = useMemo(() => allReceipts.filter(receipt => {
    const searchLower = receiptsSearch.toLowerCase();
    const order = receipt.type === 'Outsourcing' 
      ? outsourcingOrders.find(o => o.id === receipt.outsourcing_order_id)
      : ironingOrders.find(o => o.id === receipt.ironing_order_id);
    const matchesSearch = !receiptsSearch || 
      order?.dc_number?.toLowerCase().includes(searchLower) ||
      order?.unit_name?.toLowerCase().includes(searchLower) ||
      order?.cutting_lot_number?.toLowerCase().includes(searchLower);
    const matchesType = receiptsTypeFilter === "all" || receipt.type === receiptsTypeFilter;
    return matchesSearch && matchesType;
  }), [allReceipts, receiptsSearch, receiptsTypeFilter, outsourcingOrders, ironingOrders]);

  const filteredIroningOrders = useMemo(() => ironingOrders.filter(order => {
    const searchLower = ironingSearch.toLowerCase();
    const matchesSearch = !ironingSearch || 
      order.dc_number?.toLowerCase().includes(searchLower) ||
      order.unit_name?.toLowerCase().includes(searchLower) ||
      order.cutting_lot_number?.toLowerCase().includes(searchLower);
    const matchesStatus = ironingStatusFilter === "all" || order.status === ironingStatusFilter;
    return matchesSearch && matchesStatus;
  }), [ironingOrders, ironingSearch, ironingStatusFilter]);

  const filteredCatalogs = useMemo(() => catalogs.filter(catalog => {
    const searchLower = catalogSearch.toLowerCase();
    const matchesSearch = !catalogSearch || 
      catalog.catalog_name?.toLowerCase().includes(searchLower) ||
      catalog.style_type?.toLowerCase().includes(searchLower) ||
      catalog.color?.toLowerCase().includes(searchLower);
    const matchesCategory = catalogCategoryFilter === "all" || catalog.category === catalogCategoryFilter;
    return matchesSearch && matchesCategory;
  }), [catalogs, catalogSearch, catalogCategoryFilter]);

  const filteredStocks = useMemo(() => stocks.filter(stock => {
    const searchLower = stockSearch.toLowerCase();
    return !stockSearch || 
      stock.lot_number?.toLowerCase().includes(searchLower) ||
      stock.stock_code?.toLowerCase().includes(searchLower) ||
      stock.category?.toLowerCase().includes(searchLower) ||
      stock.style_type?.toLowerCase().includes(searchLower) ||
      stock.color?.toLowerCase().includes(searchLower);
  }), [stocks, stockSearch]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-4 rounded-2xl shadow-lg inline-block mb-4">
            <Factory className="h-10 w-10 text-white animate-pulse" />
          </div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/register page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-4 rounded-2xl shadow-lg inline-block mx-auto mb-4">
              <Factory className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Arian Knit Fab Production Pro</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {authError}
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="username"
                    type="text" 
                    placeholder="Enter username"
                    className="pl-10"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="Enter password"
                    className="pl-10"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-center text-xs text-slate-400 mt-4">
                Contact admin for new account
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 pb-16 md:pb-0">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm">📱 Install app for better experience</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleInstallApp}>
              <Download className="h-4 w-4 mr-1" /> Install
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowInstallBanner(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2 md:p-2.5 rounded-xl shadow-lg">
                <Factory className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-slate-800" data-testid="app-title">
                  {isMobile ? 'Arian Knit' : 'Arian Knit Fab Production Pro'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 hidden sm:block">Complete Production Management System</p>
              </div>
            </div>
            
            {/* Desktop Header Actions */}
            <div className="hidden md:flex items-center gap-3">
              {/* Scan Lot Button */}
              <Button 
                onClick={() => setUnifiedScannerOpen(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                data-testid="scan-lot-btn"
              >
                <Camera className="h-4 w-4 mr-2" />
                Scan Lot
              </Button>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg">
                <User className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">{currentUser?.full_name}</span>
                <Badge className={currentUser?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}>
                  {currentUser?.role}
                </Badge>
              </div>
              {currentUser?.role === 'admin' && (
                <Button 
                  onClick={() => { fetchAllUsers(); setUsersDialogOpen(true); }}
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                  data-testid="manage-users-button"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              )}
              <Button 
                onClick={handleGenerateBillReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
                data-testid="generate-bill-report"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Bill Report
              </Button>
              
              {/* Notification Bell */}
              <div className="relative">
                <Button 
                  variant="outline"
                  size="icon"
                  className="relative"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </Button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-800">🔔 Notifications</h3>
                      <span className="text-xs text-slate-500">{notifications.length} alerts</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                        <p>All clear! No alerts.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {notifications.slice(0, 10).map((notif, idx) => (
                          <div key={idx} className={`p-3 hover:bg-slate-50 ${
                            notif.type === 'error' ? 'border-l-4 border-l-red-500' :
                            notif.type === 'warning' ? 'border-l-4 border-l-amber-500' :
                            'border-l-4 border-l-blue-500'
                          }`}>
                            <p className="font-medium text-sm text-slate-800">{notif.title}</p>
                            <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          </div>
                        ))}
                        {notifications.length > 10 && (
                          <div className="p-2 text-center text-xs text-slate-500 bg-slate-50">
                            +{notifications.length - 10} more notifications
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Lot Tracking Button */}
              <Button 
                variant="outline"
                size="icon"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={() => { setLotTrackingDialogOpen(true); fetchSettings(); }}
                title="Track Lot Journey"
              >
                <History className="h-4 w-4" />
              </Button>
              
              {/* Settings Button (Admin Only) */}
              {isAdmin && (
                <Button 
                  variant="outline"
                  size="icon"
                  className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => { fetchSettings(); setSettingsDialogOpen(true); }}
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Mobile Header Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Button 
                size="icon" 
                variant="outline"
                onClick={() => setScannerDialogOpen(true)}
                className="h-9 w-9"
              >
                <QrCode className="h-5 w-5" />
              </Button>
              <Button 
                size="icon" 
                variant="outline"
                onClick={() => setMobileMenuOpen(true)}
                className="h-9 w-9"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-lg">Menu</h2>
              <Button size="icon" variant="ghost" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg mb-4">
              <User className="h-8 w-8 text-slate-600 bg-white p-1.5 rounded-full" />
              <div>
                <p className="font-medium text-slate-800">{currentUser?.full_name}</p>
                <Badge className={currentUser?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}>
                  {currentUser?.role}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              {currentUser?.role === 'admin' && (
                <Button 
                  onClick={() => { fetchAllUsers(); setUsersDialogOpen(true); setMobileMenuOpen(false); }}
                  variant="outline"
                  className="w-full justify-start border-purple-300 text-purple-600"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              )}
              <Button 
                onClick={() => { handleGenerateBillReport(); setMobileMenuOpen(false); }}
                className="w-full justify-start bg-indigo-600 hover:bg-indigo-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Bill Report
              </Button>
              <Button 
                onClick={() => { setScannerDialogOpen(true); setMobileMenuOpen(false); }}
                variant="outline"
                className="w-full justify-start"
              >
                <Camera className="h-4 w-4 mr-2" />
                Scan Barcode
              </Button>
              <hr className="my-4" />
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full justify-start border-red-300 text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-3 md:px-6 py-4 md:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop Tabs */}
          <TabsList className="hidden md:grid w-full grid-cols-10 max-w-7xl mx-auto mb-8 bg-white shadow-md" data-testid="main-tabs">
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
            <TabsTrigger value="stock" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white" data-testid="tab-stock">
              <Package className="h-4 w-4 mr-2" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="dispatch" className="data-[state=active]:bg-green-500 data-[state=active]:text-white" data-testid="tab-dispatch">
              <Truck className="h-4 w-4 mr-2" />
              Dispatch
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

          {/* Mobile Tab Selector */}
          <div className="md:hidden mb-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">📊 Dashboard</SelectItem>
                <SelectItem value="fabric-lots">📦 Fabric</SelectItem>
                <SelectItem value="cutting">✂️ Cutting</SelectItem>
                <SelectItem value="outsourcing">📤 Outsourcing</SelectItem>
                <SelectItem value="receipts">📥 Receipts</SelectItem>
                <SelectItem value="ironing">🔥 Ironing</SelectItem>
                <SelectItem value="stock">📦 Stock</SelectItem>
                <SelectItem value="dispatch">🚚 Dispatch</SelectItem>
                <SelectItem value="catalog">📚 Catalog</SelectItem>
                <SelectItem value="reports">📋 Reports</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

              {/* Analytics Charts Section */}
              {analyticsData && (
                <div className="mt-8">
                  <h3 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-indigo-600" />
                    Analytics & Insights
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Production by Category */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg">📊 Production by Category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={analyticsData.production_by_category}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="quantity" fill="#6366F1" name="Quantity" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Stock Status Pie Chart */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg">📦 Stock Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={analyticsData.stock_status}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              label={({name, value}) => `${name}: ${value}`}
                            >
                              {analyticsData.stock_status.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Cost Breakdown */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg">💰 Cost Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={analyticsData.cost_breakdown}
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              dataKey="value"
                              label={({name, value}) => `${name}: ₹${value.toLocaleString()}`}
                            >
                              {analyticsData.cost_breakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Dispatch Trend */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg">🚚 Dispatch Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {analyticsData.dispatch_trend.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={analyticsData.dispatch_trend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Area type="monotone" dataKey="quantity" stroke="#10B981" fill="#D1FAE5" name="Quantity" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-slate-500">
                            No dispatch data available
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Outsourcing by Operation */}
                  {analyticsData.outsourcing_by_operation.length > 0 && (
                    <Card className="shadow-lg mt-6">
                      <CardHeader>
                        <CardTitle className="text-lg">🔧 Outsourcing by Operation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.outsourcing_by_operation} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="quantity" fill="#8B5CF6" name="Quantity" />
                            <Bar dataKey="cost" fill="#F59E0B" name="Cost (₹)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
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
                          <Select value={lotForm.fabric_type} onValueChange={(value) => setLotForm({...lotForm, fabric_type: value})}>
                            <SelectTrigger data-testid="fabric-type-select">
                              <SelectValue placeholder="Select fabric type" />
                            </SelectTrigger>
                            <SelectContent>
                              {fabricTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier-name">Supplier Name</Label>
                          {suppliers.length > 0 ? (
                            <Select value={lotForm.supplier_name} onValueChange={(value) => setLotForm({...lotForm, supplier_name: value})}>
                              <SelectTrigger data-testid="supplier-name-select">
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map(supplier => (
                                  <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input id="supplier-name" value={lotForm.supplier_name} onChange={(e) => setLotForm({...lotForm, supplier_name: e.target.value})} placeholder="ABC Textiles" required data-testid="supplier-name-input" />
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setMasterDataDialogOpen(true)}>
                          <Settings className="h-3 w-3 mr-1" />
                          Manage Types & Suppliers
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Color</Label>
                        <Input id="color" value={lotForm.color} onChange={(e) => setLotForm({...lotForm, color: e.target.value})} placeholder="Blue" required data-testid="color-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rib-quantity">Rib Quantity (kg)</Label>
                        <Input id="rib-quantity" type="number" step="0.01" value={lotForm.rib_quantity} onChange={(e) => setLotForm({...lotForm, rib_quantity: e.target.value})} placeholder="20" required data-testid="rib-quantity-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rate-per-kg">Rate per kg (₹)</Label>
                        <Input id="rate-per-kg" type="number" step="0.01" value={lotForm.rate_per_kg} onChange={(e) => setLotForm({...lotForm, rate_per_kg: e.target.value})} placeholder="500" required data-testid="rate-per-kg-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number-of-rolls">Number of Rolls</Label>
                        <Input 
                          id="number-of-rolls" 
                          type="number" 
                          min="1" 
                          value={lotForm.number_of_rolls} 
                          onChange={(e) => setLotForm({...lotForm, number_of_rolls: parseInt(e.target.value) || 1})} 
                          placeholder="1" 
                          required 
                        />
                        <p className="text-xs text-slate-500">Each roll will get a unique identifier</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-700">💡 Fabric quantity will be calculated automatically after weighing the rolls.</p>
                        {lotForm.rate_per_kg && (
                          <p className="text-xs text-amber-600 mt-1">Rate: ₹{parseFloat(lotForm.rate_per_kg).toFixed(2)}/kg</p>
                        )}
                      </div>
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

              {/* Roll Weights Dialog */}
              <Dialog open={rollWeightsDialogOpen} onOpenChange={setRollWeightsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>⚖️ Add Roll Weights - {selectedLotForWeights?.lot_number}</DialogTitle>
                    <DialogDescription>
                      Enter the cumulative scale reading after placing each roll on the scale. Use "Restart Scale" when scale capacity is reached.
                    </DialogDescription>
                  </DialogHeader>
                  {selectedLotForWeights && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">📝 How it works:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>1️⃣ Place Roll 1 on scale → Enter reading (e.g., 22 kg)</li>
                          <li>2️⃣ Add Roll 2 on top → Enter reading (e.g., 45 kg)</li>
                          <li>🔄 <strong>Scale full?</strong> Click "Restart Scale", remove all rolls, weigh fresh</li>
                          <li>✅ System calculates individual weights automatically</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-3">
                        {selectedLotForWeights.roll_numbers.map((rollNumber, index) => (
                          <div key={index} className={`p-4 rounded-lg border ${restartPoints.includes(index) ? 'bg-amber-50 border-amber-300' : 'bg-slate-50'}`}>
                            {/* Restart indicator */}
                            {restartPoints.includes(index) && (
                              <div className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded mb-2 inline-block">
                                🔄 Scale Restarted - Fresh Weight
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold text-slate-800">Roll {index + 1}:</span>
                                <span className="ml-2 text-sm font-mono text-purple-600">{rollNumber}</span>
                              </div>
                              {scaleReadings[index] && (
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Calculated Weight</p>
                                  <p className="text-lg font-bold text-green-600">
                                    {calculateRollWeight(index)} kg
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={restartPoints.includes(index) ? `Fresh weight of Roll ${index + 1}` : `Cumulative reading after Roll ${index + 1}`}
                                value={scaleReadings[index] || ''}
                                onChange={(e) => {
                                  const newReadings = [...scaleReadings];
                                  newReadings[index] = e.target.value;
                                  setScaleReadings(newReadings);
                                }}
                                className="flex-1"
                              />
                              <span className="text-slate-600">kg</span>
                              
                              {/* Restart Scale Button */}
                              {index > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={restartPoints.includes(index) ? "default" : "outline"}
                                  className={restartPoints.includes(index) ? "bg-amber-500 hover:bg-amber-600" : "border-amber-400 text-amber-600 hover:bg-amber-50"}
                                  onClick={() => toggleRestartPoint(index)}
                                >
                                  🔄 {restartPoints.includes(index) ? "Restarted" : "Restart"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-green-900">Total Weight (All Rolls):</span>
                          <span className="text-2xl font-bold text-green-600">
                            {scaleReadings.reduce((total, reading, idx) => {
                              const weight = calculateRollWeight(idx);
                              return total + (weight ? parseFloat(weight) : 0);
                            }, 0).toFixed(2)} kg
                          </span>
                        </div>
                        {restartPoints.length > 0 && (
                          <p className="text-xs text-green-700 mt-1">
                            ℹ️ Scale restarted {restartPoints.length} time(s) at: Roll {restartPoints.map(p => p + 1).join(', Roll ')}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setRollWeightsDialogOpen(false);
                            setSelectedLotForWeights(null);
                            setScaleReadings([]);
                            setRestartPoints([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleRollWeightsSubmit}
                          disabled={loading || scaleReadings.some(r => !r || r === '')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {loading ? "Saving..." : "Save Weights"}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Return Fabric Dialog */}
              <Dialog open={returnFabricDialogOpen} onOpenChange={setReturnFabricDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>🗑️ Return Fabric to Supplier - {selectedLotForReturn?.lot_number}</DialogTitle>
                    <DialogDescription>
                      Select which rolls to return, specify quantity, and provide reason for return.
                    </DialogDescription>
                  </DialogHeader>
                  {selectedLotForReturn && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-amber-800">Total Quantity</p>
                            <p className="text-lg font-bold text-amber-900">{selectedLotForReturn.quantity} kg</p>
                          </div>
                          <div>
                            <p className="text-xs text-amber-800">Remaining</p>
                            <p className="text-lg font-bold text-amber-900">{selectedLotForReturn.remaining_quantity} kg</p>
                          </div>
                        </div>
                      </div>

                      {/* Select Rolls to Return */}
                      {selectedLotForReturn.roll_numbers && selectedLotForReturn.roll_numbers.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">Select Rolls to Return</Label>
                          <div className="bg-slate-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
                            {selectedLotForReturn.roll_numbers.map((roll, index) => (
                              <div key={index} className="flex items-center space-x-3 py-2">
                                <input
                                  type="checkbox"
                                  id={`return-roll-${index}`}
                                  checked={fabricReturnForm.returned_rolls.includes(roll)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFabricReturnForm({
                                        ...fabricReturnForm,
                                        returned_rolls: [...fabricReturnForm.returned_rolls, roll]
                                      });
                                    } else {
                                      setFabricReturnForm({
                                        ...fabricReturnForm,
                                        returned_rolls: fabricReturnForm.returned_rolls.filter(r => r !== roll)
                                      });
                                    }
                                  }}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`return-roll-${index}`} className="flex-1 cursor-pointer">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-sm text-purple-600">{roll}</span>
                                    {selectedLotForReturn.roll_weights && selectedLotForReturn.roll_weights[index] && (
                                      <span className="text-sm font-semibold text-green-600">
                                        {selectedLotForReturn.roll_weights[index]} kg
                                      </span>
                                    )}
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500">{fabricReturnForm.returned_rolls.length} roll(s) selected</p>
                        </div>
                      )}

                      {/* Quantity to Return */}
                      <div className="space-y-2">
                        <Label htmlFor="return-quantity">Quantity Returning (kg) *</Label>
                        <Input
                          id="return-quantity"
                          type="number"
                          step="0.01"
                          value={fabricReturnForm.quantity_returned}
                          onChange={(e) => setFabricReturnForm({...fabricReturnForm, quantity_returned: e.target.value})}
                          placeholder="Enter kg"
                          required
                        />
                      </div>

                      {/* Reason for Return */}
                      <div className="space-y-2">
                        <Label htmlFor="return-reason">Reason for Return *</Label>
                        <Select 
                          value={fabricReturnForm.reason} 
                          onValueChange={(value) => setFabricReturnForm({...fabricReturnForm, reason: value})}
                        >
                          <SelectTrigger id="return-reason">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Wrong Color">Wrong Color</SelectItem>
                            <SelectItem value="Wrong Quality">Wrong Quality</SelectItem>
                            <SelectItem value="Damaged">Damaged</SelectItem>
                            <SelectItem value="Defective">Defective</SelectItem>
                            <SelectItem value="Wrong Type">Wrong Type</SelectItem>
                            <SelectItem value="Supplier Mistake">Supplier Mistake</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Comments */}
                      <div className="space-y-2">
                        <Label htmlFor="return-comments">Additional Comments</Label>
                        <textarea
                          id="return-comments"
                          value={fabricReturnForm.comments}
                          onChange={(e) => setFabricReturnForm({...fabricReturnForm, comments: e.target.value})}
                          placeholder="Enter additional details about the return..."
                          className="w-full min-h-[80px] p-2 border rounded-md"
                        />
                      </div>

                      {/* Summary */}
                      {fabricReturnForm.quantity_returned && (
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <h4 className="font-semibold text-red-900 mb-2">Return Summary:</h4>
                          <ul className="text-sm text-red-800 space-y-1">
                            <li>• Returning: <strong>{fabricReturnForm.quantity_returned} kg</strong></li>
                            <li>• Rolls: <strong>{fabricReturnForm.returned_rolls.length > 0 ? fabricReturnForm.returned_rolls.join(', ') : 'None selected'}</strong></li>
                            <li>• New remaining quantity: <strong>{(selectedLotForReturn.remaining_quantity - parseFloat(fabricReturnForm.quantity_returned || 0)).toFixed(2)} kg</strong></li>
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setReturnFabricDialogOpen(false);
                            setSelectedLotForReturn(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleReturnFabricSubmit}
                          disabled={loading || !fabricReturnForm.quantity_returned || fabricReturnForm.returned_rolls.length === 0}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {loading ? "Processing..." : "Confirm Return"}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Edit Fabric Lot Dialog (Admin Only) */}
              <Dialog open={editFabricDialogOpen} onOpenChange={setEditFabricDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>✏️ Edit Fabric Lot - {editingFabricLot?.lot_number}</DialogTitle>
                    <DialogDescription>Update fabric lot details (Admin only)</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditFabricLot} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fabric Type</Label>
                        <Select value={editFabricForm.fabric_type} onValueChange={(value) => setEditFabricForm({...editFabricForm, fabric_type: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fabric type" />
                          </SelectTrigger>
                          <SelectContent>
                            {FABRIC_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <Input 
                          value={editFabricForm.color}
                          onChange={(e) => setEditFabricForm({...editFabricForm, color: e.target.value})}
                          placeholder="Red, Blue, etc."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Supplier Name</Label>
                        <Input 
                          value={editFabricForm.supplier_name}
                          onChange={(e) => setEditFabricForm({...editFabricForm, supplier_name: e.target.value})}
                          placeholder="Supplier name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate per kg (₹)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={editFabricForm.rate_per_kg}
                          onChange={(e) => setEditFabricForm({...editFabricForm, rate_per_kg: e.target.value})}
                          placeholder="Rate"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Remaining Fabric (kg)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={editFabricForm.remaining_quantity}
                          onChange={(e) => setEditFabricForm({...editFabricForm, remaining_quantity: e.target.value})}
                          placeholder="Remaining quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Remaining Rib (kg)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={editFabricForm.remaining_rib_quantity}
                          onChange={(e) => setEditFabricForm({...editFabricForm, remaining_rib_quantity: e.target.value})}
                          placeholder="Remaining rib"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setEditFabricDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                        {loading ? "Saving..." : "💾 Save Changes"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by lot #, supplier, color, fabric type..." 
                    value={fabricSearch}
                    onChange={(e) => setFabricSearch(e.target.value)}
                    className="pl-10"
                    data-testid="fabric-search"
                  />
                </div>
                <Select value={fabricStatusFilter} onValueChange={setFabricStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="exhausted">Exhausted</SelectItem>
                  </SelectContent>
                </Select>
                {(fabricSearch || fabricStatusFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setFabricSearch(""); setFabricStatusFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredFabricLots.length} of {fabricLots.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredFabricLots.map((lot) => (
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
                            {isAdmin ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                                  onClick={() => openEditFabricLot(lot)}
                                  data-testid={`edit-fabric-lot-${lot.id}`}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteFabricLot(lot.id, lot.lot_number)}
                                  data-testid={`delete-fabric-lot-${lot.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Contact admin to edit/delete</span>
                            )}
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
                          {lot.roll_numbers && lot.roll_numbers.length > 0 && (
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 mt-2">
                              <p className="text-xs text-purple-900 font-semibold mb-2">
                                📦 Roll Details ({lot.number_of_rolls || lot.roll_numbers.length} rolls):
                              </p>
                              {lot.roll_weights && lot.roll_weights.length > 0 ? (
                                <div className="space-y-2">
                                  {lot.roll_numbers.map((roll, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                      <span className="font-mono text-xs text-purple-600">{roll}</span>
                                      <span className="font-bold text-green-600">⚖️ {lot.roll_weights[idx]} kg</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {lot.roll_numbers.map((roll, idx) => (
                                    <Badge key={idx} className="bg-purple-100 text-purple-700 border-purple-300 font-mono text-xs">
                                      {roll}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                            <div>
                              <p className="text-xs text-slate-500">Original Fabric</p>
                              {lot.quantity > 0 ? (
                                <p className="font-bold text-green-600">{lot.quantity} kg</p>
                              ) : (
                                <p className="font-bold text-amber-500">Pending</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Remaining</p>
                              {lot.remaining_quantity > 0 ? (
                                <p className="font-bold text-blue-600">{lot.remaining_quantity} kg</p>
                              ) : (
                                <p className="font-bold text-amber-500">Pending</p>
                              )}
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
                        <div className="ml-4 flex flex-col gap-2">
                          {lot.roll_numbers && lot.roll_numbers.length > 0 && (!lot.roll_weights || lot.roll_weights.length === 0) && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedLotForWeights(lot);
                                setScaleReadings(new Array(lot.number_of_rolls).fill(''));
                                setRollWeightsDialogOpen(true);
                              }} 
                              className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs flex items-center gap-1"
                            >
                              ⚖️ Add Weights
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setSelectedLotForReturn(lot);
                              setReturnForm({
                                returned_rolls: [],
                                quantity_returned: '',
                                reason: 'Wrong Color',
                                comments: ''
                              });
                              setReturnFabricDialogOpen(true);
                            }} 
                            className="text-red-600 border-red-300 hover:bg-red-50 text-xs flex items-center gap-1"
                          >
                            🗑️ Return Fabric
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredFabricLots.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">
                      {fabricLots.length === 0 ? "No fabric lots in inventory" : "No matching fabric lots found"}
                    </p>
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
              </div>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by lot #, master name, style, color..." 
                    value={cuttingSearch}
                    onChange={(e) => setCuttingSearch(e.target.value)}
                    className="pl-10"
                    data-testid="cutting-search"
                  />
                </div>
                <Select value={cuttingCategoryFilter} onValueChange={setCuttingCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                    <SelectItem value="Mens">Mens</SelectItem>
                    <SelectItem value="Women">Women</SelectItem>
                  </SelectContent>
                </Select>
                {(cuttingSearch || cuttingCategoryFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setCuttingSearch(""); setCuttingCategoryFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredCuttingOrders.length} of {cuttingOrders.length}
                </span>
              </div>

              <div className="flex items-center justify-end">
                <Dialog open={cuttingDialogOpen} onOpenChange={setCuttingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => { setEditingCuttingOrder(null); setLotNumberError(""); setCuttingForm({ cutting_lot_number: "", cutting_master_name: "", cutting_date: new Date().toISOString().split('T')[0], fabric_lot_id: "", lot_number: "", category: "Kids", style_type: "", fabric_taken: "", fabric_returned: "", rib_taken: "", rib_returned: "", cutting_rate_per_pcs: "", size_distribution: {}, bundle_distribution: { 'Front': 0, 'Back': 0, 'Sleeve': 0, 'Rib': 0, 'Patti': 0, 'Collar': 0, 'Front L Panel': 0, 'Front R Panel': 0, 'Back L Panel': 0, 'Back R Panel': 0 } }); }} data-testid="add-cutting-button">
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
                        <Label htmlFor="cutting-lot-number">Cutting Lot Number (Optional - auto-generated if empty)</Label>
                        <Input 
                          id="cutting-lot-number" 
                          value={cuttingForm.cutting_lot_number} 
                          onChange={async (e) => {
                            const value = e.target.value;
                            setCuttingForm({...cuttingForm, cutting_lot_number: value});
                            if (value.trim()) {
                              try {
                                const excludeId = editingCuttingOrder?.id || "";
                                const res = await axios.get(`${API}/cutting-orders/check-lot/${encodeURIComponent(value)}${excludeId ? `?exclude_id=${excludeId}` : ""}`);
                                if (!res.data.unique) {
                                  setLotNumberError(`Lot number "${value}" already exists`);
                                } else {
                                  setLotNumberError("");
                                }
                              } catch (err) {
                                setLotNumberError("");
                              }
                            } else {
                              setLotNumberError("");
                            }
                          }}
                          placeholder="Leave empty for auto-generate (e.g., cut 001)"
                          className={lotNumberError ? "border-red-500" : ""}
                        />
                        {lotNumberError && <p className="text-sm text-red-600">{lotNumberError}</p>}
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <input
                          type="checkbox"
                          id="is-old-lot"
                          checked={cuttingForm.is_old_lot}
                          onChange={(e) => {
                            const isOld = e.target.checked;
                            setCuttingForm({
                              ...cuttingForm, 
                              is_old_lot: isOld,
                              fabric_lot_id: isOld ? "" : cuttingForm.fabric_lot_id,
                              lot_number: isOld ? "" : cuttingForm.lot_number,
                              fabric_taken: isOld ? 0 : cuttingForm.fabric_taken,
                              fabric_returned: isOld ? 0 : cuttingForm.fabric_returned,
                              rib_taken: isOld ? 0 : cuttingForm.rib_taken,
                              rib_returned: isOld ? 0 : cuttingForm.rib_returned
                            });
                          }}
                          className="h-4 w-4"
                        />
                        <label htmlFor="is-old-lot" className="text-sm font-medium text-amber-900">
                          📝 Old Cutting Lot (No Fabric Entry) - For historical data
                        </label>
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
                        {!cuttingForm.is_old_lot && (
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
                                    {lot.lot_number} - {lot.fabric_type} ({lot.remaining_quantity > 0 ? `${lot.remaining_quantity} kg available` : 'Pending weighing'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {cuttingForm.fabric_lot_id && (() => {
                              const selectedLot = fabricLots.find(l => l.id === cuttingForm.fabric_lot_id);
                              return selectedLot ? (
                                <div className={`mt-2 p-2 rounded border ${selectedLot.remaining_quantity > 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                                  <p className={`text-xs ${selectedLot.remaining_quantity > 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                                    <strong>Available:</strong> Fabric: {selectedLot.remaining_quantity > 0 ? `${selectedLot.remaining_quantity} kg` : 'Pending weighing'} | Rib: {selectedLot.remaining_rib_quantity} kg
                                  </p>
                                  {selectedLot.remaining_quantity === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">⚠️ Please weigh fabric rolls first before creating cutting order</p>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {cuttingForm.is_old_lot && (
                          <div className="space-y-2">
                            <Label htmlFor="color-input">Color (Optional)</Label>
                            <Input 
                              id="color-input" 
                              value={cuttingForm.color} 
                              onChange={(e) => setCuttingForm({...cuttingForm, color: e.target.value})} 
                              placeholder="e.g., Red, Blue"
                            />
                          </div>
                        )}
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
                      {!cuttingForm.is_old_lot && (
                        <>
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
                        </>
                      )}
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
                {filteredCuttingOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`cutting-order-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-bold text-slate-800">{order.cutting_lot_number || order.lot_number}</h3>
                            {getCategoryBadge(order.category)}
                            <Badge className="bg-slate-100 text-slate-700 border">{order.style_type}</Badge>
                            {order.color && <Badge className="bg-purple-100 text-purple-700 border-purple-300">🎨 {order.color}</Badge>}
                            {order.sent_to_ironing && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-300">🔥 In Ironing</Badge>
                            )}
                            {order.used_in_catalog && order.catalog_name && (
                              <Badge className="bg-green-100 text-green-700 border-green-300">📦 In: {order.catalog_name}</Badge>
                            )}
                            {getPaymentStatusBadge(order.payment_status || "Unpaid")}
                          </div>
                          {order.cutting_master_name && (
                            <div className="text-sm text-slate-600">
                              <span className="font-semibold">Master:</span> {order.cutting_master_name}
                            </div>
                          )}
                          {order.completed_operations && order.completed_operations.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-500 font-semibold">Operations Done:</span>
                              {order.completed_operations.map((op, idx) => (
                                <Badge key={idx} className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  ✓ {op}
                                </Badge>
                              ))}
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
                          {order.bundle_distribution && typeof order.bundle_distribution === 'object' && Object.keys(order.bundle_distribution).length > 0 && (
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                              <p className="text-xs text-slate-600 mb-2">Bundle Distribution:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(order.bundle_distribution).filter(([_, qty]) => qty > 0).map(([bundle, qty]) => (
                                  <div key={bundle} className="bg-white px-3 py-1 rounded border">
                                    <span className="text-xs font-semibold text-slate-700">{bundle}:</span>
                                    <span className="text-sm font-bold text-amber-600 ml-1">{qty}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Master Pack Stock Display */}
                          {(() => {
                            const ratio = getMasterPackRatioForLot(order.cutting_lot_number || order.lot_number);
                            if (ratio && Object.keys(ratio).length > 0) {
                              const { completePacks, loosePieces, looseDistribution } = calculateMasterPacks(order.bundle_distribution, ratio);
                              return (
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                                  <p className="text-xs text-slate-600 mb-2">📦 Stock (Master Pack Format):</p>
                                  <div className="flex items-center gap-4">
                                    <div className="bg-white px-4 py-2 rounded border border-indigo-300">
                                      <span className="text-xs text-indigo-600 font-semibold">Master Packs:</span>
                                      <span className="text-lg font-bold text-indigo-700 ml-2">{completePacks}</span>
                                    </div>
                                    <span className="text-slate-400">+</span>
                                    <div className="bg-white px-4 py-2 rounded border border-amber-300">
                                      <span className="text-xs text-amber-600 font-semibold">Loose:</span>
                                      <span className="text-lg font-bold text-amber-700 ml-2">{loosePieces} pcs</span>
                                    </div>
                                    {loosePieces > 0 && Object.keys(looseDistribution).length > 0 && (
                                      <div className="text-xs text-slate-500">
                                        ({Object.entries(looseDistribution).filter(([_, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(', ')})
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Ratio: {Object.entries(ratio).filter(([_, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join('-')}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()}
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
                          {/* QR Code Button */}
                          <Button 
                            size="icon" 
                            variant="outline"
                            onClick={() => {
                              setSelectedLotForQR(order);
                              setLotQRDialogOpen(true);
                            }}
                            className="h-8 w-8 text-slate-600 border-slate-200 hover:bg-slate-50"
                            data-testid={`qr-lot-${order.id}`}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`${API}/cutting-orders/${order.id}/lot-report`, '_blank')}
                            className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            data-testid={`lot-report-${order.id}`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Report
                          </Button>
                          {isAdmin ? (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => openEditCuttingOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-cutting-order-${order.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteCuttingOrder(order.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" data-testid={`delete-cutting-order-${order.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic px-2">Contact admin to edit/delete</span>
                          )}
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
              {overdueOrders.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-md">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-lg font-semibold text-red-800">⚠️ Pending Reminders ({overdueOrders.length})</h3>
                      <p className="text-sm text-red-700 mt-1">The following lots have been at outsourcing units for more than 7 days without receipt:</p>
                      <div className="mt-3 space-y-2">
                        {overdueOrders.slice(0, 5).map((order, idx) => {
                          const unit = outsourcingUnits.find(u => u.unit_name === order.unit_name);
                          return (
                            <div key={idx} className="bg-white p-3 rounded border-l-2 border-red-400">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-semibold text-slate-800">{order.cutting_lot_number}</span>
                                  <span className="text-slate-600 mx-2">•</span>
                                  <span className="text-slate-700">{order.operation_type}</span>
                                  <span className="text-slate-600 mx-2">•</span>
                                  <span className="text-slate-700">{order.unit_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-green-500 text-green-600 hover:bg-green-50"
                                    onClick={() => openWhatsAppDialog('reminder', order, unit?.phone || '')}
                                    data-testid={`whatsapp-reminder-${idx}`}
                                  >
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    Remind
                                  </Button>
                                  <div className="text-right">
                                    <span className="text-red-600 font-bold text-lg">{order.days_pending} days</span>
                                    <p className="text-xs text-slate-500">DC: {order.dc_number}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {overdueOrders.length > 5 && (
                          <p className="text-sm text-red-600 font-medium mt-2">... and {overdueOrders.length - 5} more overdue orders</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Outsourcing Operations</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="border-purple-500 text-purple-600 hover:bg-purple-50"
                    onClick={() => {
                      fetchOutsourcingUnits();
                      setUnitsDialogOpen(true);
                    }}
                    data-testid="manage-units-button"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Units
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-green-500 text-green-600 hover:bg-green-50"
                    onClick={() => {
                      fetchAvailableUnits();
                      setUnitPaymentDialogOpen(true);
                    }}
                    data-testid="pay-unit-button"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pay Unit
                  </Button>
                </div>
              </div>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by DC #, unit name, lot #..." 
                    value={outsourcingSearch}
                    onChange={(e) => setOutsourcingSearch(e.target.value)}
                    className="pl-10"
                    data-testid="outsourcing-search"
                  />
                </div>
                <Select value={outsourcingOperationFilter} onValueChange={setOutsourcingOperationFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Operation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Operations</SelectItem>
                    {OPERATION_TYPES.map(op => (
                      <SelectItem key={op} value={op}>{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={outsourcingStatusFilter} onValueChange={setOutsourcingStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                  </SelectContent>
                </Select>
                {(outsourcingSearch || outsourcingOperationFilter !== "all" || outsourcingStatusFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setOutsourcingSearch(""); setOutsourcingOperationFilter("all"); setOutsourcingStatusFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredOutsourcingOrders.length} of {outsourcingOrders.length}
                </span>
              </div>

              <div className="flex items-center justify-end">
                <Dialog open={outsourcingDialogOpen} onOpenChange={setOutsourcingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => { 
                        setEditingOutsourcingOrder(null); 
                        setOutsourcingForm({ dc_date: new Date().toISOString().split('T')[0], cutting_order_ids: [], operation_type: "Printing", unit_name: "", rate_per_pcs: "", notes: "" });
                        fetchUnitsByOperation("Printing"); 
                        fetchAvailableCuttingOrders();
                      }} data-testid="add-outsourcing-button">
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
                          <Label>Select Cutting Lots (Multiple)</Label>
                          <div className="border rounded-lg p-3 max-h-60 overflow-y-auto bg-slate-50">
                            {availableCuttingOrders.length === 0 ? (
                              <div className="p-4 text-center text-slate-500 text-sm">
                                No cutting orders available. All lots have been sent to ironing.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {availableCuttingOrders.map((order) => {
                                  const isSelected = outsourcingForm.cutting_order_ids.includes(order.id);
                                  const hasOperation = order.completed_operations?.includes(outsourcingForm.operation_type);
                                  return (
                                    <div 
                                      key={order.id}
                                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                        isSelected 
                                          ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300' 
                                          : hasOperation 
                                            ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed'
                                            : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                      }`}
                                      onClick={() => {
                                        if (editingOutsourcingOrder || hasOperation) return;
                                        const newIds = isSelected
                                          ? outsourcingForm.cutting_order_ids.filter(id => id !== order.id)
                                          : [...outsourcingForm.cutting_order_ids, order.id];
                                        setOutsourcingForm({...outsourcingForm, cutting_order_ids: newIds});
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                                            <input 
                                              type="checkbox" 
                                              checked={isSelected} 
                                              disabled={hasOperation || !!editingOutsourcingOrder}
                                              onChange={() => {}}
                                              className="rounded border-slate-300"
                                            />
                                            {order.cutting_lot_number || order.lot_number} - {order.style_type}
                                          </div>
                                          <div className="text-xs text-slate-600 mt-1 ml-6">
                                            <span className="font-medium">{order.category}</span>
                                            {order.color && <span> • {order.color}</span>}
                                            <span> • {order.total_quantity} pcs</span>
                                          </div>
                                        </div>
                                        {hasOperation && (
                                          <Badge className="bg-red-100 text-red-700 text-xs">
                                            {outsourcingForm.operation_type} Done
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {outsourcingForm.cutting_order_ids.length > 0 && (
                            <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
                              <p className="text-sm font-semibold text-indigo-700">
                                ✓ {outsourcingForm.cutting_order_ids.length} lot(s) selected
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {(() => {
                        // Check for duplicates across all selected lots
                        const duplicateLots = outsourcingForm.cutting_order_ids
                          .map(id => availableCuttingOrders.find(o => o.id === id))
                          .filter(order => order?.completed_operations?.includes(outsourcingForm.operation_type));
                        
                        if (duplicateLots.length > 0) {
                          return (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                              <h3 className="text-sm font-semibold text-red-800">⚠️ Duplicate Operation Detected!</h3>
                              <p className="text-sm text-red-700 mt-1">
                                The following lots already have <strong>{outsourcingForm.operation_type}</strong> operation:
                              </p>
                              <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                                {duplicateLots.map(lot => (
                                  <li key={lot.id}>{lot.cutting_lot_number}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="operation-type">Operation Type</Label>
                          <Select 
                            value={outsourcingForm.operation_type} 
                            onValueChange={(value) => {
                              setOutsourcingForm({...outsourcingForm, operation_type: value, unit_name: ""});
                              fetchUnitsByOperation(value);
                            }} 
                            required
                          >
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
                          <Label htmlFor="unit-name">Select Unit</Label>
                          {filteredUnits.length > 0 ? (
                            <Select 
                              value={outsourcingForm.unit_name} 
                              onValueChange={(value) => setOutsourcingForm({...outsourcingForm, unit_name: value})}
                            >
                              <SelectTrigger id="unit-name" data-testid="unit-name-select">
                                <SelectValue placeholder="Select nominated unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredUnits.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.unit_name}>
                                    <div className="flex flex-col">
                                      <span className="font-semibold">{unit.unit_name}</span>
                                      {unit.contact_person && <span className="text-xs text-slate-500">{unit.contact_person} • {unit.phone}</span>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="space-y-2">
                              <Input 
                                id="unit-name" 
                                value={outsourcingForm.unit_name} 
                                onChange={(e) => setOutsourcingForm({...outsourcingForm, unit_name: e.target.value})} 
                                placeholder="Enter unit name" 
                                required 
                                data-testid="unit-name-input" 
                              />
                              <p className="text-xs text-amber-600">
                                ⚠️ No nominated units for {outsourcingForm.operation_type}. 
                                <button 
                                  type="button" 
                                  onClick={() => setUnitsDialogOpen(true)} 
                                  className="text-indigo-600 hover:underline ml-1"
                                >
                                  Add Unit
                                </button>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outsourcing-rate">Rate per Piece (₹)</Label>
                        <Input id="outsourcing-rate" type="number" step="0.01" value={outsourcingForm.rate_per_pcs} onChange={(e) => setOutsourcingForm({...outsourcingForm, rate_per_pcs: e.target.value})} placeholder="15" required data-testid="outsourcing-rate-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outsourcing-notes">Comments/Notes (Optional)</Label>
                        <textarea 
                          id="outsourcing-notes" 
                          value={outsourcingForm.notes} 
                          onChange={(e) => setOutsourcingForm({...outsourcingForm, notes: e.target.value})} 
                          placeholder="Add any special instructions or comments for this order..."
                          className="w-full min-h-[80px] p-2 border rounded-md text-sm"
                          data-testid="outsourcing-notes-input"
                        />
                      </div>
                      {/* Size Distribution - Different display for edit vs create */}
                      {editingOutsourcingOrder ? (
                        <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <h4 className="font-semibold text-slate-700">📝 Edit Size Distribution</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(outsourcingForm.size_distribution || {}).map(([size, qty]) => (
                              <div key={size} className="space-y-1">
                                <Label className="text-xs text-slate-600">{size}</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={qty}
                                  onChange={(e) => {
                                    const newDist = {...outsourcingForm.size_distribution};
                                    newDist[size] = parseInt(e.target.value) || 0;
                                    setOutsourcingForm({...outsourcingForm, size_distribution: newDist});
                                  }}
                                  className="h-8"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-amber-200">
                            <p className="text-sm text-slate-600">Total: {Object.values(outsourcingForm.size_distribution || {}).reduce((a, b) => a + b, 0)} pcs</p>
                            {outsourcingForm.rate_per_pcs && (
                              <p className="text-lg font-bold text-indigo-600">
                                Total Amount: ₹{(Object.values(outsourcingForm.size_distribution || {}).reduce((a, b) => a + b, 0) * parseFloat(outsourcingForm.rate_per_pcs || 0)).toFixed(2)}
                              </p>
                            )}
                          </div>
                          {editingOutsourcingOrder.status === 'Received' && (
                            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                              ✅ This order has been delivered. You can still edit details.
                            </div>
                          )}
                        </div>
                      ) : outsourcingForm.cutting_order_ids.length > 0 && (
                        <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-slate-700">Combined Size Distribution</h4>
                          {(() => {
                            const combinedSizes = {};
                            outsourcingForm.cutting_order_ids.forEach(id => {
                              const order = availableCuttingOrders.find(o => o.id === id);
                              if (order?.size_distribution) {
                                Object.entries(order.size_distribution).forEach(([size, qty]) => {
                                  combinedSizes[size] = (combinedSizes[size] || 0) + qty;
                                });
                              }
                            });
                            const totalQty = Object.values(combinedSizes).reduce((a, b) => a + b, 0);
                            return (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  {Object.entries(combinedSizes).map(([size, qty]) => (
                                    qty > 0 && (
                                      <div key={size} className="bg-white px-3 py-2 rounded border">
                                        <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                        <span className="text-sm font-bold text-indigo-600 ml-1">{qty}</span>
                                      </div>
                                    )
                                  ))}
                                </div>
                                <div className="pt-2 border-t border-indigo-200">
                                  <p className="text-sm text-slate-600">Total: {totalQty} pcs from {outsourcingForm.cutting_order_ids.length} lot(s)</p>
                                  {outsourcingForm.rate_per_pcs && (
                                    <p className="text-lg font-bold text-indigo-600">Total Amount: ₹{(totalQty * parseFloat(outsourcingForm.rate_per_pcs || 0)).toFixed(2)}</p>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOutsourcingDialogOpen(false)} data-testid="outsourcing-cancel-button">Cancel</Button>
                        <Button 
                          type="submit" 
                          className="bg-indigo-600 hover:bg-indigo-700" 
                          disabled={
                            loading || 
                            (!editingOutsourcingOrder && outsourcingForm.cutting_order_ids.length === 0) ||
                            !outsourcingForm.unit_name ||
                            !outsourcingForm.rate_per_pcs
                          } 
                          data-testid="outsourcing-submit-button">
                          {loading ? "Saving..." : editingOutsourcingOrder ? "Update Order" : `Create DC (${outsourcingForm.cutting_order_ids.length} Lots)`}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Manage Units Dialog */}
              <Dialog open={unitsDialogOpen} onOpenChange={(open) => {
                setUnitsDialogOpen(open);
                if (!open) {
                  setUnitForm({ unit_name: "", operations: [], contact_person: "", phone: "", address: "" });
                  setEditingUnit(null);
                }
              }}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>👥 Manage Outsourcing Units</DialogTitle>
                    <DialogDescription>Add and manage nominated outsourcing units and their operations</DialogDescription>
                  </DialogHeader>
                  
                  {/* Add/Edit Unit Form */}
                  <form onSubmit={handleUnitSubmit} className="space-y-4 bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-slate-700">{editingUnit ? "Edit Unit" : "Add New Unit"}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Unit Name *</Label>
                        <Input 
                          value={unitForm.unit_name} 
                          onChange={(e) => setUnitForm({...unitForm, unit_name: e.target.value})}
                          placeholder="e.g., Satish Printing"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input 
                          value={unitForm.contact_person} 
                          onChange={(e) => setUnitForm({...unitForm, contact_person: e.target.value})}
                          placeholder="Contact name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input 
                          value={unitForm.phone} 
                          onChange={(e) => setUnitForm({...unitForm, phone: e.target.value})}
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input 
                          value={unitForm.address} 
                          onChange={(e) => setUnitForm({...unitForm, address: e.target.value})}
                          placeholder="Unit address"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Operations Handled *</Label>
                      <div className="flex flex-wrap gap-2">
                        {OPERATION_TYPES.map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => {
                              const ops = unitForm.operations.includes(op)
                                ? unitForm.operations.filter(o => o !== op)
                                : [...unitForm.operations, op];
                              setUnitForm({...unitForm, operations: ops});
                            }}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                              unitForm.operations.includes(op)
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {unitForm.operations.includes(op) ? '✓ ' : ''}{op}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingUnit && (
                        <Button type="button" variant="outline" onClick={() => {
                          setEditingUnit(null);
                          setUnitForm({ unit_name: "", operations: [], contact_person: "", phone: "", address: "" });
                        }}>
                          Cancel Edit
                        </Button>
                      )}
                      <Button 
                        type="submit" 
                        className="bg-indigo-600 hover:bg-indigo-700"
                        disabled={loading || !unitForm.unit_name || unitForm.operations.length === 0}
                      >
                        {loading ? "Saving..." : editingUnit ? "Update Unit" : "Add Unit"}
                      </Button>
                    </div>
                  </form>

                  {/* Units List */}
                  <div className="mt-4">
                    <h4 className="font-semibold text-slate-700 mb-3">Registered Units ({outsourcingUnits.length})</h4>
                    {outsourcingUnits.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No units registered yet. Add your first unit above.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {outsourcingUnits.map((unit) => (
                          <div 
                            key={unit.id} 
                            className={`p-3 rounded-lg border flex justify-between items-start ${unit.is_active ? 'bg-white' : 'bg-slate-100 opacity-60'}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{unit.unit_name}</span>
                                {!unit.is_active && <Badge className="bg-red-100 text-red-700 text-xs">Inactive</Badge>}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {unit.operations.map((op) => (
                                  <Badge key={op} className="bg-indigo-100 text-indigo-700 text-xs">{op}</Badge>
                                ))}
                              </div>
                              {(unit.contact_person || unit.phone) && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {unit.contact_person} {unit.phone && `• ${unit.phone}`}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingUnit(unit);
                                  setUnitForm({
                                    unit_name: unit.unit_name,
                                    operations: unit.operations,
                                    contact_person: unit.contact_person || "",
                                    phone: unit.phone || "",
                                    address: unit.address || ""
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() => handleDeleteUnit(unit.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              {/* Unit Payment Dialog */}
              <Dialog open={unitPaymentDialogOpen} onOpenChange={(open) => {
                setUnitPaymentDialogOpen(open);
                if (!open) {
                  setPendingBills(null);
                  setUnitPaymentForm({ unit_name: "", amount: "", transaction_type: "credit", payment_method: "Cash", notes: "" });
                }
              }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>💳 Unit Payment / Debit</DialogTitle>
                    <DialogDescription>Record payment (credit) or add charge (debit) for unit</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUnitPaymentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Unit</Label>
                      <Select 
                        value={unitPaymentForm.unit_name} 
                        onValueChange={(value) => {
                          setUnitPaymentForm({...unitPaymentForm, unit_name: value});
                          fetchPendingBills(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUnits.map((unit) => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {pendingBills && (
                      <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                            <p className="text-xs text-slate-500">Outsourcing</p>
                            <p className="font-bold text-blue-600 text-sm">₹{pendingBills.outsourcing_pending}</p>
                          </div>
                          <div className="bg-purple-50 p-2 rounded border border-purple-200 text-center">
                            <p className="text-xs text-slate-500">Ironing</p>
                            <p className="font-bold text-purple-600 text-sm">₹{pendingBills.ironing_pending}</p>
                          </div>
                          <div className="bg-orange-50 p-2 rounded border border-orange-200 text-center">
                            <p className="text-xs text-slate-500">Debits</p>
                            <p className="font-bold text-orange-600 text-sm">₹{pendingBills.total_debits || 0}</p>
                          </div>
                          <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="font-bold text-red-600 text-sm">₹{pendingBills.total_pending}</p>
                          </div>
                        </div>
                        
                        {pendingBills.bills.length > 0 && (
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            <p className="text-xs font-semibold text-slate-600">Bills & Debits ({pendingBills.bills_count}):</p>
                            {pendingBills.bills.map((bill, idx) => (
                              <div key={idx} className={`flex justify-between items-center text-xs p-2 rounded border ${bill.type === 'debit' ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                                <div>
                                  <span>{bill.dc_number}</span>
                                  <span className={`ml-2 text-xs px-1 rounded ${bill.type === 'debit' ? 'bg-orange-200 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {bill.type}
                                  </span>
                                  {bill.notes && <span className="ml-2 text-slate-400">({bill.notes})</span>}
                                </div>
                                <span className={`font-semibold ${bill.type === 'debit' ? 'text-orange-600' : 'text-red-600'}`}>₹{bill.balance}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Send Payment Reminder via WhatsApp */}
                        {pendingBills.total_pending > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full border-green-500 text-green-600 hover:bg-green-50 mt-2"
                            onClick={() => {
                              const unit = outsourcingUnits.find(u => u.unit_name === unitPaymentForm.unit_name);
                              openWhatsAppDialog('payment_reminder', {
                                unitName: unitPaymentForm.unit_name,
                                totalPending: pendingBills.total_pending,
                                billsCount: pendingBills.bills_count,
                                bills: pendingBills.bills
                              }, unit?.phone || '');
                            }}
                            data-testid="whatsapp-payment-reminder"
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Send Payment Reminder via WhatsApp
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Transaction Type Selector */}
                    <div className="space-y-2">
                      <Label>Transaction Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={unitPaymentForm.transaction_type === 'credit' ? 'default' : 'outline'}
                          className={unitPaymentForm.transaction_type === 'credit' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => setUnitPaymentForm({...unitPaymentForm, transaction_type: 'credit'})}
                        >
                          💰 Payment (Credit)
                        </Button>
                        <Button
                          type="button"
                          variant={unitPaymentForm.transaction_type === 'debit' ? 'default' : 'outline'}
                          className={unitPaymentForm.transaction_type === 'debit' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                          onClick={() => setUnitPaymentForm({...unitPaymentForm, transaction_type: 'debit'})}
                        >
                          📝 Charge (Debit)
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        {unitPaymentForm.transaction_type === 'credit' 
                          ? '💡 Payment reduces the unit\'s pending balance' 
                          : '💡 Debit adds charges like advance, penalty, or extra work'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{unitPaymentForm.transaction_type === 'credit' ? 'Payment Amount (₹)' : 'Debit Amount (₹)'}</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={unitPaymentForm.amount}
                          onChange={(e) => setUnitPaymentForm({...unitPaymentForm, amount: e.target.value})}
                          placeholder="Enter amount"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{unitPaymentForm.transaction_type === 'credit' ? 'Payment Method' : 'Debit Reason'}</Label>
                        {unitPaymentForm.transaction_type === 'credit' ? (
                          <Select 
                            value={unitPaymentForm.payment_method}
                            onValueChange={(value) => setUnitPaymentForm({...unitPaymentForm, payment_method: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select 
                            value={unitPaymentForm.payment_method}
                            onValueChange={(value) => setUnitPaymentForm({...unitPaymentForm, payment_method: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Advance">Advance Payment</SelectItem>
                              <SelectItem value="Penalty">Penalty/Fine</SelectItem>
                              <SelectItem value="Extra Work">Extra Work</SelectItem>
                              <SelectItem value="Adjustment">Adjustment</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Notes {unitPaymentForm.transaction_type === 'debit' ? '(Required)' : '(Optional)'}</Label>
                      <Input 
                        value={unitPaymentForm.notes}
                        onChange={(e) => setUnitPaymentForm({...unitPaymentForm, notes: e.target.value})}
                        placeholder={unitPaymentForm.transaction_type === 'debit' ? 'Enter reason for debit...' : 'Add payment notes'}
                        required={unitPaymentForm.transaction_type === 'debit'}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setUnitPaymentDialogOpen(false)}>Cancel</Button>
                      <Button 
                        type="submit" 
                        className={unitPaymentForm.transaction_type === 'credit' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
                        disabled={loading || !unitPaymentForm.unit_name || !unitPaymentForm.amount || (unitPaymentForm.transaction_type === 'debit' && !unitPaymentForm.notes)}
                      >
                        {loading ? "Processing..." : unitPaymentForm.transaction_type === 'credit' ? '💰 Record Payment' : '📝 Record Debit'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="space-y-4">
                {filteredOutsourcingOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg hover:shadow-xl transition-shadow" data-testid={`outsourcing-order-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-bold text-slate-800">{order.dc_number}</h3>
                            {getStatusBadge(order.status)}
                            <Badge className="bg-purple-100 text-purple-800 border border-purple-200">{order.operation_type}</Badge>
                            {getPaymentStatusBadge(order.payment_status || "Unpaid")}
                            <Badge className="bg-slate-100 text-slate-700">
                              {order.lot_details?.length || 1} Lot(s)
                            </Badge>
                          </div>
                          
                          {/* Lot-wise Details Section */}
                          {order.lot_details && order.lot_details.length > 0 ? (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 overflow-hidden">
                              <div className="bg-indigo-100 px-3 py-2 border-b border-indigo-200">
                                <p className="text-sm font-semibold text-indigo-800">📦 Lot-wise Details</p>
                              </div>
                              <div className="divide-y divide-indigo-100">
                                {order.lot_details.map((lot, idx) => (
                                  <div key={idx} className="px-3 py-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{lot.cutting_lot_number}</span>
                                        <Badge className="bg-slate-100 text-slate-600 text-xs">{lot.category}</Badge>
                                        <span className="text-sm text-slate-600">- {lot.style_type}</span>
                                        {lot.color && <span className="text-xs text-purple-600">🎨 {lot.color}</span>}
                                      </div>
                                      <span className="font-bold text-indigo-600">{lot.quantity} pcs</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(lot.size_distribution || {}).map(([size, qty]) => (
                                        qty > 0 && (
                                          <span key={size} className="text-xs bg-white px-2 py-0.5 rounded border">
                                            {size}: {qty}
                                          </span>
                                        )
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : order.cutting_lot_number && (
                            <div className="text-sm text-slate-600 bg-indigo-50 px-3 py-2 rounded border border-indigo-200">
                              <span className="font-semibold">Cutting Lot:</span> {order.cutting_lot_number}
                              {order.color && <span className="ml-2 text-purple-600">🎨 {order.color}</span>}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2 border-t">
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
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => {
                              const unit = outsourcingUnits.find(u => u.unit_name === order.unit_name);
                              openWhatsAppDialog('dc', order, unit?.phone || '');
                            }}
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            title="Send DC via WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {isAdmin ? (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => openEditOutsourcingOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" data-testid={`edit-outsourcing-order-${order.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => handleDeleteOutsourcingOrder(order.id, order.dc_number)}
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                title="Delete Order (Admin)"
                                data-testid={`delete-outsourcing-order-${order.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic px-2">Contact admin to edit/delete</span>
                          )}
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
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">All Receipts</h2>
              </div>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by DC #, unit name, lot #..." 
                    value={receiptsSearch}
                    onChange={(e) => setReceiptsSearch(e.target.value)}
                    className="pl-10"
                    data-testid="receipts-search"
                  />
                </div>
                <Select value={receiptsTypeFilter} onValueChange={setReceiptsTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Outsourcing">Outsourcing</SelectItem>
                    <SelectItem value="Ironing">Ironing</SelectItem>
                  </SelectContent>
                </Select>
                {(receiptsSearch || receiptsTypeFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setReceiptsSearch(""); setReceiptsTypeFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredReceipts.length} of {allReceipts.length}
                </span>
              </div>

              <div className="space-y-4">
                {filteredReceipts.map((receipt) => {
                  const order = receipt.type === 'Outsourcing' 
                    ? outsourcingOrders.find(o => o.id === receipt.outsourcing_order_id)
                    : ironingOrders.find(o => o.id === receipt.ironing_order_id);
                  return (
                  <Card key={`${receipt.type}-${receipt.id}`} className="shadow-lg" data-testid={`receipt-card-${receipt.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-800">{order?.dc_number || receipt.dc_number}</h3>
                            <Badge className={receipt.type === 'Outsourcing' ? "bg-purple-100 text-purple-800 border" : "bg-blue-100 text-blue-800 border"}>
                              {receipt.type}
                            </Badge>
                            {receipt.type === 'Outsourcing' && <Badge className="bg-slate-100 text-slate-700 border">{order?.operation_type}</Badge>}
                            {receipt.total_shortage > 0 && (
                              <Badge className="bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Shortage
                              </Badge>
                            )}
                          </div>
                          {isAdmin ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-blue-600 hover:bg-blue-50"
                              onClick={() => handleEditReceipt(receipt)}
                              data-testid={`edit-receipt-${receipt.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Contact admin to edit</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Unit</p>
                            <p className="font-semibold text-slate-800">{order?.unit_name || receipt.unit_name}</p>
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
                );
                })}
              </div>

              {filteredReceipts.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <PackageCheck className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">
                      {allReceipts.length === 0 ? "No receipts recorded yet" : "No matching receipts found"}
                    </p>
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
              </div>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by DC #, unit name, lot #..." 
                    value={ironingSearch}
                    onChange={(e) => setIroningSearch(e.target.value)}
                    className="pl-10"
                    data-testid="ironing-search"
                  />
                </div>
                <Select value={ironingStatusFilter} onValueChange={setIroningStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                  </SelectContent>
                </Select>
                {(ironingSearch || ironingStatusFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setIroningSearch(""); setIroningStatusFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredIroningOrders.length} of {ironingOrders.length}
                </span>
              </div>

              <div className="flex items-center justify-end">
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
                      <div className="space-y-2 bg-green-50 p-4 rounded-lg border border-green-200">
                        <Label className="text-green-900 font-semibold">📦 Stock Details (For Stock Tab)</Label>
                        <p className="text-xs text-slate-600 mb-2">These will be shown when the lot moves to Stock after ironing</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="stock-lot-name">Lot Name for Stock</Label>
                            <Input 
                              id="stock-lot-name" 
                              value={ironingForm.stock_lot_name} 
                              onChange={(e) => setIroningForm({...ironingForm, stock_lot_name: e.target.value})} 
                              placeholder="e.g., Summer Collection Lot 1" 
                              data-testid="stock-lot-name-input" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="stock-color">Color for Stock</Label>
                            <Input 
                              id="stock-color-ironing" 
                              value={ironingForm.stock_color} 
                              onChange={(e) => setIroningForm({...ironingForm, stock_color: e.target.value})} 
                              placeholder="e.g., Navy Blue, Red" 
                              data-testid="stock-color-input" 
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <Label className="text-purple-900 font-semibold">📦 Master Pack Ratio (Optional)</Label>
                        <p className="text-xs text-slate-600 mb-2">Define how many pieces of each size make 1 master pack</p>
                        <div className="grid grid-cols-4 gap-2">
                          {['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'].map(size => (
                            <div key={size}>
                              <Label className="text-xs">{size}</Label>
                              <Input 
                                type="number" 
                                min="0"
                                placeholder="0"
                                className="h-8"
                                value={ironingForm.master_pack_ratio[size] || ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  setIroningForm({
                                    ...ironingForm, 
                                    master_pack_ratio: {...ironingForm.master_pack_ratio, [size]: value}
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Example: 2-2-2-2 means 2S + 2M + 2L + 2XL = 1 master pack</p>
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
                {filteredIroningOrders.map((order) => (
                  <Card key={order.id} className="shadow-lg border-l-4 border-l-amber-500" data-testid={`ironing-card-${order.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-slate-800">{order.dc_number}</h3>
                              {getCategoryBadge(order.category)}
                              <Badge className="bg-amber-100 text-amber-800 border">{order.status}</Badge>
                              {order.color && <Badge className="bg-purple-100 text-purple-700 border-purple-300">🎨 {order.color}</Badge>}
                              {order.stock_color && order.stock_color !== order.color && <Badge className="bg-green-100 text-green-700 border-green-300">📦 Stock: {order.stock_color}</Badge>}
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
                            <p className="text-sm text-slate-600">
                              Lot: {order.cutting_lot_number} | Style: {order.style_type}
                              {order.stock_lot_name && <span className="text-green-600"> | Stock Name: {order.stock_lot_name}</span>}
                            </p>
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
                                    received_distribution: {},
                                    mistake_distribution: {}
                                  });
                                  setIroningReceiptDialogOpen(true);
                                }}
                                data-testid={`receive-ironing-${order.id}`}
                              >
                                <PackageCheck className="h-4 w-4 mr-1" />
                                Receive
                              </Button>
                            )}
                            {isAdmin ? (
                              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteIroningOrder(order.id)} data-testid={`delete-ironing-${order.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400 italic px-2">Contact admin to delete</span>
                            )}
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

                        {order.master_pack_ratio && Object.keys(order.master_pack_ratio).length > 0 && (() => {
                          const { completePacks, loosePieces, looseDistribution } = calculateMasterPacks(order.size_distribution, order.master_pack_ratio);
                          return (
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                              <p className="text-xs text-slate-600 mb-2">📦 Stock (Master Pack Format):</p>
                              <div className="flex items-center gap-4">
                                <div className="bg-white px-4 py-2 rounded border border-purple-300">
                                  <span className="text-xs text-purple-600 font-semibold">Master Packs:</span>
                                  <span className="text-2xl font-bold text-purple-700 ml-2">{completePacks}</span>
                                </div>
                                <span className="text-slate-400 text-xl">+</span>
                                <div className="bg-white px-4 py-2 rounded border border-amber-300">
                                  <span className="text-xs text-amber-600 font-semibold">Loose:</span>
                                  <span className="text-2xl font-bold text-amber-700 ml-2">{loosePieces}</span>
                                  <span className="text-sm text-amber-600 ml-1">pcs</span>
                                </div>
                              </div>
                              {loosePieces > 0 && Object.keys(looseDistribution).length > 0 && (
                                <div className="mt-2 text-xs text-slate-500">
                                  Loose breakdown: {Object.entries(looseDistribution).filter(([_, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(', ')}
                                </div>
                              )}
                              <div className="mt-2 text-xs text-slate-600">
                                <span className="font-semibold">Pack Ratio: </span>
                                {Object.entries(order.master_pack_ratio).filter(([_, qty]) => qty > 0).map(([size, qty]) => `${size}:${qty}`).join('-')}
                              </div>
                            </div>
                          );
                        })()}

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

              {filteredIroningOrders.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Factory className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">
                      {ironingOrders.length === 0 ? "No ironing orders yet" : "No matching ironing orders found"}
                    </p>
                    {ironingOrders.length === 0 && <p className="text-slate-400 text-sm mt-2">Create an order to send items for ironing</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Stock Tab */}
          <TabsContent value="stock" data-testid="stock-content">
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl font-bold text-slate-800">📦 Stock Management</h2>
                <div className="flex flex-wrap gap-2">
                  {/* Bulk Operations Toggle */}
                  <Button 
                    variant={bulkSelectMode ? "default" : "outline"}
                    className={bulkSelectMode ? "bg-purple-600 hover:bg-purple-700" : "border-purple-300 text-purple-600 hover:bg-purple-50"}
                    onClick={() => {
                      setBulkSelectMode(!bulkSelectMode);
                      setSelectedStockIds([]);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {bulkSelectMode ? "Exit Bulk Mode" : "Bulk Select"}
                  </Button>
                  
                  {bulkSelectMode && selectedStockIds.length > 0 && (
                    <>
                      <Button 
                        variant="outline"
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                        onClick={handlePrintStockLabels}
                      >
                        <Barcode className="h-4 w-4 mr-2" />
                        Print Labels ({selectedStockIds.length})
                      </Button>
                      <Button 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleBulkAddToDispatch}
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Add to Dispatch ({selectedStockIds.length})
                      </Button>
                      {isAdmin && (
                        <Button 
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={handleBulkDeleteStock}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedStockIds.length})
                        </Button>
                      )}
                    </>
                  )}
                  
                  {!bulkSelectMode && (
                    <>
                      <Button 
                        variant="outline"
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                        onClick={() => setScanMode('newlot')}
                        data-testid="scan-newlot-btn"
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan to Add Lot
                      </Button>
                      <Button 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setStockDialogOpen(true)}
                        data-testid="add-stock-btn"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stock
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Bulk Select All */}
              {bulkSelectMode && (
                <div className="flex items-center gap-4 bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <input 
                    type="checkbox" 
                    checked={selectedStockIds.length === stocks.length && stocks.length > 0}
                    onChange={selectAllStocks}
                    className="h-5 w-5 accent-purple-600"
                  />
                  <span className="text-purple-800 font-medium">
                    {selectedStockIds.length === stocks.length ? "Deselect All" : "Select All"} 
                    ({selectedStockIds.length} of {stocks.length} selected)
                  </span>
                </div>
              )}

              {/* QR Scanner */}
              {scanMode && !bulkSelectMode && (
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">
                        📷 Scan to Add New Lot
                      </h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-white border-white hover:bg-white/20"
                        onClick={() => setScanMode(null)}
                      >
                        ✕ Cancel
                      </Button>
                    </div>
                    <div id="stock-qr-reader" className="max-w-md mx-auto bg-black rounded-lg overflow-hidden"></div>
                    <p className="text-center text-slate-400 mt-4 text-sm">
                      Point camera at stock QR code
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stock Summary Cards */}
              {stockSummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="pt-6">
                      <p className="text-xs text-slate-600">Total Stock</p>
                      <p className="text-3xl font-bold text-blue-600">{stockSummary.total_stock} pcs</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                    <CardContent className="pt-6">
                      <p className="text-xs text-slate-600">Master Packs</p>
                      <p className="text-3xl font-bold text-purple-600">{stockSummary.total_packs}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <CardContent className="pt-6">
                      <p className="text-xs text-slate-600">Loose Pieces</p>
                      <p className="text-3xl font-bold text-amber-600">{stockSummary.total_loose}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="pt-6">
                      <p className="text-xs text-slate-600">Stock Entries</p>
                      <p className="text-3xl font-bold text-green-600">{stockSummary.stock_count}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by lot, code, category, style, color..."
                  className="pl-10"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  data-testid="stock-search"
                />
              </div>

              {/* Stock Cards */}
              <div className="space-y-4">
                {filteredStocks.map((stock) => {
                  const { completePacks, loosePieces, looseDistribution } = stock.complete_packs !== undefined 
                    ? { completePacks: stock.complete_packs, loosePieces: stock.loose_pieces, looseDistribution: stock.loose_distribution }
                    : calculateMasterPacks(stock.size_distribution, stock.master_pack_ratio || {});
                  
                  return (
                    <Card 
                      key={stock.id} 
                      className={`shadow-lg hover:shadow-xl transition-shadow ${bulkSelectMode && selectedStockIds.includes(stock.id) ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}
                      data-testid={`stock-card-${stock.id}`}
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {/* Bulk Select Checkbox */}
                              {bulkSelectMode && (
                                <input 
                                  type="checkbox" 
                                  checked={selectedStockIds.includes(stock.id)}
                                  onChange={() => toggleStockSelection(stock.id)}
                                  className="h-5 w-5 mt-1 accent-purple-600"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <h3 className="text-xl font-bold text-slate-800">{stock.stock_code}</h3>
                                  <Badge className="bg-indigo-100 text-indigo-800 border">{stock.lot_number}</Badge>
                                  <Badge className="bg-slate-100 text-slate-700 border">{stock.category}</Badge>
                                  <Badge className="bg-blue-100 text-blue-700 border">{stock.style_type}</Badge>
                                  {stock.color && <Badge className="bg-purple-100 text-purple-700 border">🎨 {stock.color}</Badge>}
                                  {stock.source === 'historical' && <Badge className="bg-amber-100 text-amber-700 border">📜 Historical</Badge>}
                                  {stock.used_in_catalog && <Badge className="bg-green-100 text-green-700 border">📦 {stock.used_in_catalog}</Badge>}
                                </div>
                                {stock.notes && <p className="text-sm text-slate-600">{stock.notes}</p>}
                              </div>
                            </div>
                            {!bulkSelectMode && (
                              <div className="flex flex-wrap gap-2">
                                {/* Add to Dispatch Button */}
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => {
                                    addItemToDispatch(stock);
                                    setActiveTab('dispatch');
                                    setBulkDispatchDialogOpen(true);
                                  }}
                                  disabled={stock.available_quantity <= 0}
                                  data-testid={`add-to-dispatch-${stock.id}`}
                                >
                                  <Truck className="h-4 w-4 mr-1" />
                                  Add to Dispatch
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedStock(stock);
                                    setStockCatalogForm({ catalog_name: "", catalog_code: "", description: "" });
                                    setStockCatalogDialogOpen(true);
                                }}
                                data-testid={`catalog-stock-${stock.id}`}
                              >
                                <BookOpen className="h-4 w-4 mr-1" />
                                Catalog
                              </Button>
                              {/* QR Code Button */}
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-slate-600 hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedStockForQR(stock);
                                  setStockQRDialogOpen(true);
                                }}
                                data-testid={`qr-stock-${stock.id}`}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              {isAdmin ? (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteStock(stock.id)}
                                  data-testid={`delete-stock-${stock.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Contact admin to delete</span>
                              )}
                            </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <p className="text-xs text-slate-600">Total Quantity</p>
                              <p className="text-2xl font-bold text-blue-600">{stock.total_quantity}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <p className="text-xs text-slate-600">Available</p>
                              <p className="text-2xl font-bold text-green-600">{stock.available_quantity}</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                              <p className="text-xs text-slate-600">Master Packs</p>
                              <p className="text-2xl font-bold text-purple-600">{completePacks || 0}</p>
                            </div>
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                              <p className="text-xs text-slate-600">Loose Pieces</p>
                              <p className="text-2xl font-bold text-amber-600">{loosePieces || 0}</p>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-lg border">
                            <p className="text-xs text-slate-600 mb-2">Size Distribution:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(stock.size_distribution || {}).map(([size, qty]) => (
                                qty > 0 && (
                                  <div key={size} className="bg-white px-3 py-1 rounded border">
                                    <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                    <span className="text-sm font-bold text-indigo-600 ml-1">{qty}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>

                          {stock.master_pack_ratio && Object.keys(stock.master_pack_ratio).length > 0 && (
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                              <p className="text-xs text-slate-600 mb-2">📦 Master Pack Ratio:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(stock.master_pack_ratio).map(([size, qty]) => (
                                  qty > 0 && (
                                    <div key={size} className="bg-white px-3 py-1 rounded border border-indigo-300">
                                      <span className="text-xs font-semibold text-slate-700">{size}:</span>
                                      <span className="text-sm font-bold text-indigo-600 ml-1">{qty}</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredStocks.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">
                      {stocks.length === 0 ? "No stock entries yet" : "No matching stock found"}
                    </p>
                    {stocks.length === 0 && <p className="text-slate-400 text-sm mt-2">Add historical stock to get started</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Dispatch Tab */}
          <TabsContent value="dispatch" data-testid="dispatch-content">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">🚚 Bulk Dispatch</h2>
                <div className="flex gap-2">
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => setScanMode('dispatch')}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Scan to Dispatch
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setBulkDispatchDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Dispatch
                  </Button>
                </div>
              </div>

              {/* QR Scanner for Dispatch - Multi-Scan Mode */}
              {scanMode === 'dispatch' && (
                <Card className="bg-gradient-to-br from-amber-900 to-amber-800 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">📷 Scan Multiple Stock QR Codes</h3>
                      <div className="flex gap-2">
                        {selectedStocksForDispatch.length > 0 && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setScanMode(null);
                              setBulkDispatchDialogOpen(true);
                            }}
                          >
                            ✓ Done ({selectedStocksForDispatch.length} items)
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-white border-white hover:bg-white/20"
                          onClick={() => setScanMode(null)}
                        >
                          ✕ Cancel
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Scanner */}
                      <div>
                        <div id="qr-reader-dispatch" className="w-full max-w-md mx-auto rounded-lg overflow-hidden"></div>
                        
                        {/* Always show file upload option */}
                        <div className="mt-4 text-center">
                          {/* iOS PWA Warning */}
                          {window.navigator.standalone && (
                            <div className="bg-amber-950/50 border border-amber-400/30 p-2 rounded mb-3 text-amber-200 text-xs">
                              📱 iOS App Mode: Camera may not work. Use button below to take photo.
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="dispatch-qr-file-upload" 
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const html5QrCode = new Html5Qrcode("temp-qr-reader");
                                  const result = await html5QrCode.scanFile(file, true);
                                  // Clean up the scanner
                                  try { await html5QrCode.clear(); } catch(e) {}
                                  
                                  // Parse QR code
                                  let stockCode = result;
                                  try {
                                    const data = JSON.parse(result);
                                    if (data.type === 'stock' && data.code) {
                                      stockCode = data.code;
                                    }
                                  } catch (err) {}
                                  
                                  // Find and add stock
                                  const stock = stocks.find(s => s.stock_code === stockCode);
                                  if (stock) {
                                    if (stock.available_quantity > 0) {
                                      addItemToDispatch(stock);
                                      toast.success(`Added ${stock.stock_code}! Scan next or click Done.`);
                                    } else {
                                      toast.error(`${stock.stock_code} has no available quantity`);
                                    }
                                  } else {
                                    toast.error(`Stock not found: ${stockCode}`);
                                  }
                                } catch (err) {
                                  toast.error("Could not read QR code from image");
                                }
                                e.target.value = ''; // Reset for next scan
                              }
                            }}
                          />
                          <Button 
                            variant="outline"
                            className="bg-amber-600 hover:bg-amber-700 text-white border-amber-500"
                            onClick={() => document.getElementById('dispatch-qr-file-upload')?.click()}
                          >
                            📸 Take Photo / Upload QR Image
                          </Button>
                          <p className="text-sm text-amber-200 mt-2">
                            Tap to take photo of QR code or select from gallery
                          </p>
                        </div>
                      </div>
                      
                      {/* Scanned Items List */}
                      <div className="bg-white/10 rounded-lg p-4">
                        <h4 className="font-semibold text-amber-100 mb-3">
                          📦 Scanned Items ({selectedStocksForDispatch.length})
                        </h4>
                        {selectedStocksForDispatch.length === 0 ? (
                          <p className="text-amber-200/70 text-sm text-center py-4">
                            No items scanned yet. Start scanning!
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {selectedStocksForDispatch.map((item, idx) => (
                              <div key={item.stock_id} className="bg-white/10 rounded p-2 flex justify-between items-center">
                                <div>
                                  <span className="font-mono text-amber-100">{item.stock_code}</span>
                                  <span className="text-amber-200/70 text-xs ml-2">
                                    {item.lot_number} • {item.available_quantity} pcs
                                  </span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-300 hover:text-red-100 hover:bg-red-500/20 h-6 w-6 p-0"
                                  onClick={() => removeItemFromDispatch(item.stock_id)}
                                >
                                  ✕
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Total Dispatches</p>
                    <p className="text-3xl font-bold text-green-600">{bulkDispatches.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Total Items Dispatched</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {bulkDispatches.reduce((sum, d) => sum + (d.total_items || 0), 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Total Quantity</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {bulkDispatches.reduce((sum, d) => sum + (d.grand_total_quantity || 0), 0)} pcs
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Dispatch History */}
              <h3 className="text-xl font-semibold text-slate-700">📋 Dispatch History</h3>
              
              {bulkDispatches.length === 0 ? (
                <Card className="bg-slate-50">
                  <CardContent className="pt-6 text-center">
                    <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No dispatches yet. Create your first bulk dispatch!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bulkDispatches.map((dispatch) => (
                    <Card key={dispatch.id} className="shadow-lg border-l-4 border-l-green-500">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-bold text-slate-800">{dispatch.dispatch_number}</h3>
                              <Badge className="bg-green-100 text-green-700">{dispatch.total_items} Items</Badge>
                              <Badge className="bg-blue-100 text-blue-700">{dispatch.grand_total_quantity} pcs</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                              <span>📅 {new Date(dispatch.dispatch_date).toLocaleDateString()}</span>
                              <span>|</span>
                              <span>👤 {dispatch.customer_name}</span>
                              <span>|</span>
                              <span>📦 Bora: {dispatch.bora_number}</span>
                            </div>
                            {dispatch.notes && <p className="text-sm text-slate-500">📝 {dispatch.notes}</p>}
                            {dispatch.remarks && <p className="text-sm text-amber-600">⚠️ {dispatch.remarks}</p>}
                            
                            {/* Items Preview */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {dispatch.items?.slice(0, 5).map((item, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {item.stock_code} - {item.lot_number} ({item.total_quantity} pcs)
                                </Badge>
                              ))}
                              {dispatch.items?.length > 5 && (
                                <Badge variant="outline" className="text-xs bg-slate-100">
                                  +{dispatch.items.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => openWhatsAppDialog('dispatch', dispatch, '')}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePrintDispatch(dispatch.id)}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Print
                            </Button>
                            {isAdmin ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteBulkDispatch(dispatch.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400 italic px-2">Contact admin to delete</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Catalog Tab */}
          <TabsContent value="catalog" data-testid="catalog-content">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Product Catalog</h2>
              </div>
              
              {/* Search and Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by catalog name, style, color..." 
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-10"
                    data-testid="catalog-search"
                  />
                </div>
                <Select value={catalogCategoryFilter} onValueChange={setCatalogCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                    <SelectItem value="Mens">Mens</SelectItem>
                    <SelectItem value="Women">Women</SelectItem>
                  </SelectContent>
                </Select>
                {(catalogSearch || catalogCategoryFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setCatalogSearch(""); setCatalogCategoryFilter("all"); }}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <span className="text-sm text-slate-500">
                  Showing {filteredCatalogs.length} of {catalogs.length}
                </span>
              </div>

              <div className="flex items-center justify-end">
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
                      
                      {/* Image Upload Section */}
                      <div className="space-y-2">
                        <Label>Product Image (Optional)</Label>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-indigo-400 transition-colors">
                          {catalogImagePreview ? (
                            <div className="relative">
                              <img 
                                src={catalogImagePreview} 
                                alt="Preview" 
                                className="w-full h-40 object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  setCatalogImageFile(null);
                                  setCatalogImagePreview(null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center cursor-pointer py-4">
                              <ImageIcon className="h-10 w-10 text-slate-400 mb-2" />
                              <span className="text-sm text-slate-600">Click to upload product image</span>
                              <span className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP (max 5MB)</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jpg"
                                onChange={handleCatalogImageChange}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Select Cutting Lots</Label>
                        <div className="border rounded-lg p-3 max-h-60 overflow-y-auto bg-slate-50">
                          {cuttingOrders.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No cutting orders available</p>}
                          {cuttingOrders.filter(order => !order.used_in_catalog).length === 0 && cuttingOrders.length > 0 && (
                            <p className="text-sm text-amber-600 text-center py-4">⚠️ All cutting lots are already used in catalogs</p>
                          )}
                          {cuttingOrders.map((order) => (
                            <div key={order.id} className={`flex items-center space-x-3 py-2 border-b last:border-b-0 ${order.used_in_catalog ? 'opacity-40' : ''}`}>
                              <input
                                type="checkbox"
                                id={`lot-${order.id}`}
                                checked={catalogForm.lot_numbers.includes(order.cutting_lot_number)}
                                onChange={() => handleLotToggle(order.cutting_lot_number)}
                                disabled={order.used_in_catalog}
                                className="h-4 w-4 text-indigo-600 rounded disabled:cursor-not-allowed"
                              />
                              <label htmlFor={`lot-${order.id}`} className={`flex-1 ${order.used_in_catalog ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                  {order.cutting_lot_number}
                                  {order.used_in_catalog && (
                                    <span className="text-xs text-green-600 font-normal">✓ Used in: {order.catalog_name}</span>
                                  )}
                                </div>
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
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || uploadingImage || catalogForm.lot_numbers.length === 0} data-testid="catalog-submit-button">
                          {uploadingImage ? "Uploading Image..." : loading ? "Creating..." : "Create Catalog"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {filteredCatalogs.map((catalog) => (
                  <Card key={catalog.id} className="shadow-lg border-l-4 border-l-indigo-500" data-testid={`catalog-card-${catalog.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          {/* Product Image Thumbnail */}
                          {catalog.image_url && (
                            <div 
                              className="flex-shrink-0 cursor-pointer group relative"
                              onClick={() => {
                                setViewImageUrl(catalog.image_url);
                                setViewImageDialog(true);
                              }}
                            >
                              <img 
                                src={catalog.image_url} 
                                alt={catalog.catalog_name}
                                className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg border-2 border-slate-200 group-hover:border-indigo-400 transition-colors"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-all">
                                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex-1 flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-slate-800">{catalog.catalog_name}</h3>
                                <Badge className="bg-indigo-100 text-indigo-800 border">{catalog.catalog_code}</Badge>
                                {catalog.color && <Badge className="bg-purple-100 text-purple-700 border-purple-300">🎨 {catalog.color}</Badge>}
                              </div>
                              {catalog.description && <p className="text-sm text-slate-600">{catalog.description}</p>}
                            </div>
                            <div className="flex gap-2">
                              {isAdmin ? (
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteCatalog(catalog.id)} data-testid={`delete-catalog-${catalog.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Contact admin to delete</span>
                              )}
                            </div>
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
                          <p className="text-xs text-slate-600 mb-2">Lot Numbers with Colors:</p>
                          <div className="flex flex-wrap gap-2">
                            {catalog.lot_numbers.map((lotNum) => {
                              const cuttingOrder = cuttingOrders.find(co => co.lot_number === lotNum);
                              const color = cuttingOrder?.color || 'N/A';
                              return (
                                <Badge key={lotNum} variant="outline" className="bg-white flex items-center gap-1">
                                  <span className="font-semibold">{lotNum}</span>
                                  <span className="text-purple-600">🎨 {color}</span>
                                </Badge>
                              );
                            })}
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

                        {/* Master Pack Stock Display for Catalog */}
                        {(() => {
                          // Get master pack ratio from any lot's ironing order
                          const firstLot = catalog.lot_numbers[0];
                          const ratio = getMasterPackRatioForLot(firstLot);
                          if (ratio && Object.keys(ratio).length > 0) {
                            const { completePacks, loosePieces, looseDistribution } = calculateMasterPacks(catalog.size_distribution, ratio);
                            return (
                              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                                <p className="text-xs text-slate-600 mb-2">📦 Available Stock (Master Pack Format):</p>
                                <div className="flex items-center gap-4">
                                  <div className="bg-white px-4 py-2 rounded border border-indigo-300">
                                    <span className="text-xs text-indigo-600 font-semibold">Master Packs:</span>
                                    <span className="text-2xl font-bold text-indigo-700 ml-2">{completePacks}</span>
                                  </div>
                                  <span className="text-slate-400 text-xl">+</span>
                                  <div className="bg-white px-4 py-2 rounded border border-amber-300">
                                    <span className="text-xs text-amber-600 font-semibold">Loose:</span>
                                    <span className="text-2xl font-bold text-amber-700 ml-2">{loosePieces}</span>
                                    <span className="text-sm text-amber-600 ml-1">pcs</span>
                                  </div>
                                </div>
                                {loosePieces > 0 && Object.keys(looseDistribution).length > 0 && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Loose breakdown: {Object.entries(looseDistribution).filter(([_, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(', ')}
                                  </div>
                                )}
                                <div className="mt-2 text-xs text-slate-600">
                                  <span className="font-semibold">Pack Ratio: </span>
                                  {Object.entries(ratio).filter(([_, qty]) => qty > 0).map(([size, qty]) => `${size}:${qty}`).join('-')}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredCatalogs.length === 0 && (
                <Card className="shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <BookOpen className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">
                      {catalogs.length === 0 ? "No catalogs created yet" : "No matching catalogs found"}
                    </p>
                    {catalogs.length === 0 && <p className="text-slate-400 text-sm mt-2">Create a catalog by clubbing multiple cutting lots</p>}
                  </CardContent>
                </Card>
              )}
              
              {/* Image View Dialog */}
              <Dialog open={viewImageDialog} onOpenChange={setViewImageDialog}>
                <DialogContent className="sm:max-w-[800px] p-2">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Product Image</DialogTitle>
                  </DialogHeader>
                  {viewImageUrl && (
                    <img 
                      src={viewImageUrl} 
                      alt="Product"
                      className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                    />
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" data-testid="reports-content">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Reports</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Fabric Inventory Report Card */}
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-purple-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                      <Package className="h-5 w-5" />
                      Fabric Inventory
                    </CardTitle>
                    <CardDescription>View fabric stock report</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fabric-status-filter" className="text-xs">Status</Label>
                      <Select defaultValue="all" onValueChange={(value) => document.getElementById('fabric-status-filter').setAttribute('data-value', value === 'all' ? '' : value)}>
                        <SelectTrigger id="fabric-status-filter" className="h-9" data-value="">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="in_stock">In Stock</SelectItem>
                          <SelectItem value="exhausted">Exhausted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fabric-supplier-filter" className="text-xs">Supplier (Optional)</Label>
                      <Input id="fabric-supplier-filter" placeholder="Enter supplier name" className="h-9" />
                    </div>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        const status = document.getElementById('fabric-status-filter').getAttribute('data-value');
                        const supplier = document.getElementById('fabric-supplier-filter').value;
                        let url = `${API}/reports/fabric-inventory?`;
                        if (status) url += `status=${status}&`;
                        if (supplier) url += `supplier=${supplier}&`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                {/* Cutting Report Card */}
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                      <Scissors className="h-5 w-5" />
                      Cutting Report
                    </CardTitle>
                    <CardDescription>View cutting with lot status tracking</CardDescription>
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

              {/* New Reports Section - Stock, Dispatch, Catalogue */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-4">📊 Stock, Dispatch & Catalogue Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Stock Report Card */}
                  <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-indigo-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-indigo-700">
                        <Package className="h-5 w-5" />
                        Stock Report
                      </CardTitle>
                      <CardDescription>Summary, movement & low stock alerts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Category Filter (Optional)</Label>
                        <Select onValueChange={(v) => document.getElementById('stock-category-filter').setAttribute('data-value', v === 'all' ? '' : v)}>
                          <SelectTrigger id="stock-category-filter" data-value="">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="Mens">Mens</SelectItem>
                            <SelectItem value="Womens">Womens</SelectItem>
                            <SelectItem value="Kids">Kids</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Low Stock Threshold</Label>
                        <Input id="stock-threshold" type="number" defaultValue="50" className="h-9" />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => {
                            const category = document.getElementById('stock-category-filter').getAttribute('data-value');
                            const threshold = document.getElementById('stock-threshold').value || 50;
                            let url = `${API}/reports/stock?format=html&low_stock_threshold=${threshold}`;
                            if (category) url += `&category=${category}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Print
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 border-indigo-300 text-indigo-600"
                          onClick={() => {
                            const category = document.getElementById('stock-category-filter').getAttribute('data-value');
                            const threshold = document.getElementById('stock-threshold').value || 50;
                            let url = `${API}/reports/stock?format=csv&low_stock_threshold=${threshold}`;
                            if (category) url += `&category=${category}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dispatch Report Card */}
                  <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <Truck className="h-5 w-5" />
                        Dispatch Report
                      </CardTitle>
                      <CardDescription>Customer-wise & date-wise dispatch details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Start Date</Label>
                          <Input id="dispatch-report-start" type="date" className="h-9" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">End Date</Label>
                          <Input id="dispatch-report-end" type="date" className="h-9" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Customer Name (Optional)</Label>
                        <Input id="dispatch-customer-filter" placeholder="Filter by customer" className="h-9" />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            const start = document.getElementById('dispatch-report-start').value;
                            const end = document.getElementById('dispatch-report-end').value;
                            const customer = document.getElementById('dispatch-customer-filter').value;
                            let url = `${API}/reports/dispatch?format=html`;
                            if (start) url += `&start_date=${start}`;
                            if (end) url += `&end_date=${end}`;
                            if (customer) url += `&customer_name=${encodeURIComponent(customer)}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Print
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 border-green-300 text-green-600"
                          onClick={() => {
                            const start = document.getElementById('dispatch-report-start').value;
                            const end = document.getElementById('dispatch-report-end').value;
                            const customer = document.getElementById('dispatch-customer-filter').value;
                            let url = `${API}/reports/dispatch?format=csv`;
                            if (start) url += `&start_date=${start}`;
                            if (end) url += `&end_date=${end}`;
                            if (customer) url += `&customer_name=${encodeURIComponent(customer)}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Catalogue Report Card */}
                  <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-700">
                        <BookOpen className="h-5 w-5" />
                        Catalogue Report
                      </CardTitle>
                      <CardDescription>Catalogue performance & availability</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-xs text-slate-600">This report includes:</p>
                        <ul className="text-xs text-slate-600 mt-1 ml-3">
                          <li>• All catalogues with quantities</li>
                          <li>• Available vs dispatched</li>
                          <li>• Dispatch percentage</li>
                          <li>• Performance status</li>
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                          onClick={() => window.open(`${API}/reports/catalogue?format=html`, '_blank')}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Print
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 border-purple-300 text-purple-600"
                          onClick={() => window.open(`${API}/reports/catalogue?format=csv`, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Profit/Loss Report Section */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-4">💰 Financial Report</h3>
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-emerald-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-700">
                      <DollarSign className="h-5 w-5" />
                      Profit & Loss Report
                    </CardTitle>
                    <CardDescription>Complete cost breakdown and stock valuation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <p className="text-xs text-slate-600 mb-2">📊 This report includes:</p>
                      <ul className="text-xs text-slate-600 space-y-1 ml-4">
                        <li>• Total cost breakdown (Fabric, Cutting, Outsourcing, Ironing)</li>
                        <li>• Shortage deductions</li>
                        <li>• Cost per piece calculation</li>
                        <li>• Production vs Dispatch summary</li>
                        <li>• Current stock valuation</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => window.open(`${API}/reports/profit-loss?format=html`, '_blank')}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Print Report
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1 border-emerald-300 text-emerald-600"
                        onClick={() => window.open(`${API}/reports/profit-loss?format=csv`, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                    </div>
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

              {/* Returns Management Section */}
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <PackageCheck className="h-6 w-6 text-orange-600" />
                    Returns & Rejections
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchReturns}>
                      <Search className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setReturnDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Record Return
                    </Button>
                  </div>
                </div>

                {/* Returns Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-600">Pending</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {returns.filter(r => r.status === 'Pending').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-600">Accepted</p>
                      <p className="text-2xl font-bold text-green-600">
                        {returns.filter(r => r.status === 'Accepted').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-600">Rejected</p>
                      <p className="text-2xl font-bold text-red-600">
                        {returns.filter(r => r.status === 'Rejected').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-600">Total Qty Returned</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {returns.filter(r => r.status === 'Accepted').reduce((sum, r) => sum + (r.quantity || 0), 0)} pcs
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Returns List */}
                <Card className="shadow-lg">
                  <CardContent className="pt-6">
                    {returns.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <PackageCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                        <p>No returns recorded. Click "Record Return" to add one.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {returns.map((ret) => (
                          <div 
                            key={ret.id} 
                            className={`p-4 rounded-lg border ${
                              ret.status === 'Pending' ? 'bg-amber-50 border-amber-200' :
                              ret.status === 'Accepted' ? 'bg-green-50 border-green-200' :
                              'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={
                                    ret.source_type === 'dispatch' ? 'bg-green-100 text-green-700' :
                                    ret.source_type === 'outsourcing' ? 'bg-purple-100 text-purple-700' :
                                    'bg-orange-100 text-orange-700'
                                  }>
                                    {ret.source_type?.charAt(0).toUpperCase() + ret.source_type?.slice(1)}
                                  </Badge>
                                  <Badge className={
                                    ret.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                    ret.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                                    'bg-red-100 text-red-700'
                                  }>
                                    {ret.status}
                                  </Badge>
                                  <span className="text-sm text-slate-600">
                                    {new Date(ret.return_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="font-semibold text-slate-800">
                                  {ret.quantity} pcs - {ret.reason}
                                </p>
                                <p className="text-sm text-slate-500">Source ID: {ret.source_id}</p>
                                {ret.notes && <p className="text-sm text-slate-600 mt-1">📝 {ret.notes}</p>}
                              </div>
                              <div className="flex gap-2">
                                {ret.status === 'Pending' && isAdmin && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleProcessReturn(ret.id, 'accept')}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Accept
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => handleProcessReturn(ret.id, 'reject')}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {isAdmin && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="text-slate-500"
                                    onClick={() => handleDeleteReturn(ret.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Activity Log Section */}
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-slate-600" />
                    Recent Activity Log
                  </h3>
                  <Button variant="outline" onClick={fetchActivityLogs}>
                    <Search className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                
                <Card className="shadow-lg">
                  <CardContent className="pt-6">
                    {activityLogs.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                        <p>No recent activity. Click Refresh to load logs.</p>
                      </div>
                    ) : (
                      <div className="divide-y max-h-96 overflow-y-auto">
                        {activityLogs.map((log, idx) => (
                          <div key={idx} className="py-3 flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              log.action === 'create' ? 'bg-green-500' :
                              log.action === 'update' ? 'bg-blue-500' :
                              log.action === 'delete' ? 'bg-red-500' : 'bg-slate-400'
                            }`}></div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-800">
                                <span className="font-medium">{log.action?.toUpperCase()}</span>
                                {' '}{log.entity_type} - {log.details || log.entity_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {log.user} • {new Date(log.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
              
              {/* Mistakes Section */}
              <div className="space-y-2">
                <Label className="text-orange-700">⚠️ Mistakes (Defective pieces - will be debited)</Label>
                <div className="grid grid-cols-4 gap-2 bg-orange-50 p-3 rounded-lg border border-orange-200">
                  {Object.entries(selectedOutsourcingOrder.size_distribution).map(([size, sentQty]) => (
                    <div key={`mistake-${size}`} className="space-y-1">
                      <Label className="text-xs text-orange-700">{size}</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max={receiptForm.received_distribution[size] || 0}
                        value={receiptForm.mistake_distribution[size] || ''} 
                        onChange={(e) => setReceiptForm({
                          ...receiptForm,
                          mistake_distribution: {
                            ...receiptForm.mistake_distribution,
                            [size]: parseInt(e.target.value) || 0
                          }
                        })}
                        placeholder="0"
                        className="h-8 border-orange-300"
                      />
                    </div>
                  ))}
                </div>
                {getTotalQty(receiptForm.mistake_distribution) > 0 && (
                  <div className="bg-orange-100 p-2 rounded border border-orange-300">
                    <p className="text-sm font-semibold text-orange-700">
                      Total Mistakes: {getTotalQty(receiptForm.mistake_distribution)} pcs 
                      (Debit: ₹{(getTotalQty(receiptForm.mistake_distribution) * selectedOutsourcingOrder.rate_per_pcs).toFixed(2)})
                    </p>
                  </div>
                )}
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
      <Dialog open={dispatchDialogOpen} onOpenChange={(open) => {
        setDispatchDialogOpen(open);
        if (!open) {
          setSelectedDispatchLot(null);
          setDispatchForm({ customer_name: '', bora_number: '', notes: '', master_packs: 0, loose_pcs: {} });
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="dispatch-dialog">
          <DialogHeader>
            <DialogTitle>📦 Dispatch from Catalog</DialogTitle>
            <DialogDescription>
              {selectedCatalog && `${selectedCatalog.catalog_name} (${selectedCatalog.catalog_code})`}
            </DialogDescription>
          </DialogHeader>
          {selectedCatalog && (
            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                <p className="text-sm text-slate-700"><strong>Total Available Stock:</strong> {selectedCatalog.available_stock} pcs</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(selectedCatalog.size_distribution).map(([size, qty]) => (
                    qty > 0 && (
                      <span key={size} className="text-xs bg-white px-2 py-1 rounded border">
                        {size}: {qty}
                      </span>
                    )
                  ))}
                </div>
              </div>

              {/* Customer & Bora Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dispatch-customer-name">Customer Name *</Label>
                  <Input 
                    id="dispatch-customer-name"
                    type="text" 
                    value={dispatchForm.customer_name} 
                    onChange={(e) => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
                    placeholder="Enter customer name"
                    required
                    data-testid="dispatch-customer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dispatch-bora-number">Bora Number *</Label>
                  <Input 
                    id="dispatch-bora-number"
                    type="text" 
                    value={dispatchForm.bora_number} 
                    onChange={(e) => setDispatchForm({...dispatchForm, bora_number: e.target.value})}
                    placeholder="Enter bora/bundle number"
                    required
                    data-testid="dispatch-bora-number"
                  />
                </div>
              </div>
              
              {/* Lot Selection */}
              <div className="space-y-3">
                <Label className="font-semibold">Select Lot to Dispatch *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCatalog.lot_numbers.map((lotNum) => {
                    const cuttingOrder = cuttingOrders.find(co => co.lot_number === lotNum);
                    const color = cuttingOrder?.color || 'N/A';
                    const isSelected = selectedDispatchLot === lotNum;
                    return (
                      <button
                        key={lotNum}
                        type="button"
                        onClick={() => {
                          setSelectedDispatchLot(lotNum);
                          setDispatchForm(prev => ({...prev, master_packs: 0, loose_pcs: {}}));
                        }}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                        data-testid={`dispatch-lot-${lotNum}`}
                      >
                        <p className="font-semibold text-slate-800">{lotNum}</p>
                        <p className="text-sm flex items-center gap-1">
                          <span className="text-purple-600">🎨 {color}</span>
                        </p>
                        {cuttingOrder && (
                          <p className="text-xs text-slate-500">Style: {cuttingOrder.style_type}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Master Pack and Loose Pcs dispatch for selected lot */}
              {selectedDispatchLot && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-700">
                      Dispatch for: <span className="text-indigo-600">{selectedDispatchLot}</span>
                    </h4>
                    {(() => {
                      const co = cuttingOrders.find(c => c.lot_number === selectedDispatchLot);
                      return co ? (
                        <Badge className="bg-purple-100 text-purple-700">🎨 {co.color}</Badge>
                      ) : null;
                    })()}
                  </div>

                  {/* Master Pack Section */}
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="dispatch-master-packs" className="font-semibold text-green-800">📦 Master Packs</Label>
                      <span className="text-xs text-green-600">
                        (1 pack = {Object.keys(selectedCatalog.size_distribution).length} pcs - 1 of each size)
                      </span>
                    </div>
                    <Input 
                      id="dispatch-master-packs"
                      type="number" 
                      min="0"
                      value={dispatchForm.master_packs || ''} 
                      onChange={(e) => setDispatchForm(prev => ({
                        ...prev,
                        master_packs: parseInt(e.target.value) || 0
                      }))}
                      placeholder="Enter number of master packs"
                      className="h-10"
                      data-testid="dispatch-master-packs"
                    />
                    {dispatchForm.master_packs > 0 && (
                      <p className="text-xs text-green-700 mt-1">
                        = {dispatchForm.master_packs * Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length} pcs 
                        ({Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).map(s => `${dispatchForm.master_packs} ${s}`).join(', ')})
                      </p>
                    )}
                  </div>

                  {/* Loose Pieces Section */}
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <Label className="font-semibold text-amber-800 block mb-2">👕 Loose Pieces (Size-wise)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(selectedCatalog.size_distribution).map(([size, availableQty]) => {
                        const usedByPacks = dispatchForm.master_packs || 0;
                        const remainingForLoose = Math.max(0, availableQty - usedByPacks);
                        return availableQty > 0 && (
                          <div key={size} className="space-y-1">
                            <Label htmlFor={`loose-${size}`} className="text-xs text-amber-700">{size}</Label>
                            <Input 
                              id={`loose-${size}`}
                              type="number" 
                              min="0"
                              max={remainingForLoose}
                              value={dispatchForm.loose_pcs[size] || ''} 
                              onChange={(e) => setDispatchForm(prev => ({
                                ...prev,
                                loose_pcs: {
                                  ...prev.loose_pcs,
                                  [size]: parseInt(e.target.value) || 0
                                }
                              }))}
                              placeholder="0"
                              className="h-8"
                              data-testid={`dispatch-loose-${size}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {getTotalQty(dispatchForm.loose_pcs) > 0 && (
                      <p className="text-xs text-amber-700 mt-2">
                        Loose total: {getTotalQty(dispatchForm.loose_pcs)} pcs
                      </p>
                    )}
                  </div>

                  {/* Total Summary */}
                  <div className="pt-3 border-t border-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Dispatch:</span>
                      <span className="text-lg font-bold text-indigo-600">
                        {(dispatchForm.master_packs || 0) * Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length + getTotalQty(dispatchForm.loose_pcs)} pcs
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      ({dispatchForm.master_packs || 0} packs × {Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length} = {(dispatchForm.master_packs || 0) * Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length} pcs) + ({getTotalQty(dispatchForm.loose_pcs)} loose pcs)
                    </div>
                    {((dispatchForm.master_packs || 0) * Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length + getTotalQty(dispatchForm.loose_pcs)) > selectedCatalog.available_stock && (
                      <p className="text-sm text-red-600 font-bold mt-2">⚠️ Exceeds available stock!</p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="dispatch-notes">Notes (Optional)</Label>
                <Input 
                  id="dispatch-notes"
                  type="text" 
                  value={dispatchForm.notes} 
                  onChange={(e) => setDispatchForm({...dispatchForm, notes: e.target.value})}
                  placeholder="Additional notes..."
                  data-testid="dispatch-notes"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDispatchDialogOpen(false)} data-testid="dispatch-cancel-button">Cancel</Button>
                <Button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700" 
                  disabled={loading || !selectedDispatchLot || !dispatchForm.customer_name || !dispatchForm.bora_number || ((dispatchForm.master_packs || 0) === 0 && getTotalQty(dispatchForm.loose_pcs) === 0) || ((dispatchForm.master_packs || 0) * Object.keys(selectedCatalog.size_distribution).filter(s => selectedCatalog.size_distribution[s] > 0).length + getTotalQty(dispatchForm.loose_pcs)) > selectedCatalog.available_stock} 
                  data-testid="dispatch-submit-button"
                >
                  {loading ? "Recording..." : "📦 Record Dispatch"}
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
              
              {/* Mistakes Section */}
              <div className="space-y-2">
                <Label className="text-orange-700">⚠️ Mistakes (Defective pieces - will be debited)</Label>
                <div className="grid grid-cols-4 gap-2 bg-orange-50 p-3 rounded-lg border border-orange-200">
                  {Object.entries(selectedIroningOrder.size_distribution).map(([size, sentQty]) => (
                    <div key={`mistake-${size}`} className="space-y-1">
                      <Label className="text-xs text-orange-700">{size}</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max={ironingReceiptForm.received_distribution[size] || 0}
                        value={ironingReceiptForm.mistake_distribution[size] || ''} 
                        onChange={(e) => setIroningReceiptForm({
                          ...ironingReceiptForm,
                          mistake_distribution: {
                            ...ironingReceiptForm.mistake_distribution,
                            [size]: parseInt(e.target.value) || 0
                          }
                        })}
                        placeholder="0"
                        className="h-8 border-orange-300"
                      />
                    </div>
                  ))}
                </div>
                {getTotalQty(ironingReceiptForm.mistake_distribution) > 0 && (
                  <div className="bg-orange-100 p-2 rounded border border-orange-300">
                    <p className="text-sm font-semibold text-orange-700">
                      Total Mistakes: {getTotalQty(ironingReceiptForm.mistake_distribution)} pcs 
                      (Debit: ₹{(getTotalQty(ironingReceiptForm.mistake_distribution) * selectedIroningOrder.rate_per_pcs).toFixed(2)})
                    </p>
                  </div>
                )}
              </div>
              
              {selectedIroningOrder.master_pack_ratio && Object.keys(selectedIroningOrder.master_pack_ratio).length > 0 && getTotalQty(ironingReceiptForm.received_distribution) > 0 && (() => {
                const ratio = selectedIroningOrder.master_pack_ratio;
                let completePacks = Infinity;
                for (const [size, ratioQty] of Object.entries(ratio)) {
                  if (ratioQty > 0) {
                    const receivedQty = ironingReceiptForm.received_distribution[size] || 0;
                    completePacks = Math.min(completePacks, Math.floor(receivedQty / ratioQty));
                  }
                }
                if (completePacks === Infinity) completePacks = 0;
                const loosePieces = getTotalQty(ironingReceiptForm.received_distribution) - (completePacks * Object.values(ratio).reduce((a, b) => a + b, 0));
                return (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-3">📦 Master Pack Calculation</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border">
                        <p className="text-xs text-slate-500">Complete Packs</p>
                        <p className="text-2xl font-bold text-purple-600">{completePacks}</p>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-xs text-slate-500">Loose Pieces</p>
                        <p className="text-2xl font-bold text-amber-600">{loosePieces}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">Ratio: </span>
                      {Object.entries(ratio).filter(([_, qty]) => qty > 0).map(([size, qty]) => `${size}:${qty}`).join(', ')}
                    </div>
                  </div>
                );
              })()}
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

      {/* Edit Receipt Dialog */}
      <Dialog open={editReceiptDialogOpen} onOpenChange={(open) => {
        setEditReceiptDialogOpen(open);
        if (!open) {
          setSelectedEditReceipt(null);
          setEditReceiptForm({ receipt_date: '', received_distribution: {}, mistake_distribution: {} });
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="edit-receipt-dialog">
          <DialogHeader>
            <DialogTitle>✏️ Edit Receipt</DialogTitle>
            <DialogDescription>
              {selectedEditReceipt && `${selectedEditReceipt.type} Receipt - DC: ${selectedEditReceipt.dc_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedEditReceipt && (
            <form onSubmit={handleEditReceiptSubmit} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-slate-700">
                  <strong>Unit:</strong> {selectedEditReceipt.unit_name} | 
                  <strong> Total Sent:</strong> {selectedEditReceipt.total_sent} pcs
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-receipt-date">Receipt Date</Label>
                <Input 
                  id="edit-receipt-date"
                  type="date" 
                  value={editReceiptForm.receipt_date} 
                  onChange={(e) => setEditReceiptForm({...editReceiptForm, receipt_date: e.target.value})} 
                  required 
                  data-testid="edit-receipt-date"
                />
              </div>

              <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800">✅ Received Quantities</h4>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(selectedEditReceipt.sent_distribution || {}).map(([size, sentQty]) => (
                    sentQty > 0 && (
                      <div key={size} className="space-y-1">
                        <Label className="text-xs text-green-700">{size} (Sent: {sentQty})</Label>
                        <Input 
                          type="number" 
                          min="0"
                          max={sentQty}
                          value={editReceiptForm.received_distribution[size] || ''} 
                          onChange={(e) => setEditReceiptForm(prev => ({
                            ...prev,
                            received_distribution: {
                              ...prev.received_distribution,
                              [size]: parseInt(e.target.value) || 0
                            }
                          }))}
                          placeholder="0"
                          className="h-8"
                          data-testid={`edit-received-${size}`}
                        />
                      </div>
                    )
                  ))}
                </div>
                <p className="text-sm text-green-700 pt-2 border-t border-green-200">
                  Total Received: <strong>{getTotalQty(editReceiptForm.received_distribution)} pcs</strong>
                </p>
              </div>

              <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-800">⚠️ Mistakes (Defective pieces)</h4>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(selectedEditReceipt.sent_distribution || {}).map(([size, sentQty]) => (
                    sentQty > 0 && (
                      <div key={size} className="space-y-1">
                        <Label className="text-xs text-red-700">{size}</Label>
                        <Input 
                          type="number" 
                          min="0"
                          value={editReceiptForm.mistake_distribution[size] || ''} 
                          onChange={(e) => setEditReceiptForm(prev => ({
                            ...prev,
                            mistake_distribution: {
                              ...prev.mistake_distribution,
                              [size]: parseInt(e.target.value) || 0
                            }
                          }))}
                          placeholder="0"
                          className="h-8"
                          data-testid={`edit-mistake-${size}`}
                        />
                      </div>
                    )
                  ))}
                </div>
                <p className="text-sm text-red-700 pt-2 border-t border-red-200">
                  Total Mistakes: <strong>{getTotalQty(editReceiptForm.mistake_distribution)} pcs</strong>
                </p>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Shortage:</strong> {selectedEditReceipt.total_sent - getTotalQty(editReceiptForm.received_distribution)} pcs
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditReceiptDialogOpen(false)} data-testid="edit-receipt-cancel">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700" 
                  disabled={loading}
                  data-testid="edit-receipt-submit"
                >
                  {loading ? "Updating..." : "💾 Update Receipt"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="add-stock-dialog">
          <DialogHeader>
            <DialogTitle>📦 Add Historical Stock</DialogTitle>
            <DialogDescription>Add stock that was not tracked through the system</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStockSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock-lot">Lot Number *</Label>
                <Input 
                  id="stock-lot"
                  value={stockForm.lot_number}
                  onChange={(e) => setStockForm({...stockForm, lot_number: e.target.value})}
                  placeholder="e.g., HIST-001"
                  required
                  data-testid="stock-lot-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-color">Color</Label>
                <Input 
                  id="stock-color"
                  value={stockForm.color}
                  onChange={(e) => setStockForm({...stockForm, color: e.target.value})}
                  placeholder="e.g., Navy Blue"
                  data-testid="stock-color-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock-category">Category *</Label>
                <Select value={stockForm.category} onValueChange={(value) => setStockForm({...stockForm, category: value})}>
                  <SelectTrigger data-testid="stock-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mens">Mens</SelectItem>
                    <SelectItem value="Ladies">Ladies</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-style">Style Type *</Label>
                <Input 
                  id="stock-style"
                  value={stockForm.style_type}
                  onChange={(e) => setStockForm({...stockForm, style_type: e.target.value})}
                  placeholder="e.g., Round Neck, Polo"
                  required
                  data-testid="stock-style-input"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800">Size Distribution *</h4>
              <div className="grid grid-cols-4 gap-3">
                {['M', 'L', 'XL', 'XXL'].map((size) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs">{size}</Label>
                    <Input 
                      type="number"
                      min="0"
                      value={stockForm.size_distribution[size] || ''}
                      onChange={(e) => setStockForm({
                        ...stockForm, 
                        size_distribution: {...stockForm.size_distribution, [size]: parseInt(e.target.value) || 0}
                      })}
                      placeholder="0"
                      className="h-9"
                      data-testid={`stock-size-${size}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-blue-700">Total: {getTotalQty(stockForm.size_distribution)} pcs</p>
            </div>

            <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800">Master Pack Ratio</h4>
              <p className="text-xs text-purple-600">Define how many of each size makes 1 master pack</p>
              <div className="grid grid-cols-4 gap-3">
                {['M', 'L', 'XL', 'XXL'].map((size) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs">{size}</Label>
                    <Input 
                      type="number"
                      min="0"
                      value={stockForm.master_pack_ratio[size] || ''}
                      onChange={(e) => setStockForm({
                        ...stockForm, 
                        master_pack_ratio: {...stockForm.master_pack_ratio, [size]: parseInt(e.target.value) || 0}
                      })}
                      placeholder="1"
                      className="h-9"
                      data-testid={`stock-ratio-${size}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-notes">Notes</Label>
              <Input 
                id="stock-notes"
                value={stockForm.notes}
                onChange={(e) => setStockForm({...stockForm, notes: e.target.value})}
                placeholder="Additional notes..."
                data-testid="stock-notes-input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading} data-testid="stock-submit-btn">
                {loading ? "Adding..." : "📦 Add Stock"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Dispatch Dialog */}
      <Dialog open={stockDispatchDialogOpen} onOpenChange={(open) => {
        setStockDispatchDialogOpen(open);
        if (!open) setSelectedStock(null);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="stock-dispatch-dialog">
          <DialogHeader>
            <DialogTitle>📦 Dispatch from Stock</DialogTitle>
            <DialogDescription>
              {selectedStock && `${selectedStock.stock_code} - ${selectedStock.lot_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedStock && (
            <form onSubmit={handleStockDispatch} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm"><strong>Available:</strong> {selectedStock.available_quantity} pcs</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(selectedStock.size_distribution || {}).map(([size, qty]) => (
                    qty > 0 && (
                      <span key={size} className="text-xs bg-white px-2 py-1 rounded border">{size}: {qty}</span>
                    )
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input 
                    value={stockDispatchForm.customer_name}
                    onChange={(e) => setStockDispatchForm({...stockDispatchForm, customer_name: e.target.value})}
                    placeholder="Customer name"
                    required
                    data-testid="stock-dispatch-customer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bora Number *</Label>
                  <Input 
                    value={stockDispatchForm.bora_number}
                    onChange={(e) => setStockDispatchForm({...stockDispatchForm, bora_number: e.target.value})}
                    placeholder="Bora/Bundle number"
                    required
                    data-testid="stock-dispatch-bora"
                  />
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <Label className="font-semibold text-green-800">📦 Master Packs</Label>
                <Input 
                  type="number"
                  min="0"
                  value={stockDispatchForm.master_packs || ''}
                  onChange={(e) => setStockDispatchForm({...stockDispatchForm, master_packs: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="mt-2"
                  data-testid="stock-dispatch-packs"
                />
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <Label className="font-semibold text-amber-800">👕 Loose Pieces</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {Object.keys(selectedStock.size_distribution || {}).map((size) => (
                    <div key={size} className="space-y-1">
                      <Label className="text-xs">{size}</Label>
                      <Input 
                        type="number"
                        min="0"
                        value={stockDispatchForm.loose_pcs[size] || ''}
                        onChange={(e) => setStockDispatchForm({
                          ...stockDispatchForm,
                          loose_pcs: {...stockDispatchForm.loose_pcs, [size]: parseInt(e.target.value) || 0}
                        })}
                        placeholder="0"
                        className="h-8"
                        data-testid={`stock-dispatch-loose-${size}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input 
                  value={stockDispatchForm.notes}
                  onChange={(e) => setStockDispatchForm({...stockDispatchForm, notes: e.target.value})}
                  placeholder="Additional notes..."
                  data-testid="stock-dispatch-notes"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStockDispatchDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading} data-testid="stock-dispatch-submit">
                  {loading ? "Dispatching..." : "📦 Dispatch"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Catalog from Stock Dialog */}
      <Dialog open={stockCatalogDialogOpen} onOpenChange={(open) => {
        setStockCatalogDialogOpen(open);
        if (!open) setSelectedStock(null);
      }}>
        <DialogContent className="sm:max-w-[500px]" data-testid="stock-catalog-dialog">
          <DialogHeader>
            <DialogTitle>📚 Create Catalog from Stock</DialogTitle>
            <DialogDescription>
              {selectedStock && `${selectedStock.stock_code} - ${selectedStock.lot_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedStock && (
            <form onSubmit={handleCreateCatalogFromStock} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm"><strong>Stock:</strong> {selectedStock.available_quantity} pcs available</p>
              </div>

              <div className="space-y-2">
                <Label>Catalog Name *</Label>
                <Input 
                  value={stockCatalogForm.catalog_name}
                  onChange={(e) => setStockCatalogForm({...stockCatalogForm, catalog_name: e.target.value})}
                  placeholder="e.g., Summer Collection"
                  required
                  data-testid="stock-catalog-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Catalog Code *</Label>
                <Input 
                  value={stockCatalogForm.catalog_code}
                  onChange={(e) => setStockCatalogForm({...stockCatalogForm, catalog_code: e.target.value})}
                  placeholder="e.g., SUM-001"
                  required
                  data-testid="stock-catalog-code"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={stockCatalogForm.description}
                  onChange={(e) => setStockCatalogForm({...stockCatalogForm, description: e.target.value})}
                  placeholder="Optional description..."
                  data-testid="stock-catalog-desc"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStockCatalogDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading} data-testid="stock-catalog-submit">
                  {loading ? "Creating..." : "📚 Create Catalog"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Lot QR Code Dialog */}
      <Dialog open={lotQRDialogOpen} onOpenChange={setLotQRDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="lot-qr-dialog">
          <DialogHeader>
            <DialogTitle>📱 Lot QR Code</DialogTitle>
            <DialogDescription>
              {selectedLotForQR && (selectedLotForQR.cutting_lot_number || selectedLotForQR.lot_number)}
            </DialogDescription>
          </DialogHeader>
          {selectedLotForQR && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img 
                  src={`${API}/cutting-orders/${selectedLotForQR.id}/qrcode`} 
                  alt="Lot QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p><strong>Lot:</strong> {selectedLotForQR.cutting_lot_number || selectedLotForQR.lot_number}</p>
                <p><strong>Category:</strong> {selectedLotForQR.category}</p>
                <p><strong>Style:</strong> {selectedLotForQR.style_type}</p>
                <p><strong>Color:</strong> {selectedLotForQR.color}</p>
                <p><strong>Quantity:</strong> {selectedLotForQR.total_quantity} pcs</p>
              </div>
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `${API}/cutting-orders/${selectedLotForQR.id}/qrcode`;
                    link.download = `${selectedLotForQR.cutting_lot_number || selectedLotForQR.lot_number}-qr.png`;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  onClick={() => {
                    const lotNum = selectedLotForQR.cutting_lot_number || selectedLotForQR.lot_number;
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head><title>QR - ${lotNum}</title></head>
                        <body style="text-align:center; padding:20px;">
                          <h2>${lotNum}</h2>
                          <p>${selectedLotForQR.category} | ${selectedLotForQR.style_type} | ${selectedLotForQR.color}</p>
                          <p>${selectedLotForQR.total_quantity} pcs</p>
                          <img src="${API}/cutting-orders/${selectedLotForQR.id}/qrcode" style="width:200px;height:200px;" />
                          <script>setTimeout(() => window.print(), 500)</script>
                        </body>
                      </html>
                    `);
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unified Lot Scanner Dialog */}
      <Dialog open={unifiedScannerOpen || scannedLot !== null} onOpenChange={(open) => {
        if (!open) {
          setUnifiedScannerOpen(false);
          setScannedLot(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="unified-scanner-dialog">
          <DialogHeader>
            <DialogTitle>{scannedLot ? '📋 Lot Details' : '📷 Scan Lot QR Code'}</DialogTitle>
            <DialogDescription>{scannedLot ? `Lot: ${scannedLot.order?.cutting_lot_number || scannedLot.order?.lot_number}` : 'Scan any lot QR to view status and take action'}</DialogDescription>
          </DialogHeader>
          
          {!scannedLot ? (
            <div className="space-y-4">
              {/* iOS PWA Warning */}
              {window.navigator.standalone && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-sm">
                  <p className="font-semibold">📱 iOS App Mode Detected</p>
                  <p>Camera may not work in app mode. Use "Scan an Image File" option below, or open in Safari browser for camera access.</p>
                </div>
              )}
              
              <div id="unified-qr-reader" className="rounded-lg overflow-hidden" style={{ minHeight: '300px' }}></div>
              
              {/* Manual file upload for iOS */}
              <div className="text-center pt-2 border-t">
                <input 
                  type="file" 
                  id="ios-qr-upload" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      toast.info("Processing image...");
                      try {
                        const tempQr = new Html5Qrcode("temp-qr-reader");
                        const result = await tempQr.scanFile(file, true);
                        // Clean up the scanner
                        try { await tempQr.clear(); } catch(cleanErr) {}
                        console.log("Unified scanner file result:", result);
                        // Don't close - just call handler which will set scannedLot
                        handleLotQRScan(result);
                      } catch (err) {
                        console.error("Unified scanner file error:", err);
                        toast.error("Could not read QR code from image. Try again.");
                      }
                      e.target.value = '';
                    }
                  }}
                />
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('ios-qr-upload')?.click()}
                >
                  📁 Take Photo or Choose Image
                </Button>
                <p className="text-center text-slate-500 text-xs mt-2">
                  If camera doesn't work, tap above to take a photo of the QR code
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scanned Lot Info */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800">Lot Found!</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  {scannedLot.order.cutting_lot_number || scannedLot.order.lot_number}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-slate-100">{scannedLot.order.category}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">{scannedLot.order.style_type}</Badge>
                  {scannedLot.order.color && <Badge className="bg-purple-100 text-purple-700">🎨 {scannedLot.order.color}</Badge>}
                </div>
                <p className="text-sm text-slate-600 mt-2">Total: {scannedLot.order.total_quantity} pcs</p>
              </div>

              {/* Current Stage */}
              <div className="bg-slate-50 p-3 rounded-lg border">
                <p className="text-xs text-slate-500 mb-2">Current Stage</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${scannedLot.stage === 'stock' ? 'bg-green-500 animate-pulse' : scannedLot.stage === 'cutting' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                  <span className="font-semibold capitalize">
                    {scannedLot.stage === 'stock' ? '📦 In Stock' : scannedLot.stage === 'ironing-received' ? '🔥 Ironing Done' : scannedLot.stage}
                  </span>
                  {scannedLot.stock && (
                    <Badge className="bg-green-100 text-green-700">{scannedLot.stock.stock_code}</Badge>
                  )}
                </div>
                
                {/* Detailed Stage Timeline */}
                <div className="mt-3 space-y-2">
                  {/* Stage 1: Cutting */}
                  <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
                    <span className="text-green-600">✅</span>
                    <div className="flex-1">
                      <span className="font-medium text-green-800">✂️ Cutting</span>
                      <p className="text-xs text-green-600">
                        {scannedLot.order.cutting_lot_number} • {scannedLot.order.total_quantity} pcs
                      </p>
                    </div>
                    <span className="text-xs text-green-600">Done</span>
                  </div>
                  
                  {/* Stage 2: Outsourcing (with Operation Type) */}
                  <div className={`flex items-center gap-2 p-2 rounded ${scannedLot.outsourcing ? 'bg-green-50 border border-green-200' : 'bg-slate-100 border border-slate-200'}`}>
                    <span className={scannedLot.outsourcing ? 'text-green-600' : 'text-slate-400'}>
                      {scannedLot.outsourcing ? '✅' : '⏳'}
                    </span>
                    <div className="flex-1">
                      <span className={`font-medium ${scannedLot.outsourcing ? 'text-green-800' : 'text-slate-500'}`}>
                        {scannedLot.outsourcing?.operation_type === 'Printing' && '🖨️ '}
                        {scannedLot.outsourcing?.operation_type === 'Embroidery' && '🧵 '}
                        {scannedLot.outsourcing?.operation_type === 'Stone Work' && '💎 '}
                        {scannedLot.outsourcing?.operation_type === 'Washing' && '🧺 '}
                        {scannedLot.outsourcing?.operation_type || '🏭'} Outsourcing
                        {scannedLot.outsourcing?.operation_type && ` - ${scannedLot.outsourcing.operation_type}`}
                      </span>
                      {scannedLot.outsourcing && (
                        <p className="text-xs text-green-600">
                          {scannedLot.outsourcing.unit_name} • DC: {scannedLot.outsourcing.dc_number}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs ${scannedLot.outsourcing ? 'text-green-600' : 'text-slate-400'}`}>
                      {scannedLot.outsourcing ? (scannedLot.outsourcing.status === 'Received' ? 'Received' : 'Sent') : 'Pending'}
                    </span>
                  </div>
                  
                  {/* Stage 2b: Outsourcing Receipt */}
                  {scannedLot.outsourcing && (
                    <div className={`flex items-center gap-2 p-2 rounded ml-4 ${scannedLot.outsourcing?.status === 'Received' ? 'bg-green-50 border border-green-200' : 'bg-slate-100 border border-slate-200'}`}>
                      <span className={scannedLot.outsourcing?.status === 'Received' ? 'text-green-600' : 'text-slate-400'}>
                        {scannedLot.outsourcing?.status === 'Received' ? '✅' : '⏳'}
                      </span>
                      <div className="flex-1">
                        <span className={`font-medium text-sm ${scannedLot.outsourcing?.status === 'Received' ? 'text-green-800' : 'text-slate-500'}`}>
                          📥 Received from {scannedLot.outsourcing?.operation_type || 'Outsourcing'}
                        </span>
                        {scannedLot.outsourcingReceipt && (
                          <p className="text-xs text-green-600">
                            Received: {scannedLot.outsourcingReceipt.total_received} pcs
                            {scannedLot.outsourcingReceipt.total_shortage > 0 && ` • Shortage: ${scannedLot.outsourcingReceipt.total_shortage}`}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs ${scannedLot.outsourcing?.status === 'Received' ? 'text-green-600' : 'text-slate-400'}`}>
                        {scannedLot.outsourcing?.status === 'Received' ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  )}
                  
                  {/* Stage 3: Ironing */}
                  <div className={`flex items-center gap-2 p-2 rounded ${scannedLot.ironing ? 'bg-green-50 border border-green-200' : 'bg-slate-100 border border-slate-200'}`}>
                    <span className={scannedLot.ironing ? 'text-green-600' : 'text-slate-400'}>
                      {scannedLot.ironing ? '✅' : '⏳'}
                    </span>
                    <div className="flex-1">
                      <span className={`font-medium ${scannedLot.ironing ? 'text-green-800' : 'text-slate-500'}`}>
                        🔥 Ironing & Packing
                      </span>
                      {scannedLot.ironing && (
                        <p className="text-xs text-green-600">
                          {scannedLot.ironing.unit_name} • DC: {scannedLot.ironing.dc_number}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs ${scannedLot.ironing ? 'text-green-600' : 'text-slate-400'}`}>
                      {scannedLot.ironing ? (scannedLot.ironing.status === 'Received' ? 'Received' : 'Sent') : 'Pending'}
                    </span>
                  </div>
                  
                  {/* Stage 3b: Ironing Receipt */}
                  {scannedLot.ironing && (
                    <div className={`flex items-center gap-2 p-2 rounded ml-4 ${scannedLot.ironing?.status === 'Received' ? 'bg-green-50 border border-green-200' : 'bg-slate-100 border border-slate-200'}`}>
                      <span className={scannedLot.ironing?.status === 'Received' ? 'text-green-600' : 'text-slate-400'}>
                        {scannedLot.ironing?.status === 'Received' ? '✅' : '⏳'}
                      </span>
                      <div className="flex-1">
                        <span className={`font-medium text-sm ${scannedLot.ironing?.status === 'Received' ? 'text-green-800' : 'text-slate-500'}`}>
                          📥 Received from Ironing
                        </span>
                        {scannedLot.ironingReceipt && (
                          <p className="text-xs text-green-600">
                            Packs: {scannedLot.ironingReceipt.complete_packs} • Loose: {scannedLot.ironingReceipt.loose_pieces}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs ${scannedLot.ironing?.status === 'Received' ? 'text-green-600' : 'text-slate-400'}`}>
                        {scannedLot.ironing?.status === 'Received' ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  )}
                  
                  {/* Stage 4: Stock */}
                  <div className={`flex items-center gap-2 p-2 rounded ${scannedLot.stock ? 'bg-green-50 border border-green-200' : 'bg-slate-100 border border-slate-200'}`}>
                    <span className={scannedLot.stock ? 'text-green-600' : 'text-slate-400'}>
                      {scannedLot.stock ? '✅' : '⏳'}
                    </span>
                    <div className="flex-1">
                      <span className={`font-medium ${scannedLot.stock ? 'text-green-800' : 'text-slate-500'}`}>
                        📦 Added to Stock
                      </span>
                      {scannedLot.stock && (
                        <p className="text-xs text-green-600">
                          {scannedLot.stock.stock_code} • {scannedLot.stock.available_quantity} pcs available
                        </p>
                      )}
                    </div>
                    <span className={`text-xs ${scannedLot.stock ? 'text-green-600' : 'text-slate-400'}`}>
                      {scannedLot.stock ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock Info if exists */}
              {scannedLot.stock && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-green-800">📦 {scannedLot.stock.stock_code}</p>
                      <p className="text-sm text-green-700">
                        {scannedLot.stock.complete_packs} Packs + {scannedLot.stock.loose_pieces} Loose
                      </p>
                      <p className="text-xs text-slate-600">Available: {scannedLot.stock.available_quantity} pcs</p>
                    </div>
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setSelectedStockForQR(scannedLot.stock);
                        setStockQRDialogOpen(true);
                      }}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR
                    </Button>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="font-semibold text-slate-700">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white h-16 flex-col"
                    disabled={scannedLot.outsourcing}
                    onClick={() => {
                      setScanSendOutsourcingForm({ unit_name: "", operation_type: "Printing", rate_per_pcs: 0 });
                      setScanActionDialog('send');
                    }}
                  >
                    <Send className="h-5 w-5 mb-1" />
                    <span className="text-xs">Send Out</span>
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white h-16 flex-col"
                    disabled={!scannedLot.outsourcing || scannedLot.outsourcing?.status === 'Received'}
                    onClick={() => {
                      setScanReceiveForm({
                        received_distribution: scannedLot.outsourcing?.size_distribution || {},
                        mistake_distribution: {}
                      });
                      setScanActionDialog('receive');
                    }}
                  >
                    <Package className="h-5 w-5 mb-1" />
                    <span className="text-xs">Receive Out</span>
                  </Button>
                  <Button 
                    className="bg-orange-600 hover:bg-orange-700 text-white h-16 flex-col"
                    disabled={scannedLot.ironing || !scannedLot.stitching_completed}
                    title={!scannedLot.stitching_completed ? "Complete stitching first" : ""}
                    onClick={() => {
                      setScanIroningForm({ unit_name: "", rate_per_pcs: 0, master_pack_ratio: { M: 2, L: 2, XL: 2, XXL: 2 } });
                      setScanActionDialog('ironing');
                    }}
                  >
                    <Factory className="h-5 w-5 mb-1" />
                    <span className="text-xs">{scannedLot.stitching_completed ? 'Send Iron' : 'Stitch First'}</span>
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white h-16 flex-col"
                    disabled={!scannedLot.ironing || scannedLot.ironing?.status === 'Received'}
                    onClick={() => {
                      setScanReceiveIroningForm({
                        received_distribution: scannedLot.ironing?.size_distribution || {},
                        mistake_distribution: {}
                      });
                      setScanActionDialog('receive-ironing');
                    }}
                  >
                    <PackageCheck className="h-5 w-5 mb-1" />
                    <span className="text-xs">Receive Iron → Stock</span>
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setScannedLot(null)}>
                <Camera className="h-4 w-4 mr-2" />
                Scan Another
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scan Send Outsourcing Dialog */}
      <Dialog open={scanActionDialog === 'send'} onOpenChange={(open) => !open && setScanActionDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>📤 Send to Outsourcing</DialogTitle>
            <DialogDescription>
              {scannedLot && (scannedLot.order.cutting_lot_number || scannedLot.order.lot_number)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanSendOutsourcing} className="space-y-4">
            <div className="space-y-2">
              <Label>Unit Name *</Label>
              <Select value={scanSendOutsourcingForm.unit_name} onValueChange={(v) => setScanSendOutsourcingForm({...scanSendOutsourcingForm, unit_name: v})}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {outsourcingUnits.filter(u => u.is_active).map((unit) => (
                    <SelectItem key={unit.unit_name} value={unit.unit_name}>{unit.unit_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select value={scanSendOutsourcingForm.operation_type} onValueChange={(v) => setScanSendOutsourcingForm({...scanSendOutsourcingForm, operation_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Printing">Printing</SelectItem>
                  <SelectItem value="Embroidery">Embroidery</SelectItem>
                  <SelectItem value="Stitching">Stitching</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate per Piece (₹)</Label>
              <Input 
                type="number" 
                value={scanSendOutsourcingForm.rate_per_pcs}
                onChange={(e) => setScanSendOutsourcingForm({...scanSendOutsourcingForm, rate_per_pcs: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setScanActionDialog(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={loading || !scanSendOutsourcingForm.unit_name}>
                {loading ? "Sending..." : "📤 Send"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scan Receive Dialog */}
      <Dialog open={scanActionDialog === 'receive'} onOpenChange={(open) => !open && setScanActionDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>📥 Receive from Outsourcing</DialogTitle>
            <DialogDescription>
              {scannedLot && (scannedLot.order.cutting_lot_number || scannedLot.order.lot_number)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanReceive} className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm">
              <p><strong>Sent:</strong> {scannedLot?.outsourcing?.total_quantity} pcs</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Received Quantities</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(scannedLot?.outsourcing?.size_distribution || {}).map(([size, sentQty]) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs">{size} ({sentQty})</Label>
                    <Input 
                      type="number"
                      min="0"
                      max={sentQty}
                      value={scanReceiveForm.received_distribution[size] || ''}
                      onChange={(e) => setScanReceiveForm({
                        ...scanReceiveForm,
                        received_distribution: {...scanReceiveForm.received_distribution, [size]: parseInt(e.target.value) || 0}
                      })}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setScanActionDialog(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? "Receiving..." : "📥 Receive"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scan Create Ironing Dialog */}
      <Dialog open={scanActionDialog === 'ironing'} onOpenChange={(open) => !open && setScanActionDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>🔥 Create Ironing Order</DialogTitle>
            <DialogDescription>
              {scannedLot && (scannedLot.order.cutting_lot_number || scannedLot.order.lot_number)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanCreateIroning} className="space-y-4">
            <div className="space-y-2">
              <Label>Ironing Unit *</Label>
              <Select value={scanIroningForm.unit_name} onValueChange={(v) => setScanIroningForm({...scanIroningForm, unit_name: v})}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {outsourcingUnits.filter(u => u.operations?.includes('Ironing')).map((unit) => (
                    <SelectItem key={unit.name} value={unit.name}>{unit.name}</SelectItem>
                  ))}
                  {outsourcingUnits.map((unit) => (
                    <SelectItem key={unit.name} value={unit.name}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate per Piece (₹)</Label>
              <Input 
                type="number" 
                value={scanIroningForm.rate_per_pcs}
                onChange={(e) => setScanIroningForm({...scanIroningForm, rate_per_pcs: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Label className="font-semibold text-purple-800">Master Pack Ratio</Label>
              <div className="grid grid-cols-4 gap-2">
                {['M', 'L', 'XL', 'XXL'].map((size) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs">{size}</Label>
                    <Input 
                      type="number"
                      min="0"
                      value={scanIroningForm.master_pack_ratio[size] || ''}
                      onChange={(e) => setScanIroningForm({
                        ...scanIroningForm,
                        master_pack_ratio: {...scanIroningForm.master_pack_ratio, [size]: parseInt(e.target.value) || 0}
                      })}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setScanActionDialog(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700" disabled={loading || !scanIroningForm.unit_name}>
                {loading ? "Creating..." : "🔥 Create Ironing"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scan Receive Ironing Dialog (Creates Stock) */}
      <Dialog open={scanActionDialog === 'receive-ironing'} onOpenChange={(open) => !open && setScanActionDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>📦 Receive from Ironing → Stock</DialogTitle>
            <DialogDescription>
              {scannedLot && (scannedLot.order.cutting_lot_number || scannedLot.order.lot_number)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanReceiveIroning} className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <PackageCheck className="h-5 w-5" />
                This will create a new Stock entry with QR code!
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Sent for ironing: {scannedLot?.ironing?.total_quantity} pcs
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="font-semibold">Received Quantities</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(scannedLot?.ironing?.size_distribution || {}).map(([size, sentQty]) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs">{size} ({sentQty})</Label>
                    <Input 
                      type="number"
                      min="0"
                      max={sentQty}
                      value={scanReceiveIroningForm.received_distribution[size] || ''}
                      onChange={(e) => setScanReceiveIroningForm({
                        ...scanReceiveIroningForm,
                        received_distribution: {...scanReceiveIroningForm.received_distribution, [size]: parseInt(e.target.value) || 0}
                      })}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                Total: {getTotalQty(scanReceiveIroningForm.received_distribution)} pcs
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-red-700">Mistakes (Optional)</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(scannedLot?.ironing?.size_distribution || {}).map((size) => (
                  <div key={size} className="space-y-1">
                    <Label className="text-xs text-red-600">{size}</Label>
                    <Input 
                      type="number"
                      min="0"
                      value={scanReceiveIroningForm.mistake_distribution[size] || ''}
                      onChange={(e) => setScanReceiveIroningForm({
                        ...scanReceiveIroningForm,
                        mistake_distribution: {...scanReceiveIroningForm.mistake_distribution, [size]: parseInt(e.target.value) || 0}
                      })}
                      className="h-9 border-red-200"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-sm">
              <p className="font-semibold text-green-800">📦 New Stock will be created:</p>
              <p className="text-green-700">
                {getTotalQty(scanReceiveIroningForm.received_distribution)} pcs with Master Pack ratio from ironing order
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setScanActionDialog(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? "Processing..." : "📦 Receive & Create Stock"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock QR Code Dialog */}
      <Dialog open={stockQRDialogOpen} onOpenChange={setStockQRDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="stock-qr-dialog">
          <DialogHeader>
            <DialogTitle>📱 Stock QR Code</DialogTitle>
            <DialogDescription>
              {selectedStockForQR && `${selectedStockForQR.stock_code} - ${selectedStockForQR.lot_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedStockForQR && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img 
                  src={`${API}/stock/${selectedStockForQR.id}/qrcode`} 
                  alt="Stock QR Code"
                  className="w-48 h-48"
                  data-testid="stock-qr-image"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p><strong>Code:</strong> {selectedStockForQR.stock_code}</p>
                <p><strong>Lot:</strong> {selectedStockForQR.lot_number}</p>
                <p><strong>Category:</strong> {selectedStockForQR.category}</p>
                <p><strong>Style:</strong> {selectedStockForQR.style_type}</p>
                {selectedStockForQR.color && <p><strong>Color:</strong> {selectedStockForQR.color}</p>}
              </div>
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `${API}/stock/${selectedStockForQR.id}/qrcode`;
                    link.download = `${selectedStockForQR.stock_code}-qr.png`;
                    link.click();
                  }}
                  data-testid="download-qr-btn"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head><title>QR Code - ${selectedStockForQR.stock_code}</title></head>
                        <body style="text-align:center; padding:20px;">
                          <h2>${selectedStockForQR.stock_code}</h2>
                          <p>${selectedStockForQR.lot_number} | ${selectedStockForQR.category} | ${selectedStockForQR.style_type}</p>
                          <img src="${API}/stock/${selectedStockForQR.id}/qrcode" style="width:200px;height:200px;" />
                          <script>setTimeout(() => window.print(), 500)</script>
                        </body>
                      </html>
                    `);
                  }}
                  data-testid="print-qr-btn"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Dispatch Dialog */}
      <Dialog open={bulkDispatchDialogOpen} onOpenChange={(open) => {
        setBulkDispatchDialogOpen(open);
        if (!open) {
          setSelectedStocksForDispatch([]);
        }
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🚚 Create Bulk Dispatch</DialogTitle>
            <DialogDescription>Dispatch multiple stock items to a customer at once</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleBulkDispatchSubmit} className="space-y-4">
            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="space-y-2">
                <Label>Dispatch Date</Label>
                <Input 
                  type="date" 
                  value={bulkDispatchForm.dispatch_date}
                  onChange={(e) => setBulkDispatchForm({...bulkDispatchForm, dispatch_date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input 
                  value={bulkDispatchForm.customer_name}
                  onChange={(e) => setBulkDispatchForm({...bulkDispatchForm, customer_name: e.target.value})}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Bora Number *</Label>
                <Input 
                  value={bulkDispatchForm.bora_number}
                  onChange={(e) => setBulkDispatchForm({...bulkDispatchForm, bora_number: e.target.value})}
                  placeholder="e.g., B-001"
                  required
                />
              </div>
            </div>

            {/* Stock Selection */}
            <div className="space-y-2">
              <Label>Select Stock Items to Dispatch</Label>
              <Select onValueChange={(stockId) => {
                const stock = stocks.find(s => s.id === stockId);
                if (stock && stock.available_quantity > 0) {
                  addItemToDispatch(stock);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Click to add stock items..." />
                </SelectTrigger>
                <SelectContent>
                  {stocks.filter(s => s.available_quantity > 0 && !selectedStocksForDispatch.find(sel => sel.stock_id === s.id)).map((stock) => (
                    <SelectItem key={stock.id} value={stock.id}>
                      {stock.stock_code} - {stock.lot_number} | {stock.color} ({stock.available_quantity} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Items */}
            {selectedStocksForDispatch.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                <h4 className="font-semibold text-slate-700">📦 Items to Dispatch ({selectedStocksForDispatch.length})</h4>
                
                {selectedStocksForDispatch.map((item, index) => (
                  <div key={item.stock_id} className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{index + 1}. {item.stock_code}</span>
                          <Badge variant="outline">{item.lot_number}</Badge>
                          {item.color && <Badge className="bg-purple-100 text-purple-700">🎨 {item.color}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">{item.category} | {item.style_type} | Available: {item.available_quantity} pcs</p>
                      </div>
                      <Button 
                        type="button"
                        size="sm" 
                        variant="outline" 
                        className="text-red-500"
                        onClick={() => removeItemFromDispatch(item.stock_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Master Packs */}
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <Label className="text-green-800 font-semibold">📦 Master Packs</Label>
                        {Object.keys(item.master_pack_ratio || {}).length > 0 ? (
                          <>
                            <p className="text-xs text-slate-500 mb-2">
                              Ratio: {Object.entries(item.master_pack_ratio).map(([s, r]) => `${s}:${r}`).join(', ')}
                            </p>
                            <Input 
                              type="number" 
                              min="0"
                              value={item.master_packs}
                              onChange={(e) => updateDispatchItem(item.stock_id, 'master_packs', parseInt(e.target.value) || 0)}
                              className="bg-white"
                            />
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">No master pack ratio defined</p>
                        )}
                      </div>
                      
                      {/* Loose Pieces */}
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <Label className="text-amber-800 font-semibold">🧩 Loose Pieces</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {['M', 'L', 'XL', 'XXL'].map(size => (
                            <div key={size}>
                              <Label className="text-xs">{size}</Label>
                              <Input 
                                type="number" 
                                min="0"
                                className="h-8 bg-white"
                                value={item.loose_pcs[size] || ''}
                                onChange={(e) => updateDispatchItemLoosePcs(item.stock_id, size, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Item Total */}
                    <div className="mt-3 text-right">
                      <span className="text-sm text-slate-600">Item Total: </span>
                      <span className="font-bold text-lg text-indigo-600">{calculateItemTotal(item)} pcs</span>
                    </div>
                  </div>
                ))}
                
                {/* Grand Total */}
                <div className="bg-indigo-100 p-4 rounded-lg border border-indigo-300 text-right">
                  <span className="text-lg font-semibold text-indigo-800">📊 Grand Total: </span>
                  <span className="text-2xl font-bold text-indigo-600">{calculateGrandTotal()} pcs</span>
                </div>
              </div>
            )}

            {/* Notes & Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>📝 Notes (Optional)</Label>
                <Input 
                  value={bulkDispatchForm.notes}
                  onChange={(e) => setBulkDispatchForm({...bulkDispatchForm, notes: e.target.value})}
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="space-y-2">
                <Label>⚠️ Remarks (Optional)</Label>
                <Input 
                  value={bulkDispatchForm.remarks}
                  onChange={(e) => setBulkDispatchForm({...bulkDispatchForm, remarks: e.target.value})}
                  placeholder="Special instructions or warnings..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setBulkDispatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-green-600 hover:bg-green-700"
                disabled={loading || selectedStocksForDispatch.length === 0}
              >
                {loading ? "Creating..." : `🚚 Create Dispatch (${calculateGrandTotal()} pcs)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scan Dispatch Dialog */}
      <Dialog open={scanDispatchDialogOpen} onOpenChange={(open) => {
        setScanDispatchDialogOpen(open);
        if (!open) setScannedStock(null);
      }}>
        <DialogContent className="sm:max-w-[500px]" data-testid="scan-dispatch-dialog">
          <DialogHeader>
            <DialogTitle>📷 Quick Dispatch (Scanned)</DialogTitle>
            <DialogDescription>
              {scannedStock && `${scannedStock.stock_code} - ${scannedStock.lot_number}`}
            </DialogDescription>
          </DialogHeader>
          {scannedStock && (
            <form onSubmit={handleScanDispatchSubmit} className="space-y-4">
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-800">✅ Stock Found!</p>
                <p className="text-sm">Available: {scannedStock.available_quantity} pcs</p>
                <p className="text-xs text-slate-500">{scannedStock.category} | {scannedStock.style_type} | {scannedStock.color}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input 
                    value={scanDispatchForm.customer_name}
                    onChange={(e) => setScanDispatchForm({...scanDispatchForm, customer_name: e.target.value})}
                    placeholder="Customer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bora Number *</Label>
                  <Input 
                    value={scanDispatchForm.bora_number}
                    onChange={(e) => setScanDispatchForm({...scanDispatchForm, bora_number: e.target.value})}
                    placeholder="Bora #"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Master Packs</Label>
                <Input 
                  type="number"
                  min="0"
                  value={scanDispatchForm.master_packs}
                  onChange={(e) => setScanDispatchForm({...scanDispatchForm, master_packs: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setScanDispatchDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? "Dispatching..." : "📦 Dispatch"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Scan New Lot Dialog */}
      <Dialog open={scanNewLotDialogOpen} onOpenChange={(open) => {
        setScanNewLotDialogOpen(open);
        if (!open) setScannedStock(null);
      }}>
        <DialogContent className="sm:max-w-[600px]" data-testid="scan-newlot-dialog">
          <DialogHeader>
            <DialogTitle>📷 Add New Lot (From Scan)</DialogTitle>
            <DialogDescription>
              Copying settings from: {scannedStock?.stock_code}
            </DialogDescription>
          </DialogHeader>
          {scannedStock && (
            <form onSubmit={handleScanNewLotSubmit} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-800">📋 Copying from {scannedStock.stock_code}</p>
                <p className="text-xs text-slate-600">
                  Category: {scannedStock.category} | Style: {scannedStock.style_type} | Color: {scannedStock.color}
                </p>
                <p className="text-xs text-slate-600">
                  Ratio: {Object.entries(scannedStock.master_pack_ratio || {}).map(([s, q]) => `${s}:${q}`).join('-')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>New Lot Number *</Label>
                <Input 
                  value={scanNewLotForm.lot_number}
                  onChange={(e) => setScanNewLotForm({...scanNewLotForm, lot_number: e.target.value})}
                  placeholder="e.g., HIST-002"
                  required
                />
              </div>

              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border">
                <Label className="font-semibold">Size Distribution *</Label>
                <div className="grid grid-cols-4 gap-2">
                  {['M', 'L', 'XL', 'XXL'].map((size) => (
                    <div key={size} className="space-y-1">
                      <Label className="text-xs">{size}</Label>
                      <Input 
                        type="number"
                        min="0"
                        value={scanNewLotForm.size_distribution[size] || ''}
                        onChange={(e) => setScanNewLotForm({
                          ...scanNewLotForm, 
                          size_distribution: {...scanNewLotForm.size_distribution, [size]: parseInt(e.target.value) || 0}
                        })}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">Total: {getTotalQty(scanNewLotForm.size_distribution)} pcs</p>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input 
                  value={scanNewLotForm.notes}
                  onChange={(e) => setScanNewLotForm({...scanNewLotForm, notes: e.target.value})}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setScanNewLotDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                  {loading ? "Creating..." : "📦 Create Lot"}
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

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Send via WhatsApp
            </DialogTitle>
            <DialogDescription>
              {whatsappData.type === 'dc' && "Send Delivery Challan details"}
              {whatsappData.type === 'reminder' && "Send reminder for pending order"}
              {whatsappData.type === 'payment' && "Send payment confirmation"}
              {whatsappData.type === 'payment_reminder' && "Send payment reminder to unit"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Phone Number Selection */}
            <div className="space-y-3">
              {whatsappData.unitPhone && (
                <div 
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    whatsappData.useUnitPhone 
                      ? 'bg-green-50 border-green-500 ring-2 ring-green-300' 
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                  onClick={() => setWhatsappData({...whatsappData, useUnitPhone: true})}
                >
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={whatsappData.useUnitPhone} onChange={() => {}} />
                    <div>
                      <p className="font-semibold text-slate-800">Unit Contact</p>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {whatsappData.unitPhone}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div 
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  !whatsappData.useUnitPhone 
                    ? 'bg-green-50 border-green-500 ring-2 ring-green-300' 
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
                onClick={() => setWhatsappData({...whatsappData, useUnitPhone: false})}
              >
                <div className="flex items-center gap-2">
                  <input type="radio" checked={!whatsappData.useUnitPhone} onChange={() => {}} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Custom Number</p>
                    {!whatsappData.useUnitPhone && (
                      <Input
                        type="tel"
                        placeholder="Enter phone number (e.g., 9876543210)"
                        value={whatsappData.phone}
                        onChange={(e) => setWhatsappData({...whatsappData, phone: e.target.value})}
                        className="mt-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="bg-slate-100 p-3 rounded-lg text-sm max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                {whatsappData.type === 'dc' && whatsappData.data && generateDCMessage(whatsappData.data)}
                {whatsappData.type === 'reminder' && whatsappData.data && generateReminderMessage(whatsappData.data)}
                {whatsappData.type === 'payment' && whatsappData.data && generatePaymentMessage(
                  whatsappData.data.unitName,
                  whatsappData.data.amount,
                  whatsappData.data.method,
                  whatsappData.data.pendingAmount
                )}
              </div>
            </div>

            {/* Send Button */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleWhatsAppSend}
                disabled={!whatsappData.useUnitPhone && !whatsappData.phone}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Open WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Management Dialog (Admin Only) */}
      <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              User Management
            </DialogTitle>
            <DialogDescription>Create and manage user accounts</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Create New User Form */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-800 mb-3">➕ Create New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      value={newUserForm.full_name}
                      onChange={(e) => setNewUserForm({...newUserForm, full_name: e.target.value})}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Username</Label>
                    <Input
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
                      placeholder="johndoe"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Password</Label>
                    <Input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Role</Label>
                    <Select value={newUserForm.role} onValueChange={(value) => setNewUserForm({...newUserForm, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={loading}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create User"}
                </Button>
              </form>
            </div>

            {/* Existing Users List */}
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">👥 All Users ({allUsers.length})</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      user.is_active !== false ? 'bg-white' : 'bg-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{user.full_name}</p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.username !== 'admin' ? (
                        <Select 
                          value={user.role} 
                          onValueChange={(newRole) => handleChangeUserRole(user.id, newRole)}
                        >
                          <SelectTrigger className={`w-[100px] h-8 text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-slate-100 text-slate-600'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className="bg-purple-100 text-purple-700">
                          {user.role}
                        </Badge>
                      )}
                      <Badge className={user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {user.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                      {user.username !== 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleUserStatus(user.id, user.is_active !== false)}
                          className={user.is_active !== false ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-600 hover:bg-green-50'}
                        >
                          {user.is_active !== false ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-orange-600" />
              Record Return / Rejection
            </DialogTitle>
            <DialogDescription>Record goods returned from customer or processing units</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateReturn} className="space-y-4">
            <div className="space-y-2">
              <Label>Return Source *</Label>
              <Select 
                value={returnForm.source_type} 
                onValueChange={(v) => setReturnForm({...returnForm, source_type: v, source_id: ''})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispatch">📦 Customer Dispatch Return</SelectItem>
                  <SelectItem value="outsourcing">🏭 Outsourcing Unit Return</SelectItem>
                  <SelectItem value="ironing">🔥 Ironing Unit Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Source Reference ID *</Label>
              {returnForm.source_type === 'dispatch' ? (
                <Select 
                  value={returnForm.source_id} 
                  onValueChange={(v) => setReturnForm({...returnForm, source_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dispatch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bulkDispatches.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dispatch_number} - {d.customer_name} ({d.grand_total_quantity} pcs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input 
                  value={returnForm.source_id}
                  onChange={(e) => setReturnForm({...returnForm, source_id: e.target.value})}
                  placeholder="Enter DC number or Order ID"
                />
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Date *</Label>
                <Input 
                  type="date"
                  value={returnForm.return_date}
                  onChange={(e) => setReturnForm({...returnForm, return_date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity (pcs) *</Label>
                <Input 
                  type="number"
                  min="1"
                  value={returnForm.quantity}
                  onChange={(e) => setReturnForm({...returnForm, quantity: e.target.value})}
                  placeholder="0"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select 
                value={returnForm.reason} 
                onValueChange={(v) => setReturnForm({...returnForm, reason: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Defective">🔴 Defective / Damaged</SelectItem>
                  <SelectItem value="Wrong Size">📏 Wrong Size</SelectItem>
                  <SelectItem value="Wrong Color">🎨 Wrong Color</SelectItem>
                  <SelectItem value="Quality Issue">⚠️ Quality Issue</SelectItem>
                  <SelectItem value="Customer Rejection">❌ Customer Rejection</SelectItem>
                  <SelectItem value="Excess Quantity">📦 Excess Quantity</SelectItem>
                  <SelectItem value="Other">📝 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input 
                value={returnForm.notes}
                onChange={(e) => setReturnForm({...returnForm, notes: e.target.value})}
                placeholder="Additional details..."
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setReturnDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={loading}>
                {loading ? "Recording..." : "Record Return"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-indigo-600" />
              Scan Barcode
            </DialogTitle>
            <DialogDescription>Scan a fabric lot barcode to view details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* iOS PWA Warning */}
            {window.navigator.standalone && (
              <div className="bg-amber-50 border border-amber-200 p-2 rounded text-amber-800 text-xs">
                📱 iOS App Mode: Use "Take Photo" button below if camera doesn't work.
              </div>
            )}
            
            <div id="barcode-scanner" className="w-full min-h-[250px] bg-slate-100 rounded-lg overflow-hidden" />
            
            {/* iOS-friendly file upload */}
            <div className="text-center border-t pt-3">
              <input 
                type="file" 
                id="barcode-file-upload" 
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast.info("Processing image...");
                    try {
                      const tempQr = new Html5Qrcode("temp-qr-reader");
                      const result = await tempQr.scanFile(file, true);
                      // Clean up the scanner
                      try { await tempQr.clear(); } catch(cleanErr) {}
                      console.log("File scan result:", result);
                      toast.success("QR code found in image!");
                      setScannerDialogOpen(false);
                      handleLotQRScan(result);
                    } catch (err) {
                      console.error("File scan error:", err);
                      toast.error("Could not find QR code in image. Try again with better lighting.");
                    }
                    e.target.value = '';
                  }
                }}
              />
              <Button 
                variant="outline"
                className="w-full mb-2"
                onClick={() => document.getElementById('barcode-file-upload')?.click()}
              >
                📸 Take Photo or Choose Image
              </Button>
              <p className="text-xs text-slate-500">Point camera at barcode or tap button above</p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setScannerDialogOpen(false)}
            >
              Close Scanner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lot Tracking Dialog */}
      <Dialog open={lotTrackingDialogOpen} onOpenChange={setLotTrackingDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Lot Journey Tracking
            </DialogTitle>
            <DialogDescription>Track complete journey of a lot from cutting to dispatch</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <Input 
                placeholder="Enter lot number..."
                value={trackingLotNumber}
                onChange={(e) => setTrackingLotNumber(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTrackLot} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                Track
              </Button>
            </div>
            
            {/* Journey Display */}
            {lotJourney && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-bold text-lg text-blue-800">📦 {lotJourney.lot_number}</h3>
                  <p className="text-sm text-slate-600">Current Stage: <Badge className="bg-blue-100 text-blue-700">{lotJourney.current_stage}</Badge></p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span>Total Produced: <strong>{lotJourney.total_quantity}</strong> pcs</span>
                    <span>Dispatched: <strong>{lotJourney.dispatched_quantity}</strong> pcs</span>
                  </div>
                </div>
                
                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                  {lotJourney.stages.map((stage, idx) => (
                    <div key={idx} className="relative pl-10 pb-4">
                      <div className={`absolute left-2 w-5 h-5 rounded-full ${
                        stage.status === 'Completed' || stage.status === 'Received' ? 'bg-green-500' :
                        stage.status === 'Sent' ? 'bg-amber-500' : 'bg-blue-500'
                      } flex items-center justify-center`}>
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      <div className="bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-slate-800">{stage.stage}</h4>
                            <p className="text-xs text-slate-500">{stage.date?.split('T')[0]}</p>
                          </div>
                          <Badge className={
                            stage.status === 'Completed' || stage.status === 'Received' ? 'bg-green-100 text-green-700' :
                            stage.status === 'Sent' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }>{stage.status}</Badge>
                        </div>
                        {stage.details && (
                          <div className="mt-2 text-xs text-slate-600 space-y-1">
                            {Object.entries(stage.details).map(([key, val]) => (
                              val && <p key={key}><span className="text-slate-400">{key}:</span> {val}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-600" />
              Application Settings
            </DialogTitle>
          </DialogHeader>
          
          {appSettings && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input 
                  value={appSettings.company_name || ''}
                  onChange={(e) => setAppSettings({...appSettings, company_name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <Input 
                  type="number"
                  value={appSettings.low_stock_threshold || 50}
                  onChange={(e) => setAppSettings({...appSettings, low_stock_threshold: parseInt(e.target.value)})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Categories (comma separated)</Label>
                <Input 
                  value={(appSettings.categories || []).join(', ')}
                  onChange={(e) => setAppSettings({...appSettings, categories: e.target.value.split(',').map(s => s.trim())})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Operations (comma separated)</Label>
                <Input 
                  value={(appSettings.operations || []).join(', ')}
                  onChange={(e) => setAppSettings({...appSettings, operations: e.target.value.split(',').map(s => s.trim())})}
                />
              </div>
              
              {/* Data Export Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data Export & Backup
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleExportAllData} className="text-green-600 border-green-300">
                    <Download className="h-4 w-4 mr-2" />
                    Full Backup (JSON)
                  </Button>
                  <Button variant="outline" onClick={() => handleExportCollection('stock')} className="text-blue-600 border-blue-300">
                    <Download className="h-4 w-4 mr-2" />
                    Export Stock
                  </Button>
                  <Button variant="outline" onClick={() => handleExportCollection('cutting_orders')} className="text-purple-600 border-purple-300">
                    <Download className="h-4 w-4 mr-2" />
                    Export Cutting
                  </Button>
                  <Button variant="outline" onClick={() => handleExportCollection('bulk_dispatches')} className="text-amber-600 border-amber-300">
                    <Download className="h-4 w-4 mr-2" />
                    Export Dispatches
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveSettings} className="bg-indigo-600 hover:bg-indigo-700">Save Settings</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-30 safe-area-pb">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] mt-1">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('fabric-lots')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg ${activeTab === 'fabric-lots' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}
          >
            <Package className="h-5 w-5" />
            <span className="text-[10px] mt-1">Fabric</span>
          </button>
          <button
            onClick={() => setActiveTab('outsourcing')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg ${activeTab === 'outsourcing' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}
          >
            <Send className="h-5 w-5" />
            <span className="text-[10px] mt-1">Outsource</span>
          </button>
          <button
            onClick={() => setActiveTab('cutting')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg ${activeTab === 'cutting' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}
          >
            <Scissors className="h-5 w-5" />
            <span className="text-[10px] mt-1">Cutting</span>
          </button>
          <button
            onClick={() => setScannerDialogOpen(true)}
            className="flex flex-col items-center py-2 px-1 rounded-lg text-slate-600"
          >
            <QrCode className="h-5 w-5" />
            <span className="text-[10px] mt-1">Scan</span>
          </button>
        </div>
      </nav>
      
      {/* Hidden temp QR reader for file scanning */}
      <div id="temp-qr-reader" style={{ display: 'none' }}></div>
    </div>
  );
}

export default App;