// backend/routes/sprint2.js
const express = require('express');
const supabase = require('../db');
const { sendSupplierEmail } = require('../mailer');

const router = express.Router();

// Helper to generate Shipment ID (same as frontend)
const getShipmentId = (poNum) => {
    if (!poNum || typeof poNum !== 'string') return 'SHP-PENDING';
    const match = poNum.match(/\d+/);
    if (match) return `SHP-${match[0].padStart(5, '0')}`;
    return `SHP-${poNum.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase()}`;
};

// Helper to format currency (simple version for emails)
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
        const shortageQty = Math.max(expectedQty - receivedQty, 0);
        return {
            description: item?.description || 'Item',
            expectedQty,
            receivedQty,
            shortageQty,
            reasonCode: item?.reasonCode || '',
            status: item?.status || '',
            hasPhoto: Boolean(item?.hasPhoto || item?.photoDataUrl),
            photoFileName: item?.photoFileName || '',
            photoMimeType: item?.photoMimeType || '',
            photoAttachedAt: item?.photoAttachedAt || null,
            photoDataUrl: item?.photoDataUrl || ''
        };
    });
};

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// ==========================================
// 🔔 NOTIFICATION ENDPOINTS
// ==========================================
router.get('/notifications', async (req, res) => {
    const { email, role } = req.query;
    try {
        if (!email && !role) {
            return res.status(400).json({ error: 'Missing email or role parameter' });
        }

        if (email && role) {
            const [emailResult, roleResult] = await Promise.all([
                supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_email', email)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_role', role)
                    .order('created_at', { ascending: false })
                    .limit(50)
            ]);

            if (emailResult.error) throw emailResult.error;
            if (roleResult.error) throw roleResult.error;

            const merged = [...(emailResult.data || []), ...(roleResult.data || [])];
            const deduped = Array.from(new Map(merged.map(item => [item.id, item])).values())
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 50);

            return res.json({ success: true, notifications: deduped });
        }

        let query = supabase.from('notifications').select('*');
        if (email) {
            query = query.eq('user_email', email);
        } else {
            query = query.eq('user_role', role);
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

        await supabase.from('notifications').insert([
            {
                user_role: 'Warehouse',
                title: '🚚 Truck Arrived',
                message: `Shipment ${poNumber} is at the dock waiting for GRN scan.`,
                link: `/pending?po=${poNumber}`,
                is_read: false
            }
        ]);

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
// 🏭 ACKNOWLEDGE TRUCK ARRIVAL
// ==========================================
router.post('/grn/acknowledge', async (req, res) => {
    const { poNumber, ackedBy } = req.body;
    try {
        const shipmentId = getShipmentId(poNumber);
        
        const { error: updateErr } = await supabase
            .from('purchase_orders')
            .update({ status: 'Truck at Bay - Pending Unload' })
            .eq('po_number', poNumber);
        
        if (updateErr) throw updateErr;

        const { data: po } = await supabase
            .from('purchase_orders')
            .select('supplier_email, total_amount')
            .eq('po_number', poNumber)
            .single();

        if (po?.supplier_email) {
            // Notify Supplier
            await supabase.from('notifications').insert([{
                user_email: po.supplier_email,
                user_role: 'Supplier',
                title: '🚚 Shipment Acknowledged',
                message: `Warehouse has acknowledged arrival for Shipment ${shipmentId}.`,
                link: `/logs?po=${poNumber}`,
                is_read: false
            }]);

            // Detailed email
            const detailedEmailBody = `
                <p>Hello,</p>
                <p>This is an automated confirmation that the Nestlé Warehouse team has successfully acknowledged the arrival of your transport vehicle at the delivery bay.</p>
                <p><strong>Shipment Reference:</strong> ${shipmentId}</p>
                <p><strong>Purchase Order:</strong> ${poNumber}</p>
                <p>Your goods will now be systematically unloaded and inspected. Our warehouse staff will proceed to rigorously scan the delivered pallets to generate the official <strong>Goods Receipt Note (GRN)</strong>.</p>
                <p>Once the goods have been fully inspected and the GRN is locked, you will receive another notification detailing the exact quantities received, including any detected shortages or discrepancies. You can monitor the real-time status of this shipment in your Supplier Dashboard.</p>
            `;

            await sendSupplierEmail(
                po.supplier_email,
                `Shipment Arrival Acknowledged – ${shipmentId}`,
                detailedEmailBody,
                { poNumber: poNumber, invoiceNumber: shipmentId, amount: po.total_amount, currency: 'USD' }
            );
        }

        // Notify Finance
        await supabase.from('notifications').insert([{
            user_role: 'Finance',
            title: '🚚 Shipment at Bay',
            message: `Shipment ${shipmentId} (PO: ${poNumber}) has arrived at the dock and is pending GRN scan.`,
            link: `/finance?search=${poNumber}`,
            is_read: false
        }]);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to acknowledge:', error);
        res.status(500).json({ error: 'Failed' });
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

        const shortageEvidence = buildShortageEvidence(
            (itemsReceived || []).filter(item => item?.status === 'Shortage' || toSafeNumber(item?.actualQtyReceived) < toSafeNumber(item?.qty))
        );
        const { data: poContext } = await supabase
            .from('purchase_orders')
            .select('supplier_email, po_data')
            .eq('po_number', poNumber)
            .single();

        const updatedPoData = {
            ...(poContext?.po_data || {}),
            warehouse_grn: {
                submittedBy: receivedBy,
                submittedAt: new Date().toISOString(),
                totalReceivedAmount: toSafeNumber(totalReceivedAmount),
                isPartial: Boolean(isPartial),
                gpsLocation: gpsLocation || 'Location Unavailable',
                itemsReceived: Array.isArray(itemsReceived) ? itemsReceived : [],
                shortageEvidence
            }
        };

        await supabase.from('purchase_orders').update({ status: newStatus, po_data: updatedPoData }).eq('po_number', poNumber);

        const shortageCount = shortageEvidence.length;
        const photoEvidenceCount = shortageEvidence.filter(item => item.photoDataUrl).length;

        await supabase.from('notifications').insert([
            {
                user_role: 'Finance',
                title: '✅ GRN Completed',
                message: `Warehouse finished scanning ${poNumber}. ${shortageCount > 0 ? `${shortageCount} shortage item(s) flagged${photoEvidenceCount > 0 ? ` with ${photoEvidenceCount} photo evidence attachment(s)` : ''}. ` : ''}Ready for final payout validation.`,
                link: `/finance?recon=${poNumber}`,
                is_read: false
            }
        ]);

        if (poContext?.supplier_email) {
            await supabase.from('notifications').insert([
                {
                    user_email: poContext.supplier_email,
                    user_role: 'Supplier',
                    title: '📦 Goods Received',
                    message: `The warehouse has successfully scanned and received your goods for shipment ${getShipmentId(poNumber)}.`,
                    link: `/logs?po=${poNumber}`,
                    is_read: false
                }
            ]);

            // Build detailed items summary
            const itemsSummary = itemsReceived.map(item =>
                `<li><strong>${item.description}</strong>: ${item.actualQtyReceived} of ${item.qty} units received (${item.status || 'Full Match'})</li>`
            ).join('');

            const emailBody = `
                <p>The Nestlé Warehouse has successfully scanned and received your goods for shipment <strong>${getShipmentId(poNumber)}</strong> (PO: ${poNumber}).</p>
                <p><strong>Receipt Summary:</strong></p>
                <ul style="margin-left: 20px; padding-left: 0;">${itemsSummary}</ul>
                <p><strong>Status:</strong> ${newStatus}</p>
                <p><strong>Total Received Value:</strong> ${formatCurrency(totalReceivedAmount)}</p>
                <p>Payment will be processed according to Net-30 terms from the date of receipt. You can track the full lifecycle in your Supplier Dashboard.</p>
            `;

            await sendSupplierEmail(
                poContext.supplier_email,
                `Goods Received – ${getShipmentId(poNumber)}`,
                emailBody,
                { poNumber, amount: totalReceivedAmount, currency: 'USD' }
            );
        }

        res.json({ success: true, message: 'GRN Logged Successfully.', gpsLocation });
    } catch (error) {
        console.error('GRN submission failed:', error);
        res.status(500).json({ error: 'Failed to log GRN' });
    }
});

router.post('/grn/reject', async (req, res) => {
    const { poNumber, rejectedBy, itemsReceived = [], rejectionReason } = req.body;

    if (!poNumber) {
        return res.status(400).json({ error: 'poNumber is required' });
    }

    if (!rejectedBy) {
        return res.status(400).json({ error: 'rejectedBy is required' });
    }

    const shortageItems = Array.isArray(itemsReceived)
        ? itemsReceived.filter(item =>
            item?.status === 'Shortage' || Number(item?.actualQtyReceived || 0) < Number(item?.qty || 0)
        )
        : [];

    if (shortageItems.length === 0) {
        return res.status(400).json({ error: 'Shipment can only be rejected when shortages are present' });
    }

    try {
        const shipmentId = getShipmentId(poNumber);
        const canceledStatus = 'Transaction Cancelled (Shortage)';
        const rejectedAt = new Date().toISOString();
        const shortageEvidence = buildShortageEvidence(shortageItems);
        const shortageSummary = shortageEvidence
            .map(item => `${item.description} (${item.receivedQty}/${item.expectedQty})`)
            .join(', ');

        const { data: poContext, error: poFetchErr } = await supabase
            .from('purchase_orders')
            .select('supplier_email, total_amount, po_data')
            .eq('po_number', poNumber)
            .single();

        if (poFetchErr) throw poFetchErr;

        const rejectionContext = {
            rejectedBy,
            rejectedAt,
            rejectionReason: rejectionReason || '',
            shortageEvidence
        };

        const updatedPoData = {
            ...(poContext?.po_data || {}),
            warehouse_rejection: rejectionContext
        };

        const { error: poUpdateErr } = await supabase
            .from('purchase_orders')
            .update({ status: canceledStatus, po_data: updatedPoData })
            .eq('po_number', poNumber);

        if (poUpdateErr) throw poUpdateErr;

        try {
            const { data: relatedRecons, error: reconFetchErr } = await supabase
                .from('reconciliations')
                .select('id')
                .eq('po_number', poNumber)
                .limit(1);

            if (reconFetchErr) {
                console.error('Failed to fetch reconciliation context for rejection:', reconFetchErr);
            } else if (Array.isArray(relatedRecons) && relatedRecons.length > 0) {
                const { error: reconUpdateErr } = await supabase
                    .from('reconciliations')
                    .update({
                        match_status: 'Rejected',
                        timeline_status: 'Rejected - Warehouse Shortage',
                        processed_at: new Date().toISOString()
                    })
                    .eq('po_number', poNumber);

                if (reconUpdateErr) {
                    console.error('Failed to update reconciliation for rejection:', reconUpdateErr);
                }
            }
        } catch (reconErr) {
            console.error('Unexpected reconciliation error during shipment rejection:', reconErr);
        }

        try {
            await supabase.from('disputes').insert([{
                reference_number: poNumber,
                sender_email: rejectedBy,
                sender_role: 'Warehouse',
                message: `WAREHOUSE REJECTION: Shipment ${shipmentId} rejected due to shortage. ${rejectionReason ? `Reason: ${rejectionReason}. ` : ''}Short items: ${shortageSummary}. Transaction canceled.`
            }]);
        } catch (disputeErr) {
            console.error('Failed to log warehouse rejection dispute:', disputeErr);
        }

        try {
            await supabase.from('notifications').insert([{
                user_role: 'Finance',
                title: '❌ Shipment Rejected by Warehouse',
                message: `Shipment ${shipmentId} (${poNumber}) was rejected for shortage. Updated quantities and photo evidence are available in the finance review context.`,
                link: `/finance?recon=${poNumber}`,
                is_read: false
            }]);
        } catch (financeNotifErr) {
            console.error('Failed to create finance rejection notification:', financeNotifErr);
        }

        if (poContext?.supplier_email) {
            try {
                await supabase.from('notifications').insert([{
                    user_email: poContext.supplier_email,
                    user_role: 'Supplier',
                    title: '❌ Shipment Rejected',
                    message: `Shipment ${shipmentId} was rejected by warehouse due to shortages. Transaction canceled.`,
                    link: `/logs?po=${poNumber}`,
                    is_read: false
                }]);
            } catch (supplierNotifErr) {
                console.error('Failed to create supplier rejection notification:', supplierNotifErr);
            }

            const emailBody = `
                <p>Your shipment <strong>${shipmentId}</strong> (PO: ${poNumber}) has been <strong>rejected by the warehouse</strong> due to a goods shortage.</p>
                <p><strong>Transaction Status:</strong> Canceled</p>
                ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                <p><strong>Shortage Summary:</strong> ${shortageSummary}</p>
                <p>Please coordinate with the procurement/finance teams for next steps.</p>
            `;

            try {
                await sendSupplierEmail(
                    poContext.supplier_email,
                    `Shipment Rejected – ${shipmentId}`,
                    emailBody,
                    { poNumber, amount: poContext.total_amount, currency: 'USD' }
                );
            } catch (supplierEmailErr) {
                console.error('Failed to send supplier rejection email:', supplierEmailErr);
            }
        }

        return res.json({ success: true, message: 'Shipment rejected and transaction canceled.' });
    } catch (error) {
        console.error('Failed to reject shipment:', error);
        return res.status(500).json({ error: 'Failed to reject shipment' });
    }
});

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
// ✅ CLEAR GOODS (POST‑INSPECTION) – NEW
// ==========================================
router.post('/grn/clear', async (req, res) => {
    const { poNumber, clearedBy } = req.body;
    try {
        // Update PO status to "Goods Cleared - Ready for Payout"
        const { error: updateErr } = await supabase
            .from('purchase_orders')
            .update({ status: 'Goods Cleared - Ready for Payout' })
            .eq('po_number', poNumber);
        if (updateErr) throw updateErr;

        // Fetch supplier email
        const { data: po, error: fetchErr } = await supabase
            .from('purchase_orders')
            .select('supplier_email')
            .eq('po_number', poNumber)
            .single();
        if (fetchErr) throw fetchErr;

        const shipmentId = getShipmentId(poNumber);

        // 🔔 Notify Finance
        await supabase.from('notifications').insert([{
            user_role: 'Finance',
            title: '✅ Goods Cleared',
            message: `Shipment ${shipmentId} has been cleared and is ready for payout.`,
            link: `/finance?recon=${poNumber}`,
            is_read: false
        }]);

        // 🔔 Notify Supplier (in‑app)
        if (po?.supplier_email) {
            await supabase.from('notifications').insert([{
                user_email: po.supplier_email,
                user_role: 'Supplier',
                title: '✅ Goods Cleared',
                message: `Your shipment ${shipmentId} has been cleared by the warehouse. Payment will be processed.`,
                link: `/logs?po=${poNumber}`,
                is_read: false
            }]);

            // 📧 Email Supplier
            await sendSupplierEmail(
                po.supplier_email,
                `Goods Cleared – ${shipmentId}`,
                `<p>Your shipment <strong>${shipmentId}</strong> (PO: ${poNumber}) has been <strong>cleared</strong> by the warehouse after inspection.</p>
                 <p>The finance team has been notified to process payment according to Net‑30 terms.</p>`,
                { poNumber }
            );
        }

        res.json({ success: true, message: 'Goods marked as cleared.' });
    } catch (error) {
        console.error('Failed to clear goods:', error);
        res.status(500).json({ error: 'Failed to clear goods' });
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

                await sendSupplierEmail(
                    supplierEmail,
                    `New Message regarding ${referenceNumber}`,
                    `<p>The Nestlé Finance team has sent you a new message regarding <strong>${referenceNumber}</strong>:</p>
                     <blockquote style="border-left:4px solid #ccc; padding-left:10px;">${message}</blockquote>
                     <p>Please log in to your Supplier Dashboard to reply.</p>`
                );
            }
        } else if (senderRole === 'Supplier') {
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

// ==========================================
// 💬 LIVE CHAT - BIDIRECTIONAL PORTAL MESSAGING
// ==========================================

// GET messages for a live chat channel (e.g., "LIVECHAT-Finance-Supplier")
router.get('/livechat/:channel', async (req, res) => {
    const { channel } = req.params;
    try {
        const { data, error } = await supabase
            .from('disputes')
            .select('*')
            .eq('reference_number', channel)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch live chat messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST a message to a live chat channel
router.post('/livechat/send', async (req, res) => {
    const { channel, senderEmail, senderRole, recipientRole, recipientEmail, message } = req.body;
    if (!channel || !senderRole || !recipientRole || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const { error } = await supabase.from('disputes').insert([
            {
                reference_number: channel,
                sender_email: senderEmail || null,
                sender_role: senderRole,
                message
            }
        ]);
        if (error) throw error;

        const notificationRecords = [];
        const emailTargets = new Set();
        if (typeof recipientEmail === 'string' && recipientEmail.trim()) {
            emailTargets.add(normalizeEmail(recipientEmail));
        }

        const normalizedRecipientRole = String(recipientRole || '').trim().toLowerCase();
        if (normalizedRecipientRole === 'supplier') {
            const { data: supplierUsers, error: supplierUsersErr } = await supabase
                .from('app_users')
                .select('email')
                .ilike('role', 'supplier');
            if (supplierUsersErr) throw supplierUsersErr;

            (supplierUsers || []).forEach(({ email }) => {
                if (typeof email === 'string' && email.trim()) {
                    emailTargets.add(normalizeEmail(email));
                }
            });
        }

        if (emailTargets.size > 0) {
            for (const email of emailTargets) {
                notificationRecords.push({
                    user_email: email,
                    user_role: recipientRole,
                    title: `💬 New Message from ${senderRole}`,
                    message: `${senderRole} sent you a message in the live chat.`,
                    is_read: false
                });
            }
        } else {
            notificationRecords.push({
                user_role: recipientRole,
                title: `💬 New Message from ${senderRole}`,
                message: `${senderRole} sent you a message in the live chat.`,
                is_read: false
            });
        }

        const { error: notifErr } = await supabase.from('notifications').insert(notificationRecords);
        if (notifErr) throw notifErr;

        if (normalizedRecipientRole === 'supplier' && emailTargets.size > 0) {
            const safeSenderRole = escapeHtml(senderRole);
            const safeChannel = escapeHtml(channel);
            const safeMessage = escapeHtml(message);
            const safeSubjectSenderRole = String(senderRole || '').replace(/[\r\n]+/g, ' ').trim();
            const emailHtml = `
                <p>You have a new live chat message from <strong>${safeSenderRole}</strong>.</p>
                <p><strong>Channel:</strong> ${safeChannel}</p>
                <blockquote style="border-left:4px solid #ccc; padding-left:10px;">${safeMessage}</blockquote>
                <p>Please log in to your Supplier Dashboard to reply.</p>
            `;
            await Promise.all(Array.from(emailTargets).map((email) =>
                sendSupplierEmail(
                    email,
                    `New Live Chat Message from ${safeSubjectSenderRole || 'Support Team'}`,
                    emailHtml,
                    { poNumber: channel }
                ).catch((mailErr) => {
                    console.error('Failed to send live chat supplier email:', email, mailErr);
                })
            ));
        }

        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Failed to send live chat message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
