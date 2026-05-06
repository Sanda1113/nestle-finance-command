const request = require('supertest');
const app = require('../server');

// Mock Supabase with proper method chaining
jest.mock('../db', () => {
    const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { po_data: {}, supplier_email: 'test@example.com' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };

    return {
        from: jest.fn().mockReturnValue(mockQuery),
    };
});

jest.mock('../mailer', () => ({
    sendSupplierEmail: jest.fn().mockResolvedValue(true),
}));

describe('Sprint2 Routes', () => {
    test('GET /api/sprint2/notifications requires email or role', async () => {
        const res = await request(app).get('/api/sprint2/notifications');
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error', 'Missing email or role parameter');
    });

    test('GET /api/sprint2/notifications?role=Warehouse works', async () => {
        const res = await request(app).get('/api/sprint2/notifications?role=Warehouse');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('POST /api/sprint2/supplier/mark-delivered with valid poNumber succeeds', async () => {
        const res = await request(app)
            .post('/api/sprint2/supplier/mark-delivered')
            .send({ poNumber: 'PO-12345' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('GET /api/sprint2/grn/pending-pos supports warehouse scope and only strips GRN photos when requested', async () => {
        jest.clearAllMocks();
        const supabase = require('../db');
        const mockQuery = supabase.from();
        mockQuery.then.mockImplementationOnce((resolve) => resolve({
            data: [{
                id: 1,
                po_number: 'PO-12345',
                supplier_email: 'supplier@test.com',
                status: 'Delivered to Dock',
                po_data: {
                    lineItems: [{ description: 'Milk Powder', qty: 10 }],
                    warehouse_rejection: {
                        shortageEvidence: [{ description: 'Milk Powder', photoDataUrl: 'data:image/jpeg;base64,abc' }]
                    },
                    warehouse_grn: {
                        shortageEvidence: [{ description: 'Milk Powder', photoDataUrl: 'data:image/jpeg;base64,def' }]
                    }
                }
            }],
            error: null
        }));

        const res = await request(app).get('/api/sprint2/grn/pending-pos?scope=warehouse&includePhotos=false');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(mockQuery.in).toHaveBeenCalledWith('status', expect.arrayContaining([
            'PO Generated',
            'In Transit',
            'Delivered to Dock',
            'Pending Warehouse GRN',
            'Truck at Bay - Pending Unload'
        ]));
        expect(mockQuery.limit).toHaveBeenCalledWith(500);
        expect(res.body.data[0].po_data.warehouse_rejection.shortageEvidence[0].photoDataUrl).toBe('data:image/jpeg;base64,abc');
        expect(res.body.data[0].po_data.warehouse_grn.shortageEvidence[0].photoDataUrl).toBe('');
    });

    test('GET /api/sprint2/grn/pending-pos uses lean selection for non-warehouse scope', async () => {
        jest.clearAllMocks();
        const supabase = require('../db');
        const mockQuery = supabase.from();

        const res = await request(app).get('/api/sprint2/grn/pending-pos?includePhotos=false');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(mockQuery.select).toHaveBeenCalledWith('id, po_number, supplier_email, status, created_at, total_amount');
        expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    test('GET /api/sprint2/grn/pending-pos defaults includePhotos to false when not provided', async () => {
        jest.clearAllMocks();
        const supabase = require('../db');
        const mockQuery = supabase.from();

        const res = await request(app).get('/api/sprint2/grn/pending-pos');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(mockQuery.select).toHaveBeenCalledWith('id, po_number, supplier_email, status, created_at, total_amount');
        expect(mockQuery.limit).toHaveBeenCalledWith(500);
    });

    test('GET /api/sprint2/grn/pending-pos includes po_data when includePhotos=true for finance review evidence', async () => {
        jest.clearAllMocks();
        const supabase = require('../db');
        const mockQuery = supabase.from();
        mockQuery.then.mockImplementationOnce((resolve) => resolve({
            data: [{
                id: 1,
                po_number: 'PO-98765',
                supplier_email: 'supplier@test.com',
                status: 'Transaction Cancelled (Shortage)',
                po_data: {
                    warehouse_rejection: {
                        shortageEvidence: [{ description: 'Milk Powder', photoDataUrl: 'data:image/jpeg;base64,abc' }]
                    }
                }
            }],
            error: null
        }));

        const res = await request(app).get('/api/sprint2/grn/pending-pos?includePhotos=true');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(mockQuery.select).toHaveBeenCalledWith('id, po_number, supplier_email, status, created_at, po_data, total_amount');
        expect(mockQuery.limit).toHaveBeenCalledWith(120);
        expect(res.body.data[0].po_data.warehouse_rejection.shortageEvidence[0].photoDataUrl).toBe('data:image/jpeg;base64,abc');
    });

    test('POST /api/sprint2/grn/reject rejects shortage shipment and cancels transaction', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/reject')
            .send({
                poNumber: 'PO-12345',
                rejectedBy: 'warehouse@test.com',
                rejectionReason: 'Delivered quantity lower than expected',
                itemsReceived: [
                    { description: 'Milk Powder', qty: 10, actualQtyReceived: 7, status: 'Shortage' }
                ]
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('POST /api/sprint2/grn/reject returns 400 when no shortages are provided', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/reject')
            .send({
                poNumber: 'PO-12345',
                rejectedBy: 'warehouse@test.com',
                itemsReceived: [
                    { description: 'Milk Powder', qty: 10, actualQtyReceived: 10, status: 'Full Match' }
                ]
            });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error', 'Shipment can only be rejected when shortages are present');
    });

    test('POST /api/sprint2/grn/reject still succeeds when reconciliation lookup fails', async () => {
        jest.clearAllMocks();
        const supabase = require('../db');
        const mockQuery = supabase.from();
        mockQuery.limit.mockResolvedValueOnce({ data: null, error: { message: 'reconciliation lookup failed' } });

        const res = await request(app)
            .post('/api/sprint2/grn/reject')
            .send({
                poNumber: 'PO-12345',
                rejectedBy: 'warehouse@test.com',
                rejectionReason: 'Delivered quantity lower than expected',
                itemsReceived: [
                    { description: 'Milk Powder', qty: 10, actualQtyReceived: 7, status: 'Shortage' }
                ]
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('POST /api/sprint2/grn/reject persists warehouse_rejection evidence into po_data', async () => {
        // Clear recorded mock calls so earlier tests do not pollute this assertion.
        // Mock implementations (mockReturnThis, mockResolvedValue, etc.) are preserved.
        jest.clearAllMocks();

        const res = await request(app)
            .post('/api/sprint2/grn/reject')
            .send({
                poNumber: 'PO-EVIDENCE',
                rejectedBy: 'warehouse@test.com',
                rejectionReason: 'Short delivery',
                itemsReceived: [
                    {
                        description: 'Milk Powder',
                        qty: 10,
                        actualQtyReceived: 7,
                        status: 'Shortage',
                        reasonCode: 'Missing from Truck',
                        photoFileName: 'shortage_evidence.jpg',
                        photoDataUrl: 'data:image/jpeg;base64,/9j/abc',
                        photoMimeType: 'image/jpeg'
                    }
                ]
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const supabase = require('../db');

        // All from() calls return the same shared mockQuery; get a reference via
        // the recorded results of the first call made during this test.
        const mockQuery = supabase.from.mock.results[0].value;

        // Locate the update() call that wrote po_data (the purchase_orders evidence update).
        const poUpdateCall = mockQuery.update.mock.calls.find(
            ([payload]) => payload && payload.po_data !== undefined
        );

        expect(poUpdateCall).toBeDefined();

        const updatePayload = poUpdateCall[0];
        expect(updatePayload.status).toBe('Transaction Cancelled (Shortage)');

        const warehouseRejection = updatePayload.po_data.warehouse_rejection;
        expect(warehouseRejection).toBeDefined();
        expect(warehouseRejection.rejectedBy).toBe('warehouse@test.com');
        expect(warehouseRejection.rejectionReason).toBe('Short delivery');
        // rejectedAt should be an ISO-8601 timestamp
        expect(warehouseRejection.rejectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        expect(Array.isArray(warehouseRejection.shortageEvidence)).toBe(true);
        expect(warehouseRejection.shortageEvidence).toHaveLength(1);

        const evidence = warehouseRejection.shortageEvidence[0];
        expect(evidence.description).toBe('Milk Powder');
        expect(evidence.expectedQty).toBe(10);
        expect(evidence.receivedQty).toBe(7);
        expect(evidence.shortageQty).toBe(3);
        expect(evidence.reasonCode).toBe('Missing from Truck');
        expect(evidence.hasPhoto).toBe(true);
        expect(evidence.photoFileName).toBe('shortage_evidence.jpg');
        expect(evidence.photoMimeType).toBe('image/jpeg');
        expect(evidence.photoDataUrl).toBe('data:image/jpeg;base64,/9j/abc');
    });

    test('POST /api/sprint2/livechat/send sends supplier email notifications', async () => {
        const { sendSupplierEmail } = require('../mailer');
        sendSupplierEmail.mockClear();

        const res = await request(app)
            .post('/api/sprint2/livechat/send')
            .send({
                channel: 'LIVECHAT-Finance-Supplier',
                senderEmail: 'finance@test.com',
                senderRole: 'Finance',
                recipientRole: 'Supplier',
                recipientEmail: 'supplier@test.com',
                message: 'Please check the shipment update.'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'supplier@test.com',
            expect.stringContaining('New Live Chat Message from Finance'),
            expect.any(String),
            expect.objectContaining({ poNumber: 'LIVECHAT-Finance-Supplier' })
        );
    });
});

// ===========================================
// 📧 Supplier email delivery – all update paths
// ===========================================
describe('Supplier email notifications on update events', () => {
    // Flush enough microtask ticks to let background tasks and nested async calls settle.
    // Intentionally awaits in a loop to drain the microtask queue incrementally so that
    // runBackgroundTask (Promise.resolve().then(task)) and its internal async steps all
    // complete before the test assertion runs.
    const flushAll = async () => {
        for (let i = 0; i < 30; i++) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }
    };

    let sendSupplierEmail;
    beforeEach(() => {
        sendSupplierEmail = require('../mailer').sendSupplierEmail;
        sendSupplierEmail.mockClear();
    });

    test('grn/acknowledge sends shipment-arrival email to supplier', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/acknowledge')
            .send({ poNumber: 'PO-12345', ackedBy: 'warehouse@test.com' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Background task runs asynchronously – flush the microtask queue
        await flushAll();

        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('Shipment Arrival Acknowledged'),
            expect.any(String),
            expect.objectContaining({ poNumber: 'PO-12345' })
        );
    });

    test('grn/submit sends goods-received email to supplier', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/submit')
            .send({
                poNumber: 'PO-12345',
                receivedBy: 'warehouse@test.com',
                itemsReceived: [
                    { description: 'Milk Powder', qty: 10, actualQtyReceived: 10, status: 'Full Match' }
                ],
                totalReceivedAmount: 5000,
                isPartial: false
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        await flushAll();

        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('Goods Received'),
            expect.any(String),
            expect.objectContaining({ poNumber: 'PO-12345' })
        );
    });

    test('grn/reject sends rejection email to supplier', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/reject')
            .send({
                poNumber: 'PO-12345',
                rejectedBy: 'warehouse@test.com',
                rejectionReason: 'Shortage of items',
                itemsReceived: [
                    { description: 'Milk Powder', qty: 10, actualQtyReceived: 7, status: 'Shortage' }
                ]
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        await flushAll();

        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('Shipment Rejected'),
            expect.any(String),
            expect.objectContaining({ poNumber: 'PO-12345' })
        );
    });

    test('grn/clear sends goods-cleared email to supplier', async () => {
        const res = await request(app)
            .post('/api/sprint2/grn/clear')
            .send({ poNumber: 'PO-12345', clearedBy: 'warehouse@test.com' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // grn/clear sends email synchronously within the request – no extra flush needed
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('Goods Cleared'),
            expect.any(String),
            expect.objectContaining({ poNumber: 'PO-12345' })
        );
    });

    test('disputes/send with Finance role sends message email to supplier', async () => {
        const res = await request(app)
            .post('/api/sprint2/disputes/send')
            .send({
                referenceNumber: 'PO-12345',
                senderEmail: 'finance@test.com',
                senderRole: 'Finance',
                message: 'Please review the invoice discrepancy.'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('PO-12345'),
            expect.any(String)
        );
    });

    test('disputes/send with Supplier role does NOT send external email', async () => {
        const res = await request(app)
            .post('/api/sprint2/disputes/send')
            .send({
                referenceNumber: 'PO-12345',
                senderEmail: 'supplier@test.com',
                senderRole: 'Supplier',
                message: 'I have a question about my invoice.'
            });

        expect(res.statusCode).toBe(200);
        expect(sendSupplierEmail).not.toHaveBeenCalled();
    });
});

afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});
