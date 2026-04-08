const express = require('express');
const supabase = require('../db');

const router = express.Router();

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

        // 🚀 NEW: Explicitly set status to Completed
        const newStatus = isPartial ? 'Partially Received (Awaiting Backorder)' : 'Completed';

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