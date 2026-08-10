/**
 * CBETA Local TEI XML Packager for Cloudflare R2 / Local Backup
 * 
 * Usage:
 *   node scripts/package-cbeta-r2.cjs [workId|POPULAR|ALL]
 */

const fs = require('fs');
const path = require('path');

const CBETA_BASE_DIR = 'D:/Antigravity專用/cbeta/CBReader2X/Bookcase/CBETA';
const OUTPUT_DIR = path.join(__dirname, '../dist-r2-backup');
const PUBLIC_BACKUP_DIR = path.join(__dirname, '../public/backup');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 解析 teiHeader 中的 <charDecl> 缺字/異體字對照表
 */
function parseCharDecl(xmlStr) {
  const charMap = new Map();
  const charRegex = /<char\s+xml:id="([^"]+)">([\s\S]*?)<\/char>/gi;
  let match;
  while ((match = charRegex.exec(xmlStr)) !== null) {
    const id = match[1];
    const content = match[2];
    
    // 優先讀取 Unicode 映射
    const uniMatch = content.match(/<mapping\s+type="unicode">U\+([0-9A-F]+)<\/mapping>/i);
    let charVal = null;
    if (uniMatch) {
      try {
        charVal = String.fromCodePoint(parseInt(uniMatch[1], 16));
      } catch (e) {}
    }

    // 其次讀取組字式 (composition)
    if (!charVal) {
      const compMatch = content.match(/<localName>composition<\/localName>\s*<value>([^<]+)<\/value>/i);
      if (compMatch) {
        charVal = compMatch[1];
      }
    }

    if (!charVal) {
      charVal = `[${id}]`;
    }

    charMap.set(id, charVal);
  }
  return charMap;
}

/**
 * 精確處理 TEI XML 中的 <g ref="...">, <app>, <lem>, <rdg>, <note>, <lb>, <pb>, <cb:mulu> 標籤
 */
function convertXmlToHtml(xmlStr) {
  const charMap = parseCharDecl(xmlStr);
  let html = xmlStr;
  
  // 1. 移除 xml header / teiHeader 元資料宣告（僅保留正文 <body>）
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[0];
  }

  // 2. 處理缺字 / 異體字標籤 <g ref="#CBxxxxx"> 與 <gaiji cb="CBxxxxx"/>
  // 絕對不刪除任何缺字異體字！若有 Unicode 轉字，若無轉為 [組字式] 或保留對應文字
  html = html.replace(/<g\s+ref="#([^"]+)"[^>]*>([\s\S]*?)<\/g>/gi, (match, cbId, innerText) => {
    const mapped = charMap.get(cbId);
    if (mapped) return mapped;
    if (innerText && innerText.trim()) return innerText.trim();
    return `[${cbId}]`;
  });
  html = html.replace(/<g\s+ref="#([^"]+)"[^>]*\/>/gi, (match, cbId) => {
    const mapped = charMap.get(cbId);
    return mapped || `[${cbId}]`;
  });
  html = html.replace(/<gaiji\s+[^>]*cb="([^"]+)"[^>]*\/>/gi, (match, cbId) => {
    const mapped = charMap.get(cbId);
    return mapped || `[${cbId}]`;
  });

  // 3. 處理 <app> 校勘標籤：保留正字 <lem> 的內容，刪除異體/底本字 <rdg>
  html = html.replace(/<app\s+[^>]*>([\s\S]*?)<\/app>/gi, (match, inner) => {
    const lemMatch = inner.match(/<lem[^>]*>([\s\S]*?)<\/lem>/i);
    if (lemMatch) {
      return lemMatch[1]; // 僅保留正字
    }
    return inner.replace(/<rdg[^>]*>[\s\S]*?<\/rdg>/gi, '');
  });

  // 4. 移除出處/參考對照標籤 <note type="cf1">, <note type="cf2">
  html = html.replace(/<note\s+[^>]*type="cf\d+"[^>]*>[\s\S]*?<\/note>/gi, '');

  // 4.5 處理小註/雙行註 <note place="inline">：轉為行內小註 <span class="inline-note">（...）</span>，保留為經文內文
  html = html.replace(/<note[^>]*place="inline"[^>]*>([\s\S]*?)<\/note>/gi, (match, inner) => {
    const clean = inner.replace(/<[^>]+>/g, '').trim();
    return `<span class="inline-note">（${clean}）</span>`;
  });

  // 5. 處理一般校勘與原註 <note n="...">：從正文中完全移出，集中置於頁尾 <div id="footnotes"> 容器中
  const notes = [];
  html = html.replace(/<note\s+[^>]*n="([^"]+)"[^>]*>([\s\S]*?)<\/note>/gi, (match, n, content) => {
    const cleanContent = content.replace(/<[^>]+>/g, '').trim();
    notes.push({ n, content: cleanContent });
    return ''; // 從段落正文中完全移除，防止【CB】【大】混入內文 textContent！
  });

  // 移除其餘無 n 屬性的雜項 <note>
  html = html.replace(/<note[^>]*>[\s\S]*?<\/note>/gi, '');

  // 5.5 處理偈頌體間隔標籤 <caesura/> 轉為對齊全形空格
  html = html.replace(/<caesura\s*\/?>/gi, '　');

  // 6. 處理紙本頁碼分頁標籤 <pb> 與 <milestone>：轉為內聯行內空標籤，防範斷開 <p> 段落造成不當換行！
  html = html.replace(/<pb\s+[^>]*\/>/gi, '');
  html = html.replace(/<pb\s+[^>]*>[\s\S]*?<\/pb>/gi, '');
  html = html.replace(/<milestone\s+[^>]*\/>/gi, '');

  // 7. 處理品名/章節標籤 <cb:mulu> 與 <head>
  html = html.replace(/<cb:mulu\s+[^>]*level="([^"]+)"[^>]*n="([^"]+)"[^>]*type="([^"]+)"[^>]*>([\s\S]*?)<\/cb:mulu>/gi, (match, level, n, type, title) => {
    return `<div class="cb-mulu" data-level="${level}" data-n="${n}" data-type="${type}">${title}</div>`;
  });
  html = html.replace(/<cb:mulu\s+[^>]*>([\s\S]*?)<\/cb:mulu>/gi, (match, title) => {
    return `<div class="cb-mulu">${title}</div>`;
  });
  html = html.replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, (match, title) => {
    return `<h2 class="head">${title}</h2>`;
  });

  // 8. 修正 <lb n="0001a01"/> 行號標籤：保持 inner text 為空
  html = html.replace(/<lb\s+n="([^"]+)"[^>]*\/>/gi, '<span class="lb" id="p$1"></span>');
  html = html.replace(/<lb\s+n="([^"]+)"[^>]*>/gi, '<span class="lb" id="p$1"></span>');
  
  // 9. 轉換 <p> 與 <l> 為段落容器
  html = html.replace(/<p[^>]*>/gi, '<p>').replace(/<\/p>/gi, '</p>');
  html = html.replace(/<l[^>]*>/gi, '<p class="lg">').replace(/<\/l>/gi, '</p>');

  // 10. 將抽離的校勘註腳集中附加在頁尾 <div id="footnotes"> 容器中
  if (notes.length > 0) {
    const footnotesHtml = `<div id="footnotes">${notes.map(item => `<div class="note-text" id="note_${item.n}">${item.content}</div>`).join('')}</div>`;
    html += footnotesHtml;
  }

  return html;
}

/**
 * 解析 CBReader 2X 的 toc XML 檔 (例如 toc/T/T0262.xml)，生成官方多層級 mulu 目錄樹 (含 children 樹狀節點)
 */
function parseTocXml(workId) {
  const prefix = workId.charAt(0);
  const tocFilePath = path.join(CBETA_BASE_DIR, 'toc', prefix, `${workId}.xml`);
  
  if (!fs.existsSync(tocFilePath)) {
    return [];
  }

  const xmlContent = fs.readFileSync(tocFilePath, 'utf8');

  const catalogMatch = xmlContent.match(/<nav\s+type="catalog"[\s\S]*?<\/nav>/i);
  if (!catalogMatch) return [];

  const navContent = catalogMatch[0];

  function parseOl(olString) {
    const list = [];
    let pos = 0;
    while (pos < olString.length) {
      const liStart = olString.indexOf('<li', pos);
      if (liStart === -1) break;
      
      let depth = 1;
      let cur = liStart + 3;
      let liEnd = -1;
      while (cur < olString.length) {
        const nextSubLi = olString.indexOf('<li', cur);
        const nextCloseLi = olString.indexOf('</li>', cur);
        if (nextCloseLi === -1) break;
        
        if (nextSubLi !== -1 && nextSubLi < nextCloseLi) {
          depth++;
          cur = nextSubLi + 3;
        } else {
          depth--;
          if (depth === 0) {
            liEnd = nextCloseLi + 5;
            break;
          }
          cur = nextCloseLi + 5;
        }
      }

      if (liEnd === -1) break;
      const liContent = olString.slice(liStart, liEnd);
      pos = liEnd;

      const cblinkMatch = liContent.match(/<cblink\s+href="[^"]*_(\d+)\.xml#p([^"]+)">([\s\S]*?)<\/cblink>/i);
      if (cblinkMatch) {
        const juan = parseInt(cblinkMatch[1], 10);
        const lb = `p${cblinkMatch[2]}`;
        const title = cblinkMatch[3].replace(/<[^>]+>/g, '').trim();

        const node = { title, lb, juan, type: '品' };

        const olMatch = liContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
        if (olMatch) {
          const children = parseOl(olMatch[1]);
          if (children.length > 0) {
            node.children = children;
          }
        }

        list.push(node);
      }
    }

    return list;
  }

  const firstOlMatch = navContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>\s*<\/nav>/i) || navContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  if (!firstOlMatch) return [];

  return parseOl(firstOlMatch[1]);
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

  const muluToc = parseTocXml(workId);

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
      toc: {
        mulu: muluToc
      },
      version: 'CBReader 2X v0.9.9 2026-01-21'
    };

    const targetWorkDir = path.join(OUTPUT_DIR, workId);
    const publicWorkDir = path.join(PUBLIC_BACKUP_DIR, workId);
    ensureDirSync(targetWorkDir);
    ensureDirSync(publicWorkDir);
    
    const jsonStr = JSON.stringify(payload, null, 2);
    const outFilePath = path.join(targetWorkDir, `${juanNum}.json`);
    const publicFilePath = path.join(publicWorkDir, `${juanNum}.json`);
    fs.writeFileSync(outFilePath, jsonStr, 'utf8');
    fs.writeFileSync(publicFilePath, jsonStr, 'utf8');
    console.log(`  -> Wrote Juan ${juanNum}: ${outFilePath}`);
  });

  console.log(`Successfully packaged ${workId} (${matchedFiles.length} juans, ${muluToc.length} TOC items).`);
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
        const publicWorkDir = path.join(PUBLIC_BACKUP_DIR, workId);
        ensureDirSync(targetWorkDir);
        ensureDirSync(publicWorkDir);

        const muluToc = parseTocXml(workId);

        fileList.forEach((item, index) => {
          const juanNum = index + 1;
          const xmlContent = fs.readFileSync(item.filePath, 'utf8');
          const html = convertXmlToHtml(xmlContent);

          const payload = {
            workId: workId,
            juan: juanNum,
            results: [{ html }],
            toc: { mulu: muluToc },
            version: 'CBReader 2X v0.9.9 2026-01-21'
          };

          const jsonStr = JSON.stringify(payload, null, 2);
          fs.writeFileSync(path.join(targetWorkDir, `${juanNum}.json`), jsonStr, 'utf8');
          fs.writeFileSync(path.join(publicWorkDir, `${juanNum}.json`), jsonStr, 'utf8');
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
ensureDirSync(PUBLIC_BACKUP_DIR);

if (arg === 'ALL') {
  packageAll();
} else if (arg === 'POPULAR') {
  console.log(`Packaging ${POPULAR_WORKS.length} popular core scriptures...`);
  POPULAR_WORKS.forEach(w => packageWork(w));
  console.log(`🎉 [Completed] All ${POPULAR_WORKS.length} popular core scriptures packaged.`);
} else {
  packageWork(arg);
}
