import React, { useState, useEffect, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import {
  Camera,
  CameraOff,
  Search,
  Database,
  Plus,
  Edit,
  Save,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  Tag,
  Store,
  Package
} from 'lucide-react';
import { createWorker } from 'tesseract.js';

// Fallback Sagarmatha Cosmetics Credentials
const DEFAULT_URL = "https://zzjxgkrzpakbrleeduhq.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anhna3J6cGFrYnJsZWVkdWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODMxODgsImV4cCI6MjA5NTY1OTE4OH0.v1Nhqm4BlDp7fdcNExgVx9Bl4eLRIihI6xfJe5su0zo";
const DEFAULT_STORE_ID = "b0298a16-4ba9-4f36-8aee-d853785213a2"; // Sagarmatha Cosmetics store ID

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  images: string[];
  store_id: string;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_clearance: boolean;
  category_id: string | null;
  brand_id: string | null;
  subcategory_id: string | null;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  category_id: string;
}

export default function App() {
  // Database Configuration
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('sathi_crm_url') || DEFAULT_URL);
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('sathi_crm_key') || DEFAULT_KEY);
  const [storeId, setStoreId] = useState(() => localStorage.getItem('sathi_crm_store_id') || DEFAULT_STORE_ID);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [dbClient, setDbClient] = useState<SupabaseClient | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');

  // App Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Scanner States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>([]);
  const [autoScan, setAutoScan] = useState(false);
  const [scanResult, setScanResult] = useState<'idle' | 'match' | 'no_match'>('idle');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);

  // Form Modals
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    original_price: '',
    images: '',
    is_active: true,
    is_featured: false,
    is_new: false,
    is_clearance: false,
    category_id: '',
    brand_id: '',
    subcategory_id: ''
  });

  // Media Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrWorkerRef = useRef<any>(null);
  const autoScanIntervalRef = useRef<any>(null);

  // Initialize Supabase Client
  useEffect(() => {
    if (supabaseUrl && supabaseKey) {
      try {
        const client = createClient(supabaseUrl, supabaseKey);
        setDbClient(client);
        testConnection(client);
      } catch (err) {
        setDbStatus('disconnected');
      }
    }
  }, [supabaseUrl, supabaseKey]);

  // Handle worker initialization on mount
  useEffect(() => {
    let active = true;
    const initWorker = async () => {
      try {
        setIsOcrLoading(true);
        const worker = await createWorker('eng');
        if (active) {
          ocrWorkerRef.current = worker;
          setIsOcrLoading(false);
        }
      } catch (err) {
        console.error("Failed to load Tesseract worker:", err);
        setIsOcrLoading(false);
      }
    };
    initWorker();
    return () => {
      active = false;
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
      }
    };
  }, []);

  // Fetch all databases when connected
  const testConnection = async (client: SupabaseClient) => {
    setDbStatus('testing');
    try {
      const { error } = await client.from('products').select('id').limit(1);
      if (error) throw error;
      setDbStatus('connected');
      fetchData(client);
    } catch (err) {
      console.error(err);
      setDbStatus('disconnected');
    }
  };

  const fetchData = async (client: SupabaseClient) => {
    setIsLoadingData(true);
    try {
      const [prodRes, catRes, brandRes, subcatRes] = await Promise.all([
        client.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
        client.from('categories').select('*').eq('store_id', storeId),
        client.from('brands').select('*').eq('store_id', storeId),
        client.from('subcategories').select('*').eq('store_id', storeId),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
      if (subcatRes.data) setSubcategories(subcatRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('sathi_crm_url', supabaseUrl);
    localStorage.setItem('sathi_crm_key', supabaseKey);
    localStorage.setItem('sathi_crm_store_id', storeId);
    setIsConfigOpen(false);
    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey);
      setDbClient(client);
      testConnection(client);
    }
  };

  // Video Streaming control
  useEffect(() => {
    if (isCameraActive) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(err => {
        console.error("Camera access failed:", err);
        setIsCameraActive(false);
        alert("Unable to access live camera. Please check camera permissions.");
      });
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Auto scanning timer
  useEffect(() => {
    if (autoScan && isCameraActive) {
      autoScanIntervalRef.current = setInterval(() => {
        captureAndScan();
      }, 3000);
    } else {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
      }
    }
    return () => {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
      }
    };
  }, [autoScan, isCameraActive, products]);

  // Capture video frame and run OCR
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || !ocrWorkerRef.current || isOcrLoading) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions matching video feed
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply high contrast canvas filter to improve OCR accuracy
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      // Grayscale conversion
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // High contrast thresholding
      const value = gray > 120 ? 255 : 0;
      data[i] = value;
      data[i+1] = value;
      data[i+2] = value;
    }
    ctx.putImageData(imgData, 0, 0);

    setIsOcrLoading(true);

    try {
      const { data: { text } } = await ocrWorkerRef.current.recognize(canvas);
      processScannedText(text);
    } catch (err) {
      console.error("OCR scan error:", err);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Clean scanned text & match with catalog
  const processScannedText = (text: string) => {
    setScannedText(text);
    if (!text.trim()) return;

    // Tokenize text into alphanumeric words longer than 2 characters
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['and', 'for', 'with', 'the', 'gel', 'cream', 'ml', 'gm', 'pack'].includes(w));

    setDetectedKeywords(words);

    if (words.length === 0) {
      setScanResult('no_match');
      setMatchedProduct(null);
      return;
    }

    // Match products based on overlapping tokens
    let bestProduct: Product | null = null;
    let highestScore = 0;

    products.forEach(product => {
      const productNameLower = product.name.toLowerCase();
      let score = 0;

      words.forEach(word => {
        if (productNameLower.includes(word)) {
          score += word.length; // Weigh longer word matches higher
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestProduct = product;
      }
    });

    // We consider score > 5 to be a valid match (about 1-2 words matched fully)
    if (bestProduct && highestScore >= 5) {
      setMatchedProduct(bestProduct);
      setScanResult('match');
      setAutoScan(false); // Disable auto scan once product is matched
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#a855f7', '#10b981', '#f59e0b']
      });
    } else {
      setMatchedProduct(null);
      setScanResult('no_match');
    }
  };

  // Form handlers
  const handleOpenAdd = () => {
    setFormType('add');
    // Pre-populate product name with detected keywords to save time!
    const guessName = detectedKeywords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    setFormData({
      name: guessName || '',
      slug: guessName ? guessName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '',
      description: '',
      price: '',
      original_price: '',
      images: '',
      is_active: true,
      is_featured: false,
      is_new: true,
      is_clearance: false,
      category_id: categories[0]?.id || '',
      brand_id: brands[0]?.id || '',
      subcategory_id: subcategories[0]?.id || ''
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setFormType('edit');
    setActiveProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price.toString(),
      original_price: product.original_price?.toString() || '',
      images: product.images.join(', '),
      is_active: product.is_active,
      is_featured: product.is_featured,
      is_new: product.is_new,
      is_clearance: product.is_clearance,
      category_id: product.category_id || '',
      brand_id: product.brand_id || '',
      subcategory_id: product.subcategory_id || ''
    });
    setIsFormOpen(true);
  };

  const handleFormSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbClient || !formData.name || !formData.price || !formData.slug) return;

    setIsLoadingData(true);
    const parsedImages = formData.images
      .split(',')
      .map(img => img.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      price: parseFloat(formData.price),
      original_price: formData.original_price ? parseFloat(formData.original_price) : null,
      images: parsedImages.length > 0 ? parsedImages : ["https://placehold.co/400x400/png?text=No+Image"],
      store_id: storeId,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      is_new: formData.is_new,
      is_clearance: formData.is_clearance,
      category_id: formData.category_id || null,
      brand_id: formData.brand_id || null,
      subcategory_id: formData.subcategory_id || null
    };

    try {
      if (formType === 'add') {
        const { data, error } = await dbClient.from('products').insert(payload).select().single();
        if (error) throw error;
        // If matched product was being added, update scanner match
        if (data) setMatchedProduct(data);
        alert("Product created successfully!");
      } else {
        if (!activeProduct) return;
        const { error } = await dbClient.from('products').update(payload).eq('id', activeProduct.id);
        if (error) throw error;
        // Update local scanned match if it was the edited product
        if (matchedProduct && matchedProduct.id === activeProduct.id) {
          setMatchedProduct({ ...matchedProduct, ...payload });
        }
        alert("Product updated successfully!");
      }
      setIsFormOpen(false);
      fetchData(dbClient);
    } catch (err: any) {
      console.error(err);
      alert(`Database operation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!dbClient) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${product.name}"?`);
    if (!confirmDelete) return;

    setIsLoadingData(true);
    try {
      const { error } = await dbClient.from('products').delete().eq('id', product.id);
      if (error) throw error;
      alert("Product deleted successfully.");
      if (matchedProduct && matchedProduct.id === product.id) {
        setMatchedProduct(null);
        setScanResult('idle');
      }
      fetchData(dbClient);
    } catch (err: any) {
      alert(`Delete failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.slug && p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1 className="brand-title">
            <Store className="text-primary" /> Sathi Smart CRM
          </h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className={`badge ${dbStatus === 'connected' ? 'badge-emerald' : dbStatus === 'testing' ? 'badge-amber' : 'badge-rose'}`}>
              <Database size={12} />
              {dbStatus === 'connected' ? 'DB Connected' : dbStatus === 'testing' ? 'Testing Connection' : 'DB Offline'}
            </span>
            <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setIsConfigOpen(true)}>
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-container">
        {/* SIDE PANEL: Configuration & Quick Stats */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} className="text-primary" /> Setup Connection
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Define the Supabase endpoints of your inventory system. Defaults to Sagarmatha Cosmetics store.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setIsConfigOpen(true)}>
              <Settings size={16} /> Connection Settings
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} className="text-primary" /> Inventory Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Products</span>
                <span style={{ fontWeight: '700' }}>{products.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Active Brands</span>
                <span style={{ fontWeight: '700' }}>{brands.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Categories</span>
                <span style={{ fontWeight: '700' }}>{categories.length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN PANEL: Live camera scanner & Catalog View */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CAMERA OCR SCANNER */}
          <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera className="text-primary" /> Camera OCR Product Recognition
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Hold a product label up to the lens. The smart scan reads product names using computer vision.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={`btn ${isCameraActive ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => setIsCameraActive(!isCameraActive)}
                >
                  {isCameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
                  {isCameraActive ? 'Turn Off Video' : 'Launch Scan Camera'}
                </button>
              </div>
            </div>

            {isCameraActive ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="camera-container">
                    <video ref={videoRef} className="camera-video" playsInline muted></video>
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    <div className={`scanner-overlay ${isOcrLoading ? 'scanning' : ''}`}>
                      <div className="scanner-line"></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="pulse-dot"></span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Camera Feed Active</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={autoScan}
                          onChange={(e) => setAutoScan(e.target.checked)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        Continuous Auto-Scan (3s)
                      </label>
                      <button className="btn btn-secondary" onClick={captureAndScan} disabled={isOcrLoading}>
                        {isOcrLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Manual Snap & OCR
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: '2px dashed var(--border-glass)', borderRadius: '14px', height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <Camera size={48} style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Camera is currently disabled</p>
                <button className="btn btn-primary" onClick={() => setIsCameraActive(true)}>
                  Start Scanner
                </button>
              </div>
            )}

            {/* SCAN RESULTS PANEL */}
            {scanResult !== 'idle' && (
              <div className="glass-panel" style={{ background: 'rgba(10, 11, 16, 0.4)', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${scanResult === 'match' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}` }}>
                {scanResult === 'match' && matchedProduct ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 className="text-emerald" size={20} />
                        <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>Product Detected!</span>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => handleOpenEdit(matchedProduct)}>
                        <Edit size={14} /> Edit Catalog Entry
                      </button>
                    </div>
                    <div className="match-card">
                      <div className="match-image-container">
                        <img src={matchedProduct.images[0]} alt={matchedProduct.name} className="match-image" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{matchedProduct.name}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{matchedProduct.description || "No description provided."}</p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>PRICE</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>Rs. {matchedProduct.price}</span>
                          </div>
                          {matchedProduct.original_price && (
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ORIGINAL PRICE</span>
                              <span style={{ fontSize: '1.1rem', fontWeight: '500', textDecoration: 'line-through', color: 'var(--text-muted)' }}>Rs. {matchedProduct.original_price}</span>
                            </div>
                          )}
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>STATUS</span>
                            <span className={`badge ${matchedProduct.is_active ? 'badge-emerald' : 'badge-rose'}`} style={{ marginTop: '2px' }}>
                              {matchedProduct.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle className="text-rose" size={20} />
                        <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>No Direct Product Match Found</span>
                      </div>
                      <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <Plus size={16} /> Create New Product
                      </button>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Scanned Text Snippet: <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>"{scannedText.trim().replace(/\n/g, ' ')}"</span>
                      </p>
                      {detectedKeywords.length > 0 && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Extracted tokens for search: {detectedKeywords.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* CATALOGUE TABLE VIEW */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>Store Catalog Directory</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Browse and manage your full list of products.</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                setFormType('add');
                setFormData({
                  name: '',
                  slug: '',
                  description: '',
                  price: '',
                  original_price: '',
                  images: '',
                  is_active: true,
                  is_featured: false,
                  is_new: false,
                  is_clearance: false,
                  category_id: categories[0]?.id || '',
                  brand_id: brands[0]?.id || '',
                  subcategory_id: subcategories[0]?.id || ''
                });
                setIsFormOpen(true);
              }}>
                <Plus size={18} /> Add Product Manually
              </button>
            </div>

            {/* SEARCH */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input
                type="text"
                className="form-input"
                placeholder="Search catalog by name or slug..."
                style={{ paddingLeft: '44px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* PRODUCT GRID/TABLE */}
            {isLoadingData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: '70px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', animation: 'pulse 1.5s infinite' }}></div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredProducts.map(product => (
                  <div key={product.id} className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(18,20,32,0.4)' }}>
                    <img
                      src={product.images?.[0] || "https://placehold.co/100x100"}
                      alt={product.name}
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-glass)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Rs. {product.price} • {brands.find(b => b.id === product.brand_id)?.name || 'Generic Brand'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => handleOpenEdit(product)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '8px', color: 'var(--accent-rose)' }} onClick={() => handleDeleteProduct(product)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No products found in database matching your filters.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* CONNECTION CONFIGURATION MODAL */}
      {isConfigOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings className="text-primary" /> Connection Configuration</h2>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsConfigOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>SUPABASE PROJECT URL</label>
                <input type="text" className="form-input" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>SUPABASE ANON/PUBLISHABLE KEY</label>
                <input type="password" className="form-input" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} placeholder="eyJhbG..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>MERCHANT STORE ID (UUID)</label>
                <input type="text" className="form-input" value={storeId} onChange={e => setStoreId(e.target.value)} placeholder="b0298a16-..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsConfigOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveConfig}>Save & Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT FORM MODAL */}
      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <form onSubmit={handleFormSave} className="glass-panel" style={{ maxWidth: '650px', width: '100%', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag className="text-primary" /> {formType === 'add' ? 'Create New Product' : 'Modify Product Details'}
              </h2>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsFormOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>PRODUCT NAME *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.name}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name: val,
                      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    }));
                  }}
                  placeholder="Mamaearth Vitamin C Serum"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SLUG (URL IDENTIFIER) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.slug}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SELLING PRICE (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  required
                  value={formData.price}
                  onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>ORIGINAL PRICE (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.original_price}
                  onChange={e => setFormData(prev => ({ ...prev, original_price: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>BRAND</label>
                <select className="form-select" value={formData.brand_id} onChange={e => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}>
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>CATEGORY</label>
                <select className="form-select" value={formData.category_id} onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SUBCATEGORY</label>
                <select className="form-select" value={formData.subcategory_id} onChange={e => setFormData(prev => ({ ...prev, subcategory_id: e.target.value }))}>
                  <option value="">Select Subcategory</option>
                  {subcategories.filter(s => !formData.category_id || s.category_id === formData.category_id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>IMAGE URL(S) (Comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.images}
                  onChange={e => setFormData(prev => ({ ...prev, images: e.target.value }))}
                  placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>PRODUCT DESCRIPTION</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} />
                  Active in Catalog
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_featured} onChange={e => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} />
                  Featured Product
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_new} onChange={e => setFormData(prev => ({ ...prev, is_new: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} />
                  Mark as New
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_clearance} onChange={e => setFormData(prev => ({ ...prev, is_clearance: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} />
                  Clearance Item
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                <Save size={16} /> Save Product
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
