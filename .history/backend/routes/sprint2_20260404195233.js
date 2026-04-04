const express = require('express');
const supabase = require('../db'); // Your existing db connection

const router = express.Router();

// ==========================================
// 🏭 MVP 3: GRN VAULT (WAREHOUSE PORTAL)
// ==========================================

// 1. Submit a Goods Receipt Note (GRN)
router.post('/grn/submit', async (req, res) => {
    const { poNumber, receivedBy, itemsReceived, totalReceivedAmount } = req.body;
    try {
        // Save GRN
        const { error: grnErr } = await supabase.from('grns').insert([{
            po_number: poNumber,
            received_by: receivedBy,
            items_received: itemsReceived,
            total_received_amount: totalReceivedAmount
        }]);
        if (grnErr) throw grnErr;

        // Update PO status to indicate goods arrived
        await supabase.from('purchase_orders')
            .update({ status: 'Goods Received (GRN Logged)' })
            .eq('po_number', poNumber);

        res.json({ success: true, message: 'GRN Logged Successfully. 3-Way Match unblocked.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to log GRN' });
    }
});

// 2. Fetch pending POs for the warehouse to receive
router.get('/grn/pending-pos', async (req, res) => {
    try {
        const { data, error } = await supabase.from('purchase_orders')
            .select('*')
            .not('po_data', 'is', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch POs for warehouse' }); }
});

// ==========================================
// 💬 MVP 4: BIDIRECTIONAL COMMUNICATION HUB
// ==========================================

// 1. Fetch chat history for a specific PO or Invoice
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

// 2. Send a message
router.post('/disputes/send', async (req, res) => {
    const { referenceNumber, senderEmail, senderRole, message } = req.body;
    try {
        const { error } = await supabase.from('disputes').insert([{
            reference_number: referenceNumber,
            sender_email: senderEmail,
            sender_role: senderRole,
            message: message
        }]);
        if (error) throw error;
        res.json({ success: true, message: 'Message sent' });
    } catch (error) { res.status(500).json({ error: 'Failed to send message' }); }
});

// 3. Resubmit/Delete rejected invoice
router.post('/reconciliations/:id/resubmit', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete the rejected reconciliation to allow the supplier to try again cleanly
        const { error } = await supabase.from('reconciliations').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Document removed. Ready for resubmission.' });
    } catch (error) { res.status(500).json({ error: 'Failed to trigger resubmission loop' }); }
});

module.exports = router;