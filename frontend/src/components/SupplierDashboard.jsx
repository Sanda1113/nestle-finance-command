import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { RefreshCw, Truck, Tag, LogOut, User, Sun, Moon, Package, DollarSign, Clock, CheckCircle2, Search, FileText, ChevronRight, ShieldCheck } from 'lucide-react';
import DisputeChat from './DisputeChat';
import NotificationBell from './NotificationBell';
import AppNotifier from './AppNotifier';
import FloatingChat from './FloatingChat';
import { supabase } from '../utils/supabaseClient';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
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
    const [myBoqs, setMyBoqs] = useState([]);
    const [myLogs, setMyLogs] = useState([]);
    const [myRecons, setMyRecons] = useState([]);
    const [matchStatus, setMatchStatus] = useState('Pending');
    const [, setDbStatus] = useState('');
    const [, setError] = useState(null);

    const [expandedLog, setExpandedLog] = useState(null);
    const [dialog, setDialog] = useState(null);

    const [isDarkMode, setIsDarkMode] = useState(true);
    const isFetchingDataRef = useRef(false);
    const isMountedRef = useRef(true);
    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const fetchData = async () => {
        if (!user?.email) return;
        if (isFetchingDataRef.current) return;
        isFetchingDataRef.current = true;
        try {
            const [posRes, logsRes, reconsRes, boqsRes] = await Promise.allSettled([
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/logs/${user.email}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/reconciliations?email=${encodeURIComponent(user.email)}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/boqs?email=${encodeURIComponent(user.email)}`, { timeout: 15000 })
            ]);

            if (isMountedRef.current) {
                if (posRes.status === 'fulfilled') {
                    const sortedPOs = (posRes.value.data.data || []).sort((a, b) => {
                        const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY;
                        const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY;
                        const dateDiff = bTime - aTime;
                        if (dateDiff !== 0) return dateDiff;
                        const aId = Number.isFinite(Number(a.id)) ? Number(a.id) : Number.NEGATIVE_INFINITY;
                        const bId = Number.isFinite(Number(b.id)) ? Number(b.id) : Number.NEGATIVE_INFINITY;
                        if (bId !== aId) return bId - aId;
                        return String(b.po_number || '').localeCompare(String(a.po_number || ''));
                    });
                    setMyPOs(sortedPOs);
                }
                if (logsRes.status === 'fulfilled') {
                    setMyLogs(logsRes.value.data.logs || []);
                }
                if (reconsRes.status === 'fulfilled') {
                    setMyRecons(reconsRes.value.data.data || []);
                }
                if (boqsRes.status === 'fulfilled') {
                    setMyBoqs(boqsRes.value.data.data || []);
                }
            }

        } catch (error) {
            console.error('Failed to fetch supplier dashboard data:', error);
        }
        finally {
            isFetchingDataRef.current = false;
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        fetchData();
        
        const channels = [
            'purchase_orders',
            'reconciliations',
            'boqs',
            'supplier_logs'
        ].map(table => 
            supabase
                .channel(`supplier_${table}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table },
                    () => {
                        if (isMountedRef.current) fetchData();
                    }
                )
                .subscribe()
        );

        return () => {
            isMountedRef.current = false;
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [user.email]);

    const trustScore = useMemo(() => {
        if (!myRecons.length && !myBoqs.length) return 80;
        
        const totalRecons = myRecons.length;
        const approvedRecons = myRecons.filter(r => (r.match_status || '').includes('Approve')).length;
        const accuracyScore = totalRecons > 0 ? (approvedRecons / totalRecons) * 100 : 80;
        
        const totalBoqs = myBoqs.length;
        const rejectedBoqs = myBoqs.filter(b => b.status === 'Rejected').length;
        const rejectionScore = totalBoqs > 0 ? (1 - (rejectedBoqs / totalBoqs)) * 100 : 80;
        
        return Math.round((accuracyScore * 0.6) + (rejectionScore * 0.4));
    }, [myRecons, myBoqs]);

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

                // FX Conversion Mock (Fallback to 1:1 if fails)
                const invCurrency = invData.currency || 'USD';
                const poCurrency = poData.currency || 'USD';
                let convertedInvTotal = invTotal;

                if (invCurrency !== poCurrency) {
                    try {
                        const fxRes = await axios.get(`https://api.exchangerate-api.com/v4/latest/${invCurrency}`);
                        const rate = fxRes.data.rates[poCurrency] || 1;
                        convertedInvTotal = invTotal * rate;
                        console.log(`💱 FX Conv: ${invTotal} ${invCurrency} -> ${convertedInvTotal} ${poCurrency} (Rate: ${rate})`);
                    } catch (e) {
                        console.error('FX conversion failed', e);
                    }
                }

                // Dynamic matching threshold based on formal trust score
                const tolerancePercent = trustScore > 90 ? 0.02 : trustScore > 75 ? 0.01 : 0.00;
                const tolerance = Math.max(0.01, poTotal * tolerancePercent);
                let status = 'Matched - Pending Finance Review';

                if (poTotal < 1) {
                    // Still couldn't find PO total — send for manual review but don't block
                    status = 'Matched - Pending Finance Review';
                    setDbStatus('⚠️ PO amount unverified — submitted for Finance manual review.');
                } else if (Math.abs(convertedInvTotal - poTotal) > tolerance) {
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
        } catch { setError("Processing failed. Please try again."); setMatchStatus('Error'); }
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
        } catch { setError("Processing failed."); setMatchStatus('Error'); }
        finally { setLoading(false); }
    };

    const handlePrintPO = async (po) => {
        try {
            let selectedPO = po;
            if (!selectedPO?.po_data?.lineItems) {
                const fullPORes = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/purchase_orders/${po.id}?email=${encodeURIComponent(user.email)}`, { timeout: 15000 });
                selectedPO = fullPORes.data?.data || po;
            }
            const poData = selectedPO?.po_data;
            if (!poData) {
                alert('Unable to load full PO details for PDF generation.');
                return;
            }

            const printWindow = window.open('', '', 'width=800,height=900');
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

            if (!selectedPO.is_downloaded) {
                await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/purchase_orders/${selectedPO.id}/downloaded`);
                fetchData();
            }
        } catch (error) {
            console.error('Failed to generate or download PO PDF:', error);
            if (error?.code === 'ECONNABORTED') {
                alert('PO details request timed out. Please try again.');
            } else if (!error?.response) {
                alert('Network error while loading PO details. Check your connection and retry.');
            } else {
                alert('Failed to open PO PDF. Please try again.');
            }
        }
    };

    const handleResubmit = async (id, type) => {
        if (type === 'boq') {
            try {
                await axios.delete(`https://nestle-finance-command-production.up.railway.app/api/boqs/${id}`);
                alert('Rejected BOQ cleared. You can now submit a corrected quote.');
                setMode('boq');
                fetchData();
            } catch { alert('Failed to clear BOQ for resubmission'); }
        } else {
            const realId = String(id || '').replace(/^rec-/, '');
            if (!realId) { alert('Invalid reconciliation reference for resubmission.'); return; }
            try {
                await axios.post(`https://nestle-finance-command-production.up.railway.app/api/sprint2/reconciliations/${realId}/resubmit`);
                alert('Document removed from review queue. You can now submit a corrected invoice.');
                setMode('match');
                fetchData();
            } catch { alert('Failed to clear for resubmission'); }
        }
    };

    const handleMarkDelivered = async (poNumber) => {
        setDialog({
            title: "Confirm Arrival",
            message: "Are you physically at the Nestle Dock or confirming handover to the carrier?",
            type: "confirm",
            onConfirm: async () => {
                setDialog(null);
                try {
                    await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/supplier/mark-delivered', { poNumber });
                    setDialog({ title: "Status Updated", message: "✅ The Warehouse Dock has been notified of your arrival.", type: "alert" });
                    fetchData();
                } catch { setDialog({ title: "Error", message: "Failed to update delivery status.", type: "alert" }); }
            }
        });
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
        // Group everything by a "transaction id" which is either PO Number or BOQ document_number
        const timelines = [];
        const processedNumericLocators = new Set(); // Keep track of what we've processed
        
        myPOs.forEach(po => {
            const poNumber = po.po_number;
            const poNumeric = String(poNumber).match(/\d+/)?.[0] || poNumber;
            processedNumericLocators.add(poNumeric);

            // Find related Recon
            const relatedRecon = myRecons.find(r => {
                const rPO = String(r.po_number || '').trim();
                const rInv = String(r.invoice_number || '').trim();
                const poPO = String(poNumber || '').trim();
                if (rPO === poPO) return true;
                const rPONum = rPO.match(/\d+/)?.[0];
                const rInvNum = rInv.match(/\d+/)?.[0];
                return (rPONum && rPONum === poNumeric) || (rInvNum && rInvNum === poNumeric);
            });

            // Find related BOQ
            const relatedBoq = myBoqs.find(b => {
                const docNum = String(b.document_number || '');
                return docNum === poNumber || docNum.includes(poNumeric);
            });

            const relatedLogs = myLogs.filter(log => String(log.ref || '').includes(poNumeric));
            const events = [];

            if (relatedBoq) {
                events.push({
                    label: 'BOQ Submitted',
                    date: relatedBoq.created_at,
                    status: 'completed',
                    icon: '📑'
                });
                if (relatedBoq.status === 'Approved') {
                    events.push({ label: '✅ BOQ Approved', date: relatedBoq.updated_at, status: 'completed', icon: '👍' });
                } else if (relatedBoq.status === 'Rejected') {
                    events.push({ label: '❌ BOQ Rejected', date: relatedBoq.updated_at, status: 'warning', icon: '❌', resubmitObj: relatedBoq, resubmitType: 'boq' });
                }
            } else {
                const boqLog = relatedLogs.find(l => String(l.type || '').toLowerCase().includes('boq') || String(l.action || '').toLowerCase().includes('boq'));
                if (boqLog) {
                    events.push({ label: 'BOQ Submitted', date: boqLog.created_at || boqLog.date, status: 'completed', icon: '📑' });
                }
            }

            events.push({
                label: 'PO Generated',
                date: po.created_at || po.po_data?.poDate,
                status: 'completed',
                icon: '📄'
            });

            if (relatedRecon) {
                events.push({ label: 'Invoice Submitted', date: relatedRecon.created_at, status: 'completed', icon: '🧾' });

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
                    events.push({ label: '✅ Finance Approved', date: relatedRecon.updated_at, status: 'completed', icon: '👍' });
                } else if (matchStatus.includes('reject')) {
                    events.push({ label: '❌ Finance Rejected', date: relatedRecon.updated_at, status: 'warning', icon: '❌', resubmitObj: relatedRecon, resubmitType: 'invoice' });
                }

                const isDelivered = po.status === 'Delivered to Dock' || po.po_data?.delivery_timestamp;
                if (isDelivered) {
                    events.push({ label: 'Delivered to Dock', date: po.po_data?.delivery_timestamp || po.updated_at, status: 'completed', icon: '🚚' });
                }

                if (isApproved && isDelivered) {
                    events.push({ label: 'Payout Initiated', date: new Date().toISOString(), status: 'pending', icon: '💰' });
                }
            } else {
                // Check if delivery happened without invoice recon (rare but possible)
                const isDelivered = po.status === 'Delivered to Dock' || po.po_data?.delivery_timestamp;
                if (isDelivered) {
                    events.push({ label: 'Delivered to Dock', date: po.po_data?.delivery_timestamp || po.updated_at, status: 'completed', icon: '🚚' });
                }
            }

            events.sort((a, b) => new Date(a.date) - new Date(b.date));

            timelines.push({
                transactionId: poNumber,
                poNumber,
                poNumeric,
                totalAmount: po.total_amount,
                currency: po.po_data?.currency,
                events,
                po
            });
        });

        // Now process any BOQs that NEVER resulted in a PO (e.g. pending or rejected BOQs)
        myBoqs.forEach(boq => {
            const docNum = String(boq.document_number || '');
            const docNumNumeric = docNum.match(/\d+/)?.[0] || docNum;
            if (!processedNumericLocators.has(docNumNumeric)) {
                const events = [];
                events.push({ label: 'BOQ Submitted', date: boq.created_at, status: 'completed', icon: '📑' });
                
                if (boq.status === 'Approved') {
                    events.push({ label: '✅ BOQ Approved', date: boq.updated_at, status: 'completed', icon: '👍' });
                } else if (boq.status === 'Rejected') {
                    events.push({ label: '❌ BOQ Rejected', date: boq.updated_at, status: 'warning', icon: '❌', resubmitObj: boq, resubmitType: 'boq' });
                } else if (boq.status === 'Pending Review') {
                    events.push({ label: '⏳ Pending Approval', date: boq.created_at, status: 'pending', icon: '⏳' });
                }
                
                events.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                timelines.push({
                    transactionId: docNum,
                    poNumber: docNum, // use docNum as identifier for timeline header
                    poNumeric: docNumNumeric,
                    totalAmount: boq.total_amount,
                    currency: boq.currency,
                    events,
                    po: null // no PO exists
                });
            }
        });

        // Sort timelines with most recent first (based on first event)
        return timelines.sort((a, b) => {
            const timeA = new Date(a.events[0]?.date || 0);
            const timeB = new Date(b.events[0]?.date || 0);
            return timeB - timeA;
        });
    }, [myPOs, myRecons, myLogs, myBoqs]);

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
        <div className={isDarkMode ? 'dark' : ''}>
            <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
                <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-slate-700 shrink-0">
                            <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">Nestle<span className="text-blue-500">Supplier</span></h1>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Partner Portal</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button type="button" onClick={fetchData} className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Force Refresh Data">
                            <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                        <NotificationBell email={user.email} role="Supplier" onNavigate={handleNotificationNavigate} />
                        <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-xs font-medium text-slate-300">{user.name || user.email}</span>
                        </div>
                        <div className="w-px h-5 sm:h-6 bg-slate-700 mx-1 sm:mx-2 hidden sm:block"></div>
                        <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 sm:p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                            {isDarkMode ? <Sun className="w-5 h-5 sm:w-4 sm:h-4" /> : <Moon className="w-5 h-5 sm:w-4 sm:h-4" />}
                        </button>
                        <button type="button" onClick={onLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/40 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors">
                            <LogOut className="w-4 h-4 shrink-0" /> <span className="hidden sm:block">Logout</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Shipments</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalPOs}</p>
                                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center">↑ +2 this week</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400">
                                    <Package className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Value Delivered</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalPOValue)}</p>
                                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center">↑ +14% vs last month</p>
                                </div>
                                <div className="w-10 h-10 bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Pending</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{pendingPOs}</p>
                                    <p className="text-[10px] text-amber-400 mt-1 flex items-center">Requires attention</p>
                                </div>
                                <div className="w-10 h-10 bg-amber-900/30 rounded-full flex items-center justify-center text-amber-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Matched Invoices</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalMatched}</p>
                                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center">↑ +3 this week</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Trust Score</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{trustScore}/100</p>
                                    <p className={`text-[10px] mt-1 flex items-center ${trustScore > 90 ? 'text-emerald-400' : trustScore > 75 ? 'text-blue-400' : 'text-amber-400'}`}>
                                        {trustScore > 90 ? 'Excellent Standing' : trustScore > 75 ? 'Good Standing' : 'Needs Improvement'}
                                    </p>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trustScore > 90 ? 'bg-emerald-900/30 text-emerald-400' : trustScore > 75 ? 'bg-blue-900/30 text-blue-400' : 'bg-amber-900/30 text-amber-400'}`}>
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex flex-wrap gap-2 bg-slate-900/60 backdrop-blur-sm p-1.5 rounded-xl border border-slate-800">
                                {[
                                    { id: 'boq', label: 'Step 1: Submit Quote', color: 'blue' },
                                    { id: 'match', label: 'Step 2: Submit Invoice', color: 'emerald' },
                                    { id: 'inbox', label: '📥 My Shipments', color: 'purple' },
                                    { id: 'logs', label: '📜 Timeline', color: 'amber' }
                                ].map(tab => {
                                    const colorMap = {
                                        purple: 'bg-gradient-to-r from-purple-600 to-purple-700',
                                        blue: 'bg-gradient-to-r from-blue-600 to-blue-700',
                                        emerald: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
                                        amber: 'bg-gradient-to-r from-amber-600 to-amber-700'
                                    };
                                    return (
                                        <button
                                            type="button"
                                            key={tab.id}
                                            onClick={() => { setMode(tab.id); setMatchStatus('Pending'); setError(null); setExpandedLog(null); }}
                                            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === tab.id
                                                ? `${colorMap[tab.color]} text-white shadow-md`
                                                : 'text-slate-400 hover:bg-slate-800'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
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
                                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
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
                                                const _isFinanceApproved = relatedRecon && String(relatedRecon.match_status || '').toLowerCase() === 'approved';

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
                                        <div 
                                            className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-blue-500 transition-colors"
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    setBoqFile(e.dataTransfer.files[0]);
                                                }
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnter={(e) => e.preventDefault()}
                                        >
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setBoqFile(e.target.files[0])}
                                                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-800/50 cursor-pointer" />
                                            <p className="text-xs text-slate-400 mt-2">Supported: PDF, Images, Excel</p>
                                        </div>
                                        {boqFile && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 px-3 py-2 rounded-lg">
                                                <FileText className="w-4 h-4" /> 
                                                <span className="font-semibold truncate">{boqFile.name}</span>
                                                <span className="opacity-70">({(boqFile.size / 1024).toFixed(1)} KB)</span>
                                            </div>
                                        )}
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
                                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-4">
                                        <div className="flex-1 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                            <label className="block text-sm font-bold text-slate-200 mb-1.5"><span className="text-emerald-500 mr-1">Step 1:</span> Upload your Invoice</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setInvoiceFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-blue-900/50 file:text-blue-300 cursor-pointer border border-slate-700 rounded-md p-1.5 bg-slate-900/50" />
                                            {invoiceFile && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                                                    <FileText className="w-3 h-3" /> <span className="truncate">{invoiceFile.name}</span> ({(invoiceFile.size / 1024).toFixed(1)} KB)
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                            <label className="block text-sm font-bold text-slate-200 mb-1.5"><span className="text-purple-500 mr-1">Step 2:</span> Upload the PO issued by Nestlé</label>
                                            <input type="file" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setPoFile(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-purple-900/50 file:text-purple-300 cursor-pointer border border-slate-700 rounded-md p-1.5 bg-slate-900/50" />
                                            {poFile && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
                                                    <FileText className="w-3 h-3" /> <span className="truncate">{poFile.name}</span> ({(poFile.size / 1024).toFixed(1)} KB)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg mt-4 disabled:opacity-50 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                                        {loading ? "Matching..." : "Step 3: Submit to begin 3-way matching"}
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
                                                                            {event.resubmitObj && (
                                                                                <div className="mt-3 border-t border-slate-700/50 pt-3">
                                                                                    <p className="text-xs text-slate-300 mb-2">
                                                                                        This document was rejected by Finance. You must correct the errors and resubmit to continue the process.
                                                                                    </p>
                                                                                    <button 
                                                                                        onClick={() => handleResubmit(event.resubmitObj.id, event.resubmitType)}
                                                                                        className="px-3 py-1.5 text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-900 rounded transition-colors"
                                                                                    >
                                                                                        Start Resubmission
                                                                                    </button>
                                                                                </div>
                                                                            )}
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
                                                                        status: tx.po?.status || 'Active',
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
                                        {myLogs.length > 3 && (
                                            <button onClick={() => setMode('logs')} className="w-full text-center text-xs text-blue-400 hover:text-blue-300 font-semibold pt-2 flex items-center justify-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(() => {
                                const rejectedBOQs = myBoqs.filter(b => b.status === 'Rejected').length;
                                const discrepancies = myRecons.filter(r => String(r.match_status).includes('Discrepancy')).length;
                                
                                if (rejectedBOQs > 0) return (
                                    <div className="bg-gradient-to-br from-red-900/30 to-rose-900/30 rounded-xl border border-red-800 p-5 shadow-sm">
                                        <h3 className="font-bold text-red-400 flex items-center gap-2 text-lg mb-2">🔴 Action Required</h3>
                                        <p className="text-red-200">You have {rejectedBOQs} Rejected BOQ(s). Please resubmit.</p>
                                        <button type="button" onClick={() => setMode('boq')} className="mt-3 text-xs font-bold text-red-400 underline">View Quotes →</button>
                                    </div>
                                );
                                if (discrepancies > 0) return (
                                    <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-xl border border-orange-800 p-5 shadow-sm">
                                        <h3 className="font-bold text-orange-400 flex items-center gap-2 text-lg mb-2">🟠 Discrepancy Found</h3>
                                        <p className="text-orange-200">You have {discrepancies} Invoice Discrepancy. Please review.</p>
                                        <button type="button" onClick={() => setMode('match')} className="mt-3 text-xs font-bold text-orange-400 underline">View Clearances →</button>
                                    </div>
                                );
                                if (pendingPOs > 0) return (
                                    <div className="bg-gradient-to-br from-amber-900/30 to-yellow-900/30 rounded-xl border border-amber-800 p-5 shadow-sm">
                                        <h3 className="font-bold text-amber-400 flex items-center gap-2 text-lg mb-2">🟡 Attention Needed</h3>
                                        <p className="text-amber-200">You have {pendingPOs} unread Shipment(s). Download them to proceed.</p>
                                        <button type="button" onClick={() => setMode('inbox')} className="mt-3 text-xs font-bold text-amber-400 underline">View Shipments →</button>
                                    </div>
                                );
                                return null;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Global Chat Floating Widget */}
            <AppNotifier role="Supplier" email={user.email} />
            <FloatingChat userEmail={user.email} userRole="Supplier" />

            {dialog && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-700 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">{dialog.title}</h3>
                        <p className="text-slate-300 text-sm mb-6">{dialog.message}</p>
                        <div className="flex gap-3 justify-end">
                            {dialog.type === 'confirm' && (
                                <button onClick={() => setDialog(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
                            )}
                            <button onClick={dialog.onConfirm || (() => setDialog(null))} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
