const request = require('supertest');
const app = require('../server');

// Mock external services that are called during tests
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

describe('Nestle Finance API', () => {
    test('GET / returns online status', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Nestle Finance Enterprise API is Online');
    });

    test('GET /api/boqs returns success and data array', async () => {
        const res = await request(app).get('/api/boqs');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/reconciliations returns success', async () => {
        const res = await request(app).get('/api/reconciliations');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('POST /api/extract-invoice without file returns 400', async () => {
        const res = await request(app).post('/api/extract-invoice');
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/save-boq with invalid data returns 500', async () => {
        const res = await request(app)
            .post('/api/save-boq')
            .send({ boqData: null });
        expect(res.statusCode).toBe(500);
    });
});