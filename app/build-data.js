// Generates data.js from ../vocab/vocab_final_merged.csv
const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync(path.join(__dirname, '..', 'vocab', 'vocab_final_merged.csv'), 'utf8');
const lines = csv.split(/\r?\n/).filter(l => l.trim());
const header = lines[0].split(',');

function parseLine(line) {
  // simple CSV parse with quote support
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const words = [];
for (let i = 1; i < lines.length; i++) {
  const f = parseLine(lines[i]);
  if (f.length < 4) { console.warn('skip line', i + 1, lines[i]); continue; }
  words.push({ id: i - 1, cn: f[0].trim(), py: f[1].trim(), en: f[2].trim(), th: f[3].trim() });
}

const out = 'const VOCAB = ' + JSON.stringify(words) + ';\n' +
  'if (typeof module !== "undefined") module.exports = VOCAB;\n';
fs.writeFileSync(path.join(__dirname, 'data.js'), out, 'utf8');
console.log('wrote data.js with', words.length, 'words');
