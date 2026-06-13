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
  Package,
  LogOut,
  Mail,
  Lock,
  Upload,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { createWorker } from 'tesseract.js';


// Fallback Sagarmatha Cosmetics Credentials
const DEFAULT_URL = "https://zzjxgkrzpakbrleeduhq.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anhna3J6cGFrYnJsZWVkdWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODMxODgsImV4cCI6MjA5NTY1OTE4OH0.v1Nhqm4BlDp7fdcNExgVx9Bl4eLRIihI6xfJe5su0zo";
const DEFAULT_STORE_ID = "b0298a16-4ba9-4f36-8aee-d853785213a2"; // Sagarmatha Cosmetics store ID

interface ProductSize {
  id?: string;
  product_id?: string;
  size: string;
  stock: number;
}

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
  product_sizes?: ProductSize[];
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
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('sathi_crm_gemini_key') || '');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [dbClient, setDbClient] = useState<SupabaseClient | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');

  // Scanner/AI Vision Config & Refs
  const [scanMode, setScanMode] = useState<'ocr' | 'ai'>('ai');
  const [aiExtractedData, setAiExtractedData] = useState<any>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'scanner' | 'catalog' | 'config'>('scanner');
  const fileInputScannerRef = useRef<HTMLInputElement | null>(null);

  // Authentication Configuration
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

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

  // Size-stock configurations in the form
  const [formSizes, setFormSizes] = useState<{ size: string; stock: number }[]>([]);

  // Image upload states & ref
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline taxonomy add states
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddSubcategoryOpen, setIsAddSubcategoryOpen] = useState(false);

  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDesc, setNewBrandDesc] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");

  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryDesc, setNewSubcategoryDesc] = useState("");
  const [newSubcategoryCategory, setNewSubcategoryCategory] = useState("");

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

  // Auth Session Listener
  useEffect(() => {
    if (!dbClient) {
      setIsAuthLoading(false);
      return;
    }

    setIsAuthLoading(true);
    dbClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    }).catch(() => {
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = dbClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [dbClient]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbClient || !authEmail || !authPassword) return;

    setIsSubmittingAuth(true);
    setAuthError("");
    try {
      if (authMode === 'login') {
        const { error } = await dbClient.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        confetti({
          particleCount: 60,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#a855f7', '#10b981']
        });
      } else {
        const { error } = await dbClient.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        alert("Sign up successful! Please check your email inbox for a confirmation link, or log in if your instance has auto-confirm enabled.");
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setAuthError(err.message || "Failed to authenticate.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    if (!dbClient) return;
    try {
      await dbClient.auth.signOut();
      setSession(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

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
        client.from('products').select('*, product_sizes(*)').eq('store_id', storeId).order('created_at', { ascending: false }),
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
    localStorage.setItem('sathi_crm_gemini_key', geminiApiKey);
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

  // Helper for fuzzy string matching (Levenshtein Distance)
  const getSimilarity = (a: string, b: string): number => {
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j - 1][i] + 1, // deletion
          track[j][i - 1] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    const distance = track[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1.0 : 1.0 - distance / maxLength;
  };

  // Capture video frame and run either OCR or AI scan
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isOcrLoading) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    // Define scanning reticle box (75% width, 45% height in center)
    const cropW = Math.round(vWidth * 0.75);
    const cropH = Math.round(vHeight * 0.45);
    const cropX = Math.round((vWidth - cropW) / 2);
    const cropY = Math.round((vHeight - cropH) / 2);

    // Scale up the crop by 1.5x for higher resolution
    const scale = 1.5;
    canvas.width = Math.round(cropW * scale);
    canvas.height = Math.round(cropH * scale);

    // Draw only the cropped reticle area from video to canvas
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (scanMode === 'ai') {
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      await runGeminiVision(base64Image);
    } else {
      // Apply adaptive contrast thresholding on the crop to normalize lighting
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Calculate average luminance to adapt the threshold dynamically
      let totalGray = 0;
      const len = data.length;
      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        totalGray += gray;
      }
      const avgGray = totalGray / (len / 4);
      
      // Adaptive threshold based on average luminance (clamped between 50 and 200)
      const threshold = Math.max(50, Math.min(200, avgGray * 0.9));

      // Apply dynamic thresholding
      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        const value = gray > threshold ? 255 : 0;
        data[i] = value;
        data[i+1] = value;
        data[i+2] = value;
      }
      ctx.putImageData(imgData, 0, 0);

      setIsOcrLoading(true);

      try {
        if (!ocrWorkerRef.current) {
          alert("OCR worker is initializing. Please try again in a moment.");
          return;
        }
        const { data: { text } } = await ocrWorkerRef.current.recognize(canvas);
        processScannedText(text);
      } catch (err) {
        console.error("OCR scan error:", err);
      } finally {
        setIsOcrLoading(false);
      }
    }
  };

  // Run Gemini Vision API scan
  const runGeminiVision = async (base64Image: string) => {
    if (!geminiApiKey) {
      alert("Please configure your Gemini API Key in Settings.");
      return;
    }

    setIsOcrLoading(true);
    setScanResult('idle');
    setMatchedProduct(null);
    setAiExtractedData(null);

    // Prepare lists to help Gemini categorize
    const brandList = brands.map(b => ({ id: b.id, name: b.name }));
    const categoryList = categories.map(c => ({ id: c.id, name: c.name }));
    const subcategoryList = subcategories.map(s => ({ id: s.id, name: s.name, category_id: s.category_id }));

    const prompt = `Analyze this product label image. Identify the brand, product name, size/volume variants, price, and description.
We have these existing taxonomies in our database. If they match the product in the image, use their exact IDs.
Brands: ${JSON.stringify(brandList)}
Categories: ${JSON.stringify(categoryList)}
Subcategories: ${JSON.stringify(subcategoryList)}

Return a valid JSON object ONLY, with no markdown formatting and no backticks. The JSON must have this exact structure:
{
  "name": "Full product name (e.g. Mamaearth Vitamin C Serum)",
  "description": "Brief description of the product and its usage",
  "price": number (the price/MRP in Rs. if found, or a reasonable estimate),
  "original_price": number (original price if a discount is indicated, otherwise null),
  "brand_id": "matching Brand ID from database, or null if no brand matches",
  "category_id": "matching Category ID from database, or null if no category matches",
  "subcategory_id": "matching Subcategory ID from database, or null if no subcategory matches",
  "sizes": [
    { "size": "size/volume (e.g., 50ml, 100g, Standard)", "stock": 10 }
  ]
}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      
      // Clean base64 string
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.statusText} (${response.status}) - ${errorText}`);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("No response content from Gemini.");
      }

      const result = JSON.parse(textResponse.trim());
      processGeminiResult(result);

    } catch (err: any) {
      console.error("Gemini Vision scan failed:", err);
      alert(`AI Scan failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const processGeminiResult = (result: any) => {
    setAiExtractedData(result);
    const detectedName = result.name || "";
    setScannedText(detectedName);

    if (!detectedName) {
      setScanResult('no_match');
      setMatchedProduct(null);
      return;
    }

    // Try matching using fuzzy matching against our local products
    let bestProduct: Product | null = null;
    let highestScore = 0;

    products.forEach(product => {
      const productNameLower = product.name.toLowerCase();
      const detectedNameLower = detectedName.toLowerCase();
      
      const sim = getSimilarity(detectedNameLower, productNameLower);
      if (sim > highestScore) {
        highestScore = sim;
        bestProduct = product;
      }
    });

    // We consider score >= 0.75 (75% similarity) to be a valid match
    if (bestProduct && highestScore >= 0.75) {
      setMatchedProduct(bestProduct);
      setScanResult('match');
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

  const handleScannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target?.result as string;
        
        if (scanMode === 'ai') {
          await runGeminiVision(base64Image);
        } else {
          if (!ocrWorkerRef.current) {
            alert("OCR worker is not ready yet. Please wait.");
            setIsOcrLoading(false);
            return;
          }
          const { data: { text } } = await ocrWorkerRef.current.recognize(base64Image);
          processScannedText(text);
          setIsOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("File scanning failed:", err);
      alert(`File scanning failed: ${err.message || 'Unknown error'}`);
      setIsOcrLoading(false);
    }
  };

  // Clean scanned text & match with catalog using fuzzy word matching
  const processScannedText = (text: string) => {
    setScannedText(text);
    if (!text.trim()) return;

    // Tokenize text into alphanumeric words longer than 2 characters
    // Filter out common category/stop words to prevent false matching
    const stopWords = ['and', 'for', 'with', 'the', 'gel', 'cream', 'ml', 'gm', 'pack', 'body', 'face', 'skin', 'wash', 'oil', 'organic', 'natural'];
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w));

    setDetectedKeywords(words);

    if (words.length === 0) {
      setScanResult('no_match');
      setMatchedProduct(null);
      return;
    }

    // Match products based on overlapping tokens and fuzzy similarity
    let bestProduct: Product | null = null;
    let highestScore = 0;

    products.forEach(product => {
      const productNameLower = product.name.toLowerCase();
      const productWords = productNameLower
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

      let score = 0;

      words.forEach(word => {
        // Direct substring match gets higher weight
        if (productNameLower.includes(word)) {
          score += word.length * 1.5;
        } else {
          // Fuzzy match against individual words in product name
          let bestWordSim = 0;
          productWords.forEach(pw => {
            const sim = getSimilarity(word, pw);
            if (sim > bestWordSim) {
              bestWordSim = sim;
            }
          });
          
          if (bestWordSim >= 0.75) {
            score += word.length * bestWordSim;
          }
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestProduct = product;
      }
    });

    // We consider score >= 5 to be a valid match (about 1-2 words matched fully or partially)
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
    if (scanMode === 'ai' && aiExtractedData) {
      const name = aiExtractedData.name || '';
      setFormData({
        name: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: aiExtractedData.description || '',
        price: aiExtractedData.price ? aiExtractedData.price.toString() : '',
        original_price: aiExtractedData.original_price ? aiExtractedData.original_price.toString() : '',
        images: '',
        is_active: true,
        is_featured: false,
        is_new: true,
        is_clearance: false,
        category_id: aiExtractedData.category_id || categories[0]?.id || '',
        brand_id: aiExtractedData.brand_id || brands[0]?.id || '',
        subcategory_id: aiExtractedData.subcategory_id || subcategories[0]?.id || ''
      });
      setFormSizes(
        aiExtractedData.sizes && aiExtractedData.sizes.length > 0
          ? aiExtractedData.sizes.map((s: any) => ({ size: s.size, stock: s.stock || 10 }))
          : [{ size: 'Standard', stock: 10 }]
      );
    } else {
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
      setFormSizes([{ size: 'Standard', stock: 10 }]);
    }
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
    setFormSizes(
      product.product_sizes && product.product_sizes.length > 0
        ? product.product_sizes.map(ps => ({ size: ps.size, stock: ps.stock }))
        : [{ size: 'Standard', stock: 0 }]
    );
    setIsFormOpen(true);
  };

  const compressImage = async (file: File): Promise<Blob> => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return file;
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            0.82
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleUploadMultiple = async (files: File[]) => {
    if (!dbClient) {
      alert("Database client is not connected.");
      return;
    }
    
    setIsUploadingImages(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of files) {
        const compressedBlob = await compressImage(file);
        
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 6);
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const fileName = `product-${baseName || 'image'}-${timestamp}-${randomStr}.webp`;
        const filePath = `products/${fileName}`;
        
        const { error: uploadError } = await dbClient.storage
          .from('product-images')
          .upload(filePath, compressedBlob, {
            contentType: 'image/webp'
          });
          
        if (uploadError) {
          throw uploadError;
        }
        
        const { data: { publicUrl } } = dbClient.storage
          .from('product-images')
          .getPublicUrl(filePath);
          
        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        }
      }
      
      setFormData(prev => {
        const currentImages = prev.images
          ? prev.images.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const merged = [...currentImages, ...uploadedUrls];
        return {
          ...prev,
          images: merged.join(', ')
        };
      });
      
      confetti({
        particleCount: 40,
        spread: 30,
        colors: ['#a855f7', '#10b981']
      });
      
    } catch (err: any) {
      console.error("Image upload failed:", err);
      alert(`Image upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploadingImages(false);
    }
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
      let productId = "";
      if (formType === 'add') {
        const { data, error } = await dbClient.from('products').insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
        // If matched product was being added, update scanner match
        if (data) setMatchedProduct(data);
        alert("Product created successfully!");
      } else {
        if (!activeProduct) return;
        const { error } = await dbClient.from('products').update(payload).eq('id', activeProduct.id);
        if (error) throw error;
        productId = activeProduct.id;
        // Update local scanned match if it was the edited product
        if (matchedProduct && matchedProduct.id === activeProduct.id) {
          setMatchedProduct({ ...matchedProduct, ...payload });
        }
        alert("Product updated successfully!");
      }

      // Sync sizes and stocks
      await dbClient.from('product_sizes').delete().eq('product_id', productId);
      if (formSizes.length > 0) {
        const sizeRows = formSizes.map(fs => ({
          product_id: productId,
          size: fs.size.trim() || 'Standard',
          stock: fs.stock || 0
        }));
        const { error: sizesError } = await dbClient.from('product_sizes').insert(sizeRows);
        if (sizesError) throw sizesError;
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

  // Save handlers for inline taxonomy creation
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbClient || !newBrandName) return;

    try {
      const slug = newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await dbClient.from('brands').insert({
        name: newBrandName,
        slug,
        description: newBrandDesc || null,
        store_id: storeId
      }).select().single();

      if (error) throw error;
      alert(`Brand "${newBrandName}" created!`);
      
      // Update form select selection to new brand
      setFormData(prev => ({ ...prev, brand_id: data.id }));
      setIsAddBrandOpen(false);
      setNewBrandName("");
      setNewBrandDesc("");
      fetchData(dbClient);
    } catch (err: any) {
      alert(`Failed to create brand: ${err.message}`);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbClient || !newCategoryName) return;

    try {
      const slug = newCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await dbClient.from('categories').insert({
        name: newCategoryName,
        slug,
        description: newCategoryDesc || null,
        store_id: storeId
      }).select().single();

      if (error) throw error;
      alert(`Category "${newCategoryName}" created!`);
      
      // Update form select selection to new category
      setFormData(prev => ({ ...prev, category_id: data.id }));
      setIsAddCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryDesc("");
      fetchData(dbClient);
    } catch (err: any) {
      alert(`Failed to create category: ${err.message}`);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const catId = newSubcategoryCategory || formData.category_id;
    if (!dbClient || !newSubcategoryName || !catId) {
      alert("Please select a parent category first.");
      return;
    }

    try {
      const slug = newSubcategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await dbClient.from('subcategories').insert({
        name: newSubcategoryName,
        slug,
        description: newSubcategoryDesc || null,
        category_id: catId,
        store_id: storeId
      }).select().single();

      if (error) throw error;
      alert(`Subcategory "${newSubcategoryName}" created!`);
      
      // Update form select selection to new subcategory
      setFormData(prev => ({ ...prev, subcategory_id: data.id, category_id: catId }));
      setIsAddSubcategoryOpen(false);
      setNewSubcategoryName("");
      setNewSubcategoryDesc("");
      setNewSubcategoryCategory("");
      fetchData(dbClient);
    } catch (err: any) {
      alert(`Failed to create subcategory: ${err.message}`);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.slug && p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isAuthLoading) {
    return (
      <div className="spinner-container">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-container">
        <div className="glass-panel login-card">
          <div style={{ textAlign: 'center' }}>
            <Store className="text-primary" size={48} style={{ marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '8px' }}>Sathi Smart CRM</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {authMode === 'login' ? 'Please sign in to access your scanner catalog' : 'Create an administrator account'}
            </p>
          </div>

          {authError && (
            <div className="auth-error-alert">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                className="form-input input-with-icon"
                placeholder="Admin Email"
                required
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                className="form-input input-with-icon"
                placeholder="Password"
                required
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={isSubmittingAuth}>
              {isSubmittingAuth ? <Loader2 className="animate-spin" size={18} /> : authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.88rem' }}>
           
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', outline: 'none' }}
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError("");
              }}
            >
              {/* {authMode === 'login' ? 'Register Account' : 'Sign In'} */}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={() => setIsConfigOpen(true)}
            >
              <Settings size={14} /> Connection Settings
            </button>
          </div>
        </div>

        {/* CONNECTION SETTINGS MODAL IN LOGIN SCREEN */}
        {isConfigOpen && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>GEMINI API KEY (FOR AI VISION)</label>
                  <input type="password" className="form-input" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsConfigOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveConfig}>Save & Connect</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
              <span className="badge-text">{dbStatus === 'connected' ? 'Connected' : dbStatus === 'testing' ? 'Testing' : 'Offline'}</span>
            </span>
            <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setIsConfigOpen(true)} title="Connection Settings">
              <Settings size={18} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '8px 12px', color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.2)' }} onClick={handleLogout} title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Tabs */}
      <div className="mobile-tabs-nav">
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('scanner')}
        >
          <Sparkles size={18} />
          <span>Scanner</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('catalog')}
        >
          <Package size={18} />
          <span>Catalog</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('config')}
        >
          <Settings size={18} />
          <span>Setup</span>
        </button>
      </div>

      <div className="app-container">
        {/* SIDE PANEL: Configuration & Quick Stats */}
        <aside className={`app-aside ${activeMobileTab === 'config' ? '' : 'hide-on-mobile-inactive'}`}>
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
        <main className="app-main">
          {/* CAMERA OCR SCANNER */}
          <section className={`glass-panel ${activeMobileTab === 'scanner' ? '' : 'hide-on-mobile-inactive'}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Scanner Mode Selector */}
            <div className="scanner-mode-selector">
              <button
                type="button"
                className={`mode-btn ${scanMode === 'ai' ? 'active' : ''}`}
                onClick={() => {
                  setScanMode('ai');
                  setScanResult('idle');
                  setMatchedProduct(null);
                  setAiExtractedData(null);
                }}
              >
                <Sparkles size={16} /> Gemini AI Vision
              </button>
              <button
                type="button"
                className={`mode-btn ${scanMode === 'ocr' ? 'active' : ''}`}
                onClick={() => {
                  setScanMode('ocr');
                  setScanResult('idle');
                  setMatchedProduct(null);
                }}
              >
                <Camera size={16} /> Local OCR Scanner
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {scanMode === 'ai' ? (
                    <>
                      <Sparkles className="text-primary" /> Gemini AI Vision Scanner
                    </>
                  ) : (
                    <>
                      <Camera className="text-primary" /> Camera OCR Recognition
                    </>
                  )}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {scanMode === 'ai' 
                    ? "Upload or capture a photo. Gemini AI will automatically extract details (name, price, sizes, desc) and search our catalog."
                    : "Hold a product label up to the lens. The smart scan reads product names using local OCR."
                  }
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputScannerRef}
                  style={{ display: 'none' }}
                  onChange={handleScannerFileUpload}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => fileInputScannerRef.current?.click()}
                  disabled={isOcrLoading}
                >
                  <ImageIcon size={18} />
                  <span>Upload / Photo</span>
                </button>
                <button
                  className={`btn ${isCameraActive ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => setIsCameraActive(!isCameraActive)}
                >
                  {isCameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
                  {isCameraActive ? 'Turn Off Video' : 'Launch Scan Camera'}
                </button>
              </div>
            </div>

            {scanMode === 'ai' && !geminiApiKey && (
              <div className="auth-error-alert" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Gemini API Key is not set. Please add it in 
                  <button 
                    onClick={() => setIsConfigOpen(true)} 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', padding: '0 4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Connection Settings
                  </button> 
                  to use AI Vision.
                </span>
              </div>
            )}

            {isCameraActive ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="camera-container">
                    <video ref={videoRef} className="camera-video" playsInline muted></video>
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    <div className={`scanner-overlay ${isOcrLoading ? 'scanning' : ''}`}>
                      <div className="scanner-target-box">
                        <div className="scanner-corner corner-tl"></div>
                        <div className="scanner-corner corner-tr"></div>
                        <div className="scanner-corner corner-bl"></div>
                        <div className="scanner-corner corner-br"></div>
                        <div className="scanner-line"></div>
                        <span className="scanner-hint">Align product label here</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-responsive">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="pulse-dot"></span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Camera Feed Active</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {scanMode === 'ocr' && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={autoScan}
                            onChange={(e) => setAutoScan(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Continuous Auto-Scan (3s)
                        </label>
                      )}
                      <button className="btn btn-secondary" onClick={captureAndScan} disabled={isOcrLoading || (scanMode === 'ai' && !geminiApiKey)}>
                        {isOcrLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {scanMode === 'ai' ? 'Analyze with Gemini' : 'Manual Snap & OCR'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                style={{ 
                  border: '2px dashed var(--border-glass)', 
                  borderRadius: '14px', 
                  height: '240px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '12px',
                  background: 'rgba(10, 11, 16, 0.3)',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!isCameraActive) {
                    setIsCameraActive(true);
                  }
                }}
              >
                <Camera size={48} style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Camera is currently disabled</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setIsCameraActive(true); }}>
                    Start Live Video
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      fileInputScannerRef.current?.click(); 
                    }}
                  >
                    <ImageIcon size={16} /> Choose Photo
                  </button>
                </div>
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
                        <img
                          src={matchedProduct.images?.[0] || "https://placehold.co/400x400/png?text=No+Image"}
                          alt={matchedProduct.name}
                          className="match-image"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(124,58,237,0.15)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {brands.find(b => b.id === matchedProduct.brand_id)?.name || 'Generic Brand'}
                        </span>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '6px', marginBottom: '8px' }}>{matchedProduct.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '14px', lineHeight: '1.5' }}>
                          {matchedProduct.description || 'No product description provided.'}
                        </p>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Selling Price</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>Rs. {matchedProduct.price}</span>
                          </div>
                          {matchedProduct.original_price && (
                            <div>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Original Price</span>
                              <span style={{ fontSize: '1.1rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>Rs. {matchedProduct.original_price}</span>
                            </div>
                          )}
                          <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active Catalog Status</span>
                            <span style={{ fontSize: '0.9rem', color: matchedProduct.is_active ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: '600' }}>
                              {matchedProduct.is_active ? 'Active (Visible)' : 'Inactive (Hidden)'}
                            </span>
                          </div>
                        </div>

                        {/* Sizes/Stock Inventory Details */}
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Stock & Variants</span>
                          {matchedProduct.product_sizes && matchedProduct.product_sizes.length > 0 ? (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {matchedProduct.product_sizes.map((ps, index) => (
                                <div key={index} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ps.size}</span>
                                  <span style={{ height: '12px', width: '1px', background: 'var(--border-glass)' }}></span>
                                  <span style={{ color: ps.stock > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: '700' }}>
                                    {ps.stock} in stock
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No size/stock configured yet.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle className="text-rose" size={20} />
                        <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>No Match Found in Catalog</span>
                      </div>
                      <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <Plus size={16} /> Create New Product {scanMode === 'ai' && aiExtractedData ? '(AI Prefilled)' : ''}
                      </button>
                    </div>

                    {scanMode === 'ai' && aiExtractedData ? (
                      <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-glass)' }}>
                        <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={14} /> AI Extracted Product Details (Autofill Ready):
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                          <div className="col-span-full">
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Name</span>
                            <span style={{ fontWeight: '600' }}>{aiExtractedData.name}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Estimated Price</span>
                            <span style={{ fontWeight: '600', color: 'var(--accent-emerald)' }}>Rs. {aiExtractedData.price || 'N/A'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Original Price</span>
                            <span style={{ fontWeight: '600' }}>Rs. {aiExtractedData.original_price || 'N/A'}</span>
                          </div>
                          <div className="col-span-full">
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Suggested Description</span>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.4' }}>{aiExtractedData.description || 'No description extracted.'}</p>
                          </div>
                          {aiExtractedData.sizes && aiExtractedData.sizes.length > 0 && (
                            <div className="col-span-full">
                              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>Extracted Variants</span>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {aiExtractedData.sizes.map((s: any, i: number) => (
                                  <span key={i} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                    {s.size} (Stock: {s.stock || 10})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        Read Text: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>{scannedText}</code>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STORE PRODUCTS CATALOG DIRECTORY */}
          <section className={`glass-panel ${activeMobileTab === 'catalog' ? '' : 'hide-on-mobile-inactive'}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>Store Catalog Directory</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Search, review, edit, or delete items inside the target store inventory database.</p>
              </div>
              <button className="btn btn-primary" onClick={handleOpenAdd}>
                <Plus size={16} /> Add Product
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="Search catalog products by name, brand, or identifier slug..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

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
                      <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => handleOpenEdit(product)} title="Edit">
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--accent-rose)' }} onClick={() => handleDeleteProduct(product)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border-glass)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                No products found matching your search.
              </div>
            )}
          </section>
        </main>
      </div>

      {/* CONNECTION CONFIGURATION MODAL */}
      {isConfigOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
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
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>GEMINI API KEY (FOR AI VISION)</label>
                <input type="password" className="form-input" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." />
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
        <div className="modal-overlay">
          <form onSubmit={handleFormSave} className="glass-panel modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag className="text-primary" /> {formType === 'add' ? 'Create New Product' : 'Modify Product Details'}
              </h2>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsFormOpen(false)}><X size={18} /></button>
            </div>

            <div className="responsive-grid">
              <div className="col-span-full">
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-select" style={{ flex: 1 }} value={formData.brand_id} onChange={e => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}>
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setIsAddBrandOpen(true)} title="Add New Brand">+</button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>CATEGORY</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-select" style={{ flex: 1 }} value={formData.category_id} onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setIsAddCategoryOpen(true)} title="Add New Category">+</button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SUBCATEGORY</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-select" style={{ flex: 1 }} value={formData.subcategory_id} onChange={e => setFormData(prev => ({ ...prev, subcategory_id: e.target.value }))}>
                    <option value="">Select Subcategory</option>
                    {subcategories.filter(s => !formData.category_id || s.category_id === formData.category_id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => {
                    setNewSubcategoryCategory(formData.category_id);
                    setIsAddSubcategoryOpen(true);
                  }} title="Add New Subcategory">+</button>
                </div>
              </div>

              {(() => {
                const imageList = formData.images
                  ? formData.images.split(',').map(s => s.trim()).filter(Boolean)
                  : [];
                return (
                  <div className="col-span-full" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>PRODUCT IMAGES</label>
                    
                    {/* Previews of existing images */}
                    {imageList.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginBottom: '4px' }}>
                        {imageList.map((url, idx) => (
                          <div key={url + '-' + idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                            <img src={url} alt={`product-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'rgba(244, 63, 94, 0.85)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white'
                              }}
                              onClick={() => {
                                const updated = imageList.filter((_, i) => i !== idx);
                                setFormData(prev => ({ ...prev, images: updated.join(', ') }));
                              }}
                              title="Remove image"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload area */}
                    <div 
                      style={{
                        border: '2px dashed var(--border-glass)',
                        borderRadius: '10px',
                        padding: '20px',
                        textAlign: 'center',
                        background: 'rgba(10, 11, 16, 0.3)',
                        cursor: isUploadingImages ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={async e => {
                        e.preventDefault();
                        if (isUploadingImages) return;
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                          await handleUploadMultiple(files);
                        }
                      }}
                      onClick={() => {
                        if (!isUploadingImages) {
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const files = e.target.files ? Array.from(e.target.files) : [];
                          if (files.length > 0) {
                            await handleUploadMultiple(files);
                          }
                        }}
                      />
                      {isUploadingImages ? (
                        <>
                          <Loader2 className="animate-spin text-primary" size={24} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uploading image(s)...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-primary" size={24} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            Drag & drop or click to upload images
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Supports WebP, JPEG, PNG (Auto-compressed to WebP)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Fallback/Manual URL Edit Input */}
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Or edit/paste image URLs directly (comma-separated):
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.images}
                        onChange={e => setFormData(prev => ({ ...prev, images: e.target.value }))}
                        placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="col-span-full">
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>PRODUCT DESCRIPTION</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Product Size Variants & Stock Section */}
              <div className="col-span-full" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '10px' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sizes / Volume Variants & Stock
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formSizes.map((fs, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 2 }}
                        placeholder="Variant size/volume (e.g. 50ml, 100ml, Standard)"
                        required
                        value={fs.size}
                        onChange={e => {
                          const updated = [...formSizes];
                          updated[idx].size = e.target.value;
                          setFormSizes(updated);
                        }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        style={{ flex: 1 }}
                        placeholder="Stock qty"
                        min="0"
                        required
                        value={fs.stock}
                        onChange={e => {
                          const updated = [...formSizes];
                          updated[idx].stock = parseInt(e.target.value) || 0;
                          setFormSizes(updated);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', color: 'var(--accent-rose)' }}
                        onClick={() => {
                          setFormSizes(formSizes.filter((_, i) => i !== idx));
                        }}
                        title="Remove Variant"
                        disabled={formSizes.length <= 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '0.85rem', color: 'var(--primary)', borderColor: 'rgba(124,58,237,0.2)' }}
                  onClick={() => setFormSizes([...formSizes, { size: '', stock: 0 }])}
                >
                  <Plus size={14} /> Add Stock Variant
                </button>
              </div>

              <div className="col-span-full" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '10px' }}>
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

      {/* INLINE BRAND CREATION MODAL */}
      {isAddBrandOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <form onSubmit={handleCreateBrand} className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Plus className="text-primary" size={18} /> Add New Brand</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsAddBrandOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>BRAND NAME *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  placeholder="e.g. L'Oreal Paris"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  value={newBrandDesc}
                  onChange={e => setNewBrandDesc(e.target.value)}
                  placeholder="e.g. French personal care company"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddBrandOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Brand</button>
            </div>
          </form>
        </div>
      )}

      {/* INLINE CATEGORY CREATION MODAL */}
      {isAddCategoryOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <form onSubmit={handleCreateCategory} className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Plus className="text-primary" size={18} /> Add New Category</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsAddCategoryOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>CATEGORY NAME *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Skincare"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  placeholder="e.g. Cleansers, moisturizers, serums, creams"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddCategoryOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Category</button>
            </div>
          </form>
        </div>
      )}

      {/* INLINE SUBCATEGORY CREATION MODAL */}
      {isAddSubcategoryOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <form onSubmit={handleCreateSubcategory} className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Plus className="text-primary" size={18} /> Add New Subcategory</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsAddSubcategoryOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>PARENT CATEGORY *</label>
                <select
                  className="form-select"
                  required
                  value={newSubcategoryCategory || formData.category_id}
                  onChange={e => setNewSubcategoryCategory(e.target.value)}
                >
                  <option value="">Select Parent Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SUBCATEGORY NAME *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newSubcategoryName}
                  onChange={e => setNewSubcategoryName(e.target.value)}
                  placeholder="e.g. Face Wash"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  value={newSubcategoryDesc}
                  onChange={e => setNewSubcategoryDesc(e.target.value)}
                  placeholder="e.g. Daily foaming facial cleansers"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddSubcategoryOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Subcategory</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
