import { useState, useEffect } from 'react';
import axios from 'axios';

export default function WarehousePortal({ user }) {
    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPO, setSelectedPO] = useState(null);
    const [receivedItems, setReceivedItems] = useState([]);

    const fetchPOs = async () => {
        try {
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/pending-pos');
            setPOs(res.data.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchPOs(); }, []);

    const handleSelectPO = (po) => {
        setSelectedPO(po);
        // Copy expected items to a mutable state for the warehouse worker to adjust if delivery is short
        const expectedItems = po.po_data.lineItems.map(item => ({
            ...item,
            actualQtyReceived: item.qty, // Default to full delivery
            status: 'Full Match'
        }));
        setReceivedItems(expectedItems);
    };

    const handleQtyChange = (index, val) => {
        const updated = [...receivedItems];
        updated[index].actualQtyReceived = val;
        updated[index].status = parseFloat(val) < parseFloat(updated[index].qty) ? 'Shortage' : 'Full Match';
        setReceivedItems(updated);
    };

    const submitGRN = async () => {
        let totalAmount = 0;
        receivedItems.forEach(item => {
            totalAmount += parseFloat(item.actualQtyReceived) * parseFloat(item.unitPrice);
        });

        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/grn/submit', {
                poNumber: selectedPO.po_number,
                receivedBy: user.email,
                itemsReceived: receivedItems,
                totalReceivedAmount: totalAmount
            });
            alert('📦 GRN Logged! The 3-Way Match is now active for Finance.');
            setSelectedPO(null);
            fetchPOs();
        } catch (err) { alert('Failed to log GRN'); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">Warehouse GRN Portal</h2>
                <p className="text-slate-500">Log physical deliveries to enable the True 3-Way Match.</p>
            </div>

            {loading ? <p>Loading POs...</p> : !selectedPO ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pos.map(po => (
                        <div key={po.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer" onClick={() => handleSelectPO(po)}>
                            <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400">{po.po_number}</h3>
                            <p className="text-xs text-slate-500 mb-2">Supplier: {po.supplier_email}</p>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-bold uppercase">{po.status}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <button onClick={() => setSelectedPO(null)} className="mb-4 text-sm text-blue-500 font-bold">← Back to Shipments</button>
                    <h3 className="text-xl font-bold mb-4">Receiving PO: {selectedPO.po_number}</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm mb-6">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3">Expected Qty</th>
                                    <th className="p-3">Actual Received Qty</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receivedItems.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="p-3">{item.description}</td>
                                        <td className="p-3 font-bold">{item.qty}</td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                value={item.actualQtyReceived}
                                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                                className="w-20 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'Shortage' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={submitGRN} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">
                        ✅ Log Goods Receipt Note (GRN)
                    </button>
                </div>
            )}
        </div>
    );
}