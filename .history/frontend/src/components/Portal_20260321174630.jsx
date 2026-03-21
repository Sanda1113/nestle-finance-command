import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Portal({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('finance');
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
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Admin: {user.email}</p>
                </div>

                <div className="flex-grow py-6 flex flex-col gap-2 px-4 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-500 uppercase px-4 mb-2">Dashboards</p>
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
                {activeTab === 'finance' && <FinancePortal />}
                {activeTab === 'analytics' && <AnalyticsPortal />}
            </div>
        </div>
    );
}

function FinancePortal() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
            setRecords(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRecords(); }, []);

    const handleManualOverride = async (id, newStatus) => {
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/reconciliations/${id}`, { newStatus });
            fetchRecords();
        } catch (err) { alert("Failed to update status."); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Finance Review Queue</h2>
                    <p className="text-slate-500 dark:text-slate-400">Manually override AI decisions and clear exceptions.</p>
                </div>
                <button onClick={fetchRecords} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow">
                    🔄 Refresh Queue
                </button>
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
                            {records.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <td className="p-4 font-mono text-xs text-slate-400">{new Date(r.processed_at).toLocaleDateString()}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{r.vendor_name || 'Unknown'}</td>
                                    <td className="p-4">
                                        <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">{r.invoice_number}</div>
                                        <div className="text-purple-600 dark:text-purple-400 font-medium text-xs">{r.po_number}</div>
                                    </td>
                                    <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.invoice_total}</td>
                                    <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.po_total}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${r.match_status.includes('Approve') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : r.match_status.includes('Reject') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                            {r.match_status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => handleManualOverride(r.id, 'Manual Approve')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 text-slate-600 dark:text-slate-300 font-bold rounded text-xs">Approve</button>
                                        <button onClick={() => handleManualOverride(r.id, 'Manual Reject')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 text-slate-600 dark:text-slate-300 font-bold rounded text-xs">Reject</button>
                                    </td>
                                </tr>
                            ))}
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
        const fetchStats = async () => {
            try {
                const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
                const data = res.data.data || [];
                const approved = data.filter(r => r.match_status && r.match_status.includes('Approve')).length;
                const rejected = data.filter(r => r.match_status && r.match_status.includes('Reject')).length;
                const totalValue = data.reduce((acc, curr) => acc + (Number(curr.invoice_total) || 0), 0);

                setStats({ total: data.length, approved, rejected, value: totalValue });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
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