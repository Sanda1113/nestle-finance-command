const cron = require('node-cron');
const supabase = require('./db');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function runPayoutReminders() {
    console.log('⏳ Running daily payout reminder job...');
    try {
        const { data: payouts, error } = await supabase.from('payout_schedules').select('*').in('status', ['Scheduled', 'Pending Finance', 'Renegotiated']);
        if (error) throw error;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // --- MVP 7: Dynamic Discounting Proactive Email ---
        // If it's the 25th of the month, proactively email suppliers for early payout
        if (now.getDate() === 25) {
            console.log('🤖 MVP7: Proactive Early Payout AI trigger running...');
            for (const payout of payouts) {
                if (payout.status === 'Scheduled' && payout.status !== 'Renegotiated') {
                    const discountRate = 1.5;
                    console.log(`📧 MVP7: Sending proactive early payout offer to ${payout.supplier_email}`);
                    if (resend) {
                        await resend.emails.send({
                            from: 'Nestlé Treasury <finance@nestle-command.com>',
                            to: [payout.supplier_email],
                            subject: 'Unlock Cash Early: Pre-Approved Liquidity Offer',
                            html: `<p>We have pre-approved your $${(payout.final_amount || payout.base_amount)} invoice (${(payout.title || payout.id)}) for early payout at ${discountRate}%.</p><p>Click here to claim and get paid tomorrow.</p>`
                        }).catch(err => console.error('Failed to send early payout email', err));
                    }
                }
            }
        }

        // --- MVP 6: SLA Default Risk (Disputes) ---
        console.log('🚨 MVP6: Checking for SLA Default Risk on stuck disputes...');
        const { data: stuckRecons, error: reconError } = await supabase.from('reconciliations')
            .select('*')
            .ilike('match_status', '%Discrep%');
            
        if (!reconError && stuckRecons) {
            for (const recon of stuckRecons) {
                const createdDate = new Date(recon.created_at || recon.processed_at);
                createdDate.setHours(0, 0, 0, 0);
                const diffTime = now - createdDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Day 28 of Net-30
                if (diffDays === 28) {
                    console.log(`🚨 SLA Default Risk for Invoice ${recon.invoice_number}`);
                    const message = `SLA Default Risk: Payment due in 48 hours. Invoice ${recon.invoice_number} is still stuck in a dispute chat.`;
                    
                    await supabase.from('notifications').insert([{
                        user_email: 'finance@nestle.com',
                        user_role: 'Finance',
                        title: `SLA Default Risk (${recon.invoice_number})`,
                        message: message,
                        link: `/finance?filter=pending`,
                        is_read: false
                    }]);
                    
                    if (resend) {
                        await resend.emails.send({
                            from: 'Nestlé Command <system@nestle-command.com>',
                            to: ['finance@nestle.com'],
                            subject: `URGENT: SLA Default Risk - Invoice ${recon.invoice_number}`,
                            html: `<p><strong>${message}</strong></p><p>Please resolve this immediately in the Review Queue.</p>`
                        }).catch(err => console.error('Failed to send SLA email', err));
                    }
                }
            }
        }


        for (const payout of payouts) {
            const dueDate = new Date(payout.start_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let alertType = null;
            if (diffDays === 3) alertType = 'T-3';
            else if (diffDays === 1) alertType = 'T-1';
            else if (diffDays < 0) alertType = 'Overdue';

            if (alertType) {
                console.log(`🔔 Sending ${alertType} reminder for Invoice ${(payout.title || payout.id)}`);
                const message = alertType === 'Overdue' 
                    ? `⚠️ OVERDUE: Payment for invoice ${(payout.title || payout.id)} was due on ${dueDate.toLocaleDateString()}. Please process immediately.`
                    : `⏰ REMINDER: Payment for invoice ${(payout.title || payout.id)} is due in ${diffDays} day(s) on ${dueDate.toLocaleDateString()}.`;

                // In-app Notification for Finance
                await supabase.from('notifications').insert([{
                    user_email: 'finance@nestle.com',
                    user_role: 'Finance',
                    title: `Payout Alert: ${alertType} (${(payout.title || payout.id)})`,
                    message: message,
                    link: `/finance?filter=payouts`,
                    is_read: false
                }]);

                // Email Notification
                if (resend) {
                    await resend.emails.send({
                        from: 'Nestlé Finance <finance@nestle-command.com>', // Usually a verified domain
                        to: ['finance@nestle.com'],
                        subject: `Payout Alert: ${alertType} - Invoice ${(payout.title || payout.id)}`,
                        html: `<p>${message}</p><p>Vendor: ${payout.vendor_name || payout.supplier_email}</p><p>Amount: $${payout.early_payment_amount || (payout.final_amount || payout.base_amount)}</p>`
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
