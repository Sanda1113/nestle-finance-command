const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const supabase = require('../db');

jest.mock('../db', () => {
    const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: { po_data: {}, supplier_email: 'test@example.com' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ error: null }),
        not: jest.fn().mockReturnThis(),
        // catch is needed when production code chains .insert(...).catch(...) before awaiting
        catch: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };

    return {
        from: jest.fn().mockReturnValue(mockQuery),
    };
});

jest.mock('../mailer', () => ({
    sendSupplierEmail: jest.fn().mockResolvedValue(true),
}));

describe('Nestle Finance API', () => {
    const createQueryMock = (result) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: { po_data: {}, supplier_email: 'test@example.com' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ error: null }),
        not: jest.fn().mockReturnThis(),
        catch: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(result)),
    });

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

    test('GET /api/boqs with supplier email returns success', async () => {
        const res = await request(app).get('/api/boqs?email=test%40example.com');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/reconciliations returns success', async () => {
        const res = await request(app).get('/api/reconciliations');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('GET /api/reconciliations with supplier email returns success', async () => {
        const res = await request(app).get('/api/reconciliations?email=test%40example.com');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    test('GET /api/supplier/pos/:email returns success', async () => {
        const res = await request(app).get('/api/supplier/pos/test%40example.com');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/supplier/pos/:email falls back when optional columns are missing', async () => {
        supabase.from
            .mockReturnValueOnce(createQueryMock({
                data: null,
                error: {
                    code: 'PGRST204',
                    message: "Could not find the 'updated_at' column of 'purchase_orders' in the schema cache",
                },
            }))
            .mockReturnValueOnce(createQueryMock({
                data: [{
                    id: 12,
                    po_number: 'PO-12',
                    total_amount: 1500,
                    status: 'Generated',
                    created_at: '2026-01-10T10:00:00.000Z',
                    supplier_email: 'test@example.com'
                }],
                error: null
            }));

        const res = await request(app).get('/api/supplier/pos/test%40example.com');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data[0]).toMatchObject({
            id: 12,
            po_number: 'PO-12',
            is_downloaded: false
        });
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

    test('POST /api/auth/register normalizes email/role before insert', async () => {
        const registerQueryMock = createQueryMock({ data: null, error: null });
        supabase.from.mockReturnValueOnce(registerQueryMock);

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: '  TEST.USER@Example.com ',
                password: 'Secret123!',
                role: ' Finance '
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(registerQueryMock.insert).toHaveBeenCalledWith([
            {
                email: 'test.user@example.com',
                password_hash: expect.any(String),
                role: 'finance'
            }
        ]);
    });

    test('POST /api/auth/login succeeds with trimmed/case-insensitive email and matching duplicate account password', async () => {
        const wrongPasswordHash = await bcrypt.hash('wrong-pass', 10);
        const validPasswordHash = await bcrypt.hash('CorrectPass!42', 10);

        supabase.from
            .mockReturnValueOnce(createQueryMock({ data: [], error: null }))
            .mockReturnValueOnce(createQueryMock({
                data: [
                    { id: 1, email: 'User@Example.com', role: 'supplier', password_hash: wrongPasswordHash },
                    { id: 2, email: 'user@example.com', role: 'supplier', password_hash: validPasswordHash }
                ],
                error: null
            }));

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: '  USER@example.com ',
                password: 'CorrectPass!42'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('user.email', 'user@example.com');
    });
});

// ==========================================
// 📧 Supplier email delivery – server.js update paths
// ==========================================
describe('Supplier email notifications on finance/procurement updates', () => {
    let sendSupplierEmail;
    beforeEach(() => {
        sendSupplierEmail = require('../mailer').sendSupplierEmail;
        sendSupplierEmail.mockClear();
    });

    test('POST /api/boqs/:id/reject sends rejection email to supplier', async () => {
        const res = await request(app)
            .post('/api/boqs/42/reject')
            .send({ reason: 'Price too high' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            'BOQ Rejected',
            expect.any(String),
            expect.any(Object)
        );
    });

    test('POST /api/boqs/:id/generate-po sends PO-generated email to supplier', async () => {
        const res = await request(app)
            .post('/api/boqs/42/generate-po')
            .send({});

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('Purchase Order Generated'),
            expect.any(String),
            expect.any(Object)
        );
    });

    test('POST /api/reconciliations/:id/notify sends status email to supplier', async () => {
        const res = await request(app)
            .post('/api/reconciliations/123/notify')
            .send({
                supplierEmail: 'supplier@test.com',
                newStatus: 'Approved',
                invoiceNumber: 'INV-001',
                poNumber: 'PO-001'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'supplier@test.com',
            expect.stringContaining('Approved'),
            expect.any(String),
            expect.objectContaining({ invoiceNumber: 'INV-001', poNumber: 'PO-001' })
        );
    });

    test('POST /api/reconciliations/:id/notify sends rejection email to supplier', async () => {
        const res = await request(app)
            .post('/api/reconciliations/456/notify')
            .send({
                supplierEmail: 'supplier@test.com',
                newStatus: 'Rejected',
                invoiceNumber: 'INV-002',
                poNumber: 'PO-002'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'supplier@test.com',
            expect.stringContaining('Rejected'),
            expect.any(String),
            expect.objectContaining({ invoiceNumber: 'INV-002', poNumber: 'PO-002' })
        );
    });

    test('PATCH /api/reconciliations/:id resolves supplier email and sends status email', async () => {
        const res = await request(app)
            .patch('/api/reconciliations/789')
            .send({ newStatus: 'Approved' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        // The mock single() returns supplier_email: 'test@example.com' – direct fallback path
        expect(sendSupplierEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.stringContaining('PO & Invoice'),
            expect.any(String),
            expect.any(Object)
        );
    });
});
