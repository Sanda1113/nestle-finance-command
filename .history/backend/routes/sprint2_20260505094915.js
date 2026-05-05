// backend/routes/sprint2.js
const express = require('express');
const { simulateBankTransfer } = require('../utils/bankMock');
const supabase = require('../db');
const { sendSupplierEmail } = require('../mailer');
const PDFDocument = require('pdfkit');

const router = express.Router();
const WAREHOUSE_SCOPE_MAX_RECORDS = 250;
const DEFAULT_PENDING_POS_MAX_RECORDS = 500;
const PENDING_POS_WITH_PHOTOS_MAX_RECORDS = 120;
const SUPABASE_REQUEST_TIMEOUT_MS = 12000;
const MAX_LOG_FIELD_LENGTH = 400;

// Helper to generate Shipment ID (same as frontend)
const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = poNum.match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${poNum.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const toSafeNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const buildShortageEvidence = (items = []) => {
    return (Array.isArray(items) ? items : []).map((item) => {
        const expectedQty = toSafeNumber(item?.qty);
        const receivedQty = toSafeNumber(item?.actualQtyReceived);
        return {
            description: item?.description || 'Item',
            expectedQty,
            receivedQty,
            shortageQty: Math.max(expectedQty - receivedQty, 0),
            reasonCode: item?.reasonCode || '',
            status: item?.status || '',
            hasPhoto: Boolean(item?.hasPhoto || item?.photoDataUrl),
            photoFileName: item?.photoFileName || '',
            photoDataUrl: item?.photoDataUrl || ''
        };
    });
};

const runBackgroundTask = (label, task) => {
    Promise.resolve().then(task).catch((error) => {
        console.error(`❌ Background Task Failed [${label}]:`, error.message);
    });
};

// Trust Profile
router.get('/trust-profile', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        let { data: profile, error } = await supabase.from('vendor_trust_profiles').select('*').eq('supplier_email', email).single();
        if (error) {
            const { data: newProfile } = await supabase.from('vendor_trust_profiles')
                .insert([{ supplier_email: email, trust_tier: 2, accuracy_score: 100 }]).select().single();
            profile = newProfile;
        }
        res.json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trust profile' });
    }
});

// Notifications
router.get('/notifications', async (req, res) => {
    const { email, role } = req.query;
    try {
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
        if (email) query = query.ilike('user_email', email);
        else query = query.ilike('user_role', role);
        const { data } = await query;
        res.json({ success: true, notifications: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.post('/notifications/mark-read', async (req, res) => {
    try {
        await supabase.from('notifications').update({ is_read: true }).in('id', req.body.ids);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

// Mark Delivered
router.post('/supplier/mark-delivered', async (req, res) => {
    const { poNumber } = req.body;
    try {
        const { data: poData } = await supabase.from('purchase_orders').select('po_data, supplier_email').eq('po_number', poNumber).single();
        const updatedPoData = { ...poData.po_data, delivery_timestamp: new Date().toISOString() };
        await supabase.from('purchase_orders').update({ status: 'Delivered to Dock', po_data: updatedPoData }).eq('po_number', poNumber);
        res.json({ success: true, message: 'Shipment marked as delivered.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update delivery status' });
    }
});

// Acknowledge Arrival
router.post('/grn/acknowledge', async (req, res) => {
    const { poNumber, ackedBy } = req.body;
    try {
        await supabase.from('purchase_orders').update({ status: 'Truck at Bay - Pending Unload' }).eq('po_number', poNumber);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Submit GRN
router.post('/grn/submit', async (req, res) => {
    const { poNumber, receivedBy, itemsReceived, totalReceivedAmount, isPartial, gpsLocation } = req.body;
    try {
        await supabase.from('grns').insert([{ po_number: poNumber, received_by: receivedBy, items_received: itemsReceived, total_received_amount: totalReceivedAmount }]);
        const newStatus = isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)';

        const { data: poContext } = await supabase.from('purchase_orders').select('supplier_email, po_data').eq('po_number', poNumber).single();
        const updatedPoData = {
            ...(poContext?.po_data || {}),
            warehouse_grn: {
                submittedBy: receivedBy,
                submittedAt: new Date().toISOString(),
                totalReceivedAmount: toSafeNumber(totalReceivedAmount),
                isPartial: Boolean(isPartial),
                gpsLocation,
                itemsReceived,
                shortageEvidence: buildShortageEvidence(itemsReceived.filter(item => item?.status === 'Shortage'))
            }
        };

        await supabase.from('purchase_orders').update({ status: newStatus, po_data: updatedPoData }).eq('po_number', poNumber);
        res.json({ success: true, message: 'GRN Logged Successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log GRN' });
    }
});

// Reject Shipment
router.post('/grn/reject', async (req, res) => {
    const { poNumber, rejectedBy, itemsReceived, rejectionReason } = req.body;
    try {
        const { data: poContext } = await supabase.from('purchase_orders').select('supplier_email, po_data').eq('po_number', poNumber).single();
        const updatedPoData = {
            ...(poContext?.po_data || {}),
            warehouse_rejection: { rejectedBy, rejectedAt: new Date().toISOString(), rejectionReason, shortageEvidence: buildShortageEvidence(itemsReceived) }
        };
        await supabase.from('purchase_orders').update({ status: 'Transaction Cancelled (Shortage)', po_data: updatedPoData }).eq('po_number', poNumber);
        await supabase.from('reconciliations').update({ match_status: 'Rejected', timeline_status: 'Rejected - Warehouse Shortage' }).eq('po_number', poNumber);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject shipment' });
    }
});

// Pending POs for Warehouse
router.get('/grn/pending-pos', async (req, res) => {
    try {
        const { data } = await supabase.from('purchase_orders').select('id, po_number, supplier_email, status, created_at, po_data, total_amount').order('created_at', { ascending: false }).limit(200);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear Goods & Auto-Schedule Payout
router.post('/grn/clear', async (req, res) => {
    const { poNumber } = req.body;
    try {
        const { data: po } = await supabase.from('purchase_orders').update({ status: 'Goods Cleared - Ready for Payout' }).eq('po_number', poNumber).select().single();
        const { data: recon } = await supabase.from('reconciliations').select('id, supplier_email, invoice_total, match_status').eq('po_number', poNumber).order('created_at', { ascending: false }).limit(1).single();

        // System Automatic Scheduling
        const { data: existingPayout } = await supabase.from('payout_schedules').select('id').eq('po_number', poNumber).single();

        // Auto-schedule if Finance has already approved it OR if the goods are cleared
        if (!existingPayout && recon) {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + 30); // Net 30 Auto-Schedule

            await supabase.from('payout_schedules').insert([{
                invoice_ref: recon.id,
                po_number: poNumber,
                supplier_email: recon.supplier_email || po.supplier_email,
                title: `Payout for ${poNumber}`,
                start_date: scheduledDate.toISOString(),
                end_date: scheduledDate.toISOString(),
                base_amount: recon.invoice_total,
                final_amount: recon.invoice_total,
                status: 'Scheduled'
            }]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear goods' });
    }
});

// Disputes
router.get('/disputes/:reference', async (req, res) => {
    try {
        const { data } = await supabase.from('disputes').select('*').eq('reference_number', req.params.reference).order('created_at', { ascending: true });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/disputes/send', async (req, res) => {
    const { referenceNumber, senderEmail, senderRole, message, metadata } = req.body;
    try {
        await supabase.from('disputes').insert([{
            reference_number: referenceNumber,
            sender_email: senderEmail,
            sender_role: senderRole,
            message: metadata ? `${message}\n\n[FORMAL DISPUTE LOGGED]\nType: ${metadata.type}\nAmount: ${metadata.amount}` : message
        }]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Live Chat
router.get('/livechat/:channel', async (req, res) => {
    try {
        const { data } = await supabase.from('disputes').select('*').eq('reference_number', req.params.channel).order('created_at', { ascending: true });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/livechat/send', async (req, res) => {
    try {
        await supabase.from('disputes').insert([{ reference_number: req.body.channel, sender_email: req.body.senderEmail, sender_role: req.body.senderRole, message: req.body.message }]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Payouts
router.get('/payouts', async (req, res) => {
    try {
        let query = supabase.from('payout_schedules').select('*').order('start_date', { ascending: true });
        if (req.query.email) query = query.ilike('supplier_email', req.query.email);
        const { data } = await query;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});

router.post('/payouts/stage', async (req, res) => {
    const { invoice_ref, supplier_email, total_amount, po_number } = req.body;
    try {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30);

        const { data } = await supabase.from('payout_schedules').insert([{
            invoice_ref,
            po_number,
            supplier_email,
            title: `Payout: ${supplier_email}`,
            start_date: scheduledDate.toISOString(),
            end_date: scheduledDate.toISOString(),
            base_amount: total_amount,
            final_amount: total_amount,
            status: 'Scheduled'
        }]).select().single();

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stage payout' });
    }
});

router.post('/payouts/:id/disburse', async (req, res) => {
    const { id } = req.params;
    const { final_amount, mock_supplier_account } = req.body;
    try {
        const bankResult = await simulateBankTransfer(mock_supplier_account, final_amount);
        await supabase.from('payout_schedules').update({ status: 'Paid', bank_transaction_ref: bankResult.transactionId }).eq('id', id);
        res.status(200).json(bankResult);
    } catch (error) {
        res.status(500).json({ error: 'Failed to disburse' });
    }
});

router.patch('/payouts/:id/discount', async (req, res) => {
    const { id } = req.params;
    const { early_date, new_amount } = req.body;
    try {
        const { data } = await supabase.from('payout_schedules').update({
            status: 'Renegotiated',
            start_date: early_date,
            end_date: early_date,
            final_amount: new_amount
        }).eq('id', id).select().single();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply discount' });
    }
});

router.patch('/payouts/:id/hold', async (req, res) => {
    try {
        const { data } = await supabase.from('payout_schedules').update({ status: 'Hold', hold_until_date: req.body.hold_until_date }).eq('id', req.params.id).select().single();
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to hold' });
    }
});

router.patch('/reconciliations/:id', async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;
    try {
        const { data, error } = await supabase
            .from('reconciliations')
            .update({
                match_status: newStatus,
                processed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('po_number, supplier_email, invoice_total')
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

module.exports = router;