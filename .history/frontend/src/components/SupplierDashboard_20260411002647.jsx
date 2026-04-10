import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DisputeChat from './DisputeChat';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = poNum.match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${poNum.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('inbox');
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [myPOs, setMyPOs] = useState([]);
    const [myLogs, setMyLogs] = useState([]);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    const [expandedLog, setExpandedLog] = useState(null);

    const fetchPOs = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`);
            setMyPOs(res.data.data || []);
        } catch (err) { console.error("Failed to fetch POs"); }
    };

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/logs/${user.email}`);
            setMyLogs(res.data.logs || []);
        } catch (err) { console.error("Failed to fetch logs"); }
    };

    useEffect(() => {
        if (mode === 'inbox') fetchPOs();
        if (mode === 'logs') fetchLogs();
        const interval = setInterval(() => {
            if (mode === 'inbox') fetchPOs();
            if (mode === 'logs') fetchLogs();
        }, 500); // ⚡ 0.5s REFRESH
        return () => clearInterval(interval);
    }, [mode, user.email]);

    const handleMatchUpload = async () => {
        if (!invoiceFile || !poFile) { setError("Upload both files."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');
        setInvoiceResult(null); setPoResult(null);

        const invForm = new FormData(); invForm.append('invoiceFile', invoiceFile);
        const poForm = new FormData(); poForm.append('invoiceFile', poFile);

        try {
            const [invRes, poRes] = await Promise.all([
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invForm),
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poForm)
            ]);

            if (invRes.data.success && poRes.data.success) {
                const invData = invRes.data.extractedData;
                const poData = poRes.data.extractedData;
                setInvoiceResult(invData); setPoResult(poData);

                let status = 'Rejected';
                if (invData.totalAmount > 0 && poData.totalAmount > 0 && invData.totalAmount === poData.totalAmount) status = 'Approved';
                setMatchStatus(status);
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                    invoiceData: invData, poData: poData, matchStatus: status, supplierEmail: user.email
                });
                setDbStatus('Saved to Ledger. Timeline updated.');
            }
        } catch (err) { setError("Processing failed."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handleBoqUpload = async () => {
        if (!boqFile) { setError("Please select a BOQ file."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');
        setResultData(null);

        const boqForm = new FormData(); boqForm.append('invoiceFile', boqFile);

        try {
            const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', boqForm);
            if (res.data.success) {
                const data = res.data.extractedData;
                setResultData(data);
                setMatchStatus('Submitted');
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-boq', {
                    boqData: data, supplierEmail: user.email, vendorId: user.id || user.email
                });
                setDbStatus('Sent to Procurement Team');
            }
        } catch (err) { setError("Processing failed."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handlePrintPO = async (po) => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const poData = po.po_data;
        const html = `
            <html>
            <head>
                <title>PO ${poData.poNumber}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 30px; font-size: 13px; }
                    .letterhead { text-align: center; border-bottom: 3px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; }
                    .letterhead h1 { color: #2563eb; font-size: 32px; margin: 0; font-family: Impact, sans-serif; letter-spacing: 1px; }
                    .letterhead p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-box { width: 45%; }
                    .info-box h3 { font-size: 11px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
                    .info-box p { margin: 4px 0; white-space: pre-wrap; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 10px; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
                    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                    .text-right { text-align: right; }
                    .summary { width: 40%; float: right; }
                    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
                    .summary-total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; margin-top: 5px; padding-top: 8px; }
                </style>
            </head>
            <body>
                <div class="letterhead"><h1>Nestlé</h1><p>Global Procurement Center</p></div>
                <div class="header">
                    <div><h2 style="margin:0; font-size: 20px;">Purchase Order</h2><p><strong>PO #:</strong> ${poData.poNumber} <br/> <strong>Date:</strong> ${poData.poDate}</p></div>
                </div>
                <div class="info-section">
                    <div class="info-box"><h3>Buyer</h3><p>${poData.buyerCompany}</p></div>
                    <div class="info-box"><h3>Supplier</h3><p>${poData.supplierDetails}</p></div>
                </div>
                <table>
                    <thead><tr><th>Qty</th><th>Description</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
                    <tbody>
                        ${poData.lineItems.map(item => `<tr><td>${item.qty}</td><td>${item.description}</td><td class="text-right">${formatCurrency(item.unitPrice, poData.currency)}</td><td class="text-right">${formatCurrency(item.amount, poData.currency)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="summary">
                    <div class="summary-row"><span>Subtotal:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                    <div class="summary-row"><span>Taxes:</span> <span>$0.00</span></div>
                    <div class="summary-row summary-total"><span>Total Payable:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);

        if (!po.is_downloaded) {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/purchase_orders/${po.id}/downloaded`);
            fetchPOs();
        }
    };

    const handleResubmit = async (id) => {
        const realId = id.replace('rec-', '');
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/sprint2/reconciliations/${realId}/resubmit`);
            alert('Document removed from review queue. You can now submit a corrected invoice.');
            setMode('match');
            fetchLogs();
        } catch (e) { alert('Failed to clear for resubmission'); }
    };

    const handleMarkDelivered = async (poNumber) => {
        if (!window.confirm("Are you physically at the Nestle Dock or confirming handover to the carrier?")) return;
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/supplier/mark-delivered', { poNumber });
            alert("✅ Status Updated: The Warehouse Dock has been notified of your arrival.");
            fetchPOs();
        } catch (e) { alert('Failed to update delivery status.'); }
    };

    const totalPOs = myPOs.length;
    const totalPOValue = myPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);
    const pendingPOs = myPOs.filter(po => !po.is_downloaded).length;
    const recentLogs = [...myLogs].slice(0, 3);
    const totalMatched = myLogs.filter(log => log.status?.includes('Approve')).length;

    const filteredPOs = useMemo(() => {
        if (!searchTerm) return myPOs;
        return myPOs.filter(po =>
            po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            formatCurrency(po.total_amount, po.po_data?.currency).includes(searchTerm)
        );
    }, [myPOs, searchTerm]);

    const DocumentCard = ({ title, data, borderColor, themeColor }) => {
        if (!data) return null;
        const currency = data.currency || 'USD';
        return (
            <div className={`bg-slate-900 rounded-xl shadow-sm border-t-[3px] ${borderColor} flex flex-col transition-all hover:shadow-md`}>
                <div className="bg-slate-800/50 p-3.5 border-b border-slate-800">
                    <h3 className="font-bold text-slate-100 text-sm tracking-tight">{title}</h3>
                </div>
                <div className="p-4 grow flex flex-col text-sm">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Vendor Name</p>
                            <p className="font-medium text-slate-200 truncate">{data.vendorName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Doc #</p>
                            <p className="font-medium text-slate-200 truncate">{data.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Date</p>
                            <p className="text-slate-300">{data.invoiceDate}</p>
                        </div>
                    </div>
                    <div className="mb-4 grow">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Line Items</h4>
                        {data.lineItems?.length > 0 ? (
                            <div className="overflow-x-auto rounded border border-slate-700 max-h-40">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                        <tr><th className="px-2 py-1.5 font-semibold w-10">Qty</th><th className="px-2 py-1.5 font-semibold">Item</th><th className="px-2 py-1.5 font-semibold text-right">Price</th><th className="px-2 py-1.5 font-semibold text-right">Total</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {data.lineItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30">
                                                <td className="px-2 py-1.5 text-slate-400">{item.qty}</td>
                                                <td className="px-2 py-1.5 text-slate-200 truncate max-w-[120px]">{item.description}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-400">{formatCurrency(item.unitPrice, currency)}</td>
                                                <td className="px-2 py-1.5 text-right font-medium text-slate-200">{formatCurrency(item.amount, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<p className="text-xs text-slate-400 italic">No items detected.</p>)}
                    </div>
                    <div className="mt-auto border-t border-slate-800 pt-3">
                        <div className="flex justify-between font-bold text-base">
                            <span className="text-slate-200">TOTAL:</span>
                            <span className={themeColor}>{formatCurrency(data.totalAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dark">
            <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
                {/* Header */}
                <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 px-6 flex flex-wrap justify-between items-center sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700">
                            <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Nestle<span className="text-slate-200">Supplier</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                {user.name?.[0] || user.email[0].toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-300 hidden sm:block">{user.name || user.email}</span>
                        </div>
                        <button onClick={onLogout} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-300 rounded-full text-xs font-semibold transition-all flex items-center gap-1">🚪 Logout</button>
                    </div>
                </div>

                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Shipments</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400">📦</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Value</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalPOValue)}</p>
                                </div>
                                <div className="w-10 h-10 bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-400">💰</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Pending</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{pendingPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-amber-900/30 rounded-full flex items-center justify-center text-amber-400">⏳</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Matched Invoices</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalMatched}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400">✅</div>
                            </div>
                        </div>
                    </div>

                    {/* Main grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Tabs */}
                            <div className="flex flex-wrap gap-2 bg-slate-900/60 backdrop-blur-sm p-1.5 rounded-xl border border-slate-800">
                                {[
                                    { id: 'inbox', label: '📥 Shipments', color: 'purple' },
                                    { id: 'boq', label: '📑 1. Submit Quote', color: 'blue' },
                                    { id: 'match', label: '⚖️ 2. Submit Inv+PO', color: 'emerald' },
                                    { id: 'logs', label: '📜 Timeline', color: 'amber' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setMode(tab.id); setMatchStatus('Pending'); setError(null); setExpandedLog(null); }}
                                        className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === tab.id
                                            ? `bg-linear-to-r from-${tab.color}-600 to-${tab.color}-700 text-white shadow-md`
                                            : 'text-slate-400 hover:bg-slate-800'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'inbox' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">Active Shipments</h2>
                                            <p className="text-sm text-slate-400">Manage dispatches and notify the Nestle Dock.</p>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search Shipment #..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 pr-3 py-1.5 text-sm border border-slate-700 rounded-lg bg-slate-800 focus:ring-2 focus:ring-purple-500 text-slate-200"
                                            />
                                            <span className="absolute left-3 top-2 text-slate-400">🔍</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredPOs.length === 0 ?
                                            <p className="col-span-full text-sm text-slate-400 p-8 bg-slate-900 rounded-xl border border-slate-800 text-center">No orders found.</p>
                                            : filteredPOs.map(po => {
                                                const isDelivered = po.status === 'Delivered to Dock' || po.status.includes('Received') || po.po_data?.delivery_timestamp;
                                                const isChatOpen = expandedLog === po.id;

                                                return (
                                                    <div key={po.id} className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col hover:shadow-lg transition-all group overflow-hidden">
                                                        <div className="p-4">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <p className="text-lg font-black text-slate-100">{getShipmentId(po.po_number)}</p>
                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">PO: {po.po_number}</p>
                                                                </div>
                                                                {po.is_downloaded ?
                                                                    <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-500/20 rounded-full text-[10px] font-bold">Downloaded</span>
                                                                    : <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 ring-1 ring-blue-500/20 animate-pulse rounded-full text-[10px] font-bold">New</span>
                                                                }
                                                            </div>
                                                            <p className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(po.total_amount, po.po_data?.currency)}</p>

                                                            <div className="flex flex-wrap gap-2 mt-4">
                                                                <button onClick={() => handlePrintPO(po)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${po.is_downloaded ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-linear-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-sm'}`}>
                                                                    📄 PDF
                                                                </button>

                                                                {!isDelivered ? (
                                                                    <button onClick={() => handleMarkDelivered(po.po_number)} className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 text-white shadow-sm border border-amber-500">
                                                                        🚚 Mark Delivered
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                                                                        ✅ At Dock
                                                                    </div>
                                                                )}

                                                                {/* 💬 NEW: LIVE CHAT BUTTON */}
                                                                <button onClick={() => setExpandedLog(isChatOpen ? null : po.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${isChatOpen ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                                                                    💬 Chat
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Embedded Chat for Shipments */}
                                                        {isChatOpen && (
                                                            <div className="border-t border-slate-800 bg-slate-950 p-4">
                                                                <DisputeChat
                                                                    referenceNumber={po.po_number}
                                                                    userRole="Supplier"
                                                                    userEmail={user.email}
                                                                    contextData={{ status: po.status || 'Dispatched', type: 'Purchase Order/Shipment' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                            )}

                            {mode === 'boq' && (
                                <div className="max-w-2xl animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Submit Quote</h2>
                                        <p className="text-sm text-slate-400">Upload BOQ to generate an Official PO.</p>
                                    </div>
                                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setBoqFile(e.target.files[0])}
                                                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-800/50 cursor-pointer" />
                                            <p className="text-xs text-slate-400 mt-2">Supported: PDF, Images, Excel</p>
                                        </div>
                                        <button onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full mt-5 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                                            {loading ? "Digitizing..." : "Submit Quote"}
                                        </button>
                                    </div>
                                    {matchStatus === 'Submitted' && resultData && (
                                        <div className="mt-6">
                                            <div className="p-3 mb-4 bg-emerald-900/30 border border-emerald-800 rounded-lg text-sm text-emerald-300 text-center font-medium flex items-center justify-center gap-2">✅ Sent to Procurement Team</div>
                                            <DocumentCard title="Digitized Extract" data={resultData} borderColor="border-blue-500" themeColor="text-blue-400" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'match' && (
                                <div className="max-w-3xl animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Invoice Clearance</h2>
                                        <p className="text-sm text-slate-400">Upload Invoice and PO for 3-Way Match.</p>
                                    </div>
                                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">📄 Invoice</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setInvoiceFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-blue-900/50 file:text-blue-300 cursor-pointer border border-slate-700 rounded-md p-1.5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">📑 PO</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setPoFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-purple-900/50 file:text-purple-300 cursor-pointer border border-slate-700 rounded-md p-1.5" />
                                        </div>
                                    </div>
                                    <button onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg mt-4 disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                                        {loading ? "Matching..." : "Submit Documents"}
                                    </button>

                                    {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                                        <div className="mt-6">
                                            <div className={`p-3 mb-4 rounded-lg text-sm text-center font-medium border ${matchStatus === 'Approved' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300' : 'bg-amber-900/30 border-amber-800 text-amber-300'}`}>
                                                {matchStatus === 'Approved' ? '✅ Perfect Match' : '⚠️ Discrepancy Routed for Review'}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <DocumentCard title="Invoice Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-400" />
                                                <DocumentCard title="PO Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'logs' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Lifecycle Timeline</h2>
                                        <p className="text-sm text-slate-400">Real-time status tracking.</p>
                                    </div>
                                    <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-5">
                                        {myLogs.length === 0 ? <p className="text-center text-sm text-slate-400 py-4">No activity yet.</p> : (
                                            <div className="relative border-l-2 border-slate-800 ml-3 space-y-6 pb-2">
                                                {myLogs.map((log) => {
                                                    let liveStatus = log.status;

                                                    // 🛡️ DYNAMIC LIFECYCLE STATUS OVERRIDE
                                                    if (log.type.includes('Match') || log.type.includes('Reconciliation')) {
                                                        const relatedPO = myPOs.find(p => p.po_number === log.ref);
                                                        const isReceived = relatedPO && relatedPO.status && relatedPO.status.includes('Received');
                                                        if (!isReceived && liveStatus.includes('Approve')) {
                                                            liveStatus = 'Pending Warehouse GRN';
                                                        } else if (isReceived && liveStatus.includes('Approve')) {
                                                            liveStatus = 'Approved - Awaiting Payout';
                                                        }
                                                    }

                                                    if (log.type.includes('BOQ')) {
                                                        const rejectLog = myLogs.find(l => l.ref === log.ref && l.status.includes('Reject'));
                                                        if (rejectLog) liveStatus = 'Rejected';
                                                    }

                                                    const hasDispute = liveStatus?.includes('Reject') || liveStatus?.includes('Discrepancy');

                                                    return (
                                                        <div key={log.id} className="relative pl-5">
                                                            <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-slate-900 ${liveStatus?.includes('Approve') || liveStatus?.includes('Generated') || liveStatus === 'Downloaded' ? 'bg-emerald-500' :
                                                                hasDispute ? 'bg-red-500' : 'bg-blue-500'
                                                                }`}></div>
                                                            <div className="flex flex-col">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <h3 className="text-sm font-bold text-slate-100">{log.action} <span className="text-slate-400 font-normal">({log.type})</span></h3>
                                                                        <p className="text-xs text-blue-400 font-mono mt-0.5">
                                                                            {log.type.includes('PO') || log.type.includes('Match') ? getShipmentId(log.ref) : log.ref}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right flex flex-col items-end gap-2">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset ${liveStatus?.includes('Approve') || liveStatus?.includes('Generated') || liveStatus === 'Downloaded' ? 'bg-emerald-900/50 text-emerald-400 ring-emerald-500/20' :
                                                                            hasDispute ? 'bg-red-900/50 text-red-400 ring-red-500/20' : 'bg-amber-900/50 text-amber-400 ring-amber-500/20'
                                                                            }`}>{liveStatus}</span>

                                                                        <button
                                                                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                                            className="text-[10px] font-bold underline text-amber-400 hover:text-amber-300"
                                                                        >
                                                                            {expandedLog === log.id ? 'Close Chat' : '💬 View Chat'}
                                                                        </button>

                                                                        <p className="text-[10px] text-slate-400">{new Date(log.date).toLocaleString()}</p>
                                                                    </div>
                                                                </div>

                                                                {expandedLog === log.id && (
                                                                    <div className="mt-4 border-t border-slate-800 pt-4">
                                                                        <DisputeChat
                                                                            referenceNumber={log.ref}
                                                                            userRole="Supplier"
                                                                            userEmail={user.email}
                                                                            onResubmit={() => handleResubmit(log.id)}
                                                                            contextData={{ status: liveStatus, type: log.type, action: log.action }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar Widgets */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-lg mb-3">⚡ Quick Actions</h3>
                                <div className="space-y-2">
                                    <button onClick={() => { setMode('boq'); setBoqFile(null); }} className="w-full py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2">📤 Submit Quote</button>
                                    <button onClick={() => { setMode('match'); setInvoiceFile(null); setPoFile(null); }} className="w-full py-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2">🔗 Match Invoice & PO</button>
                                    <button onClick={() => { setMode('logs'); }} className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2">📜 View Timeline</button>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-lg mb-3">🕒 Recent Activity</h3>
                                {recentLogs.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">No recent activity</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recentLogs.map(log => (
                                            <div key={log.id} className="flex items-start gap-2 text-sm border-b border-slate-800 pb-2 last:border-0">
                                                <div className="w-6 text-center">
                                                    {log.status?.includes('Approve') ? '✅' : log.status?.includes('Reject') ? '❌' : '⏳'}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-200 text-xs">{log.action}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(log.date).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pendingPOs > 0 && (
                                <div className="bg-linear-to-br from-amber-900/30 to-orange-900/30 rounded-xl border border-amber-800 p-5 shadow-sm">
                                    <h3 className="font-bold text-amber-300 flex items-center gap-2 text-lg mb-2">⚠️ Attention Needed</h3>
                                    <p className="text-amber-200">You have {pendingPOs} unread Shipment(s). Download them to proceed.</p>
                                    <button onClick={() => setMode('inbox')} className="mt-3 text-xs font-bold text-amber-300 underline">View Shipments →</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}