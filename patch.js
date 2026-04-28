const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/Portal.jsx', 'utf8');

content = content.replace(
    "{r.displayStatus}\n                                                </span>",
    "{r.auto_approved ? '✅ Auto' : r.displayStatus}\n                                                </span>"
);

content = content.replace(
    `<h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">📑 Document Context</h4>`,
    `<h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">📑 Document Context</h4>\n                                                            {r.auto_approved && r.auto_approval_reason && (\n                                                                <div className="bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-4 shadow-sm">\n                                                                    <strong>AI Auto-Approval Note:</strong> {r.auto_approval_reason}\n                                                                </div>\n                                                            )}`
);

fs.writeFileSync('frontend/src/components/Portal.jsx', content, 'utf8');
console.log('Patched Portal.jsx');
