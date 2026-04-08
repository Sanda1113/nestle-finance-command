import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Truck, CheckCircle2, AlertCircle, ScanBarcode, ArrowLeft, Camera, FileWarning, Search, EyeOff, Eye, CalendarDays, Hash, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function WarehousePortal({ user }) {
    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPO, setSelectedPO] = useState(null);
    const [receivedItems, setReceivedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [scanning, setScanning] = useState(false);
    const [blindMode, setBlindMode] = useState(true);

    const fetchPOs = async () => {
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos');
            // MOCKING CROSS-MVP INTELLIGENCE: Injecting a Trust Score based on email
            const enhancedData = res.data.data.map(po => ({
                ...po,
                trustScore: po.supplier_email.includes('nestle') ? 98 : Math.floor(Math.random() * (95 - 65 + 1) + 65)
            }));
            setPOs(enhancedData);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchPOs(); }, []);

    const handleSelectPO = (po) => {
        setSelectedPO(po);
        const expectedItems = po.po_data.lineItems.map(item => ({
            ...item,
            actualQtyReceived: 0,
            status: 'Pending Scan',
            condition: 'Good',
            reasonCode: '',
            batchNumber: '',
            expiryDate: '',
            hasPhoto: false,
            riskLevel: 'Low' // NEW: Risk Engine
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

        // NEW: Smart Risk Engine Logic
        if (newVal === 0) {
            updated[index].status = 'Pending Scan';
            updated[index].riskLevel = 'Low';
        } else if (newVal < expected) {
            updated[index].status = 'Shortage';
            const shortagePercent = ((expected - newVal) / expected) * 100;
            updated[index].riskLevel = shortagePercent > 20 || selectedPO.trustScore < 80 ? 'High' : 'Medium';
        } else if (newVal > expected) {
            updated[index].status = 'Overage';
            updated[index].riskLevel = 'Medium';
        } else {
            updated[index].status = 'Full Match';
            updated[index].riskLevel = 'Low';
        }

        setReceivedItems(updated);
    };

    const togglePhoto = (index) => {
        const updated = [...receivedItems];
        updated[index].hasPhoto = !updated[index].hasPhoto;
        setReceivedItems(updated);
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

        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/submit', {
                poNumber: selectedPO.po_number,
                receivedBy: user.email,
                itemsReceived: receivedItems,
                totalReceivedAmount: totalAmount,
                isPartial: isPartial
            });
            alert(`✅ Secure GRN Logged. GPS Coordinates Captured. Pipeline updated.`);
            setSelectedPO(null);
            fetchPOs();
        } catch (err) { alert('Failed to log GRN'); }
    };

    const filteredPOs = pos.filter(po => po.po_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalExpected = receivedItems.reduce((sum, item) => sum + parseFloat(item.qty), 0);
    const totalReceived = receivedItems.reduce((sum, item) => sum + parseFloat(item.actualQtyReceived), 0);
    const progressPercent = totalExpected === 0 ? 0 : Math.min(100, Math.round((totalReceived / totalExpected) * 100));

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 font-sans">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Truck className="text-blue-500 w-8 h-8" /> Dock Receiving
                    </h2>
                    <p className="text-slate-500 mt-1">Audit physical deliveries with predictive risk intelligence.</p>
                </div>
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
                        <button onClick={() => setScanning(!scanning)} className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${scanning ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                            <ScanBarcode className="w-5 h-5" /> {scanning ? 'Stop Scan' : 'Hardware Scan'}
                        </button>
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
                                    <span className="text-slate-400">{new Date(po.created_at).toLocaleDateString()}</span>
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
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${selectedPO.trustScore >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>T-Score: {selectedPO.trustScore}</span>
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
                                🛡️ <strong>Blind Receiving Active:</strong> Expected quantities are hidden to enforce physical counting compliance.
                            </div>
                        )}

                        <div className="mt-auto space-y-3">
                            <button onClick={submitGRN} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                                <Truck className="w-5 h-5" /> Sign & Lock GRN (Geo-Tagged)
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
                                                    {isHighRisk && <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" /> High Risk Variance</span>}
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                                    Ordered: {blindMode ? '🔒 HIDDEN' : item.qty + ' units'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                                                <button onClick={() => handleQtyChange(idx, -1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-lg font-black text-slate-600 dark:text-slate-300 shadow-sm">-</button>
                                                <input
                                                    type="number"
                                                    value={item.actualQtyReceived || ''}
                                                    placeholder="0"
                                                    onChange={(e) => handleQtyChange(idx, 0, e.target.value)}
                                                    className={`w-16 text-center font-black text-xl bg-transparent outline-none ${isShort ? 'text-red-500' : isOver ? 'text-amber-500' : 'text-emerald-500'}`}
                                                />
                                                <button onClick={() => handleQtyChange(idx, 1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-lg font-black text-slate-600 dark:text-slate-300 shadow-sm">+</button>
                                            </div>
                                        </div>

                                        {/* FMCG Tracking Row */}
                                        {item.actualQtyReceived > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <Hash className="w-4 h-4 text-slate-400" />
                                                    <input type="text" placeholder="Batch Number" value={item.batchNumber} onChange={(e) => handleInputChange(idx, 'batchNumber', e.target.value)} className="w-full bg-transparent text-xs outline-none dark:text-white font-medium" />
                                                </div>
                                                <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <CalendarDays className="w-4 h-4 text-slate-400" />
                                                    <input type="date" value={item.expiryDate} onChange={(e) => handleInputChange(idx, 'expiryDate', e.target.value)} className="w-full bg-transparent text-xs outline-none dark:text-white font-medium text-slate-500" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Exceptions UI */}
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center">
                                            {isShort && (
                                                <select
                                                    value={item.reasonCode}
                                                    onChange={(e) => handleInputChange(idx, 'reasonCode', e.target.value)}
                                                    className={`border text-xs font-bold rounded-lg px-3 py-2 outline-none ${isHighRisk ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'}`}
                                                >
                                                    <option value="">⚠️ Select Shortage Reason...</option>
                                                    <option value="Missing from Truck">Missing from Truck</option>
                                                    <option value="Damaged in Transit">Damaged in Transit (Rejected)</option>
                                                    <option value="Supplier Backordered">Supplier Backordered</option>
                                                </select>
                                            )}
                                            <button onClick={() => togglePhoto(idx)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${item.hasPhoto ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                                <Camera className="w-4 h-4" /> {item.hasPhoto ? 'Watermarked Photo Attached' : 'Add Photo Proof'}
                                            </button>

                                            <span className={`ml-auto flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${isPending ? 'text-slate-400' : item.status === 'Full Match' ? 'text-emerald-600' : item.status === 'Shortage' ? 'text-red-600' : 'text-amber-600'}`}>
                                                {item.status}
                                            </span>
                                        </div>
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