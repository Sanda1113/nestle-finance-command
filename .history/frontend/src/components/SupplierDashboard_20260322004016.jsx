import { useState } from 'react';
import axios from 'axios';

// 🚀 Helper to format numbers into actual localized currencies
const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null) return '';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        // Fallback just in case the AI returns a weird code
        return `${currencyCode} ${Number(amount).toFixed(2)}`;
    }
};

export default function SupplierDashboard({ user, onLogout }) {
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    const handleUpload = async () => {
        if (!invoiceFile || !poFile) { setError("Upload both files."); return; }
        setLoading(true);
        setError(null);
        setMatchStatus('Pending');
        setDbStatus('Processing...');
        setInvoiceResult(null);
        setPoResult(null);

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

                setInvoiceResult(invData);
                setPoResult(poData);

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
        } catch (err) {
            console.error("Upload Error:", err);
            setError("Failed to process documents. Ensure backend is live.");
            setMatchStatus('Error');
        } finally {
            setLoading(false);
        }
    };

    const DocumentCard = ({ title, data, borderColor, themeColor, isApproved }) => {
        if (!data) return null;

        // Grab the currency safely
        const currency = data.currency || 'USD';

        return (
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col transition-colors`}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{title}</h3>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 mb-6">
                        <div className="col-span-2">
                            <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Name</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={data.vendorName}>{data.vendorName}</p>
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
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {/* 🚀 Dynamic Currency used here */}
                                                    {formatCurrency(item.unitPrice, currency)}
                                                </td>
                                                <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">
                                                    {formatCurrency(item.amount, currency)}
                                                </td>
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
                            {/* 🚀 Dynamic Currency used here */}
                            <span>{formatCurrency(data.subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-bold">Sales Tax:</span>
                            <span>{formatCurrency(data.salesTax, currency)}</span>
                        </div>
                        <div className="flex justify-between font-black text-xl border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                            <span className="text-slate-800 dark:text-slate-100">TOTAL:</span>
                            <span className={isApproved ? 'text-emerald-600 dark:text-emerald-400' : themeColor}>
                                {formatCurrency(data.totalAmount, currency)}
                            </span>
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
                    <button onClick={onLogout} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600 hover:text-white rounded-lg font-bold text-sm transition-colors">Logout</button>
                </div>
            </div>

            <div className="p-8 max-w-7xl mx-auto mt-6">
                <div className="mb-8 text-center md:text-left">
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white">Document Submission</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Upload your Invoice and Purchase Order for instant automated extraction and matching.</p>
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
                            {matchStatus === 'Approved' ? 'Your invoice matched the PO perfectly and has been routed for payment.' : 'The totals do not match, or the AI could not read the documents. Your files have been routed to Finance for manual review.'}
                        </p>
                        <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">{dbStatus}</p>
                    </div>
                )}

                {(invoiceResult || poResult) && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch mt-8">
                        <DocumentCard title="Invoice Extracted Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-600 dark:text-blue-400" isApproved={matchStatus === 'Approved'} />
                        <DocumentCard title="Purchase Order Extracted Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-600 dark:text-purple-400" isApproved={matchStatus === 'Approved'} />
                    </div>
                )}
            </div>
        </div>
    );
}