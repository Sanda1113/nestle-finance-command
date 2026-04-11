// backend/mailer.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendSupplierEmail = async (toEmail, subject, htmlContent) => {
    if (!toEmail) {
        console.warn('⚠️ No recipient email provided');
        return false;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Nestlé Finance Command <notifications@nestlefinancecommand.com>', // ✅ Updated
            to: [toEmail],
            subject: `Nestlé Portal: ${subject}`,
            html: htmlContent
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