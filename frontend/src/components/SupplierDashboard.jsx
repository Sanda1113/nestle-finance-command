import { useState } from 'react';
import axios from 'axios';

export default function SupplierDashboard({ user, onLogout }) {
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    const handleUpload = async () => {
        if (!invoiceFile || !poFile) { setError("Upload both files."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');

        const invoiceFormData = new FormData(); invoiceFormData.append('invoiceFile', invoiceFile);
        const poFormData = new FormData(); poFormData.append('invoiceFile', poFile);

        try {
            const [invoiceRes, poRes] = await Promise.all([
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invoiceFormData),
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poFormData)
            ]);

            if (invoiceRes.data.success && poRes.data.success) {
                const invData = invoiceRes.data.extractedData;
                const poData = poRes.data.extractedData;
                const status = invData.totalAmount === poData.totalAmount ? 'Approved' : 'Rejected';
                setMatchStatus(status);

                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                    invoiceData: invData, poData: poData, matchStatus: status
                });
                setDbStatus('Saved to Ledger');
            }
        } catch (err) {
            setError("Failed to process documents.");
            setMatchStatus('Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="bg-slate-900 p-4 px-8 flex justify-between items-center text-white shadow-md">
                <h1 className="text-xl font-black">Nestle<span className="text-blue-500">Supplier</span></h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400 font-bold hidden sm:block">{user.email}</span>
                    <button onClick={onLogout} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600 hover:text-white rounded-lg font-bold text-sm transition-colors">Logout</button>
                </div>
            </div>

            <div className="p-8 max-w-4xl mx-auto mt-10">
                <div className="mb-8">
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white">Document Submission</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Upload your Invoice and Purchase Order for instant automated clearing.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">1. Select Invoice</label>
                        <input type="file" onChange={(e) => setInvoiceFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 cursor-pointer hover:file:bg-blue-100" />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">2. Select PO</label>
                        <input type="file" onChange={(e) => setPoFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-400 cursor-pointer hover:file:bg-purple-100" />
                    </div>
                </div>

                <button onClick={handleUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white text-lg font-black rounded-xl disabled:bg-slate-300 dark:disabled:bg-slate-800 mt-6 shadow-lg transition-colors">
                    {loading ? "Extracting AI Data..." : "Submit Documents"}
                </button>

                {error && <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-xl font-bold text-center">{error}</div>}

                {matchStatus !== 'Pending' && !error && (
                    <div className={`mt-8 p-8 rounded-2xl text-center shadow-sm border-2 ${matchStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50'}`}>
                        <h3 className="text-3xl font-black mb-2 dark:text-white">
                            {matchStatus === 'Approved' ? '✅ Match Successful!' : '⚠️ Discrepancy Detected'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">
                            {matchStatus === 'Approved' ? 'Your invoice matched the PO perfectly and has been routed for payment.' : 'The totals do not match. Your documents have been securely routed to the Finance Team for manual review.'}
                        </p>
                        <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">{dbStatus}</p>
                    </div>
                )}
            </div>
        </div>
    );
}