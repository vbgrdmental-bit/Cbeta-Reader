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

// 常用與大部頭熱門經典對照表
const POPULAR_WORKS = [
  'T0251', // 般若波羅蜜多心經
  'T0235', // 金剛般若波羅蜜經
  'T0412', // 地藏菩薩本願經
  'T0262', // 妙法蓮華經
  'T0366', // 佛說阿彌陀經
  'T0360', // 佛說無量壽經
  'T0665', // 藥師琉璃光如來本願功德經
  'T0279', // 大方廣佛華嚴經 (八十華嚴)
  'T0310', // 大寶積經
  'T0374', // 大般涅槃經
  'T0220', // 大般若波羅蜜多經 (六百卷)
  'Y0001', // 太虛大師年譜
  'Y0003', // 勝鬘經講記
  'Y0004', // 藥師經講記
  'Y0005', // 淨土與禪
  'Y0014'  // 妙雲集
];

/**
 * 遍歷並自動打包 XML 資料夾下的全藏經
 */
function packageAll() {
  const xmlBaseDir = path.join(CBETA_BASE_DIR, 'XML');
  if (!fs.existsSync(xmlBaseDir)) {
    console.error(`[Error] Directory not found: ${xmlBaseDir}`);
    return;
  }

  const canons = fs.readdirSync(xmlBaseDir);
  let totalWorksCount = 0;
  let totalFilesCount = 0;

  console.log(`Starting full CBETA XML scan across ${canons.length} canons...`);

  for (const canon of canons) {
    const canonDir = path.join(xmlBaseDir, canon);
    if (!fs.statSync(canonDir).isDirectory()) continue;

    const vols = fs.readdirSync(canonDir);
    for (const vol of vols) {
      const volDir = path.join(canonDir, vol);
      if (!fs.statSync(volDir).isDirectory()) continue;

      const files = fs.readdirSync(volDir).filter(f => f.endsWith('.xml'));
      const workMap = new Map();

      files.forEach(file => {
        // 例: T13n0412_001.xml => canon: T, workNo: 0412
        const match = file.match(/^([A-Z]+)\d+n([A-Z0-9]+)_(\d+)\.xml$/i);
        if (match) {
          const canonPrefix = match[1].toUpperCase();
          const workNo = match[2];
          const workId = `${canonPrefix}${workNo}`;
          if (!workMap.has(workId)) workMap.set(workId, []);
          workMap.get(workId).push({ file, filePath: path.join(volDir, file) });
        }
      });

      for (const [workId, fileList] of workMap.entries()) {
        fileList.sort((a, b) => a.file.localeCompare(b.file));
        const targetWorkDir = path.join(OUTPUT_DIR, workId);
        ensureDirSync(targetWorkDir);

        fileList.forEach((item, index) => {
          const juanNum = index + 1;
          const xmlContent = fs.readFileSync(item.filePath, 'utf8');
          const html = convertXmlToHtml(xmlContent);

          const payload = {
            workId: workId,
            juan: juanNum,
            results: [{ html }],
            version: 'CBReader 2X v0.9.9 2026-01-21'
          };

          fs.writeFileSync(path.join(targetWorkDir, `${juanNum}.json`), JSON.stringify(payload, null, 2), 'utf8');
          totalFilesCount++;
        });

        totalWorksCount++;
        if (totalWorksCount % 50 === 0) {
          console.log(`[Progress] Packaged ${totalWorksCount} works (${totalFilesCount} juan files)...`);
        }
      }
    }
  }

  console.log(`🎉 [Completed] All CBETA works packaged! Total works: ${totalWorksCount}, total juans: ${totalFilesCount}.`);
}

// 主執行入口
const arg = (process.argv[2] || 'POPULAR').toUpperCase();
console.log(`=== CBETA R2 Backup Packager ===`);
console.log(`Source: ${CBETA_BASE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log(`Mode: ${arg}`);

ensureDirSync(OUTPUT_DIR);

if (arg === 'ALL') {
  packageAll();
} else if (arg === 'POPULAR') {
  console.log(`Packaging ${POPULAR_WORKS.length} popular core scriptures...`);
  POPULAR_WORKS.forEach(w => packageWork(w));
  console.log(`🎉 [Completed] All ${POPULAR_WORKS.length} popular core scriptures packaged.`);
} else {
  packageWork(arg);
}

