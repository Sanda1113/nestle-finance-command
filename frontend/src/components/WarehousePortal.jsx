// frontend/src/components/WarehousePortal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import {
    Package, Truck, CheckCircle2, AlertCircle, ScanBarcode, ArrowLeft, Camera, Search,
    EyeOff, Eye, CalendarDays, Hash, ShieldAlert, ShieldCheck, WifiOff, MapPin,
    RefreshCw, LogOut, Moon, Sun, X, Bot, Info, ArchiveRestore, Keyboard, Clock
} from 'lucide-react';
import AppNotifier from './AppNotifier';
import NotificationBell from './NotificationBell';
import FloatingChat from './FloatingChat';
import { safePlayAudio } from '../utils/safeAudio';

const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = poNum.match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${poNum.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

const API_BASE_URL = 'https://nestle-finance-command-production.up.railway.app/api/sprint2';
const SYNC_QUEUE_STORAGE_KEY = 'grnSyncQueue';
const OFFLINE_PO_STORAGE_KEY = 'offlinePOs';
const UNSUPPORTED_BARCODE_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);
const VALID_SYNC_ACTION_TYPES = ['submit', 'reject', 'acknowledge'];
const WAREHOUSE_POLL_INTERVAL_MS = 5000;
const IMMEDIATE_REFRESH_DEBOUNCE_MS = 800;
const WAREHOUSE_PROCESSABLE_STATUSES = new Set(['Delivered to Dock', 'Pending Warehouse GRN', 'Truck at Bay - Pending Unload']);
const WAREHOUSE_COMPLETED_STATUSES = new Set([
    'Goods Received (GRN Logged)',
    'Partially Received (Awaiting Backorder)',
    'Transaction Cancelled (Shortage)',
    'Goods Cleared - Ready for Payout'
]);
const OFFLINE_PO_FALLBACK_MAX_RECORDS = 120;
const OFFLINE_PO_FALLBACK_MAX_LINE_ITEMS = 200;

// 📱 Mobile‑optimized Bottom Drawer Scanner
const BarcodeScannerUI = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef(null);
    const isMounted = useRef(true);
    const [manualInput, setManualInput] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [cameraError, setCameraError] = useState(false);

    useEffect(() => {
        isMounted.current = true;
        if (showManual) return;

        const timer = setTimeout(() => {
            if (!isMounted.current) return;

            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true,
                        rememberLastUsedCamera: true,
                    },
                    false
                );

                scannerRef.current = scanner;

                scanner.render(
                    (decodedText) => {
                        if (scannerRef.current) {
                            scannerRef.current.clear().catch(() => { });
                        }
                        if (isMounted.current) {
                            onScanSuccess(decodedText);
                        }
                    },
                    (error) => {
                        if (error?.includes?.('NotReadableError') || error?.includes?.('NotFoundError')) {
                            setCameraError(true);
                        }
                    }
                );
            } catch (err) {
                console.error('Scanner init error:', err);
                setCameraError(true);
            }
        }, 100);

        return () => {
            isMounted.current = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => { });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, showManual]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            onScanSuccess(manualInput.trim());
        }
    };

    const switchToManual = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(() => { });
            scannerRef.current = null;
        }
        setShowManual(true);
        setCameraError(false);
    };

    const switchToCamera = () => {
        setShowManual(false);
        setCameraError(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 pb-safe"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ScanBarcode className="w-6 h-6 text-blue-500" />
                        <h3 className="font-black text-lg sm:text-xl text-slate-800 dark:text-white">Scan Barcode</h3>
                    </div>
                    <div className="flex gap-2">
                        {!showManual && (
                            <button
                                onClick={switchToManual}
                                className="p-3 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Manual Entry"
                            >
                                <Keyboard className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                        )}
                        {showManual && (
                            <button
                                onClick={switchToCamera}
                                className="p-3 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Use Camera"
                            >
                                <Camera className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-3 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-5 sm:p-5">
                    {showManual ? (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <p className="text-base sm:text-sm text-slate-500 dark:text-slate-400">
                                Enter barcode or PO number manually:
                            </p>
                            <input
                                type="text"
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                placeholder="e.g. SHP-12345 or 890123456789"
                                className="w-full px-5 py-4 sm:py-3 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 py-4 sm:py-3 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                                >
                                    Submit
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-4 sm:py-3 text-base font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : cameraError ? (
                        <div className="text-center py-8">
                            <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                                Camera not available
                            </p>
                            <p className="text-base text-slate-500 mt-1">
                                Please grant camera permission or use manual entry.
                            </p>
                            <button
                                onClick={switchToManual}
                                className="mt-6 px-6 py-3 text-base font-bold bg-blue-600 text-white rounded-lg"
                            >
                                Enter Manually
                            </button>
                        </div>
                    ) : (
                        <div className="bg-black rounded-xl overflow-hidden">
                            <div id="reader" className="w-full min-h-[300px]" />
                        </div>
                    )}
                </div>

                {!showManual && !cameraError && (
                    <div className="px-5 pb-5 text-center">
                        <p className="text-sm text-slate-400">Position barcode within the frame</p>
                    </div>
                )}

                <style>{`
                    #reader {
                        border: none !important;
                        border-radius: 0.75rem;
                        overflow: hidden;
                    }
                    #reader__scan_region {
                        background: black;
                    }
                    #reader__dashboard_section_csr span {
                        color: inherit !important;
                    }
                    #reader button {
                        background-color: #2563eb !important;
                        color: white !important;
                        border: none !important;
                        padding: 8px 16px !important;
                        border-radius: 12px !important;
                        font-weight: bold !important;
                        margin: 6px !important;
                        cursor: pointer;
                        font-size: 14px !important;
                    }
                    #reader button:hover {
                        background-color: #1d4ed8 !important;
                    }
                    #reader select {
                        background-color: #1e293b !important;
                        color: white !important;
                        padding: 8px !important;
                        border-radius: 12px !important;
                        border: 1px solid #334155 !important;
                        margin-bottom: 10px;
                        font-size: 14px !important;
                    }
                    #reader__camera_selection {
                        margin-bottom: 8px;
                    }
                    #reader__dashboard_section_swaplink {
                        color: #60a5fa !important;
                        text-decoration: underline;
                        font-size: 0.875rem;
                    }
                    #reader__status_span {
                        font-size: 14px !important;
                    }
                `}</style>
            </div>
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
    const shortagePhotoInputRef = useRef(null);
    const [activePhotoItemIndex, setActivePhotoItemIndex] = useState(null);
    const [blindMode, setBlindMode] = useState(true);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncQueue, setSyncQueue] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isClearing, setIsClearing] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    // Prevent duplicate sync calls
    const syncingRef = useRef(false);
    const queuePersistAlertShownRef = useRef(false);
    const isFetchingPOsRef = useRef(false);
    const lastImmediateRefreshAtRef = useRef(0);

    const latestState = useRef({ pos, selectedPO, receivedItems });
    useEffect(() => { latestState.current = { pos, selectedPO, receivedItems }; }, [pos, selectedPO, receivedItems]);

    const normalizeQueueItem = useCallback((item) => {
        if (!item) return null;
        const looksTyped = typeof item === 'object' && item !== null && item.type && item.payload;
        const candidate = looksTyped ? item : { type: 'submit', payload: item };
        const rawType = String(candidate.type || 'submit').trim().toLowerCase();
        const type = VALID_SYNC_ACTION_TYPES.includes(rawType) ? rawType : null;
        if (!type) return null;
        const payload = candidate.payload;
        if (!payload || typeof payload !== 'object') return null;
        const poNumber = typeof payload.poNumber === 'string' ? payload.poNumber.trim() : '';
        if (!poNumber) return null;
        return { type, payload };
    }, []);

    const loadCachedPOs = useCallback(() => {
        try {
            const cachedRaw = localStorage.getItem(OFFLINE_PO_STORAGE_KEY);
            if (!cachedRaw) return [];
            const parsed = JSON.parse(cachedRaw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, []);

    const sanitizePODataForOfflineCache = useCallback((poData) => {
        if (!poData || typeof poData !== 'object') return poData;
        const sanitizeEvidence = (evidence) => {
            if (!Array.isArray(evidence)) return evidence;
            return evidence.map((item) => {
                if (!item || typeof item !== 'object') return item;
                return { ...item, photoDataUrl: '' };
            });
        };
        return {
            ...poData,
            warehouse_rejection: poData.warehouse_rejection
                ? {
                    ...poData.warehouse_rejection,
                    shortageEvidence: sanitizeEvidence(poData.warehouse_rejection.shortageEvidence)
                }
                : poData.warehouse_rejection,
            warehouse_grn: poData.warehouse_grn
                ? {
                    ...poData.warehouse_grn,
                    shortageEvidence: sanitizeEvidence(poData.warehouse_grn.shortageEvidence)
                }
                : poData.warehouse_grn
        };
    }, []);

    const sanitizePOForOfflineCache = useCallback((po) => {
        if (!po || typeof po !== 'object') return po;
        return {
            ...po,
            po_data: sanitizePODataForOfflineCache(po.po_data)
        };
    }, [sanitizePODataForOfflineCache]);

    const persistPOCache = useCallback((records) => {
        const safeRecords = (Array.isArray(records) ? records : []).map(sanitizePOForOfflineCache);
        let savedPrimaryCache = false;
        try {
            localStorage.setItem(OFFLINE_PO_STORAGE_KEY, JSON.stringify(safeRecords));
            savedPrimaryCache = true;
        } catch (error) {
            if (error?.name !== 'QuotaExceededError') {
                console.error('Failed to persist PO cache to localStorage:', error);
                return;
            }
        }
        if (savedPrimaryCache) return;

        try {
            const fallback = safeRecords
                .filter((po) => {
                    const status = String(po?.status || '');
                    return WAREHOUSE_PROCESSABLE_STATUSES.has(status) || WAREHOUSE_COMPLETED_STATUSES.has(status);
                })
                .slice(0, OFFLINE_PO_FALLBACK_MAX_RECORDS)
                .map((po) => ({
                    ...po,
                    po_data: {
                        delivery_timestamp: po?.po_data?.delivery_timestamp || null,
                        lineItems: Array.isArray(po?.po_data?.lineItems) ? po.po_data.lineItems.slice(0, OFFLINE_PO_FALLBACK_MAX_LINE_ITEMS) : [],
                        warehouse_rejection: po?.po_data?.warehouse_rejection || null,
                        warehouse_grn: po?.po_data?.warehouse_grn || null
                    }
                }));
            localStorage.setItem(OFFLINE_PO_STORAGE_KEY, JSON.stringify(fallback));
        } catch {
            // ignore cache write failures
        }
    }, [sanitizePOForOfflineCache]);

    const updatePOStatusLocally = useCallback((poNumber, nextStatus, poDataPatch = {}) => {
        if (!poNumber || !nextStatus) {
            console.warn('Skipping local PO status update due to missing poNumber or status.', { poNumber, nextStatus });
            return;
        }
        setPOs((prev) => {
            const next = prev.map((po) => {
                if (po.po_number !== poNumber) return po;
                return {
                    ...po,
                    status: nextStatus,
                    po_data: {
                        ...(po.po_data || {}),
                        ...(poDataPatch || {})
                    }
                };
            });
            persistPOCache(next);
            return next;
        });
    }, [persistPOCache]);

    const buildWarehouseGRNPatch = (submittedBy, submittedAt, totalReceivedAmount, isPartial, gpsLocation) => ({
        warehouse_grn: {
            submittedBy,
            submittedAt,
            totalReceivedAmount,
            isPartial: Boolean(isPartial),
            gpsLocation
        }
    });

    const buildWarehouseRejectionPatch = (rejectedBy, rejectedAt, rejectionReason) => ({
        warehouse_rejection: {
            rejectedBy,
            rejectedAt,
            rejectionReason
        }
    });

    const sanitizeItemsForOfflineQueue = useCallback((items = []) => {
        if (!Array.isArray(items)) return [];
        return items.map((item) => {
            if (!item || typeof item !== 'object') return item;
            return {
                ...item,
                hasPhoto: Boolean(item.hasPhoto || item.photoDataUrl),
                photoDataUrl: ''
            };
        });
    }, []);

    const sanitizePayloadForOfflineQueue = useCallback((payload) => {
        if (!payload || typeof payload !== 'object') return payload;
        if (!Array.isArray(payload.itemsReceived)) return payload;
        return {
            ...payload,
            itemsReceived: sanitizeItemsForOfflineQueue(payload.itemsReceived)
        };
    }, [sanitizeItemsForOfflineQueue]);

    const enqueueOfflineAction = useCallback((type, payload) => {
        const safeType = VALID_SYNC_ACTION_TYPES.includes(type) ? type : null;
        if (!safeType) {
            console.warn(`Ignoring unsupported offline action type "${String(type)}".`);
            return;
        }
        const safePayload = sanitizePayloadForOfflineQueue(payload);
        setSyncQueue((prev) => [...prev, { type: safeType, payload: safePayload }]);
    }, [sanitizePayloadForOfflineQueue]);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    // Load sync queue from localStorage on mount
    useEffect(() => {
        let savedQueue = [];
        try {
            savedQueue = JSON.parse(localStorage.getItem(SYNC_QUEUE_STORAGE_KEY) || '[]');
        } catch {
            savedQueue = [];
        }
        const rawQueue = Array.isArray(savedQueue) ? savedQueue : [];
        const normalizedQueue = rawQueue.map(normalizeQueueItem).filter(Boolean);
        const droppedCount = rawQueue.length - normalizedQueue.length;
        if (droppedCount > 0) {
            console.warn(`Dropped ${droppedCount} invalid offline queue item(s).`);
        }
        setSyncQueue(normalizedQueue);
    }, [normalizeQueueItem]);

    // Persist queue to localStorage whenever it changes
    useEffect(() => {
        if (syncQueue.length === 0) {
            localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
            queuePersistAlertShownRef.current = false;
            return;
        }
        try {
            localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(syncQueue));
            queuePersistAlertShownRef.current = false;
        } catch (error) {
            console.error('Failed to persist offline queue to localStorage:', error);
            if (!queuePersistAlertShownRef.current) {
                queuePersistAlertShownRef.current = true;
                const reason = error?.name === 'QuotaExceededError'
                    ? 'Storage is full on this device.'
                    : 'Browser storage is unavailable.';
                alert(`⚠️ Offline queue could not be fully saved. ${reason} Keep the app open and reconnect to sync pending actions; closing the app before reconnect may lose unsaved actions.`);
            }
        }
    }, [syncQueue]);

    const fetchPOs = useCallback(async ({ preferCached = false } = {}) => {
        if (isFetchingPOsRef.current) return;
        isFetchingPOsRef.current = true;
        if (preferCached) {
            const cachedPOs = loadCachedPOs();
            if (cachedPOs.length > 0) setPOs(cachedPOs);
        }

        if (!navigator.onLine) {
            setLoading(false);
            const cachedPOs = loadCachedPOs();
            if (cachedPOs.length > 0) setPOs(cachedPOs);
            isFetchingPOsRef.current = false;
            return;
        }
        try {
            const res = await axios.get(`${API_BASE_URL}/grn/pending-pos`, {
                params: {
                    scope: 'warehouse',
                    includePhotos: false,
                    _ts: Date.now()
                },
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                }
            });
            const enhancedData = res.data.data.map(po => ({
                ...po,
                trustScore: String(po?.supplier_email || '').toLowerCase().includes('nestle')
                    ? 98
                    : Math.floor(Math.random() * (95 - 65 + 1) + 65)
            }));
            setPOs(enhancedData);
            persistPOCache(enhancedData);
        } catch (err) {
            console.error(err);
            const cachedPOs = loadCachedPOs();
            if (cachedPOs.length > 0) setPOs(cachedPOs);
        } finally {
            setLoading(false);
            isFetchingPOsRef.current = false;
        }
    }, [loadCachedPOs, persistPOCache]);

    useEffect(() => {
        fetchPOs();
        const interval = setInterval(() => fetchPOs(), WAREHOUSE_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchPOs, isOffline]);

    useEffect(() => {
        const shouldRefreshImmediately = () => {
            if (document.hidden) return false;
            const now = Date.now();
            if ((now - lastImmediateRefreshAtRef.current) <= IMMEDIATE_REFRESH_DEBOUNCE_MS) return false;
            lastImmediateRefreshAtRef.current = now;
            return true;
        };

        const refreshImmediately = () => {
            if (shouldRefreshImmediately()) {
                fetchPOs();
            }
        };

        window.addEventListener('focus', refreshImmediately);
        document.addEventListener('visibilitychange', refreshImmediately);
        return () => {
            window.removeEventListener('focus', refreshImmediately);
            document.removeEventListener('visibilitychange', refreshImmediately);
        };
    }, [fetchPOs]);

    const syncPendingGRNs = useCallback(async () => {
        if (syncingRef.current) return;
        const queue = syncQueue.map(normalizeQueueItem).filter(Boolean);
        if (queue.length === 0) {
            setSyncQueue([]);
            localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
            return;
        }

        syncingRef.current = true;
        setIsSyncing(true);
        const failedItems = [];
        let droppedInvalidCount = syncQueue.length - queue.length;

        for (const queueItem of queue) {
            const rawType = queueItem?.type;
            if (rawType && !VALID_SYNC_ACTION_TYPES.includes(rawType)) {
                console.warn(`Unknown offline queue action type "${rawType}" encountered. Leaving item in queue and skipping sync for this item.`);
                failedItems.push(queueItem);
                continue;
            }
            const type = rawType === 'reject' ? 'reject' : rawType === 'acknowledge' ? 'acknowledge' : 'submit';
            const payload = queueItem?.payload ?? queueItem;
            const endpoint = type === 'reject'
                ? `${API_BASE_URL}/grn/reject`
                : type === 'acknowledge'
                    ? `${API_BASE_URL}/grn/acknowledge`
                    : `${API_BASE_URL}/grn/submit`;
            try {
                await axios.post(endpoint, payload);
            } catch (error) {
                const statusCode = Number(error?.response?.status || 0);
                if (statusCode >= 400 && statusCode < 500) {
                    console.error(`Dropping invalid offline action for ${payload.poNumber}:`, error?.response?.data || error.message);
                    droppedInvalidCount += 1;
                } else {
                    console.error(`Failed to sync GRN for ${payload.poNumber}:`, error);
                    failedItems.push({ type, payload });
                }
            }
        }

        if (failedItems.length === 0) {
            setSyncQueue([]);
            localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
            if (droppedInvalidCount > 0) {
                alert(`📡 Offline queue cleaned and synced. ${droppedInvalidCount} invalid action(s) were removed.`);
            } else {
                alert('📡 All offline shipment actions have been synced successfully.');
            }
        } else {
            setSyncQueue(failedItems);
            alert(`⚠️ ${failedItems.length} offline action(s) failed to sync.${droppedInvalidCount > 0 ? ` ${droppedInvalidCount} invalid action(s) were removed.` : ''} Failed items will remain in the queue for retry.`);
        }

        setIsSyncing(false);
        syncingRef.current = false;
        fetchPOs();
    }, [fetchPOs, normalizeQueueItem, syncQueue]);

    // Online/Offline listeners
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            fetchPOs({ preferCached: true });
            if (!syncingRef.current && syncQueue.length > 0) {
                syncPendingGRNs();
            }
        };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [fetchPOs, syncPendingGRNs, syncQueue.length]);

    const processScanResult = (decodedText) => {
        const scannedText = typeof decodedText === 'string' ? decodedText.trim() : '';
        if (!scannedText) {
            setDetectedProduct({
                barcode: 'Empty Scan',
                name: 'Scan Failed',
                category: 'Error',
                message: '❌ No barcode detected. Please try again or use manual entry.'
            });
            return;
        }

        const state = latestState.current;

        if (!state.selectedPO) {
            const matchedPO = state.pos.find(p => p.po_number.toLowerCase() === scannedText.toLowerCase());

            if (matchedPO) {
                if (matchedPO.status && matchedPO.status.includes('Received')) {
                    alert(`📦 Shipment ${getShipmentId(matchedPO.po_number)} found, but it has already been COMPLETED and locked.`);
                } else {
                    setSearchTerm(scannedText);
                    setViewMode('pending');
                    handleSelectPO(matchedPO);
                }
            } else {
                setDetectedProduct({
                    barcode: scannedText,
                    name: "Unknown Scanned Item",
                    category: "Unrecognized Inventory",
                    message: `❌ Item not found. This shipment/item does not exist in the current pending dock queue.`
                });
            }
            return;
        }

        let scannedSku = scannedText;
        let scannedBatch = null;
        let scannedExpiry = null;

        if (scannedText.includes('|')) {
            const parts = scannedText.split('|');
            scannedSku = parts[0];
            scannedBatch = parts[1];
            scannedExpiry = parts[2];
        }

        const matchIndex = state.receivedItems.findIndex(item => item.expectedBarcode === scannedSku);

        if (matchIndex !== -1) {
            handleQtyChange(matchIndex, 1);
            if (scannedBatch) handleInputChange(matchIndex, 'batchNumber', scannedBatch);
            if (scannedExpiry) handleInputChange(matchIndex, 'expiryDate', scannedExpiry);
            safePlayAudio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
        } else {
            setDetectedProduct({
                barcode: scannedText,
                name: "Unknown Scanned Item",
                category: "Unrecognized Inventory",
                message: `❌ Item not in PO. This item does not match any expected items for Shipment ${getShipmentId(state.selectedPO.po_number)}. Please segregate this item for Procurement review.`
            });
            safePlayAudio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
        }
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const fileType = typeof file.type === 'string' ? file.type.toLowerCase() : '';
        if (!fileType.startsWith('image/')) {
            alert('Please upload a valid image file for barcode detection.');
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        if (UNSUPPORTED_BARCODE_IMAGE_TYPES.has(fileType)) {
            alert('HEIC/HEIF photo format is not supported for barcode detection. Please use JPG or PNG instead.');
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setScanning(false);
        setIsProcessingImage(true);

        try {
            if ('BarcodeDetector' in window) {
                try {
                    const formats = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'pdf417', 'data_matrix', 'aztec'];
                    const detector = new window.BarcodeDetector({ formats });
                    const imageBitmap = await createImageBitmap(file);
                    const barcodes = await detector.detect(imageBitmap);
                    const firstValue = Array.isArray(barcodes) && barcodes.length > 0 ? String(barcodes[0]?.rawValue || '').trim() : '';
                    if (firstValue) {
                        processScanResult(firstValue);
                        return;
                    }
                } catch {
                    console.log("Native detector failed, trying html5-qrcode...");
                }
            }

            const html5QrCode = new Html5Qrcode("hidden-reader");
            try {
                let decodedText = '';
                try {
                    decodedText = await html5QrCode.scanFile(file, true);
                } catch (firstErr) {
                    console.debug('Scan with inversion attempt failed, retrying standard scan:', firstErr);
                    decodedText = await html5QrCode.scanFile(file, false);
                }
                processScanResult(decodedText);
            } catch (qrError) {
                console.error("QR scan failed:", qrError);
                setDetectedProduct({
                    barcode: 'Unknown',
                    name: 'Scan Failed',
                    category: 'Error',
                    message: '❌ No barcode found. Try taking another photo closer to the barcode or use manual entry.'
                });
            } finally {
                html5QrCode.clear().catch((cleanupErr) => {
                    console.debug('QR cleanup warning:', cleanupErr);
                });
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

    const openShortagePhotoPicker = (index) => {
        setActivePhotoItemIndex(index);
        shortagePhotoInputRef.current?.click();
    };

    const handleShortagePhotoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (file && activePhotoItemIndex !== null) {
            const photoDataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
            setReceivedItems(prev =>
                prev.map((item, idx) =>
                    idx === activePhotoItemIndex
                        ? {
                            ...item,
                            hasPhoto: true,
                            photoFileName: file.name,
                            photoAttachedAt: new Date().toISOString(),
                            photoMimeType: file.type || 'image/*',
                            photoSizeBytes: Number(file.size || 0),
                            photoDataUrl
                        }
                        : item
                )
            );
        }
        setActivePhotoItemIndex(null);
        if (shortagePhotoInputRef.current) shortagePhotoInputRef.current.value = "";
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
            photoFileName: '',
            photoAttachedAt: null,
            photoMimeType: '',
            photoSizeBytes: 0,
            photoDataUrl: '',
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
            } catch { console.log("GPS Denied/Failed"); }
        }

        const payload = {
            poNumber: selectedPO.po_number,
            receivedBy: user.email,
            itemsReceived: receivedItems,
            totalReceivedAmount: totalAmount,
            isPartial: isPartial,
            gpsLocation
        };
        const submittedAt = new Date().toISOString();

        if (isOffline) {
            enqueueOfflineAction('submit', payload);
            updatePOStatusLocally(
                selectedPO.po_number,
                isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)',
                buildWarehouseGRNPatch(user.email, submittedAt, totalAmount, isPartial, gpsLocation)
            );
            alert(`📡 OFFLINE MODE: GRN saved locally.\n📍 GPS Tag: ${gpsLocation}`);
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
        } else {
            try {
                await axios.post(`${API_BASE_URL}/grn/submit`, payload);
                updatePOStatusLocally(
                    selectedPO.po_number,
                    isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)',
                    buildWarehouseGRNPatch(user.email, submittedAt, totalAmount, isPartial, gpsLocation)
                );
                alert(`✅ Secure GRN Logged. GPS Coordinates Captured. Pipeline updated.`);
                setSelectedPO(null);
                setViewMode('completed');
                fetchPOs();
            } catch {
                alert('Failed to log GRN. Saving offline.');
                enqueueOfflineAction('submit', payload);
                updatePOStatusLocally(
                    selectedPO.po_number,
                    isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)',
                    buildWarehouseGRNPatch(user.email, submittedAt, totalAmount, isPartial, gpsLocation)
                );
                setSelectedPO(null);
                setViewMode('completed');
                fetchPOs();
            }
        }
    };

    const handleAcknowledgeArrival = async (po) => {
        if (!window.confirm('Acknowledge that this truck has arrived at the bay?')) return;
        const payload = {
            poNumber: po.po_number,
            ackedBy: user.email
        };

        if (isOffline) {
            enqueueOfflineAction('acknowledge', payload);
            updatePOStatusLocally(po.po_number, 'Truck at Bay - Pending Unload');
            alert('📡 OFFLINE MODE: Arrival acknowledgement saved locally and will auto-sync when online.');
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/grn/acknowledge`, payload);
            updatePOStatusLocally(po.po_number, 'Truck at Bay - Pending Unload');
            alert('✅ Arrival Acknowledged. Supplier has been notified.');
            fetchPOs();
        } catch (error) {
            console.error(error);
            enqueueOfflineAction('acknowledge', payload);
            updatePOStatusLocally(po.po_number, 'Truck at Bay - Pending Unload');
            alert('Failed to acknowledge arrival online. Action saved offline and queued for sync.');
        }
    };

    const handleClearGoods = async () => {
        if (!selectedPO) return;
        if (!window.confirm('Confirm that all goods have been inspected and are ready for payout?')) return;
        setIsClearing(true);
        try {
            await axios.post(`${API_BASE_URL}/grn/clear`, {
                poNumber: selectedPO.po_number,
                clearedBy: user.email
            });
            updatePOStatusLocally(selectedPO.po_number, 'Goods Cleared - Ready for Payout');
            alert('✅ Goods marked as cleared. Finance has been notified.');
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
        } catch {
            alert('Failed to clear goods.');
        } finally {
            setIsClearing(false);
        }
    };

    const handleRejectShipment = async () => {
        if (!selectedPO) return;
        const shortageItems = receivedItems.filter(item =>
            item.status === 'Shortage' || Number(item.actualQtyReceived || 0) < Number(item.qty || 0)
        );
        if (shortageItems.length === 0) {
            alert('Shipment can only be rejected when a shortage is detected.');
            return;
        }

        const reasonInput = window.prompt('Reason for rejection (required):');
        if (reasonInput === null) return;

        const reason = reasonInput.trim();
        if (!reason) {
            alert('Please provide a rejection reason.');
            return;
        }

        if (!window.confirm('Reject this shipment and cancel the entire transaction?')) return;

        setIsRejecting(true);
        const payload = {
            poNumber: selectedPO.po_number,
            rejectedBy: user.email,
            itemsReceived: receivedItems,
            rejectionReason: reason
        };
        const rejectedAt = new Date().toISOString();

        if (isOffline) {
            enqueueOfflineAction('reject', payload);
            updatePOStatusLocally(
                selectedPO.po_number,
                'Transaction Cancelled (Shortage)',
                buildWarehouseRejectionPatch(user.email, rejectedAt, reason)
            );
            alert('📡 OFFLINE MODE: Shipment rejection saved locally and will auto-sync when online.');
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
            setIsRejecting(false);
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/grn/reject`, payload);
            updatePOStatusLocally(
                selectedPO.po_number,
                'Transaction Cancelled (Shortage)',
                buildWarehouseRejectionPatch(user.email, rejectedAt, reason)
            );
            alert('❌ Shipment rejected due to shortage. Transaction canceled.');
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
        } catch (error) {
            console.error(error);
            enqueueOfflineAction('reject', payload);
            updatePOStatusLocally(
                selectedPO.po_number,
                'Transaction Cancelled (Shortage)',
                buildWarehouseRejectionPatch(user.email, rejectedAt, reason)
            );
            alert('Failed to reject shipment online. Rejection saved offline and queued for sync.');
            setSelectedPO(null);
            setViewMode('completed');
            fetchPOs();
        } finally {
            setIsRejecting(false);
        }
    };

    const rawPendingList = pos.filter(po => {
        const status = String(po.status || '');
        const isCompleted = status.includes('Received') || status.includes('Cancelled');
        const isDeliveredToDock = WAREHOUSE_PROCESSABLE_STATUSES.has(status) || po.po_data?.delivery_timestamp;
        return !isCompleted && isDeliveredToDock;
    });

    const pendingList = [...rawPendingList].sort((a, b) => {
        const timeA = a.po_data?.delivery_timestamp ? new Date(a.po_data.delivery_timestamp).getTime() : Infinity;
        const timeB = b.po_data?.delivery_timestamp ? new Date(b.po_data.delivery_timestamp).getTime() : Infinity;
        return timeB - timeA;
    });

    const completedList = pos.filter(po => {
        const status = String(po.status || '');
        return status.includes('Received') || status.includes('Cancelled');
    });
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

    const handleScanSuccess = useCallback((text) => {
        setScanning(false);
        processScanResult(text);
    }, [processScanResult]);

    const handleCloseScanner = useCallback(() => {
        setScanning(false);
    }, []);

    const canClear = selectedPO &&
        (selectedPO.status === 'Goods Received (GRN Logged)' ||
            selectedPO.status === 'Partially Received (Awaiting Backorder)');
    const canRejectForShortage = selectedPO && receivedItems.some(item =>
        item.status === 'Shortage' || Number(item.actualQtyReceived || 0) < Number(item.qty || 0)
    );

    return (
        <div
            className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans flex flex-col transition-colors duration-300 relative"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div
                id="hidden-reader"
                style={{
                    position: 'fixed',
                    left: '-9999px',
                    top: '-9999px',
                    width: '1px',
                    height: '1px',
                    opacity: 0,
                    pointerEvents: 'none'
                }}
            />

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
                    onScanSuccess={handleScanSuccess}
                    onClose={handleCloseScanner}
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

            <div
                className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm shrink-0"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700 shrink-0">
                        <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
                            Nestle<span className="text-blue-500">Warehouse</span>
                        </h1>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                            Logistics Portal
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-4">
                    <button
                        onClick={() => fetchPOs()}
                        className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Force Refresh Data"
                    >
                        <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                    <NotificationBell role="Warehouse" onNavigate={handleNotificationNavigate} />
                    {isOffline ? (
                        <span className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold animate-pulse">
                            <WifiOff className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">Offline</span>
                        </span>
                    ) : (
                        <span className="hidden sm:flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Online
                        </span>
                    )}
                    <div className="w-px h-5 sm:h-6 bg-slate-700 mx-1 sm:mx-2"></div>
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="p-2 sm:p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5 sm:w-4 sm:h-4" /> : <Moon className="w-5 h-5 sm:w-4 sm:h-4" />}
                    </button>
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/40 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors"
                        >
                            <LogOut className="w-4 h-4 shrink-0" /> <span className="hidden sm:block">Exit</span>
                        </button>
                    )}
                </div>
            </div>

            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
            />
            <input
                type="file"
                accept="image/*"
                ref={shortagePhotoInputRef}
                onChange={handleShortagePhotoUpload}
                aria-label="Upload shortage item photo"
                className="hidden"
            />

            <div className="flex-1 px-3 py-4 sm:px-8 sm:py-8 max-w-7xl mx-auto w-full pb-28 sm:pb-8">
                {isSyncing && (
                    <div className="mb-4 bg-blue-500 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> Syncing offline data...
                    </div>
                )}
                {syncQueue.length > 0 && !isOffline && !isSyncing && (
                    <button
                        onClick={syncPendingGRNs}
                        className="mb-4 w-full bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition-colors text-sm"
                    >
                        <RefreshCw className="w-4 h-4 shrink-0" /> {syncQueue.length} pending offline action(s). Tap to sync.
                    </button>
                )}

                <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2 mb-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Truck className="text-blue-500 w-6 h-6 sm:w-8 sm:h-8 shrink-0" /> Dock Logistics
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Manage incoming shipments and completed delivery logs.
                        </p>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending</p>
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-amber-500">{pendingList.length}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Awaiting GRN</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed</p>
                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-emerald-500">{completedList.length}</p>
                        <p className="text-[10px] text-slate-400 mt-1">GRN Logged</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</p>
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                <Truck className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-blue-500">{pos.length}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Shipments</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Offline Queue</p>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${syncQueue.length > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                <WifiOff className="w-4 h-4" />
                            </div>
                        </div>
                        <p className={`text-2xl font-black ${syncQueue.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>{syncQueue.length}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Pending Sync</p>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : !selectedPO ? (
                    <div className="space-y-4">
                        <div className="flex p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit">
                            <button
                                onClick={() => { setViewMode('pending'); setSearchTerm(''); }}
                                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'pending' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                ⏳ Pending ({pendingList.length})
                            </button>
                            <button
                                onClick={() => { setViewMode('completed'); setSearchTerm(''); }}
                                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'completed' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <ArchiveRestore className="w-4 h-4" /> Completed ({completedList.length})
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={`Search ${viewMode === 'pending' ? 'Pending' : 'Completed'} Shipments...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 sm:py-3 text-base sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                />
                                <Search className="absolute left-3 top-3.5 text-slate-400 w-5 h-5 sm:w-4 sm:h-4" />
                            </div>

                            {viewMode === 'pending' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setScanning(true)}
                                        className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-base sm:text-sm flex items-center justify-center gap-2 transition-all bg-slate-800 text-white hover:bg-slate-700 shadow-md"
                                    >
                                        <ScanBarcode className="w-5 h-5 shrink-0" /> Scan
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-base sm:text-sm flex items-center justify-center gap-2 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                    >
                                        <Camera className="w-5 h-5 shrink-0" /> Photo
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPOs.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    No {viewMode} shipments found.
                                </div>
                            ) : (
                                filteredPOs.map(po => {
                                    const status = String(po.status || '');
                                    const isCancelled = status.includes('Cancelled');
                                    const isCompleted = status.includes('Received') || isCancelled;
                                    return (
                                        <div
                                            key={po.id}
                                            onClick={() => !isCompleted && handleSelectPO(po)}
                                            className={`group bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border ${isCompleted ? 'border-emerald-500/50' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl cursor-pointer'} transition-all relative overflow-hidden`}
                                        >
                                            {isCompleted && (
                                                <div className={`absolute inset-0 ${isCancelled ? 'bg-red-50/20' : 'bg-emerald-50/10'} dark:bg-slate-900/50 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-4`}>
                                                    <span className={`${isCancelled ? 'bg-red-600' : 'bg-emerald-500'} text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 shadow-lg w-full justify-center text-sm`}>
                                                        {isCancelled ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />} {isCancelled ? 'CANCELLED' : 'COMPLETED'}
                                                    </span>
                                                    <p className="text-xs text-slate-500 font-bold mt-3 uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1 rounded-full">
                                                        {getShipmentId(po.po_number)}
                                                    </p>
                                                </div>
                                            )}
                                            <div className={`absolute top-0 left-0 w-1.5 h-full ${po.trustScore >= 90 ? 'bg-emerald-500' : po.trustScore >= 75 ? 'bg-blue-500' : 'bg-red-500'} group-hover:w-2 transition-all`}></div>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-black text-lg sm:text-xl text-slate-800 dark:text-white mb-0.5 leading-tight">
                                                        {getShipmentId(po.po_number)}
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-mono mb-2">REF: {po.po_number}</p>
                                                </div>
                                                <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${po.trustScore >= 90 ? 'bg-emerald-100 text-emerald-700' : po.trustScore >= 75 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
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
                                            <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mb-4">{po.supplier_email}</p>
                                            <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold mt-4">
                                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1">
                                                    <Package className="w-3 h-3 shrink-0" /> {po.po_data?.lineItems?.length || 0} Pallets
                                                </span>
                                                {(po.status === 'Delivered to Dock' || po.status === 'Pending Warehouse GRN') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAcknowledgeArrival(po); }}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" /> Acknowledge Arrival
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row overflow-hidden relative">
                        <div className="lg:w-1/3 bg-slate-50 dark:bg-slate-800/30 p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
                            <button
                                onClick={() => setSelectedPO(null)}
                                className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 font-bold mb-4 w-fit"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Queue
                            </button>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <h3 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white break-all pr-2">
                                        {getShipmentId(selectedPO.po_number)}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 mb-2">PO REF: {selectedPO.po_number}</p>
                                </div>
                                <button
                                    onClick={() => setBlindMode(!blindMode)}
                                    className={`h-11 w-11 sm:h-10 sm:w-10 rounded-xl shrink-0 inline-flex items-center justify-center transition-colors ${blindMode ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/50' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                                    title="Toggle Strict Blind Receiving"
                                >
                                    {blindMode ? <EyeOff className="w-5 h-5 sm:w-4 sm:h-4" /> : <Eye className="w-5 h-5 sm:w-4 sm:h-4" />}
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                <p className="text-sm sm:text-xs text-slate-500 font-medium truncate">{selectedPO.supplier_email}</p>
                            </div>

                            {!blindMode && (
                                <div className="mb-6 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase">Received / Expected</span>
                                        <span className="text-lg sm:text-base font-black text-blue-500">
                                            {totalReceived} <span className="text-sm text-slate-400">/ {totalExpected}</span>
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : progressPercent > 100 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                            {blindMode && (
                                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                                    🛡️ <strong>Blind Receiving Active:</strong> Quantities hidden to enforce counting.
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                                <button
                                    onClick={() => setScanning(true)}
                                    className="min-h-12 sm:min-h-11 px-3 text-sm sm:text-sm bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                >
                                    <ScanBarcode className="w-4 h-4 sm:w-5 sm:h-5" /> Scan
                                </button>
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    className="min-h-12 sm:min-h-11 px-3 text-sm sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                >
                                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" /> Photo
                                </button>
                            </div>

                            <div className="hidden lg:block mt-auto space-y-3 pt-4">
                                <button
                                    onClick={submitGRN}
                                    className="w-full min-h-12 px-4 text-base bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                                >
                                    <CheckCircle2 className="w-5 h-5" /> Confirm Goods Received (Sign GRN)
                                </button>
                                {canClear && (
                                    <button
                                        onClick={handleClearGoods}
                                        disabled={isClearing}
                                        className="w-full min-h-12 px-4 text-base bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        {isClearing ? 'Clearing...' : 'Clear Goods for Payout'}
                                    </button>
                                )}
                                {canRejectForShortage && (
                                    <button
                                        onClick={handleRejectShipment}
                                        disabled={isRejecting}
                                        className="w-full min-h-12 px-4 text-base bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                                    >
                                        <AlertCircle className="w-5 h-5" />
                                        {isRejecting ? 'Rejecting...' : 'Reject Shipment (Cancel Transaction)'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="lg:w-2/3 p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[65vh] lg:max-h-[800px]">
                            <div className="space-y-4">
                                {receivedItems.map((item, idx) => {
                                    const isShort = item.status === 'Shortage';
                                    const isOver = item.status === 'Overage';
                                    const isPending = item.status === 'Pending Scan';
                                    const isHighRisk = item.riskLevel === 'High';

                                    return (
                                        <div
                                            key={idx}
                                            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all bg-white dark:bg-slate-950 shadow-sm ${isHighRisk ? 'border-red-500 shadow-lg shadow-red-500/20' : isShort ? 'border-red-500/50' : isOver ? 'border-amber-500/50' : isPending ? 'border-slate-200 dark:border-slate-800' : 'border-emerald-500/30'}`}
                                        >
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-sm leading-tight">
                                                            {item.description}
                                                        </p>
                                                        {isHighRisk && (
                                                            <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shrink-0">
                                                                <AlertCircle className="w-3 h-3" /> High Risk
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs sm:text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                                        Ordered: {blindMode ? '🔒 HIDDEN' : item.qty + ' units'}
                                                    </p>
                                                    <p className="text-[10px] text-blue-400 font-mono mt-1">Barcode: {item.expectedBarcode}</p>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => handleQtyChange(idx, -1)}
                                                        className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-xl font-black text-slate-600 dark:text-slate-300 shadow-sm shrink-0 active:scale-95 transition-transform"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.actualQtyReceived || ''}
                                                        placeholder="0"
                                                        onChange={(e) => handleQtyChange(idx, 0, e.target.value)}
                                                        className={`w-full sm:w-16 min-w-12 text-center font-black text-2xl sm:text-xl bg-transparent outline-none ${isShort ? 'text-red-500' : isOver ? 'text-amber-500' : 'text-emerald-500'}`}
                                                    />
                                                    <button
                                                        onClick={() => handleQtyChange(idx, 1)}
                                                        className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-xl font-black text-slate-600 dark:text-slate-300 shadow-sm shrink-0 active:scale-95 transition-transform"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {item.actualQtyReceived > 0 && (
                                                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                                    <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-3 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <Hash className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                                                        <input
                                                            type="text"
                                                            placeholder="Batch Number"
                                                            value={item.batchNumber}
                                                            onChange={(e) => handleInputChange(idx, 'batchNumber', e.target.value)}
                                                            className="w-full bg-transparent text-base sm:text-sm outline-none dark:text-white font-medium"
                                                        />
                                                    </div>
                                                    <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-3 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <CalendarDays className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                                                        <input
                                                            type="date"
                                                            value={item.expiryDate}
                                                            onChange={(e) => handleInputChange(idx, 'expiryDate', e.target.value)}
                                                            className="w-full bg-transparent text-base sm:text-sm outline-none dark:text-white font-medium text-slate-500"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {isShort && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
                                                    <select
                                                        value={item.reasonCode}
                                                        onChange={(e) => handleInputChange(idx, 'reasonCode', e.target.value)}
                                                        className={`w-full sm:w-auto min-h-11 border text-sm font-bold rounded-lg px-3 py-2 outline-none ${isHighRisk ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'}`}
                                                    >
                                                        <option value="">⚠️ Select Shortage Reason...</option>
                                                        <option value="Missing from Truck">Missing from Truck</option>
                                                        <option value="Damaged in Transit">Damaged in Transit (Rejected)</option>
                                                        <option value="Supplier Backordered">Supplier Backordered</option>
                                                    </select>

                                                    <div className="flex items-center justify-between w-full sm:w-auto sm:ml-auto">
                                                        <button
                                                            onClick={() => openShortagePhotoPicker(idx)}
                                                            className={`min-h-11 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${item.hasPhoto ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                        >
                                                            <Camera className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> {item.hasPhoto ? 'Photo Attached' : 'Add Photo'}
                                                        </button>
                                                        {item.photoFileName && (
                                                            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 ml-2 max-w-[150px] truncate">
                                                                {item.photoFileName}
                                                            </span>
                                                        )}
                                                        <span className="sm:hidden text-[10px] font-black uppercase text-red-600 ml-2">{item.status}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div
                            className="sticky bottom-0 left-0 w-full lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
                            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                        >
                            <button
                                onClick={submitGRN}
                                className="w-full min-h-12 px-4 text-base sm:text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> Confirm Goods Received (Sign GRN)
                            </button>
                            {canClear && (
                                <button
                                    onClick={handleClearGoods}
                                    disabled={isClearing}
                                    className="w-full min-h-12 px-4 text-base sm:text-lg bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 mt-3"
                                >
                                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                                    {isClearing ? 'Clearing...' : 'Clear Goods for Payout'}
                                </button>
                            )}
                            {canRejectForShortage && (
                                <button
                                    onClick={handleRejectShipment}
                                    disabled={isRejecting}
                                    className="w-full min-h-12 px-4 text-base sm:text-lg bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 mt-3"
                                >
                                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                                    {isRejecting ? 'Rejecting...' : 'Reject Shipment (Cancel Transaction)'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <AppNotifier role="Warehouse" />

            <FloatingChat userEmail={user?.email || 'WarehouseOp'} userRole="Warehouse" />
        </div>
    );
}
