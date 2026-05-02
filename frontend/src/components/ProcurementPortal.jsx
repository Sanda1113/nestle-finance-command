import { useState, useEffect } from 'react';
import { 
    ShieldCheck, 
    DollarSign, 
    Clock, 
    CheckCircle2, 
    X, 
    TrendingUp, 
    AlertTriangle, 
    LogOut, 
    Activity, 
    PieChart as PieIcon,
    BarChart as BarIcon,
    ArrowUpRight,
    Users,
    Briefcase,
    Zap,
    Download
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer 
} from 'recharts';
import { supabase } from '../utils/supabaseClient';

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function ProcurementPortal({ user, onLogout }) {
    const [balance, setBalance] = useState(1250000.50);
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({
        totalApproved: 4500000,
        pendingCount: 0,
        monthlyBudget: 10000000
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchRequests();
        const subscription = supabase
            .channel('procurement_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => fetchRequests())
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        // In a real app, we'd fetch from a 'top_up_requests' table.
        // For this demo, we'll use localStorage to simulate persistence between roles.
        const stored = localStorage.getItem('nestle_topup_requests');
        const parsed = stored ? JSON.parse(stored) : [];
        setRequests(parsed);
        
        const pending = parsed.filter(r => r.status === 'Pending');
        setStats(prev => ({ ...prev, pendingCount: pending.length }));

        // Also fetch balance
        const storedBalance = localStorage.getItem('nestle_treasury_balance');
        if (storedBalance) setBalance(parseFloat(storedBalance));

        setLoading(false);
    };

    const handleApprove = (req) => {
        const updatedRequests = requests.map(r => r.id === req.id ? { ...r, status: 'Approved', approved_by: user.email } : r);
        const newBalance = balance + req.amount;
        
        localStorage.setItem('nestle_topup_requests', JSON.stringify(updatedRequests));
        localStorage.setItem('nestle_treasury_balance', newBalance.toString());
        
        setRequests(updatedRequests);
        setBalance(newBalance);
        
        // Notify Finance
        supabase.from('app_notifications').insert({
            role: 'Finance',
            title: '✅ Top-up Approved',
            message: `Your request for ${formatCurrency(req.amount)} has been approved and funded.`,
            type: 'topup_approved'
        }).then(() => {});

        alert(`Request for ${formatCurrency(req.amount)} approved.`);
    };

    const handleReject = (req) => {
        const updatedRequests = requests.map(r => r.id === req.id ? { ...r, status: 'Rejected', approved_by: user.email } : r);
        localStorage.setItem('nestle_topup_requests', JSON.stringify(updatedRequests));
        setRequests(updatedRequests);
        
        alert(`Request for ${formatCurrency(req.amount)} rejected.`);
    };

    const chartData = [
        { name: 'Jan', approved: 2.1, requested: 2.4 },
        { name: 'Feb', approved: 3.5, requested: 3.8 },
        { name: 'Mar', approved: 2.8, requested: 3.0 },
        { name: 'Apr', approved: 4.5, requested: 4.7 },
        { name: 'May', approved: stats.totalApproved / 1000000, requested: 5.2 },
    ];

    const budgetData = [
        { name: 'Used', value: stats.totalApproved },
        { name: 'Remaining', value: stats.monthlyBudget - stats.totalApproved },
    ];

    const COLORS = ['#6366f1', '#1e293b'];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 p-6 flex flex-col z-50">
                <div className="mb-10 px-2">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg">
                            <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-black text-white tracking-tighter">Nestle<span className="text-indigo-400">Finance</span></h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Procurement Management</p>
                </div>

                <nav className="flex-1 space-y-2">
                    <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        <PieIcon className="w-5 h-5" /> Overview
                    </button>
                    <button onClick={() => setActiveTab('approvals')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all relative ${activeTab === 'approvals' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        <ShieldCheck className="w-5 h-5" /> Approval Queue
                        {stats.pendingCount > 0 && <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">{stats.pendingCount}</span>}
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        <Clock className="w-5 h-5" /> Spend History
                    </button>
                </nav>

                <div className="pt-6 border-t border-slate-800">
                    <div className="bg-slate-800/40 rounded-3xl p-4 border border-slate-700/50 mb-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Treasury Balance</p>
                        <p className="text-lg font-black text-white">{formatCurrency(balance)}</p>
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all font-bold">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-72 p-8 pt-10">
                {/* Top Bar */}
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-3xl font-black text-white">Manager Portal</h2>
                        <p className="text-slate-400 text-sm font-medium mt-1">Welcome back, <span className="text-indigo-400">{user.name}</span>. You have {stats.pendingCount} pending capital requests.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-black text-white text-xs">PM</div>
                            <div className="text-left">
                                <p className="text-[10px] font-black text-white uppercase leading-none">Procurement Lead</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-1">{user.email}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-indigo-500/50 transition-all duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400"><DollarSign className="w-6 h-6" /></div>
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> +12%</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Approved Expenditure</p>
                                <p className="text-2xl font-black text-white">{formatCurrency(stats.totalApproved)}</p>
                            </div>

                            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-rose-500/50 transition-all duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400"><Clock className="w-6 h-6" /></div>
                                    {stats.pendingCount > 0 && <span className="text-[10px] font-black text-rose-400 bg-rose-400/10 px-2 py-1 rounded-lg">High Priority</span>}
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pending Requests</p>
                                <p className="text-2xl font-black text-white">{stats.pendingCount}</p>
                            </div>

                            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-emerald-500/50 transition-all duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400"><ShieldCheck className="w-6 h-6" /></div>
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg">Healthy</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Treasury Health Index</p>
                                <p className="text-2xl font-black text-white">98.2</p>
                            </div>

                            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-amber-500/50 transition-all duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400"><Briefcase className="w-6 h-6" /></div>
                                    <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">Active</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Budget Lines</p>
                                <p className="text-2xl font-black text-white">24</p>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Spend vs Allocation (MTD)</h3>
                                    <BarIcon className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} />
                                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}} />
                                            <Bar dataKey="approved" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="requested" fill="#1e293b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Budget Utilization</h3>
                                    <PieIcon className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="relative h-64 w-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={budgetData} innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                                                    {budgetData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <p className="text-2xl font-black text-white">45%</p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase">Utilized</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'approvals' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Pending Capital Injection Requests</h3>
                                <p className="text-sm text-slate-500 font-medium">Verify and approve liquidity top-ups for the Finance team.</p>
                            </div>
                            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-bold flex items-center gap-2">
                                <Users className="w-4 h-4" /> Management Oversight Active
                            </div>
                        </div>

                        {requests.filter(r => r.status === 'Pending').length === 0 ? (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-20 text-center">
                                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-slate-700" />
                                </div>
                                <h4 className="text-xl font-black text-slate-400 mb-2">Queue is Clear</h4>
                                <p className="text-sm text-slate-600 font-medium max-w-xs mx-auto">All treasury top-up requests have been processed. You're all caught up!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {requests.filter(r => r.status === 'Pending').map(req => (
                                    <div key={req.id} className="bg-slate-900/70 border border-slate-800 rounded-[2.5rem] p-8 flex items-center justify-between group hover:border-indigo-500/30 transition-all duration-300">
                                        <div className="flex items-center gap-8">
                                            <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center border border-indigo-500/20">
                                                <DollarSign className="w-8 h-8 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="text-2xl font-black text-white">{formatCurrency(req.amount)}</h4>
                                                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded uppercase tracking-wider">Treasury Top-up</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {req.requester}</span>
                                                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(req.created_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={() => handleReject(req)}
                                                className="px-6 py-4 bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white font-black rounded-2xl transition-all flex items-center gap-2 group/btn"
                                            >
                                                <X className="w-5 h-5 transition-transform group-hover/btn:rotate-90" /> Reject
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(req)}
                                                className="px-8 py-4 bg-indigo-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
                                            >
                                                <CheckCircle2 className="w-5 h-5" /> Approve & Fund
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                            <div className="px-10 py-8 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Full Transaction Audit Log</h3>
                                <button className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase hover:text-indigo-400 transition-colors">
                                    <Download className="w-3.5 h-3.5" /> Export CSV
                                </button>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-10 py-6">ID</th>
                                        <th className="px-10 py-6">Type</th>
                                        <th className="px-10 py-6">Amount</th>
                                        <th className="px-10 py-6">Requester</th>
                                        <th className="px-10 py-6">Status</th>
                                        <th className="px-10 py-6">Outcome</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {requests.length === 0 ? (
                                        <tr><td colSpan="6" className="px-10 py-20 text-center text-slate-600 italic">No historical records found.</td></tr>
                                    ) : (
                                        requests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-10 py-6 font-mono text-xs text-slate-500">#{req.id.toString().slice(-6)}</td>
                                                <td className="px-10 py-6 font-black text-slate-300">Capital Injection</td>
                                                <td className="px-10 py-6 font-black text-white">{formatCurrency(req.amount)}</td>
                                                <td className="px-10 py-6 text-sm font-medium text-slate-400">{req.requester}</td>
                                                <td className="px-10 py-6">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                        req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                        'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-6 text-[10px] font-bold text-slate-500 uppercase italic">
                                                    {req.status === 'Approved' ? `Signed by ${req.approved_by?.split('@')[0]}` : req.status === 'Rejected' ? 'Risk-Averse Hold' : 'In Review'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
