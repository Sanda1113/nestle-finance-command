import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, BarChart2, ShoppingCart, ClipboardList, LogOut, Sun, Moon, User, FileText, Clock, DollarSign, Search } from 'lucide-react';
import DisputeChat from './DisputeChat';
import AppNotifier from './AppNotifier';
import NotificationBell from './NotificationBell';
import FloatingChat from './FloatingChat';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }};

const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = String(poNum).match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${String(poNum).replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

const safeParse = (val) => {
    if (!val) return 0;
    const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
    return parseFloat(cleanStr) || 0;
};

const handlePrintDocument = (docType, docData) => {
    if (!docData) return alert("Document data not available.");
    const printWindow = window.open('', '', 'width=800,height=900');

    const html = `
        <html>
        <head>
            <title>${docType} Document</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; }
                .letterhead { display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 30px; }
                .letterhead img { max-width: 80px; margin-right: 20px; }
                .letterhead-text { text-align: center; }
                .letterhead-text h1 { color: #0f172a; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: -0.5px; }
                .letterhead-text p { color: #475569; font-size: 14px; margin: 5px 0 0; text-transform: uppercase; }
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .header h2 { margin: 0; color: #1e293b; font-size: 24px; text-transform: uppercase; }
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
                .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; clear: both; }
            </style>
        </head>
        <body>
            <div class="letterhead">
                <img src="https://nestlefinancecommand.com/nestle-logo.svg" alt="Nestlé" />
                <div class="letterhead-text">
                    <h1>Nestlé</h1>
                    <p>Global Procurement & Finance Command Center</p>
                </div>
            </div>
            <div class="header">
                <div>
                    <h2>${docType} Extract</h2>
                    <p><strong>Document Number:</strong> ${docData.invoiceNumber || docData.poNumber || 'Generated Data'}</p>
                    <p><strong>Date:</strong> ${docData.invoiceDate || docData.poDate || new Date().toLocaleDateString()}</p>
                </div>
            </div>
            <div class="info-section">
                <div class="info-box">
                    <h3>Vendor Details</h3>
                    <p><strong>${docData.vendorName || 'Unknown'}</strong><br/>${docData.vendorAddress || 'No Address Provided'}</p>
                </div>
                <div class="info-box">
                    <h3>Billing Details</h3>
                    <p>${docData.billTo || 'Nestlé Finance Command Center'}</p>
                </div>
            </div>
            <table>
                <thead>
                    <tr><th>Qty</th><th>Description</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr>
                </thead>
                <tbody>
                    ${(docData.lineItems || []).map(item => `<tr><td>${item.qty}</td><td>${item.description}</td><td class="text-right">${formatCurrency(item.unitPrice, docData.currency)}</td><td class="text-right">${formatCurrency(item.amount, docData.currency)}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="summary">
                <div class="summary-row"><span>Subtotal:</span> <span>${formatCurrency(docData.subtotal, docData.currency)}</span></div>
                <div class="summary-row"><span>Taxes:</span> <span>${formatCurrency(docData.salesTax, docData.currency)}</span></div>
                <div class="summary-row summary-total"><span>Total Amount:</span> <span>${formatCurrency(docData.totalAmount, docData.currency)}</span></div>
            </div>
            <div class="footer">Digitally extracted by Nestlé AI System — This is a system‑generated document.</div>
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

    const triggerSync = () => {
        window.dispatchEvent(new Event('force-sync'));
    };

    const handleNotificationNavigate = (link) => {
        const [path] = link.split('?');
        if (path.includes('procurement')) setActiveTab('procurement');
        if (path.includes('finance')) setActiveTab('finance');
        if (path.includes('analytics')) setActiveTab('analytics');
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Top Header Bar — matches WarehousePortal/SupplierDashboard layout */}
            <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700 shrink-0">
                        <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">Nestle<span className="text-blue-500">Finance</span></h1>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Command Center</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-3">
                    <button type="button" onClick={triggerSync} className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Force Sync" aria-label="Force Sync">
                        <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                    <NotificationBell role="Finance" onNavigate={handleNotificationNavigate} />
                    <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-medium text-slate-300">{user.email}</span>
                    </div>
                    <div className="w-px h-5 sm:h-6 bg-slate-700 mx-1 sm:mx-2 hidden sm:block"></div>
                    <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 sm:p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        {isDarkMode ? <Sun className="w-5 h-5 sm:w-4 sm:h-4" /> : <Moon className="w-5 h-5 sm:w-4 sm:h-4" />}
                    </button>
                    <button type="button" onClick={onLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/40 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors">
                        <LogOut className="w-4 h-4 shrink-0" /> <span className="hidden sm:block">Logout</span>
                    </button>
                </div>
            </div>

            {/* Content Area: sidebar + main */}
            <div className="flex grow overflow-hidden">
                {/* Sidebar — navigation only, visible on desktop */}
                <div className="hidden md:flex md:w-56 bg-slate-900 text-slate-300 flex-col shadow-2xl z-10 shrink-0">
                    <div className="p-4 border-b border-slate-800">
                        <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2">
                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-white font-semibold truncate">{user.email}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{user.role} · Admin</p>
                            </div>
                        </div>
                    </div>
                    <div className="grow py-5 flex flex-col gap-1 px-3 overflow-y-auto">
                        <p className="text-[10px] font-bold text-slate-500 uppercase px-3 mb-2 tracking-wider">Dashboards</p>
                        <button type="button" onClick={() => setActiveTab('procurement')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'procurement' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <ShoppingCart className="w-4 h-4 shrink-0" /> Procurement (BOQ)
                        </button>
                        <button type="button" onClick={() => setActiveTab('finance')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'finance' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <ClipboardList className="w-4 h-4 shrink-0" /> Review Queue
                        </button>
                        <button type="button" onClick={() => setActiveTab('analytics')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <BarChart2 className="w-4 h-4 shrink-0" /> Analytics
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grow overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
                    {activeTab === 'procurement' && <ProcurementPortal user={user} />}
                    {activeTab === 'finance' && <FinancePortal user={user} />}
                    {activeTab === 'analytics' && <AnalyticsPortal />}
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 flex justify-around py-2 px-4">
                <button type="button" onClick={() => setActiveTab('procurement')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'procurement' ? 'text-blue-400' : 'text-slate-500'}`}>
                    <ShoppingCart className="w-5 h-5" /> <span>BOQ</span>
                </button>
                <button type="button" onClick={() => setActiveTab('finance')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'finance' ? 'text-blue-400' : 'text-slate-500'}`}>
                    <ClipboardList className="w-5 h-5" /> <span>Review</span>
                </button>
                <button type="button" onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'analytics' ? 'text-blue-400' : 'text-slate-500'}`}>
                    <BarChart2 className="w-5 h-5" /> <span>Analytics</span>
                </button>
            </div>

            <AppNotifier role="Finance" />
            <FloatingChat userEmail={user?.email} userRole="Finance" />
        </div>
    );
}

function ProcurementPortal({ user }) {
    const [boqs, setBoqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [supplierFilter, setSupplierFilter] = useState('All');
    const [processingBoqs, setProcessingBoqs] = useState({});
    const [expandedChat, setExpandedChat] = useState(null);

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
        const interval = setInterval(() => fetchBoqs(false), 5000);

        const handleSync = () => fetchBoqs(false);
        window.addEventListener('force-sync', handleSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener('force-sync', handleSync);
        };
    }, []);

    const generatePO = async (id) => {
        setProcessingBoqs(prev => ({ ...prev, [id]: true }));
        try {
            const res = await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/generate-po`);
            if (res.data.success) {
                alert(`✅ Success! Generated PO Number: ${res.data.poNumber}\nRouted directly to Supplier Inbox.`);
            }
        } catch { alert("Failed to generate PO."); }
        finally { setProcessingBoqs(prev => ({ ...prev, [id]: false })); }
    };

    const rejectBOQ = async (id) => {
        const reason = window.prompt("Reason for rejection (e.g., Not enough stock, Pricing incorrect):");
        if (!reason) return;
        setProcessingBoqs(prev => ({ ...prev, [id]: true }));
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}/reject`, { reason });
        } catch { alert("Failed to reject BOQ."); }
        finally { setProcessingBoqs(prev => ({ ...prev, [id]: false })); }
    };

    const totalBOQs = boqs.length;
    const pendingBOQs = boqs.filter(b => b.status === 'Pending Review').length;
    const approvedBOQs = boqs.filter(b => (b.status || '').includes('PO Generated')).length;
    const _rejectedBOQs = boqs.filter(b => b.status === 'Rejected').length;
    const totalValue = boqs.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    const uniqueSuppliers = [...new Set(boqs.map(b => b.supplier_email).filter(Boolean))];

    const filteredBoqs = useMemo(() => {
        return boqs.filter(b => {
            if (filter === 'Approved' && !(b.status || '').includes('PO Generated')) return false;
            if (filter === 'Pending' && b.status !== 'Pending Review') return false;
            if (filter === 'Rejected' && b.status !== 'Rejected') return false;
            if (supplierFilter !== 'All' && b.supplier_email !== supplierFilter) return false;
            return true;
        });
    }, [boqs, filter, supplierFilter]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Procurement Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">Review supplier BOQs and automatically dispatch Official POs.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="All">All Suppliers Emails</option>
                        {uniqueSuppliers.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                    </select>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending Review</option>
                        <option value="Approved">Approved (PO Sent)</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Total BOQs</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{totalBOQs}</p>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400"><FileText className="w-5 h-5" /></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Pending Review</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{pendingBOQs}</p>
                        </div>
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400"><Clock className="w-5 h-5" /></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Approved (PO Sent)</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{approvedBOQs}</p>
                        </div>
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Total Value</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatCurrency(totalValue)}</p>
                        </div>
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400"><DollarSign className="w-5 h-5" /></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Loading Supplier Quotes...</div>
                ) : filteredBoqs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">No BOQs match this filter.</div>
                ) : (
                    filteredBoqs.map(boq => {
                        const isApproved = (boq.status || '').includes('PO Generated');
                        const isRejected = boq.status === 'Rejected';
                        const isProcessing = processingBoqs[boq.id];
                        const isChatOpen = expandedChat === boq.id;

                        return (
                            <div key={boq.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all hover:shadow-md">
                                <div className="flex flex-col md:flex-row w-full">
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
                                                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Pending Review</span>
                                            )}
                                            <p className="text-xs text-slate-400 mt-4">Uploaded: {new Date(boq.created_at).toLocaleString()}</p>
                                        </div>

                                        <div className="mt-6 flex flex-col gap-2">
                                            {!isApproved && !isRejected && (
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => generatePO(boq.id)} disabled={isProcessing} className="flex-1 py-3 bg-slate-800 dark:bg-blue-600 hover:bg-black disabled:bg-slate-500 text-white font-black rounded-xl transition-colors">
                                                        {isProcessing ? 'Processing...' : '⚡ Approve'}
                                                    </button>
                                                    <button type="button" onClick={() => rejectBOQ(boq.id)} disabled={isProcessing} className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 disabled:bg-slate-200 text-red-600 hover:bg-red-200 font-black rounded-xl transition-colors">
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                            <button type="button" onClick={() => setExpandedChat(isChatOpen ? null : boq.id)} className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${isChatOpen ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'}`}>
                                                💬 Chat with Supplier
                                            </button>
                                        </div>
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
                                {isChatOpen && (
                                    <div className="border-t border-slate-800 bg-slate-950 p-4">
                                        <DisputeChat
                                            referenceNumber={boq.document_number || `BOQ-${boq.id}`}
                                            userRole="Finance"
                                            userEmail={user.email}
                                            contextData={{ status: boq.status, type: 'BOQ / Quote' }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function FinancePortal({ user }) {
    const [records, setRecords] = useState([]);
    const [boqs, setBoqs] = useState([]);
    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [reviewSearchTerm, setReviewSearchTerm] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);
    const [actionedRecords, setActionedRecords] = useState({});

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [recRes, boqRes, poRes] = await Promise.all([
                axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations'),
                axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs'),
                axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos', {
                    params: {
                        includePhotos: true
                    }
                })
            ]);
            setRecords(recRes.data.data || []);
            setBoqs(boqRes.data.data || []);
            setPOs(poRes.data.data || []);
        } catch (err) { console.error(err); }
        finally { if (showLoading) setLoading(false); }
    };

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), 5000);

        const handleSync = () => fetchData(false);
        window.addEventListener('force-sync', handleSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener('force-sync', handleSync);
        };
    }, []);

    const handleManualOverride = async (id, decision) => {
        const confirmMsg = decision === 'Approved'
            ? "Are you sure you want to manually APPROVE this document?"
            : "Are you sure you want to manually REJECT this document?";

        if (!window.confirm(confirmMsg)) return;

        setActionedRecords(prev => ({ ...prev, [id]: true }));

        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/reconciliations/${id}`, { newStatus: decision });
            fetchData(false);
        } catch {
            alert("Failed to update status.");
            setActionedRecords(prev => ({ ...prev, [id]: false }));
        }
    };

    const enrichedRecords = records.map(r => {
        const relatedPO = pos.find(p => p.po_number === r.po_number);
        const isGrnCompleted = relatedPO && relatedPO.status && relatedPO.status.includes('Received');
        const isDelivered = relatedPO && (relatedPO.status === 'Delivered to Dock' || relatedPO.po_data?.delivery_timestamp);
        const isWarehouseCancelled = relatedPO && String(relatedPO.status || '').includes('Cancelled');

        let displayStatus = String(r.match_status || '');

        const invTotal = safeParse(r.invoice_total);
        const poTotal = safeParse(r.po_total);
        const isMathMatch = Math.abs(invTotal - poTotal) <= 0.01;

        if (!displayStatus || displayStatus === 'Pending' || displayStatus.includes('Manual Review') || displayStatus.includes('Discrepancy')) {
            displayStatus = isMathMatch ? 'Matched - Pending Finance Review' : 'Discrepancy Detected';
        }

        if (isWarehouseCancelled) {
            displayStatus = 'Rejected by Warehouse (Shortage)';
        } else if (displayStatus.toLowerCase().includes('approve')) {
            if (isGrnCompleted) displayStatus = 'Approved - Awaiting Payout';
            else if (isDelivered) displayStatus = 'Pending Warehouse GRN';
            else displayStatus = 'Approved (Awaiting Delivery)';
        } else if (displayStatus.toLowerCase().includes('reject')) {
            displayStatus = 'Rejected by Finance';
        }

        return { ...r, displayStatus, relatedPO };
    });

    const filteredRecords = enrichedRecords.filter(r => {
        if (filter === 'All') return true;
        if (filter === 'Pending') return r.displayStatus === 'Matched - Pending Finance Review' || r.displayStatus === 'Discrepancy Detected' || r.displayStatus === 'Pending Warehouse GRN' || r.displayStatus.includes('Reject');
        if (filter === 'Approved') return r.displayStatus.includes('Approved');
        return false;
    });

    const searchLower = reviewSearchTerm.trim().toLowerCase();
    const visibleRecords = filteredRecords.filter((r) => {
        if (!searchLower) return true;
        const values = [
            getShipmentId(r.po_number),
            r.po_number,
            r.invoice_number,
            r.vendor_name,
            r.displayStatus
        ];
        return values.some((val) => String(val || '').toLowerCase().includes(searchLower));
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Finance Review Queue</h2>
                    <p className="text-slate-500 dark:text-slate-400">Resolve discrepancies and manually review supplier submissions.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            value={reviewSearchTerm}
                            onChange={(e) => setReviewSearchTerm(e.target.value)}
                            placeholder="Search shipment, PO, invoice, vendor..."
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    </div>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="All">All Documents</option>
                        <option value="Pending">Needs Review / Pending</option>
                        <option value="Approved">Approved / Payouts</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Fetching Secure Database Records...</div>
                ) : (
                    <table className="w-full text-left text-sm min-w-[1100px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Date</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Vendor</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Shipment ID / PO</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Inv Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">PO Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">PO Upload Time</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Invoice Upload Time</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Status</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-center">Chat Hub</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-right">Finance Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {visibleRecords.map((r) => {
                                const isActioned = actionedRecords[r.id] || r.displayStatus.includes('Approved') || r.displayStatus.includes('Reject');
                                const relatedBoq = boqs.find(b => (b.status || '').includes(r.po_number));
                                const isExpanded = expandedRow === r.id;
                                const rejectionEvidence = r.relatedPO?.po_data?.warehouse_rejection || null;
                                const grnEvidence = r.relatedPO?.po_data?.warehouse_grn || null;
                                const shortageEvidence = rejectionEvidence?.shortageEvidence || grnEvidence?.shortageEvidence || [];

                                const poUploadTime = relatedBoq ? new Date(relatedBoq.created_at) : null;
                                const invoiceUploadTime = r.processed_at ? new Date(r.processed_at) : null;

                                return (
                                    <>
                                        <tr key={r.id} className={`hover:bg-slate-50 dark:bg-slate-800/30 transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/20' : ''}`}>
                                            <td className="p-4 font-mono text-xs text-slate-400">{new Date(r.processed_at).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{r.vendor_name || 'Unknown'}</td>
                                            <td className="p-4">
                                                <div className="text-blue-600 dark:text-blue-400 font-bold text-sm mb-1">{getShipmentId(r.po_number)}</div>
                                                <div className="text-slate-500 dark:text-slate-400 font-medium text-[10px] uppercase tracking-wider mb-0.5">PO: {r.po_number}</div>
                                                <div className="text-slate-500 dark:text-slate-400 font-medium text-[10px] uppercase tracking-wider">INV: {r.invoice_number}</div>
                                            </td>
                                            <td className="p-4 font-black text-slate-700 dark:text-slate-300">{formatCurrency(r.invoice_total)}</td>
                                            <td className="p-4 font-black text-slate-700 dark:text-slate-300">{formatCurrency(r.po_total)}</td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                                                {poUploadTime ? poUploadTime.toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                                                {invoiceUploadTime ? invoiceUploadTime.toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 ring-inset ${r.displayStatus.includes('Approved') ? 'bg-emerald-50 text-emerald-600 ring-emerald-500/20' : r.displayStatus.includes('Matched') ? 'bg-blue-50 text-blue-600 ring-blue-500/20' : r.displayStatus.includes('Pending') ? 'bg-amber-50 text-amber-600 ring-amber-500/20' : 'bg-red-50 text-red-600 ring-red-500/20'}`}>
                                                    {r.displayStatus}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${isExpanded ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'}`}
                                                >
                                                    {isExpanded ? '▼ Close' : '💬 Open Chat'}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleManualOverride(r.id, 'Approved'); }}
                                                        disabled={isActioned}
                                                        className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleManualOverride(r.id, 'Rejected'); }}
                                                        disabled={isActioned}
                                                        className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-100/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                                <td colSpan="10" className="p-4 px-6">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        <div className="flex flex-col gap-4">
                                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">📑 Document Context</h4>
                                                            <div className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-950 dark:to-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-sm relative overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">1. Original BOQ</h4>
                                                                    {relatedBoq ? (
                                                                        <button type="button" onClick={() => handlePrintDocument('Original Quote / BOQ', { ...relatedBoq, lineItems: relatedBoq.line_items, invoiceNumber: relatedBoq.document_number, totalAmount: relatedBoq.total_amount })} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm transition-colors">📄 Print PDF</button>
                                                                    ) : <span className="text-[10px] text-slate-400">Not Found</span>}
                                                                </div>
                                                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{relatedBoq ? formatCurrency(relatedBoq.total_amount) : 'N/A'}</p>
                                                            </div>
                                                            <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-950 dark:to-slate-900 p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-sm relative overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">2. Purchase Order</h4>
                                                                    <button type="button" onClick={() => handlePrintDocument('Purchase Order', r.po_data)} className="px-3 py-1.5 text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 rounded-md shadow-sm transition-colors">📄 Print PDF</button>
                                                                </div>
                                                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(r.po_total)}</p>
                                                            </div>
                                                            <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-950 dark:to-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">3. Final Invoice</h4>
                                                                    <button type="button" onClick={() => handlePrintDocument('Invoice Data Extract', r.invoice_data)} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md shadow-sm transition-colors">📄 Print PDF</button>
                                                                </div>
                                                                <div className="flex justify-between items-end">
                                                                    <p className="text-xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(r.invoice_total)}</p>
                                                                    <p className="text-[10px] font-bold uppercase">Var: <span className={r.invoice_total === r.po_total ? 'text-emerald-500' : 'text-red-500'}>{formatCurrency(Math.abs(r.invoice_total - r.po_total))}</span></p>
                                                                </div>
                                                            </div>
                                                            {shortageEvidence.length > 0 && (
                                                                <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-950 dark:to-slate-900 p-4 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm relative overflow-hidden">
                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                                                    <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">4. Warehouse Shortage Evidence</h4>
                                                                    {rejectionEvidence?.rejectionReason && (
                                                                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Reason: {rejectionEvidence.rejectionReason}</p>
                                                                    )}
                                                                    <div className="space-y-2">
                                                                        {shortageEvidence.map((item, idx) => (
                                                                            <div key={`${item.description}-${idx}`} className="p-2 bg-white/70 dark:bg-slate-900/70 rounded border border-red-100 dark:border-red-900/40">
                                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.description}</p>
                                                                                <p className="text-[11px] text-slate-600 dark:text-slate-300">Received {item.receivedQty} / Expected {item.expectedQty}</p>
                                                                                {item.photoDataUrl && (
                                                                                    <img src={item.photoDataUrl} alt={`${item.description} shortage evidence`} className="mt-2 h-20 w-20 object-cover rounded border border-red-200 dark:border-red-900/50" />
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <DisputeChat
                                                                referenceNumber={r.po_number || r.invoice_number}
                                                                userRole="Finance"
                                                                userEmail={user?.email || 'admin@nestle.com'}
                                                                varianceType={r.invoice_total !== r.po_total ? 'Price Variance' : 'Quantity/Fulfillment Variance'}
                                                                contextData={{ status: r.displayStatus, type: 'Invoice Reconciliation' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
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
    const [allRecords, setAllRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
                const data = res.data.data || [];
                setAllRecords(data);
                const approved = data.filter(r => r.match_status === 'Approved').length;
                const rejected = data.filter(r => r.match_status && r.match_status.includes('Reject')).length;
                const totalValue = data.reduce((acc, curr) => acc + (Number(curr.invoice_total) || 0), 0);
                setStats({ total: data.length, approved, rejected, value: totalValue });
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();

        const handleSync = () => fetchData();
        window.addEventListener('force-sync', handleSync);
        return () => window.removeEventListener('force-sync', handleSync);
    }, []);

    const pieData = [
        { name: 'Approved', value: stats.approved },
        { name: 'Rejected', value: stats.rejected }
    ];
    const COLORS = ['#10b981', '#ef4444'];

    const monthlyData = useMemo(() => {
        const months = {};
        allRecords.forEach(record => {
            const date = new Date(record.processed_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!months[monthKey]) {
                months[monthKey] = { month: monthKey, count: 0, value: 0 };
            }
            months[monthKey].count += 1;
            months[monthKey].value += Number(record.invoice_total) || 0;
        });
        return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
    }, [allRecords]);

    const vendorData = useMemo(() => {
        const vendors = {};
        allRecords.forEach(record => {
            const vendor = record.vendor_name || 'Unknown';
            if (!vendors[vendor]) vendors[vendor] = 0;
            vendors[vendor] += Number(record.invoice_total) || 0;
        });
        return Object.entries(vendors)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [allRecords]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Platform Analytics</h2>
                <p className="text-slate-500 dark:text-slate-400">High-level view of AI throughput and financial processing.</p>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Calculating Live Metrics...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Documents</p>
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400"><FileText className="w-5 h-5" /></div>
                            </div>
                            <p className="text-5xl font-black text-blue-600 dark:text-blue-400">{stats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Auto-Approval Rate</p>
                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
                            </div>
                            <p className="text-5xl font-black text-emerald-500 dark:text-emerald-400">
                                {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                            </p>
                            <p className="text-xs text-slate-500 mt-2 font-medium">{stats.approved} Approved / {stats.rejected} Rejected</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Value Processed</p>
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400"><DollarSign className="w-5 h-5" /></div>
                            </div>
                            <p className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-2">{formatCurrency(stats.value)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Approval vs Rejection</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Documents per Month</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#3b82f6" name="Number of Documents" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Total Value Over Time</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="value" stroke="#10b981" name="Total Value" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Top Vendors by Value</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vendorData} layout="vertical" margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="name" />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="value" fill="#8b5cf6" name="Total Value" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
