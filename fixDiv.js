const fs = require('fs');
const filepath = 'frontend/src/components/Portal.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const target = `        </div>
        </div>
    );
}`;

const replacement = `        </div>
    );
}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed syntax error in Portal.jsx');
} else {
    // try removing any carriage returns from the target string and search using regex
    let lines = content.split('\n');
    let targetIndex = -1;
    for(let i=0; i<lines.length-3; i++) {
        if(lines[i].includes('        </div>') && lines[i+1].includes('        </div>') && lines[i+2].includes('    );') && lines[i+3].includes('}')) {
            targetIndex = i+1;
            break;
        }
    }
    
    if (targetIndex !== -1) {
        lines.splice(targetIndex, 1);
        fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
        console.log('Fixed syntax error in Portal.jsx (fallback method)');
    } else {
        console.log('Could not find the extra div tag');
    }
}
