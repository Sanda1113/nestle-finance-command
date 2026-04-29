const fs = require('fs');
let file = fs.readFileSync('frontend/src/components/Portal.jsx', 'utf8');

const splitIndex = file.indexOf('function PayoutCalendar() {');
if (splitIndex === -1) {
    console.error('PayoutCalendar not found');
    process.exit(1);
}

let topPart = file.substring(0, splitIndex);
let bottomPart = file.substring(splitIndex);

// Do replacements ONLY in bottomPart!

bottomPart = bottomPart.replace(
    /const \[payouts, setPayouts\] = useState\(\[\]\);\s*const \[loading, setLoading\] = useState\(true\);/,
    `const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [schedulingPayout, setSchedulingPayout] = useState(null);
    const [confirmDate, setConfirmDate] = useState('');`
);

bottomPart = bottomPart.replace(
    /https:\/\/nestle-finance-command-production\.up\.railway\.app\/api\/payouts/g,
    `https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts`
);

// We still want markPaid to go to /paid, let's revert that specific one if needed, but wait:
// The endpoint for markPaid in sprint2.js is NOT there. Wait, the old `/api/payouts/:id/paid` is still functional in server.js! 
// Let's just fix the fetchPayouts endpoint.
bottomPart = bottomPart.replace(
    /const res = await axios\.get\('https:\/\/nestle-finance-command-production\.up\.railway\.app\/api\/sprint2\/payouts'\);/,
    `const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts');`
);

// Actually, replacing all to sprint2 is fine for GET. For PATCH `/paid`, server.js has it. Let's make sure `/paid` uses the old one if needed, but `/api/payouts/:id/paid` is what's used.
// The regex above changed ALL. Let's revert the `/paid` ones.
bottomPart = bottomPart.replace(
    /\/api\/sprint2\/payouts\/\$\{id\}\/paid/g,
    `/api/payouts/\${id}/paid`
);
bottomPart = bottomPart.replace(
    /\/api\/sprint2\/payouts\/\$\{p\.id\}\/paid/g,
    `/api/payouts/\${p.id}/paid`
);

bottomPart = bottomPart.replace(
    /const upcoming = payouts\.filter\(p => p\.status === 'Scheduled' \|\| p\.status === 'Early Payment Requested'\);/,
    `const upcoming = payouts.filter(p => p.status === 'Scheduled' || p.status === 'Early Payment Requested' || p.status === 'Pending Finance' || p.status === 'Renegotiated');`
);

// handleConfirmSchedule
bottomPart = bottomPart.replace(
    /const past = payouts\.filter\(p => p\.status === 'Paid'\);/,
    `const past = payouts.filter(p => p.status === 'Paid');

    const handleConfirmSchedule = async () => {
        if (!schedulingPayout) return;
        try {
            await axios.patch(\`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/\${schedulingPayout.id}/confirm\`, {
                start_date: new Date(confirmDate).toISOString(),
                base_amount: schedulingPayout.base_amount
            });
            alert('Payout Scheduled successfully and Promise to Pay PDF generated.');
            setSchedulingPayout(null);
            fetchPayouts();
        } catch (error) {
            alert('Failed to schedule payout');
        }
    };`
);

bottomPart = bottomPart.replace(
    /const dayPayouts = upcoming\.filter\(p => new Date\(p\.due_date\)\.toLocaleDateString\(\) === dayString\);/,
    `const dayPayouts = upcoming.filter(p => p.start_date && new Date(p.start_date).toLocaleDateString() === dayString);`
);

bottomPart = bottomPart.replace(
    /const dayTotal = dayPayouts\.reduce\(\(sum, p\) => sum \+ \(p\.early_payment_amount \|\| p\.payout_amount\), 0\);/,
    `const dayTotal = dayPayouts.reduce((sum, p) => sum + (p.final_amount || p.base_amount || 0), 0);`
);

bottomPart = bottomPart.replace(
    /\{formatCurrency\(upcoming\.reduce\(\(sum, p\) => sum \+ \(p\.early_payment_amount \|\| p\.payout_amount\), 0\)\)\}/,
    `{formatCurrency(upcoming.reduce((sum, p) => sum + (p.final_amount || p.base_amount || 0), 0))}`
);

bottomPart = bottomPart.replace(
    /\{formatCurrency\(past\.reduce\(\(sum, p\) => sum \+ p\.payout_amount, 0\)\)\}/,
    `{formatCurrency(past.reduce((sum, p) => sum + (p.final_amount || p.base_amount || 0), 0))}`
);

bottomPart = bottomPart.replace(
    /\{formatCurrency\(past\.reduce\(\(sum, p\) => sum \+ \(p\.early_payment_discount \|\| 0\), 0\)\)\}/,
    `{formatCurrency(past.reduce((sum, p) => sum + ((p.base_amount || 0) - (p.final_amount || 0)), 0))}`
);

// Table replacement
const tbodyStart = '<tbody className="divide-y divide-slate-100 dark:divide-slate-800">';
const tbodyEnd = '{upcoming.length === 0 && (';
const newRows = `
                                {upcoming.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{p.start_date ? new Date(p.start_date).toLocaleDateString() : 'Pending'}</td>
                                        <td className="p-4"><span className="text-sm font-semibold">{p.supplier_email}</span></td>
                                        <td className="p-4"><span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{p.title || p.id}</span></td>
                                        <td className="p-4">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(p.final_amount || p.base_amount)}</span>
                                            {p.status === 'Renegotiated' && <span className="block text-xs text-purple-500">Early Payout!</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={\`px-2 py-1 rounded-lg text-xs font-bold \${p.status === 'Renegotiated' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : p.status === 'Pending Finance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}\`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {p.status === 'Pending Finance' ? (
                                                <button onClick={() => { setSchedulingPayout(p); setConfirmDate(p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : ''); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">
                                                    Schedule
                                                </button>
                                            ) : (
                                                <button onClick={() => markPaid(p.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors">
                                                    Mark Paid
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                `;

const startIdx = bottomPart.indexOf(tbodyStart);
if (startIdx !== -1) {
    const endIdx = bottomPart.indexOf(tbodyEnd, startIdx);
    if (endIdx !== -1) {
        bottomPart = bottomPart.substring(0, startIdx + tbodyStart.length) + newRows + bottomPart.substring(endIdx);
    }
}

// Add the modal
bottomPart = bottomPart.replace(
    /<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\}/g,
    `                    </div>

                    {schedulingPayout && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-500" /> Confirm Payout Schedule
                                    </h3>
                                    <button onClick={() => setSchedulingPayout(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-4 border border-blue-100 dark:border-blue-800/50">
                                        Review the auto-generated Net-30 date for <strong>{schedulingPayout.supplier_email}</strong>. Confirming will generate a Promise to Pay PDF and notify the supplier.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(schedulingPayout.base_amount)}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scheduled Date</label>
                                        <input 
                                            type="date" 
                                            value={confirmDate} 
                                            onChange={(e) => setConfirmDate(e.target.value)} 
                                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                    <div className="mt-6 flex gap-3">
                                        <button 
                                            onClick={() => setSchedulingPayout(null)}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleConfirmSchedule}
                                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
                                        >
                                            Confirm Schedule
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}`
);

fs.writeFileSync('frontend/src/components/Portal.jsx', topPart + bottomPart);
console.log('Success');
