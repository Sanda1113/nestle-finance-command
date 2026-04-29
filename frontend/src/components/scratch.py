import re

path = r'c:\Users\sanda\nestle-finance-command\frontend\src\components\Portal.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'DigitalCalendar' not in content:
    content = content.replace("import FloatingChat from './FloatingChat';", "import FloatingChat from './FloatingChat';\nimport DigitalCalendar from './DigitalCalendar';")

# Replace block
pattern = r'<div className="grid grid-cols-2 md:grid-cols-7 gap-3">[\s\S]*?</div>\s*</div>\s*</div>'
replacement = """<DigitalCalendar 
                            payouts={upcoming} 
                            userRole="Finance" 
                            onUpdatePayout={fetchPayouts}
                            loading={loading}
                        />
                    </div>"""
content = re.sub(pattern, replacement, content)

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("done")
