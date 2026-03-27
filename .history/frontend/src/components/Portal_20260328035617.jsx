import { useState, useEffect } from 'react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

// 🖨️ PDF Generator with Nestle Letterhead
const handlePrintDocument = (docType, docData) => {
    if (!docData) return alert("Document data not available.");
    const printWindow = window.open('', '', 'width=800,height=900');

    const html = `
        <html>
        <head>
            <title>${docType} Document</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; }
                .letterhead { text-align: center; border-bottom: 4px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
                .letterhead h1 { color: #2563eb; font-size: 42px; margin: 0; font-family: Impact, sans-serif; letter-spacing: 2px; }
                .letterhead p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;}
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .header h2 { margin: 0; color: #333; font-size: 24px; text-transform: uppercase; }
                .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .info-box { width: 45%; }
                .info-box h3 { font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px; }
                .info-box p { margin: 5px 0; font-size: 14px; white-space: pre-wrap; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 12px; padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1; }
                td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                .text-right { text-align: right; }
                .summary { width: 50%; float: right; }
                .summary-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
                .summary-total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; margin-top: 5px; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="letterhead">
                <h1>Nestlé</h1>
                <p>Global Procurement & Finance Command Center</p>
                <p style="font-weight:normal; font-size:12px; text-transform:none; letter-spacing:0;">123 Corporate Blvd, Colombo, Sri Lanka</p>
            </div>
            <div class="header">
                <div>
                    <h2>${docType} Extract</h2>
                    <p><strong>Document Number:</strong> ${docData.invoiceNumber || docData.poNumber || 'Generated Data'}</p>
                    <p><strong>Date:</strong> ${docData.invoiceDate || docData.poDate || new Date().toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin:0; color:#1e293b;">Nestle Enterprise</h2>
                </div>
            </div>
            <div class="info-section">
                <div class="info-box">
                    <h3>Vendor Details</h3>
                    <p><strong>${docData.vendorName || 'Unknown'}</strong><br/>${docData.vendorAddress || 'No Address Provided'}</p>
                </div>
                <div class="info-box">
                    <h3>Billing Details</h3>
                    <p>${docData.billTo || 'Nestle Finance Command Center'}</p>
                </div>
            </div>
            <table>
                <thead><tr><th>Qty</th><th>Description</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
                <tbody>
                    ${(docData.lineItems || []).map(item => `<tr><td>${item.qty}</td><td>${item.description}</td><td class="text-right">${formatCurrency(item.unitPrice, docData.currency)}</td><td class="text-right">${formatCurrency(item.amount, docData.currency)}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="summary">
                <div class="summary-row"><span>Subtotal:</span> <span>${formatCurrency(docData.subtotal, docData.currency)}</span></div>
                <div class="summary-row"><span>Taxes:</span> <span>${formatCurrency(docData.salesTax, docData.currency)}</span></div>
                <div class="summary-row summary-total"><span>Total Amount:</span> <span>${formatCurrency(docData.totalAmount, docData.currency)}</span></div>
            </div>
            <p style="margin-top: 40px; clear:both; text-align: center; color: #94a3b8; font-size: 12px;">Digitally Extracted by Nestle AI System</p>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
};

export default function Portal({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('procurement');
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <div className="md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-10 shrink-0">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-black text-white tracking-tight">Nestle<span className="text-blue-500">Finance</span></h1>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Admin: {user.id?.slice(0, 8) || user.email}</p>
                </div>

                <div className="flex-grow py-6 flex flex-col gap-2 px-4 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-500 uppercase px-4 mb-2">Dashboards</p>
                    <button onClick={() => setActiveTab('procurement')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'procurement' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        🛒 Procurement (BOQ)
                    </button>
                    <button onClick={() => setActiveTab('finance')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'finance' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        📋 Review Queue
                    </button>
                    <button onClick={() => setActiveTab('analytics')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        📈 Analytics
                    </button>
                </div>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-white transition-colors">
                        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </button>
                    <button onClick={onLogout} className="w-full py-2 bg-red-900/40 hover:bg-red-600 border border-red-800 rounded-lg text-sm font-bold text-white transition-colors">
                        🚪 Secure Logout
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 md:p-8">
                {activeTab === 'procurement' && <ProcurementPortal />}
                {activeTab === 'finance' && <FinancePortal />}
                {activeTab === 'analytics' && <AnalyticsPortal />}
            </div>
        </div>
    );
}

function ProcurementPortal() {
    const [boqs, setBoqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [supplierFilter, setSupplierFilter] = useState('All');
    const [processingBoqs, setProcessingBoqs] = useState({});

    const fetchBoqs = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs');
            setBoqs(res.data.data || []);
        } catch (err) { console.error(err); }
        finally { if (showLoading) setLoading(false); }
    };

    useEffect(() => {
        fetchBoqs(true);
        const interval = setInterval(() => fetchBoqs(false), 1000);
        return () => clearInterval(interval);
    }, []);

    const generatePO = async (id) => {
        setProcessingBoqs(prev => ({ ...prev, [id]: true }));
        try {
            const res = await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/generate-po`);
            if (res.data.success) {
                alert(`✅ Success! Generated PO Number: ${res.data.poNumber}\nRouted directly to Supplier Inbox.`);
            }
        } catch (err) { alert("Failed to generate PO."); }
    };

    const rejectBOQ = async (id) => {
        const reason = window.prompt("Reason for rejection (e.g., Not enough stock, Pricing incorrect):");
        if (!reason) return;
        setProcessingBoqs(prev => ({ ...prev, [id]: true }));
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/reject`, { reason });
        } catch (err) { alert("Failed to reject BOQ."); }
    };

    const uniqueSuppliers = [...new Set(boqs.map(b => b.supplier_email).filter(Boolean))];

    const filteredBoqs = boqs.filter(b => {
        if (filter === 'Approved' && !b.status.includes('PO Generated')) return false;
        if (filter === 'Pending' && b.status !== 'Pending Review') return false;
        if (filter === 'Rejected' && b.status !== 'Rejected') return false;
        if (supplierFilter !== 'All' && b.supplier_email !== supplierFilter) return false;
        return true;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Procurement Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">Review supplier BOQs and automatically dispatch Official POs.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                        <option value="All">All Suppliers Emails</option>
                        {uniqueSuppliers.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                    </select>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending Review</option>
                        <option value="Approved">Approved (PO Sent)</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Loading Supplier Quotes...</div>
                ) : filteredBoqs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">No BOQs match this filter.</div>
                ) : (
                    filteredBoqs.map(boq => {
                        const isApproved = boq.status.includes('PO Generated');
                        const isRejected = boq.status === 'Rejected';
                        const isProcessing = processingBoqs[boq.id];

                        return (
                            <div key={boq.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-6 md:w-1/3 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Quote Submitted By</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-white mb-1">{boq.vendor_name}</p>
                                        <p className="text-xs text-slate-500 mb-4 font-mono">Email: {boq.supplier_email}</p>

                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Value:</p>
                                        <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-4">{formatCurrency(boq.total_amount, boq.currency)}</p>

                                        {isApproved ? (
                                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">✅ PO Dispatched</p>
                                            </div>
                                        ) : isRejected ? (
                                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800/50">
                                                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">❌ Rejected</p>
                                                <p className="text-xs text-red-800 dark:text-red-300">Reason: {boq.rejection_reason}</p>
                                            </div>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-700">Pending Review</span>
                                        )}
                                        <p className="text-xs text-slate-400 mt-4">Uploaded: {new Date(boq.created_at).toLocaleString()}</p>
                                    </div>

                                    {!isApproved && !isRejected && (
                                        <div className="mt-6 flex gap-2">
                                            <button onClick={() => generatePO(boq.id)} disabled={isProcessing} className="flex-1 py-3 bg-slate-800 dark:bg-blue-600 hover:bg-black disabled:bg-slate-500 text-white font-black rounded-xl transition-colors">
                                                {isProcessing ? 'Processing...' : '⚡ Approve'}
                                            </button>
                                            <button onClick={() => rejectBOQ(boq.id)} disabled={isProcessing} className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 disabled:bg-slate-200 text-red-600 hover:bg-red-200 font-black rounded-xl transition-colors">
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 md:w-2/3 flex flex-col">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Extracted Line Items</h4>
                                    </div>
                                    <div className="overflow-y-auto max-h-48 border border-slate-100 dark:border-slate-700 rounded-lg">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                                <tr><th className="p-3 font-bold text-slate-500">Qty</th><th className="p-3 font-bold text-slate-500">Item</th><th className="p-3 font-bold text-slate-500 text-right">Unit Price</th><th className="p-3 font-bold text-slate-500 text-right">Total</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {boq.line_items && boq.line_items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                        <td className="p-3 text-slate-700 dark:text-slate-300">{item.qty}</td>
                                                        <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{item.description}</td>
                                                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.unitPrice, boq.currency)}</td>
                                                        <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(item.amount, boq.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function FinancePortal() {
    const [records, setRecords] = useState([]);
    const [boqs, setBoqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [expandedRow, setExpandedRow] = useState(null);

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [recRes, boqRes] = await Promise.all([
                axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations'),
                axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs')
            ]);
            setRecords(recRes.data.data || []);
            setBoqs(boqRes.data.data || []);
        } catch (err) { console.error(err); }
        finally { if (showLoading) setLoading(false); }
    };

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleManualOverride = async (id, decision) => {
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/reconciliations/${id}`, { newStatus: decision });
            fetchData(false);
        } catch (err) { alert("Failed to update status."); }
    };

    const filteredRecords = records.filter(r => {
        if (filter === 'All') return true;
        if (filter === 'Pending' && r.match_status.includes('Reject')) return true;
        if (filter === 'Approved' && r.match_status === 'Approved') return true;
        return false;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Finance Review Queue</h2>
                    <p className="text-slate-500 dark:text-slate-400">Expand rows to view 3-Way Match documents and resolve discrepancies.</p>
                </div>
                <div className="flex gap-2">
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                        <option value="All">All Documents</option>
                        <option value="Pending">Needs Review (Discrepancy)</option>
                        <option value="Approved">Approved</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Fetching Secure Database Records...</div>
                ) : (
                    <table className="w-full text-left text-sm min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Date</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Vendor</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Invoice / PO</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Inv Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">PO Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Status</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredRecords.map((r) => {
                                // 🚀 FIXED: Prevent locking out newly added Discrepancies by strictly checking timeline_status
                                const isActioned = r.match_status === 'Approved' || r.timeline_status === 'Rejected by Finance';

                                const relatedBoq = boqs.find(b => b.status.includes(r.po_number));

                                return (
                                    <>
                                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4 font-mono text-xs text-slate-400">{new Date(r.processed_at).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200 cursor-pointer" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                                                {r.vendor_name || 'Unknown'} <span className="text-blue-500 ml-2 text-xs">👁️ View 3-Way Match</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">{r.invoice_number}</div>
                                                <div className="text-purple-600 dark:text-purple-400 font-medium text-xs">{r.po_number}</div>
                                            </td>
                                            <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.invoice_total}</td>
                                            <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.po_total}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${r.match_status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {r.match_status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button onClick={() => handleManualOverride(r.id, 'Approved')} disabled={isActioned} className={`px-3 py-1 font-bold rounded text-xs transition-colors ${isActioned ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300'}`}>Approve</button>
                                                <button onClick={() => handleManualOverride(r.id, 'Rejected')} disabled={isActioned} className={`px-3 py-1 font-bold rounded text-xs transition-colors ${isActioned ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-600 dark:text-slate-300'}`}>Reject</button>
                                            </td>
                                        </tr>
                                        {/* 🚀 EXTANDED ROW: 3-Way Match Document Viewer */}
                                        {expandedRow === r.id && (
                                            <tr className="bg-slate-50 dark:bg-slate-800/20">
                                                <td colSpan="7" className="p-6 border-b border-slate-200 dark:border-slate-800">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                                        {/* Original BOQ Column */}
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-sm">
                                                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                                                                <h4 className="font-bold text-blue-700 dark:text-blue-400">1. Original Quote (BOQ)</h4>
                                                                {relatedBoq ?
                                                                    <button onClick={() => handlePrintDocument('Original Quote / BOQ', { ...relatedBoq, lineItems: relatedBoq.line_items, invoiceNumber: relatedBoq.document_number, totalAmount: relatedBoq.total_amount })} className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-lg">📥 PDF</button>
                                                                    : <span className="text-xs text-slate-400">Not Found</span>}
                                                            </div>
                                                            <p className="text-sm"><strong>Quote Total:</strong> {relatedBoq ? `$${relatedBoq.total_amount}` : 'N/A'}</p>
                                                        </div>

                                                        {/* Purchase Order Column */}
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-sm">
                                                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                                                                <h4 className="font-bold text-purple-700 dark:text-purple-400">2. Purchase Order</h4>
                                                                <button onClick={() => handlePrintDocument('Purchase Order', r.po_data)} className="text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 px-3 py-1 rounded-lg">📥 PDF</button>
                                                            </div>
                                                            <p className="text-sm"><strong>PO Total:</strong> ${r.po_total}</p>
                                                        </div>

                                                        {/* Invoice Column */}
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                                                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                                                                <h4 className="font-bold text-emerald-700 dark:text-emerald-400">3. Final Invoice</h4>
                                                                <button onClick={() => handlePrintDocument('Invoice Data Extract', r.invoice_data)} className="text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded-lg">📥 PDF</button>
                                                            </div>
                                                            <p className="text-sm"><strong>Inv Total:</strong> ${r.invoice_total}</p>
                                                            <p className="text-sm mt-2"><strong>Variance vs PO:</strong> <span className={r.invoice_total === r.po_total ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>${Math.abs(r.invoice_total - r.po_total).toFixed(2)}</span></p>
                                                        </div>

                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function AnalyticsPortal() {
    const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, value: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async (showLoading = true) => {
            if (showLoading) setLoading(true);
            try {
                const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
                const data = res.data.data || [];
                const approved = data.filter(r => r.match_status === 'Approved').length;
                const rejected = data.filter(r => r.match_status && r.match_status.includes('Reject')).length;
                const totalValue = data.reduce((acc, curr) => acc + (Number(curr.invoice_total) || 0), 0);
                setStats({ total: data.length, approved, rejected, value: totalValue });
            } catch (err) { console.error(err); } finally { if (showLoading) setLoading(false); }
        };

        fetchStats(true);
        const interval = setInterval(() => fetchStats(false), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Platform Analytics</h2>
                <p className="text-slate-500 dark:text-slate-400">High-level view of AI throughput and financial processing.</p>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Calculating Live Metrics...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Documents</p>
                        <p className="text-5xl font-black text-blue-600 dark:text-blue-400">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Auto-Approval Rate</p>
                        <p className="text-5xl font-black text-emerald-500 dark:text-emerald-400">
                            {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-500 mt-2 font-medium">{stats.approved} Approved / {stats.rejected} Rejected</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Value Processed</p>
                        <p className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-2">${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            )}
        </div>
    );
}