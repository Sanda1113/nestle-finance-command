import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw, Truck, Tag } from 'lucide-react';
import DisputeChat from './DisputeChat';
import NotificationBell from './NotificationBell';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch (e) { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
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

const safeDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toLocaleString() : d.toLocaleString();
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('inbox');
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [myPOs, setMyPOs] = useState([]);
    const [myLogs, setMyLogs] = useState([]);
    const [myRecons, setMyRecons] = useState([]);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [dbStatus, setDbStatus] = useState('');
    const [error, setError] = useState(null);

    const [expandedLog, setExpandedLog] = useState(null);

    const fetchData = async () => {
        try {
            const [posRes, logsRes, reconsRes] = await Promise.all([
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/logs/${user.email}`),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/reconciliations?email=${encodeURIComponent(user.email)}`)
            ]);

            const sortedPOs = (posRes.data.data || []).sort((a, b) => new Date(b.created_at || b.po_data?.poDate || 0) - new Date(a.created_at || a.po_data?.poDate || 0));

            setMyPOs(sortedPOs);
            setMyLogs(logsRes.data.logs || []);
            setMyRecons(reconsRes.data.data || []);
        } catch (err) { console.error("Failed to fetch data"); }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 500);
        return () => clearInterval(interval);
    }, [user.email]);

    const handleMatchUpload = async () => {
        if (!invoiceFile || !poFile) { setError("Upload both files."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');
        setInvoiceResult(null); setPoResult(null);

        const invForm = new FormData(); invForm.append('invoiceFile', invoiceFile);
        const poForm = new FormData(); poForm.append('invoiceFile', poFile);

        try {
            // Extract BOTH documents via OCR
            const [invRes, poRes] = await Promise.all([
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invForm),
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poForm)
            ]);

            if (invRes.data.success && poRes.data.success) {
                const invData = invRes.data.extractedData;
                const poData = poRes.data.extractedData;

                const invTotal = safeParse(invData.totalAmount);
                let poTotal = safeParse(poData.totalAmount);

                // --- SMART PO FALLBACK ---
                // If OCR couldn't read the PO total (returns 0 or near-0),
                // look it up from the database POs we already have.
                if (poTotal < 1) {
                    // Try to match by PO number extracted from the invoice, or from the PO document
                    const extractedPoNum = invData.poNumber || poData.invoiceNumber || poData.poNumber;
                    const matchedPO = myPOs.find(p =>
                        p.po_number === extractedPoNum ||
                        String(p.po_number).includes(String(extractedPoNum || '').replace(/\D/g, '')) ||
                        String(extractedPoNum || '').includes(String(p.po_number || '').replace(/\D/g, ''))
                    ) || myPOs[0]; // fallback to most recent PO

                    if (matchedPO) {
                        poTotal = safeParse(matchedPO.total_amount);
                        poData.totalAmount = poTotal;
                        poData.poNumber = matchedPO.po_number;
                        poData.vendorName = matchedPO.po_data?.vendorName || poData.vendorName;
                        console.log(`🔍 PO OCR returned 0 — using DB total: ${poTotal} from PO ${matchedPO.po_number}`);
                    }
                }

                invData.totalAmount = invTotal;
                poData.totalAmount = poTotal;

                setInvoiceResult(invData);
                setPoResult(poData);

                // Use 1% tolerance to handle rounding differences between OCR and DB
                const tolerance = Math.max(0.01, poTotal * 0.01);
                let status = 'Matched - Pending Finance Review';

                if (poTotal < 1) {
                    // Still couldn't find PO total — send for manual review but don't block
                    status = 'Matched - Pending Finance Review';
                    setDbStatus('⚠️ PO amount unverified — submitted for Finance manual review.');
                } else if (Math.abs(invTotal - poTotal) > tolerance) {
                    status = 'Discrepancy Detected';
                }

                setMatchStatus(status);
                await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-reconciliation', {
                    invoiceData: invData, poData: poData, matchStatus: status, supplierEmail: user.email
                });
                if (status !== 'Discrepancy Detected') {
                    setDbStatus('✅ Saved to Ledger — submitted to Finance Review Queue.');
                }
            }
        } catch (err) { setError("Processing failed. Please try again."); setMatchStatus('Error'); }
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
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 30px; font-size: 13px; }
                    .letterhead { display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 25px; }
                    .letterhead img { max-width: 70px; margin-right: 20px; }
                    .letterhead-text { text-align: center; }
                    .letterhead-text h1 { color: #0f172a; font-size: 28px; margin: 0; font-weight: 700; }
                    .letterhead-text p { color: #475569; font-size: 12px; margin: 5px 0 0; text-transform: uppercase; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: #2563eb; font-size: 20px; }
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
                    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; clear: both; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    <img src="https://nestlefinancecommand.com/nestle-logo.svg" alt="Nestlé" />
                    <div class="letterhead-text">
                        <h1>Nestlé</h1>
                        <p>Global Procurement Center</p>
                    </div>
                </div>
                <div class="header">
                    <div>
                        <h2>Purchase Order</h2>
                        <p><strong>PO #:</strong> ${poData.poNumber}</p>
                        <p><strong>Date:</strong> ${poData.poDate}</p>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-box">
                        <h3>Buyer</h3>
                        <p>${poData.buyerCompany}</p>
                    </div>
                    <div class="info-box">
                        <h3>Supplier</h3>
                        <p>${poData.supplierDetails}</p>
                    </div>
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
                <div class="footer">This is a system‑generated Purchase Order. Authorized by Nestlé Procurement.</div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);

        if (!po.is_downloaded) {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/purchase_orders/${po.id}/downloaded`);
            fetchData();
        }
    };

    const handleResubmit = async (id) => {
        const realId = String(id).replace('rec-', '');
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/sprint2/reconciliations/${realId}/resubmit`);
            alert('Document removed from review queue. You can now submit a corrected invoice.');
            setMode('match');
            fetchData();
        } catch (e) { alert('Failed to clear for resubmission'); }
    };

    const handleMarkDelivered = async (poNumber) => {
        if (!window.confirm("Are you physically at the Nestle Dock or confirming handover to the carrier?")) return;
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/supplier/mark-delivered', { poNumber });
            alert("✅ Status Updated: The Warehouse Dock has been notified of your arrival.");
            fetchData();
        } catch (e) { alert('Failed to update delivery status.'); }
    };

    const totalPOs = myPOs.length;
    const totalPOValue = myPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);
    const pendingPOs = myPOs.filter(po => !po.is_downloaded).length;
    const totalMatched = myLogs.filter(log => String(log.status || '').toLowerCase().includes('approve')).length;

    const filteredPOs = useMemo(() => {
        if (!searchTerm) return myPOs;
        return myPOs.filter(po =>
            String(po.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            formatCurrency(po.total_amount, po.po_data?.currency).includes(searchTerm)
        );
    }, [myPOs, searchTerm]);

    const normalizedLogs = useMemo(() => {
        return myLogs.map(log => ({
            id: log.id || Math.random().toString(),
            action: String(log.action || log.message || log.title || 'System Update'),
            type: String(log.type || log.document_type || log.sender_role || 'Record'),
            ref: String(log.ref || log.reference_number || log.po_number || log.document_number || 'General'),
            date: log.created_at || log.date || log.timestamp || new Date().toISOString(),
            status: String(log.status || log.match_status || log.state || 'Processed')
        }));
    }, [myLogs]);

    const recentLogs = useMemo(() => {
        return [...normalizedLogs]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);
    }, [normalizedLogs]);

    const transactionTimeline = useMemo(() => {
        return myPOs.map(po => {
            const poNumber = po.po_number;
            const poNumeric = String(poNumber).match(/\d+/)?.[0] || poNumber;

            // Match recon to this PO — try all available fields for robustness
            const relatedRecon = myRecons.find(r => {
                const rPO = String(r.po_number || '').trim();
                const rInv = String(r.invoice_number || '').trim();
                const poPO = String(poNumber || '').trim();
                // Exact match first
                if (rPO === poPO) return true;
                // Numeric digit extraction fallback
                const rPONum = rPO.match(/\d+/)?.[0];
                const rInvNum = rInv.match(/\d+/)?.[0];
                return (rPONum && rPONum === poNumeric) || (rInvNum && rInvNum === poNumeric);
            });

            const relatedLogs = myLogs.filter(log =>
                String(log.ref || '').includes(poNumeric)
            );

            const events = [];

            const boqLog = relatedLogs.find(l =>
                String(l.type || '').toLowerCase().includes('boq') ||
                String(l.action || '').toLowerCase().includes('boq')
            );
            if (boqLog) {
                events.push({
                    label: 'BOQ Submitted',
                    date: boqLog.created_at || boqLog.date,
                    status: 'completed',
                    icon: '📑'
                });
            }

            events.push({
                label: 'PO Generated',
                date: po.created_at || po.po_data?.poDate,
                status: 'completed',
                icon: '📄'
            });

            if (relatedRecon) {
                events.push({
                    label: 'Invoice Submitted',
                    date: relatedRecon.created_at,
                    status: 'completed',
                    icon: '🧾'
                });

                const matchStatus = String(relatedRecon.match_status || '').toLowerCase();
                const isDiscrepancy = matchStatus.includes('discrepancy');
                const isApproved = matchStatus.includes('approve');

                events.push({
                    label: isDiscrepancy ? 'Discrepancy Detected' : 'Documents Matched',
                    date: relatedRecon.updated_at || relatedRecon.created_at,
                    status: isDiscrepancy ? 'warning' : 'completed',
                    icon: isDiscrepancy ? '⚠️' : '✅'
                });

                if (isApproved) {
                    events.push({
                        label: '✅ Finance Approved',
                        date: relatedRecon.updated_at,
                        status: 'completed',
                        icon: '👍'
                    });
                } else if (matchStatus.includes('reject')) {
                    events.push({
                        label: '❌ Finance Rejected',
                        date: relatedRecon.updated_at,
                        status: 'warning',
                        icon: '❌'
                    });
                }

                const isDelivered = po.status === 'Delivered to Dock' || po.po_data?.delivery_timestamp;
                if (isDelivered) {
                    events.push({
                        label: 'Delivered to Dock',
                        date: po.po_data?.delivery_timestamp || po.updated_at,
                        status: 'completed',
                        icon: '🚚'
                    });
                }

                if (isApproved && isDelivered) {
                    events.push({
                        label: 'Payout Initiated',
                        date: new Date().toISOString(),
                        status: 'pending',
                        icon: '💰'
                    });
                }
            }

            events.sort((a, b) => new Date(a.date) - new Date(b.date));

            return {
                poNumber,
                poNumeric,
                totalAmount: po.total_amount,
                currency: po.po_data?.currency,
                events,
                po
            };
        }).filter(t => t.events.length > 0);
    }, [myPOs, myRecons, myLogs]);

    const DocumentCard = ({ title, data, borderColor, themeColor }) => {
        if (!data) return null;
        const currency = data.currency || 'USD';
        return (
            <div className={`bg-slate-900 rounded-xl shadow-sm border-t-[3px] ${borderColor} flex flex-col transition-all hover:shadow-md`}>
                <div className="bg-slate-800/50 p-3.5 border-b border-slate-800">
                    <h3 className="font-bold text-slate-100 text-sm tracking-tight">{title}</h3>
                </div>
                <div className="p-4 grow flex flex-col text-sm">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Vendor Name</p>
                            <p className="font-medium text-slate-200 truncate">{data.vendorName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Doc #</p>
                            <p className="font-medium text-slate-200 truncate">{data.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Date</p>
                            <p className="text-slate-300">{data.invoiceDate}</p>
                        </div>
                    </div>
                    <div className="mb-4 grow">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Line Items</h4>
                        {data.lineItems?.length > 0 ? (
                            <div className="overflow-x-auto rounded border border-slate-700 max-h-40">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                        <tr><th className="px-2 py-1.5 font-semibold w-10">Qty</th><th className="px-2 py-1.5 font-semibold">Item</th><th className="px-2 py-1.5 font-semibold text-right">Price</th><th className="px-2 py-1.5 font-semibold text-right">Total</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {data.lineItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30">
                                                <td className="px-2 py-1.5 text-slate-400">{item.qty}</td>
                                                <td className="px-2 py-1.5 text-slate-200 truncate max-w-[120px]">{item.description}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-400">{formatCurrency(item.unitPrice, currency)}</td>
                                                <td className="px-2 py-1.5 text-right font-medium text-slate-200">{formatCurrency(item.amount, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<p className="text-xs text-slate-400 italic">No items detected.</p>)}
                    </div>
                    <div className="mt-auto border-t border-slate-800 pt-3">
                        <div className="flex justify-between font-bold text-base">
                            <span className="text-slate-200">TOTAL:</span>
                            <span className={themeColor}>{formatCurrency(data.totalAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleNotificationNavigate = (link) => {
        const [path, query] = link.split('?');
        const tab = path.replace('/', '') || 'inbox';
        setMode(tab);
        if (query) {
            const params = new URLSearchParams(query);
            const po = params.get('po');
            if (po) {
                setSearchTerm(po);
                const targetPO = myPOs.find(p => p.po_number === po);
                if (targetPO) setExpandedLog(targetPO.id);
            }
        }
    };

    return (
        <div className="dark">
            <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
                <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 px-6 flex flex-wrap justify-between items-center sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700">
                            <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Nestle<span className="text-slate-200">Supplier</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={fetchData} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Force Refresh Data">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <NotificationBell email={user.email} role="Supplier" onNavigate={handleNotificationNavigate} />
                        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                {user.name?.[0] || user.email[0].toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-300 hidden sm:block">{user.name || user.email}</span>
                        </div>
                        <button type="button" onClick={onLogout} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-300 rounded-full text-xs font-semibold transition-all flex items-center gap-1">🚪 Logout</button>
                    </div>
                </div>

                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Shipments</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400">📦</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Value</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalPOValue)}</p>
                                </div>
                                <div className="w-10 h-10 bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-400">💰</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Pending</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{pendingPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-amber-900/30 rounded-full flex items-center justify-center text-amber-400">⏳</div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Matched Invoices</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalMatched}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400">✅</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex flex-wrap gap-2 bg-slate-900/60 backdrop-blur-sm p-1.5 rounded-xl border border-slate-800">
                                {[
                                    { id: 'inbox', label: '📥 Shipments', color: 'purple' },
                                    { id: 'boq', label: '📑 1. Submit Quote', color: 'blue' },
                                    { id: 'match', label: '⚖️ 2. Submit Inv+PO', color: 'emerald' },
                                    { id: 'logs', label: '📜 Timeline', color: 'amber' }
                                ].map(tab => (
                                    <button
                                        type="button"
                                        key={tab.id}
                                        onClick={() => { setMode(tab.id); setMatchStatus('Pending'); setError(null); setExpandedLog(null); }}
                                        className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === tab.id
                                            ? `bg-gradient-to-r from-${tab.color}-600 to-${tab.color}-700 text-white shadow-md`
                                            : 'text-slate-400 hover:bg-slate-800'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'inbox' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">Active Shipments</h2>
                                            <p className="text-sm text-slate-400">Manage dispatches and notify the Nestle Dock.</p>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search Shipment #..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 pr-3 py-1.5 text-sm border border-slate-700 rounded-lg bg-slate-800 focus:ring-2 focus:ring-purple-500 text-slate-200"
                                            />
                                            <span className="absolute left-3 top-2 text-slate-400">🔍</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredPOs.length === 0 ?
                                            <p className="col-span-full text-sm text-slate-400 p-8 bg-slate-900 rounded-xl border border-slate-800 text-center">No orders found.</p>
                                            : filteredPOs.map(po => {
                                                const isDelivered = po.status === 'Delivered to Dock' || String(po.status || '').includes('Received') || po.po_data?.delivery_timestamp;
                                                const isChatOpen = expandedLog === po.id;

                                                const poNumeric = String(po.po_number || '').match(/\d+/)?.[0] || String(po.po_number);
                                                const relatedRecon = myRecons.find(r => String(r.po_number || '').includes(poNumeric) || String(r.invoice_number || '').includes(poNumeric));
                                                const isFinanceApproved = relatedRecon && String(relatedRecon.match_status || '').toLowerCase() === 'approved';

                                                return (
                                                    <div key={po.id} className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col hover:shadow-lg transition-all group overflow-hidden">
                                                        <div className="p-4">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <p className="text-lg font-black text-slate-100">{getShipmentId(po.po_number)}</p>
                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">PO: {po.po_number}</p>
                                                                </div>
                                                                {po.is_downloaded ?
                                                                    <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-500/20 rounded-full text-[10px] font-bold">Downloaded</span>
                                                                    : <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 ring-1 ring-blue-500/20 animate-pulse rounded-full text-[10px] font-bold">New</span>
                                                                }
                                                            </div>
                                                            <p className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(po.total_amount, po.po_data?.currency)}</p>

                                                            <div className="flex flex-wrap gap-2 mt-4">
                                                                <button type="button" onClick={() => handlePrintPO(po)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${po.is_downloaded ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-sm'}`}>
                                                                    📄 PDF
                                                                </button>

                                                                {!isDelivered ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMarkDelivered(po.po_number)}
                                                                        className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 text-white shadow-sm border border-amber-500"
                                                                        title="Mark as arriving at Dock"
                                                                    >
                                                                        🚚 Mark Delivered
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                                                                        ✅ At Dock
                                                                    </div>
                                                                )}

                                                                <button type="button" onClick={() => setExpandedLog(isChatOpen ? null : po.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${isChatOpen ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                                                                    💬 Chat
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {isChatOpen && (
                                                            <div className="border-t border-slate-800 bg-slate-950 p-4">
                                                                <DisputeChat
                                                                    referenceNumber={po.po_number}
                                                                    userRole="Supplier"
                                                                    userEmail={user.email}
                                                                    contextData={{ status: po.status || 'Dispatched', type: 'Purchase Order/Shipment' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                            )}

                            {mode === 'boq' && (
                                <div className="max-w-2xl animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Submit Quote</h2>
                                        <p className="text-sm text-slate-400">Upload BOQ to generate an Official PO.</p>
                                    </div>
                                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setBoqFile(e.target.files[0])}
                                                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-800/50 cursor-pointer" />
                                            <p className="text-xs text-slate-400 mt-2">Supported: PDF, Images, Excel</p>
                                        </div>
                                        <button type="button" onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full mt-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                                            {loading ? "Digitizing..." : "Submit Quote"}
                                        </button>
                                    </div>
                                    {matchStatus === 'Submitted' && resultData && (
                                        <div className="mt-6">
                                            <div className="p-3 mb-4 bg-emerald-900/30 border border-emerald-800 rounded-lg text-sm text-emerald-300 text-center font-medium flex items-center justify-center gap-2">✅ Sent to Procurement Team</div>
                                            <DocumentCard title="Digitized Extract" data={resultData} borderColor="border-blue-500" themeColor="text-blue-400" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'match' && (
                                <div className="max-w-3xl animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Invoice Clearance</h2>
                                        <p className="text-sm text-slate-400">Upload Invoice and PO for 3-Way Match.</p>
                                    </div>
                                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">📄 Invoice</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setInvoiceFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-blue-900/50 file:text-blue-300 cursor-pointer border border-slate-700 rounded-md p-1.5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">📑 PO</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setPoFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-purple-900/50 file:text-purple-300 cursor-pointer border border-slate-700 rounded-md p-1.5" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg mt-4 disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                                        {loading ? "Matching..." : "Submit Documents"}
                                    </button>

                                    {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                                        <div className="mt-6">
                                            <div className={`p-3 mb-4 rounded-lg text-sm text-center font-medium border ${matchStatus === 'Matched - Pending Finance Review' ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-amber-900/30 border-amber-800 text-amber-300'}`}>
                                                {matchStatus === 'Matched - Pending Finance Review' ? '✅ Perfect Match. Awaiting Finance Approval' : '⚠️ Discrepancy Routed for Review'}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <DocumentCard title="Invoice Data" data={invoiceResult} borderColor="border-blue-500" themeColor="text-blue-400" />
                                                <DocumentCard title="PO Data" data={poResult} borderColor="border-purple-500" themeColor="text-purple-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'logs' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Lifecycle Timeline</h2>
                                        <p className="text-sm text-slate-400">
                                            Complete journey from BOQ submission to payout – one transaction per card.
                                        </p>
                                    </div>

                                    {transactionTimeline.length === 0 ? (
                                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
                                            <p className="text-slate-400">No transaction timeline available yet.</p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                Submit a BOQ or receive a PO to see your first timeline.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {transactionTimeline.map((tx) => (
                                                <div
                                                    key={tx.poNumber}
                                                    className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm"
                                                >
                                                    <div className="bg-slate-800/80 px-5 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400">
                                                                <Tag className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-100">
                                                                    Shipment {getShipmentId(tx.poNumber)}
                                                                </h3>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                                    PO: {tx.poNumber}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-lg font-bold text-slate-100">
                                                                {formatCurrency(tx.totalAmount, tx.currency)}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">Total Value</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-5">
                                                        <div className="relative">
                                                            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-700"></div>

                                                            <div className="space-y-5">
                                                                {tx.events.map((event, idx) => (
                                                                    <div key={idx} className="relative flex items-start gap-4 pl-10">
                                                                        <div
                                                                            className={`absolute left-[13px] w-3 h-3 rounded-full ring-4 ring-slate-900 ${event.status === 'completed'
                                                                                ? 'bg-emerald-500'
                                                                                : event.status === 'warning'
                                                                                    ? 'bg-amber-500'
                                                                                    : 'bg-blue-500'
                                                                                }`}
                                                                        ></div>

                                                                        <div className="flex-1 bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-lg">{event.icon}</span>
                                                                                    <h4 className="font-semibold text-slate-200 text-sm">
                                                                                        {event.label}
                                                                                    </h4>
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400">
                                                                                    {safeDate(event.date)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedLog(expandedLog === tx.poNumber ? null : tx.poNumber)}
                                                                className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                                            >
                                                                💬 {expandedLog === tx.poNumber ? 'Close Chat' : 'Open Dispute Chat'}
                                                            </button>
                                                        </div>

                                                        {expandedLog === tx.poNumber && (
                                                            <div className="mt-3 border-t border-slate-800 pt-4">
                                                                <DisputeChat
                                                                    referenceNumber={tx.poNumber}
                                                                    userRole="Supplier"
                                                                    userEmail={user.email}
                                                                    contextData={{
                                                                        status: tx.po.status || 'Active',
                                                                        type: 'Purchase Order Timeline'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-lg mb-3">⚡ Quick Actions</h3>
                                <div className="space-y-2">
                                    <button type="button" onClick={() => { setMode('boq'); setBoqFile(null); }} className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2">📤 Submit Quote</button>
                                    <button type="button" onClick={() => { setMode('match'); setInvoiceFile(null); setPoFile(null); }} className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2">🔗 Match Invoice & PO</button>
                                    <button type="button" onClick={() => { setMode('logs'); }} className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2">📜 View Timeline</button>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-lg mb-3">🕒 Recent Activity</h3>
                                {recentLogs.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">No recent activity</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recentLogs.map(log => (
                                            <div key={log.id} className="flex items-start gap-2 text-sm border-b border-slate-800 pb-2 last:border-0">
                                                <div className="w-6 text-center">
                                                    {String(log.status || '').toLowerCase().includes('approve') ? '✅' : String(log.status || '').toLowerCase().includes('reject') ? '❌' : '⏳'}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-200 text-xs">{log.action || 'System Action'}</p>
                                                    <p className="text-[10px] text-slate-400">{safeDate(log.date || log.created_at || new Date())}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pendingPOs > 0 && (
                                <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl border border-amber-800 p-5 shadow-sm">
                                    <h3 className="font-bold text-amber-300 flex items-center gap-2 text-lg mb-2">⚠️ Attention Needed</h3>
                                    <p className="text-amber-200">You have {pendingPOs} unread Shipment(s). Download them to proceed.</p>
                                    <button type="button" onClick={() => setMode('inbox')} className="mt-3 text-xs font-bold text-amber-300 underline">View Shipments →</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}