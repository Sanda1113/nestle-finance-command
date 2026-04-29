const fs = require('fs');
let file = fs.readFileSync('frontend/src/components/DigitalCalendar.jsx', 'utf8');

// Add holdDate state
if (!file.includes('const [holdDate, setHoldDate]')) {
    file = file.replace('const [isUpdating, setIsUpdating] = useState(false);', "const [isUpdating, setIsUpdating] = useState(false);\n    const [holdDate, setHoldDate] = useState('');");
}

// Add eventStyleGetter
const styleGetterCode = `
    const eventStyleGetter = (event) => {
        let backgroundColor = '#3b82f6'; // blue-500
        if (event.status === 'Hold') backgroundColor = '#f59e0b'; // amber-500
        if (event.status === 'Paid') backgroundColor = '#10b981'; // emerald-500
        
        return {
            style: {
                backgroundColor,
                opacity: 0.9,
                color: 'white',
                border: 'none',
                borderRadius: '6px'
            }
        };
    };
`;
if (!file.includes('const eventStyleGetter')) {
    file = file.replace('const isFinance = userRole === \'Finance\';', `const isFinance = userRole === 'Finance';\n${styleGetterCode}`);
}

// Ensure events mapping includes status
file = file.replace(
    'title: p.title || `Payout`,',
    'title: p.title || `Payout`,\n                    status: p.status,'
);

// Add eventPropGetter={eventStyleGetter} to calendars
file = file.replace(/startAccessor="start"/g, 'startAccessor="start"\n                    eventPropGetter={eventStyleGetter}');

// Add handleApproveTransfer and handleHoldPayment functions
const actionsCode = `
    const handleApproveTransfer = async () => {
        if (!selectedEvent) return;
        setIsUpdating(true);
        try {
            const res = await axios.post(\`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/\${selectedEvent.id}/disburse\`, {
                supplier_email: selectedEvent.supplier_email,
                final_amount: selectedEvent.amount || selectedEvent.final_amount || selectedEvent.base_amount,
                mock_supplier_account: 'SUPP-ACC-12345'
            });
            alert('Transfer approved! TXN ID: ' + res.data.transactionId);
            fetchEvents();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to disburse', error);
            alert('Failed to process transfer');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleHoldPayment = async () => {
        if (!selectedEvent || !holdDate) {
            alert('Please select a hold date');
            return;
        }
        setIsUpdating(true);
        try {
            await axios.patch(\`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/\${selectedEvent.id}/hold\`, {
                hold_until_date: new Date(holdDate).toISOString()
            });
            alert('Payment placed on hold');
            fetchEvents();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to hold', error);
            alert('Failed to hold payment');
        } finally {
            setIsUpdating(false);
            setHoldDate('');
        }
    };
`;
if (!file.includes('handleApproveTransfer')) {
    file = file.replace('const handleSelectEvent =', `${actionsCode}\n    const handleSelectEvent =`);
}

// Replace Finance View Edit Modal content
const newModalContent = `
                            <div className="mt-6 flex flex-col gap-3">
                                {selectedEvent.status !== 'Paid' && (
                                    <>
                                        <button 
                                            onClick={handleApproveTransfer}
                                            disabled={isUpdating}
                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                                        >
                                            {isUpdating ? 'Processing...' : 'Approve Transfer (Bank Mock)'}
                                        </button>
                                        <div className="flex gap-2">
                                            <input 
                                                type="date" 
                                                value={holdDate}
                                                onChange={(e) => setHoldDate(e.target.value)}
                                                className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                                            />
                                            <button 
                                                onClick={handleHoldPayment}
                                                disabled={isUpdating || !holdDate}
                                                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                                            >
                                                Hold Payment
                                            </button>
                                        </div>
                                    </>
                                )}
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors mt-2"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
`;
file = file.replace(
    /<div className="mt-6">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/,
    `${newModalContent}                    </div>\n                </div>\n            )}`
);

fs.writeFileSync('frontend/src/components/DigitalCalendar.jsx', file);
