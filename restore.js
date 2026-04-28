const fs = require('fs');
const filepath = 'frontend/src/components/Portal.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const target = `    return (
        <div className="max-w-7xl mx-auto space-y-6">`;

const replacement = `    const markPaid = async (id) => {
        if (!window.confirm("Are you sure you want to mark this payout as Paid?")) return;
        try {
            await axios.patch(\`https://nestle-finance-command-production.up.railway.app/api/payouts/\${id}/paid\`, { paidBy: 'Finance User' });
            fetchPayouts();
        } catch {
            alert('Failed to mark as paid');
        }
    };

    const upcoming = payouts.filter(p => p.status === 'Scheduled' || p.status === 'Early Payment Requested');
    const past = payouts.filter(p => p.status === 'Paid');

    return (
        <div className="max-w-7xl mx-auto space-y-6">`;

content = content.replace(target, replacement);
fs.writeFileSync(filepath, content, 'utf8');
console.log('Restored markPaid block');
