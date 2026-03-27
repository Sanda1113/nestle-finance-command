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
        const interval = setInterval(() => {
            if (mode === 'inbox') fetchPOs();
            if (mode === 'logs') fetchLogs();
        }, 1000);
        return () => clearInterval(interval);
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
                if (invData.totalAmount > 0 && poData.totalAmount > 0 && invData.totalAmount === poData.totalAmount) status = 'Approved';
                setMatchStatus(status);
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                    invoiceData: invData, poData: poData, matchStatus: status, supplierEmail: user.email
                });
                setDbStatus('Saved to Ledger. Timeline updated.');
            }
        } catch (err) { setError("Processing failed."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handleBoqUpload = async () => {
        if (!boqFile) { setError("Please select a BOQ file."); return; }
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
                    boqData: data, supplierEmail: user.email, vendorId: user.id || user.email
                });
                setDbStatus('Sent to Procurement Team');
            }
        } catch (err) { setError("Processing failed."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handlePrintPO = async (po) => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const poData = po.po_data;
        const html = `
            <html>
            <head>
                <title>PO ${poData.poNumber}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 30px; font-size: 13px; }
                    .letterhead { text-align: center; border-bottom: 3px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; }
                    .letterhead h1 { color: #2563eb; font-size: 32px; margin: 0; font-family: Impact, sans-serif; letter-spacing: 1px; }
                    .letterhead p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-box { width: 45%; }
                    .info-box h3 { font-size: 11px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
                    .info-box p { margin: 4px 0; white-space: pre-wrap; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 10px; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
                    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                    .text-right { text-align: right; }
                    .summary { width: 40%; float: right; }
                    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
                    .summary-total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; margin-top: 5px; padding-top: 8px; }
                </style>
            </head>
            <body>
                <div class="letterhead"><h1>Nestlé</h1><p>Global Procurement Center</p></div>
                <div class="header">
                    <div><h2 style="margin:0; font-size: 20px;">Purchase Order</h2><p><strong>PO #:</strong> ${poData.poNumber} <br/> <strong>Date:</strong> ${poData.poDate}</p></div>
                </div>
                <div class="info-section">
                    <div class="info-box"><h3>Buyer</h3><p>${poData.buyerCompany}</p></div>
                    <div class="info-box"><h3>Supplier</h3><p>${poData.supplierDetails}</p></div>
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
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border-t-[3px] ${borderColor} flex flex-col`}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{title}</h3>
                </div>
                <div className="p-4 flex-grow flex flex-col text-sm">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Vendor Name</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.vendorName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Doc #</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Date</p>
                            <p className="text-slate-700 dark:text-slate-300">{data.invoiceDate}</p>
                        </div>
                    </div>
                    <div className="mb-4 flex-grow">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Line Items</h4>
                        {data.lineItems?.length > 0 ? (
                            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700 max-h-40">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
                                        <tr><th className="px-2 py-1.5 font-semibold w-10">Qty</th><th className="px-2 py-1.5 font-semibold">Item</th><th className="px-2 py-1.5 font-semibold text-right">Price</th><th className="px-2 py-1.5 font-semibold text-right">Total</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {data.lineItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{item.qty}</td>
                                                <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{item.description}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-500">{formatCurrency(item.unitPrice, currency)}</td>
                                                <td className="px-2 py-1.5 text-right font-medium text-slate-800 dark:text-slate-200">{formatCurrency(item.amount, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<p className="text-xs text-slate-400 italic">No items detected.</p>)}
                    </div>
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="flex justify-between font-bold text-base">
                            <span className="text-slate-800 dark:text-slate-200">TOTAL:</span>
                            <span className={themeColor}>{formatCurrency(data.totalAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-6 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <h1 className="text-lg font-extrabold tracking-tight">Nestle<span className="text-blue-600">Supplier</span></h1>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 font-medium hidden sm:block bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">ID: {user.id?.slice(0, 8) || user.email}</span>
                    <button onClick={onLogout} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 text-slate-600 dark:text-slate-300 rounded-md text-xs font-semibold transition-colors">Logout</button>
                </div>
            </div>

            <div className="p-4 md:p-6 max-w-6xl mx-auto mt-2">
                <div className="flex flex-wrap gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg mb-6 w-fit">
                    <button onClick={() => { setMode('inbox'); setMatchStatus('Pending'); setError(null); }} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'inbox' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>📥 PO Inbox</button>
                    <button onClick={() => { setMode('boq'); setMatchStatus('Pending'); setError(null); }} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'boq' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>1. Submit Quote</button>
                    <button onClick={() => { setMode('match'); setMatchStatus('Pending'); setError(null); }} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>2. Submit Inv + PO</button>
                    <button onClick={() => { setMode('logs'); setMatchStatus('Pending'); setError(null); }} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'logs' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>📜 Timeline</button>
                </div>

                {mode === 'inbox' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold tracking-tight">Purchase Orders</h2>
                            <p className="text-sm text-slate-500">Official POs dispatched by Nestle Procurement.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            {myPOs.length === 0 ? <p className="col-span-full text-sm text-slate-500 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">No orders found.</p> : myPOs.map(po => (
                                <div key={po.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{po.po_number}</p>
                                        {po.is_downloaded ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 rounded text-[10px] font-bold">Downloaded</span> : <span className="px-2 py-0.5 bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-500/20 animate-pulse rounded text-[10px] font-bold">New</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 font-mono">{formatCurrency(po.total_amount, po.po_data?.currency)}</p>
                                    <button onClick={() => handlePrintPO(po)} className={`w-full mt-auto py-2 text-xs font-bold rounded-lg transition-colors ${po.is_downloaded ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-sm'}`}>
                                        📄 PDF
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'logs' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold tracking-tight">Lifecycle Timeline</h2>
                            <p className="text-sm text-slate-500">Real-time status tracking.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                            {myLogs.length === 0 ? <p className="text-center text-sm text-slate-500 py-4">No activity.</p> : (
                                <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-6 pb-2">
                                    {myLogs.map((log) => (
                                        <div key={log.id} className="relative pl-5">
                                            <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-white dark:ring-slate-900 ${log.status?.includes('Approve') || log.status?.includes('Generated') || log.status === 'Downloaded' ? 'bg-emerald-500' : log.status?.includes('Reject') || log.status?.includes('Discrepancy') ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action} <span className="text-slate-400 font-normal">({log.type})</span></h3>
                                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">{log.ref}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset ${log.status?.includes('Approve') || log.status?.includes('Generated') || log.status === 'Downloaded' ? 'bg-emerald-50 text-emerald-600 ring-emerald-500/20' : log.status?.includes('Reject') || log.status?.includes('Discrepancy') ? 'bg-red-50 text-red-600 ring-red-500/20' : 'bg-amber-50 text-amber-600 ring-amber-500/20'}`}>{log.status}</span>
                                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(log.date).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'boq' && (
                    <div className="max-w-2xl animate-in fade-in duration-300">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold tracking-tight">Submit Quote</h2>
                            <p className="text-sm text-slate-500">Upload BOQ to generate an Official PO.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setBoqFile(e.target.files[0])}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                            <button onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full mt-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                                {loading ? "Digitizing..." : "Submit"}
                            </button>
                        </div>
                        {matchStatus === 'Submitted' && resultData && (
                            <div className="mt-6">
                                <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 text-center font-medium">✅ Sent to Procurement</div>
                                <DocumentCard title="Digitized Extract" data={resultData} borderColor="border-blue-500" themeColor="text-blue-600" />
                            </div>
                        )}
                    </div>
                )}

                {mode === 'match' && (
                    <div className="max-w-3xl animate-in fade-in duration-300">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold tracking-tight">Invoice Clearance</h2>
                            <p className="text-sm text-slate-500">Upload Invoice and PO for 3-Way Match.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">1. Invoice</label>
                                <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setInvoiceFile(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-md p-1.5" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">2. PO</label>
                                <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setPoFile(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-purple-50 file:text-purple-700 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-md p-1.5" />
                            </div>
                        </div>
                        <button onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg mt-4 disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                            {loading ? "Matching..." : "Submit Documents"}
                        </button>

                        {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                            <div className="mt-6">
                                <div className={`p-3 mb-4 rounded-lg text-sm text-center font-medium border ${matchStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                    {matchStatus === 'Approved' ? '✅ Perfect Match' : '⚠️ Discrepancy Routed for Review'}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <DocumentCard title="Invoice Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-600" />
                                    <DocumentCard title="PO Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-600" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}