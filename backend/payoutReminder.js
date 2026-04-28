const cron = require('node-cron');
const supabase = require('./db');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function runPayoutReminders() {
    console.log('⏳ Running daily payout reminder job...');
    try {
        const { data: payouts, error } = await supabase.from('payout_schedule').select('*').in('status', ['Scheduled', 'Early Payment Requested']);
        if (error) throw error;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (const payout of payouts) {
            const dueDate = new Date(payout.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let alertType = null;
            if (diffDays === 3) alertType = 'T-3';
            else if (diffDays === 1) alertType = 'T-1';
            else if (diffDays < 0) alertType = 'Overdue';

            if (alertType) {
                console.log(`🔔 Sending ${alertType} reminder for Invoice ${payout.invoice_number}`);
                const message = alertType === 'Overdue' 
                    ? `⚠️ OVERDUE: Payment for invoice ${payout.invoice_number} was due on ${dueDate.toLocaleDateString()}. Please process immediately.`
                    : `⏰ REMINDER: Payment for invoice ${payout.invoice_number} is due in ${diffDays} day(s) on ${dueDate.toLocaleDateString()}.`;

                // In-app Notification for Finance
                await supabase.from('notifications').insert([{
                    user_email: 'finance@nestle.com',
                    user_role: 'Finance',
                    title: `Payout Alert: ${alertType} (${payout.invoice_number})`,
                    message: message,
                    link: `/finance?filter=payouts`,
                    is_read: false
                }]);

                // Email Notification
                if (resend) {
                    await resend.emails.send({
                        from: 'Nestlé Finance <finance@nestle-command.com>', // Usually a verified domain
                        to: ['finance@nestle.com'],
                        subject: `Payout Alert: ${alertType} - Invoice ${payout.invoice_number}`,
                        html: `<p>${message}</p><p>Vendor: ${payout.vendor_name || payout.supplier_email}</p><p>Amount: $${payout.early_payment_amount || payout.payout_amount}</p>`
                    }).catch(err => console.error('Failed to send reminder email', err));
                }
            }
        }
        console.log('✅ Daily payout reminder job completed.');
    } catch (err) {
        console.error('❌ Failed to run payout reminder job', err);
    }
}

// Run every day at 8:00 AM
cron.schedule('0 8 * * *', runPayoutReminders);

module.exports = { runPayoutReminders };
