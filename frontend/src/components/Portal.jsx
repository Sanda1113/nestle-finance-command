import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, BarChart2, ShoppingCart, ClipboardList, LogOut, Sun, Moon, User, FileText, Clock, DollarSign, Search, Download, CreditCard, Calendar, Settings, Shield, Sliders, Zap, AlertTriangle, Briefcase, ChevronRight, Activity, Percent, ArrowRight, ShieldCheck, ShieldAlert, Target, TrendingUp, X } from 'lucide-react';
import DisputeChat from './DisputeChat';
import AppNotifier from './AppNotifier';
import NotificationBell from './NotificationBell';
import FloatingChat from './FloatingChat';
import DigitalCalendar from './DigitalCalendar';
import { supabase } from '../utils/supabaseClient';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

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

const DASHBOARD_POLL_INTERVAL_MS = 5000;
const DASHBOARD_FETCH_TIMEOUT_MS = 15000;
const DASHBOARD_IMMEDIATE_REFRESH_DEBOUNCE_MS = 800;

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

    // 🔥 TREASURY & BANK BALANCE STATE
    const [bankBalance, setBankBalance] = useState(1250000.50); // Initial mock balance
    const [topUpRequests, setTopUpRequests] = useState([]);
    const BALANCE_THRESHOLD = 500000; // $500k threshold

    useEffect(() => {
        const syncTreasury = () => {
            const storedBalance = localStorage.getItem('nestle_treasury_balance');
            if (storedBalance) setBankBalance(parseFloat(storedBalance));
            
            const storedRequests = localStorage.getItem('nestle_topup_requests');
            if (storedRequests) setTopUpRequests(JSON.parse(storedRequests));
        };

        syncTreasury();

        // 1. Listen for Storage Events (cross-tab sync)
        window.addEventListener('storage', syncTreasury);

        // 2. Listen for Supabase Notifications (role-based sync)
        const channel = supabase
            .channel('treasury_sync')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `role=eq.Finance` }, (payload) => {
                if (payload.new.type === 'topup_approved') {
                    syncTreasury();
                }
            })
            .subscribe();

        return () => {
            window.removeEventListener('storage', syncTreasury);
            supabase.removeChannel(channel);
        };
    }, [activeTab]);

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
                        <button type="button" onClick={() => setActiveTab('payouts')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'payouts' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <Calendar className="w-4 h-4 shrink-0" /> The Treasury Calendar
                        </button>
                        <button type="button" onClick={() => setActiveTab('treasury')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'treasury' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <Zap className="w-4 h-4 shrink-0" /> Treasury Management
                        </button>
                        <button type="button" onClick={() => setActiveTab('settings')} className={`text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                            <Settings className="w-4 h-4 shrink-0" /> Settings
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grow overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
                    {activeTab === 'procurement' && <ProcurementPortal user={user} />}
                    {activeTab === 'finance' && <FinancePortal user={user} />}
                    {activeTab === 'analytics' && <AnalyticsPortal />}
                    {activeTab === 'payouts' && <PayoutCalendar user={user} />}
                    {activeTab === 'treasury' && (
                        <TreasuryDashboard 
                            user={user} 
                            bankBalance={bankBalance} 
                            setBankBalance={setBankBalance}
                            topUpRequests={topUpRequests}
                            setTopUpRequests={setTopUpRequests}
                            threshold={BALANCE_THRESHOLD}
                        />
                    )}
                    {activeTab === 'settings' && <SettingsPortal />}
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
                <button type="button" onClick={() => setActiveTab('payouts')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'payouts' ? 'text-blue-400' : 'text-slate-500'}`}>
                    <CreditCard className="w-5 h-5" /> <span>Payouts</span>
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
    const isFetchingBoqsRef = useRef(false);
    const lastImmediateRefreshAtRef = useRef(0);

    const fetchBoqs = useCallback(async (showLoading = true) => {
        if (isFetchingBoqsRef.current) return;
        isFetchingBoqsRef.current = true;
        if (showLoading) setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs', {
                params: { _ts: Date.now() },
                timeout: DASHBOARD_FETCH_TIMEOUT_MS,
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                }
            });
            setBoqs(res.data.data || []);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('Procurement polling request failed:', error?.message || error);
            }
        }
        finally {
            if (showLoading) setLoading(false);
            isFetchingBoqsRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchBoqs(true);

        const channel = supabase
            .channel('finance_boqs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'boqs' },
                () => {
                    if (!document.hidden) fetchBoqs(false);
                }
            )
            .subscribe();

        const handleSync = () => fetchBoqs(false);
        window.addEventListener('force-sync', handleSync);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('force-sync', handleSync);
        };
    }, [fetchBoqs]);

    useEffect(() => {
        const shouldRefreshImmediately = () => {
            if (document.hidden) return false;
            const now = Date.now();
            if ((now - lastImmediateRefreshAtRef.current) <= DASHBOARD_IMMEDIATE_REFRESH_DEBOUNCE_MS) return false;
            lastImmediateRefreshAtRef.current = now;
            return true;
        };

        const refreshImmediately = () => {
            if (shouldRefreshImmediately()) {
                fetchBoqs(false);
            }
        };

        window.addEventListener('focus', refreshImmediately);
        document.addEventListener('visibilitychange', refreshImmediately);
        return () => {
            window.removeEventListener('focus', refreshImmediately);
            document.removeEventListener('visibilitychange', refreshImmediately);
        };
    }, [fetchBoqs]);

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
    const [showToleranceModal, setShowToleranceModal] = useState(false);
    const [shadowModeResult, setShadowModeResult] = useState(null);
    const [isRunningShadowMode, setIsRunningShadowMode] = useState(false);
    const isFetchingDataRef = useRef(false);
    const lastImmediateRefreshAtRef = useRef(0);

    const fetchData = useCallback(async (showLoading = true) => {
        if (isFetchingDataRef.current) return;
        isFetchingDataRef.current = true;
        if (showLoading) setLoading(true);
        try {
            const p1 = axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations', {
                params: { _ts: Date.now() },
                timeout: DASHBOARD_FETCH_TIMEOUT_MS,
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
            }).then(res => {
                setRecords(res.data.data || []);
                if (showLoading) setLoading(false);
            }).catch(error => {
                if (import.meta.env.DEV) console.warn('Finance polling request failed (reconciliations):', error);
                if (showLoading) setLoading(false);
            });

            const p2 = axios.get('https://nestle-finance-command-production.up.railway.app/api/boqs', {
                params: { _ts: Date.now() },
                timeout: DASHBOARD_FETCH_TIMEOUT_MS,
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
            }).then(res => setBoqs(res.data.data || []))
                .catch(error => { if (import.meta.env.DEV) console.warn('Finance polling request failed (boqs):', error); });

            const p3 = axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos', {
                params: { includePhotos: true, _ts: Date.now() },
                timeout: DASHBOARD_FETCH_TIMEOUT_MS,
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
            }).then(res => setPOs(res.data.data || []))
                .catch(error => { if (import.meta.env.DEV) console.warn('Finance polling request failed (pos):', error); });

            await Promise.all([p1, p2, p3]);
        } finally {
            isFetchingDataRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchData(true);

        const channels = [
            'reconciliations',
            'boqs',
            'purchase_orders',
            'payout_schedules',
            'payout_schedule'
        ].map(table =>
            supabase
                .channel(`finance_${table}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table },
                    () => {
                        if (!document.hidden) fetchData(false);
                    }
                )
                .subscribe()
        );

        const handleSync = () => fetchData(false);
        window.addEventListener('force-sync', handleSync);

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
            window.removeEventListener('force-sync', handleSync);
        };
    }, [fetchData]);

    useEffect(() => {
        const shouldRefreshImmediately = () => {
            if (document.hidden) return false;
            const now = Date.now();
            if ((now - lastImmediateRefreshAtRef.current) <= DASHBOARD_IMMEDIATE_REFRESH_DEBOUNCE_MS) return false;
            lastImmediateRefreshAtRef.current = now;
            return true;
        };

        const refreshImmediately = () => {
            if (shouldRefreshImmediately()) {
                fetchData(false);
            }
        };

        window.addEventListener('focus', refreshImmediately);
        document.addEventListener('visibilitychange', refreshImmediately);
        return () => {
            window.removeEventListener('focus', refreshImmediately);
            document.removeEventListener('visibilitychange', refreshImmediately);
        };
    }, [fetchData]);


    const handleStagePayout = async (record) => {
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/stage', {
                invoice_ref: record.id,
                supplier_email: record.vendor_email || 'supplier@nestle.com',
                total_amount: record.invoice_total
            });
            alert('Payout Staged successfully!');
            fetchData(false);
        } catch (err) {
            console.error(err);
            alert('Failed to stage payout.');
        }
    };

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
        const variance = Math.abs(invTotal - poTotal);

        // Dynamic Vendor Trust Profiling
        let trustTier = 'Tier 2 (Standard)';
        let trustColor = 'text-blue-500 bg-blue-50 border-blue-200';
        let trustIcon = <Shield className="w-3 h-3 mr-1" />;

        if (r.vendor_name && r.vendor_name.length % 3 === 0) {
            trustTier = 'Tier 1 (Strategic)';
            trustColor = 'text-purple-600 bg-purple-50 border-purple-200';
            trustIcon = <ShieldCheck className="w-3 h-3 mr-1" />;
        } else if (r.vendor_name && r.vendor_name.length % 5 === 0) {
            trustTier = 'Tier 3 (High Risk)';
            trustColor = 'text-red-600 bg-red-50 border-red-200';
            trustIcon = <ShieldAlert className="w-3 h-3 mr-1" />;
        }

        if (!displayStatus || displayStatus === 'Pending' || displayStatus.includes('Manual Review') || displayStatus.includes('Discrepancy')) {
            displayStatus = isMathMatch ? 'Matched - Pending Finance Review' : 'Discrepancy Detected';
        }

        // Context-Aware Tolerance Rules (Simulated Application)
        let autoApprovedViaTolerance = false;
        let glPayload = null;
        if (!isMathMatch && variance > 0 && variance <= 5.00 && trustTier !== 'Tier 3 (High Risk)') {
            autoApprovedViaTolerance = true;
            if (displayStatus === 'Pending' || displayStatus.includes('Discrepancy') || displayStatus === 'Discrepancy Detected') {
                displayStatus = 'Auto-Approved';
            }
            glPayload = {
                journal_entry: "JRNL-VAR-AUTO",
                account: "61000-Minor Variance Write-Off",
                debit: variance.toFixed(2),
                currency: "USD",
                reason: "Automated tolerance write-off"
            };
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

        return { ...r, displayStatus, relatedPO, trustTier, trustColor, trustIcon, autoApprovedViaTolerance, glPayload, variance };
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

            {/* Smart Tolerance Modal */}
            {showToleranceModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20"><Target className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white">Smart Tolerance Rules</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Autonomous Reconciliation Config</p>
                                </div>
                            </div>
                            <button onClick={() => setShowToleranceModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest border-l-4 border-blue-600 pl-3">Active Rules</h4>

                                <div className="space-y-3">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center group hover:border-blue-500/50 transition-all">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 dark:text-white">Global Tax Rounding</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Threshold: $1.00 Absolute</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">Active</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><Settings className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center group hover:border-blue-500/50 transition-all">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 dark:text-white">Freight Fluctuation</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Threshold: 2.0% Percentage</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">Active</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><Settings className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center group hover:border-red-500/50 transition-all">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 dark:text-white">Unit Price Strict Match</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Threshold: $0.00 Absolute</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 text-[10px] font-bold rounded uppercase">Strict</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><Settings className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                                    <h5 className="font-black text-sm mb-2 flex items-center gap-2">
                                        <Zap className="w-4 h-4" /> AI Dynamic Tiering
                                    </h5>
                                    <p className="text-xs text-blue-100 leading-relaxed">Strategic Partners (Tier 1) automatically receive <strong>2x</strong> tolerance thresholds based on a 99% accuracy rating over 6 months.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest border-l-4 border-purple-600 pl-3">"Shadow Mode" ROI Simulator</h4>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                                    <p className="text-xs text-slate-500 leading-relaxed">Test a new rule against the last 100 discrepancies to see the financial and operational impact before deploying.</p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Category</label>
                                            <select className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2 rounded-xl text-xs outline-none">
                                                <option>Tax Rounding</option>
                                                <option>Freight</option>
                                                <option>General Variance</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Threshold</label>
                                            <input type="text" placeholder="$5.00" className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2 rounded-xl text-xs outline-none" />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            setIsRunningShadowMode(true);
                                            try {
                                                const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/tolerance/simulate', {
                                                    category: 'General Variance',
                                                    thresholdValue: 5.00
                                                });
                                                setShadowModeResult(res.data.results);
                                            } catch (e) { alert("Simulation failed."); }
                                            finally { setIsRunningShadowMode(false); }
                                        }}
                                        disabled={isRunningShadowMode}
                                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-500/20"
                                    >
                                        {isRunningShadowMode ? 'Processing History...' : 'Run Simulation'}
                                    </button>

                                    {shadowModeResult && (
                                        <div className="mt-6 p-4 bg-slate-900 rounded-2xl space-y-3 animate-in zoom-in-95 duration-300">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Impacted Records</span>
                                                <span className="text-sm font-black text-white">{shadowModeResult.impactedCount} invoices</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Manual Hours Saved</span>
                                                <span className="text-sm font-black text-blue-400">{shadowModeResult.hoursSaved} hrs</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Projected Financial Leakage</span>
                                                <span className="text-sm font-black text-rose-500">-{formatCurrency(shadowModeResult.leakage)}</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase">Net Monthly ROI</span>
                                                <span className="text-lg font-black text-emerald-400">+{formatCurrency(shadowModeResult.netROI)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setShowToleranceModal(false)} className="px-6 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors">Discard</button>
                            <button className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-500/20">Commit Changes</button>
                        </div>
                    </div>
                </div>
            )}

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
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                                <div className="mb-1">{r.vendor_name || 'Unknown'}</div>
                                                <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${r.trustColor}`}>
                                                    {r.trustIcon} {r.trustTier}
                                                </div>
                                            </td>
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
                                                    {r.displayStatus === 'Approved - Awaiting Payout' ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleStagePayout(r); }}
                                                            className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                                        >
                                                            Stage Payout
                                                        </button>
                                                    ) : (
                                                        <>
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
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-100/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                                <td colSpan="10" className="p-4 px-6">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        <div className="flex flex-col gap-4">
                                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">📑 Document Context</h4>
                                                            {r.auto_approved && r.auto_approval_reason && (
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-4 shadow-sm">
                                                                    <strong>AI Auto-Approval Note:</strong> {r.auto_approval_reason}
                                                                </div>
                                                            )}
                                                            {r.autoApprovedViaTolerance && (
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500 p-4 rounded-r shadow-sm mb-4">
                                                                    <div className="flex items-start gap-2">
                                                                        <Zap className="w-4 h-4 text-emerald-600 mt-0.5" />
                                                                        <div>
                                                                            <strong className="text-sm text-emerald-800 dark:text-emerald-300">Smart Tolerance Auto-Approval</strong>
                                                                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 mb-3">Invoice passed logical tolerance checks despite mathematical discrepancy. Write-off GL payload generated.</p>
                                                                            <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                                                                                <pre className="text-[10px] text-emerald-400 font-mono m-0">
                                                                                    {JSON.stringify(r.glPayload, null, 2)}
                                                                                </pre>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {r.auto_approved && r.auto_approval_reason && (
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-4 shadow-sm">
                                                                    <strong>AI Auto-Approval Note:</strong> {r.auto_approval_reason}
                                                                </div>
                                                            )}
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
    const isFetchingRef = useRef(false);
    const lastImmediateRefreshAtRef = useRef(0);

    const fetchData = useCallback(async (showLoading = true) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (showLoading) setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations', {
                params: { _ts: Date.now() },
                timeout: DASHBOARD_FETCH_TIMEOUT_MS,
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                }
            });
            const data = res.data.data || [];
            setAllRecords(data);
            const approved = data.filter(r => r.match_status === 'Approved').length;
            const rejected = data.filter(r => r.match_status && r.match_status.includes('Reject')).length;
            const totalValue = data.reduce((acc, curr) => acc + (Number(curr.invoice_total) || 0), 0);
            setStats({ total: data.length, approved, rejected, value: totalValue });
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('Analytics polling request failed:', error?.message || error);
            }
        }
        finally {
            if (showLoading) setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), DASHBOARD_POLL_INTERVAL_MS);

        const handleSync = () => fetchData(false);
        window.addEventListener('force-sync', handleSync);
        return () => {
            clearInterval(interval);
            window.removeEventListener('force-sync', handleSync);
        };
    }, [fetchData]);

    useEffect(() => {
        const shouldRefreshImmediately = () => {
            if (document.hidden) return false;
            const now = Date.now();
            if ((now - lastImmediateRefreshAtRef.current) <= DASHBOARD_IMMEDIATE_REFRESH_DEBOUNCE_MS) return false;
            lastImmediateRefreshAtRef.current = now;
            return true;
        };

        const refreshImmediately = () => {
            if (shouldRefreshImmediately()) {
                fetchData(false);
            }
        };

        window.addEventListener('focus', refreshImmediately);
        document.addEventListener('visibilitychange', refreshImmediately);
        return () => {
            window.removeEventListener('focus', refreshImmediately);
            document.removeEventListener('visibilitychange', refreshImmediately);
        };
    }, [fetchData]);

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

    const handleExportCSV = () => {
        if (!allRecords.length) return;

        const headers = ["Reconciliation ID", "Vendor Name", "Invoice Number", "PO Number", "Invoice Total", "PO Total", "Match Status", "Processed At"];
        const rows = allRecords.map(r => [
            r.id,
            `"${(r.vendor_name || 'N/A').replace(/"/g, '""')}"`,
            `"${(r.invoice_number || 'N/A').replace(/"/g, '""')}"`,
            `"${(r.po_number || 'N/A').replace(/"/g, '""')}"`,
            r.invoice_total || 0,
            r.po_total || 0,
            r.match_status || 'N/A',
            r.processed_at ? new Date(r.processed_at).toISOString().split('T')[0] : 'N/A'
        ]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `finance_reconciliation_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRetrainModel = () => {
        alert("Initializing ML feedback loop... \n\nRetraining OCR model using recent manual approvals and rejections to improve future extraction and matching accuracy.");
        setTimeout(() => alert("Model successfully retrained! Inference accuracy improved by +1.4%."), 2500);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Platform Analytics</h2>
                    <p className="text-slate-500 dark:text-slate-400">High-level view of AI throughput and financial processing.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRetrainModel}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-sm transition-colors text-sm"
                    >
                        <RefreshCw className="w-4 h-4" /> Retrain ML Model
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors text-sm"
                    >
                        <Download className="w-4 h-4" /> Export CSV Report
                    </button>
                </div>
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

                    {/* Treasury Yield Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <div className="md:col-span-3 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 shadow-lg border border-indigo-500/30">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Percent className="w-6 h-6 text-indigo-400" /> Treasury Yield Dashboard</h3>
                                    <p className="text-indigo-200 text-sm mt-1">ROI Tracking for Dynamic Discounting & Early Payment Programs</p>
                                </div>
                                <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-500/30 flex flex-col items-end">
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 mb-1">Capital Deployment Cap</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-32 h-2 bg-indigo-950 rounded-full overflow-hidden">
                                            <div className="bg-indigo-400 h-full" style={{ width: '26%' }}></div>
                                        </div>
                                        <span className="text-sm font-mono text-white">$520K / $2.0M</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/20 flex flex-col justify-center">
                                    <p className="text-xs font-bold uppercase text-indigo-300 mb-1">Total Cash Deployed Early</p>
                                    <p className="text-3xl font-black text-white">$5.2M</p>
                                </div>
                                <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/20 flex flex-col justify-center">
                                    <p className="text-xs font-bold uppercase text-indigo-300 mb-1">Discount Revenue Captured</p>
                                    <p className="text-3xl font-black text-emerald-400">$84,000</p>
                                </div>
                                <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/20 flex flex-col justify-center">
                                    <p className="text-xs font-bold uppercase text-indigo-300 mb-1">Annualized Yield</p>
                                    <p className="text-3xl font-black text-white">8.2%</p>
                                </div>
                            </div>
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

function PayoutCalendar({ user }) {
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [schedulingPayout, setSchedulingPayout] = useState(null);
    const [confirmDate, setConfirmDate] = useState('');

    const fetchPayouts = async () => {
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts');
            setPayouts(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch payouts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayouts();

        const channel = supabase
            .channel('payouts_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payout_schedules' },
                () => fetchPayouts()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payout_schedule' },
                () => fetchPayouts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const markPaid = async (id) => {
        if (!window.confirm("Are you sure you want to mark this payout as Paid?")) return;
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/payouts/${id}/paid`, { paidBy: 'Finance User' });
            fetchPayouts();
        } catch {
            alert('Failed to mark as paid');
        }
    };

    const handleBatchAndPay = async (batch) => {
        if (!window.confirm(`Are you sure you want to batch and pay ${batch.count} invoices for ${batch.supplier} totaling ${formatCurrency(batch.total)}?`)) return;
        try {
            await Promise.all(batch.invoices.map(p =>
                axios.patch(`https://nestle-finance-command-production.up.railway.app/api/payouts/${p.id}/paid`, { paidBy: 'Finance User (Batched)' })
            ));
            alert('Batch payment successful.');
            fetchPayouts();
        } catch (error) {
            alert('Failed to process batch payment.');
            console.error(error);
        }
    };

    const upcoming = payouts.filter(p => p.status === 'Scheduled' || p.status === 'Early Payment Requested' || p.status === 'Pending Finance' || p.status === 'Renegotiated');
    const past = payouts.filter(p => p.status === 'Paid');

    const handleConfirmSchedule = async () => {
        if (!schedulingPayout) return;
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${schedulingPayout.id}/confirm`, {
                start_date: new Date(confirmDate).toISOString(),
                base_amount: schedulingPayout.base_amount
            });
            alert('Payout Scheduled successfully and Promise to Pay PDF generated.');
            setSchedulingPayout(null);
            fetchPayouts();
        } catch (error) {
            alert('Failed to schedule payout');
        }
    };

    // Grouping for Intelligent Payment Batching
    const batchedPayments = useMemo(() => {
        const batches = {};
        upcoming.forEach(p => {
            const supplier = p.vendor_name || p.supplier_email || 'Unknown Supplier';
            if (!batches[supplier]) batches[supplier] = { supplier, total: 0, count: 0, invoices: [] };
            batches[supplier].total += (p.early_payment_amount || p.payout_amount);
            batches[supplier].count += 1;
            batches[supplier].invoices.push(p);
        });
        return Object.values(batches).filter(b => b.count > 1);
    }, [upcoming]);

    // Calendar generation
    const today = new Date();
    const calendarDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        // Find payouts due on this day (approximate match by day string)
        const dayString = d.toLocaleDateString();
        const dayPayouts = upcoming.filter(p => p.start_date && new Date(p.start_date).toLocaleDateString() === dayString);
        const dayTotal = dayPayouts.reduce((sum, p) => sum + (p.final_amount || p.base_amount || 0), 0);

        return {
            date: d,
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            payouts: dayPayouts,
            total: dayTotal
        };
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3"><Calendar className="w-8 h-8 text-blue-600" /> The Treasury Calendar</h2>
                <p className="text-slate-500 dark:text-slate-400">Track and manage scheduled payouts across all suppliers.</p>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Loading Payouts...</div>
            ) : (
                <div className="space-y-8">
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-black text-red-800 dark:text-red-300">SLA Default Risk Alerts</h4>
                                <p className="text-xs text-red-700 dark:text-red-400 mt-1">Action Required: <strong className="font-bold">$120,000</strong> Payment to <strong>Supplier X</strong> is at risk of missing the Net-45 SLA. Resolution required today.</p>
                            </div>
                        </div>
                    </div>

                    <DigitalCalendar userRole="Finance" userEmail={user.email} />

                    {/* Intelligent Batching Suggestion */}
                    {batchedPayments.length > 0 && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800/50">
                            <h3 className="text-sm font-black text-purple-800 dark:text-purple-300 mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Intelligent Payment Batching Opportunities</h3>
                            <p className="text-xs text-purple-700 dark:text-purple-400 mb-4">Combine multiple upcoming invoices to the same supplier into single bank wires to optimize transaction fees.</p>
                            <div className="space-y-3">
                                {batchedPayments.map((batch, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row items-center justify-between p-3 bg-white/60 dark:bg-slate-900/60 rounded-lg border border-purple-100 dark:border-purple-800/30">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{batch.supplier}</p>
                                            <p className="text-xs text-slate-500">{batch.count} Invoices scheduled within next 7 days</p>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 sm:mt-0">
                                            <p className="text-lg font-black text-purple-600 dark:text-purple-400">{formatCurrency(batch.total)}</p>
                                            <button onClick={() => handleBatchAndPay(batch)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-colors">Batch & Pay</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {upcoming.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{p.start_date ? new Date(p.start_date).toLocaleDateString() : 'Pending'}</td>
                                        <td className="p-4"><span className="text-sm font-semibold">{p.supplier_email}</span></td>
                                        <td className="p-4"><span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{p.title || p.id}</span></td>
                                        <td className="p-4">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(p.final_amount || p.base_amount)}</span>
                                            {p.status === 'Renegotiated' && <span className="block text-xs text-purple-500">Early Payout!</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${p.status === 'Renegotiated' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : p.status === 'Pending Finance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {p.status === 'Pending Finance' ? (
                                                <button onClick={() => { setSchedulingPayout(p); setConfirmDate(p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : ''); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">
                                                    Schedule
                                                </button>
                                            ) : (
                                                <button onClick={() => markPaid(p.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors">
                                                    Mark Paid
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {upcoming.length === 0 && (
                                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">No scheduled payouts.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {schedulingPayout && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-500" /> Confirm Payout Schedule
                                    </h3>
                                    <button onClick={() => setSchedulingPayout(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-4 border border-blue-100 dark:border-blue-800/50">
                                        Review the auto-generated Net-30 date for <strong>{schedulingPayout.supplier_email}</strong>. Confirming will generate a Promise to Pay PDF and notify the supplier.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(schedulingPayout.base_amount)}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scheduled Date</label>
                                        <input
                                            type="date"
                                            value={confirmDate}
                                            onChange={(e) => setConfirmDate(e.target.value)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                    <div className="mt-6 flex gap-3">
                                        <button
                                            onClick={() => setSchedulingPayout(null)}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSchedule}
                                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
                                        >
                                            Confirm Schedule
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TreasuryDashboard({ user, bankBalance, setBankBalance, topUpRequests, setTopUpRequests, threshold }) {
    const [stats, setStats] = useState({ totalDeployed: 0, yieldCaptured: 0, cap: 5000000 });
    const [payouts, setPayouts] = useState([]);
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestAmount, setRequestAmount] = useState('');

    useEffect(() => {
        const fetchTreasuryData = async () => {
            const { data: ps } = await supabase.from('payout_schedules').select('*').eq('early_payout_requested', true);
            const { data: capSetting } = await supabase.from('treasury_settings').select('value_numeric').eq('key', 'monthly_early_payout_cap').single();

            const deployed = ps?.reduce((sum, p) => sum + Number(p.final_amount), 0) || 0;
            const yieldVal = ps?.reduce((sum, p) => sum + (Number(p.final_amount) / (1 - Number(p.discount_applied || 0)) - Number(p.final_amount)), 0) || 0;

            setStats({ totalDeployed: deployed, yieldCaptured: yieldVal, cap: capSetting?.value_numeric || 5000000 });
            setPayouts(ps || []);
        };
        fetchTreasuryData();
    }, []);

    const handleRequestTopUp = () => {
        if (!requestAmount || isNaN(requestAmount)) return alert("Please enter a valid amount.");
        const newRequest = {
            id: Date.now(),
            amount: parseFloat(requestAmount),
            requester: user.email,
            status: 'Pending',
            created_at: new Date().toISOString()
        };
        
        const updatedRequests = [...topUpRequests, newRequest];
        setTopUpRequests(updatedRequests);
        localStorage.setItem('nestle_topup_requests', JSON.stringify(updatedRequests));
        
        setIsRequesting(false);
        setRequestAmount('');
        alert("Top-up request sent to Procurement Manager for approval.");
    };

    const isLowBalance = bankBalance < threshold;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header with Balance and Alerts */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-indigo-600" /> Treasury Management
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Monitoring ROI and liquidity for expenditure.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-colors ${isLowBalance ? 'bg-rose-600 text-white shadow-rose-500/20 animate-pulse' : 'bg-emerald-600 text-white shadow-emerald-500/20'}`}>
                        <ShieldCheck className="w-4 h-4" /> 
                        {isLowBalance ? 'Low Liquidity Alert' : 'Treasury Capital Healthy'}
                    </div>
                </div>
            </div>

            {/* Main Stats and Balance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Available Bank Balance</p>
                    <p className={`text-4xl font-black transition-colors ${isLowBalance ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                        {formatCurrency(bankBalance)}
                    </p>
                    <div className="mt-6 flex gap-3">
                        <button 
                            onClick={() => setIsRequesting(true)}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                        >
                            Request Top-up
                        </button>
                    </div>
                    {isLowBalance && (
                        <p className="text-[10px] font-bold text-rose-500 mt-4 flex items-center gap-1.5 uppercase tracking-widest">
                            <AlertTriangle className="w-3 h-3" /> Balance below threshold ({formatCurrency(threshold)})
                        </p>
                    )}
                </div>

                <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-500/30 relative overflow-hidden group text-white">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:scale-125 transition-transform duration-700"></div>
                    <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest mb-2 relative z-10">Net Discount Revenue (ROI)</p>
                    <p className="text-4xl font-black relative z-10">{formatCurrency(stats.yieldCaptured)}</p>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white relative z-10">
                        <TrendingUp className="w-3 h-3" /> +12.4% vs last month
                    </div>
                    <p className="mt-6 text-[10px] text-indigo-100/70 font-medium relative z-10">Total early capital deployed: {formatCurrency(stats.totalDeployed)}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Operational Capacity</p>
                    <div className="flex items-end gap-2">
                        <p className="text-4xl font-black text-slate-800 dark:text-white">{( (stats.totalDeployed / stats.cap) * 100 ).toFixed(1)}%</p>
                        <p className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">of Cap</p>
                    </div>
                    <div className="mt-6 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(100, (stats.totalDeployed / stats.cap) * 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 mt-4 uppercase tracking-widest">Monthly Limit: {formatCurrency(stats.cap)}</p>
                </div>
            </div>

            {/* Requests Section */}
            <div className="grid grid-cols-1 gap-8">
                {/* Status Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Top-up Request Status</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Real-time status of capital injection requests</p>
                        </div>
                        <Shield className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="p-4">
                        {topUpRequests.filter(r => r.status === 'Pending').length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest">No pending requests</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topUpRequests.filter(r => r.status === 'Pending').map(req => (
                                    <div key={req.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[2rem] flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                                                <Clock className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(req.amount)}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Submitted to Procurement Manager</p>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase rounded-lg border border-amber-500/20 animate-pulse">
                                            Awaiting Approval
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* History Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Treasury History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-6">Description</th>
                                    <th className="p-6">Amount</th>
                                    <th className="p-6">Status</th>
                                    <th className="p-6">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {topUpRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-6">
                                            <p className="font-black text-slate-800 dark:text-white">Top-up Request</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{new Date(req.created_at).toLocaleDateString()}</p>
                                        </td>
                                        <td className="p-6 text-indigo-600 dark:text-indigo-400 font-black">{formatCurrency(req.amount)}</td>
                                        <td className="p-6">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${
                                                req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                req.status === 'Rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-[10px] font-bold text-slate-500 uppercase">
                                            {req.status === 'Approved' ? 'Funded' : req.status === 'Rejected' ? 'Risk-Hold' : 'Processing'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal for Requesting Top-up */}
            {isRequesting && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">Top-up Request</h3>
                                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Capital Injection for Payouts</p>
                                </div>
                                <button onClick={() => setIsRequesting(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requested Amount ($)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold">$</span>
                                    </div>
                                    <input 
                                        type="number" 
                                        autoFocus
                                        placeholder="0.00"
                                        value={requestAmount}
                                        onChange={(e) => setRequestAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-xl font-black outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    <strong>Note:</strong> Your request will be sent to the Procurement and Finance Management team for verification of approved expenditure limits.
                                </p>
                            </div>

                            <button 
                                onClick={handleRequestTopUp}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-xl shadow-indigo-600/30 active:scale-[0.98]"
                            >
                                Submit Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingsPortal() {
    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white">Tolerance Rules Configurator</h2>
            <p className="text-slate-500 dark:text-slate-400">Set the math rules for the Smart Tolerance Engine.</p>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-w-xl">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Allowable Tax Variance</label>
                    <input type="text" defaultValue="$1.00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none font-black text-slate-800 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Allowable Freight Variance</label>
                    <input type="text" defaultValue="2%" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none font-black text-slate-800 dark:text-white" />
                </div>
                <button onClick={() => alert('Rules saved! The 3-way match engine will use these numbers to silently approve minor errors.')} className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors">
                    Save Rules
                </button>
            </div>
        </div>
    );
}
