const request = require('supertest');
const app = require('../server');

// Mock Supabase with proper method chaining
jest.mock('../db', () => {
    const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: { po_data: {}, supplier_email: 'test@example.com' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ error: null }),
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
});
