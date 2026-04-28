const fs = require('fs');

let content = fs.readFileSync('backend/server.js', 'utf8');

const target = `            if (delta < 1.00 && Math.abs(invTax - poTax) > 0) {
                classification = 'tax rounding error';
                willAutoApprove = true;
                ruleName = 'Global Tax Rounding';
            } else if (delta < 0.10) {
                classification = 'currency decimal mismatch';
                willAutoApprove = true;
                ruleName = 'Currency Decimal Tolerance';
            } else if (percentageDelta <= 0.005) {
                classification = 'minor price variance';
                willAutoApprove = true;
                ruleName = 'Minor Price Variance <0.5%';
            } else if (invQty < poQty) {
                classification = 'missing line item';
            } else if (percentageDelta > 0.005) {
                classification = 'significant price mismatch';
            } else {
                classification = 'unknown variance';
            }`;

const replacement = `            // Fetch tolerance rules
            const { data: rules } = await supabase.from('tolerance_rules').select('*').eq('is_active', true);
            let taxRule = rules?.find(r => r.rule_type === 'tax_rounding') || { max_delta_amount: 1.00 };
            let currencyRule = rules?.find(r => r.rule_type === 'currency_decimal') || { max_delta_amount: 0.10 };
            let priceRule = rules?.find(r => r.rule_type === 'minor_variance') || { max_delta_percentage: 0.005 };

            if (delta < taxRule.max_delta_amount && Math.abs(invTax - poTax) > 0) {
                classification = 'tax rounding error';
                willAutoApprove = true;
                ruleName = 'Global Tax Rounding';
            } else if (delta < currencyRule.max_delta_amount) {
                classification = 'currency decimal mismatch';
                willAutoApprove = true;
                ruleName = 'Currency Decimal Tolerance';
            } else if (percentageDelta <= priceRule.max_delta_percentage) {
                classification = 'minor price variance';
                willAutoApprove = true;
                ruleName = 'Minor Price Variance';
            } else if (invQty < poQty) {
                classification = 'missing line item';
            } else if (percentageDelta > priceRule.max_delta_percentage) {
                classification = 'significant price mismatch';
            } else {
                classification = 'unknown variance';
            }`;

if(content.includes('if (delta < 1.00 && Math.abs(invTax - poTax) > 0) {')) {
    content = content.replace(target, replacement);
    fs.writeFileSync('backend/server.js', content, 'utf8');
    console.log('Patched server.js for configurable tolerance rules');
} else {
    console.log('Target not found in server.js');
}
