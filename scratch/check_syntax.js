const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('src/navigation/AppNavigation.js', 'utf8');

try {
    parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'flow']
    });
    console.log('No syntax errors found');
} catch (e) {
    console.error('Syntax Error at line', e.loc.line, 'column', e.loc.column);
    console.error(e.message);
    const lines = code.split('\n');
    const start = Math.max(0, e.loc.line - 5);
    const end = Math.min(lines.length, e.loc.line + 5);
    for (let i = start; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
