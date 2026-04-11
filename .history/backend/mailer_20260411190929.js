// backend/mailer.js
const nodemailer = require('nodemailer');

// 📧 Configure using environment variables
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,      // e.g., 'your-company@gmail.com'
        pass: process.env.EMAIL_PASS       // App Password (not your real password)
    }
});

const sendSupplierEmail = async (toEmail, subject, htmlContent) => {
    if (!toEmail) {
        console.warn('⚠️ No recipient email provided');
        return false;
    }

    try {
        const mailOptions = {
            from: `"Nestlé Finance Command" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Nestlé Portal: ${subject}`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${toEmail}:`, error.message);
        return false;
    }
};

module.exports = { sendSupplierEmail };