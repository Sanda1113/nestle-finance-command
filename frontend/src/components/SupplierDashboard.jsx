import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw, Truck, Tag, LogOut, User, Sun, Moon, Package, DollarSign, Clock, CheckCircle2, Search, FileText, ChevronRight, ShieldCheck, Zap, Activity, Percent, Calendar, TrendingUp } from 'lucide-react';
import DisputeChat from './DisputeChat';
import NotificationBell from './NotificationBell';
import AppNotifier from './AppNotifier';
import FloatingChat from './FloatingChat';
import { supabase } from '../utils/supabaseClient';
import DigitalCalendar from './DigitalCalendar';

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

const JargonText = ({ text, className = "" }) => {
    if (!text) return null;
    const dictionary = {
        'grn': 'Good Receipt Note. The warehouse is currently counting your physical boxes.',
        'variance': 'The amounts on your invoice and our PO do not match.',
        '3-way match': 'Comparing your Invoice, Purchase Order, and the Warehouse Receipt to ensure everything matches.',
        'reconciliation': 'The process of matching your invoice against our records.',
        'discrepancy': 'There is a difference between your submitted document and our records.',
        'delivered to dock': 'Your shipment has arrived at our warehouse and is waiting to be unloaded.',
        'variance flagged': 'The amounts on your invoice and our PO do not match. A finance team member is reviewing it.'
    };
    
    const lowerText = String(text).toLowerCase();
    let matchedJargon = null;
    let description = null;
    
    for (const [jargon, desc] of Object.entries(dictionary)) {
        if (lowerText.includes(jargon)) {
            matchedJargon = jargon;
            description = desc;
            break;
        }
    }
    
    if (!description) return <span className={className}>{text}</span>;
    
    return (
        <span className={`relative group cursor-help inline-block ${className}`}>
            <span className="border-b border-dashed border-slate-400">{text}</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none border border-slate-600">
                <p className="font-bold text-white mb-1 capitalize text-sm">{matchedJargon}</p>
                <p>{description}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
        </span>
    );
};

export default function SupplierDashboard({ user, onLogout }) {
    const [mode, setMode] = useState('inbox');
    const [isSandboxMode, setIsSandboxMode] = useState(false);
    const [sandboxTutorialStep, setSandboxTutorialStep] = useState(0);
    const [showSandboxTutorial, setShowSandboxTutorial] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: null, left: null, placement: 'center' });
    const [spotlightRect, setSpotlightRect] = useState(null);
    const tooltipRef = useRef(null);

    const steps = useMemo(() => [
        {
            title: '🛠️ Welcome to Sandbox Mode',
            body: 'You are now in a safe training environment. Every action you take here is simulated — nothing is sent to Finance, Warehouse, or any backend system. Use this to practice the full workflow risk-free.',
            tip: '✅ Safe to click anything — no real notifications will be triggered.',
            targetId: null
        },
        {
            title: '📥 Tab: My Shipments',
            body: 'This tab shows all your active Purchase Orders (POs). Each card shows the shipment ID, amount, status, creation date, and expected delivery. You can download the official PO PDF and mark a shipment as delivered to the dock.',
            tip: '📄 "Download PO" button opens the PDF. Once downloaded, it turns green as "✅ PO Downloaded" — but you can still re-download anytime.',
            targetId: 'tut-tab-inbox',
            action: () => setMode('inbox')
        },
        {
            title: '📄 Download PO Button',
            body: 'Click here to access the official document. In Sandbox, this is a simulated PDF export.',
            tip: 'Highlighting the download button.',
            targetId: 'tut-pdf-btn',
            action: () => setMode('inbox')
        },
        {
            title: '🚚 Mark Delivered Button',
            body: 'Use this to notify Nestlé\'s Warehouse that your truck has arrived at the dock. In Sandbox Mode this is blocked — clicking it shows a training message instead of sending a real notification.',
            tip: '⚠️ In live mode this triggers a real-time alert to the Warehouse team.',
            targetId: 'tut-mark-delivered',
            action: () => setMode('inbox')
        },
        {
            title: '💬 Dispute Chat (Per Shipment)',
            body: 'Each shipment card has a "💬 Chat" button. This opens a transaction-specific dispute channel between you and the Finance team. Use it when there is a discrepancy or issue with a specific PO/Invoice.',
            tip: '🔔 Finance gets notified when you send a message here. Use it for specific disputes only.',
            targetId: 'tut-chat-btn',
            action: () => setMode('inbox')
        },
        {
            title: '📤 Tab: Step 1 – Submit Quote (BOQ)',
            body: 'Upload your Bill of Quantities (BOQ) PDF or Excel here. Our AI digitizes it and sends it to the Nestlé Procurement team for review and approval. In Sandbox Mode, the OCR runs but no data is saved.',
            tip: '📑 After approval, Procurement generates a Purchase Order (PO) that appears in your "My Shipments" tab.',
            targetId: 'tut-tab-boq',
            action: () => setMode('boq')
        },
        {
            title: '🔗 Tab: Step 2 – Submit Invoice (3-Way Match)',
            body: 'Upload your Invoice AND the Nestlé PO here. Our engine runs a 3-Way Match: Invoice ↔ PO ↔ GRN. If amounts match within tolerance, it goes to Finance for final approval. In Sandbox, no data is sent to Finance.',
            tip: '⚠️ If a discrepancy is detected, Finance is alerted. You can then use the Dispute Chat to resolve it.',
            targetId: 'tut-tab-match',
            action: () => setMode('match')
        },
        {
            title: '📜 Tab: Timeline',
            body: 'This tab shows the complete lifecycle of every transaction — from BOQ submission → PO generation → Invoice match → Warehouse receipt → Payout. Each event has a date/time stamp and status color.',
            tip: '💰 Once Finance approves and Warehouse confirms goods received, the Payout appears at the bottom of the timeline.',
            targetId: 'tut-tab-logs',
            action: () => setMode('logs')
        },
        {
            title: '💸 Tab: Liquidity & Payout Calendar',
            body: 'This tab shows your scheduled payments on a Google Calendar-style view. Blue = Scheduled, Green = Paid, Yellow = On Hold. Click any event to see details. You can also request early payment at a small discount.',
            tip: '⚡ Early payment = get paid today, minus a small % fee. Finance is notified automatically.',
            targetId: 'tut-tab-payouts',
            action: () => setMode('payouts')
        },
        {
            title: '🔍 Search Shipments',
            body: 'Looking for a specific Purchase Order? Type the PO number or amount here to filter your active shipments list instantly.',
            tip: '⌨️ Real-time filtering as you type.',
            targetId: 'tut-search',
            action: () => setMode('inbox')
        },
        {
            title: '📄 Upload Quote (BOQ)',
            body: 'This is where you drop your Bill of Quantities. You can click to browse or simply drag and drop your file onto this area.',
            tip: '📂 Supports PDF, Excel, and Images.',
            targetId: 'tut-boq-input',
            action: () => setMode('boq')
        },
        {
            title: '🧾 Invoice Upload',
            body: 'First step of the 3-Way Match: Upload your official invoice document here.',
            tip: '💡 Ensure the text is clear for the AI scanner.',
            targetId: 'tut-invoice-input',
            action: () => setMode('match')
        },
        {
            title: '📄 PO Reference Upload',
            body: 'Second step of the 3-Way Match: Upload the corresponding Nestle Purchase Order to verify against your invoice.',
            tip: '📑 This enables automated reconciliation.',
            targetId: 'tut-po-input',
            action: () => setMode('match')
        },
        {
            title: '💬 Floating Chat (Bottom Right)',
            body: 'The floating chat bubble (bottom-right corner) is a general-purpose Live Chat with the Finance team. Use this for broad questions not tied to a specific transaction — e.g., account questions, onboarding help.',
            tip: '📌 This is different from the Dispute Chat, which is per-transaction.',
            targetId: 'tut-floating-chat'
        },
        {
            title: '🔄 Force Refresh',
            body: 'Use this button to manually trigger a fresh data pull from the Nestle backend. Useful if you expect a status change but the UI hasn\'t updated yet.',
            tip: '⚡ We use real-time sockets, but a manual refresh is a good fallback.',
            targetId: 'tut-refresh'
        },
        {
            title: '🔔 Notifications Center',
            body: 'Click the bell to see all your recent alerts, including invoice approvals, discrepancies, and new PO releases.',
            tip: '🔴 A red dot indicates unread urgent messages.',
            targetId: 'tut-notifications'
        },
        {
            title: '👤 User Profile',
            body: 'This shows your currently logged-in account details. Ensure your vendor email matches the one on the PO for automatic syncing.',
            tip: '🛠️ Your role is listed here as "Supplier".',
            targetId: 'tut-user'
        },
        {
            title: '🌓 Theme Toggle',
            body: 'Switch between Dark and Light mode. Our dashboard is optimized for high-contrast dark mode to reduce eye strain during long shifts.',
            tip: '🎨 Preference is saved to your browser.',
            targetId: 'tut-theme'
        },
        {
            title: '🚪 Secure Logout',
            body: 'Always log out when finished, especially on shared terminal computers in the warehouse or dispatch office.',
            tip: '🔒 This clears your session tokens.',
            targetId: 'tut-logout'
        },
        {
            title: '📊 Stat: Total Shipments',
            body: 'A quick count of every PO issued to your vendor account in our system.',
            tip: '📈 Hover for more details.',
            targetId: 'tut-stats-shipments'
        },
        {
            title: '💰 Stat: Total Value',
            body: 'The sum total of all goods delivered and confirmed by the Nestle Dock.',
            tip: '💵 Values are converted to your primary currency.',
            targetId: 'tut-stats-value'
        },
        {
            title: '⏳ Stat: Pending Shipments',
            body: 'Shows how many shipments are still in transit or awaiting GRN (Goods Receipt Note) at the dock.',
            tip: '🚚 Priority items should be cleared first.',
            targetId: 'tut-stats-pending'
        },
        {
            title: '✅ Stat: Matched Invoices',
            body: 'Number of invoices that have successfully passed the automated 3-way match logic.',
            tip: '🎉 These are ready for finance disbursement.',
            targetId: 'tut-stats-matched'
        },
        {
            title: '🛡️ Stat: Trust Score',
            body: 'Your supplier reliability rating. High accuracy in BOQs and Invoices keeps this score high.',
            tip: '💎 High scores may qualify for better dynamic discount rates.',
            targetId: 'tut-stats-trust'
        },
        {
            title: '⚡ Quick Action: Submit Quote',
            body: 'Shortcut to the BOQ upload workflow. Use this to start a new transaction quickly.',
            tip: '📑 Use this for Step 1.',
            targetId: 'tut-quick-boq'
        },
        {
            title: '⚡ Quick Action: Match Invoice',
            body: 'Direct link to the 3-Way Match engine. Use this when you have your invoice and PO ready.',
            tip: '🔗 Use this for Step 2.',
            targetId: 'tut-quick-match'
        },
        {
            title: '⚡ Quick Action: Timeline',
            body: 'Fast track to the lifecycle history of all your shipments.',
            tip: '📜 Audit trail is here.',
            targetId: 'tut-quick-logs'
        },
        {
            title: '⚡ Quick Action: Payouts',
            body: 'Access the liquidity engine to view your payment calendar or request early funds.',
            tip: '💸 Manage your cash flow here.',
            targetId: 'tut-quick-payouts'
        },
        {
            title: '✅ You\'re Ready!',
            body: 'You\'ve completed the full Supplier Portal tutorial. In Sandbox Mode you can freely practice any workflow. When you\'re ready for live operations, toggle off Sandbox Mode using the switch in the top navigation bar.',
            tip: '🟢 Toggle off Sandbox to go live. All actions in live mode affect real Finance and Warehouse systems.',
            targetId: null
        }
    ], [setMode]);

    // Elevates the target element above the backdrop — the SVG cutout handles the visual spotlight
    const spotlightClass = (id) => {
        return isSandboxMode && showSandboxTutorial && steps[sandboxTutorialStep]?.targetId === id
            ? 'relative z-[220]'
            : '';
    };

    const [showWalkthrough, setShowWalkthrough] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('hasSeenWalkthrough') !== 'true' : false);
    const [showMicroLearning, setShowMicroLearning] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [poFile, setPoFile] = useState(null);
    const [boqFile, setBoqFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sliderDays, setSliderDays] = useState(2);

    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [invoiceResult, setInvoiceResult] = useState(null);
    const [poResult, setPoResult] = useState(null);
    const [myPOs, setMyPOs] = useState([]);
    const [myBoqs, setMyBoqs] = useState([]);
    const [myLogs, setMyLogs] = useState([]);
    const [myRecons, setMyRecons] = useState([]);
    const [myPayouts, setMyPayouts] = useState([]);
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
            const [posRes, logsRes, reconsRes, boqsRes, payoutsRes] = await Promise.allSettled([
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/pos/${user.email}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/supplier/logs/${user.email}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/reconciliations?email=${encodeURIComponent(user.email)}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/boqs?email=${encodeURIComponent(user.email)}`, { timeout: 15000 }),
                axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts?email=${encodeURIComponent(user.email)}`, { timeout: 15000 })
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
                if (payoutsRes.status === 'fulfilled') {
                    setMyPayouts(payoutsRes.value.data.data || []);
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
            'supplier_logs',
            'payout_schedules',
            'payout_schedule'
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

    useEffect(() => {
        if (mode === 'match') {
            const discrepancies = myRecons.filter(r => String(r.match_status).toLowerCase().includes('discrepancy')).length;
            const rejectedBOQs = myBoqs.filter(b => b.status === 'Rejected').length;
            
            if ((discrepancies >= 1 || rejectedBOQs >= 1) && localStorage.getItem('hasSeenMicroLearning') !== 'true') {
                setShowMicroLearning(true);
            }
        }
    }, [mode, myRecons, myBoqs]);

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
            const [invRes, poRes] = await Promise.all([
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invForm),
                axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poForm)
            ]);

            if (invRes.data.success && poRes.data.success) {
                const invData = invRes.data.extractedData;
                const poData = poRes.data.extractedData;

                const invTotal = safeParse(invData.totalAmount);
                let poTotal = safeParse(poData.totalAmount);

                if (poTotal < 1) {
                    const extractedPoNum = invData.poNumber || poData.invoiceNumber || poData.poNumber;
                    const matchedPO = myPOs.find(p =>
                        p.po_number === extractedPoNum ||
                        String(p.po_number).includes(String(extractedPoNum || '').replace(/\D/g, '')) ||
                        String(extractedPoNum || '').includes(String(p.po_number || '').replace(/\D/g, ''))
                    ) || myPOs[0]; 

                    if (matchedPO) {
                        poTotal = safeParse(matchedPO.total_amount);
                        poData.totalAmount = poTotal;
                        poData.poNumber = matchedPO.po_number;
                        poData.vendorName = matchedPO.po_data?.vendorName || poData.vendorName;
                    }
                }

                invData.totalAmount = invTotal;
                poData.totalAmount = poTotal;

                setInvoiceResult(invData);
                setPoResult(poData);

                const invCurrency = invData.currency || 'USD';
                const poCurrency = poData.currency || 'USD';
                let convertedInvTotal = invTotal;

                if (invCurrency !== poCurrency) {
                    try {
                        const fxRes = await axios.get(`https://api.exchangerate-api.com/v4/latest/${invCurrency}`);
                        const rate = fxRes.data.rates[poCurrency] || 1;
                        convertedInvTotal = invTotal * rate;
                    } catch (e) {
                        console.error('FX conversion failed', e);
                    }
                }

                const tolerancePercent = trustScore > 90 ? 0.02 : trustScore > 75 ? 0.01 : 0.00;
                const tolerance = Math.max(0.01, poTotal * tolerancePercent);
                let status = 'Matched - Pending Finance Review';

                if (poTotal < 1) {
                    status = 'Matched - Pending Finance Review';
                    setDbStatus('⚠️ PO amount unverified — submitted for Finance manual review.');
                } else if (Math.abs(convertedInvTotal - poTotal) > tolerance) {
                    status = 'Discrepancy Detected';
                }

                setMatchStatus(status);
                
                if (isSandboxMode) {
                    setDbStatus('🛠️ Sandbox Mode: OCR and matching simulated successfully. No data sent to Finance.');
                    setLoading(false);
                    return;
                }

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


    const handleAcceptEarlyPayment = async (payoutId, payoutAmount) => {
        const discountRate = 0.02; 
        const discountAmount = payoutAmount * discountRate;
        const earlyPaymentAmount = payoutAmount - discountAmount;
        if (!window.confirm(`Accept Early Payment?\n\nOriginal Amount: ${formatCurrency(payoutAmount)}\nEarly Payment Discount: ${formatCurrency(discountAmount)} (2%)\nAmount you will receive now: ${formatCurrency(earlyPaymentAmount)}`)) return;
        
        try {
            await axios.post(`https://nestle-finance-command-production.up.railway.app/api/payouts/${payoutId}/accept-early-payment`, {
                discountAmount, earlyPaymentAmount, discountRate
            });
            alert('Early payment offer accepted! Finance has been notified to accelerate your payout.');
            fetchData();
        } catch(err) {
            alert('Failed to accept early payment offer.');
        }
    };

    const handleBoqUpload = async () => {
        if (!boqFile) { setError("Please select a BOQ file."); return; }
        setLoading(true); setError(null); setMatchStatus('Pending'); setDbStatus('Processing...');
        setResultData(null);

        try {
            const form = new FormData(); form.append('invoiceFile', boqFile);
            const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', form);
            if (res.data.success) {
                const data = res.data.extractedData;
                setResultData(data);
                setMatchStatus('Submitted');
                if (isSandboxMode) {
                    setDbStatus('🛠️ Sandbox: BOQ digitized. No data sent to Procurement.');
                } else {
                    await axios.post('https://nestle-finance-command-production.up.railway.app/api/save-boq', {
                        boqData: data, supplierEmail: user.email, vendorId: user.id || user.email
                    });
                    setDbStatus('Sent to Procurement Team');
                }
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
        if (isSandboxMode) {
            setDialog({ title: "🛠️ Sandbox Mode", message: "In a real scenario this would notify the Warehouse Dock. No notification was sent — this is a safe training environment.", type: "alert" });
            return;
        }
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

    // Show sandbox tutorial every time sandbox mode is enabled
    useEffect(() => {
        if (isSandboxMode) {
            setSandboxTutorialStep(0);
            setShowSandboxTutorial(true);
        } else {
            setShowSandboxTutorial(false);
        }
    }, [isSandboxMode]);

    // Sync UI state with tutorial step without causing infinite re-renders
    useEffect(() => {
        if (showSandboxTutorial && steps[sandboxTutorialStep]?.action) {
            steps[sandboxTutorialStep].action();
        }
    }, [showSandboxTutorial, sandboxTutorialStep, steps]);

    // Smart tooltip + spotlight positioning — anti-collision across all 4 quadrants
    useEffect(() => {
        if (!showSandboxTutorial) return;
        const targetId = steps[sandboxTutorialStep]?.targetId;
        if (!targetId) {
            setTooltipPos({ top: null, left: null, placement: 'center' });
            setSpotlightRect(null);
            return;
        }
        const run = () => {
            const el = document.getElementById(targetId);
            if (!el) {
                setTooltipPos({ top: null, left: null, placement: 'center' });
                setSpotlightRect(null);
                return;
            }
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                const rect = el.getBoundingClientRect();
                const PAD = 10;
                const sr = {
                    x: rect.left - PAD, y: rect.top - PAD,
                    w: rect.width + PAD * 2, h: rect.height + PAD * 2,
                };
                setSpotlightRect(sr);

                const vw = window.innerWidth, vh = window.innerHeight;
                // Responsive: tooltip width = min(370, viewport-32), but never less than 280
                const ttW = Math.max(280, Math.min(370, vw - 32));
                const ttH = 320; // worst-case height estimate
                const GAP = 14;

                // Checks if a candidate box [t, l, ttW, ttH] overlaps the spotlight rect
                const overlaps = (t, l) => {
                    const r2 = sr;
                    return !(l + ttW < r2.x || l > r2.x + r2.w || t + ttH < r2.y || t > r2.y + r2.h);
                };

                // Clamp helpers
                const clampL = (l) => Math.min(Math.max(l, 8), vw - ttW - 8);
                const clampT = (t) => Math.min(Math.max(t, 8), vh - ttH - 8);

                // Candidate placements in preference order
                const candidates = [
                    { placement: 'below', top: rect.bottom + GAP, left: clampL(rect.left) },
                    { placement: 'above', top: rect.top - ttH - GAP, left: clampL(rect.left) },
                    { placement: 'right', top: clampT(rect.top), left: rect.right + GAP },
                    { placement: 'left', top: clampT(rect.top), left: rect.left - ttW - GAP },
                ];

                // Filter to candidates that fit in viewport
                const fits = candidates.filter(c =>
                    c.top >= 8 && c.top + ttH <= vh - 8 &&
                    c.left >= 8 && c.left + ttW <= vw - 8
                );

                // Pick first that doesn't overlap; fallback to first fitting; fallback safe corner
                const chosen =
                    fits.find(c => !overlaps(c.top, c.left)) ||
                    fits[0] ||
                    { placement: 'corner', top: clampT(vh - ttH - 16), left: clampL(8) };

                setTooltipPos({ top: chosen.top, left: chosen.left, placement: chosen.placement });
            }, 380);
        };
        run();
    }, [showSandboxTutorial, sandboxTutorialStep, steps]);

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
        const timelines = [];
        const processedNumericLocators = new Set();
        
        myPOs.forEach(po => {
            const poNumber = po.po_number;
            const poNumeric = String(poNumber).match(/\d+/)?.[0] || poNumber;
            processedNumericLocators.add(poNumeric);

            const relatedRecon = myRecons.find(r => {
                const rPO = String(r.po_number || '').trim();
                const rInv = String(r.invoice_number || '').trim();
                const poPO = String(poNumber || '').trim();
                if (rPO === poPO) return true;
                const rPONum = rPO.match(/\d+/)?.[0];
                const rInvNum = rInv.match(/\d+/)?.[0];
                return (rPONum && rPONum === poNumeric) || (rInvNum && rInvNum === poNumeric);
            });

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
                    const payout = myPayouts.find(p => p.invoice_ref === relatedRecon.id);
                    if (!payout) {
                        events.push({ label: 'Awaiting Scheduling', date: new Date().toISOString(), status: 'pending', icon: '⏳' });
                    } else {
                        events.push({ label: 'Scheduled (Calendar)', date: payout.created_at, status: payout.status === 'Scheduled' || payout.status === 'Renegotiated' ? 'completed' : 'completed', icon: '🗓️' });
                        
                        if (payout.status === 'Hold') {
                            events.push({ label: 'Payment Hold', date: payout.hold_until_date || new Date().toISOString(), status: 'warning', icon: '⏸️' });
                        }
                        
                        if (payout.status === 'Paid') {
                            if (payout.hold_until_date) {
                                events.push({ label: 'Payment Hold', date: payout.hold_until_date, status: 'completed', icon: '⏸️' });
                            }
                            events.push({ label: 'Paid (Funds Disbursed)', date: payout.updated_at, status: 'completed', icon: '💰', isPaid: true, bankRef: payout.bank_transaction_ref });
                        } else if (payout.status !== 'Hold') {
                            events.push({ label: 'Processing Payment', date: new Date().toISOString(), status: 'pending', icon: '💸' });
                        }
                    }
                }
            } else {
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
                po,
                payout: myPayouts.find(p => p.reconciliation_id === relatedRecon?.id || p.po_number === poNumber)
            });
        });

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
                    poNumber: docNum,
                    poNumeric: docNumNumeric,
                    totalAmount: boq.total_amount,
                    currency: boq.currency,
                    events,
                    po: null 
                });
            }
        });

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
                        <button type="button" id="tut-refresh" onClick={fetchData} className={`p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ${spotlightClass('tut-refresh')}`} title="Force Refresh Data">
                            <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                        <div id="tut-notifications" className={spotlightClass('tut-notifications')}>
                            <NotificationBell email={user.email} role="Supplier" onNavigate={handleNotificationNavigate} />
                        </div>
                        <div id="tut-user" className={`hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full ${spotlightClass('tut-user')}`}>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-xs font-medium text-slate-300">{user.name || user.email}</span>
                        </div>
                        
                        {/* Pre-Flight Sandbox Toggle */}
                        <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-600 transition-colors" title="Practice uploading without sending to Finance">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={isSandboxMode} onChange={() => setIsSandboxMode(!isSandboxMode)} />
                                <div className="w-7 h-4 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                                <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase">Sandbox</span>
                            </label>
                        </div>

                        <div className="w-px h-5 sm:h-6 bg-slate-700 mx-1 sm:mx-2 hidden sm:block"></div>
                        <button type="button" id="tut-theme" onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 sm:p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors ${spotlightClass('tut-theme')}`} title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                            {isDarkMode ? <Sun className="w-5 h-5 sm:w-4 sm:h-4" /> : <Moon className="w-5 h-5 sm:w-4 sm:h-4" />}
                        </button>
                        <button type="button" id="tut-logout" onClick={onLogout} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/40 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors ${spotlightClass('tut-logout')}`} title="Sign out of the Supplier Portal">
                            <LogOut className="w-4 h-4 shrink-0" /> <span className="hidden sm:block">Logout</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        <div id="tut-stats-shipments" className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all ${spotlightClass('tut-stats-shipments')}`} title="Total number of Purchase Orders processed in the portal">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Shipments</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400">
                                    <Package className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div id="tut-stats-value" className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all ${spotlightClass('tut-stats-value')}`} title="Total monetary value of all processed and approved shipments">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Value Delivered</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalPOValue)}</p>
                                </div>
                                <div className="w-10 h-10 bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div id="tut-stats-pending" className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all ${spotlightClass('tut-stats-pending')}`} title="Number of shipments currently awaiting delivery or approval">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Pending</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{pendingPOs}</p>
                                </div>
                                <div className="w-10 h-10 bg-amber-900/30 rounded-full flex items-center justify-center text-amber-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div id="tut-stats-matched" className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all ${spotlightClass('tut-stats-matched')}`} title="Number of invoices that have successfully passed the 3-way match process">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Matched Invoices</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{totalMatched}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                        <div id="tut-stats-trust" className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 hover:shadow-md transition-all ${spotlightClass('tut-stats-trust')}`} title="Your supplier reliability rating based on invoice accuracy and BOQ approval rates">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Trust Score</p>
                                    <p className="text-2xl font-bold text-slate-100 mt-1">{trustScore}/100</p>
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
                                    { id: 'boq', label: 'Step 1: Submit Quote', color: 'blue', title: 'Start a new transaction by submitting a quote (BOQ)' },
                                    { id: 'match', label: 'Step 2: Submit Invoice', color: 'emerald', title: 'Submit your invoice for reconciliation against a Purchase Order' },
                                    { id: 'inbox', label: '📥 My Shipments', color: 'purple', title: 'View and manage your active Purchase Orders and shipments' },
                                    { id: 'logs', label: '📜 Timeline', color: 'amber', title: 'Track the end-to-end history of your documents and payments' },
                                    { id: 'payouts', label: '💸 Liquidity', color: 'indigo', title: 'Access early payment options and view your scheduled payouts' }
                                ].map(tab => {
                                    const colorMap = {
                                        purple: 'bg-gradient-to-r from-purple-600 to-purple-700',
                                        blue: 'bg-gradient-to-r from-blue-600 to-blue-700',
                                        emerald: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
                                        amber: 'bg-gradient-to-r from-amber-600 to-amber-700',
                                        indigo: 'bg-gradient-to-r from-indigo-600 to-indigo-700'
                                    };
                                    return (
                                        <button
                                            type="button"
                                            id={`tut-tab-${tab.id}`}
                                            key={tab.id}
                                            onClick={() => { setMode(tab.id); setMatchStatus('Pending'); setError(null); setExpandedLog(null); }}
                                            title={tab.title}
                                            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === tab.id
                                                ? `${colorMap[tab.color]} text-white shadow-md`
                                                : 'text-slate-400 hover:bg-slate-800'
                                                } ${isSandboxMode && sandboxTutorialStep > 0 && steps[sandboxTutorialStep]?.targetId === `tut-tab-${tab.id}` ? 'ring-4 ring-purple-500 ring-offset-4 ring-offset-slate-900 animate-pulse relative z-[201]' : ''}`}
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
                                                id="tut-search"
                                                placeholder="Search Shipment #..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className={`pl-9 pr-3 py-1.5 text-sm border border-slate-700 rounded-lg bg-slate-800 focus:ring-2 focus:ring-purple-500 text-slate-200 ${spotlightClass('tut-search')}`}
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

                                                            {/* Detail rows */}
                                                            <div className="mt-3 space-y-1.5 text-xs border-t border-slate-800 pt-3">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-slate-500 font-medium">📅 Created</span>
                                                                    <span className="text-slate-300 font-semibold">{po.created_at ? new Date(po.created_at).toLocaleString() : '—'}</span>
                                                                </div>
                                                                {po.updated_at && po.updated_at !== po.created_at && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">🔄 Last Updated</span>
                                                                        <span className="text-slate-300 font-semibold">{new Date(po.updated_at).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                {po.po_data?.delivery_timestamp && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">🚚 Delivered</span>
                                                                        <span className="text-emerald-400 font-semibold">{new Date(po.po_data.delivery_timestamp).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                {po.po_data?.deliveryDate && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">📦 Expected Delivery</span>
                                                                        <span className="text-amber-400 font-semibold">{po.po_data.deliveryDate}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-slate-500 font-medium">📋 Status</span>
                                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                                        String(po.status || '').includes('Paid') || String(po.status || '').includes('Cleared') ? 'bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-600/30' :
                                                                        String(po.status || '').includes('Cancelled') || String(po.status || '').includes('Rejected') ? 'bg-red-900/50 text-red-400 ring-1 ring-red-600/30' :
                                                                        String(po.status || '').includes('Dock') || String(po.status || '').includes('Transit') ? 'bg-amber-900/50 text-amber-400 ring-1 ring-amber-600/30' :
                                                                        'bg-blue-900/50 text-blue-400 ring-1 ring-blue-600/30'
                                                                    }`}>{po.status || 'Pending'}</span>
                                                                </div>
                                                                {po.po_data?.paymentTerms && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">💳 Payment Terms</span>
                                                                        <span className="text-purple-400 font-semibold">{po.po_data.paymentTerms}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 mt-4">
                                                                <button type="button" id="tut-pdf-btn" onClick={() => handlePrintPO(po)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${po.is_downloaded ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-700/50' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-sm'} ${isSandboxMode && steps[sandboxTutorialStep]?.targetId === 'tut-pdf-btn' ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 animate-pulse z-[201]' : ''}`} title={po.is_downloaded ? 'Re-download the Purchase Order PDF' : 'Download the official Purchase Order document'}>
                                                                    {po.is_downloaded ? '✅ PO Downloaded' : '📄 Download PO'}
                                                                </button>

                                                                {!isDelivered ? (
                                                                    <button
                                                                        type="button"
                                                                        id="tut-mark-delivered"
                                                                        onClick={() => handleMarkDelivered(po.po_number)}
                                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 text-white shadow-sm border border-amber-500 ${isSandboxMode && steps[sandboxTutorialStep]?.targetId === 'tut-mark-delivered' ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 animate-pulse z-[201]' : ''}`}
                                                                        title="Notify the warehouse that your shipment has arrived at the dock"
                                                                    >
                                                                        🚚 Mark Delivered
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50" title="This shipment has been marked as delivered to the dock">
                                                                        ✅ At Dock
                                                                    </div>
                                                                )}

                                                                <button type="button" id="tut-chat-btn" onClick={() => setExpandedLog(isChatOpen ? null : po.id)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${isChatOpen ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} ${isSandboxMode && steps[sandboxTutorialStep]?.targetId === 'tut-chat-btn' ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 animate-pulse z-[201]' : ''}`} title="Open a chat to resolve any disputes or issues with this shipment">
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
                                            title="Drag and drop or click to select your Bill of Quantities (BOQ) document"
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    setBoqFile(e.dataTransfer.files[0]);
                                                }
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnter={(e) => e.preventDefault()}
                                        >
                                            <input type="file" id="tut-boq-input" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setBoqFile(e.target.files[0])}
                                                title="Select your Bill of Quantities (BOQ) document"
                                                className={`block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-800/50 cursor-pointer ${spotlightClass('tut-boq-input')}`} />
                                            <p className="text-xs text-slate-400 mt-2">Supported: PDF, Images, Excel</p>
                                        </div>
                                        {boqFile && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 px-3 py-2 rounded-lg">
                                                <FileText className="w-4 h-4" /> 
                                                <span className="font-semibold truncate">{boqFile.name}</span>
                                                <span className="opacity-70">({(boqFile.size / 1024).toFixed(1)} KB)</span>
                                            </div>
                                        )}
                                        <button type="button" onClick={handleBoqUpload} disabled={loading || !boqFile} className="w-full mt-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all shadow-sm hover:shadow-md" title="Send your quote to the Nestlé Procurement Team for approval">
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
                                    
                                    {/* AI Behavior-Triggered Micro-Learning */}
                                    {showMicroLearning && (
                                        <div className="mb-6 bg-gradient-to-r from-blue-900/80 to-indigo-900/80 border border-blue-500/50 p-5 rounded-xl shadow-lg relative overflow-hidden animate-in slide-in-from-top-4">
                                            <button onClick={() => { setShowMicroLearning(false); localStorage.setItem('hasSeenMicroLearning', 'true'); }} className="absolute top-3 right-3 text-blue-300 hover:text-white">✕</button>
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                                    <Activity className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                        <Zap className="w-4 h-4 text-blue-400" /> Personalized Tip: Clean PDF Exports
                                                    </h3>
                                                    <p className="text-sm text-blue-100 mt-1 mb-3">We noticed your last few uploads couldn't be read perfectly by our scanner. Here are 3 quick tips for exporting a clean PDF directly from your accounting software so your next invoice gets approved instantly:</p>
                                                    <ul className="text-xs text-blue-200 space-y-1 list-disc list-inside">
                                                        <li>Export directly to PDF rather than scanning a printed copy.</li>
                                                        <li>Ensure the DPI is set to at least 300 if scanning is unavoidable.</li>
                                                        <li>Avoid watermarks over the total amounts.</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-4">
                                        <div className="flex-1 bg-slate-800/50 p-4 rounded-lg border border-slate-700" title="Upload your invoice for reconciliation">
                                            <label className="block text-sm font-bold text-slate-200 mb-1.5"><span className="text-emerald-500 mr-1">Step 1:</span> Upload your Invoice</label>
                                            <input type="file" id="tut-invoice-input" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setInvoiceFile(e.target.files[0])} className={`block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-blue-900/50 file:text-blue-300 cursor-pointer border border-slate-700 rounded-md p-1.5 bg-slate-900/50 ${spotlightClass('tut-invoice-input')}`} title="Select your Invoice document" />
                                            {invoiceFile && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                                                    <FileText className="w-3 h-3" /> <span className="truncate">{invoiceFile.name}</span> ({(invoiceFile.size / 1024).toFixed(1)} KB)
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 bg-slate-800/50 p-4 rounded-lg border border-slate-700" title="Upload the Purchase Order issued by Nestlé">
                                            <label className="block text-sm font-bold text-slate-200 mb-1.5"><span className="text-purple-500 mr-1">Step 2:</span> Upload the PO issued by Nestlé</label>
                                            <input type="file" id="tut-po-input" accept=".pdf, image/*, .xlsx, .xls, .csv" onChange={(e) => setPoFile(e.target.files[0])} className={`block w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-purple-900/50 file:text-purple-300 cursor-pointer border border-slate-700 rounded-md p-1.5 bg-slate-900/50 ${spotlightClass('tut-po-input')}`} title="Select the Nestlé Purchase Order document" />
                                            {poFile && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
                                                    <FileText className="w-3 h-3" /> <span className="truncate">{poFile.name}</span> ({(poFile.size / 1024).toFixed(1)} KB)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleMatchUpload} disabled={loading || !invoiceFile || !poFile} className={`w-full py-2.5 ${isSandboxMode ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'} text-white text-sm font-bold rounded-lg mt-4 disabled:opacity-50 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2`} title="Run the automated 3-way match to verify your invoice against the PO">
                                        {loading ? (isSandboxMode ? "Simulating..." : "Matching...") : (isSandboxMode ? "🛠️ Sandbox Mode: Test 3-way match (No data saved)" : "Step 3: Submit to begin 3-way matching")}
                                    </button>

                                    {matchStatus !== 'Pending' && matchStatus !== 'Submitted' && (
                                        <div className="mt-6">
                                            <div className={`p-3 mb-4 rounded-lg text-sm text-center font-medium border ${matchStatus === 'Matched - Pending Finance Review' ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-amber-900/30 border-amber-800 text-amber-300'}`}>
                                                <JargonText text={matchStatus === 'Matched - Pending Finance Review' ? '✅ Perfect Match. Awaiting Finance Approval' : '⚠️ Variance Flagged: Discrepancy Routed for Review'} />
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
                                        <p className="text-sm text-slate-400">Complete journey from BOQ submission to payout – one transaction per card.</p>
                                    </div>

                                    {transactionTimeline.length === 0 ? (
                                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
                                            <p className="text-slate-400">No transaction timeline available yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {transactionTimeline.map((tx) => (
                                                <div key={tx.poNumber} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                                                    <div className="bg-slate-800/80 px-5 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400">
                                                                <Tag className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-100">Shipment {getShipmentId(tx.poNumber)}</h3>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">PO: {tx.poNumber}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-lg font-bold text-slate-100">{formatCurrency(tx.totalAmount, tx.currency)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-5">
                                                        <div className="relative">
                                                            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-700"></div>
                                                            <div className="space-y-5">
                                                                {tx.events.map((event, idx) => (
                                                                    <div key={idx} className="relative flex items-start gap-4 pl-10">
                                                                        <div className={`absolute left-[13px] w-3 h-3 rounded-full ring-4 ring-slate-900 ${event.status === 'completed' ? 'bg-emerald-500' : event.status === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                                                        <div className="flex-1 bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-lg">{event.icon}</span>
                                                                                    <h4 className="font-semibold text-slate-200 text-sm">
                                                                                        <JargonText text={event.label} />
                                                                                    </h4>
                                                                                    {event.isPaid && event.bankRef && (
                                                                                        <button 
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                alert('Downloading Remittance Advice for TXN: ' + event.bankRef);
                                                                                            }}
                                                                                            className="ml-2 px-2 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-700 rounded text-[10px] uppercase font-bold hover:bg-emerald-800 transition-colors"
                                                                                        >
                                                                                            📄 Receipt
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400">{safeDate(event.date)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'payouts' && (
                                <div className="animate-in fade-in duration-300 space-y-6">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Payouts & Liquidity</h2>
                                        <p className="text-sm text-slate-400">Manage cash flow and request early payouts.</p>
                                    </div>
                                    
                                    <DigitalCalendar userRole="Supplier" userEmail={user?.email} />
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-lg mb-3">⚡ Quick Actions</h3>
                                <div className="space-y-2">
                                    <button type="button" id="tut-quick-boq" onClick={() => { setMode('boq'); setBoqFile(null); }} className={`w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 ${spotlightClass('tut-quick-boq')}`} title="Submit a Bill of Quantities (BOQ) to get a Purchase Order">📤 Submit Quote</button>
                                    <button type="button" id="tut-quick-match" onClick={() => { setMode('match'); setInvoiceFile(null); setPoFile(null); setShowWalkthrough(false); localStorage.setItem('hasSeenWalkthrough', 'true'); }} className={`w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 ${showWalkthrough ? 'relative z-[102] ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 animate-pulse' : ''} ${spotlightClass('tut-quick-match')}`} title="Upload your Invoice and the Purchase Order to start the 3-Way Match process">🔗 Match Invoice & PO</button>
                                    <button type="button" id="tut-quick-logs" onClick={() => { setMode('logs'); }} className={`w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2 ${spotlightClass('tut-quick-logs')}`} title="View the complete lifecycle and history of your transactions">📜 View Timeline</button>
                                    <button type="button" id="tut-quick-payouts" onClick={() => setMode('payouts')} className={`w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 ${spotlightClass('tut-quick-payouts')}`} title="Manage your cash flow and access early payment options via Dynamic Discounting">💸 Liquidity Engine</button>
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
                                                    <p className="font-medium text-slate-200 text-xs"><JargonText text={log.action || 'System Action'} /></p>
                                                    <p className="text-[10px] text-slate-400">{safeDate(log.date || log.created_at || new Date())}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <AppNotifier role="Supplier" email={user.email} />
            <div id="tut-floating-chat">
                <FloatingChat userEmail={user.email} userRole="Supplier" />
            </div>

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

            {showWalkthrough && (
                <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm pointer-events-auto" onClick={() => { setShowWalkthrough(false); localStorage.setItem('hasSeenWalkthrough', 'true'); }}></div>
                    
                    <div className="relative z-[101] max-w-sm bg-slate-900 border-2 border-purple-500 p-6 rounded-2xl shadow-2xl pointer-events-auto mt-20 md:ml-40 lg:ml-80">
                        <div className="absolute -top-4 -left-4 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold border-4 border-slate-900">1</div>
                        <h3 className="text-xl font-black text-white mb-2">Step 1: Upload Documents</h3>
                        <p className="text-sm text-slate-300 mb-6">Welcome! To get paid faster, click the pulsing <strong className="text-emerald-400">"🔗 Match Invoice & PO"</strong> button highlighted on the right. We will guide you through your first successful submission.</p>
                        <div className="flex justify-between items-center">
                            <button onClick={() => { setShowWalkthrough(false); localStorage.setItem('hasSeenWalkthrough', 'true'); }} className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">Skip Tutorial</button>
                            <button onClick={() => { setShowWalkthrough(false); localStorage.setItem('hasSeenWalkthrough', 'true'); setMode('match'); }} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg">Take me there</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================
                SANDBOX TUTORIAL OVERLAY v3
                SVG cutout spotlight + action buttons
                ============================ */}
            {showSandboxTutorial && (() => {
                const step = steps[sandboxTutorialStep] || steps[0];
                const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
                const isCentered = !step.targetId || tooltipPos.placement === 'center';
                const sr = spotlightRect;
                const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
                const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
                // Responsive tooltip width
                const ttW = Math.max(280, Math.min(370, vw - 32));

                const phaseGroups = [
                    { label: 'Overview', range: [0, 0], color: 'bg-purple-500' },
                    { label: 'Tabs', range: [1, 8], color: 'bg-blue-500' },
                    { label: 'Tools', range: [9, 12], color: 'bg-emerald-500' },
                    { label: 'Header', range: [13, 17], color: 'bg-amber-500' },
                    { label: 'Stats', range: [18, 22], color: 'bg-pink-500' },
                    { label: 'Actions', range: [23, 26], color: 'bg-indigo-500' },
                    { label: 'Done', range: [27, 27], color: 'bg-teal-500' },
                ];
                const currentPhase = phaseGroups.find(p => sandboxTutorialStep >= p.range[0] && sandboxTutorialStep <= p.range[1]);
                const phaseDot = currentPhase?.color || 'bg-purple-500';

                const boxStyle = isMobile
                    // Mobile: full-width bottom sheet
                    ? { position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 230, borderRadius: '1rem 1rem 0 0' }
                    : isCentered
                        ? {}
                        : { position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, width: ttW, zIndex: 230 };

                return (
                    <div className="fixed inset-0 z-[200] pointer-events-none">

                        {/* === SVG CUTOUT SPOTLIGHT === */}
                        {sr ? (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-auto"
                                style={{ zIndex: 201 }}
                                onClick={() => setShowSandboxTutorial(false)}
                            >
                                <defs>
                                    <mask id="tutMask">
                                        {/* White = show backdrop; black = transparent hole */}
                                        <rect x="0" y="0" width={vw} height={vh} fill="white" />
                                        <rect
                                            x={sr.x} y={sr.y}
                                            width={sr.w} height={sr.h}
                                            rx="8" ry="8"
                                            fill="black"
                                        />
                                    </mask>
                                </defs>
                                <rect
                                    x="0" y="0" width={vw} height={vh}
                                    fill="rgba(2,6,23,0.55)"
                                    mask="url(#tutMask)"
                                />
                                {/* Glowing border ring around the spotlight hole */}
                                <rect
                                    x={sr.x} y={sr.y}
                                    width={sr.w} height={sr.h}
                                    rx="8" ry="8"
                                    fill="none"
                                    stroke="#a855f7"
                                    strokeWidth="2"
                                    strokeDasharray="6 3"
                                    style={{ filter: 'drop-shadow(0 0 6px #a855f7)' }}
                                />
                            </svg>
                        ) : (
                            /* Fallback solid backdrop when no target yet */
                            <div
                                className="absolute inset-0 bg-slate-950/50 pointer-events-auto"
                                style={{ zIndex: 201 }}
                                onClick={() => setShowSandboxTutorial(false)}
                            />
                        )}

                        {/* === PULSING BEACON (top-right corner of target) === */}
                        {sr && (
                            <div
                                className="pointer-events-none"
                                style={{ position: 'fixed', top: sr.y - 2, left: sr.x + sr.w - 6, zIndex: 225 }}
                            >
                                <span className="relative flex h-5 w-5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-80" />
                                    <span className="relative inline-flex h-5 w-5 rounded-full bg-purple-600 border-2 border-white shadow-lg" />
                                </span>
                            </div>
                        )}

                        {/* === TOOLTIP BOX === */}
                        <div
                            ref={tooltipRef}
                            className={`pointer-events-auto bg-slate-900 border border-purple-500/50 shadow-2xl overflow-hidden ${
                                isMobile
                                    ? 'rounded-t-2xl'
                                    : isCentered
                                        ? `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl`
                                        : 'rounded-2xl'
                            }`}
                            style={boxStyle}
                        >
                            {/* Header: phase label + exit */}
                            <div className="bg-gradient-to-r from-purple-950 to-indigo-950 px-4 py-3 border-b border-purple-500/20 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${phaseDot} shadow-[0_0_6px_currentColor]`} />
                                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest truncate">
                                        {currentPhase?.label} · Step {sandboxTutorialStep + 1} of {steps.length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowSandboxTutorial(false)}
                                    className="text-slate-500 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-slate-800 transition-colors shrink-0"
                                >✕ Exit</button>
                            </div>

                            {/* Progress bar */}
                            <div className="h-[3px] bg-slate-800">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                                    style={{ width: `${((sandboxTutorialStep + 1) / steps.length) * 100}%` }}
                                />
                            </div>

                            {/* Phase mini-map */}
                            <div className="flex gap-1 px-4 pt-3 pb-0">
                                {phaseGroups.map((pg, i) => (
                                    <div
                                        key={i}
                                        title={pg.label}
                                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 cursor-pointer ${
                                            sandboxTutorialStep >= pg.range[0] && sandboxTutorialStep <= pg.range[1]
                                                ? pg.color + ' shadow-sm'
                                                : sandboxTutorialStep > pg.range[1]
                                                    ? 'bg-slate-600'
                                                    : 'bg-slate-800'
                                        }`}
                                        onClick={() => setSandboxTutorialStep(pg.range[0])}
                                    />
                                ))}
                            </div>

                            {/* Body */}
                            <div className="px-5 pt-4 pb-3 space-y-3">
                                <h3 className="text-base font-black text-white leading-snug">{step.title}</h3>
                                <p className="text-sm text-slate-300 leading-relaxed">{step.body}</p>
                                <div className="flex items-start gap-2 bg-indigo-950/50 border border-indigo-500/20 rounded-xl p-3">
                                    <span className="text-sm shrink-0 mt-0.5">💡</span>
                                    <p className="text-xs text-slate-400 leading-relaxed">{step.tip}</p>
                                </div>
                            </div>

                            {/* Action button row — navigates to the relevant tab */}
                            {step.action && (
                                <div className="px-5 pb-3">
                                    <button
                                        onClick={() => { step.action(); }}
                                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-all hover:border-purple-500/50"
                                    >
                                        <span>🔍</span> Go to this section
                                    </button>
                                </div>
                            )}

                            {/* Footer nav */}
                            <div className="px-5 pb-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                                <button
                                    onClick={() => setSandboxTutorialStep(s => Math.max(0, s - 1))}
                                    disabled={sandboxTutorialStep === 0}
                                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700 hover:border-slate-500 disabled:opacity-25 disabled:cursor-not-allowed"
                                >← Back</button>

                                <button
                                    onClick={() => setShowSandboxTutorial(false)}
                                    className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                                >Skip all</button>

                                {sandboxTutorialStep >= steps.length - 1 ? (
                                    <button
                                        onClick={() => setShowSandboxTutorial(false)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
                                    >✅ Start Practicing</button>
                                ) : (
                                    <button
                                        onClick={() => setSandboxTutorialStep(s => s + 1)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
                                    >Next →</button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
