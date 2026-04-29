const fs = require('fs');
let file = fs.readFileSync('frontend/src/components/Portal.jsx', 'utf8');

const regex = /<td className="p-4 text-right">[\s\S]*?<div className="flex flex-wrap justify-end gap-1.5">[\s\S]*?<button[\s\S]*?onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleManualOverride\(r\.id, 'Approved'\); \}\}[\s\S]*?Approve\s*<\/button>[\s\S]*?<button[\s\S]*?onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleManualOverride\(r\.id, 'Rejected'\); \}\}[\s\S]*?Reject\s*<\/button>[\s\S]*?<\/div>\s*<\/td>/;

const newButtons = `                                            <td className="p-4 text-right">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    {r.displayStatus === 'Approved - Awaiting Payout' ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleStagePayout(r); }}
                                                            className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                                        >
                                                            Pay
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleManualOverride(r.id, 'Approved'); }}
                                                                disabled={isActioned}
                                                                className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleManualOverride(r.id, 'Rejected'); }}
                                                                disabled={isActioned}
                                                                className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>`;

if (regex.test(file)) {
    file = file.replace(regex, newButtons);
    fs.writeFileSync('frontend/src/components/Portal.jsx', file);
    console.log("Successfully patched Portal.jsx buttons via regex.");
} else {
    console.log("Regex not found in Portal.jsx");
}
