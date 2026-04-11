// backend/routes/sprint2.js
const express = require('express');
const supabase = require('../db');
const { sendSupplierEmail } = require('../mailer');

const router = express.Router();

// ==========================================
// 🔔 NOTIFICATION ENDPOINTS
// ==========================================

// Fetch notifications for a user (by email or role)
router.get('/notifications', async (req, res) => {
    const { email, role } = req.query;
    try {
        let query = supabase.from('notifications').select('*');

        if (email) {
            query = query.eq('user_email', email);
        } else if (role) {
            query = query.eq('user_role', role);
        } else {
            return res.status(400).json({ error: 'Missing email or role parameter' });
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json({ success: true, notifications: data });
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notifications as read
router.post('/notifications/mark-read', async (req, res) => {
    const { ids } = req.body;
    try {
        await supabase.from('notifications').update({ is_read: true }).in('id', ids);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        res.status(500).json({ error: 'Failed to update' });
    }
});

// ==========================================
// 🚚 MVP 5: SUPPLIER DOCK CHECK-IN
// ==========================================
router.post('/supplier/mark-delivered', async (req, res) => {
    const { poNumber } = req.body;
    try {
        const { data: poData, error: fetchErr } = await supabase
            .from('purchase_orders')
            .select('po_data, supplier_email')
            .eq('po_number', poNumber)
            .single();

        if (fetchErr) throw fetchErr;

        const updatedPoData = { ...poData.po_data, delivery_timestamp: new Date().toISOString() };

        const { error } = await supabase
            .from('purchase_orders')
            .update({ status: 'Delivered to Dock', po_data: updatedPoData })
            .eq('po_number', poNumber);

        if (error) throw error;

        await supabase.from('disputes').insert([
            {
                reference_number: poNumber,
                sender_email: 'System',
                sender_role: 'System',
                message: `SYSTEM LOG: Supplier has confirmed physical delivery to the Warehouse Dock.`
            }
        ]);

        // 🔔 NOTIFY WAREHOUSE TEAM
        await supabase.from('notifications').insert([
            {
                user_role: 'Warehouse',
                title: '🚚 Truck Arrived',
                message: `Shipment ${poNumber} is at the dock waiting for GRN scan.`,
                link: `/pending?po=${poNumber}`,
                is_read: false
            }
        ]);

        // 🔔 NOTIFY SUPPLIER (in-app)
        if (poData?.supplier_email) {
            await supabase.from('notifications').insert([
                {
                    user_email: poData.supplier_email,
                    user_role: 'Supplier',
                    title: '📦 Delivery Confirmed',
                    message: `You have marked shipment ${poNumber} as delivered to the dock.`,
                    link: `/logs?po=${poNumber}`,
                    is_read: false
                }
            ]);
        }

        res.json({ success: true, message: 'Shipment marked as delivered.' });
    } catch (error) {
        console.error('Failed to mark delivery:', error);
        res.status(500).json({ error: 'Failed to update delivery status' });
    }
});

// ==========================================
// 🏭 MVP 3: GRN VAULT (WAREHOUSE PORTAL)
// ==========================================
router.post('/grn/submit', async (req, res) => {
    const { poNumber, receivedBy, itemsReceived, totalReceivedAmount, isPartial, gpsLocation } = req.body;
    try {
        const { error: grnErr } = await supabase.from('grns').insert([
            {
                po_number: poNumber,
                received_by: receivedBy,
                items_received: itemsReceived,
                total_received_amount: totalReceivedAmount
            }
        ]);
        if (grnErr) throw grnErr;

        const newStatus = isPartial ? 'Partially Received (Awaiting Backorder)' : 'Goods Received (GRN Logged)';

        await supabase.from('purchase_orders').update({ status: newStatus }).eq('po_number', poNumber);

        // Fetch supplier email
        const { data: poContext } = await supabase
            .from('purchase_orders')
            .select('supplier_email')
            .eq('po_number', poNumber)
            .single();

        // 🔔 NOTIFY FINANCE TEAM IN-APP
        await supabase.from('notifications').insert([
            {
                user_role: 'Finance',
                title: '✅ GRN Completed',
                message: `Warehouse finished scanning ${poNumber}. Ready for final payout validation.`,
                link: `/finance?recon=${poNumber}`,
                is_read: false
            }
        ]);

        // 🔔 NOTIFY SUPPLIER IN-APP
        if (poContext?.supplier_email) {
            await supabase.from('notifications').insert([
                {
                    user_email: poContext.supplier_email,
                    user_role: 'Supplier',
                    title: '📦 Goods Received',
                    message: `The warehouse has successfully scanned and received your goods for shipment ${poNumber}.`,
                    link: `/logs?po=${poNumber}`,
                    is_read: false
                }
            ]);

            // 📧 EMAIL SUPPLIER
            sendSupplierEmail(
                poContext.supplier_email,
                `Goods Received - ${poNumber}`,
                `<h3>Good news!</h3>
                 <p>The Nestlé Warehouse has successfully scanned and received your goods for <strong>${poNumber}</strong>.</p>
                 <p>Status: ${newStatus}</p>
                 <p>The system will now process your Net-30 payment.</p>`
            );
        }

        res.json({ success: true, message: 'GRN Logged Successfully.', gpsLocation });
    } catch (error) {
        console.error('GRN submission failed:', error);
        res.status(500).json({ error: 'Failed to log GRN' });
    }
});

// backend/routes/sprint2.js
router.get('/grn/pending-pos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('*')
            .not('po_data', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Failed to fetch pending POs:', error);
            return res.status(500).json({
                error: 'Failed to fetch POs',
                details: error.message,
                hint: error.hint
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Exception in pending-pos:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// ==========================================
// 💬 MVP 4: BIDIRECTIONAL COMMUNICATION HUB
// ==========================================
router.get('/disputes/:reference', async (req, res) => {
    const { reference } = req.params;
    try {
        const { data, error } = await supabase
            .from('disputes')
            .select('*')
            .eq('reference_number', reference)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/disputes/send', async (req, res) => {
    const { referenceNumber, senderEmail, senderRole, message, metadata } = req.body;
    try {
        const finalMessage = metadata
            ? `${message}\n\n[FORMAL DISPUTE LOGGED]\nType: ${metadata.type}\nAmount: ${metadata.amount}`
            : message;

        const { error } = await supabase.from('disputes').insert([
            {
                reference_number: referenceNumber,
                sender_email: senderEmail,
                sender_role: senderRole,
                message: finalMessage
            }
        ]);
        if (error) throw error;

        // 🔔 IF FINANCE SENDS A MESSAGE, EMAIL THE SUPPLIER AND NOTIFY THEM IN-APP
        if (senderRole === 'Finance') {
            const { data: po } = await supabase
                .from('purchase_orders')
                .select('supplier_email')
                .eq('po_number', referenceNumber)
                .single();

            let supplierEmail = po?.supplier_email;

            if (!supplierEmail) {
                const { data: boq } = await supabase
                    .from('boqs')
                    .select('supplier_email')
                    .eq('document_number', referenceNumber)
                    .single();
                supplierEmail = boq?.supplier_email;
            }

            if (supplierEmail) {
                // In-app notification for supplier
                await supabase.from('notifications').insert([
                    {
                        user_email: supplierEmail,
                        user_role: 'Supplier',
                        title: '💬 New Message from Finance',
                        message: `Finance team sent a message regarding ${referenceNumber}.`,
                        link: `/logs?po=${referenceNumber}`,
                        is_read: false
                    }
                ]);

                // Email
                sendSupplierEmail(
                    supplierEmail,
                    `New Message regarding ${referenceNumber}`,
                    `<p>The Nestlé Finance team has sent you a new message regarding <strong>${referenceNumber}</strong>:</p>
                     <blockquote style="border-left:4px solid #ccc; padding-left:10px;">${message}</blockquote>
                     <p>Please log in to your Supplier Dashboard to reply.</p>`
                );
            }
        } else if (senderRole === 'Supplier') {
            // 🔔 NOTIFY FINANCE IN-APP
            await supabase.from('notifications').insert([
                {
                    user_role: 'Finance',
                    title: '💬 Supplier Reply',
                    message: `Supplier replied on ticket ${referenceNumber}.`,
                    link: `/finance?recon=${referenceNumber}`,
                    is_read: false
                }
            ]);
        }

        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/reconciliations/:id/resubmit', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('reconciliations').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Document removed. Ready for resubmission.' });
    } catch (error) {
        console.error('Failed to resubmit:', error);
        res.status(500).json({ error: 'Failed to trigger resubmission loop' });
    }
});

module.exports = router;