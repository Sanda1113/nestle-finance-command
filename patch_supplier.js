const fs = require('fs');
let file = fs.readFileSync('frontend/src/components/SupplierDashboard.jsx', 'utf8');

// 1. Add setMyPayouts in fetchData
if (!file.includes('setMyPayouts(payoutsRes.value.data.data || []);')) {
    const findCode = `                if (boqsRes.status === 'fulfilled') {
                    setMyBoqs(boqsRes.value.data.data || []);
                }`;
    const replaceCode = `                if (boqsRes.status === 'fulfilled') {
                    setMyBoqs(boqsRes.value.data.data || []);
                }
                if (payoutsRes.status === 'fulfilled') {
                    setMyPayouts(payoutsRes.value.data.data || []);
                }`;
    file = file.replace(findCode, replaceCode);
}

// 2. Change /api/payouts to /api/sprint2/payouts
file = file.replace(
    /axios\.get\(\`https:\/\/nestle-finance-command-production\.up\.railway\.app\/api\/payouts\?email=\$\{encodeURIComponent\(user\.email\)\}\`, \{ timeout: 15000 \}\)/,
    "axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts?email=${encodeURIComponent(user.email)}`, { timeout: 15000 })"
);

// 3. Update transactionTimeline to add Scheduled, Hold, Paid
const timelineCodeOld = `                if (isApproved && isDelivered) {
                    events.push({ label: 'Payout Initiated', date: new Date().toISOString(), status: 'pending', icon: '💰', isPayoutInitiated: true });
                }
            } else {`;
const timelineCodeNew = `                if (isApproved && isDelivered) {
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
            } else {`;

file = file.replace(timelineCodeOld, timelineCodeNew);

// 4. Update the render of timeline event to allow PDF download if isPaid
const renderCodeOld = `                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-lg">{event.icon}</span>
                                                                                    <h4 className="font-semibold text-slate-200 text-sm">
                                                                                        <JargonText text={event.label} />
                                                                                    </h4>
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400">{safeDate(event.date)}</span>
                                                                            </div>`;
const renderCodeNew = `                                                                                <div className="flex items-center gap-2">
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
                                                                            </div>`;

file = file.replace(renderCodeOld, renderCodeNew);

fs.writeFileSync('frontend/src/components/SupplierDashboard.jsx', file);
