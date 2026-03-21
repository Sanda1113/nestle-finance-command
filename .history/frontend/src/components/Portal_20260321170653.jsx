import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Portal() {
    const [activeTab, setActiveTab] = useState('supplier');
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* ================= SIDEBAR NAVIGATION ================= */}
            <div className="md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10 shrink-0">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-black text-white tracking-tight">Nestle<span className="text-blue-500">Finance</span></h1>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Command Center</p>
                </div>

                <div className="flex-grow py-6 flex flex-col gap-2 px-4 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-500 uppercase px-4 mb-2">Portals</p>
                    <button onClick={() => setActiveTab('supplier')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'supplier' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        🏢 Supplier Upload
                    </button>
                    <button onClick={() => setActiveTab('finance')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'finance' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        📋 Review Queue
                    </button>
                    <button onClick={() => setActiveTab('analytics')} className={`text-left px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
                        📈 Analytics
                    </button>
                </div>

                <div className="p-4 border-t border-slate-800">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-white transition-colors flex items-center justify-center gap-2">
                        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </button>
                </div>
            </div>

            {/* ================= MAIN CONTENT AREA ================= */}
            <div className="flex-grow overflow-y-auto p-4 md:p-8">
                {activeTab === 'supplier' && <SupplierPortal />}
                {activeTab === 'finance' && <FinancePortal />}
                {activeTab === 'analytics' && <AnalyticsPortal />}
            </div>
        </div>
    );
}

// ============================================================================
// 1. SUPPLIER PORTAL (Upload & Compare)
// ============================================================================
function SupplierPortal() {
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [error, setError] = useState(null);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('Not Saved');

    useEffect(() => {
        const processMatchAndSave = async () => {
            if (invoiceResult && poResult) {
                const status = invoiceResult.totalAmount === poResult.totalAmount ? 'Approved' : 'Rejected';
                setMatchStatus(status);
                setDbStatus('Saving...');
                try {
                    await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                        invoiceData: invoiceResult, poData: poResult, matchStatus: status
                    });
                    setDbStatus('Saved');
                } catch (err) {
                    setDbStatus('DB Error');
                }
            }
        };
        processMatchAndSave();
    }, [invoiceResult, poResult]);

    const handleUpload = async () => {
        if (!invoiceFile || !poFile) { setError("Upload both files."); return; }
        setLoading(true); setInvoiceResult(null); setPoResult(null); setError(null); setMatchStatus('Pending'); setDbStatus('Not Saved');

        const invoiceFormData = new FormData(); invoiceFormData.append('invoiceFile', invoiceFile);
        const poFormData = new FormData(); poFormData.append('invoiceFile', poFile);

        try {
            const [invoiceRes, poRes] = await Promise.all([
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invoiceFormData),
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poFormData)
            ]);
            if (invoiceRes.data.success && poRes.data.success) {
                setInvoiceResult(invoiceRes.data.extractedData);
                setPoResult(poRes.data.extractedData);
            }
        } catch (err) {
            setError("Failed to process documents. Ensure backend is live.");
            setMatchStatus('Error');
        } finally {
            setLoading(false);
        }
    };

    const DocumentCard = ({ title, data, borderColor, themeColor, isApproved }) => {
        if (!data) return null;
        return (
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col transition-colors`}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{title}</h3>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                    {/* Top Basic Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 mb-6">
                        <div className="col-span-2">
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Name</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.vendorName}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Document #</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">PO Ref</p>
                            <p className={`font-semibold truncate ${data.poNumber !== 'Not Found' ? themeColor : 'text-amber-600 dark:text-amber-500 italic'}`}>{data.poNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Date</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{data.invoiceDate}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Due Date</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{data.dueDate}</p>
                        </div>
                    </div>

                    {/* Extended Address Info Block */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Address</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-tight">{data.vendorAddress}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Bill To</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-tight">{data.billTo}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Ship To</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-tight">{data.shipTo}</p>
                        </div>
                    </div>

                    <div className="mb-6 flex-grow">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Line Items</h4>
                        {data.lineItems && data.lineItems.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                        <tr><th className="p-2 font-bold w-12">Qty</th><th className="p-2 font-bold">Description</th><th className="p-2 font-bold text-right">Price</th><th className="p-2 font-bold text-right">Amount</th></tr>
                                    </thead>
                                    <tbody>
                                        {data.lineItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-2 text-slate-700 dark:text-slate-400">{item.qty}</td>
                                                <td className="p-2 font-medium text-slate-800 dark:text-slate-300 max-w-[200px] truncate" title={item.description}>{item.description || '-'}</td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">{item.unitPrice}</td>
                                                <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{item.amount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">No line items detected.</p>)}
                    </div>

                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-bold">Subtotal:</span>
                            <span>${data.subtotal?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-bold">Sales Tax:</span>
                            <span>${data.salesTax?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-xl border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                            <span className="text-slate-800 dark:text-slate-100">TOTAL:</span>
                            <span className={isApproved ? 'text-emerald-600 dark:text-emerald-400' : themeColor}>${data.totalAmount?.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Supplier Portal</h2>
                <p className="text-slate-500 dark:text-slate-400">Submit invoices and POs for automated extraction and clearing.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 transition-colors">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">1. Invoice</label>
                    <input type="file" onChange={(e) => setInvoiceFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 cursor-pointer" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">2. Purchase Order</label>
                    <input type="file" onChange={(e) => setPoFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-400 cursor-pointer" />
                </div>
                <button onClick={handleUpload} disabled={loading || !invoiceFile || !poFile} className="px-8 py-3 lg:py-0 bg-slate-800 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white font-bold rounded-xl disabled:bg-slate-300 dark:disabled:bg-slate-800 mt-4 lg:mt-6 transition-colors min-w-[200px]">
                    {loading ? "Extracting AI Data..." : "Process AI Match"}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold">{error}</div>
            )}

            {(invoiceResult || poResult) && (
                <>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center transition-colors">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                            {matchStatus === 'Approved' ? '✅ Match Successful!' : matchStatus === 'Rejected' ? '❌ Discrepancy Detected' : 'Pending...'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            {matchStatus === 'Approved' ? 'Your invoice matches the PO and has been automatically routed for payment.' : 'The totals do not match. This record has been routed to the Finance Team for manual review.'}
                        </p>
                        <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{dbStatus}</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                        <DocumentCard title="Invoice Extracted Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-600 dark:text-blue-400" isApproved={matchStatus === 'Approved'} />
                        <DocumentCard title="Purchase Order Extracted Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-600 dark:text-purple-400" isApproved={matchStatus === 'Approved'} />
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================================
// 2. FINANCE PORTAL (The Review Queue)
// ============================================================================
function FinancePortal() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const fetchRecords = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/reconciliations');
            if (res.data && res.data.data) {
                setRecords(res.data.data);
            } else {
                setRecords([]);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            setFetchError("Unable to connect to the database. Check Supabase Row Level Security (RLS) policies or Backend logs.");
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
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white transition-colors">Finance Review Queue</h2>
                    <p className="text-slate-500 dark:text-slate-400 transition-colors">Manually override AI decisions and clear exceptions.</p>
                </div>
                <button onClick={fetchRecords} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow transition-colors">
                    🔄 Refresh Queue
                </button>
            </div>

            {fetchError && (
                <div className="p-4 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl font-bold">
                    ⚠️ {fetchError}
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors overflow-x-auto">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Fetching Secure Database Records...</div>
                ) : (
                    <table className="w-full text-left text-sm min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider transition-colors">
                            <tr>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">ID</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Vendor</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Invoice / PO</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Inv Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">PO Total</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800">Status</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-right">Manual Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {records.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-mono text-xs text-slate-400">#{r.id}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{r.vendor_name || 'Unknown'}</td>
                                    <td className="p-4">
                                        <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">{r.invoice_number}</div>
                                        <div className="text-purple-600 dark:text-purple-400 font-medium text-xs">{r.po_number}</div>
                                    </td>
                                    <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.invoice_total}</td>
                                    <td className="p-4 font-black text-slate-700 dark:text-slate-300">${r.po_total}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${r.match_status === 'Approved' || r.match_status === 'Manual Approve' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            r.match_status === 'Rejected' || r.match_status === 'Manual Reject' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                            {r.match_status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => handleManualOverride(r.id, 'Manual Approve')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 text-slate-600 dark:text-slate-300 font-bold rounded text-xs transition-colors">
                                            Approve
                                        </button>
                                        <button onClick={() => handleManualOverride(r.id, 'Manual Reject')} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 text-slate-600 dark:text-slate-300 font-bold rounded text-xs transition-colors">
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && !loading && !fetchError && (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-400 italic">No records found. If you see data in Supabase, disable RLS.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// 3. ANALYTICS PORTAL
// ============================================================================
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
                console.error("Analytics Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white transition-colors">Platform Analytics</h2>
                <p className="text-slate-500 dark:text-slate-400 transition-colors">High-level view of AI throughput and financial processing.</p>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Calculating Live Metrics...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Total Documents Processed</p>
                        <p className="text-5xl font-black text-blue-600 dark:text-blue-400">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Auto-Approval Rate</p>
                        <p className="text-5xl font-black text-emerald-500 dark:text-emerald-400">
                            {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">{stats.approved} Approved / {stats.rejected} Rejected</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Total Value Processed</p>
                        <p className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-2">${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            )}
        </div>
    );
}