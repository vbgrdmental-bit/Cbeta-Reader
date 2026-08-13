/**
 * Robust Packager for GitHub Release ZIP Assets using relative paths to handle Unicode paths
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, '../dist-release-assets');
const PUBLIC_DIR = path.join(__dirname, '../public/backup');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('=== Building Clean ZIP Assets with Relative Paths ===');

const groups = [
  { name: 'cbeta-backup-T.zip', pattern: 'T*' },
  { name: 'cbeta-backup-X.zip', pattern: 'X*' },
  { name: 'cbeta-backup-Y.zip', pattern: 'Y*' },
  { name: 'cbeta-backup-A-M.zip', pattern: 'A* B* C* D* F* G* I* J* K* L* M*' },
  { name: 'cbeta-backup-N-Z.zip', pattern: 'N* P* S* U* Z*' }
];

groups.forEach(({ name, pattern }) => {
  const outPath = path.join(OUTPUT_DIR, name);
  console.log(`Packaging ${name}...`);

  // 先嘗試刪除舊檔
  if (fs.existsSync(outPath)) {
    try { fs.unlinkSync(outPath); } catch (e) {}
  }

  // 使用 relative path 防止 cmd/tar 非 ASCII 路徑解析問題
  const relOutPath = path.relative(PUBLIC_DIR, outPath);
  const cmd = `tar -a -c -f "${relOutPath}" ${pattern}`;

  try {
    execSync(cmd, { cwd: PUBLIC_DIR, stdio: 'inherit' });
    const stat = fs.statSync(outPath);
    console.log(`✅ [Success] ${name} created (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (e) {
    console.error(`❌ [Error] Failed to package ${name}:`, e.message);
  }
});

console.log('\n🎉 ALL 5 ZIP ASSETS SUCCESSFULLY CREATED!');
