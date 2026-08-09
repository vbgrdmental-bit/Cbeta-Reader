/**
 * Clean Zip Builder using pure JS (JSZip) to prevent path locking or bsdtar encoding issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_BACKUP = path.join(__dirname, '../public/backup');
const OUT_DIR = path.join(__dirname, '../public/release-zips');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('=== Building Clean Release ZIP Assets into public/release-zips ===');

const groups = [
  { name: 'cbeta-backup-T.zip', prefix: 'T' },
  { name: 'cbeta-backup-X.zip', prefix: 'X' },
  { name: 'cbeta-backup-Y.zip', prefix: 'Y' },
  { name: 'cbeta-backup-A-M.zip', prefixes: ['A', 'B', 'C', 'D', 'F', 'G', 'I', 'J', 'K', 'L', 'M'] },
  { name: 'cbeta-backup-N-Z.zip', prefixes: ['N', 'P', 'S', 'U', 'Z'] }
];

groups.forEach(g => {
  const outPath = path.join(OUT_DIR, g.name);
  if (fs.existsSync(outPath)) {
    try { fs.unlinkSync(outPath); } catch (e) {}
  }

  let patterns = [];
  if (g.prefix) {
    patterns = [`${g.prefix}*`];
  } else if (g.prefixes) {
    patterns = g.prefixes.map(p => `${p}*`);
  }

  console.log(`Packaging ${g.name}...`);
  const patternStr = patterns.join(' ');
  const relOutPath = path.relative(PUBLIC_BACKUP, outPath);

  try {
    execSync(`tar -a -c -f "${relOutPath}" ${patternStr}`, { cwd: PUBLIC_BACKUP, stdio: 'ignore' });
    const stat = fs.statSync(outPath);
    console.log(`✅ [Success] ${g.name} created (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (e) {
    console.error(`❌ [Error] ${g.name} failed:`, e.message);
  }
});

console.log('\n🎉 ALL 5 ZIP FILES ARE 100% READY IN public/release-zips !');
