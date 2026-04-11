// backend/mailer.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a professional email HTML template with Nestlé branding
 */
const buildEmailHtml = (title, body, refs = {}) => {
    const refSection = refs.poNumber || refs.invoiceNumber ? `
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b;">📋 Transaction Reference</h3>
            ${refs.poNumber ? `<p style="margin: 5px 0;"><strong>PO Number:</strong> ${refs.poNumber}</p>` : ''}
            ${refs.invoiceNumber ? `<p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${refs.invoiceNumber}</p>` : ''}
            ${refs.amount ? `<p style="margin: 5px 0;"><strong>Amount:</strong> ${refs.currency || 'USD'} ${refs.amount}</p>` : ''}
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
                .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: #0f172a; padding: 25px; text-align: center; }
                .header img { max-width: 80px; margin-bottom: 10px; }
                .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
                .header p { color: #94a3b8; margin: 5px 0 0; font-size: 14px; }
                .content { padding: 30px; }
                .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }
                .note { background: #fef9c3; padding: 15px; border-radius: 8px; font-size: 13px; border-left: 4px solid #eab308; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://nestlefinancecommand.com/nestle-logo.svg" alt="Nestlé" style="max-width: 80px;" />
                    <h1>Nestlé Finance Command</h1>
                    <p>Global Procurement & Supply Chain</p>
                </div>
                <div class="content">
                    <h2 style="color: #0f172a; margin-top: 0;">${title}</h2>
                    ${body}
                    ${refSection}
                    <p style="margin-top: 25px;">You can view full details and documents by logging into your Supplier Dashboard.</p>
                    <a href="https://nestlefinancecommand.com" class="button">Go to Supplier Portal →</a>
                    <div class="note">
                        <strong>ℹ️ Note:</strong> This is an automated notification from the Nestlé Finance Command Center. Please do not reply directly to this email. For any queries, use the chat feature in your portal.
                    </div>
                </div>
                <div class="footer">
                    <p>© 2026 Nestlé Finance Command. All rights reserved.</p>
                    <p>123 Corporate Blvd, Colombo, Sri Lanka</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const sendSupplierEmail = async (toEmail, subject, htmlBody, refs = {}) => {
    if (!toEmail) {
        console.warn('⚠️ No recipient email provided');
        return false;
    }

    try {
        const fullHtml = buildEmailHtml(subject, htmlBody, refs);
        const { data, error } = await resend.emails.send({
            from: 'Nestlé Finance Command <notifications@nestlefinancecommand.com>',
            to: [toEmail],
            subject: `Nestlé Portal: ${subject}`,
            html: fullHtml
        });

        if (error) {
            console.error(`❌ Resend error for ${toEmail}:`, error);
            return false;
        }

        console.log(`✅ Email sent to ${toEmail} via Resend (ID: ${data.id})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${toEmail}:`, error.message);
        return false;
    }
};

module.exports = { sendSupplierEmail };