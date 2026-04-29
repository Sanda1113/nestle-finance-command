const fs = require('fs');
const file = 'c:/Users/sanda/nestle-finance-command/frontend/src/components/SupplierDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
    'CheckCircle2, Search, FileText, ChevronRight, ShieldCheck',
    'CheckCircle2, Search, FileText, ChevronRight, ShieldCheck, Zap, Activity, Percent, Calendar, TrendingUp'
);

// 2. sliderDays state
content = content.replace(
    /const \[searchTerm, setSearchTerm\] = useState\(''\);/,
    `const [searchTerm, setSearchTerm] = useState('');\n    const [sliderDays, setSliderDays] = useState(2);`
);

// 3. tabs and colormap
content = content.replace(
    /color: 'amber' \}\s*\]\.map\(tab => \{/,
    `color: 'amber' },\n                                    { id: 'payouts', label: '💸 Liquidity', color: 'indigo' }\n                                ].map(tab => {`
);
content = content.replace(
    /amber: 'bg-gradient-to-r from-amber-600 to-amber-700'\s*\};/,
    `amber: 'bg-gradient-to-r from-amber-600 to-amber-700',\n                                        indigo: 'bg-gradient-to-r from-indigo-600 to-indigo-700'\n                                    };`
);

// 4. Quick Actions
content = content.replace(
    /📜 View Timeline<\/button>\s*<\/div>/,
    `📜 View Timeline</button>\n                                    <button type="button" onClick={() => setMode('payouts')} className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2">💸 Liquidity Engine</button>\n                                </div>`
);

// 5. Payouts view block (replacing the closing div of the logs section and space-y-6 of the side panel)
content = content.replace(
    /(\s*<\/div>\s*)\)}\s*<\/div>\s*<div className="space-y-6">/,
    `$1)}\n\n                            {mode === 'payouts' && (
                                <div className="animate-in fade-in duration-300 space-y-6">
                                    <div className="mb-4">
                                        <h2 className="text-2xl font-bold tracking-tight">Payouts & Liquidity</h2>
                                        <p className="text-sm text-slate-400">Manage your cash flow, track incoming payments, and request early payouts.</p>
                                    </div>
                                    
                                    {/* AI Intervention Banner */}
                                    {myPayouts.some(p => p.status === 'Scheduled') && (
                                        <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/50 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                                            <div className="absolute -right-10 -top-10 text-indigo-500/20"><Zap size={120} /></div>
                                            <div className="flex items-start gap-3 relative z-10">
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                    <Activity className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-white">AI Liquidity Intervention</h3>
                                                    <p className="text-sm text-indigo-200 mt-1">Hi Team, we noticed you recently accepted a large PO for Q4. To support your production, we have pre-approved your outstanding scheduled invoices for immediate payout at a special <strong className="text-emerald-400 text-base">1.5% rate</strong>.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {myPayouts.length === 0 ? (
                                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-slate-400">
                                            No payout records found.
                                        </div>
                                    ) : (
                                        myPayouts.map(payout => {
                                            const originalAmount = payout.payout_amount || 0;
                                            const daysEarly = 30 - sliderDays; // Simulating Net-30
                                            const dynamicDiscountRate = (1.5 + (2.0 - 1.5) * (daysEarly / 28)).toFixed(1); // 1.5% to 2.0%
                                            const discountAmount = originalAmount * (dynamicDiscountRate / 100);
                                            const earlyPayoutAmount = originalAmount - discountAmount;
                                            
                                            // Predictive forecasting
                                            const expectedDate = new Date(payout.due_date || new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000));
                                            expectedDate.setDate(expectedDate.getDate() - 3);

                                            return (
                                                <div key={payout.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                                                    <div className="p-5 border-b border-slate-800 flex justify-between items-start flex-wrap gap-4">
                                                        <div>
                                                            <h3 className="text-lg font-black text-white">{payout.invoice_number || 'INV-Multiple'}</h3>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className={\`px-2.5 py-1 rounded-md text-xs font-bold \${payout.status === 'Paid' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' : payout.status === 'Early Payment Requested' ? 'bg-purple-900/40 text-purple-400 border border-purple-800' : 'bg-blue-900/40 text-blue-400 border border-blue-800'}\`}>
                                                                    {payout.status}
                                                                </span>
                                                                {payout.status === 'Scheduled' && (
                                                                    <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" /> Due: {new Date(payout.due_date || new Date()).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-black text-emerald-400">{formatCurrency(payout.early_payment_amount || payout.payout_amount)}</p>
                                                            {payout.early_payment_amount && <p className="text-xs text-purple-400 line-through mt-0.5">{formatCurrency(payout.payout_amount)}</p>}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Predictive Forecasting Feature */}
                                                    {payout.status === 'Scheduled' && (
                                                        <div className="bg-blue-950/30 p-4 border-b border-slate-800">
                                                            <div className="flex items-start gap-3">
                                                                <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5" />
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-blue-300">Predictive Cash Flow Forecast</h4>
                                                                    <p className="text-xs text-blue-200/70 mt-1">Based on the last 12 months of data, Nestlé typically processes your payments <strong>3 days ahead of schedule</strong>.</p>
                                                                    <p className="text-sm font-medium text-blue-400 mt-2 flex items-center gap-2">
                                                                        Estimated Bank Arrival: <strong className="text-white bg-blue-900/50 px-2 py-0.5 rounded border border-blue-800/50">{expectedDate.toLocaleDateString()}</strong>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Instant Liquidity Slider (Dynamic Discounting) */}
                                                    {payout.status === 'Scheduled' && (
                                                        <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800/50">
                                                            <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><Percent className="w-4 h-4 text-purple-400" /> Instant Liquidity Engine</h4>
                                                            <p className="text-xs text-slate-400 mb-6">Need cash sooner to make payroll or buy raw materials? Adjust the slider to request an early payout at a dynamically calculated discount rate.</p>
                                                            
                                                            <div className="mb-8 px-2">
                                                                <input 
                                                                    type="range" 
                                                                    min="2" max="30" step="1" 
                                                                    value={sliderDays} 
                                                                    onChange={(e) => setSliderDays(parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                                />
                                                                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-2">
                                                                    <span>Get paid in 2 days</span>
                                                                    <span>Wait 30 days (Net-30)</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                                                                <div className="flex gap-6 w-full md:w-auto">
                                                                    <div>
                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Discount</p>
                                                                        <p className="text-lg font-black text-purple-400">{dynamicDiscountRate}%</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fee</p>
                                                                        <p className="text-lg font-black text-red-400">-{formatCurrency(discountAmount)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Net Payout</p>
                                                                        <p className="text-lg font-black text-emerald-400">{formatCurrency(earlyPayoutAmount)}</p>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleAcceptEarlyPayment(payout.id, payout.payout_amount)}
                                                                    className="w-full md:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                                                                >
                                                                    Accept {formatCurrency(earlyPayoutAmount)} Now
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}\n                        </div>\n\n                        <div className="space-y-6">`
);

fs.writeFileSync(file, content);
console.log('Done!');
