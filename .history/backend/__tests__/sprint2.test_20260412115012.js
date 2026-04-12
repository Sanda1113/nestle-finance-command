const request = require('supertest');
const app = require('../server');

// Mock Supabase
jest.mock('../db', () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockResolvedValue({ error: null }),
}));

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

    test('POST /api/sprint2/supplier/mark-delivered with missing poNumber fails', async () => {
        const res = await request(app)
            .post('/api/sprint2/supplier/mark-delivered')
            .send({});
        expect(res.statusCode).toBe(500);
    });
});