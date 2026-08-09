/**
 * Build 100% Complete CBETA Backup Works Metadata Index from CBReader catalog.txt
 */

const fs = require('fs');
const path = require('path');

const CATALOG_TXT_PATH = 'D:/Antigravity專用/cbeta/CBReader2X/Bookcase/CBETA/catalog.txt';
const BACKUP_DIR = path.join(__dirname, '../public/backup');
const OUT_FILE = path.join(__dirname, '../public/cbeta-works-index.json');
const OUT_FILE_ALT = path.join(__dirname, '../public/backup/works-index.json');
const DIST_ASSETS = path.join(__dirname, '../dist-release-assets/cbeta-works-index.json');
const RELEASE_ZIPS = path.join(__dirname, '../public/release-zips/cbeta-works-index.json');

console.log('=== Building 100% Pure Backup Works Metadata Index from catalog.txt ===');

if (!fs.existsSync(CATALOG_TXT_PATH)) {
  console.error(`Error: ${CATALOG_TXT_PATH} not found.`);
  process.exit(1);
}

const txtContent = fs.readFileSync(CATALOG_TXT_PATH, 'utf8');
const lines = txtContent.split('\n').filter(l => l.trim().length > 0);

const worksMap = new Map();

lines.forEach(l => {
  const parts = l.split(',').map(s => s.trim());
  if (parts.length >= 8) {
    const prefix = parts[0];
    const category = parts[1] || '未分類';
    const volNum = parts[3];
    const num = parts[4];
    const juans = parseInt(parts[5], 10) || 1;
    let title = parts[6] || '';
    const creators = parts[7] || 'CBETA 大藏經';

    // 格式化 WorkID (例如 T0220, A1057)
    const workId = `${prefix}${num.padStart(4, '0')}`;

    // 清理標題中的卷次區段標記 (例如 "(第1卷-第200卷)" -> "大般若波羅蜜多經")
    const cleanTitle = title.replace(/\(第\d+卷[^\)]*\)/g, '').trim();

    if (!worksMap.has(workId)) {
      worksMap.set(workId, {
        workId,
        title: cleanTitle || workId,
        creators,
        juansCount: juans,
        category,
        vol: `${prefix}${volNum}`
      });
    } else {
      // 若已有記錄 (如分冊大部頭)，加總卷數
      const existing = worksMap.get(workId);
      existing.juansCount = Math.max(existing.juansCount, juans);
      if (cleanTitle && (!existing.title || existing.title.length < cleanTitle.length)) {
        existing.title = cleanTitle;
      }
    }
  }
});

const worksIndex = Array.from(worksMap.values());

console.log(`Successfully compiled metadata for ${worksIndex.length} distinct works.`);

const payload = {
  version: 'CBReader 2X v0.9.9 (2026-01-21)',
  updatedAt: new Date().toISOString(),
  totalWorks: worksIndex.length,
  works: worksIndex
};

const jsonStr = JSON.stringify(payload, null, 2);
fs.writeFileSync(OUT_FILE, jsonStr, 'utf8');
fs.writeFileSync(OUT_FILE_ALT, jsonStr, 'utf8');
try { fs.writeFileSync(DIST_ASSETS, jsonStr, 'utf8'); } catch (e) {}
try { fs.writeFileSync(RELEASE_ZIPS, jsonStr, 'utf8'); } catch (e) {}

console.log(`✅ [Success] Generated cbeta-works-index.json (${(jsonStr.length / (1024 * 1024)).toFixed(2)} MB)`);
