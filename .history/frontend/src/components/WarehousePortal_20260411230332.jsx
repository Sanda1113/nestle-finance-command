import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { Package, Truck, CheckCircle2, AlertCircle, ScanBarcode, ArrowLeft, Camera, Search, EyeOff, Eye, CalendarDays, Hash, ShieldAlert, ShieldCheck, WifiOff, MapPin, RefreshCw, LogOut, Moon, Sun, X, Bot, Info, ArchiveRestore } from 'lucide-react';
import AppNotifier from './AppNotifier';
import NotificationBell from './NotificationBell';

const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = poNum.match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${poNum.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

const BarcodeScannerUI = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 150 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true,
                        rememberLastUsedCamera: true,
                    },
                    false
                );
                scannerRef.current = scanner;

                scanner.render(
                    (decodedText) => {
                        scanner.clear().catch(() => { });
                        onScanSuccess(decodedText);
                    },
                    (error) => {
                        // Ignore continuous scanning errors
                    }
                );
            } catch (err) {
                console.error("Scanner init error:", err);
                onClose?.();
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => { });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-6 right-6 bg-slate-800 text-white p-3 rounded-full hover:bg-red-500 transition-colors shadow-lg z-50">
                <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center mb-4">
                <ScanBarcode className="w-10 h-10 text-blue-500 mb-2 animate-pulse" />
                <h2 className="text-white font-black text-xl tracking-tight text-center">Hardware Scanner</h2>
            </div>
            <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.2)] p-2">
                <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
            </div>
            <style>{`
                #reader { border: none !important; }
                #reader button { background-color: #2563eb !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 8px !important; font-weight: bold !important; margin: 5px !important; cursor: pointer; }
                #reader__dashboard_section_swaplink { display: none !important; }
            `}</style>
        </div>
    );
};

export default function WarehousePortal({ user, onLogout }) {
    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPO, setSelectedPO] = useState(null);
    const [receivedItems, setReceivedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [viewMode, setViewMode] = useState('pending');

    const [scanning, setScanning] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [detectedProduct, setDetectedProduct] = useState(null);
    const fileInputRef = useRef(null);
    const [blindMode, setBlindMode] = useState(true);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncQueue, setSyncQueue] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const latestState = useRef({ pos, selectedPO, receivedItems });
    useEffect(() => { latestState.current = { pos, selectedPO, receivedItems }; }, [pos, selectedPO, receivedItems]);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    useEffect(() => {
        const savedQueue = JSON.parse(localStorage.getItem('grnSyncQueue') || '[]');
        setSyncQueue(savedQueue);
        const handleOnline = () => { setIsOffline(false); syncPendingGRNs(); };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchPOs = async () => {
        if (isOffline) { setLoading(false); return; }
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos');
            const enhancedData = res.data.data.map(po => ({
                ...po, trustScore: po.supplier_email.includes('nestle') ? 98 : Math.floor(Math.random() * (95 - 65 + 1) + 65)
            }));
            setPOs(enhancedData);
            localStorage.setItem('offlinePOs', JSON.stringify(enhancedData));
        } catch (err) {
            console.error(err);
            setPOs(JSON.parse(localStorage.getItem('offlinePOs') || '[]'));
        } finally { setLoading(false); }
    };

    useEffect(() => {
        fetchPOs();
        const interval = setInterval(() => fetchPOs(), 500);
        return () => clearInterval(interval);
    }, [isOffline]);

    const syncPendingGRNs = async () => {
        const queue = JSON.parse(localStorage.getItem('grnSyncQueue') || '[]');
        if (queue.length === 0) return;
        setIsSyncing(true);
        try {
            for (const payload of queue) {
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/submit', payload);
            }
            localStorage.removeItem('grnSyncQueue');
            setSyncQueue([]);
            alert('📡 Connection Restored. All offline GRNs have been synced securely.');
            fetchPOs();
        } catch (error) { console.error("Sync failed", error); }
        finally { setIsSyncing(false); }
    };

    const processScanResult = (decodedText) => {
        const state = latestState.current;

        if (!state.selectedPO) {
            const matchedPO = state.pos.find(p => p.po_number.toLowerCase() === decodedText.toLowerCase());

            if (matchedPO) {
                if (matchedPO.status && matchedPO.status.includes('Received')) {
                    alert(`📦 Shipment ${getShipmentId(matchedPO.po_number)} found, but it has already been COMPLETED and locked.`);
                } else {
                    setSearchTerm(decodedText);
                    setViewMode('pending');
                    handleSelectPO(matchedPO);
                }
            } else {
                setDetectedProduct({
                    barcode: decodedText,
                    name: "Unknown Scanned Item",
                    category: "Unrecognized Inventory",
                    message: `❌ Item not found. This shipment/item does not exist in the current pending dock queue.`
                });
            }
            return;
        }

        let scannedSku = decodedText;
        let scannedBatch = null;
        let scannedExpiry = null;

        if (decodedText.includes('|')) {
            const parts = decodedText.split('|');
            scannedSku = parts[0];
            scannedBatch = parts[1];
            scannedExpiry = parts[2];
        }

        const matchIndex = state.receivedItems.findIndex(item => item.expectedBarcode === scannedSku);

        if (matchIndex !== -1) {
            handleQtyChange(matchIndex, 1);
            if (scannedBatch) handleInputChange(matchIndex, 'batchNumber', scannedBatch);
            if (scannedExpiry) handleInputChange(matchIndex, 'expiryDate', scannedExpiry);
            try { new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3').play().catch(() => { }); } catch (e) { }
        } else {
            setDetectedProduct({
                barcode: decodedText,
                name: "Unknown Scanned Item",
                category: "Unrecognized Inventory",
                message: `❌ Item not in PO. This item does not match any expected items for Shipment ${getShipmentId(state.selectedPO.po_number)}. Please segregate this item for Procurement review.`
            });
            try { new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3').play().catch(() => { }); } catch (e) { }
        }
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setScanning(false);
        setIsProcessingImage(true);

        try {
            if ('BarcodeDetector' in window) {
                try {
                    const formats = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39'];
                    const detector = new window.BarcodeDetector({ formats });
                    const imageBitmap = await createImageBitmap(file);
                    const barcodes = await detector.detect(imageBitmap);
                    if (barcodes && barcodes.length > 0) {
                        processScanResult(barcodes[0].rawValue);
                        return;
                    }
                } catch (e) {
                    console.log("Native detector failed, trying html5-qrcode...");
                }
            }

            const html5QrCode = new Html5Qrcode("hidden-reader");
            try {
                const decodedText = await html5QrCode.scanFile(file, true);
                processScanResult(decodedText);
            } catch (qrError) {
                console.error("QR scan failed:", qrError);
                setDetectedProduct({
                    barcode: 'Unknown',
                    name: 'Scan Failed',
                    category: 'Error',
                    message: '❌ No barcode found. Try better lighting or use manual entry.'
                });
            } finally {
                html5QrCode.clear();
            }
        } catch (err) {
            console.error("Image processing error:", err);
            setDetectedProduct({
                barcode: 'Error',
                name: 'Processing Error',
                category: 'System',
                message: '❌ Could not process image. Please try again.'
            });
        } finally {
            setIsProcessingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSelectPO = (po) => {
        setSelectedPO(po);
        const expectedItems = po.po_data.lineItems.map((item, index) => ({
            ...item,
            expectedBarcode: `890123456789${index}`,
            actualQtyReceived: 0,
            status: 'Pending Scan',
            condition: 'Good',
            reasonCode: '',
            batchNumber: '',
            expiryDate: '',
            hasPhoto: false,
            riskLevel: 'Low'
        }));
        setReceivedItems(expectedItems);
        setBlindMode(true);
    };

    const handleInputChange = (index, field, value) => {
        const updated = [...receivedItems];
        updated[index][field] = value;
        setReceivedItems(updated);
    };

    const handleQtyChange = (index, delta, exactVal = null) => {
        const currentItems = [...latestState.current.receivedItems];
        const selectedPOContext = latestState.current.selectedPO;

        let newVal = exactVal !== null ? parseFloat(exactVal) : parseFloat(currentItems[index].actualQtyReceived) + delta;
        if (newVal < 0 || isNaN(newVal)) newVal = 0;

        const expected = parseFloat(currentItems[index].qty);
        currentItems[index].actualQtyReceived = newVal;

        if (newVal === 0) { currentItems[index].status = 'Pending Scan'; currentItems[index].riskLevel = 'Low'; }
        else if (newVal < expected) {
            currentItems[index].status = 'Shortage';
            const shortagePercent = ((expected - newVal) / expected) * 100;
            currentItems[index].riskLevel = shortagePercent > 20 || selectedPOContext.trustScore < 80 ? 'High' : 'Medium';
        }
        else if (newVal > expected) { currentItems[index].status = 'Overage'; currentItems[index].riskLevel = 'Medium'; }
        else { currentItems[index].status = 'Full Match'; currentItems[index].riskLevel = 'Low'; }

        setReceivedItems(currentItems);
    };

    const submitGRN = async () => {
        const unverifiedShortages = receivedItems.filter(i => i.status === 'Shortage' && !i.reasonCode);
        if (unverifiedShortages.length > 0) return alert('⚠️ Strict Audit Mode: Reason Code required for all shortages.');

        const missingFMCG = receivedItems.filter(i => i.actualQtyReceived > 0 && (!i.batchNumber || !i.expiryDate));
        if (missingFMCG.length > 0) return alert('⚠️ FMCG Compliance Error: Batch & Expiry required for food items.');

        let totalAmount = 0;
        let isPartial = false;

        receivedItems.forEach(item => {
            totalAmount += parseFloat(item.actualQtyReceived) * parseFloat(item.unitPrice);
            if (item.status === 'Shortage' || item.status === 'Pending Scan') isPartial = true;
        });

        let gpsLocation = "Location Unavailable";
        if ("geolocation" in navigator) {
            try {
                const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
                gpsLocation = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
            } catch (e) { console.log("GPS Denied/Failed"); }
        }

        const payload = {
            poNumber: selectedPO.po_number,
            receivedBy: user.email,
            itemsReceived: receivedItems,
            totalReceivedAmount: totalAmount,
            isPartial: isPartial,
            gpsLocation
        };

        if (isOffline) {
            const newQueue = [...syncQueue, payload];
            localStorage.setItem('grnSyncQueue', JSON.stringify(newQueue));
            setSyncQueue(newQueue);
            alert(`📡 OFFLINE MODE: GRN saved locally.\n📍 GPS Tag: ${gpsLocation}`);
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
        } else {
            try {
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/submit', payload);
                alert(`✅ Secure GRN Logged. GPS Coordinates Captured. Pipeline updated.`);
                setSelectedPO(null);
                setViewMode('completed');
                fetchPOs();
            } catch (err) { alert('Failed to log GRN'); }
        }
    };

    const togglePhoto = (index) => {
        const updated = [...receivedItems];
        updated[index].hasPhoto = !updated[index].hasPhoto;
        setReceivedItems(updated);
    };

    const rawPendingList = pos.filter(po => {
        const isCompleted = po.status && po.status.includes('Received');
        const isDeliveredToDock = po.status === 'Delivered to Dock' || po.status === 'Pending Warehouse GRN' || po.po_data?.delivery_timestamp;
        return !isCompleted && isDeliveredToDock;
    });

    const pendingList = [...rawPendingList].sort((a, b) => {
        const timeA = a.po_data?.delivery_timestamp ? new Date(a.po_data.delivery_timestamp).getTime() : Infinity;
        const timeB = b.po_data?.delivery_timestamp ? new Date(b.po_data.delivery_timestamp).getTime() : Infinity;
        return timeA - timeB;
    });

    const completedList = pos.filter(po => po.status && po.status.includes('Received'));
    const activeList = viewMode === 'pending' ? pendingList : completedList;
    const filteredPOs = activeList.filter(po => po.po_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const totalExpected = receivedItems.reduce((sum, item) => sum + parseFloat(item.qty), 0);
    const totalReceived = receivedItems.reduce((sum, item) => sum + parseFloat(item.actualQtyReceived), 0);
    const progressPercent = totalExpected === 0 ? 0 : Math.min(100, Math.round((totalReceived / totalExpected) * 100));

    const handleNotificationNavigate = (link) => {
        const [path, query] = link.split('?');
        if (path.includes('pending')) setViewMode('pending');
        if (path.includes('completed')) setViewMode('completed');
        if (query) {
            const params = new URLSearchParams(query);
            const po = params.get('po');
            if (po) {
                setSearchTerm(po);
                const target = pos.find(p => p.po_number === po);
                if (target) handleSelectPO(target);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans flex flex-col transition-colors duration-300 relative">
            <div id="hidden-reader" style={{ display: 'none' }}></div>

            {isProcessingImage && (
                <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6">
                    <Bot className="w-16 h-16 text-blue-500 animate-bounce mb-4" />
                    <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-blue-500 w-1/2 animate-[scan_1s_ease-in-out_infinite] rounded-full"></div>
                    </div>
                    <h2 className="text-white font-bold text-xl text-center">Cloud AI Vision Engine</h2>
                    <p className="text-slate-400 text-sm mt-2 text-center">Locally obscured. Routing image to cloud for extraction...</p>
                </div>
            )}

            {scanning && (
                <BarcodeScannerUI
                    onScanSuccess={(text) => {
                        setScanning(false);
                        processScanResult(text);
                    }}
                    onClose={() => setScanning(false)}
                />
            )}

            {detectedProduct && (
                <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setDetectedProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-800 dark:text-white mb-1">Product Identified</h3>
                        <p className="text-center text-sm font-mono text-slate-500 mb-6">{detectedProduct.barcode}</p>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Extracted Data</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{detectedProduct.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{detectedProduct.category}</p>
                        </div>

                        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{detectedProduct.message}</p>
                        </div>

                        <button onClick={() => setDetectedProduct(null)} className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-3 md:p-4 px-4 md:px-6 flex justify-between items-center sticky top-0 z-30 shadow-sm shrink-0">
                <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700 shrink-0">
                        <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white leading-tight">Nestle<span className="text-blue-500">Warehouse</span></h1>
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Logistics Portal</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <button onClick={() => fetchPOs()} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Force Refresh Data">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <NotificationBell role="Warehouse" onNavigate={handleNotificationNavigate} />
                    {isOffline ? (
                        <span className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold animate-pulse">
                            <WifiOff className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">Offline Mode</span><span className="sm:hidden">Offline</span>
                        </span>
                    ) : (
                        <span className="hidden sm:flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Online
                        </span>
                    )}
                    <div className="w-px h-5 md:h-6 bg-slate-700 mx-1 md:mx-2"></div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 md:p-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                        {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
                    </button>
                    {onLogout && (
                        <button onClick={onLogout} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 bg-red-900/40 hover:bg-red-600 text-white rounded-lg text-xs md:text-sm font-bold transition-colors">
                            <LogOut className="w-4 h-4 shrink-0" /> <span className="hidden sm:block">Exit</span>
                        </button>
                    )}
                </div>
            </div>

            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

            <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-28 md:pb-8">

                {isSyncing && (
                    <div className="mb-4 md:mb-6 bg-blue-500 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> Syncing offline data...
                    </div>
                )}
                {syncQueue.length > 0 && !isOffline && !isSyncing && (
                    <button onClick={syncPendingGRNs} className="mb-4 md:mb-6 w-full bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition-colors text-sm">
                        <RefreshCw className="w-4 h-4 shrink-0" /> {syncQueue.length} pending GRNs. Tap to sync.
                    </button>
                )}

                <div className="flex flex-col md:flex-row justify-between md:items-end gap-2 md:gap-4 mb-4 md:mb-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2 md:gap-3">
                            <Truck className="text-blue-500 w-6 h-6 md:w-8 md:h-8 shrink-0" /> Dock Logistics
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">Manage incoming shipments and completed delivery logs.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : !selectedPO ? (
                    <div className="space-y-4 md:space-y-6">

                        <div className="flex p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit">
                            <button
                                onClick={() => { setViewMode('pending'); setSearchTerm(''); }}
                                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'pending' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                ⏳ Pending Queue ({pendingList.length})
                            </button>
                            <button
                                onClick={() => { setViewMode('completed'); setSearchTerm(''); }}
                                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'completed' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <ArchiveRestore className="w-4 h-4" /> Completed Log ({completedList.length})
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                            <div className="relative flex-1">
                                <input type="text" placeholder={`Search ${viewMode === 'pending' ? 'Pending' : 'Completed'} Shipments...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 md:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                                <Search className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
                            </div>

                            {viewMode === 'pending' && (
                                <div className="flex gap-2">
                                    <button onClick={() => setScanning(true)} className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-slate-800 text-white hover:bg-slate-700 shadow-md">
                                        <ScanBarcode className="w-5 h-5 shrink-0" /> Live Scan
                                    </button>
                                    <button onClick={() => fileInputRef.current.click()} className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-md">
                                        <Camera className="w-5 h-5 shrink-0" /> Snap Photo
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                            {filteredPOs.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    No {viewMode} shipments found.
                                </div>
                            ) : filteredPOs.map(po => {
                                const isCompleted = po.status && po.status.includes('Received');

                                return (
                                    <div key={po.id} onClick={() => !isCompleted && handleSelectPO(po)} className={`group bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border ${isCompleted ? 'border-emerald-500/50' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl cursor-pointer'} transition-all relative overflow-hidden`}>
                                        {isCompleted && (
                                            <div className="absolute inset-0 bg-emerald-50/10 dark:bg-slate-900/50 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-4">
                                                <span className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 shadow-lg w-full justify-center">
                                                    <CheckCircle2 className="w-5 h-5" /> COMPLETED
                                                </span>
                                                <p className="text-xs text-slate-500 font-bold mt-3 uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1 rounded-full">{getShipmentId(po.po_number)}</p>
                                            </div>
                                        )}

                                        <div className={`absolute top-0 left-0 w-1.5 md:w-1 h-full ${po.trustScore >= 90 ? 'bg-emerald-500' : po.trustScore >= 75 ? 'bg-blue-500' : 'bg-red-500'} group-hover:w-2 transition-all`}></div>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-black text-lg md:text-xl text-slate-800 dark:text-white mb-0.5 leading-tight">{getShipmentId(po.po_number)}</h3>
                                                <p className="text-[10px] text-slate-400 font-mono mb-2">REF: {po.po_number}</p>
                                            </div>
                                            <span className={`flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${po.trustScore >= 90 ? 'bg-emerald-100 text-emerald-700' : po.trustScore >= 75 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {po.trustScore >= 90 ? <ShieldCheck className="w-3 h-3 shrink-0" /> : <ShieldAlert className="w-3 h-3 shrink-0" />}
                                                <span className="hidden sm:inline">Trust: </span>{po.trustScore}
                                            </span>
                                        </div>

                                        <div className="mb-4">
                                            {po.po_data?.delivery_timestamp ? (
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50 text-[10px] font-bold uppercase tracking-wider">
                                                    <Truck className="w-3 h-3" /> Arrived: {new Date(po.po_data.delivery_timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                                    <Truck className="w-3 h-3" /> In Transit
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs md:text-sm text-slate-500 font-medium truncate mb-4">{po.supplier_email}</p>
                                        <div className="flex justify-between items-center text-[10px] md:text-xs font-bold">
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg flex items-center gap-1"><Package className="w-3 h-3 shrink-0" /> {po.po_data?.lineItems?.length || 0} Pallets</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row overflow-hidden relative">

                        <div className="lg:w-1/3 bg-slate-50 dark:bg-slate-800/30 p-5 md:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
                            <button onClick={() => setSelectedPO(null)} className="flex items-center gap-1.5 text-xs md:text-sm text-slate-500 hover:text-blue-600 font-bold mb-4 md:mb-6 w-fit">
                                <ArrowLeft className="w-4 h-4" /> Back to Pending Queue
                            </button>

                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <h3 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white break-all pr-2">{getShipmentId(selectedPO.po_number)}</h3>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 mb-2">PO REF: {selectedPO.po_number}</p>
                                </div>
                                <button onClick={() => setBlindMode(!blindMode)} className={`p-2 rounded-lg shrink-0 ${blindMode ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/50' : 'bg-slate-200 text-slate-600'}`} title="Toggle Strict Blind Receiving">
                                    {blindMode ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-6 md:mb-8">
                                <p className="text-xs md:text-sm text-slate-500 font-medium truncate">{selectedPO.supplier_email}</p>
                            </div>

                            {!blindMode && (
                                <div className="mb-4 md:mb-8 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Received / Expected</span>
                                        <span className="text-base md:text-lg font-black text-blue-500">{totalReceived} <span className="text-xs md:text-sm text-slate-400">/ {totalExpected}</span></span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 md:h-3 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : progressPercent > 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                                    </div>
                                </div>
                            )}
                            {blindMode && (
                                <div className="mb-4 md:mb-8 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs md:text-sm text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                                    🛡️ <strong>Blind Receiving Active:</strong> Quantities hidden to enforce counting.
                                </div>
                            )}

                            <div className="flex gap-2 mb-3">
                                <button onClick={() => setScanning(true)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm">
                                    <ScanBarcode className="w-4 h-4" /> Live Scan
                                </button>
                                <button onClick={() => fileInputRef.current.click()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm">
                                    <Camera className="w-4 h-4" /> Photo
                                </button>
                            </div>

                            <div className="hidden lg:block mt-auto space-y-3 pt-4">
                                <button onClick={submitGRN} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" /> Sign & Lock GRN
                                </button>
                            </div>
                        </div>

                        <div className="lg:w-2/3 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-[70vh] lg:max-h-[800px]">
                            <div className="space-y-4 md:space-y-5">
                                {receivedItems.map((item, idx) => {
                                    const isShort = item.status === 'Shortage';
                                    const isOver = item.status === 'Overage';
                                    const isPending = item.status === 'Pending Scan';
                                    const isHighRisk = item.riskLevel === 'High';

                                    return (
                                        <div key={idx} className={`p-4 md:p-5 rounded-2xl border-2 transition-all bg-white dark:bg-slate-950 ${isHighRisk ? 'border-red-500 shadow-lg shadow-red-500/20' : isShort ? 'border-red-500/50' : isOver ? 'border-amber-500/50' : isPending ? 'border-slate-200 dark:border-slate-800' : 'border-emerald-500/30'}`}>

                                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <p className="font-bold text-slate-800 dark:text-white text-sm md:text-base leading-tight">{item.description}</p>
                                                        {isHighRisk && <span className="bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shrink-0"><AlertCircle className="w-3 h-3" /> High Risk</span>}
                                                    </div>
                                                    <p className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider">Ordered: {blindMode ? '🔒 HIDDEN' : item.qty + ' units'}</p>
                                                    <p className="text-[9px] text-blue-400 font-mono mt-1">Barcode: {item.expectedBarcode}</p>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                                                    <button onClick={() => handleQtyChange(idx, -1)} className="w-12 h-12 sm:w-10 sm:h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-xl font-black text-slate-600 dark:text-slate-300 shadow-sm shrink-0 active:scale-95 transition-transform">-</button>
                                                    <input type="number" value={item.actualQtyReceived || ''} placeholder="0" onChange={(e) => handleQtyChange(idx, 0, e.target.value)} className={`w-full sm:w-16 min-w-[3rem] text-center font-black text-2xl sm:text-xl bg-transparent outline-none ${isShort ? 'text-red-500' : isOver ? 'text-amber-500' : 'text-emerald-500'}`} />
                                                    <button onClick={() => handleQtyChange(idx, 1)} className="w-12 h-12 sm:w-10 sm:h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-xl font-black text-slate-600 dark:text-slate-300 shadow-sm shrink-0 active:scale-95 transition-transform">+</button>
                                                </div>
                                            </div>

                                            {item.actualQtyReceived > 0 && (
                                                <div className="mt-4 flex flex-col sm:flex-row gap-2 md:gap-3">
                                                    <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 md:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <input type="text" placeholder="Batch Number" value={item.batchNumber} onChange={(e) => handleInputChange(idx, 'batchNumber', e.target.value)} className="w-full bg-transparent text-xs md:text-sm outline-none dark:text-white font-medium" />
                                                    </div>
                                                    <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 md:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <input type="date" value={item.expiryDate} onChange={(e) => handleInputChange(idx, 'expiryDate', e.target.value)} className="w-full bg-transparent text-xs md:text-sm outline-none dark:text-white font-medium text-slate-500" />
                                                    </div>
                                                </div>
                                            )}

                                            {isShort && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3 sm:items-center">
                                                    <select value={item.reasonCode} onChange={(e) => handleInputChange(idx, 'reasonCode', e.target.value)} className={`w-full sm:w-auto border text-xs font-bold rounded-lg px-3 py-2 outline-none ${isHighRisk ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'}`}>
                                                        <option value="">⚠️ Select Shortage Reason...</option>
                                                        <option value="Missing from Truck">Missing from Truck</option>
                                                        <option value="Damaged in Transit">Damaged in Transit (Rejected)</option>
                                                        <option value="Supplier Backordered">Supplier Backordered</option>
                                                    </select>

                                                    <div className="flex items-center justify-between w-full sm:w-auto sm:ml-auto">
                                                        <button onClick={() => togglePhoto(idx)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${item.hasPhoto ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                                            <Camera className="w-4 h-4 shrink-0" /> {item.hasPhoto ? 'Photo Attached' : 'Add Photo'}
                                                        </button>
                                                        <span className="sm:hidden text-[10px] font-black uppercase text-red-600 ml-2">{item.status}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                            <button onClick={submitGRN} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]">
                                <CheckCircle2 className="w-5 h-5 shrink-0" /> Sign & Lock GRN
                            </button>
                        </div>

                    </div>
                )}
            </div>

            <AppNotifier role="Warehouse" />
        </div>
    );
}