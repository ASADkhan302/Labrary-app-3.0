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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('src');

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace compound dark classes
  content = content.replace(/bg-white dark:bg-\[#0F172A\]/g, 'bg-[#0F172A]');
  content = content.replace(/bg-white dark:bg-\[#0B1220\]/g, 'bg-[#0B1220]');
  content = content.replace(/bg-white dark:bg-\[#020617\]/g, 'bg-[#020617]');
  content = content.replace(/bg-white dark:bg-\[#1E293B\]/g, 'bg-[#1E293B]');
  content = content.replace(/bg-white dark:bg-slate-800/g, 'bg-slate-800');
  content = content.replace(/bg-white dark:bg-slate-900/g, 'bg-slate-900');
  content = content.replace(/bg-white dark:bg-slate-950/g, 'bg-slate-950');

  // Replace text-slate-900 dark:text-white
  content = content.replace(/text-slate-900 dark:text-white/g, 'text-[#F1F5F9]');
  content = content.replace(/dark:text-white/g, 'dark:text-[#F1F5F9]');

  // Replace remaining standalone bg-white in screens (keep print untouched)
  if (!filePath.includes('PrintModal')) {
    content = content.replace(/\bbg-white\b/g, 'bg-[#0F172A]');
    content = content.replace(/\btext-white\b/g, 'text-[#F1F5F9]');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned: ${filePath}`);
  }
});

console.log('All files processed for zero heavy white states.');
