const fs = require('fs');
let file = fs.readFileSync('backend/payoutReminder.js', 'utf8');

// Update table name
file = file.replace(
    /supabase\.from\('payout_schedule'\)\.select/,
    "supabase.from('payout_schedules').select"
);

// Update status check
file = file.replace(
    /\.in\('status', \['Scheduled', 'Early Payment Requested'\]\)/,
    ".in('status', ['Scheduled', 'Pending Finance', 'Renegotiated'])"
);

// Update early payment property
file = file.replace(
    /payout\.early_payment_accepted_at/,
    "payout.status === 'Renegotiated'"
);

// Update payout_amount -> base_amount
file = file.replace(
    /payout\.payout_amount/g,
    "(payout.final_amount || payout.base_amount)"
);

// Update invoice_number -> id or title
file = file.replace(
    /payout\.invoice_number/g,
    "(payout.title || payout.id)"
);

// Update due_date -> start_date
file = file.replace(
    /payout\.due_date/g,
    "payout.start_date"
);

// Update early_payment_amount || payout.payout_amount
file = file.replace(
    /payout\.early_payment_amount \|\| payout\.payout_amount/g,
    "(payout.final_amount || payout.base_amount)"
);

fs.writeFileSync('backend/payoutReminder.js', file);
