import { useState, useEffect, useRef } from 'react';

export interface UseTTSProps {
  onSegmentChange?: (segmentId: string) => void;
  speed?: number;
  voiceName?: string;
  pitch?: number;
  mode?: 'normal' | 'natural';
}

// 已知的中文男聲關鍵字
const MALE_KEYWORDS = [
  'kangkang', 'zhiwei', 'yunxi', 'yunjian', 'yunfeng',
  'yunxia', 'yunhao', 'yunze', 'yunyang', 'yundeng', 'yunfan',
  'male', '男', 'sinji'
];

// 已知的中文女聲關鍵字
const FEMALE_KEYWORDS = [
  'hanhan', 'yaoyao', 'huihui', 'tingting', 'meijia',
  'xiaoxiao', 'xiaoyou', 'xiaomeng', 'xiaochen', 'xiaomin',
  'xiaomo', 'xiaorui', 'xiaoshuang', 'female', '女'
];

const isMaleVoice = (v: SpeechSynthesisVoice) =>
  MALE_KEYWORDS.some(k => v.name.toLowerCase().includes(k));

const isFemaleVoice = (v: SpeechSynthesisVoice) =>
  FEMALE_KEYWORDS.some(k => v.name.toLowerCase().includes(k));

export function useTTS({
  onSegmentChange,
  speed = 1.0,
  voiceName = '',
  pitch = 1.0,
  mode = 'normal'
}: UseTTSProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<number | null>(null);

  // 主段落播放清單
  const playlistRef = useRef<Array<{ id: string; text: string }>>([]);
  const currentIndexRef = useRef<number>(-1);

  // 自然口吻：句子拆分佇列
  const phraseQueueRef = useRef<string[]>([]);

  // 用 Ref 儲存最新設定與語音清單，避免 stale closure 問題
  const optionsRef = useRef({ speed, voiceName, pitch, mode });
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    optionsRef.current = { speed, voiceName, pitch, mode };
  }, [speed, voiceName, pitch, mode]);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  // 初始化 SpeechSynthesis，載入語音清單
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      if (!synthRef.current) return;
      const all = synthRef.current.getVoices();
      const zh = all.filter(v => /^zh/i.test(v.lang));
      setVoices(zh.length > 0 ? zh : all);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => { stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 選擇語音
   * pitchOverride !== null 表示系統無對應性別語音，用 pitch 模擬
   */
  const selectVoice = (
    opt: typeof optionsRef.current
  ): { voice: SpeechSynthesisVoice | undefined; pitchOverride: number | null } => {
    const avail = voicesRef.current;

    if (opt.voiceName === 'male') {
      const v = avail.find(isMaleVoice);
      if (v) return { voice: v, pitchOverride: null };
      // Fallback：無男聲語音，調低 pitch 至 0.5 模擬
      return { voice: avail.find(v => /^zh/i.test(v.lang)), pitchOverride: 0.5 };
    }

    if (opt.voiceName === 'female') {
      const v = avail.find(isFemaleVoice);
      if (v) return { voice: v, pitchOverride: null };
      // Fallback：無女聲語音，調高 pitch 至 1.35 模擬
      return { voice: avail.find(v => /^zh/i.test(v.lang)), pitchOverride: 1.35 };
    }

    if (opt.voiceName) {
      const custom = avail.find(v => v.name === opt.voiceName);
      return { voice: custom, pitchOverride: null };
    }

    const defaultVoice = avail.find(v => /^zh/i.test(v.lang));
    return { voice: defaultVoice, pitchOverride: null };
  };

  /**
   * 建立單一 SpeechSynthesisUtterance 並套用設定
   */
  const buildUtterance = (
    text: string,
    opt: typeof optionsRef.current,
    rate: number
  ): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = Math.max(0.1, Math.min(10, rate));

    const { voice, pitchOverride } = selectVoice(opt);
    if (voice) utterance.voice = voice;
    utterance.pitch = pitchOverride !== null
      ? Math.max(0.1, Math.min(2.0, pitchOverride * opt.pitch))
      : Math.max(0.1, Math.min(2.0, opt.pitch));

    return utterance;
  };

  // ─── 自然口吻：逐句播放，每句隨機語速模擬真人快慢 ─────────────────
  // NOTE: speakNextPhrase 定義在 speakCurrent 之前。
  //       speakNextPhrase 內部呼叫 speakCurrent 時，是在非同步 callback 中，
  //       因此 speakCurrent 已經初始化，不會有 temporal dead zone 問題。
  const speakNextPhrase = () => {
    const synth = synthRef.current;
    if (!synth) return;

    // 句子佇列清空 → 進入下一段落
    if (phraseQueueRef.current.length === 0) {
      currentIndexRef.current += 1;
      timerRef.current = window.setTimeout(speakCurrent, 300); // eslint-disable-line @typescript-eslint/no-use-before-define
      return;
    }

    const phrase = phraseQueueRef.current.shift()!.trim();
    if (!phrase) { speakNextPhrase(); return; }

    const opt = optionsRef.current;

    // 每句隨機語速：0.80 ~ 1.20× ，模擬人說話時的快慢韻律
    const variation = 0.80 + Math.random() * 0.40;
    const utterance = buildUtterance(phrase, opt, opt.speed * variation);

    // 根據句尾標點決定停頓長度（也加入隨機幅度增加自然感）
    const lastChar = phrase[phrase.length - 1] || '';
    let pauseAfter: number;
    if ('。！？'.includes(lastChar)) {
      // 句末：較長停頓 200~400ms
      pauseAfter = 200 + Math.round(Math.random() * 200);
    } else if ('，；：'.includes(lastChar)) {
      // 句中標點：中等停頓 80~200ms
      pauseAfter = 80 + Math.round(Math.random() * 120);
    } else {
      // 無標點結尾：短停頓 40~120ms
      pauseAfter = 40 + Math.round(Math.random() * 80);
    }

    utterance.onend = () => {
      timerRef.current = window.setTimeout(speakNextPhrase, pauseAfter);
    };
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        setIsPlaying(false);
        setCurrentSegmentId(null);
      }
    };

    synth.speak(utterance);
  };

  // ─── 主播放器：逐段落播放 ─────────────────────────────────────────
  const speakCurrent = () => {
    const synth = synthRef.current;
    if (
      !synth ||
      currentIndexRef.current < 0 ||
      currentIndexRef.current >= playlistRef.current.length
    ) {
      setIsPlaying(false);
      setCurrentSegmentId(null);
      return;
    }

    const { id, text } = playlistRef.current[currentIndexRef.current];
    setCurrentSegmentId(id);
    if (onSegmentChange) onSegmentChange(id);
    setIsPlaying(true);

    const opt = optionsRef.current;

    // 清除特殊標記
    let cleanText = text
      .replace(/【[^】]+】/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .trim();

    // 跳過空段落
    if (!cleanText) {
      currentIndexRef.current += 1;
      speakCurrent();
      return;
    }

    // ── 自然口吻：按所有標點拆句，逐句以隨機語速播放 ──
    if (opt.mode === 'natural') {
      // 在標點後切分（，。！？；：都切），保留標點在前段
      const phrases = cleanText
        .split(/(?<=[。！？，；：])/)
        .map(p => p.trim())
        .filter(Boolean);

      phraseQueueRef.current = phrases.length > 0 ? phrases : [cleanText];
      speakNextPhrase();
      return;
    }

    // ── 誦經口吻：固定慢速（0.60×），不插入任何額外停頓符，
    //    讓 TTS 引擎以均勻節奏朗讀每個字 ──
    const utterance = buildUtterance(cleanText, opt, opt.speed * 0.60);
    utteranceRef.current = utterance;

    utterance.onend = () => {
      currentIndexRef.current += 1;
      // 段落間 2000ms 停頓，供思惟法義
      timerRef.current = window.setTimeout(speakCurrent, 2000);
    };
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        setIsPlaying(false);
        setCurrentSegmentId(null);
      }
    };

    synth.speak(utterance);
  };

  const play = (segments: Array<{ id: string; text: string }>, startIndex = 0) => {
    if (!synthRef.current) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    synthRef.current.cancel();
    playlistRef.current = segments;
    currentIndexRef.current = startIndex;
    phraseQueueRef.current = [];
    setIsPaused(false);

    speakCurrent();
  };

  const pause = () => {
    if (synthRef.current && isPlaying && !isPaused) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  };

  const resume = () => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  };

  const stop = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSegmentId(null);
      currentIndexRef.current = -1;
      phraseQueueRef.current = [];
    }
  };

  return {
    isPlaying,
    isPaused,
    currentSegmentId,
    voices,
    play,
    pause,
    resume,
    stop
  };
}
