import type { BookHighlight } from './db';

export interface KeywordComparisonGroup {
  keyword: string;
  highlights: BookHighlight[];
  booksCount: number;
  totalCount: number;
  uniqueBookIds: string[];
}

// 佛典常見文言助詞、起承轉合虛詞、常用發語詞（純客觀語法排除，不含任何法義名相）
const CLASSICAL_CHINESE_STOPWORDS = new Set([
  '爾時', '即時', '白佛', '佛告', '佛言', '佛說', '世尊', '說是', '語已', '如是', 
  '是故', '何以', '故者', '以是', '因緣', '善男', '善女', '善男子', '善女人', '若人', 
  '若有', '復次', '一時', '乃至', '所謂', '不可', '不能', '亦無', '無有', '於中', 
  '其人', '云何', '受持', '讀誦', '書寫', '為人', '說法', '彼時', '若復', '有人',
  '於意', '云何', '汝等', '當知', '如我', '所說', '彼諸', '大眾', '合掌', '恭敬',
  '頂禮', '佛足', '退坐', '一面', '歡喜', '奉行', '作禮', '而去', '受持', '讀誦',
  '思維', '解說', '廣宣', '流布', '成就', '具足', '清淨'
]);

/**
 * 嚴格遵循 Core Doctrine 0.1：客觀文字交叉比對演算法
 * 1. 僅以讀者實際劃重點的原文字句（hl.text）與讀者親筆心得筆記（hl.note）為唯一客觀來源。
 * 2. 同一關鍵字在全部劃線中累積出現次數 ≥ 3 次，自動聚合成一個交叉比對群組。
 * 3. 排除常用無意義文言起首助詞。
 */
export function buildKeywordComparisonGroups(
  highlights: BookHighlight[]
): KeywordComparisonGroup[] {
  if (!highlights || highlights.length === 0) return [];

  // 1. 統計每個候選詞 (長度 2~5 字) 在哪些重點 (hl.id) 以及哪些經典 (hl.workId) 出現
  const phraseMatches = new Map<string, { hlIds: Set<string>; workIds: Set<string> }>();

  // 讀者若在筆記中有手寫明確標籤 (如 #地藏 或 【地藏】) 優先提取
  const explicitTagRegex = /[#＃]([\u4e00-\u9fa5A-Za-z0-9_]{2,8})/g;

  highlights.forEach(hl => {
    const textPool: string[] = [];
    if (hl.text) textPool.push(hl.text);
    if (hl.note) textPool.push(hl.note);

    const phrasesInThisHighlight = new Set<string>();

    // A. 優先提取手寫筆記中的 #標籤
    if (hl.note) {
      let match: RegExpExecArray | null;
      while ((match = explicitTagRegex.exec(hl.note)) !== null) {
        const tag = match[1].trim();
        if (tag.length >= 2 && tag.length <= 8) {
          phrasesInThisHighlight.add(tag);
        }
      }
    }

    // B. 從劃線原文與筆記純文字中提取 CJK 詞組 (長度 2~5 字)
    textPool.forEach(rawText => {
      // 移除標點符號與空白，僅保留中文字
      const clean = rawText.replace(/[^\u4e00-\u9fa5]/g, ' ');
      const segments = clean.split(/\s+/).filter(s => s.length >= 2);

      segments.forEach(seg => {
        const len = seg.length;
        // 提取 2-gram, 3-gram, 4-gram
        for (let n = 2; n <= Math.min(len, 4); n++) {
          for (let i = 0; i <= len - n; i++) {
            const gram = seg.slice(i, i + n);
            if (!CLASSICAL_CHINESE_STOPWORDS.has(gram)) {
              phrasesInThisHighlight.add(gram);
            }
          }
        }
      });
    });

    // 將該重點命中之關鍵字加入全局統計 (每個重點只計 1 次)
    phrasesInThisHighlight.forEach(phrase => {
      if (!phraseMatches.has(phrase)) {
        phraseMatches.set(phrase, { hlIds: new Set(), workIds: new Set() });
      }
      const record = phraseMatches.get(phrase)!;
      record.hlIds.add(hl.id);
      record.workIds.add(hl.workId);
    });
  });

  // 2. 篩選門檻：命中次數超過 3 個以上（≥ 3 則重點）
  const qualifiedPhrases: {
    phrase: string;
    hlIds: Set<string>;
    workIds: Set<string>;
  }[] = [];

  phraseMatches.forEach((data, phrase) => {
    if (data.hlIds.size >= 3) {
      qualifiedPhrases.push({
        phrase,
        hlIds: data.hlIds,
        workIds: data.workIds
      });
    }
  });

  // 3. 子詞重複過濾 (Sub-string suppression)：
  // 若詞 A 為詞 B 的子字串，且 A 與 B 命中的重點高度重疊（例如 "大光明" 與 "光明"，兩者命中條目一樣多），
  // 優先保留語意更具體的長詞 "大光明"，消除冗餘。
  const suppressed = new Set<string>();
  for (let i = 0; i < qualifiedPhrases.length; i++) {
    for (let j = 0; j < qualifiedPhrases.length; j++) {
      if (i === j) continue;
      const longer = qualifiedPhrases[i];
      const shorter = qualifiedPhrases[j];
      if (longer.phrase.length > shorter.phrase.length && longer.phrase.includes(shorter.phrase)) {
        // 如果較長詞命中的數量與較短詞幾乎相同 (差 ≤ 1)
        if (longer.hlIds.size >= shorter.hlIds.size - 1) {
          suppressed.add(shorter.phrase);
        }
      }
    }
  }

  const finalPhrases = qualifiedPhrases.filter(q => !suppressed.has(q.phrase));

  // 4. 組裝分組資料
  const hlMap = new Map<string, BookHighlight>(highlights.map(h => [h.id, h]));

  const groups: KeywordComparisonGroup[] = finalPhrases.map(({ phrase, hlIds, workIds }) => {
    const list: BookHighlight[] = [];
    hlIds.forEach(id => {
      const item = hlMap.get(id);
      if (item) list.push(item);
    });

    // 依書籍先後次序與卷次排序
    list.sort((a, b) => {
      if (a.workId !== b.workId) return a.workId.localeCompare(b.workId);
      if (a.juan !== b.juan) return a.juan - b.juan;
      return a.startOffset - b.startOffset;
    });

    const uniqueBookIds = Array.from(workIds);

    return {
      keyword: phrase,
      highlights: list,
      booksCount: uniqueBookIds.length,
      totalCount: list.length,
      uniqueBookIds
    };
  });

  // 5. 排序：優先以跨經典數由多到少，次以總命中次數由多到少
  groups.sort((a, b) => {
    if (b.booksCount !== a.booksCount) {
      return b.booksCount - a.booksCount;
    }
    return b.totalCount - a.totalCount;
  });

  return groups;
}
