const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(file)) {
        results = results.concat(walk(full));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.html')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('src').concat(['index.html']);
const patterns = [
  { name: 'text-white', regex: /text-white/g },
  { name: 'text-slate-100-300', regex: /text-slate-[123]00/g },
  { name: 'text-[#E2E8F0]', regex: /text-\[#E2E8F0\]/gi },
  { name: 'text-[#F1F5F9]', regex: /text-\[#F1F5F9\]/gi },
  { name: 'text-[#CBD5E1]', regex: /text-\[#CBD5E1\]/gi },
  { name: 'bg-[#020617]', regex: /bg-\[#020617\]/gi },
  { name: 'bg-[#0B1220]', regex: /bg-\[#0B1220\]/gi },
  { name: 'bg-[#0F172A]', regex: /bg-\[#0F172A\]/gi },
  { name: 'bg-slate-900', regex: /bg-slate-900/g },
  { name: 'bg-slate-950', regex: /bg-slate-950/g }
];

const found = {};
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  patterns.forEach(p => {
    const matches = content.match(p.regex);
    if (matches) {
      if (!found[f]) found[f] = {};
      found[f][p.name] = matches.length;
    }
  });
});

console.log(JSON.stringify(found, null, 2));
