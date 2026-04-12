const request = require('supertest');
const app = require('../server'); // Ensure server.js exports app

describe('API Endpoints', () => {
    test('GET / should return online message', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Nestle Finance Enterprise API is Online');
    });

    test('GET /api/boqs returns array', async () => {
        const res = await request(app).get('/api/boqs');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('POST /api/extract-invoice with no file returns 400', async () => {
        const res = await request(app).post('/api/extract-invoice');
        expect(res.statusCode).toBe(400);
    });
});