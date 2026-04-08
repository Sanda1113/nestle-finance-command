import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Truck, CheckCircle2, AlertCircle, ScanBarcode, ArrowLeft, Camera, Search, EyeOff, Eye, CalendarDays, Hash, ShieldAlert, ShieldCheck, WifiOff, MapPin, RefreshCw } from 'lucide-react';

export default function WarehousePortal({ user }) {
    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPO, setSelectedPO] = useState(null);
    const [receivedItems, setReceivedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [scanning, setScanning] = useState(false);
    const [blindMode, setBlindMode] = useState(true);

    // NEW: Offline & Sync State
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncQueue, setSyncQueue] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Load sync queue from local storage
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
        if (isOffline) { setLoading(false); return; } // Don't fetch if offline
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos');
            const enhancedData = res.data.data.map(po => ({
                ...po, trustScore: po.supplier_email.includes('nestle') ? 98 : Math.floor(Math.random() * (95 - 65 + 1) + 65)
            }));
            setPOs(enhancedData);
            // Save to local storage for offline viewing
            localStorage.setItem('offlinePOs', JSON.stringify(enhancedData));
        } catch (err) {
            console.error(err);
            // Fallback to offline cache
            setPOs(JSON.parse(localStorage.getItem('offlinePOs') || '[]'));
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchPOs(); }, [isOffline]);

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
        } catch (error) {
            console.error("Sync failed", error);
        } finally { setIsSyncing(false); }
    };

    const handleSelectPO = (po) => {
        setSelectedPO(po);
        const expectedItems = po.po_data.lineItems.map(item => ({
            ...item, actualQtyReceived: 0, status: 'Pending Scan', condition: 'Good', reasonCode: '', batchNumber: '', expiryDate: '', hasPhoto: false, riskLevel: 'Low'
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
        const updated = [...receivedItems];
        let newVal = exactVal !== null ? parseFloat(exactVal) : parseFloat(updated[index].actualQtyReceived) + delta;
        if (newVal < 0 || isNaN(newVal)) newVal = 0;

        const expected = parseFloat(updated[index].qty);
        updated[index].actualQtyReceived = newVal;

        if (newVal === 0) { updated[index].status = 'Pending Scan'; updated[index].riskLevel = 'Low'; }
        else if (newVal < expected) {
            updated[index].status = 'Shortage';
            const shortagePercent = ((expected - newVal) / expected) * 100;
            updated[index].riskLevel = shortagePercent > 20 || selectedPO.trustScore < 80 ? 'High' : 'Medium';
        }
        else if (newVal > expected) { updated[index].status = 'Overage'; updated[index].riskLevel = 'Medium'; }
        else { updated[index].status = 'Full Match'; updated[index].riskLevel = 'Low'; }

        setReceivedItems(updated);
    };

    const submitGRN = async () => {
        const unverifiedShortages = receivedItems.filter(i => i.status === 'Shortage' && !i.reasonCode);
        if (unverifiedShortages.length > 0) return alert('⚠️ Strict Audit Mode: Reason Code required for all shortages.');

        let totalAmount = 0;
        let isPartial = false;
        receivedItems.forEach(item => {
            totalAmount += parseFloat(item.actualQtyReceived) * parseFloat(item.unitPrice);
            if (item.status === 'Shortage' || item.status === 'Pending Scan') isPartial = true;
        });

        // NEW: Get GPS Location
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
            // OFFLINE MODE: Save to local queue
            const newQueue = [...syncQueue, payload];
            localStorage.setItem('grnSyncQueue', JSON.stringify(newQueue));
            setSyncQueue(newQueue);
            alert(`📡 OFFLINE MODE: GRN saved locally. Will auto-sync when connection restores.\n📍 GPS Tag: ${gpsLocation}`);
            setSelectedPO(null);
        } else {
            // ONLINE MODE: Send to server
            try {
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/submit', payload);
                alert(`✅ Secure GRN Logged.\n📍 Geo-Tag: ${gpsLocation}`);
                setSelectedPO(null);
                fetchPOs();
            } catch (err) { alert('Failed to log GRN'); }
        }
    };

    const filteredPOs = pos.filter(po => po.po_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalExpected = receivedItems.reduce((sum, item) => sum + parseFloat(item.qty), 0);
    const totalReceived = receivedItems.reduce((sum, item) => sum + parseFloat(item.actualQtyReceived), 0);
    const progressPercent = totalExpected === 0 ? 0 : Math.min(100, Math.round((totalReceived / totalExpected) * 100));

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 font-sans">
            {/* OFFLINE BANNER */}
            {isOffline && (
                <div className="bg-amber-500 text-white p-3 rounded-xl flex items-center justify-center gap-3 font-bold shadow-lg animate-pulse">
                    <WifiOff className="w-5 h-5" />
                    OFFLINE MODE ACTIVE: Operating on local storage. Changes will auto-sync.
                </div>
            )}
            {isSyncing && (
                <div className="bg-blue-500 text-white p-3 rounded-xl flex items-center justify-center gap-3 font-bold shadow-lg">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Connection Restored. Syncing offline data...
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Truck className="text-blue-500 w-8 h-8" /> Dock Receiving
                    </h2>
                    <p className="text-slate-500 mt-1">Audit physical deliveries with predictive risk intelligence.</p>
                </div>
                {syncQueue.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg font-bold text-sm">
                        ⏳ {syncQueue.length} GRNs pending sync
                    </span>
                )}
            </div>

            {loading ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : !selectedPO ? (
                <div className="space-y-6">
                    <div className="flex gap-3 max-w-2xl">
                        <div className="relative flex-1">
                            <input type="text" placeholder="Search PO Number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                            <Search className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredPOs.map(po => (
                            <div key={po.id} onClick={() => handleSelectPO(po)} className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl cursor-pointer transition-all relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-1 h-full ${po.trustScore >= 90 ? 'bg-emerald-500' : po.trustScore >= 75 ? 'bg-blue-500' : 'bg-red-500'} group-hover:w-2 transition-all`}></div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-xl text-slate-800 dark:text-white mb-1">{po.po_number}</h3>
                                    <span className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full ${po.trustScore >= 90 ? 'bg-emerald-100 text-emerald-700' : po.trustScore >= 75 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {po.trustScore >= 90 ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                                        Trust: {po.trustScore}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 font-medium truncate mb-4">{po.supplier_email}</p>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1"><Package className="w-3 h-3" /> {po.po_data?.lineItems?.length || 0} Pallets</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row overflow-hidden">
                    <div className="lg:w-1/3 bg-slate-50 dark:bg-slate-800/30 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
                        <button onClick={() => setSelectedPO(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 font-bold mb-6 w-fit"><ArrowLeft className="w-4 h-4" /> Back</button>

                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{selectedPO.po_number}</h3>
                            <button onClick={() => setBlindMode(!blindMode)} className={`p-2 rounded-lg ${blindMode ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/50' : 'bg-slate-200 text-slate-600'}`} title="Toggle Strict Blind Receiving">
                                {blindMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-8">
                            <p className="text-sm text-slate-500 font-medium">{selectedPO.supplier_email}</p>
                        </div>

                        {!blindMode && (
                            <div className="mb-8 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Received / Expected</span>
                                    <span className="text-lg font-black text-blue-500">{totalReceived} <span className="text-sm text-slate-400">/ {totalExpected}</span></span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                    <div className={`h-3 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : progressPercent > 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                                </div>
                            </div>
                        )}
                        {blindMode && (
                            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-800 dark:text-blue-300 font-medium">
                                🛡️ <strong>Blind Receiving Active:</strong> Expected quantities are hidden to enforce physical counting.
                            </div>
                        )}

                        <div className="mt-auto space-y-3">
                            <button onClick={submitGRN} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                                <MapPin className="w-5 h-5" /> Sign & Lock GRN (Geo-Tagged)
                            </button>
                        </div>
                    </div>

                    <div className="lg:w-2/3 p-6 lg:p-8 overflow-y-auto max-h-[800px]">
                        <div className="space-y-5">
                            {receivedItems.map((item, idx) => {
                                const isShort = item.status === 'Shortage';
                                const isOver = item.status === 'Overage';
                                const isPending = item.status === 'Pending Scan';
                                const isHighRisk = item.riskLevel === 'High';

                                return (
                                    <div key={idx} className={`p-5 rounded-2xl border-2 transition-all bg-white dark:bg-slate-950 ${isHighRisk ? 'border-red-500 shadow-lg shadow-red-500/20' : isShort ? 'border-red-500/50' : isOver ? 'border-amber-500/50' : isPending ? 'border-slate-200 dark:border-slate-800' : 'border-emerald-500/30'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800 dark:text-white text-base leading-tight">{item.description}</p>
                                                    {isHighRisk && <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" /> High Risk</span>}
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Ordered: {blindMode ? '🔒 HIDDEN' : item.qty + ' units'}</p>
                                            </div>

                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                                                <button onClick={() => handleQtyChange(idx, -1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-lg font-black text-slate-600 dark:text-slate-300 shadow-sm">-</button>
                                                <input type="number" value={item.actualQtyReceived || ''} placeholder="0" onChange={(e) => handleQtyChange(idx, 0, e.target.value)} className={`w-16 text-center font-black text-xl bg-transparent outline-none ${isShort ? 'text-red-500' : isOver ? 'text-amber-500' : 'text-emerald-500'}`} />
                                                <button onClick={() => handleQtyChange(idx, 1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-lg font-black text-slate-600 dark:text-slate-300 shadow-sm">+</button>
                                            </div>
                                        </div>

                                        {isShort && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center">
                                                <select value={item.reasonCode} onChange={(e) => handleInputChange(idx, 'reasonCode', e.target.value)} className={`border text-xs font-bold rounded-lg px-3 py-2 outline-none ${isHighRisk ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'}`}>
                                                    <option value="">⚠️ Select Shortage Reason...</option>
                                                    <option value="Missing from Truck">Missing from Truck</option>
                                                    <option value="Damaged in Transit">Damaged in Transit (Rejected)</option>
                                                    <option value="Supplier Backordered">Supplier Backordered</option>
                                                </select>
                                                <span className="ml-auto text-[10px] font-black uppercase text-red-600">{item.status}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}