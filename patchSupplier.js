const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/SupplierDashboard.jsx', 'utf8');

// Add myPayouts state
if (!content.includes('const [myPayouts, setMyPayouts] = useState([]);')) {
    content = content.replace(
        'const [myRecons, setMyRecons] = useState([]);',
        'const [myRecons, setMyRecons] = useState([]);\n    const [myPayouts, setMyPayouts] = useState([]);'
    );
}

// Add payouts fetch
if (!content.includes('axios.get(`https://nestle-finance-command-production.up.railway.app/api/payouts')) {
    content = content.replace(
        'axios.get(`https://nestle-finance-command-production.up.railway.app/api/boqs?email=${encodeURIComponent(user.email)}`, { timeout: 15000 })',
        'axios.get(`https://nestle-finance-command-production.up.railway.app/api/boqs?email=${encodeURIComponent(user.email)}`, { timeout: 15000 }),\n                axios.get(`https://nestle-finance-command-production.up.railway.app/api/payouts?email=${encodeURIComponent(user.email)}`, { timeout: 15000 })'
    );
    content = content.replace(
        'const [posRes, logsRes, reconsRes, boqsRes] = await Promise.allSettled([',
        'const [posRes, logsRes, reconsRes, boqsRes, payoutsRes] = await Promise.allSettled(['
    );
    content = content.replace(
        'setMyBoqs(boqsRes.value.data.data || []);\n                }',
        'setMyBoqs(boqsRes.value.data.data || []);\n                }\n                if (payoutsRes && payoutsRes.status === \'fulfilled\') {\n                    setMyPayouts(payoutsRes.value.data.data || []);\n                }'
    );
}

// Pass payouts to timeline
content = content.replace(
    'po\n            });',
    'po,\n                payout: myPayouts.find(p => p.reconciliation_id === relatedRecon?.id || p.po_number === poNumber)\n            });'
);

// Accept early payment logic
if (!content.includes('const handleAcceptEarlyPayment')) {
    const handleAcceptEarlyPaymentCode = `    const handleAcceptEarlyPayment = async (payoutId, payoutAmount) => {
        const discountRate = 0.02; // 2% dynamic discounting for MVP 7
        const discountAmount = payoutAmount * discountRate;
        const earlyPaymentAmount = payoutAmount - discountAmount;
        if (!window.confirm(\`Accept Early Payment?\\n\\nOriginal Amount: \${formatCurrency(payoutAmount)}\\nEarly Payment Discount: \${formatCurrency(discountAmount)} (2%)\\nAmount you will receive now: \${formatCurrency(earlyPaymentAmount)}\`)) return;
        
        try {
            await axios.post(\`https://nestle-finance-command-production.up.railway.app/api/payouts/\${payoutId}/accept-early-payment\`, {
                discountAmount, earlyPaymentAmount, discountRate
            });
            alert('Early payment offer accepted! Finance has been notified to accelerate your payout.');
            fetchDashboardData();
        } catch(err) {
            alert('Failed to accept early payment offer.');
        }
    };\n\n`;
    content = content.replace('const handleBoqUpload = async () => {', handleAcceptEarlyPaymentCode + '    const handleBoqUpload = async () => {');
}

// Render Early payment block in timeline
const renderTarget = `{event.resubmitObj && (\n                                                                                <div className="mt-3 border-t border-slate-700/50 pt-3">`;

const earlyPaymentRender = `
                                                                            {event.isPayoutInitiated && tx.payout && tx.payout.status === 'Scheduled' && (
                                                                                <div className="mt-4 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/30 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                                                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                                                                        <span className="text-6xl">🚀</span>
                                                                                    </div>
                                                                                    <h5 className="text-purple-400 font-bold mb-1 flex items-center gap-2"><span>⚡</span> Early Payment Offer Available!</h5>
                                                                                    <p className="text-xs text-slate-300 mb-4 max-w-sm">Get paid immediately instead of waiting for {new Date(tx.payout.due_date).toLocaleDateString()}. Apply a 2% discount to accelerate your liquidity.</p>
                                                                                    <div className="flex flex-wrap items-center gap-4">
                                                                                        <button 
                                                                                            onClick={() => handleAcceptEarlyPayment(tx.payout.id, tx.payout.payout_amount)}
                                                                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold shadow-lg transition-colors"
                                                                                        >
                                                                                            Accept {formatCurrency(tx.payout.payout_amount * 0.98)} Now
                                                                                        </button>
                                                                                        <span className="text-xs text-slate-500">Regular Payout: {formatCurrency(tx.payout.payout_amount)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {event.isPayoutInitiated && tx.payout && tx.payout.status === 'Early Payment Requested' && (
                                                                                <div className="mt-4 bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
                                                                                    <h5 className="text-purple-400 font-bold text-sm mb-1 flex items-center gap-2"><span>✅</span> Early Payment Requested</h5>
                                                                                    <p className="text-xs text-slate-300">Finance is processing your accelerated payout of {formatCurrency(tx.payout.early_payment_amount)}.</p>
                                                                                </div>
                                                                            )}
`;

content = content.replace(renderTarget, earlyPaymentRender + "\n" + renderTarget);

// Add flag to payout event
content = content.replace(
    "events.push({ label: 'Payout Initiated', date: new Date().toISOString(), status: 'pending', icon: '💰' });",
    "events.push({ label: 'Payout Initiated', date: new Date().toISOString(), status: 'pending', icon: '💰', isPayoutInitiated: true });"
);

fs.writeFileSync('frontend/src/components/SupplierDashboard.jsx', content, 'utf8');
console.log('Patched SupplierDashboard.jsx for early payment.');
