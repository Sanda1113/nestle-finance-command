const fs = require('fs');
const filepath = 'frontend/src/components/Portal.jsx';
let content = fs.readFileSync(filepath, 'utf8');
let lines = content.split('\n');

const variables = `    const markPaid = async (id) => {
        if (!window.confirm("Are you sure you want to mark this payout as Paid?")) return;
        try {
            await axios.patch(\`https://nestle-finance-command-production.up.railway.app/api/payouts/\${id}/paid\`, { paidBy: 'Finance User' });
            fetchPayouts();
        } catch {
            alert('Failed to mark as paid');
        }
    };

    const upcoming = payouts.filter(p => p.status === 'Scheduled' || p.status === 'Early Payment Requested');
    const past = payouts.filter(p => p.status === 'Paid');`;

// Insert at line 1153 (index 1153)
lines.splice(1153, 0, variables);

fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
console.log('Injected variables');
