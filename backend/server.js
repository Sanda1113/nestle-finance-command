// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');
const supabase = require('./db');
const authRoutes = require('./routes/auth');
const xlsx = require('xlsx');
const sprint2Routes = require('./routes/sprint2');
const { sendSupplierEmail } = require('./mailer');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

// 🔍 Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

const allowedOrigins = [
    'https://www.nestlefinancecommand.com',
    'https://nestlefinancecommand.com',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sprint2', sprint2Routes);

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Enterprise API is Online');
});

// 🛡️ Validate required environment variables on startup
const requiredEnvVars = ['MINDEE_V2_API_KEY', 'RESEND_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error('   Please set these in Railway Variables tab.');
}

const upload = multer({ storage: multer.memoryStorage() });
const SUPPLIER_PO_MAX_RECORDS = 300;
const SUPPLIER_PO_TIMEOUT_FALLBACK_MAX_RECORDS = 120;

// ==========================================
// 🛡️ ERROR LOGGING HELPER
// ==========================================
const logError = (context, error, additional = {}) => {
    console.error(`\n❌ ERROR [${context}]`);
    console.error(`   Message: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.details) console.error(`   Details: ${error.details}`);
    if (error.hint) console.error(`   Hint: ${error.hint}`);
    if (Object.keys(additional).length) {
        console.error(`   Context:`, JSON.stringify(additional, null, 2));
    }
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        console.error(`   Stack: ${error.stack}`);
    }
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
        warehouse_rejection: poData.warehouse_rejection
            ? {
                ...poData.warehouse_rejection,
                shortageEvidence: stripEvidencePhotos(poData.warehouse_rejection.shortageEvidence)
            }
            : poData.warehouse_rejection,
        warehouse_grn: poData.warehouse_grn
            ? {
                ...poData.warehouse_grn,
                shortageEvidence: stripEvidencePhotos(poData.warehouse_grn.shortageEvidence)
            }
            : poData.warehouse_grn
    };
};

// ==========================================
// 🧠 MINDEE MAP TO JSON CONVERTER
// ==========================================
function mindeeToObject(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj.entries === 'function') {
        const out = {};
        for (const [key, val] of obj.entries()) {
            out[key] = mindeeToObject(val);
        }
        return out;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => mindeeToObject(item));
    }
    if (typeof obj === 'object') {
        const out = {};
        for (const key of Object.keys(obj)) {
            if (!key.startsWith('_') && key !== 'polygon' && key !== 'boundingBox' && key !== 'bounding_box' && key !== 'confidence') {
                out[key] = mindeeToObject(obj[key]);
            }
        }
        return out;
    }
    return obj;
}

// ==========================================
// 🏢 AI EXTRACTION & AUTO-SAVE
// ==========================================
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) {
            console.warn('⚠️ Extract invoice called without file');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`\n📄 --- Extracting Document: ${req.file.originalname} (${req.file.size} bytes) ---`);

        const fileName = req.file.originalname.toLowerCase();

        // Native Excel/CSV handler
        if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            console.log("📊 Excel/CSV Detected. Parsing natively...");
            let lineItems = [];
            let totalAmount = 0;

            try {
                const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

                data.forEach((row, index) => {
                    const values = Object.values(row);
                    if (values.length >= 2) {
                        const desc = values.find(v => typeof v === 'string' && isNaN(v)) || `Item ${index + 1}`;
                        const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

                        const qty = numbers.length > 1 ? numbers[0] : 1;
                        const price = numbers.length > 1 ? numbers[1] : (numbers[0] || 0);
                        const amount = qty * price;

                        if (price > 0) {
                            lineItems.push({ qty: qty.toString(), description: desc, unitPrice: price, amount: amount });
                            totalAmount += amount;
                        }
                    }
                });

                console.log(`✅ Excel parsed: ${lineItems.length} items, total ${totalAmount}`);
                return res.json({
                    success: true,
                    extractedData: {
                        vendorName: 'Supplier (Extracted via CSV)',
                        vendorAddress: 'Extracted from Tabular Data',
                        invoiceNumber: `DOC-${Date.now().toString().slice(-5)}`,
                        invoiceDate: new Date().toISOString().split('T')[0],
                        poNumber: 'Not Found',
                        dueDate: new Date().toISOString().split('T')[0],
                        billTo: 'Nestle Procurement',
                        shipTo: 'Nestle Warehouse',
                        subtotal: totalAmount,
                        salesTax: 0,
                        totalAmount: totalAmount,
                        currency: 'USD',
                        lineItems: lineItems
                    }
                });
            } catch (excelError) {
                logError('Excel Parsing', excelError, { fileName });
                return res.status(500).json({ error: 'Failed to parse Excel/CSV file' });
            }
        }

        // Mindee extraction
        if (!process.env.MINDEE_V2_API_KEY) {
            console.error('❌ MINDEE_V2_API_KEY is not set');
            return res.status(500).json({ error: 'OCR service configuration missing' });
        }

        const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_V2_API_KEY });
        const inputSource = new mindee.BufferInput({ buffer: req.file.buffer, filename: req.file.originalname || 'invoice.pdf' });

        console.log('🤖 Sending to Mindee for extraction...');
        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" }
        );
        console.log('✅ Mindee extraction completed');

        const rawPrediction = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};
        const rawFields = mindeeToObject(rawPrediction);

        const getSafeString = (field) => {
            if (field === null || field === undefined) return null;
            if (typeof field === 'string' || typeof field === 'number') return String(field).trim();

            if (field.value !== undefined && field.value !== null) return String(field.value).trim();
            if (field.content !== undefined && field.content !== null) return String(field.content).trim();
            if (field.text !== undefined && field.text !== null) return String(field.text).trim();

            if (Array.isArray(field) && field.length > 0) return getSafeString(field[0]);

            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            if (field.items && Array.isArray(field.items) && field.items.length > 0) return getSafeString(field.items[0]);

            if (typeof field === 'object') {
                if (field.name) return getSafeString(field.name);
                if (field.description) return getSafeString(field.description);
                if (field.address) return getSafeString(field.address);
                if (field.number) return getSafeString(field.number);
            }
            return null;
        };

        const getAddressText = (field) => {
            if (!field) return null;
            const targetObj = Array.isArray(field) ? field[0] : field;
            if (!targetObj) return null;
            const str = getSafeString(targetObj);
            if (str && str !== '[object Object]') return str;

            if (typeof targetObj === 'object') {
                let parts = [];
                const target = targetObj.value || targetObj.fields || targetObj;

                if (target.address) {
                    const addrStr = getSafeString(target.address);
                    if (addrStr) parts.push(addrStr);
                }

                if (parts.length === 0) {
                    if (target.street_number) parts.push(getSafeString(target.street_number));
                    if (target.street_name) parts.push(getSafeString(target.street_name));
                    if (target.city) parts.push(getSafeString(target.city));
                    if (target.state) parts.push(getSafeString(target.state));
                    if (target.postal_code) parts.push(getSafeString(target.postal_code));
                    if (target.country) parts.push(getSafeString(target.country));
                }

                if (parts.length > 0) return parts.filter(Boolean).join(', ');
            }
            return null;
        };

        const getNum = (field) => {
            const str = getSafeString(field);
            if (!str) return 0.00;
            const cleanVal = str.replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        const extractCurrency = (localeField) => {
            if (!localeField) return 'USD';
            const target = localeField.value || localeField.fields || localeField;
            if (target.currency) return getSafeString(target.currency) || 'USD';
            return 'USD';
        };

        const extractLineItems = (lineItemsObj) => {
            if (!lineItemsObj) return [];

            let itemsArray = [];
            if (lineItemsObj.items && typeof lineItemsObj.items === 'object') {
                itemsArray = Array.isArray(lineItemsObj.items) ? lineItemsObj.items : Object.values(lineItemsObj.items);
            } else if (lineItemsObj.values && typeof lineItemsObj.values === 'object') {
                itemsArray = Array.isArray(lineItemsObj.values) ? lineItemsObj.values : Object.values(lineItemsObj.values);
            } else if (Array.isArray(lineItemsObj)) {
                itemsArray = lineItemsObj;
            } else if (typeof lineItemsObj === 'object') {
                itemsArray = Object.values(lineItemsObj);
            }

            if (!Array.isArray(itemsArray)) return [];

            return itemsArray.map(item => {
                const f = item.value || item.fields || item;
                return {
                    qty: getSafeString(f?.quantity) || '1',
                    description: getSafeString(f?.description) || getSafeString(f?.item_description) || getSafeString(f) || 'Unknown Item',
                    unitPrice: getNum(f?.unit_price),
                    amount: getNum(f?.total_price) || getNum(f?.amount) || getNum(f?.total_amount)
                };
            }).filter(item => item.amount > 0 || item.unitPrice > 0);
        };

        const getRefNumbers = (field) => {
            if (!field) return null;
            if (Array.isArray(field) && field.length > 0) return getSafeString(field[0]);
            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            return getSafeString(field);
        };

        const extractedData = {
            vendorName: getSafeString(rawFields.supplier_name) || getSafeString(rawFields.vendor_name) || getSafeString(rawFields.customer_name) || 'Unknown Vendor',
            vendorAddress: getAddressText(rawFields.supplier_address) || getAddressText(rawFields.vendor_address) || 'Not Found',
            invoiceNumber: getSafeString(rawFields.invoice_number) || getSafeString(rawFields.document_number) || getSafeString(rawFields.po_number) || 'Not Found',
            invoiceDate: getSafeString(rawFields.date) || getSafeString(rawFields.invoice_date) || getSafeString(rawFields.issue_date) || new Date().toISOString().split('T')[0],
            poNumber: getRefNumbers(rawFields.po_number) || getRefNumbers(rawFields.reference_numbers) || 'Not Found',
            dueDate: getSafeString(rawFields.due_date) || 'Not Found',
            billTo: getAddressText(rawFields.customer_address) || getAddressText(rawFields.billing_address) || getSafeString(rawFields.customer_name) || 'Not Found',
            shipTo: getAddressText(rawFields.shipping_address) || 'Not Found',
            subtotal: getNum(rawFields.total_net) || getNum(rawFields.subtotal),
            salesTax: getNum(rawFields.total_tax) || getNum(rawFields.tax),
            totalAmount: getNum(rawFields.total_amount) || getNum(rawFields.total),
            currency: extractCurrency(rawFields.locale),
            lineItems: extractLineItems(rawFields.line_items)
        };

        console.log(`✅ Extraction complete: Vendor ${extractedData.vendorName}, Total ${extractedData.totalAmount}`);
        res.json({ success: true, extractedData });

    } catch (error) {
        logError('Extract Invoice', error, { fileName: req.file?.originalname });
        res.status(500).json({ error: 'Invoice processing failed. Check server logs.' });
    }
});

// ==========================================
// 🛡️ RECONCILIATION & LOGGING
// ==========================================
app.post('/api/save-reconciliation', async (req, res) => {
    const { invoiceData, poData, matchStatus, supplierEmail } = req.body;
    try {
        console.log(`💾 Saving reconciliation: ${invoiceData?.invoiceNumber} / ${poData?.poNumber}`);

        const invoiceFileUrl = invoiceData?.fileUrl || invoiceData?.file_url;
        if (invoiceFileUrl) {
            const { error: invErr } = await supabase.from('invoices').insert([{
                invoice_number: invoiceData.invoiceNumber,
                file_url: invoiceFileUrl,
                extracted_amount: invoiceData.totalAmount,
                status: matchStatus
            }]);
            if (invErr) {
                logError('Insert Invoice', invErr, { invoiceNumber: invoiceData.invoiceNumber });
            }
        } else {
            console.warn(`⚠️ Skipping invoices table insert for ${invoiceData?.invoiceNumber || 'unknown invoice'}: missing file URL. Proceeding with reconciliation save, but no invoices row will be created.`);
        }

        let timeline = matchStatus === 'Approved' ? 'Awaiting Payout' : 'Discrepancy - Manual Review';

        const { error: reconErr } = await supabase.from('reconciliations').insert([{
            vendor_name: invoiceData.vendorName,
            invoice_number: invoiceData.invoiceNumber,
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
            invoice_total: invoiceData.totalAmount,
            po_total: poData.totalAmount,
            match_status: matchStatus,
            timeline_status: timeline,
            supplier_email: supplierEmail,
            invoice_data: invoiceData,
            po_data: poData,
            processed_at: new Date().toISOString()
        }]);

        if (reconErr) {
            logError('Insert Reconciliation', reconErr, { invoiceNumber: invoiceData.invoiceNumber });
            throw reconErr;
        }

        console.log(`✅ Reconciliation saved`);
        res.json({ success: true });
    } catch (error) {
        logError('Save Reconciliation', error);
        res.status(500).json({ error: 'Database save failed' });
    }
});

app.get('/api/reconciliations', async (req, res) => {
    try {
        const { email } = req.query;
        let query = supabase
            .from('reconciliations')
            .select('*')
            .order('processed_at', { ascending: false });
        // If a supplier email is passed, filter to only their records
        if (email) {
            query = query.eq('supplier_email', email);
        }
        const { data, error } = await query;
        if (error) throw error;
        const responseData = email
            ? (data || []).map(item => ({
                id: item.id,
                vendor_name: item.vendor_name,
                invoice_number: item.invoice_number,
                po_number: item.po_number,
                invoice_total: item.invoice_total,
                po_total: item.po_total,
                match_status: item.match_status,
                timeline_status: item.timeline_status,
                supplier_email: item.supplier_email,
                processed_at: item.processed_at,
                created_at: item.created_at,
                updated_at: item.updated_at || item.processed_at || item.created_at || null
            }))
            : data;
        res.json({ success: true, data: responseData });
    } catch (error) {
        logError('Fetch Reconciliations', error);
        res.status(500).json({ error: 'Failed to fetch ledger' });
    }
});

app.patch('/api/reconciliations/:id', async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;
    try {
        console.log(`📝 Updating reconciliation ${id} to ${newStatus}`);
        let newTimeline = newStatus === 'Approved' ? 'Approved - Awaiting Payout' : 'Rejected by Finance';
        const { error } = await supabase.from('reconciliations')
            .update({ match_status: newStatus, timeline_status: newTimeline })
            .eq('id', id);
        if (error) throw error;

        // Fetch full row — use SELECT * so the query never fails due to a missing column
        const { data: recon, error: fetchErr } = await supabase
            .from('reconciliations')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr) {
            logError('Fetch Recon for Email', fetchErr, { id });
        } else {
            // ── FALLBACK CHAIN ──────────────────────────────────────────────
            // 1) Direct supplier_email on reconciliation row
            let supplierEmail = recon?.supplier_email || null;
            let fallbackUsed = supplierEmail ? 'direct' : null;

            // 2) Look up from purchase_orders via po_number
            if (!supplierEmail && recon?.po_number && recon.po_number !== 'Not Found') {
                const { data: poRow } = await supabase
                    .from('purchase_orders')
                    .select('supplier_email')
                    .eq('po_number', recon.po_number)
                    .single();
                supplierEmail = poRow?.supplier_email || null;
                if (supplierEmail) fallbackUsed = 'purchase_orders';
            }

            // 3) Extract from invoice_data JSON blob (stored at submission time)
            if (!supplierEmail && recon?.invoice_data) {
                const idata = typeof recon.invoice_data === 'string'
                    ? JSON.parse(recon.invoice_data)
                    : recon.invoice_data;
                supplierEmail = idata?.supplierEmail || idata?.supplier_email || null;
                if (supplierEmail) fallbackUsed = 'invoice_data_json';
            }

            // 4) Look up from app_users — find any Supplier whose email appears
            //    in vendor_name OR who is the only Supplier registered
            if (!supplierEmail) {
                const { data: suppliers } = await supabase
                    .from('app_users')
                    .select('email')
                    .eq('role', 'Supplier');

                if (suppliers && suppliers.length === 1) {
                    supplierEmail = suppliers[0].email;
                    fallbackUsed = 'app_users_single';
                } else if (suppliers && suppliers.length > 1 && recon?.vendor_name) {
                    // Try to fuzzy match vendor_name against email prefix
                    const nameSlug = String(recon.vendor_name).toLowerCase().replace(/\s+/g, '');
                    const matched = suppliers.find(s =>
                        String(s.email).toLowerCase().replace(/[@.]/g, '').includes(nameSlug.substring(0, 5))
                    );
                    if (matched) {
                        supplierEmail = matched.email;
                        fallbackUsed = 'app_users_fuzzy';
                    }
                }
            }

            console.log(`📧 Recon #${id} — email resolved via [${fallbackUsed || 'NONE'}]: "${supplierEmail}"`);

            // Backfill the email on this row so future lookups are instant
            if (supplierEmail && !recon?.supplier_email) {
                await supabase.from('reconciliations')
                    .update({ supplier_email: supplierEmail })
                    .eq('id', id);
                console.log(`💾 Backfilled supplier_email on reconciliation ${id}`);
            }

            if (!supplierEmail) {
                console.warn(`⚠️  All fallbacks exhausted — no email for reconciliation ${id}. Notification skipped.`);
            } else {
                const statusText = newStatus === 'Approved' ? 'approved' : 'rejected';
                const statusLabel = statusText.charAt(0).toUpperCase() + statusText.slice(1);
                const emailBody = `
                    <p>Hello,</p>
                    <p>Your submitted Purchase Order (<strong>${recon.po_number || 'N/A'}</strong>) and Invoice (<strong>${recon.invoice_number}</strong>) have been <strong>${statusText}</strong> by the Nestlé Finance Review Queue.</p>
                    ${newStatus === 'Approved'
                        ? `<p>✅ The 3-way match is now complete (PO ↔ Invoice ↔ GRN). Payment will be automatically processed according to our agreed <strong>Net-30</strong> terms from the date of goods receipt.</p>
                           <p>You may track payment progress in your Supplier Dashboard.</p>`
                        : `<p>❌ If you believe this rejection was made in error, please use the <strong>Dispute Chat</strong> feature on your Supplier Dashboard to raise a dispute with the Finance team.</p>`
                    }
                `;

                await sendSupplierEmail(
                    supplierEmail,
                    `PO & Invoice ${statusLabel} – ${recon.invoice_number}`,
                    emailBody,
                    {
                        invoiceNumber: recon.invoice_number,
                        poNumber: recon.po_number,
                        amount: recon.invoice_total,
                        currency: recon.currency || 'USD'
                    }
                ).catch(err => logError('Recon Email', err, { email: supplierEmail }));

                // In-app notification
                try {
                    await supabase.from('notifications').insert([{
                        user_email: supplierEmail,
                        user_role: 'Supplier',
                        title: `${newStatus === 'Approved' ? '✅' : '❌'} PO & Invoice ${statusLabel}`,
                        message: `Your PO (${recon.po_number || recon.invoice_number}) and Invoice (${recon.invoice_number}) have been ${statusText} by the Finance team.`,
                        link: `/logs?po=${recon.po_number || recon.invoice_number}`,
                        is_read: false
                    }]);
                    console.log(`🔔 In-app notification inserted for ${supplierEmail}`);
                } catch (notifErr) {
                    logError('Recon Notification', notifErr, { supplier_email: supplierEmail });
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        logError('Update Reconciliation', error, { id, newStatus });
        res.status(500).json({ error: 'Status update failed' });
    }
});

// ==========================================
// 📧 EXPLICIT NOTIFY ENDPOINT (Finance → Supplier)
// Accepts supplierEmail in the request body — no DB column dependency
// ==========================================
app.post('/api/reconciliations/:id/notify', async (req, res) => {
    const { id } = req.params;
    const { supplierEmail, newStatus, invoiceNumber, poNumber } = req.body;
    if (!supplierEmail) return res.status(400).json({ error: 'supplierEmail required' });
    try {
        const statusText = newStatus === 'Approved' ? 'approved' : 'rejected';
        const statusLabel = statusText.charAt(0).toUpperCase() + statusText.slice(1);
        const emailBody = `
            <p>Hello,</p>
            <p>Your submitted Purchase Order (<strong>${poNumber || 'N/A'}</strong>) and Invoice (<strong>${invoiceNumber || id}</strong>) have been <strong>${statusText}</strong> by the Nestlé Finance Review Queue.</p>
            ${newStatus === 'Approved'
                ? `<p>✅ The 3-way match is now complete. Payment will be processed on <strong>Net-30</strong> terms.</p><p>Track payment progress in your Supplier Dashboard.</p>`
                : `<p>❌ If you believe this rejection was in error, use the <strong>Dispute Chat</strong> in your Supplier Dashboard.</p>`
            }
        `;
        await sendSupplierEmail(supplierEmail, `PO & Invoice ${statusLabel} – ${invoiceNumber || id}`, emailBody, { invoiceNumber, poNumber })
            .catch(err => logError('Explicit Notify Email', err, { supplierEmail }));
        await supabase.from('notifications').insert([{
            user_email: supplierEmail,
            user_role: 'Supplier',
            title: `${newStatus === 'Approved' ? '✅' : '❌'} PO & Invoice ${statusLabel}`,
            message: `Your PO (${poNumber || invoiceNumber}) and Invoice (${invoiceNumber}) have been ${statusText} by the Finance team.`,
            link: `/logs?po=${poNumber || invoiceNumber}`,
            is_read: false
        }]).catch(err => logError('Explicit Notify Notif', err, { supplierEmail }));
        console.log(`📬 Explicit notify sent to ${supplierEmail} — ${newStatus}`);
        res.json({ success: true });
    } catch (err) {
        logError('Explicit Notify', err, { id, supplierEmail });
        res.status(500).json({ error: 'Notification failed' });
    }
});

// ==========================================
// 📦 BOQ TO PO PROCUREMENT PIPELINE
// ==========================================
app.post('/api/save-boq', async (req, res) => {
    const { boqData, supplierEmail, vendorId } = req.body;
    try {
        console.log(`💾 Saving BOQ from ${boqData?.vendorName || 'Unknown'}`);
        const { error } = await supabase.from('boqs').insert([{
            vendor_name: boqData.vendorName,
            document_number: boqData.invoiceNumber !== 'Not Found' ? boqData.invoiceNumber : `BOQ-${Date.now().toString().slice(-6)}`,
            total_amount: boqData.totalAmount,
            currency: boqData.currency,
            status: 'Pending Review',
            line_items: boqData.lineItems,
            supplier_email: supplierEmail,
            vendor_id: vendorId
        }]);

        if (error) throw error;
        console.log(`✅ BOQ saved`);
        res.json({ success: true, message: 'BOQ Saved successfully' });
    } catch (error) {
        logError('Save BOQ', error);
        res.status(500).json({ error: 'Database save failed' });
    }
});

app.get('/api/boqs', async (req, res) => {
    try {
        const { email } = req.query;
        let query = supabase
            .from('boqs')
            .select('*')
            .order('created_at', { ascending: false });
        if (email) {
            query = query.eq('supplier_email', email);
        }
        const { data, error } = await query;
        if (error) throw error;
        const responseData = email
            ? (data || []).map(item => ({
                id: item.id,
                vendor_name: item.vendor_name,
                document_number: item.document_number,
                total_amount: item.total_amount,
                currency: item.currency,
                status: item.status,
                supplier_email: item.supplier_email,
                created_at: item.created_at,
                updated_at: item.updated_at || item.created_at || null,
                rejection_reason: item.rejection_reason || null
            }))
            : data;
        res.json({ success: true, data: responseData });
    } catch (error) {
        logError('Fetch BOQs', error);
        res.status(500).json({ error: 'Failed to fetch BOQs' });
    }
});

app.delete('/api/boqs/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('boqs').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logError('Delete BOQ', error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

app.post('/api/boqs/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        console.log(`❌ Rejecting BOQ ${id}, reason: ${reason}`);
        const { error } = await supabase.from('boqs').update({ status: 'Rejected', rejection_reason: reason }).eq('id', id);
        if (error) throw error;

        const { data: boq, error: fetchErr } = await supabase.from('boqs').select('supplier_email, vendor_name, document_number').eq('id', id).single();
        if (fetchErr) {
            logError('Fetch BOQ for Rejection Email', fetchErr, { id });
        } else if (boq?.supplier_email) {
            const emailBody = `
                <p>Dear ${boq.vendor_name},</p>
                <p>We regret to inform you that your quotation has been <strong>rejected</strong> after review by our procurement team.</p>
                <p><strong>Reason provided:</strong> ${reason}</p>
                <p>You may submit a revised quotation through the supplier portal. If you have any questions, please use the chat feature to contact our procurement department.</p>
            `;
            await sendSupplierEmail(
                boq.supplier_email,
                `BOQ Rejected`,
                emailBody,
                { invoiceNumber: boq.document_number }
            ).catch(err => logError('BOQ Rejection Email', err, { email: boq.supplier_email }));

            try {
                await supabase.from('notifications').insert([{
                    user_email: boq.supplier_email,
                    user_role: 'Supplier',
                    title: 'BOQ Rejected',
                    message: `Your quote was rejected. Reason: ${reason}`,
                    link: '/boq',
                    is_read: false
                }]);
            } catch (notifErr) {
                logError('BOQ Rejection Notification', notifErr, { supplier_email: boq.supplier_email });
            }
        }

        res.json({ success: true });
    } catch (error) {
        logError('Reject BOQ', error, { id, reason });
        res.status(500).json({ error: 'Failed to reject BOQ' });
    }
});

app.post('/api/boqs/:id/generate-po', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`📦 Generating PO from BOQ ${id}`);
        const { data: boqData, error: fetchErr } = await supabase.from('boqs').select('*').eq('id', id).single();
        if (fetchErr) throw fetchErr;

        const generatedPoNumber = `PO-NESTLE-${Date.now().toString().slice(-5)}`;

        const formalPoData = {
            poNumber: generatedPoNumber,
            poDate: new Date().toISOString().split('T')[0],
            buyerCompany: "Nestle Global Procurement\n123 Corporate Blvd\nColombo, Sri Lanka",
            supplierDetails: `${boqData.vendor_name}\n${boqData.supplier_email}`,
            currency: boqData.currency,
            totalAmount: boqData.total_amount,
            lineItems: boqData.line_items,
            deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            deliveryLocation: "Nestle Main Warehouse, Colombo",
            paymentTerms: "Net 30"
        };

        const { error: updateErr } = await supabase.from('boqs').update({ status: `PO Generated: ${generatedPoNumber}` }).eq('id', id);
        if (updateErr) {
            logError('Update BOQ Status', updateErr, { id, poNumber: generatedPoNumber });
        }

        const { error: poErr } = await supabase.from('purchase_orders').insert([{
            po_number: generatedPoNumber,
            total_amount: boqData.total_amount,
            status: 'Pending',
            supplier_email: boqData.supplier_email,
            po_data: formalPoData,
            is_downloaded: false
        }]);

        if (poErr) throw poErr;

        console.log(`✅ PO ${generatedPoNumber} created`);

        if (boqData.supplier_email) {
            const emailBody = `
                <p>Dear ${boqData.vendor_name},</p>
                <p>Your quotation has been reviewed and <strong>approved</strong> by our procurement team. A Purchase Order has been officially generated and is now available in your supplier portal.</p>
                <p><strong>Next Steps:</strong></p>
                <ol style="margin-left: 20px; padding-left: 0;">
                    <li>Download the Purchase Order from your dashboard.</li>
                    <li>Prepare the goods for shipment as per the PO line items.</li>
                    <li>Upload the final invoice along with the PO to initiate the 3-way match process.</li>
                    <li>Mark the shipment as "Delivered" once it arrives at our dock.</li>
                </ol>
            `;
            await sendSupplierEmail(
                boqData.supplier_email,
                `Purchase Order Generated – ${generatedPoNumber}`,
                emailBody,
                { poNumber: generatedPoNumber, amount: boqData.total_amount, currency: boqData.currency }
            ).catch(err => logError('PO Email', err, { email: boqData.supplier_email }));

            try {
                await supabase.from('notifications').insert([{
                    user_email: boqData.supplier_email,
                    user_role: 'Supplier',
                    title: 'PO Generated',
                    message: `PO ${generatedPoNumber} has been created from your quote.`,
                    link: `/inbox?po=${generatedPoNumber}`,
                    is_read: false
                }]);
            } catch (notifErr) {
                logError('PO Notification', notifErr, { supplier_email: boqData.supplier_email });
            }
        }

        res.json({ success: true, poNumber: generatedPoNumber });
    } catch (error) {
        logError('Generate PO', error, { boqId: id });
        res.status(500).json({ error: 'Failed to generate PO' });
    }
});

app.get('/api/supplier/pos/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const buildSupplierPOQuery = ({ maxRecords, includePoData }) => {
            const selectColumns = includePoData
                ? 'id, po_number, total_amount, status, created_at, updated_at, is_downloaded, supplier_email, po_data'
                : 'id, po_number, total_amount, status, created_at, updated_at, is_downloaded, supplier_email';
            return supabase
                .from('purchase_orders')
                .select(selectColumns)
                .eq('supplier_email', email)
                .order('id', { ascending: false })
                .limit(maxRecords);
        };

        let { data, error } = await buildSupplierPOQuery({
            maxRecords: SUPPLIER_PO_MAX_RECORDS,
            includePoData: true
        });
        if (error?.code === '57014') {
            console.warn(`⚠️ supplier/pos query timed out for ${email}. Retrying lightweight fallback.`);
            ({ data, error } = await buildSupplierPOQuery({
                maxRecords: SUPPLIER_PO_TIMEOUT_FALLBACK_MAX_RECORDS,
                includePoData: false
            }));
        }
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('id, po_number, total_amount, status, created_at, updated_at, is_downloaded, supplier_email')
            .eq('supplier_email', email)
            .order('id', { ascending: false });
        if (error) throw error;
        const responseData = (data || []).map(item => ({
            id: item.id,
            po_number: item.po_number,
            total_amount: item.total_amount,
            status: item.status,
            created_at: item.created_at,
            updated_at: item.updated_at || item.created_at || null,
            is_downloaded: item.is_downloaded,
            supplier_email: item.supplier_email,
            po_data: item.po_data ? stripShortagePhotoData(item.po_data) : null
        }));
        res.json({ success: true, data: responseData });
    } catch (error) {
        logError('Fetch Supplier POs', error, { email });
        res.status(500).json({ error: 'Failed to fetch POs' });
    }
});

app.get('/api/purchase_orders/:id', async (req, res) => {
    const { id } = req.params;
    const { email } = req.query;
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('id, po_number, total_amount, status, created_at, is_downloaded, supplier_email, po_data')
            .eq('id', id)
            .single();
        if (error) throw error;

        if (email && data?.supplier_email && data.supplier_email !== email) {
            return res.status(403).json({ error: 'Unauthorized for this PO' });
        }

        res.json({
            success: true,
            data: {
                ...data,
                updated_at: null
            }
        });
    } catch (error) {
        logError('Fetch Purchase Order', error, { id });
        res.status(500).json({ error: 'Failed to fetch purchase order' });
    }
});

app.patch('/api/purchase_orders/:id/downloaded', async (req, res) => {
    const { id } = req.params;
    try {
        await supabase.from('purchase_orders').update({ is_downloaded: true }).eq('id', id);
        res.json({ success: true });
    } catch (error) {
        logError('Mark PO Downloaded', error, { id });
        res.status(500).json({ error: 'Update failed' });
    }
});

// ==========================================
// 🚀 THE UNIFIED SUPPLIER TIMELINE ENGINE
// ==========================================
// ==========================================
// 🚀 THE UNIFIED SUPPLIER TIMELINE ENGINE (ENHANCED)
// ==========================================
app.get('/api/supplier/logs/:email', async (req, res) => {
    const { email } = req.params;
    try {
        console.log(`📜 Fetching timeline logs for ${email}`);

        const [
            { data: boqs, error: boqErr },
            { data: pos, error: posErr },
            { data: recs, error: recErr }
        ] = await Promise.all([
            supabase
                .from('boqs')
                .select('id, document_number, total_amount, status, created_at, rejection_reason, vendor_name')
                .eq('supplier_email', email),
            supabase
                .from('purchase_orders')
                .select('id, po_number, total_amount, status, created_at, is_downloaded')
                .eq('supplier_email', email),
            supabase
                .from('reconciliations')
                .select('id, invoice_number, match_status, timeline_status, processed_at')
                .eq('supplier_email', email)
        ]);

        if (boqErr) logError('Fetch BOQs for Logs', boqErr, { email });
        if (posErr) logError('Fetch POs for Logs', posErr, { email });
        if (recErr) logError('Fetch Recons for Logs', recErr, { email });

        let logs = [];

        // BOQ Timeline Events (with approval/rejection statuses)
        if (boqs) {
            boqs.forEach(b => {
                const isRejected = b.status === 'Rejected';
                const timelineStatus = isRejected
                    ? `❌ Rejected - Resubmission Available`
                    : b.status.includes('PO Generated')
                        ? `✅ Approved - PO Generated`
                        : `⏳ Pending Review`;

                logs.push({
                    id: `boq-${b.id}`,
                    date: b.created_at,
                    type: 'BOQ / Quote',
                    ref: b.document_number,
                    status: b.status,
                    timeline: timelineStatus,
                    action: 'Supplier Upload',
                    rejection_reason: b.rejection_reason || null,
                    can_resubmit: isRejected // Flag for frontend to enable resubmit button
                });
            });
        }

        // PO Timeline Events
        if (pos) {
            pos.forEach(p => logs.push({
                id: `po-${p.id}`,
                date: p.created_at || new Date().toISOString(),
                type: 'Official PO Generated',
                ref: p.po_number,
                status: p.is_downloaded ? 'Downloaded' : 'Available',
                timeline: p.is_downloaded ? '✅ Downloaded by Supplier' : '🌟 Ready for Download',
                action: 'Procurement Approval',
                can_resubmit: false
            }));
        }

        // Invoice & Reconciliation Timeline Events (with approval/rejection statuses)
        if (recs) {
            recs.forEach(r => {
                const isApproved = r.match_status === 'Approved';
                const isRejected = r.match_status === 'Rejected';

                const timelineStatus = isApproved
                    ? `✅ ${r.timeline_status}`
                    : isRejected
                        ? `❌ ${r.timeline_status} - Resubmission Available`
                        : `⏳ ${r.timeline_status}`;

                logs.push({
                    id: `rec-${r.id}`,
                    date: r.processed_at,
                    type: 'Invoice Match Process',
                    ref: r.invoice_number,
                    status: r.match_status,
                    timeline: timelineStatus,
                    action: 'Finance Review',
                    can_resubmit: isRejected // Supplier can resubmit rejected invoices
                });
            });
        }

        // Sort by date (most recent first)
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`✅ Returning ${logs.length} log entries with approval/rejection statuses`);
        res.json({ success: true, logs });
    } catch (error) {
        logError('Supplier Logs', error, { email });
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// ==========================================
// 🔄 SUPPLIER RESUBMISSION LOOP (NEW)
// ==========================================
// When BOQ is rejected, supplier can resubmit
app.post('/api/boqs/:id/resubmit', async (req, res) => {
    const { id } = req.params;
    const { boqData, supplierEmail } = req.body;
    try {
        console.log(`🔄 Resubmitting BOQ ${id} from ${supplierEmail}`);

        // Fetch original BOQ to verify ownership
        const { data: originalBoq, error: fetchErr } = await supabase
            .from('boqs')
            .select('*')
            .eq('id', id)
            .eq('supplier_email', supplierEmail)
            .single();

        if (fetchErr || !originalBoq) {
            return res.status(404).json({ error: 'BOQ not found or unauthorized' });
        }

        if (originalBoq.status !== 'Rejected') {
            return res.status(400).json({ error: 'Only rejected BOQs can be resubmitted' });
        }

        // Create new BOQ entry with "Resubmitted" marker
        const { error: insertErr, data: newBoq } = await supabase
            .from('boqs')
            .insert([{
                vendor_name: boqData.vendorName,
                document_number: boqData.invoiceNumber !== 'Not Found' ? boqData.invoiceNumber : `BOQ-${Date.now().toString().slice(-6)}`,
                total_amount: boqData.totalAmount,
                currency: boqData.currency,
                status: 'Pending Review - Resubmitted',
                line_items: boqData.lineItems,
                supplier_email: supplierEmail,
                vendor_id: originalBoq.vendor_id,
                replaces_boq_id: id // Track original BOQ
            }])
            .select();

        if (insertErr) throw insertErr;

        // Mark original as superseded
        await supabase.from('boqs')
            .update({ status: 'Superseded by Resubmission' })
            .eq('id', id);

        console.log(`✅ BOQ resubmitted successfully. New BOQ ID: ${newBoq[0]?.id}`);

        // Notify procurement team
        await supabase.from('notifications').insert([{
            user_email: 'procurement@nestle.com', // Adjust to actual procurement team
            user_role: 'Procurement',
            title: 'BOQ Resubmitted',
            message: `${boqData.vendorName} has resubmitted their quote (Originally rejected). New BOQ: ${newBoq[0]?.document_number}`,
            link: `/boqs?filter=resubmitted`,
            is_read: false
        }]).catch(err => logError('BOQ Resubmit Notification', err));

        res.json({ success: true, newBoqId: newBoq[0]?.id, message: 'BOQ resubmitted successfully' });
    } catch (error) {
        logError('Resubmit BOQ', error, { boqId: id });
        res.status(500).json({ error: 'Failed to resubmit BOQ' });
    }
});

// When Invoice/PO is rejected, supplier can resubmit
app.post('/api/reconciliations/:id/resubmit', async (req, res) => {
    const { id } = req.params;
    const { invoiceData, poData, supplierEmail } = req.body;
    try {
        console.log(`🔄 Resubmitting Invoice for reconciliation ${id} from ${supplierEmail}`);

        // Fetch original reconciliation
        const { data: originalRecon, error: fetchErr } = await supabase
            .from('reconciliations')
            .select('*')
            .eq('id', id)
            .eq('supplier_email', supplierEmail)
            .single();

        if (fetchErr || !originalRecon) {
            return res.status(404).json({ error: 'Reconciliation record not found or unauthorized' });
        }

        if (originalRecon.match_status !== 'Rejected') {
            return res.status(400).json({ error: 'Only rejected reconciliations can be resubmitted' });
        }

        // Create new reconciliation entry with resubmission marker
        const { error: insertErr, data: newRecon } = await supabase
            .from('reconciliations')
            .insert([{
                vendor_name: invoiceData.vendorName,
                invoice_number: invoiceData.invoiceNumber,
                po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
                invoice_total: invoiceData.totalAmount,
                po_total: poData.totalAmount,
                match_status: 'Pending Resubmission',
                timeline_status: '⏳ Awaiting Finance Review (Resubmitted)',
                supplier_email: supplierEmail,
                invoice_data: invoiceData,
                po_data: poData,
                replaces_reconciliation_id: id, // Track original rejection
                processed_at: new Date().toISOString()
            }])
            .select();

        if (insertErr) throw insertErr;

        // Mark original as superseded
        await supabase.from('reconciliations')
            .update({ match_status: 'Superseded - Resubmitted by Supplier' })
            .eq('id', id);

        console.log(`✅ Invoice resubmitted successfully. New reconciliation ID: ${newRecon[0]?.id}`);

        // Notify finance team
        await supabase.from('notifications').insert([{
            user_email: 'finance@nestle.com', // Adjust to actual finance team
            user_role: 'Finance',
            title: 'Invoice Resubmitted',
            message: `${invoiceData.vendorName} has resubmitted their invoice (Previously rejected). New Invoice: ${newRecon[0]?.invoice_number}`,
            link: `/finance?filter=pending-resubmission`,
            is_read: false
        }]).catch(err => logError('Invoice Resubmit Notification', err));

        res.json({ success: true, newReconId: newRecon[0]?.id, message: 'Invoice resubmitted successfully' });
    } catch (error) {
        logError('Resubmit Reconciliation', error, { reconId: id });
        res.status(500).json({ error: 'Failed to resubmit invoice' });
    }
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logError('UNCAUGHT EXCEPTION', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logError('UNHANDLED REJECTION', reason, { promise: String(promise) });
});

if (require.main === module) {
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Nestle Finance ERP Backend LIVE on port ${port}`);
        console.log(`📧 Email provider: ${process.env.RESEND_API_KEY ? 'Resend configured' : 'NOT CONFIGURED'}`);
        console.log(`🧠 Mindee API: ${process.env.MINDEE_V2_API_KEY ? 'Configured' : 'MISSING'}`);
    });
}

module.exports = app;
