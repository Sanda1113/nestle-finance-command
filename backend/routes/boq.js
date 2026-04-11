// Inside the PO generation endpoint (e.g., /api/boqs/:id/generate-po)
const { sendSupplierEmail } = require('../mailer');

// ... after PO is successfully inserted ...

// Fetch supplier email from the BOQ record
const { data: boq } = await supabase
    .from('boqs')
    .select('supplier_email, vendor_name')
    .eq('id', id)
    .single();

if (boq?.supplier_email) {
    const emailHtml = `
        <h3>Purchase Order Generated</h3>
        <p>Dear ${boq.vendor_name},</p>
        <p>Your quote has been approved and a Purchase Order has been created.</p>
        <p><strong>PO Number:</strong> ${poNumber}</p>
        <p>Please log in to your Supplier Dashboard to view and download the PO.</p>
        <p>Thank you,<br>Nestlé Procurement Team</p>
    `;
    sendSupplierEmail(boq.supplier_email, `PO Generated – ${poNumber}`, emailHtml);
}