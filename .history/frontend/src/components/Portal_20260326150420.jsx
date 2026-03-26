import { useState, useEffect } from 'react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null) return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
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
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">User: {user.id?.slice(0, 8) || user.email}</p>
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

    const fetchBoqs = async () => {
        setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs');
            setBoqs(res.data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchBoqs(); }, []);

    const generatePO = async (id) => {
        try {
            const res = await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/generate-po`);
            if (res.data.success) {
                alert(`✅ Success! Generated PO Number: ${res.data.poNumber}\nRouted directly to Supplier Inbox.`);
                fetchBoqs();
            }
        } catch (err) { alert("Failed to generate PO."); }
    };

    const rejectBOQ = async (id) => {
        const reason = window.prompt("Reason for rejection (e.g., Not enough stock, Pricing incorrect):");
        if (!reason) return;
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/reject`, { reason });
            fetchBoqs();
        } catch (err) { alert("Failed to reject BOQ."); }
    };

    const filteredBoqs = boqs.filter(b => {
        if (filter === 'All') return true;
        if (filter === 'Approved' && b.status.includes('PO Generated')) return true;
        if (filter === 'Pending' && b.status === 'Pending Review') return true;
        if (filter === 'Rejected' && b.status === 'Rejected') return true;
        return false;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Procurement Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">Review supplier BOQs and automatically dispatch Official POs.</p>
                </div>
                <div className="flex gap-2">
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                        <option value="All">All Categories</option>
                        <option value="Pending">Pending Review</option>
                        <option value="Approved">Approved (PO Sent)</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                    <button onClick={fetchBoqs} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow">
                        🔄 Refresh
                    </button>
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

                        return (
                            <div key={boq.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-6 md:w-1/3 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Quote Submitted By</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-white mb-1">{boq.vendor_name}</p>
                                        <p className="text-xs text-slate-500 mb-4 font-mono">ID: {boq.vendor_id || boq.supplier_email}</p>

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
                                            <button onClick={() => generatePO(boq.id)} className="flex-1 py-3 bg-slate-800 dark:bg-blue-600 hover:bg-black text-white font-black rounded-xl transition-colors">
                                                ⚡ Approve
                                            </button>
                                            <button onClick={() => rejectBOQ(boq.id)} className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 font-black rounded-xl transition-colors">
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 md:w-2/3 flex flex-col">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Extracted Line Items</h4>
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
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [expandedRow, setExpandedRow] = useState(null);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
            setRecords(res.data.data || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchRecords(); }, []);

    const handleManualOverride = async (id, newStatus) => {
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/reconciliations/${id}`, { newStatus });
            fetchRecords(); // Refreshes exactly what UI shows
        } catch (err) { alert("Failed to update status."); }
    };

    const filteredRecords = records.filter(r => {
        if (filter === 'All') return true;
        if (filter === 'Pending' && r.match_status.includes('Reject')) return true; // Discrepancies act as pending for Finance
        if (filter === 'Approved' && r.match_status.includes('Approve')) return true;
        return false;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Finance Review Queue</h2>
                    <p className="text-slate-500 dark:text-slate-400">Expand rows to view related documents and resolve discrepancies.</p>
                </div>
                <div className="flex gap-2">
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none">
                        <option value="All">All Documents</option>
                        <option value="Pending">Needs Review (Discrepancy)</option>
                        <option value="Approved">Approved</option>
                    </select>
                    <button onClick={fetchRecords} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow">
                        🔄 Refresh
                    </button>
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
                            {filteredRecords.map((r) => (
                                <>
                                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-4 font-mono text-xs text-slate-400">{new Date(r.processed_at).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 cursor-pointer" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                                            {r.vendor_name || 'Unknown'} <span className="text-blue-500 ml-2 text-xs">👁️ View Details</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">{r.invoice_number}</div>
                                            <div className="text-purple-600 dark:text-purple-400 font-medium text-xs">{r.po_number}</div>
                                        </td>
                                        <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.invoice_total}</td>
                                        <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.po_total}</td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${r.match_status.includes('Approve') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {r.match_status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => handleManualOverride(r.id, 'Manual Approve')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white font-bold rounded text-xs transition-colors">Approve</button>
                                            <button onClick={() => handleManualOverride(r.id, 'Manual Reject')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white font-bold rounded text-xs transition-colors">Reject</button>
                                        </td>
                                    </tr>
                                    {/* EXPANDED ROW LOGIC */}
                                    {expandedRow === r.id && (
                                        <tr className="bg-slate-50 dark:bg-slate-800/20">
                                            <td colSpan="7" className="p-6 border-b border-slate-200 dark:border-slate-800">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <h4 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">Invoice Summary</h4>
                                                        <p className="text-sm"><strong>Total:</strong> ${r.invoice_total}</p>
                                                        <p className="text-sm"><strong>Status:</strong> {r.timeline_status}</p>
                                                        <p className="text-sm text-slate-400 mt-2 italic">A full line-item breakdown is available in the Supabase products ledger.</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <h4 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">Purchase Order Match</h4>
                                                        <p className="text-sm"><strong>PO Total:</strong> ${r.po_total}</p>
                                                        <p className="text-sm"><strong>Variance:</strong> <span className={r.invoice_total === r.po_total ? 'text-emerald-500' : 'text-red-500'}>${Math.abs(r.invoice_total - r.po_total).toFixed(2)}</span></p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function AnalyticsPortal() { ... } // Your exact same Analytics code