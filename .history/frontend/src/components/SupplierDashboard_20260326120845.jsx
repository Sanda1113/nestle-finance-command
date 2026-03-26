import { useState } from 'react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null) return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('match'); // 'match' or 'boq'
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null); // Used for BOQ
    const [invoiceResult, setInvoiceResult] = useState(null); // Used for Match
    const [poResult, setPoResult] = useState(null); // Used for Match

    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

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
                if (invData.totalAmount > 0 && poData.totalAmount > 0 && invData.totalAmount === poData.totalAmount) {
                    status = 'Approved';
                }
                setMatchStatus(status);
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                    invoiceData: invData, poData: poData, matchStatus: status
                });
                setDbStatus('Saved to Ledger');
            }
        } catch (err) { setError("Failed to process documents."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handleBoqUpload = async () => {
        if (!boqFile) { setError("Please select a BOQ or Quote file."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');
        setResultData(null);

        const boqForm = new FormData(); boqForm.append('invoiceFile', boqFile);

        try {
            const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', boqForm);
            if (res.data.success) {
                const data = res.data.extractedData;
                setResultData(data);
                setMatchStatus('Submitted');
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-boq', { boqData: data });
                setDbStatus('Sent to Procurement Team');
            }
        } catch (err) { setError("Failed to process BOQ."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const DocumentCard = ({ title, data, borderColor, themeColor }) => {
        if (!data) return null;
        const currency = data.currency || 'USD';

        return (
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col transition-colors`}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{title}</h3>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6">
                        <div className="col-span-2">
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Name</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.vendorName}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Document #</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Date</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{data.invoiceDate}</p>
                        </div>
                    </div>

                    <div className="mb-6 flex-grow">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Line Items Extracted</h4>
                        {data.lineItems && data.lineItems.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                        <tr><th className="p-2 font-bold w-12">Qty</th><th className="p-2 font-bold">Description</th><th className="p-2 font-bold text-right">Price</th><th className="p-2 font-bold text-right">Total</th></tr>
                                    </thead>
                                    <tbody>
                                        {data.lineItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                <td className="p-2 text-slate-700 dark:text-slate-400">{item.qty}</td>
                                                <td className="p-2 font-medium text-slate-800 dark:text-slate-300 max-w-[200px] truncate" title={item.description}>{item.description || '-'}</td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.unitPrice, currency)}</td>
                                                <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(item.amount, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 p-3 rounded-lg border">No items detected.</p>)}
                    </div>

                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                        <div className="flex justify-between font-black text-xl">
                            <span className="text-slate-800 dark:text-slate-100">ESTIMATE TOTAL:</span>
                            <span className={themeColor}>{formatCurrency(data.totalAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="bg-slate-900 p-4 px-8 flex justify-between items-center text-white shadow-md">
                <h1 className="text-xl font-black">Nestle<span className="text-blue-500">Supplier</span></h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400 font-bold hidden sm:block">{user.email}</span>
                    <button onClick={onLogout} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600 hover:text-white rounded-lg font-bold text-sm">Logout</button>
                </div>
            </div>

            <div className="p-8 max-w-7xl mx-auto mt-6">

                {/* MODE TOGGLE */}
                <div className="flex space-x-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-8 max-w-md mx-auto md:mx-0">
                    <button onClick={() => setMode('boq')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'boq' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>1. Submit BOQ (Quote)</button>
                    <button onClick={() => setMode('match')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>2. Submit Invoice + PO</button>
                </div>

                <div className="mb-8">
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white">
                        {mode === 'boq' ? 'Quote & BOQ Submission' : 'Invoice Clearance'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {mode === 'boq' ? 'Upload your Bill of Quantities to automatically generate an official Purchase Order.' : 'Upload your Invoice and PO for instant automated clearing.'}
                    </p>
                </div>

                {mode === 'boq' ? (
                    // BOQ UI
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Upload BOQ / Estimate (PDF or Image)</label>
                        <input type="file" onChange={(e) => setBoqFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 cursor-pointer" />
                        <button onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 hover:bg-black text-white text-lg font-black rounded-xl disabled:bg-slate-300 mt-6 transition-colors">
                            {loading ? "Digitizing Quote..." : "Submit Quote"}
                        </button>
                    </div>
                ) : (
                    // INVOICE MATCH UI
                    <>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-500 uppercase mb-3">1. Select Invoice</label>
                                <input type="file" onChange={(e) => setInvoiceFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-500 uppercase mb-3">2. Select PO</label>
                                <input type="file" onChange={(e) => setPoFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-purple-50 file:text-purple-700 cursor-pointer" />
                            </div>
                        </div>
                        <button onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 hover:bg-black text-white text-lg font-black rounded-xl disabled:bg-slate-300 mt-6 transition-colors">
                            {loading ? "Extracting AI Data..." : "Submit Documents"}
                        </button>
                    </>
                )}

                {error && <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-xl font-bold text-center">{error}</div>}

                {/* RESULTS UI */}
                {matchStatus !== 'Pending' && !error && (
                    <div className="mt-8">
                        <div className={`p-8 rounded-2xl text-center shadow-sm border-2 mb-8 ${matchStatus === 'Submitted' || matchStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <h3 className="text-3xl font-black mb-2 text-slate-800">
                                {matchStatus === 'Submitted' ? '✅ Quote Digitized Successfully!' : matchStatus === 'Approved' ? '✅ Match Successful!' : '⚠️ Discrepancy Detected'}
                            </h3>
                            <p className="text-slate-600 text-lg">
                                {matchStatus === 'Submitted' ? 'Your BOQ has been sent to Procurement to generate a Purchase Order.' : matchStatus === 'Approved' ? 'Your invoice matched the PO perfectly.' : 'The totals do not match. Routed for manual review.'}
                            </p>
                            <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">{dbStatus}</p>
                        </div>

                        {mode === 'boq' && resultData && (
                            <div className="max-w-2xl mx-auto"><DocumentCard title="Digitized BOQ Data" data={resultData} borderColor="border-blue-500" themeColor="text-blue-600" /></div>
                        )}

                        {mode === 'match' && (invoiceResult || poResult) && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                                <DocumentCard title="Invoice Extracted Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-600" />
                                <DocumentCard title="Purchase Order Extracted Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-600" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}