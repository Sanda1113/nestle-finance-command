const express = require('express');
const supabase = require('../db');

const router = express.Router();

// ==========================================
// 🚚 MVP 5: SUPPLIER DOCK CHECK-IN (NEW)
// ==========================================
router.post('/supplier/mark-delivered', async (req, res) => {
    const { poNumber } = req.body;
    try {
        // 1. Fetch current PO Data
        const { data: poData, error: fetchErr } = await supabase
            .from('purchase_orders')
            .select('po_data')
            .eq('po_number', poNumber)
            .single();

        if (fetchErr) throw fetchErr;

        // 2. Inject Delivery Timestamp
        const updatedPoData = {
            ...poData.po_data,
            delivery_timestamp: new Date().toISOString()
        };

        // 3. Save to DB with new status
        const { error } = await supabase.from('purchase_orders')
            .update({
                status: 'Delivered to Dock',
                po_data: updatedPoData
            })
            .eq('po_number', poNumber);

        if (error) throw error;

        // Log this in the timeline
        await supabase.from('disputes').insert([{
            reference_number: poNumber,
            sender_email: 'System',
            sender_role: 'System',
            message: `SYSTEM LOG: Supplier has confirmed physical delivery to the Warehouse Dock.`
        }]);

        res.json({ success: true, message: 'Shipment marked as delivered.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update delivery status' });
    }
});

// ==========================================
// 🏭 MVP 3: GRN VAULT (WAREHOUSE PORTAL)
// ==========================================

router.post('/grn/submit', async (req, res) => {
    const { poNumber, receivedBy, itemsReceived, totalReceivedAmount, isPartial, gpsLocation } = req.body;
    try {
        const { error: grnErr } = await supabase.from('grns').insert([{
            po_number: poNumber,
            received_by: receivedBy,
            items_received: itemsReceived,
            total_received_amount: totalReceivedAmount,
        }]);
        if (grnErr) throw grnErr;

        const newStatus = isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)';

        await supabase.from('purchase_orders')
            .update({ status: newStatus })
            .eq('po_number', poNumber);

        res.json({ success: true, message: 'GRN Logged Successfully.', gpsLocation });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to log GRN' });
    }
});

router.get('/grn/pending-pos', async (req, res) => {
    try {
        const { data, error } = await supabase.from('purchase_orders')
            .select('*')
            .not('po_data', 'is', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch POs' }); }
});

// ==========================================
// 💬 MVP 4: BIDIRECTIONAL COMMUNICATION HUB
// ==========================================

router.get('/disputes/:reference', async (req, res) => {
    const { reference } = req.params;
    try {
        const { data, error } = await supabase.from('disputes')
            .select('*')
            .eq('reference_number', reference)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch messages' }); }
});

router.post('/disputes/send', async (req, res) => {
    const { referenceNumber, senderEmail, senderRole, message, metadata } = req.body;
    try {
        const finalMessage = metadata ? `${message}\n\n[FORMAL DISPUTE LOGGED]\nType: ${metadata.type}\nAmount: ${metadata.amount}` : message;

        const { error } = await supabase.from('disputes').insert([{
            reference_number: referenceNumber,
            sender_email: senderEmail,
            sender_role: senderRole,
            message: finalMessage
        }]);
        if (error) throw error;
        res.json({ success: true, message: 'Message sent' });
    } catch (error) { res.status(500).json({ error: 'Failed to send message' }); }
});

router.post('/reconciliations/:id/resubmit', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('reconciliations').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Document removed. Ready for resubmission.' });
    } catch (error) { res.status(500).json({ error: 'Failed to trigger resubmission loop' }); }
});

module.exports = router;