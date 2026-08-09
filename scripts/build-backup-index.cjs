/**
 * Generate full CBETA Backup Works Metadata Index for 100% pure Backup Mode search
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../public/backup');
const OUT_FILE = path.join(__dirname, '../public/cbeta-works-index.json');
const OUT_FILE_ALT = path.join(__dirname, '../public/backup/works-index.json');

console.log('=== Building 100% Backup Works Metadata Index ===');

if (!fs.existsSync(BACKUP_DIR)) {
  console.error(`Error: ${BACKUP_DIR} not found.`);
  process.exit(1);
}

const workDirs = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`Scanning ${workDirs.length} work directories...`);

const worksIndex = [];

workDirs.forEach(wId => {
  const juan1File = path.join(BACKUP_DIR, wId, '1.json');
  if (fs.existsSync(juan1File)) {
    try {
      const data = JSON.parse(fs.readFileSync(juan1File, 'utf8'));
      const meta = data.metadata || {};
      
      // 找出最大卷數
      const files = fs.readdirSync(path.join(BACKUP_DIR, wId)).filter(f => f.endsWith('.json') && f !== 'works-index.json' && f !== 'manifest.json');
      const juansCount = meta.juansCount || files.length || 1;

      worksIndex.push({
        workId: wId,
        title: meta.title || data.title || wId,
        creators: meta.creators || data.creators || 'CBETA 大藏經',
        juansCount: juansCount,
        category: meta.category || data.category || 'CBETA 部類',
        vol: meta.vol || data.vol || wId.slice(0, 3)
      });
    } catch (e) {}
  }
});

console.log(`Successfully compiled metadata for ${worksIndex.length} works.`);

const payload = {
  version: 'CBReader 2X v0.9.9 (2026-01-21)',
  updatedAt: new Date().toISOString(),
  totalWorks: worksIndex.length,
  works: worksIndex
};

const jsonStr = JSON.stringify(payload);
fs.writeFileSync(OUT_FILE, jsonStr, 'utf8');
fs.writeFileSync(OUT_FILE_ALT, jsonStr, 'utf8');

console.log(`✅ [Success] Generated cbeta-works-index.json (${(jsonStr.length / (1024 * 1024)).toFixed(2)} MB)`);
