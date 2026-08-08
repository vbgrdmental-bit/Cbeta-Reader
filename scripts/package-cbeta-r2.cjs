/**
 * CBETA Local TEI XML Packager for Cloudflare R2 Backup
 * 
 * Usage:
 *   node scripts/package-cbeta-r2.cjs [workId]
 * 
 * Example:
 *   node scripts/package-cbeta-r2.cjs T0412
 *   node scripts/package-cbeta-r2.cjs ALL
 */

const fs = require('fs');
const path = require('path');

const CBETA_BASE_DIR = 'D:/Antigravity專用/cbeta/CBReader2X/Bookcase/CBETA';
const OUTPUT_DIR = path.join(__dirname, '../dist-r2-backup');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 簡易 TEI XML 轉化為前端相容的 HTML 標籤結構
 */
function convertXmlToHtml(xmlStr) {
  let html = xmlStr;
  
  // 移除 xml header / teiHeader 元資料宣告（保留正文）
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[0];
  }

  // 轉換 <lb n="0001a01" ed="T"/> 為前端識別之 <span class="lb">
  html = html.replace(/<lb\s+n="([^"]+)"[^>]*>/gi, '<span class="lb" id="p$1">$1</span>');
  
  // 轉換 <p> 與 <l> 為段落容器
  html = html.replace(/<p[^>]*>/gi, '<p>').replace(/<\/p>/gi, '</p>');
  html = html.replace(/<l[^>]*>/gi, '<p class="lg">').replace(/<\/l>/gi, '</p>');
  
  // 轉換 <note type="orig" n="..."> 為校勘腳註
  html = html.replace(/<note\s+[^>]*n="([^"]+)"[^>]*>([\s\S]*?)<\/note>/gi, (match, n, content) => {
    return `<span class="note-text" id="note_${n}">${content}</span>`;
  });

  // 轉換缺字 <gaiji> 標籤
  html = html.replace(/<gaiji\s+[^>]*cb="([^"]+)"[^>]*\/>/gi, (match, cb) => {
    return `<span class="gaiji" id="${cb}">[${cb}]</span>`;
  });

  return html;
}

/**
 * 打包單一 Work (例如 T0412)
 */
function packageWork(workId) {
  const prefix = workId.charAt(0);
  const numberPart = workId.slice(1).padStart(4, '0');
  const targetPattern = `n${numberPart}`;

  const xmlCanonDir = path.join(CBETA_BASE_DIR, 'XML', prefix);
  
  if (!fs.existsSync(xmlCanonDir)) {
    console.error(`[Error] Directory not found for ${workId}: ${xmlCanonDir}`);
    return;
  }

  let matchedFiles = [];
  let targetFolder = null;

  const subDirs = fs.readdirSync(xmlCanonDir);
  for (const sub of subDirs) {
    const fullSub = path.join(xmlCanonDir, sub);
    if (fs.statSync(fullSub).isDirectory()) {
      const files = fs.readdirSync(fullSub);
      const foundFiles = files.filter(f => f.includes(targetPattern) && f.endsWith('.xml'));
      if (foundFiles.length > 0) {
        targetFolder = fullSub;
        matchedFiles = foundFiles;
        break;
      }
    }
  }

  if (!targetFolder || matchedFiles.length === 0) {
    console.error(`[Error] Could not locate XML files for workId: ${workId} (pattern: ${targetPattern})`);
    return;
  }

  console.log(`Packaging ${workId} (${matchedFiles.length} files) from ${targetFolder}...`);
  matchedFiles.sort();

  matchedFiles.forEach((file, index) => {
    const juanNum = index + 1;
    const filePath = path.join(targetFolder, file);
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const html = convertXmlToHtml(xmlContent);

    const payload = {
      workId: workId,
      juan: juanNum,
      results: [
        {
          html: html
        }
      ],
      version: 'CBReader 2X v0.9.9 2026-01-21'
    };

    const targetWorkDir = path.join(OUTPUT_DIR, workId);
    ensureDirSync(targetWorkDir);
    
    const outFilePath = path.join(targetWorkDir, `${juanNum}.json`);
    fs.writeFileSync(outFilePath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`  -> Wrote Juan ${juanNum}: ${outFilePath}`);
  });

  console.log(`Successfully packaged ${workId} (${matchedFiles.length} juans).`);
}

// 主執行入口
const arg = process.argv[2] || 'T0412';
console.log(`=== CBETA R2 Backup Packager ===`);
console.log(`Source: ${CBETA_BASE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);

ensureDirSync(OUTPUT_DIR);
packageWork(arg);
