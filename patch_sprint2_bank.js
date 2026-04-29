const fs = require('fs');
let file = fs.readFileSync('backend/routes/sprint2.js', 'utf8');

// Require bankMock at the top
if (!file.includes('bankMock')) {
    file = file.replace("const express = require('express');", "const express = require('express');\nconst { simulateBankTransfer } = require('../utils/bankMock');");
}

// Add routes
const stageRoute = `
router.post('/payouts/stage', async (req, res) => {
  const { invoice_ref, supplier_email, total_amount } = req.body;
  try {
      // Calculate Net-30 Date
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 30);

      const payload = {
        invoice_ref,
        supplier_email,
        title: \`Payout: \${supplier_email}\`,
        start_date: scheduledDate,
        end_date: scheduledDate,
        base_amount: total_amount,
        final_amount: total_amount,
        status: 'Scheduled'
      };

      const { data, error } = await supabase.from('payout_schedules').insert(payload);
      if (error) throw error;
      
      // Trigger In-App Notification
      await supabase.from('notifications').insert({
        user_email: supplier_email,
        user_role: 'supplier',
        title: 'Payout Scheduled 🗓️',
        message: \`Your payout of $\${total_amount} has been added to the calendar.\`,
        link: '/payouts'
      });

      res.status(200).json({ success: true, data });
  } catch (error) {
      console.error('Stage Error:', error);
      res.status(500).json({ error: 'Failed to stage payout' });
  }
});

router.post('/payouts/:id/disburse', async (req, res) => {
  const { id } = req.params;
  const { supplier_email, final_amount, mock_supplier_account } = req.body;

  try {
      // 1. Call the Mock Bank
      const bankResult = await simulateBankTransfer(mock_supplier_account, final_amount);

      // 2. Log it in the Mock Ledger
      await supabase.from('bank_transactions').insert({
        payout_ref: id,
        supplier_account_number: mock_supplier_account,
        amount: final_amount
      });

      // 3. Update Payout Status to 'Paid'
      await supabase.from('payout_schedules')
        .update({ status: 'Paid', bank_transaction_ref: bankResult.transactionId })
        .eq('id', id);

      // 4. Send Omnichannel Alerts
      await supabase.from('notifications').insert({
        user_email: supplier_email,
        user_role: 'supplier',
        title: 'Funds Disbursed 💰',
        message: \`Payment of $\${final_amount} has been wired to your account.\`,
        link: '/payouts'
      });

      await sendSupplierEmail(
        supplier_email,
        'Payment Remittance Advice',
        \`<p>Nestlé has successfully transferred $\${final_amount} to account ending in \${mock_supplier_account.slice(-4)}.</p><p>Transaction Ref: \${bankResult.transactionId}.</p>\`
      );

      res.status(200).json(bankResult);
  } catch (error) {
      console.error('Disburse Error:', error);
      res.status(500).json({ error: 'Failed to disburse' });
  }
});

router.patch('/payouts/:id/hold', async (req, res) => {
  const { id } = req.params;
  const { hold_until_date } = req.body;
  try {
      const { data, error } = await supabase
        .from('payout_schedules')
        .update({ status: 'Hold', hold_until_date })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      res.status(200).json({ success: true, data });
  } catch (error) {
      console.error('Hold Error:', error);
      res.status(500).json({ error: 'Failed to put on hold' });
  }
});
`;

if (!file.includes('/payouts/stage')) {
    file = file.replace(/module\.exports = router;/, `${stageRoute}\nmodule.exports = router;`);
}

fs.writeFileSync('backend/routes/sprint2.js', file);
