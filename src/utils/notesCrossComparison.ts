import type { BookHighlight } from './db';

export interface KeywordComparisonGroup {
  keyword: string;
  highlights: BookHighlight[];
  booksCount: number;
  totalCount: number;
  uniqueBookIds: string[];
}

// 🌟 佛教法義正統名相與法相名詞白名單（確保「不可思議」、「如來藏」、「無明」等核心名相不被誤判）
const BUDDHIST_TERMS_WHITELIST = new Set([
  '不可思議', '不思議', '不二法門', '不生不滅', '不退轉', '不增不減', '不生滅', '不空',
  '無明', '無礙', '無漏', '無常', '無我', '無量', '無為', '無上', '無生法忍', '無餘涅槃',
  '如來', '如來藏', '如實', '如意', '因果', '因明', '因緣', '隨喜', '隨眠', '所知障', '煩惱障',
  '般若', '菩提', '涅槃', '法性', '真如', '法身', '解脫', '三昧', '禪定', '止觀', '四聖諦',
  '八正道', '十二因緣', '六度', '波羅蜜', '波羅蜜多', '空性', '中道', '中觀', '唯識',
  '菩提心', '慈悲', '發心', '願力', '修行', '懺悔', '持戒', '忍辱', '精進', '智慧',
  '神通', '業力', '罪業', '黑業', '白業', '報應', '輪迴', '生死', '往生', '淨土', '極樂',
  '阿彌陀', '釋迦', '觀音', '文殊', '普賢', '地藏', '彌勒', '金剛', '楞嚴', '法華', '華嚴',
  '舍利弗', '目犍連', '阿難', '迦葉', '龍樹', '無著', '世親', '玄奘', '太虛', '印順',
  '阿羅漢', '菩薩', '佛陀', '佛法', '佛教', '佛性', '佛子', '勝義諦', '世俗諦', '五蘊',
  '十二處', '十八界', '色受想行識', '緣起', '自性', '法界', '實相', '方便', '本願', '功德',
  '陀羅尼', '總持', '真言', '戒定慧', '三十七道品', '四念處', '四正勤', '四神足', '五根', '五力', '七覺支'
]);

// 🌟 常用虛詞、連詞、代詞、文言發語套話（純客觀語法排除，不具備法義實質）
const CHINESE_STOPWORDS = new Set([
  // 因果/轉折/條件/並列連詞
  '所以', '因為', '因此', '由於', '是以', '是故', '何以', '以是', '故此', '緣此', '由是', '因而', '以致', '可見',
  '但是', '然而', '可是', '不過', '雖然', '儘管', '固然', '縱使', '即使', '若是', '如果', '假使', '設使', '若使',
  '不但', '而且', '並且', '尚且', '何況', '況且', '況復', '寧可', '與其', '不如',
  '若是', '若有', '若人', '若復', '乃至', '所謂', '云何', '如何', '為何', '何者', '何等', '幾何', '奈何', '若何',
  // 指示代詞、人稱代詞、疑問代詞
  '這個', '那個', '這些', '那些', '如此', '這樣', '那樣', '如是', '其餘', '其它', '其他', '其中', '其間',
  '我們', '你們', '他們', '她們', '它們', '自己', '彼此', '互相', '大家', '眾人', '某人', '何人', '誰人',
  // 程度/副詞/情態詞
  '非常', '十分', '極其', '極為', '相當', '特別', '更加', '常常', '時常', '往往', '總是', '已經', '曾經', '正在',
  '不可', '不能', '不用', '不要', '不得', '不會', '不曾', '未曾', '沒有', '無有', '並非', '絕非', '未嘗', '豈能',
  // 佛典特定起承轉合套話
  '爾時', '即時', '白佛', '佛告', '佛言', '佛說', '世尊', '說是', '語已', '善男', '善女', '善男子', '善女人',
  '復次', '一時', '其人', '受持', '讀誦', '書寫', '為人', '說法', '彼時', '有人', '於意', '汝等', '當知',
  '如我', '所說', '彼諸', '大眾', '合掌', '恭敬', '頂禮', '佛足', '退坐', '一面', '歡喜', '奉行', '作禮', '而去'
]);

// 🌟 碎片殘詞、非獨立成詞片段（如「思議」單獨不是獨立語詞，不可列為關鍵字）
const FRAGMENT_WORDS = new Set([
  '思議', '可思', '何等', '何故', '所以', '何以', '以何', '云何', '何者', '若何', '如何', '幾何', '奈何',
  '為甚', '甚麼', '什麼', '怎樣', '那樣', '這樣', '如此', '如是', '以是', '由是',
  '彼時', '爾時', '即時', '一時', '這時', '那時', '當時', '此時', '其時',
  '現在', '過去', '未來', '一般', '具體', '相對', '絕對', '直接', '間接',
  '主要', '次要', '相關', '部分', '全部', '整體', '方面', '情況', '狀態',
  '程度', '範圍', '關係', '作用', '影響', '結果', '原因', '目的', '方法', '方式',
  '當然是', '或是', '也是', '就是', '若是', '不是'
]);

// 🌟 非法首字（若非白名單名相，首字絕不可為虛詞、介詞、助詞、代詞）
const INVALID_LEADING_CHARS = new Set([
  '的', '之', '得', '地', '了', '著', '過', '於', '在', '以', '從', '自', '由', '向', '對', '朝', '往', 
  '被', '給', '讓', '叫', '跟', '與', '同', '及', '和', '或', '且', '又', '亦', '並', '而', '則', '便', 
  '就', '即', '乃', '俱', '皆', '咸', '悉', '都', '總', '全', '非', '莫', '毋', '勿', '未', '不', '無', 
  '其', '此', '彼', '斯', '茲', '某', '伊', '你', '我', '他', '她', '它', '誰', '何', '孰', '哪', '每', 
  '各', '凡', '諸', '把', '將'
]);

// 🌟 非法尾字（若非白名單名相，尾字絕不可為虛詞、助詞、方位殘字）
const INVALID_TRAILING_CHARS = new Set([
  '的', '之', '得', '地', '了', '著', '過', '於', '在', '以', '從', '向', '對', '跟', '與', '同', '及', 
  '和', '或', '且', '又', '亦', '並', '而', '則', '便', '就', '即', '乃', '俱', '皆', '咸', '悉', '都', 
  '總', '全', '非', '莫', '毋', '勿', '未', '不', '無', '其', '此', '彼', '斯', '茲', '某', '伊', '你', 
  '我', '他', '她', '它', '誰', '何', '孰', '哪', '每', '各', '凡', '諸', '者', '也', '矣', '乎', '哉', 
  '耳', '耶', '歟', '焉', '兮', '罷', '麼', '呢', '吧', '啊', '呀', '中', '裡', '上', '下', '內', '外', 
  '前', '後', '間', '邊', '旁'
]);

/**
 * 嚴格檢驗關鍵字是否為有意義、常用的獨立中文語詞
 */
function isValidKeyword(word: string): boolean {
  if (!word || word.length < 2 || word.length > 8) return false;
  // 必須為純漢字
  if (!/^[\u4e00-\u9fa5]+$/.test(word)) return false;
  // 停用詞排除（徹底根除「所以」等虛詞）
  if (CHINESE_STOPWORDS.has(word)) return false;
  // 碎片殘詞排除（徹底根除「思議」等非獨立殘詞）
  if (FRAGMENT_WORDS.has(word)) return false;
  // 正統法義名相白名單直接通過
  if (BUDDHIST_TERMS_WHITELIST.has(word)) return true;
  // 邊界檢驗：首字尾字不可為虛詞（徹底根除「的佛」、「佛的」等切詞碎片）
  if (INVALID_LEADING_CHARS.has(word[0])) return false;
  if (INVALID_TRAILING_CHARS.has(word[word.length - 1])) return false;
  return true;
}

/**
 * 嚴格遵循 Core Doctrine 0.1：客觀文字交叉比對演算法
 * 1. 僅以讀者實際劃重點的原文字句（hl.text）與讀者親筆心得筆記（hl.note）為唯一客觀來源。
 * 2. 導入 Intl.Segmenter 語義標準分詞，徹底杜絕滑動窗口產生之切詞碎片（如「的佛」）。
 * 3. 嚴格過濾虛詞連詞（如「所以」）與非獨立殘詞（如「思議」），確保所有關鍵字皆為有意義之正統語詞。
 * 4. 同一關鍵字在全部劃線中累積出現次數 ≥ 3 次，自動聚合成一個交叉比對群組。
 */
export function buildKeywordComparisonGroups(
  highlights: BookHighlight[]
): KeywordComparisonGroup[] {
  if (!highlights || highlights.length === 0) return [];

  // 初始化繁體標準分詞器
  let segmenter: Intl.Segmenter | null = null;
  if (typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function') {
    try {
      segmenter = new (Intl as any).Segmenter('zh-Hant', { granularity: 'word' });
    } catch {
      segmenter = null;
    }
  }

  // 1. 統計每個候選詞在哪些重點 (hl.id) 以及哪些經典 (hl.workId) 出現
  const phraseMatches = new Map<string, { hlIds: Set<string>; workIds: Set<string> }>();

  // 讀者若在筆記中有手寫明確標籤 (如 #地藏 或 【地藏】) 優先提取
  const explicitTagRegex = /[#＃]([\u4e00-\u9fa5A-Za-z0-9_]{2,8})/g;

  highlights.forEach(hl => {
    const textPool: string[] = [];
    if (hl.text) textPool.push(hl.text);
    if (hl.note) textPool.push(hl.note);

    const phrasesInThisHighlight = new Set<string>();

    // A. 優先提取手寫筆記中的 #標籤 (讀者親筆標註之法義)
    if (hl.note) {
      let match: RegExpExecArray | null;
      while ((match = explicitTagRegex.exec(hl.note)) !== null) {
        const tag = match[1].trim();
        if (isValidKeyword(tag)) {
          phrasesInThisHighlight.add(tag);
        }
      }
    }

    // B. 從劃線原文與筆記中提取語義詞彙
    textPool.forEach(rawText => {
      // 1) 掃描是否存在正統名相（如「不可思議」、「如來藏」等）
      BUDDHIST_TERMS_WHITELIST.forEach(term => {
        if (rawText.includes(term)) {
          phrasesInThisHighlight.add(term);
        }
      });

      // 2) 利用 Intl.Segmenter 進行繁體中文語義單詞提取
      if (segmenter) {
        const segs = Array.from(segmenter.segment(rawText));
        segs.forEach((segObj: any) => {
          const seg = segObj.segment.trim();
          if (isValidKeyword(seg)) {
            phrasesInThisHighlight.add(seg);
          }
        });
      } else {
        // Fallback: 若無 Segmenter，使用純漢字片段分詞
        const clean = rawText.replace(/[^\u4e00-\u9fa5]/g, ' ');
        const segments = clean.split(/\s+/).filter(s => s.length >= 2);
        segments.forEach(seg => {
          const len = seg.length;
          for (let n = 2; n <= Math.min(len, 4); n++) {
            for (let i = 0; i <= len - n; i++) {
              const gram = seg.slice(i, i + n);
              if (isValidKeyword(gram)) {
                phrasesInThisHighlight.add(gram);
              }
            }
          }
        });
      }
    });

    // 將該重點命中之合法關鍵字加入全局統計 (每個重點只計 1 次)
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
  // 若詞 A 為詞 B 的子字串，且 A 與 B 命中的重點高度重疊（例如 "不可思議" 與 "不思議"，或 "大光明" 與 "光明"），
  // 優先保留長度較長、語義更完整具體的詞，消除冗餘碎片。
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
