const fs = require('fs');
let file = fs.readFileSync('backend/routes/sprint2.js', 'utf8');

// 1. Add pdfkit requirement
file = file.replace(
    "const { sendSupplierEmail } = require('../mailer');",
    "const { sendSupplierEmail } = require('../mailer');\nconst PDFDocument = require('pdfkit');"
);

// 2. Change proofUrl
file = file.replace(
    "const proofUrl = 'https://nestlefinancecommand.com/mock-promise-to-pay.pdf'; // mocked for MVP",
    "const proofUrl = `https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${id}/promise-to-pay.pdf`;"
);

// 3. Add GET endpoint for PDF
const getRoute = `
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
        res.setHeader('Content-Disposition', \`inline; filename="Promise-to-Pay-\${data.id}.pdf"\`);
        
        doc.pipe(res);

        // Styling
        doc.fontSize(24).font('Helvetica-Bold').text('Nestlé', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Global Procurement Center', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(20).text('Promise to Pay', { underline: true });
        doc.moveDown(1);

        doc.fontSize(12).text(\`Date Issued: \${new Date().toLocaleDateString()}\`);
        doc.text(\`Reference ID: \${data.id}\`);
        doc.text(\`Supplier Email: \${data.supplier_email}\`);
        doc.moveDown(2);

        doc.fontSize(14).text('Dear Valued Supplier,');
        doc.moveDown();
        doc.fontSize(12).text('This document serves as formal confirmation that your invoice has been successfully processed, validated, and approved for payment following our 3-way matching protocol.');
        doc.moveDown(1);

        doc.text(\`Total Approved Amount: $\${data.final_amount || data.base_amount}\`, { font: 'Helvetica-Bold' });
        doc.text(\`Scheduled Payout Date: \${new Date(data.start_date).toLocaleDateString()}\`, { font: 'Helvetica-Bold' });
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
`;

file = file.replace(
    /router\.patch\('\/payouts\/:id\/confirm',/,
    `${getRoute}\nrouter.patch('/payouts/:id/confirm',`
);

fs.writeFileSync('backend/routes/sprint2.js', file);
