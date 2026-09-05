// 💡 大藏經 A...Z 共 26 個字母開頭之經典色系字典 v3
//    大幅擴展明度跨度（奶茶淺棕 #d4a878 → 深焙濃咖 #541e04）
//    + 強化暖色偏移：琥珀金(F/H/J/P/W)、磚紅(B/K/R/X)、純深木(G/T/Z)
export const CANON_LETTER_GRADIENTS: { [key: string]: string } = {
  A: 'linear-gradient(135deg, #c48252 0%, #9c5c2a 100%)', // 摩卡焦糖（中淺）
  B: 'linear-gradient(135deg, #aa6640 0%, #7e4018 100%)', // 磚紅栗褐（中深・磚紅偏移）
  C: 'linear-gradient(135deg, #d4a878 0%, #b08052 100%)', // 拿鐵米棕（最淺）
  D: 'linear-gradient(135deg, #9a5838 0%, #703816 100%)', // 深檀烘焙（深）
  E: 'linear-gradient(135deg, #b87848 0%, #8e5220 100%)', // 暖木沉香（中）
  F: 'linear-gradient(135deg, #dca868 0%, #b87e3a 100%)', // 奶金太妃（最淺・琥珀偏移）
  G: 'linear-gradient(135deg, #824828 0%, #582606 100%)', // 焦糖深焙（最深）
  H: 'linear-gradient(135deg, #c8924a 0%, #a46c24 100%)', // 蜂蜜琥珀（中淺・琥珀偏移）
  I: 'linear-gradient(135deg, #bc7a4a 0%, #904e24 100%)', // 沉水木褐（中）
  J: 'linear-gradient(135deg, #d8aa74 0%, #b48248 100%)', // 杏仁拿鐵（最淺・琥珀）
  K: 'linear-gradient(135deg, #985a36 0%, #6e3812 100%)', // 熟焙磚褐（深・磚紅偏移）
  L: 'linear-gradient(135deg, #b87a48 0%, #8c5420 100%)', // 桂皮咖棕（中）
  M: 'linear-gradient(135deg, #c28650 0%, #9a6028 100%)', // 肉桂奶棕（中淺）
  N: 'linear-gradient(135deg, #945636 0%, #6a3412 100%)', // 烏木沉香（深）
  O: 'linear-gradient(135deg, #ae7048 0%, #824820 100%)', // 溫潤檀棕（中深）
  P: 'linear-gradient(135deg, #c68e50 0%, #a06828 100%)', // 暖栗琥珀（中淺・琥珀偏移）
  Q: 'linear-gradient(135deg, #965836 0%, #6c3612 100%)', // 降真暗木（深）
  R: 'linear-gradient(135deg, #a86440 0%, #7c3e18 100%)', // 赤檀磚褐（中深・磚紅偏移）
  S: 'linear-gradient(135deg, #b07248 0%, #865028 100%)', // 琥珀深木（中深）
  T: 'linear-gradient(135deg, #824a2a 0%, #5a2808 100%)', // 大正深檀（最深）
  U: 'linear-gradient(135deg, #bc8050 0%, #90582a 100%)', // 暖栗咖褐（中）
  V: 'linear-gradient(135deg, #986040 0%, #703e1c 100%)', // 沉檀深木（深）
  W: 'linear-gradient(135deg, #d4aa70 0%, #ae8044 100%)', // 茶金奶棕（最淺・琥珀偏移）
  X: 'linear-gradient(135deg, #945638 0%, #6c3612 100%)', // 卍續深褐（深・磚紅偏移）
  Y: 'linear-gradient(135deg, #ba7e4c 0%, #8e5628 100%)', // 印順沉香（中）
  Z: 'linear-gradient(135deg, #7e4626 0%, #541e04 100%)'  // 古木濃咖（最深）
};

export function getBookCoverGradient(workId?: string | null): string {
  if (!workId) return 'linear-gradient(135deg, #b87848 0%, #8e5220 100%)';
  const letter = workId.charAt(0).toUpperCase();
  return CANON_LETTER_GRADIENTS[letter] || 'linear-gradient(135deg, #b87848 0%, #8e5220 100%)';
}
