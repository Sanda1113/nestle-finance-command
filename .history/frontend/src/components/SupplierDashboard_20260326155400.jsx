import { useState, useEffect } from 'react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('inbox');
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [myPOs, setMyPOs] = useState([]);
    const [myLogs, setMyLogs] = useState([]);

    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    const fetchPOs = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`);
            setMyPOs(res.data.data || []);
        } catch (err) { console.error("Failed to fetch POs"); }
    };

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/logs/${user.email}`);
            setMyLogs(res.data.logs || []);
        } catch (err) { console.error("Failed to fetch logs"); }
    };

    useEffect(() => {
        if (mode === 'inbox') fetchPOs();
        if (mode === 'logs') fetchLogs();
    }, [mode, user.email]);

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
                    invoiceData: invData, poData: poData, matchStatus: status, supplierEmail: user.email
                });
                setDbStatus('Saved to Ledger. Timeline updated.');
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

                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-boq', {
                    boqData: data,
                    supplierEmail: user.email,
                    vendorId: user.id || user.email
                });
                setDbStatus('Sent to Procurement Team');
            }
        } catch (err) { setError("Failed to process BOQ."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handlePrintPO = async (po) => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const poData = po.po_data;

        const html = `
            <html>
            <head>
                <title>Purchase Order ${poData.poNumber}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                    .header h1 { margin: 0; color: #2563eb; font-size: 32px; text-transform: uppercase; }
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
                    .terms { margin-top: 80px; clear: both; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #64748b; }
                    .auth { margin-top: 60px; display: flex; justify-content: space-between; }
                    .signature { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 10px; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>Purchase Order</h1>
                        <p><strong>PO Number:</strong> ${poData.poNumber}</p>
                        <p><strong>Date:</strong> ${poData.poDate}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin:0; color:#1e293b;">Nestle Enterprise</h2>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-box"><h3>Buyer Details</h3><p>${poData.buyerCompany}</p></div>
                    <div class="info-box"><h3>Supplier Details</h3><p>${poData.supplierDetails}</p></div>
                </div>
                <table>
                    <thead><tr><th>Qty</th><th>Description</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
                    <tbody>
                        ${poData.lineItems.map(item => `<tr><td>${item.qty}</td><td>${item.description}</td><td class="text-right">${formatCurrency(item.unitPrice, poData.currency)}</td><td class="text-right">${formatCurrency(item.amount, poData.currency)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="summary">
                    <div class="summary-row"><span>Subtotal:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                    <div class="summary-row"><span>Taxes:</span> <span>$0.00</span></div>
                    <div class="summary-row summary-total"><span>Total Payable:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);

        if (!po.is_downloaded) {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/purchase_orders/${po.id}/downloaded`);
            fetchPOs();
        }
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
                            <span className="text-slate-800 dark:text-slate-100">TOTAL AMOUNT:</span>
                            {/* 🚀 FIXED: Properly format the total Amount */}
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
                    <span className="text-sm text-slate-400 font-bold hidden sm:block">ID: {user.id?.slice(0, 8) || user.email}</span>
                    <button onClick={onLogout} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600 hover:text-white rounded-lg font-bold text-sm transition-colors">Logout</button>
                </div>
            </div>

            <div className="p-8 max-w-7xl mx-auto mt-6">

                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-8 max-w-4xl mx-auto md:mx-0">
                    <button onClick={() => { setMode('inbox'); setMatchStatus('Pending'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'inbox' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>📥 PO Inbox</button>
                    <button onClick={() => { setMode('boq'); setMatchStatus('Pending'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'boq' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>1. Submit Quote (BOQ)</button>
                    <button onClick={() => { setMode('match'); setMatchStatus('Pending'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>2. Submit Invoice + PO</button>
                    <button onClick={() => { setMode('logs'); setMatchStatus('Pending'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'logs' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>📜 History & Logs</button>
                </div>

                {mode === 'inbox' && (
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-2">My Purchase Orders</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                            {myPOs.length === 0 ? (
                                <p className="col-span-full text-slate-500 font-bold bg-white dark:bg-slate-900 p-8 rounded-2xl border">No Purchase Orders received yet.</p>
                            ) : (
                                myPOs.map(po => (
                                    <div key={po.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 border-purple-500 p-6 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Official PO</p>
                                                    <p className="text-xl font-black text-slate-800 dark:text-white">{po.po_number}</p>
                                                </div>
                                                {po.is_downloaded ?
                                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase">✅ Downloaded</span>
                                                    :
                                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 animate-pulse rounded-full text-xs font-black uppercase">🌟 New</span>
                                                }
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4"><strong>Total Value:</strong> {formatCurrency(po.total_amount, po.po_data?.currency)}</p>
                                        </div>
                                        <button onClick={() => handlePrintPO(po)} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors">
                                            📄 Download PDF
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {mode === 'logs' && (
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-6">Submission History & Timeline</h2>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider">
                                    <tr><th className="p-4">Date & Time</th><th className="p-4">Document Type</th><th className="p-4">Ref Number</th><th className="p-4">Status / Timeline</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {myLogs.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">No activity logged yet.</td></tr> : null}
                                    {myLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4 font-mono text-xs text-slate-400">{new Date(log.date).toLocaleString()}</td>
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{log.type}</td>
                                            <td className="p-4 text-blue-600 dark:text-blue-400 font-medium">{log.ref}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${log.status?.includes('Approve') || log.status?.includes('Generated') || log.status === 'Downloaded' ? 'bg-emerald-100 text-emerald-700' : log.status?.includes('Reject') || log.status?.includes('Discrepancy') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {mode === 'boq' && (
                    <div className="max-w-4xl">
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-2">Quote & BOQ Submission</h2>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 mt-6">
                            <label className="block text-sm font-bold text-slate-500 uppercase mb-3">Upload BOQ / Estimate</label>
                            <input type="file" accept=".pdf, image/*, .xlsx, .xls" onChange={(e) => setBoqFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
                            <button onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 text-white text-lg font-black rounded-xl mt-6">
                                {loading ? "Digitizing Quote..." : "Submit Quote"}
                            </button>
                        </div>
                        {matchStatus === 'Submitted' && resultData && (
                            <div className="mt-8 max-w-2xl mx-auto">
                                <div className="p-8 rounded-2xl text-center shadow-sm border-2 mb-8 bg-emerald-50 border-emerald-200">
                                    <h3 className="text-3xl font-black mb-2 text-slate-800">✅ Quote Digitized Successfully!</h3>
                                    <p className="text-slate-600 text-lg">Your BOQ has been sent to Procurement to generate a Purchase Order.</p>
                                </div>
                                <DocumentCard title="Digitized BOQ Data" data={resultData} borderColor="border-blue-500" themeColor="text-blue-600" />
                            </div>
                        )}
                    </div>
                )}

                {mode === 'match' && (
                    <div className="max-w-4xl">
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-2">Invoice Clearance</h2>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 flex flex-col md:flex-row gap-6 mt-6">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-500 uppercase mb-3">1. Select Invoice</label>
                                <input type="file" accept=".pdf, image/*" onChange={(e) => setInvoiceFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-500 uppercase mb-3">2. Select PO</label>
                                <input type="file" accept=".pdf, image/*" onChange={(e) => setPoFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-purple-50 file:text-purple-700 cursor-pointer" />
                            </div>
                        </div>
                        <button onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 text-white text-lg font-black rounded-xl mt-6">
                            {loading ? "Extracting AI Data..." : "Submit Documents"}
                        </button>

                        {/* 🚀 FIXED: Display Success Block AND the extracted cards */}
                        {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                            <div className="mt-8">
                                <div className={`p-8 rounded-2xl text-center shadow-sm border-2 mb-8 ${matchStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <h3 className="text-3xl font-black mb-2 text-slate-800">
                                        {matchStatus === 'Approved' ? '✅ Match Successful!' : '⚠️ Discrepancy Detected'}
                                    </h3>
                                    <p className="text-slate-600 text-lg">
                                        {matchStatus === 'Approved' ? 'Your invoice matched the PO perfectly.' : 'The totals do not match. Routed for manual review.'}
                                    </p>
                                    <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">{dbStatus}</p>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                                    <DocumentCard title="Invoice Extracted Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-600" />
                                    <DocumentCard title="Purchase Order Extracted Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-600" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}