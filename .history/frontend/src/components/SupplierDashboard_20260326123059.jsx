import { useState, useEffect } from 'react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null) return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('inbox'); // 'inbox', 'boq', 'match'
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [myPOs, setMyPOs] = useState([]);

    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    // Fetch the supplier's generated POs
    useEffect(() => {
        if (mode === 'inbox') {
            const fetchPOs = async () => {
                try {
                    const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`);
                    setMyPOs(res.data.data || []);
                } catch (err) { console.error("Failed to fetch POs"); }
            };
            fetchPOs();
        }
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
                // Include supplier email so the system knows who this belongs to!
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-boq', { boqData: data, supplierEmail: user.email });
                setDbStatus('Sent to Procurement Team');
            }
        } catch (err) { setError("Failed to process BOQ."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    // 🖨️ PDF PRINT HANDLER
    const handlePrintPO = (po) => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const poData = po.po_data;

        // Generate beautiful HTML for the PDF
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
                    <div class="info-box">
                        <h3>Buyer Details</h3>
                        <p>${poData.buyerCompany}</p>
                    </div>
                    <div class="info-box">
                        <h3>Supplier Details</h3>
                        <p>${poData.supplierDetails}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Qty</th>
                            <th>Description</th>
                            <th class="text-right">Unit Price</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${poData.lineItems.map(item => `
                            <tr>
                                <td>${item.qty}</td>
                                <td>${item.description}</td>
                                <td class="text-right">${formatCurrency(item.unitPrice, poData.currency)}</td>
                                <td class="text-right">${formatCurrency(item.amount, poData.currency)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="summary">
                    <div class="summary-row"><span>Subtotal:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                    <div class="summary-row"><span>Taxes:</span> <span>$0.00</span></div>
                    <div class="summary-row summary-total"><span>Total Payable:</span> <span>${formatCurrency(poData.totalAmount, poData.currency)}</span></div>
                </div>

                <div class="terms">
                    <strong>Terms & Conditions:</strong><br/>
                    Delivery Date: ${poData.deliveryDate} | Delivery Location: ${poData.deliveryLocation} | Payment Terms: ${poData.paymentTerms}
                </div>

                <div class="auth">
                    <div class="signature">Authorized Signature</div>
                    <div class="signature">Company Seal</div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500); // Small delay to ensure CSS loads
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

                {/* 3-TAB MODE TOGGLE */}
                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-8 max-w-2xl mx-auto md:mx-0">
                    <button onClick={() => setMode('inbox')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'inbox' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>📥 PO Inbox</button>
                    <button onClick={() => setMode('boq')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'boq' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>1. Submit Quote (BOQ)</button>
                    <button onClick={() => setMode('match')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>2. Submit Invoice + PO</button>
                </div>

                {/* INBOX MODE */}
                {mode === 'inbox' && (
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-2">My Purchase Orders</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">View and download official Purchase Orders generated by Nestle Procurement.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myPOs.length === 0 ? (
                                <p className="col-span-full p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">No Purchase Orders received yet.</p>
                            ) : (
                                myPOs.map(po => (
                                    <div key={po.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 border-purple-500 p-6 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Official PO</p>
                                                    <p className="text-xl font-black text-slate-800 dark:text-white">{po.po_number}</p>
                                                </div>
                                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-black uppercase">Active</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2"><strong>Total Value:</strong> {formatCurrency(po.total_amount, po.po_data?.currency)}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4"><strong>Items:</strong> {po.po_data?.lineItems?.length || 0} requested</p>
                                        </div>
                                        <button onClick={() => handlePrintPO(po)} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                            📄 Download PDF
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* BOQ MODE */}
                {mode === 'boq' && (
                    <div className="max-w-4xl">
                        <div className="mb-8">
                            <h2 className="text-4xl font-black text-slate-800 dark:text-white">Quote & BOQ Submission</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Upload your Bill of Quantities to automatically generate an official Purchase Order.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Upload BOQ / Estimate (PDF or Image)</label>
                            <input type="file" onChange={(e) => setBoqFile(e.target.files[0])} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 cursor-pointer" />
                            <button onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full py-5 bg-slate-800 dark:bg-blue-600 hover:bg-black text-white text-lg font-black rounded-xl disabled:bg-slate-300 mt-6 transition-colors">
                                {loading ? "Digitizing Quote..." : "Submit Quote"}
                            </button>
                        </div>

                        {matchStatus === 'Submitted' && resultData && (
                            <div className="mt-8 max-w-2xl mx-auto"><DocumentCard title="Digitized BOQ Data" data={resultData} borderColor="border-blue-500" themeColor="text-blue-600" /></div>
                        )}
                    </div>
                )}

                {/* INVOICE MATCH MODE */}
                {mode === 'match' && (
                    <div className="max-w-4xl">
                        <div className="mb-8">
                            <h2 className="text-4xl font-black text-slate-800 dark:text-white">Invoice Clearance</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Upload your Invoice and official PO for instant automated clearing.</p>
                        </div>
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

                        {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch mt-8">
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