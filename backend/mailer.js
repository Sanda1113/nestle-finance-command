const nodemailer = require('nodemailer');

// 📧 Configure your Email Service
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use Outlook, Office365, AWS SES, etc.
    auth: {
        user: 'your-company-email@gmail.com', // Replace with your email
        pass: 'your-app-password-here'        // Use an App Password, NOT your real password
    }
});

const sendSupplierEmail = async (toEmail, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: '"Nestle Finance Command" <no-reply@nestle.com>',
            to: toEmail,
            subject: `Nestle Portal: ${subject}`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent to supplier:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
};

module.exports = { sendSupplierEmail };