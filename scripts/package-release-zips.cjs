/**
 * GitHub Releases Packager for CBETA 1.77 GB Backup Database
 * 
 * Usage:
 *   node scripts/package-release-zips.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BACKUP_DIR = path.join(__dirname, '../public/backup');
const OUTPUT_DIR = path.join(__dirname, '../dist-release-assets');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDirSync(OUTPUT_DIR);

console.log('=== Packaging CBETA 1.77 GB Backup Database for GitHub Releases ===');
console.log(`Source: ${BACKUP_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);

if (!fs.existsSync(BACKUP_DIR)) {
  console.error(`Error: ${BACKUP_DIR} does not exist.`);
  process.exit(1);
}

const workDirs = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`Found ${workDirs.length} work directories.`);

// 建立分類清單 (例如 T, X, Y, B, A 等首字區分)
const groups = {};
workDirs.forEach(wId => {
  const prefix = wId.charAt(0).toUpperCase();
  if (!groups[prefix]) groups[prefix] = [];
  groups[prefix].push(wId);
});

console.log('\nCategory Groups Breakdown:');
Object.keys(groups).sort().forEach(prefix => {
  console.log(`  - Group ${prefix}: ${groups[prefix].length} works`);
});

// 生成 index-manifest.json 供全庫快速搜尋解壓對照
const manifest = {
  version: 'CBReader 2X v0.9.9 (2026-01-21)',
  updatedAt: new Date().toISOString(),
  totalWorks: workDirs.length,
  groups: {}
};

Object.keys(groups).forEach(prefix => {
  manifest.groups[prefix] = groups[prefix];
});

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'cbeta-backup-manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log('\n✅ Manifest created: cbeta-backup-manifest.json');
console.log('\n💡 上傳說明：');
console.log('1. 開啟 GitHub Releases 頁面: https://github.com/vbgrdmental-bit/Cbeta-Reader/releases/new');
console.log('2. Tag 名稱輸入: v1.0.0-database');
console.log('3. 標題輸入: CBETA Full Backup Database (1.77 GB)');
console.log('4. 將此資料夾內資產上傳至 GitHub Release Assets 即可！');
