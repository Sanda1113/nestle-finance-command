const fs = require('fs');

const path = 'c:\\Users\\sanda\\nestle-finance-command\\frontend\\src\\components\\Portal.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('DigitalCalendar')) {
    content = content.replace("import FloatingChat from './FloatingChat';", "import FloatingChat from './FloatingChat';\nimport DigitalCalendar from './DigitalCalendar';");
}

const pattern = /<div className="grid grid-cols-2 md:grid-cols-7 gap-3">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const replacement = `<DigitalCalendar 
                            payouts={upcoming} 
                            userRole="Finance" 
                            onUpdatePayout={fetchPayouts}
                            loading={loading}
                        />
                    </div>`;

content = content.replace(pattern, replacement);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
