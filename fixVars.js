const fs = require('fs');
const filepath = 'frontend/src/components/Portal.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// The faulty injection placed it before the ProcurementDashboard return statement
// Let's identify the ProcurementDashboard block
let junkStart = content.indexOf('const markPaid = async (id) => {');
let junkEnd = content.indexOf('<div className="max-w-7xl mx-auto space-y-6">', junkStart);

// To be safe, let's just search and replace the whole chunk:
const faultyTarget = `    const markPaid = async (id) => {
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
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Procurement Dashboard</h2>`;

const correctProcurement = `    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Procurement Dashboard</h2>`;

content = content.replace(faultyTarget, correctProcurement);

// Now append it inside PayoutCalendar
const targetPayout = `    useEffect(() => {
        fetchPayouts();
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3"><Calendar className="w-8 h-8 text-blue-600" /> Payout Calendar</h2>`;

const replacementPayout = `    useEffect(() => {
        fetchPayouts();
    }, []);

    const markPaid = async (id) => {
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
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3"><Calendar className="w-8 h-8 text-blue-600" /> Payout Calendar</h2>`;

content = content.replace(targetPayout, replacementPayout);

fs.writeFileSync(filepath, content, 'utf8');
console.log('Fixed file');
