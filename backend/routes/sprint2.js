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

const stripShortagePhotoData = (poData) => {
    if (!poData || typeof poData !== 'object') return poData;
    const stripEvidencePhotos = (evidence) => {
        if (!Array.isArray(evidence)) return evidence;
        return evidence.map((item) => {
            if (!item || typeof item !== 'object') return item;
            return { ...item, photoDataUrl: '' };
        });
    };

    return {
        ...poData,
        warehouse_rejection: poData.warehouse_rejection,
        warehouse_grn: poData.warehouse_grn
            ? {
                ...poData.warehouse_grn,
                shortageEvidence: stripEvidencePhotos(poData.warehouse_grn.shortageEvidence)
            }
            : poData.warehouse_grn
    };
};

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const truncateLogField = (value, maxLength = MAX_LOG_FIELD_LENGTH) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}… [truncated]`;
};

const buildErrorSummary = (error) => ({
    message: truncateLogField(error?.message || 'Unknown error'),
    code: error?.code || '',
    details: truncateLogField(error?.details || ''),
    hint: truncateLogField(error?.hint || '')
});

const logRouteError = (context, error, additional = {}) => {
    console.error(`❌ ERROR [${context}]`, {
        ...buildErrorSummary(error),
        ...additional
    });
};

const withSupabaseTimeout = async (queryBuilder, timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        if (queryBuilder && typeof queryBuilder.abortSignal === 'function') {
            return await queryBuilder.abortSignal(controller.signal);
        }
        return await queryBuilder;
    } catch (error) {
        if (error?.name === 'AbortError') {
            const timeoutError = new Error(`Supabase request timed out after ${timeoutMs}ms`);
            timeoutError.code = 'SUPABASE_TIMEOUT';
            throw timeoutError;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

const runBackgroundTask = (label, task) => {
    Promise.resolve()
        .then(task)
        .catch((error) => {
            logRouteError('Background task failed', error, { label });
        });
};

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
                withSupabaseTimeout(
                    supabase
                        .from('notifications')
                        .select('*')
                        .ilike('user_email', email)
                        .order('created_at', { ascending: false })
                        .limit(50)
                ),
                withSupabaseTimeout(
                    supabase
                        .from('notifications')
                        .select('*')
                        .ilike('user_role', role)
                        .order('created_at', { ascending: false })
                        .limit(50)
                )
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
            query = query.ilike('user_email', email);
        } else {
            query = query.ilike('user_role', role);
        }

        const { data, error } = await withSupabaseTimeout(
            query
                .order('created_at', { ascending: false })
                .limit(50)
        );

        if (error) throw error;
        res.json({ success: true, notifications: data });
    } catch (error) {
        logRouteError('Failed to fetch notifications', error, { email, role });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.post('/notifications/mark-read', async (req, res) => {
    const { ids } = req.body;
    try {
        await withSupabaseTimeout(
            supabase.from('notifications').update({ is_read: true }).in('id', ids)
        );
        res.json({ success: true });
    } catch (error) {
        logRouteError('Failed to mark notifications as read', error, { count: Array.isArray(ids) ? ids.length : 0 });
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

        res.json({ success: true });

        runBackgroundTask(`acknowledge:${poNumber}`, async () => {
            const { data: po, error: poErr } = await supabase
                .from('purchase_orders')
                .select('supplier_email, total_amount')
                .eq('po_number', poNumber)
                .single();
            if (poErr) throw poErr;

            const sideEffects = [
                supabase.from('notifications').insert([{
                    user_role: 'Finance',
                    title: '🚚 Shipment at Bay',
                    message: `Shipment ${shipmentId} (PO: ${poNumber}) has arrived at the dock and is pending GRN scan.`,
                    link: `/finance?search=${poNumber}`,
                    is_read: false
                }])
            ];

            if (po?.supplier_email) {
                sideEffects.push(
                    supabase.from('notifications').insert([{
                        user_email: po.supplier_email,
                        user_role: 'Supplier',
                        title: '🚚 Shipment Acknowledged',
                        message: `Warehouse has acknowledged arrival for Shipment ${shipmentId}.`,
                        link: `/logs?po=${poNumber}`,
                        is_read: false
                    }])
                );

                const detailedEmailBody = `
                    <p>Hello,</p>
                    <p>This is an automated confirmation that the Nestlé Warehouse team has successfully acknowledged the arrival of your transport vehicle at the delivery bay.</p>
                    <p><strong>Shipment Reference:</strong> ${shipmentId}</p>
                    <p><strong>Purchase Order:</strong> ${poNumber}</p>
                    <p>Your goods will now be systematically unloaded and inspected. Our warehouse staff will proceed to rigorously scan the delivered pallets to generate the official <strong>Goods Receipt Note (GRN)</strong>.</p>
                    <p>Once the goods have been fully inspected and the GRN is locked, you will receive another notification detailing the exact quantities received, including any detected shortages or discrepancies. You can monitor the real-time status of this shipment in your Supplier Dashboard.</p>
                `;

                sideEffects.push(
                    sendSupplierEmail(
                        po.supplier_email,
                        `Shipment Arrival Acknowledged – ${shipmentId}`,
                        detailedEmailBody,
                        { poNumber: poNumber, invoiceNumber: shipmentId, amount: po.total_amount, currency: 'USD' }
                    )
                );
            }

            await Promise.allSettled(sideEffects);
        });
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
    if (!Array.isArray(itemsReceived) || itemsReceived.length === 0) {
        return res.status(400).json({ error: 'Invalid request: itemsReceived is required and must contain at least one item' });
    }
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
            itemsReceived.filter(item => item?.status === 'Shortage' || toSafeNumber(item?.actualQtyReceived) < toSafeNumber(item?.qty))
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
                itemsReceived,
                shortageEvidence
            }
        };

        await supabase.from('purchase_orders').update({ status: newStatus, po_data: updatedPoData }).eq('po_number', poNumber);

        const shortageCount = shortageEvidence.length;
        const photoEvidenceCount = shortageEvidence.filter(item => item.photoDataUrl).length;

        res.json({ success: true, message: 'GRN Logged Successfully.', gpsLocation });

        runBackgroundTask(`submit:${poNumber}`, async () => {
            const shipmentId = getShipmentId(poNumber);
            const sideEffects = [
                supabase.from('notifications').insert([
                    {
                        user_role: 'Finance',
                        title: '✅ GRN Completed',
                        message: `Warehouse finished scanning ${poNumber}. ${shortageCount > 0 ? `${shortageCount} shortage item(s) flagged${photoEvidenceCount > 0 ? ` with ${photoEvidenceCount} photo evidence attachment(s)` : ''}. ` : ''}Ready for final payout validation.`,
                        link: `/finance?recon=${poNumber}`,
                        is_read: false
                    }
                ])
            ];

            if (poContext?.supplier_email) {
                sideEffects.push(
                    supabase.from('notifications').insert([
                        {
                            user_email: poContext.supplier_email,
                            user_role: 'Supplier',
                            title: '📦 Goods Received',
                            message: `The warehouse has successfully scanned and received your goods for shipment ${shipmentId}.`,
                            link: `/logs?po=${poNumber}`,
                            is_read: false
                        }
                    ])
                );

                const itemsSummary = itemsReceived.map(item =>
                    `<li><strong>${item.description}</strong>: ${item.actualQtyReceived} of ${item.qty} units received (${item.status || 'Full Match'})</li>`
                ).join('');

                const emailBody = `
                    <p>The Nestlé Warehouse has successfully scanned and received your goods for shipment <strong>${shipmentId}</strong> (PO: ${poNumber}).</p>
                    <p><strong>Receipt Summary:</strong></p>
                    <ul style="margin-left: 20px; padding-left: 0;">${itemsSummary}</ul>
                    <p><strong>Status:</strong> ${newStatus}</p>
                    <p><strong>Total Received Value:</strong> ${formatCurrency(totalReceivedAmount)}</p>
                    <p>Payment will be processed according to Net-30 terms from the date of receipt. You can track the full lifecycle in your Supplier Dashboard.</p>
                `;

                sideEffects.push(
                    sendSupplierEmail(
                        poContext.supplier_email,
                        `Goods Received – ${shipmentId}`,
                        emailBody,
                        { poNumber, amount: totalReceivedAmount, currency: 'USD' }
                    )
                );
            }

            await Promise.allSettled(sideEffects);
        });
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

        res.json({ success: true, message: 'Shipment rejected and transaction canceled.' });

        runBackgroundTask(`reject:${poNumber}`, async () => {
            const sideEffects = [
                supabase.from('disputes').insert([{
                    reference_number: poNumber,
                    sender_email: rejectedBy,
                    sender_role: 'Warehouse',
                    message: `WAREHOUSE REJECTION: Shipment ${shipmentId} rejected due to shortage. ${rejectionReason ? `Reason: ${rejectionReason}. ` : ''}Short items: ${shortageSummary}. Transaction canceled.`
                }]),
                supabase.from('notifications').insert([{
                    user_role: 'Finance',
                    title: '❌ Shipment Rejected by Warehouse',
                    message: `Shipment ${shipmentId} (${poNumber}) was rejected for shortage. Updated quantities and photo evidence are available in the finance review context.`,
                    link: `/finance?recon=${poNumber}`,
                    is_read: false
                }])
            ];

            if (poContext?.supplier_email) {
                sideEffects.push(
                    supabase.from('notifications').insert([{
                        user_email: poContext.supplier_email,
                        user_role: 'Supplier',
                        title: '❌ Shipment Rejected',
                        message: `Shipment ${shipmentId} was rejected by warehouse due to shortages. Transaction canceled.`,
                        link: `/logs?po=${poNumber}`,
                        is_read: false
                    }])
                );

                const emailBody = `
                    <p>Your shipment <strong>${shipmentId}</strong> (PO: ${poNumber}) has been <strong>rejected by the warehouse</strong> due to a goods shortage.</p>
                    <p><strong>Transaction Status:</strong> Canceled</p>
                    ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                    <p><strong>Shortage Summary:</strong> ${shortageSummary}</p>
                    <p>Please coordinate with the procurement/finance teams for next steps.</p>
                `;

                sideEffects.push(
                    sendSupplierEmail(
                        poContext.supplier_email,
                        `Shipment Rejected – ${shipmentId}`,
                        emailBody,
                        { poNumber, amount: poContext.total_amount, currency: 'USD' }
                    )
                );
            }

            await Promise.allSettled(sideEffects);
        });

    } catch (error) {
        console.error('Failed to reject shipment:', error);
        return res.status(500).json({ error: 'Failed to reject shipment' });
    }
});

router.get('/grn/pending-pos', async (req, res) => {
    try {
        const scope = String(req.query.scope || '').trim().toLowerCase();
        const includePhotosRaw = String(req.query.includePhotos || '').trim().toLowerCase();
        const includePhotos = includePhotosRaw === 'true' || includePhotosRaw === '1' || includePhotosRaw === 'yes';
        const isWarehouseScope = scope === 'warehouse';
        const selectFields = (isWarehouseScope || includePhotos)
            ? 'id, po_number, supplier_email, status, created_at, po_data, total_amount'
            : 'id, po_number, supplier_email, status, created_at, total_amount';

        console.log(`[pending-pos] scope="${scope}" isWarehouse=${isWarehouseScope} includePhotos=${includePhotos}`);

        const WAREHOUSE_STATUSES = [
            'Pending',
            'PO Generated',
            'In Transit',
            'Delivered to Dock',
            'Pending Warehouse GRN',
            'Truck at Bay - Pending Unload',
            'Goods Received (GRN Logged)',
            'Partially Received (Awaiting Backorder)',
            'Transaction Cancelled (Shortage)',
            'Goods Cleared - Ready for Payout'
        ];

        let query = supabase
            .from('purchase_orders')
            .select(selectFields);

        if (isWarehouseScope) {
            console.log(`[pending-pos] Querying with .in('status', [${WAREHOUSE_STATUSES.map(s => `"${s}"`).join(', ')}])`);
            query = query
                .in('status', WAREHOUSE_STATUSES)
                .order('created_at', { ascending: false })
                .limit(100);
        } else if (includePhotos) {
            query = query
                .order('created_at', { ascending: false })
                .limit(PENDING_POS_WITH_PHOTOS_MAX_RECORDS);
        } else {
            query = query
                .order('created_at', { ascending: false })
                .limit(DEFAULT_PENDING_POS_MAX_RECORDS);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ [pending-pos] Supabase query error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return res.status(500).json({
                error: 'Failed to fetch POs',
                details: error.message,
                hint: error.hint
            });
        }

        const sourceData = data || [];
        console.log(`[pending-pos] Supabase returned ${sourceData.length} row(s)`);

        if (sourceData.length === 0) {
            console.warn('[pending-pos] ⚠️  0 rows returned. Either no POs exist with those statuses, or RLS is blocking the query.');

            // Diagnostic: count ALL rows to check if RLS is the problem
            const { count, error: countErr } = await supabase
                .from('purchase_orders')
                .select('*', { count: 'exact', head: true });
            if (countErr) {
                console.error('[pending-pos] Diagnostic count error:', countErr.message);
            } else {
                console.log(`[pending-pos] Diagnostic: total purchase_orders rows visible to anon key = ${count}`);
            }
        } else {
            sourceData.forEach(po => {
                console.log(`[pending-pos]   ${po.po_number} | status="${po.status}" | supplier=${po.supplier_email} | has_po_data=${Boolean(po.po_data)}`);
            });
        }

        const responseData = includePhotos
            ? sourceData
            : sourceData.map((po) => ({
                ...po,
                po_data: stripShortagePhotoData(po.po_data)
            }));

        console.log(`[pending-pos] Responding with ${responseData.length} PO(s)`);
        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('❌ [pending-pos] Unhandled exception:', error);
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
        const { data: po, error: updateErr } = await supabase
            .from('purchase_orders')
            .update({ status: 'Goods Cleared - Ready for Payout' })
            .eq('po_number', poNumber)
            .select('id, supplier_email')
            .single();

        if (updateErr && updateErr.code !== 'PGRST116') throw updateErr;

        // Fetch reconciliation to get invoice total
        const { data: recon } = await supabase
            .from('reconciliations')
            .select('id, supplier_email, invoice_total')
            .eq('po_number', poNumber)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const supplierEmail = po?.supplier_email || recon?.supplier_email;
        const shipmentId = getShipmentId(poNumber);

        // Auto-Generation: calculate scheduled_date (Net-30) and base_amount
        const baseAmount = recon?.invoice_total || 0;
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30); // Net-30 terms

        const { error: payoutErr } = await supabase.from('payout_schedules').insert([{
            invoice_ref: recon?.id || null,
            po_ref: po?.id || null,
            supplier_email: supplierEmail,
            title: `Payout for ${shipmentId}`,
            start_date: scheduledDate.toISOString(),
            end_date: scheduledDate.toISOString(),
            base_amount: baseAmount,
            final_amount: baseAmount,
            status: 'Pending Finance'
        }]);

        if (payoutErr) {
            console.error('Failed to insert payout schedule:', payoutErr);
        }

        // 🔔 Notify Finance
        await supabase.from('notifications').insert([{
            user_role: 'Finance',
            title: '✅ Goods Cleared',
            message: `Shipment ${shipmentId} cleared. Payout ready for scheduling.`,
            link: `/finance?recon=${poNumber}`,
            is_read: false
        }]);

        // 🔔 Notify Supplier (in‑app)
        if (supplierEmail) {
            await supabase.from('notifications').insert([{
                user_email: supplierEmail,
                user_role: 'Supplier',
                title: '✅ Goods Cleared',
                message: `Goods received and verified for ${shipmentId}. Pending Finance scheduling.`,
                link: `/logs?po=${poNumber}`,
                is_read: false
            }]);

            // 📧 Email Supplier
            await sendSupplierEmail(
                supplierEmail,
                `Goods Cleared – ${shipmentId}`,
                `<p>Your shipment <strong>${shipmentId}</strong> (PO: ${poNumber}) has been <strong>cleared</strong> by the warehouse after inspection.</p>
                 <p>Goods received and verified. Pending Finance scheduling.</p>`,
                { poNumber }
            );
        }

        res.json({ success: true, message: 'Goods marked as cleared. Payout scheduled.' });
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
    const reconciliationId = String(req.params.id || '').replace(/^rec-/, '');
    if (!reconciliationId) {
        return res.status(400).json({ error: 'Invalid reconciliation id' });
    }
    try {
        const { error } = await supabase.from('reconciliations').delete().eq('id', reconciliationId);
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

// ==========================================
// 💸 PAYOUT CALENDAR UPDATES
// ==========================================
router.get('/payouts', async (req, res) => {
    const { email } = req.query;
    try {
        let query = supabase.from('payout_schedules').select('*');
        if (email) {
            query = query.ilike('supplier_email', email);
        }
        const { data, error } = await query.order('start_date', { ascending: true });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch payouts:', error);
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});


router.get('/payouts/:id/promise-to-pay.pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('payout_schedules')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return res.status(404).send('Not Found');

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Promise-to-Pay-${data.id}.pdf"`);

        doc.pipe(res);

        // Styling
        doc.fontSize(24).font('Helvetica-Bold').text('Nestlé', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Global Procurement Center', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(20).text('Promise to Pay', { underline: true });
        doc.moveDown(1);

        doc.fontSize(12).text(`Date Issued: ${new Date().toLocaleDateString()}`);
        doc.text(`Reference ID: ${data.id}`);
        doc.text(`Supplier Email: ${data.supplier_email}`);
        doc.moveDown(2);

        doc.fontSize(14).text('Dear Valued Supplier,');
        doc.moveDown();
        doc.fontSize(12).text('This document serves as formal confirmation that your invoice has been successfully processed, validated, and approved for payment following our 3-way matching protocol.');
        doc.moveDown(1);

        doc.text(`Total Approved Amount: ${data.final_amount || data.base_amount}`, { font: 'Helvetica-Bold' });
        doc.text(`Scheduled Payout Date: ${new Date(data.start_date).toLocaleDateString()}`, { font: 'Helvetica-Bold' });
        doc.moveDown(2);

        doc.font('Helvetica').text('Thank you for your continued partnership.');
        doc.moveDown(4);

        doc.text('Authorized by Nestlé Finance Command');

        doc.end();

    } catch (error) {
        console.error('PDF Gen Error:', error);
        res.status(500).send('Error generating PDF');
    }
});

router.patch('/payouts/:id/confirm', async (req, res) => {
    const { id } = req.params;
    const { start_date, base_amount } = req.body;
    try {
        const proofUrl = `https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${id}/promise-to-pay.pdf`;

        const { data, error } = await supabase
            .from('payout_schedules')
            .update({
                status: 'Scheduled',
                start_date: start_date,
                end_date: start_date,
                base_amount: base_amount,
                final_amount: base_amount,
                proof_document_url: proofUrl
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify Supplier
        if (data && data.supplier_email) {
            await supabase.from('notifications').insert([{
                user_email: data.supplier_email,
                user_role: 'Supplier',
                title: '📅 Payout Scheduled',
                message: `Finance has scheduled the payout for ${data.title} to ${new Date(start_date).toLocaleDateString()}.`,
                link: `/liquidity`,
                is_read: false
            }]);

            const emailHtml = `
                <p>Hello,</p>
                <p>We confirm receipt of your Invoice and GRN. Payment of ${data.final_amount} will be disbursed on <strong>${new Date(start_date).toLocaleDateString()}</strong>.</p>
                <p>You can view your formal Promise to Pay letter and updated calendar in the Supplier Portal.</p>
            `;
            await sendSupplierEmail(
                data.supplier_email,
                `Payout Scheduled - ${data.title}`,
                emailHtml
            );
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to confirm payout:', error);
        res.status(500).json({ error: 'Failed to confirm payout' });
    }
});

router.patch('/payouts/:id/discount', async (req, res) => {
    const { id } = req.params;
    const { early_date, new_amount } = req.body;
    try {
        const { data, error } = await supabase
            .from('payout_schedules')
            .update({
                status: 'Renegotiated',
                start_date: early_date,
                end_date: early_date,
                final_amount: new_amount
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify Finance
        await supabase.from('notifications').insert([{
            user_role: 'Finance',
            title: '⚡ Early Payout Accepted',
            message: `Supplier ${data.supplier_email} accepted early payout for ${data.title}. Calendar updated to ${new Date(early_date).toLocaleDateString()} for ${new_amount}.`,
            link: `/payouts`,
            is_read: false
        }]);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to apply discount:', error);
        res.status(500).json({ error: 'Failed to apply discount' });
    }
});

router.get('/lifecycle/transaction/:invoice_ref', async (req, res) => {
    const { invoice_ref } = req.params;
    try {
        const { data: recon } = await supabase.from('reconciliations').select('*').eq('id', invoice_ref).single();
        if (!recon) return res.status(404).json({ error: 'Transaction not found' });

        const poNumber = recon.po_number;
        const [
            { data: po },
            { data: grn },
            { data: boq },
            { data: payout }
        ] = await Promise.all([
            supabase.from('purchase_orders').select('*').eq('po_number', poNumber).single(),
            supabase.from('grns').select('*').eq('po_number', poNumber).order('created_at', { ascending: false }).limit(1).single(),
            supabase.from('boqs').select('*').eq('document_number', poNumber).single(),
            supabase.from('payout_schedules').select('*').eq('invoice_ref', invoice_ref).single()
        ]);

        res.json({
            success: true,
            data: {
                reconciliation: recon,
                purchase_order: po || null,
                grn: grn || null,
                boq: boq || null,
                payout_schedule: payout || null
            }
        });
    } catch (error) {
        console.error('Lifecycle error:', error);
        res.status(500).json({ error: 'Failed to fetch lifecycle' });
    }
});


router.post('/payouts/stage', async (req, res) => {
    const { invoice_ref, supplier_email, total_amount } = req.body;
    try {
        // Calculate Net-30 Date
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30);

        const payload = {
            invoice_ref,
            supplier_email,
            title: `Payout: ${supplier_email}`,
            start_date: scheduledDate,
            end_date: scheduledDate,
            base_amount: total_amount,
            final_amount: total_amount,
            amount: total_amount,
            status: 'Scheduled'
        };

        const { data, error } = await supabase.from('payout_schedules').insert(payload);
        if (error) throw error;

        // Trigger In-App Notification
        await supabase.from('notifications').insert({
            user_email: supplier_email,
            user_role: 'supplier',
            title: 'Payout Scheduled 🗓️',
            message: `Your payout of ${total_amount} has been added to the calendar.`,
            link: '/payouts'
        });

        // 📧 Email supplier about payout scheduled
        const scheduledDateFormatted = scheduledDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const payoutEmailBody = `
            <p>Hello,</p>
            <p>Your payout of <strong>${total_amount}</strong> has been successfully scheduled and added to the payment calendar.</p>
            <p><strong>Reference:</strong> Invoice Payout: ${supplier_email}</p>
            <p><strong>Scheduled Payout Date:</strong> ${scheduledDateFormatted} (Net-30 Terms)</p>
            <p>You can monitor the status of this payout in real-time through your Supplier Dashboard under the <strong>Payout Calendar</strong> section.</p>
            <p>Thank you for your continued partnership with Nestlé.</p>
        `;
        sendSupplierEmail(
            supplier_email,
            `Payout Scheduled – ${total_amount}`,
            payoutEmailBody,
            { amount: total_amount }
        ).catch(err => console.warn('[Payouts Stage] Email failed:', err.message));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Stage Error:', error);
        res.status(500).json({ error: 'Failed to stage payout' });
    }
});

router.post('/payouts/:id/disburse', async (req, res) => {
    const { id } = req.params;
    const { supplier_email, final_amount, mock_supplier_account } = req.body;

    try {
        // 1. Call the Mock Bank
        const bankResult = await simulateBankTransfer(mock_supplier_account, final_amount);

        // 2. Log it in the Mock Ledger
        await supabase.from('bank_transactions').insert({
            payout_ref: id,
            supplier_account_number: mock_supplier_account,
            amount: final_amount
        });

        // 3. Update Payout Status to 'Paid'
        await supabase.from('payout_schedules')
            .update({ status: 'Paid', bank_transaction_ref: bankResult.transactionId })
            .eq('id', id);

        // 4. Send Omnichannel Alerts
        await supabase.from('notifications').insert({
            user_email: supplier_email,
            user_role: 'supplier',
            title: 'Funds Disbursed 💰',
            message: `Payment of ${final_amount} has been wired to your account.`,
            link: '/payouts'
        });

        await sendSupplierEmail(
            supplier_email,
            'Payment Remittance Advice',
            `<p>Nestlé has successfully transferred ${final_amount} to account ending in ${mock_supplier_account.slice(-4)}.</p><p>Transaction Ref: ${bankResult.transactionId}.</p>`
        );

        res.status(200).json(bankResult);
    } catch (error) {
        console.error('Disburse Error:', error);
        res.status(500).json({ error: 'Failed to disburse' });
    }
});

router.patch('/payouts/:id/hold', async (req, res) => {
    const { id } = req.params;
    const { hold_until_date } = req.body;
    try {
        const { data, error } = await supabase
            .from('payout_schedules')
            .update({ status: 'Hold', hold_until_date })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 🔔 Notification & 📧 Email for HOLD
        if (data && data.supplier_email) {
            const formattedDate = new Date(hold_until_date).toLocaleDateString();
            await supabase.from('notifications').insert([{
                user_email: data.supplier_email,
                user_role: 'Supplier',
                title: '⏸️ Payment Put on Hold',
                message: `Finance has placed a hold on your payment for ${data.title} until ${formattedDate}.`,
                link: `/logs?po=${data.po_number || data.id}`,
                is_read: false
            }]);

            await sendSupplierEmail(
                data.supplier_email,
                `Payment Update: Put on Hold – ${data.title || data.id}`,
                `<p>Nestlé Finance has placed a <strong>temporary hold</strong> on your scheduled payment.</p>
                 <p><strong>Hold Until:</strong> ${formattedDate}</p>
                 <p>The hold is due to final internal audit requirements. You will be notified automatically when the hold is released.</p>`
            );
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Hold Error:', error);
        res.status(500).json({ error: 'Failed to put on hold' });
    }
});

router.patch('/payouts/:id', async (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, updatedBy } = req.body;
    try {
        const { data, error } = await supabase
            .from('payout_schedules')
            .update({ 
                start_date, 
                end_date: end_date || start_date,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 🔔 Notification & 📧 Email for Date Update
        if (data && data.supplier_email) {
            const formattedDate = new Date(start_date).toLocaleDateString();
            await supabase.from('notifications').insert([{
                user_email: data.supplier_email,
                user_role: 'Supplier',
                title: '📅 Payment Date Rescheduled',
                message: `The payment date for ${data.title} has been updated to ${formattedDate}.`,
                link: `/logs?po=${data.po_number || data.id}`,
                is_read: false
            }]);

            await sendSupplierEmail(
                data.supplier_email,
                `Payment Update: Date Rescheduled – ${data.title || data.id}`,
                `<p>Your scheduled payment date has been <strong>updated</strong> by the Finance team.</p>
                 <p><strong>New Payout Date:</strong> ${formattedDate}</p>
                 <p>You can view the updated schedule in your Treasury Calendar.</p>`
            );
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Update Payout Date Error:', error);
        res.status(500).json({ error: 'Failed to update payout date' });
    }
});

module.exports = router;