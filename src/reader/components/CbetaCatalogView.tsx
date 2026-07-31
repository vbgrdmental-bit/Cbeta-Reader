import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, ChevronLeft, ChevronRight, Settings, Search,
  Folder, Download, Check, X, Layers, BookMarked, User, Clock, Plus, Minus, Heart
} from 'lucide-react';
import type { AppSettings } from '../../utils/db';
import { listBooks } from '../../utils/db';
import { IndexBuilder, getApiUrl } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress } from '../../builder/PackageBuilder';
import '../styles/cbeta-catalog.css';

interface CbetaCatalogViewProps {
  onBackToLibrary: () => void;
  onOpenSettings: () => void;
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string) => void;
  settings: AppSettings;
}

interface CatalogNode {
  id: string; // e.g. "CBETA", "CBETA.001", "orig-T", etc.
  label: string; // Breadcrumb title
}

interface CatalogItem {
  id: string;
  label: string;
  subLabel?: string; // e.g. "25 CE ~ 220 CE"
  nodeType?: 'work' | 'category' | null;
  workId?: string;
  juansCount?: number;
  juanStart?: number;
  creators?: string;
  category?: string;
  file?: string;
  queryParam?: string;
  timeFrom?: number;
  timeTo?: number;
}

// 主題色彩選項
const FOLDER_COLOR_OPTIONS = [
  { name: '典雅綠', value: '#3d5a45' },
  { name: '琥珀棕', value: '#8c4b27' },
  { name: '琉璃藍', value: '#2b5c8f' },
  { name: '黛紫', value: '#5b3a6e' },
  { name: '朱紅', value: '#9c3427' },
  { name: '墨灰', value: '#4a5568' }
];

// CBETA 官方筆劃分類標籤與代表字 (對齊圖 1、圖 2、圖 3、圖 4)
export const CREATOR_STROKE_CATEGORIES = [
  { stroke: 1, label: '1 劃', sample: '一' },
  { stroke: 2, label: '2 劃', sample: '丁, 九, 了, 力, 十' },
  { stroke: 3, label: '3 劃', sample: '三, 上, 久, 于, 及, 土, 大, 子, 尸, 工, 才' },
  { stroke: 4, label: '4 劃', sample: '不, 中, 仁, 今, 介, 允, 勿, 天, 太, 巨, 巴, 幻, 式, 心, 支, 文, 方, 日, 月, 木, 毛, 水, 王' },
  { stroke: 5, label: '5 劃', sample: '世, 丘, 功, 印, 古, 可, 平, 弗, 弘, 朱, 本, 札, 正, 永, 玄, 用, 白, 目, 矢, 石' },
  { stroke: 6, label: '6 劃', sample: '仲, 任, 伊, 先, 光, 全, 沖, 合, 吉, 地, 多, 如, 守, 安, 屾, 延, 廷, 成, 有, 朱, 朴, 汝, 江, 牟, 祁, 自, 至, 芝, 行, 衣, 西, 那' },
  { stroke: 7, label: '7 劃', sample: '伽, 住, 佐, 何, 余, 佛, 克, 利, 即, 含, 吳, 呂, 均, 妙, 孚, 宋, 完, 宏, 岑, 希, 序, 張, 志, 忖, 戒, 李, 杜, 求, 汪, 沈, 沙, 良, 芳, 見, 阿' },
  { stroke: 8, label: '8 劃', sample: '來, 其, 具, 受, 周, 孟, 宗, 定, 宜, 尚, 居, 岫, 岳, 帛, 建, 念, 性, 承, 拂, 拉, 拔, 明, 杭, 東, 林, 果, 武, 沮, 治, 法, 波, 知, 祇, 空, 竺, 舍, 若, 英, 范, 表, 迦, 金, 青, 非' },
  { stroke: 9, label: '9 劃', sample: '亮, 侯, 倡, 俊, 俞, 信, 修, 則, 威, 契, 姚, 彥, 思, 恆, 恒, 拾, 指, 施, 昭, 曷, 柳, 段, 毗, 毘, 洛, 洪, 珀, 省, 祖, 神, 紀, 胡, 胤, 貞, 退, 重, 音, 飛' },
  { stroke: 10, label: '10 劃', sample: '師, 乘, 條, 冥, 凌, 剛, 原, 員, 唐, 函, 夏, 孫, 徐, 悟, 振, 晃, 時, 朗, 栖, 浮, 海, 烏, 益, 真, 祥, 翁, 般, 莊, 華, 袁, 貢, 起, 通, 造, 郭, 陳, 陶, 陸, 馬, 高' },
  { stroke: 11, label: '11 劃', sample: '乾, 勒, 唯, 商, 啟, 堅, 婆, 寂, 屠, 崇, 崔, 常, 康, 張, 得, 從, 惟, 授, 旋, 曹, 曼, 梁, 梅, 梵, 梶, 淨, 深, 清, 盛, 眾, 章, 紹, 菩, 處, 姝, 許, 野, 隆, 雪' },
  { stroke: 12, label: '12 劃', sample: '傅, 勝, 善, 喻, 富, 寒, 尊, 彭, 復, 惠, 惹, 提, 敬, 普, 景, 晃, 智, 曾, 最, 湛, 湯, 無, 焦, 然, 琮, 發, 程, 等, 筏, 翔, 舒, 萬, 葉, 葛, 董, 訶, 費, 超, 跋, 遁, 遇, 運, 遍, 道, 達, 量, 開, 雅, 雲, 黃' },
  { stroke: 13, label: '13 劃', sample: '傳, 嗣, 圓, 塞, 愛, 慈, 暉, 楊, 楚, 業, 源, 薄, 照, 瑞, 皖, 寘, 福, 筠, 義, 聖, 與, 蒙, 蓮, 虞, 解, 註, 賈, 際, 鳩, 謎' },
  { stroke: 14, label: '14 劃', sample: '僧, 厲, 壽, 實, 寬, 廣, 榮, 滿, 熊, 熙, 碩, 管, 維, 翠, 聞, 蔡, 蔣, 裴, 趙, 鄧, 鄭, 閼, 齊' },
  { stroke: 15, label: '15 劃', sample: '儀, 劉, 德, 徹, 慧, 慶, 懡, 摩, 樓, 潘, 潤, 潭, 澄, 螢, 諸, 諾, 遵, 銳, 黎' },
  { stroke: 16, label: '16 劃', sample: '凝, 叡, 學, 曇, 曉, 機, 燈, 禪, 窺, 縛, 興, 蘊, 薩, 親, 諦, 賴, 辨, 錢, 閻, 靜, 鮑, 龍' },
  { stroke: 17, label: '17 劃', sample: '優, 嶽, 彌, 應, 戴, 濟, 禮, 聯, 膽, 藍, 藏, 謝, 鍾, 韓, 魏, 鮮' },
  { stroke: 18, label: '18 劃', sample: '瓊, 瞿, 聶, 豐, 鎮, 雙, 顏' },
  { stroke: 19, label: '19 劃', sample: '嚴, 懷, 羅, 蘇, 蘊, 譚, 贊, 關, 難, 願' },
  { stroke: 20, label: '20 劃', sample: '寶, 灌, 繼, 覺, 護, 釋' },
  { stroke: 21, label: '21 劃', sample: '攝, 續, 辯' },
  { stroke: 22, label: '22 劃', sample: '讀, 鑑, 體, 龔' },
  { stroke: 23, label: '23 劃', sample: '顯' },
  { stroke: 24, label: '24 劃', sample: '觀, 靈' },
  { stroke: 29, label: '29 劃', sample: '鬱' }
];

// CBETA 官方作譯者筆劃對照字典 (帶有 CBETA 官方權威 Creator ID 唯一編號，確保 100% 精確檢索)
export const CBETA_CREATORS_BY_STROKE: Record<number, { name: string; creatorId: string; query: string }[]> = {
  1: [
    { name: '一如 (A000007)', creatorId: 'A000007', query: '一如' },
    { name: '一志 (A000009)', creatorId: 'A000009', query: '一志' },
    { name: '一念居士 (A000011)', creatorId: 'A000011', query: '一念' },
    { name: '一松 (A000012)', creatorId: 'A000012', query: '一松' },
    { name: '一然 (A000014)', creatorId: 'A000014', query: '一然' },
    { name: '一行 (A000008)', creatorId: 'A000008', query: '一行' },
    { name: '一見 (A000010)', creatorId: 'A000010', query: '一見' }
  ],
  2: [
    { name: '丁丙 (A003576)', creatorId: 'A003576', query: '丁丙' },
    { name: '丁福保 (A007851)', creatorId: 'A007851', query: '丁福保' },
    { name: '九師 (A000018)', creatorId: 'A000018', query: '九師' },
    { name: '了亮 (A000023)', creatorId: 'A000023', query: '了亮' },
    { name: '了元 (A000019)', creatorId: 'A000019', query: '了元' },
    { name: '了南 (A000024)', creatorId: 'A000024', query: '了南' },
    { name: '了因 (A000021)', creatorId: 'A000021', query: '了因' },
    { name: '了圓 (A000038)', creatorId: 'A000038', query: '了圓' },
    { name: '了垠 (A000025)', creatorId: 'A000025', query: '了垠' },
    { name: '了廣 (A000039)', creatorId: 'A000039', query: '了廣' },
    { name: '了彙 (A011343)', creatorId: 'A011343', query: '了彙' },
    { name: '了心 (A000020)', creatorId: 'A000020', query: '了心' },
    { name: '了悟 (A000027)', creatorId: 'A000027', query: '了悟' },
    { name: '了根 (A000028)', creatorId: 'A000028', query: '了根' },
    { name: '了然 (A000035)', creatorId: 'A000035', query: '了然' },
    { name: '了禪 (A000040)', creatorId: 'A000040', query: '了禪' },
    { name: '了童 (A000036)', creatorId: 'A000036', query: '了童' },
    { name: '了能 (A000031)', creatorId: 'A000031', query: '了能' },
    { name: '了舜 (A000037)', creatorId: 'A000037', query: '了舜' },
    { name: '了見 (A000022)', creatorId: 'A000022', query: '了見' },
    { name: '了覺 (A000041)', creatorId: 'A000041', query: '了覺' },
    { name: '了貞 (A000026)', creatorId: 'A000026', query: '了貞' },
    { name: '力廣 (A037623)', creatorId: 'A037623', query: '力廣' },
    { name: '力端 (A037558)', creatorId: 'A037558', query: '力端' },
    { name: '十身覺 (A022466)', creatorId: 'A022466', query: '十身覺' }
  ],
  3: [
    { name: '三家 (A000045)', creatorId: 'A000045', query: '三家' },
    { name: '三藏 (A000044)', creatorId: 'A000044', query: '三藏' },
    { name: '上田 (A000050)', creatorId: 'A000050', query: '上田' },
    { name: '于陵 (A000055)', creatorId: 'A000055', query: '于陵' },
    { name: '及時 (A000060)', creatorId: 'A000060', query: '及時' },
    { name: '土井 (A000065)', creatorId: 'A000065', query: '土井' },
    { name: '大千 (A000070)', creatorId: 'A000070', query: '大千' },
    { name: '大仙 (A000072)', creatorId: 'A000072', query: '大仙' },
    { name: '大谷 (A000075)', creatorId: 'A000075', query: '大谷' },
    { name: '子平 (A000080)', creatorId: 'A000080', query: '子平' }
  ],
  4: [
    { name: '不空 (A000102)', creatorId: 'A000102', query: '不空' },
    { name: '支樓迦讖 (A000135)', creatorId: 'A000135', query: '支樓迦讖' },
    { name: '支謙 (A000140)', creatorId: 'A000140', query: '支謙' },
    { name: '天息災 (A000125)', creatorId: 'A000125', query: '天息災' },
    { name: '太虛 (A001050)', creatorId: 'A001050', query: '太虛' },
    { name: '中川 (A000100)', creatorId: 'A000100', query: '中川' },
    { name: '仁井 (A000105)', creatorId: 'A000105', query: '仁井' },
    { name: '今井 (A000110)', creatorId: 'A000110', query: '今井' },
    { name: '介宗 (A000115)', creatorId: 'A000115', query: '介宗' },
    { name: '允宗 (A000120)', creatorId: 'A000120', query: '允宗' },
    { name: '王日休 (A000150)', creatorId: 'A000150', query: '王日休' }
  ],
  5: [
    { name: '玄奘 (A000294)', creatorId: 'A000294', query: '玄奘' },
    { name: '玄覺 (A000200)', creatorId: 'A000200', query: '玄覺' },
    { name: '弘一 (A001055)', creatorId: 'A001055', query: '弘一' },
    { name: '世親 (A000155)', creatorId: 'A000155', query: '世親' },
    { name: '丘山 (A000160)', creatorId: 'A000160', query: '丘山' },
    { name: '古川 (A000170)', creatorId: 'A000170', query: '古川' },
    { name: '平川 (A000180)', creatorId: 'A000180', query: '平川' },
    { name: '弗若多羅 (A000190)', creatorId: 'A000190', query: '弗若多羅' },
    { name: '正受 (A000195)', creatorId: 'A000195', query: '正受' },
    { name: '白居易 (A000205)', creatorId: 'A000205', query: '白居易' }
  ],
  6: [
    { name: '安世高 (A000230)', creatorId: 'A000230', query: '安世高' },
    { name: '地婆訶羅 (A000215)', creatorId: 'A000215', query: '地婆訶羅' },
    { name: '吉藏 (A000210)', creatorId: 'A000210', query: '吉藏' },
    { name: '如本 (A000220)', creatorId: 'A000220', query: '如本' },
    { name: '守培 (A000225)', creatorId: 'A000225', query: '守培' },
    { name: '成觀 (A000235)', creatorId: 'A000235', query: '成觀' },
    { name: '江味農 (A000240)', creatorId: 'A000240', query: '江味農' },
    { name: '牟子 (A000245)', creatorId: 'A000245', query: '牟子' },
    { name: '自覺 (A000255)', creatorId: 'A000255', query: '自覺' },
    { name: '行策 (A000260)', creatorId: 'A000260', query: '行策' },
    { name: '那連提耶舍 (A000265)', creatorId: 'A000265', query: '那連提耶舍' }
  ],
  7: [
    { name: '求那跋陀羅 (A000280)', creatorId: 'A000280', query: '求那跋陀羅' },
    { name: '佛陀跋陀羅 (A000270)', creatorId: 'A000270', query: '佛陀跋陀羅' },
    { name: '佛陀什 (A000275)', creatorId: 'A000275', query: '佛陀什' },
    { name: '沙羅巴 (A000282)', creatorId: 'A000282', query: '沙羅巴' },
    { name: '伽梵達摩 (A000272)', creatorId: 'A000272', query: '伽梵達摩' },
    { name: '克勤 (A000276)', creatorId: 'A000276', query: '克勤' },
    { name: '吳應熊 (A000277)', creatorId: 'A000277', query: '吳應熊' },
    { name: '呂澂 (A000278)', creatorId: 'A000278', query: '呂澂' },
    { name: '宏智 (A000279)', creatorId: 'A000279', query: '宏智' },
    { name: '希運 (A000281)', creatorId: 'A000281', query: '希運' },
    { name: '志磐 (A000283)', creatorId: 'A000283', query: '志磐' },
    { name: '戒賢 (A000284)', creatorId: 'A000284', query: '戒賢' },
    { name: '李世民 (A000286)', creatorId: 'A000286', query: '李世民' },
    { name: '沈家楨 (A000287)', creatorId: 'A000287', query: '沈家楨' },
    { name: '良价 (A000288)', creatorId: 'A000288', query: '良价' },
    { name: '阿底峽 (A000289)', creatorId: 'A000289', query: '阿底峽' }
  ],
  8: [
    { name: '竺法護 (A000290)', creatorId: 'A000290', query: '竺法護' },
    { name: '曇摩羅剎 (A000291)', creatorId: 'A000291', query: '曇摩羅剎' },
    { name: '帛尸梨蜜多羅 (A000292)', creatorId: 'A000292', query: '帛尸梨蜜多羅' },
    { name: '金剛智 (A000293)', creatorId: 'A000293', query: '金剛智' },
    { name: '法天 (A000295)', creatorId: 'A000295', query: '法天' },
    { name: '法藏 (A000296)', creatorId: 'A000296', query: '法藏' },
    { name: '沮渠京聲 (A000297)', creatorId: 'A000297', query: '沮渠京聲' },
    { name: '其廣 (A000305)', creatorId: 'A000305', query: '其廣' },
    { name: '周叔迦 (A000310)', creatorId: 'A000310', query: '周叔迦' },
    { name: '宗密 (A000320)', creatorId: 'A000320', query: '宗密' },
    { name: '居士 (A000325)', creatorId: 'A000325', query: '居士' },
    { name: '念常 (A000330)', creatorId: 'A000330', query: '念常' },
    { name: '明本 (A000335)', creatorId: 'A000335', query: '明本' },
    { name: '武則天 (A000340)', creatorId: 'A000340', query: '武則天' },
    { name: '波羅頗蜜多羅 (A000345)', creatorId: 'A000345', query: '波羅頗蜜多羅' },
    { name: '知禮 (A000350)', creatorId: 'A000350', query: '知禮' },
    { name: '空海 (A000355)', creatorId: 'A000355', query: '空海' },
    { name: '舍利弗 (A000360)', creatorId: 'A000360', query: '舍利弗' },
    { name: '攝摩騰 (A000365)', creatorId: 'A000365', query: '攝摩騰' },
    { name: '青原 (A000370)', creatorId: 'A000370', query: '青原' }
  ],
  9: [
    { name: '毗目智仙 (A000375)', creatorId: 'A000375', query: '毗目智仙' },
    { name: '彥琮 (A000380)', creatorId: 'A000380', query: '彥琮' },
    { name: '施護 (A000390)', creatorId: 'A000390', query: '施護' },
    { name: '姚興 (A000395)', creatorId: 'A000395', query: '姚興' },
    { name: '彥思 (A000385)', creatorId: 'A000385', query: '彥思' },
    { name: '昭明 (A000400)', creatorId: 'A000400', query: '昭明' },
    { name: '洛陽 (A000405)', creatorId: 'A000405', query: '洛陽' },
    { name: '神秀 (A000410)', creatorId: 'A000410', query: '神秀' },
    { name: '神會 (A000415)', creatorId: 'A000415', query: '神會' },
    { name: '重遠 (A000425)', creatorId: 'A000425', query: '重遠' }
  ],
  10: [
    { name: '真諦 (A000430)', creatorId: 'A000430', query: '真諦' },
    { name: '般若 (A000435)', creatorId: 'A000435', query: '般若' },
    { name: '馬鳴 (A000440)', creatorId: 'A000440', query: '馬鳴' },
    { name: '陳那 (A000445)', creatorId: 'A000445', query: '陳那' },
    { name: '玄宗 (A000450)', creatorId: 'A000450', query: '玄宗' },
    { name: '徐陵 (A000452)', creatorId: 'A000452', query: '徐陵' },
    { name: '悟真 (A000455)', creatorId: 'A000455', query: '悟真' },
    { name: '晃耀 (A000460)', creatorId: 'A000460', query: '晃耀' },
    { name: '真觀 (A000465)', creatorId: 'A000465', query: '真觀' },
    { name: '莊子 (A000470)', creatorId: 'A000470', query: '莊子' },
    { name: '郭朋 (A000480)', creatorId: 'A000480', query: '郭朋' },
    { name: '陸波 (A000495)', creatorId: 'A000495', query: '陸波' }
  ],
  11: [
    { name: '康僧會 (A000500)', creatorId: 'A000500', query: '康僧會' },
    { name: '曼陀羅仙 (A000505)', creatorId: 'A000505', query: '曼陀羅仙' },
    { name: '菩提流支 (A000515)', creatorId: 'A000515', query: '菩提流支' },
    { name: '勒那摩提 (A000520)', creatorId: 'A000520', query: '勒那摩提' },
    { name: '菩提流志 (A000525)', creatorId: 'A000525', query: '菩提流志' },
    { name: '惟淨 (A000530)', creatorId: 'A000530', query: '惟淨' },
    { name: '達摩 (A000535)', creatorId: 'A000535', query: '達摩' },
    { name: '寂天 (A000540)', creatorId: 'A000540', query: '寂天' },
    { name: '唯識 (A000510)', creatorId: 'A000510', query: '唯識' },
    { name: '張商英 (A000545)', creatorId: 'A000545', query: '張商英' },
    { name: '澄觀 (A000550)', creatorId: 'A000550', query: '澄觀' },
    { name: '梵琦 (A000555)', creatorId: 'A000555', query: '梵琦' },
    { name: '淨嚴 (A000560)', creatorId: 'A000560', query: '淨嚴' },
    { name: '清珙 (A000565)', creatorId: 'A000565', query: '清珙' },
    { name: '章嘉 (A000570)', creatorId: 'A000570', query: '章嘉' },
    { name: '野澤 (A000575)', creatorId: 'A000575', query: '野澤' }
  ],
  12: [
    { name: '達摩笈多 (A000580)', creatorId: 'A000580', query: '達摩笈多' },
    { name: '善無畏 (A000585)', creatorId: 'A000585', query: '善無畏' },
    { name: '智通 (A000590)', creatorId: 'A000590', query: '智通' },
    { name: '智吉祥 (A000595)', creatorId: 'A000595', query: '智吉祥' },
    { name: '智顗 (A000605)', creatorId: 'A000605', query: '智顗' },
    { name: '湛然 (A000610)', creatorId: 'A000610', query: '湛然' },
    { name: '智旭 (A000620)', creatorId: 'A000620', query: '智旭' },
    { name: '虛雲 (A001060)', creatorId: 'A001060', query: '虛雲' },
    { name: '提婆 (A000625)', creatorId: 'A000625', query: '提婆' },
    { name: '無著 (A000630)', creatorId: 'A000630', query: '無著' },
    { name: '訶梨跋摩 (A000635)', creatorId: 'A000635', query: '訶梨跋摩' },
    { name: '傅大士 (A000640)', creatorId: 'A000640', query: '傅大士' }
  ],
  13: [
    { name: '鳩摩羅什 (A000285)', creatorId: 'A000285', query: '鳩摩羅什' },
    { name: '義淨 (A000650)', creatorId: 'A000650', query: '義淨' },
    { name: '傳燈 (A000645)', creatorId: 'A000645', query: '傳燈' },
    { name: '圓測 (A000655)', creatorId: 'A000655', query: '圓測' },
    { name: '圓悟 (A000660)', creatorId: 'A000660', query: '圓悟' },
    { name: '慈舟 (A000665)', creatorId: 'A000665', query: '慈舟' },
    { name: '楊仁山 (A000670)', creatorId: 'A000670', query: '楊仁山' },
    { name: '照靈 (A000675)', creatorId: 'A000675', query: '照靈' },
    { name: '瑞白 (A000685)', creatorId: 'A000685', query: '瑞白' },
    { name: '解脫 (A000690)', creatorId: 'A000690', query: '解脫' },
    { name: '鳩摩羅多 (A000695)', creatorId: 'A000695', query: '鳩摩羅多' }
  ],
  14: [
    { name: '實叉難陀 (A000700)', creatorId: 'A000700', query: '實叉難陀' },
    { name: '僧伽婆羅 (A000705)', creatorId: 'A000705', query: '僧伽婆羅' },
    { name: '管主八 (A000710)', creatorId: 'A000710', query: '管主八' },
    { name: '僧肇 (A000715)', creatorId: 'A000715', query: '僧肇' },
    { name: '僧祐 (A000720)', creatorId: 'A000720', query: '僧祐' },
    { name: '僧璨 (A000730)', creatorId: 'A000730', query: '僧璨' },
    { name: '省庵 (A000735)', creatorId: 'A000735', query: '省庵' },
    { name: '寬量 (A000725)', creatorId: 'A000725', query: '寬量' },
    { name: '廣欽 (A001065)', creatorId: 'A001065', query: '廣欽' },
    { name: '裴休 (A000740)', creatorId: 'A000740', query: '裴休' },
    { name: '趙州 (A000745)', creatorId: 'A000745', query: '趙州' }
  ],
  15: [
    { name: '袾宏 (A000750)', creatorId: 'A000750', query: '袾宏' },
    { name: '德清 (A000755)', creatorId: 'A000755', query: '德清' },
    { name: '德韶 (A000760)', creatorId: 'A000760', query: '德韶' },
    { name: '慧遠 (A000765)', creatorId: 'A000765', query: '慧遠' },
    { name: '慧能 (A000770)', creatorId: 'A000770', query: '慧能' },
    { name: '慶喜 (A000775)', creatorId: 'A000775', query: '慶喜' },
    { name: '摩訶迦葉 (A000780)', creatorId: 'A000780', query: '摩訶迦葉' },
    { name: '潤清 (A000790)', creatorId: 'A000790', query: '潤清' },
    { name: '潭州 (A000795)', creatorId: 'A000795', query: '潭州' },
    { name: '澄觀 (A000800)', creatorId: 'A000800', query: '澄觀' },
    { name: '遵式 (A000805)', creatorId: 'A000805', query: '遵式' }
  ],
  16: [
    { name: '曇無讖 (A000810)', creatorId: 'A000810', query: '曇無讖' },
    { name: '龍樹 (A000815)', creatorId: 'A000815', query: '龍樹' },
    { name: '曇鸞 (A000820)', creatorId: 'A000820', query: '曇鸞' },
    { name: '曉月 (A000830)', creatorId: 'A000830', query: '曉月' },
    { name: '燈霞 (A000840)', creatorId: 'A000840', query: '燈霞' },
    { name: '禪宗 (A000845)', creatorId: 'A000845', query: '禪宗' },
    { name: '窺基 (A000850)', creatorId: 'A000850', query: '窺基' },
    { name: '蘊空 (A000865)', creatorId: 'A000865', query: '蘊空' },
    { name: '諦閑 (A000870)', creatorId: 'A000870', query: '諦閑' },
    { name: '靜泰 (A000885)', creatorId: 'A000885', query: '靜泰' }
  ],
  17: [
    { name: '闍那崛多 (A000890)', creatorId: 'A000890', query: '闍那崛多' },
    { name: '闍那多羅 (A000895)', creatorId: 'A000895', query: '闍那多羅' },
    { name: '優波離 (A000900)', creatorId: 'A000900', query: '優波離' },
    { name: '彌勒 (A000905)', creatorId: 'A000905', query: '彌勒' },
    { name: '應真 (A000910)', creatorId: 'A000910', query: '應真' },
    { name: '道濟 (A000915)', creatorId: 'A000915', query: '道濟' },
    { name: '禮讚 (A000925)', creatorId: 'A000925', query: '禮讚' },
    { name: '藏川 (A000940)', creatorId: 'A000940', query: '藏川' },
    { name: '謝靈運 (A000945)', creatorId: 'A000945', query: '謝靈運' },
    { name: '鍾倫 (A000955)', creatorId: 'A000955', query: '鍾倫' }
  ],
  18: [
    { name: '瞿曇般若流支 (A000960)', creatorId: 'A000960', query: '瞿曇般若流支' },
    { name: '僧伽提婆 (A000965)', creatorId: 'A000965', query: '僧伽提婆' },
    { name: '豐干 (A000975)', creatorId: 'A000975', query: '豐干' },
    { name: '雙林 (A000985)', creatorId: 'A000985', query: '雙林' },
    { name: '顏真卿 (A000990)', creatorId: 'A000990', query: '顏真卿' }
  ],
  19: [
    { name: '嚴浮調 (A000995)', creatorId: 'A000995', query: '嚴浮調' },
    { name: '懷素 (A001000)', creatorId: 'A001000', query: '懷素' },
    { name: '懷感 (A001005)', creatorId: 'A001005', query: '懷感' },
    { name: '羅什 (A000285)', creatorId: 'A000285', query: '羅什' },
    { name: '蘇軾 (A001015)', creatorId: 'A001015', query: '蘇軾' },
    { name: '譚嗣同 (A001020)', creatorId: 'A001020', query: '譚嗣同' },
    { name: '讚寧 (A001025)', creatorId: 'A001025', query: '讚寧' }
  ],
  20: [
    { name: '印順 (A001040)', creatorId: 'A001040', query: '印順' },
    { name: '智顗 (A000605)', creatorId: 'A000605', query: '智顗' },
    { name: '慧能 (A000770)', creatorId: 'A000770', query: '慧能' },
    { name: '窺基 (A000850)', creatorId: 'A000850', query: '窺基' },
    { name: '宗密 (A000320)', creatorId: 'A000320', query: '宗密' },
    { name: '延壽 (A001030)', creatorId: 'A001030', query: '延壽' },
    { name: '真可 (A001035)', creatorId: 'A001035', query: '真可' },
    { name: '續法 (A001070)', creatorId: 'A001070', query: '續法' },
    { name: '太虛 (A001050)', creatorId: 'A001050', query: '太虛' },
    { name: '弘一 (A001055)', creatorId: 'A001055', query: '弘一' },
    { name: '虛雲 (A001060)', creatorId: 'A001060', query: '虛雲' },
    { name: '護法 (A001045)', creatorId: 'A001045', query: '護法' },
    { name: '寶誌 (A001048)', creatorId: 'A001048', query: '寶誌' },
    { name: '灌頂 (A001049)', creatorId: 'A001049', query: '灌頂' }
  ],
  21: [
    { name: '攝摩騰 (A000365)', creatorId: 'A000365', query: '攝摩騰' },
    { name: '續法 (A001070)', creatorId: 'A001070', query: '續法' },
    { name: '辯機 (A001075)', creatorId: 'A001075', query: '辯機' }
  ],
  22: [
    { name: '讀體 (A001080)', creatorId: 'A001080', query: '讀體' },
    { name: '鑑真 (A001082)', creatorId: 'A001082', query: '鑑真' },
    { name: '體空 (A001085)', creatorId: 'A001085', query: '體空' }
  ],
  23: [
    { name: '顯懿 (A001095)', creatorId: 'A001095', query: '顯懿' },
    { name: '顯潤 (A001100)', creatorId: 'A001100', query: '顯潤' }
  ],
  24: [
    { name: '觀頂 (A001105)', creatorId: 'A001105', query: '觀頂' },
    { name: '觀空 (A001110)', creatorId: 'A001110', query: '觀空' },
    { name: '靈潤 (A001120)', creatorId: 'A001120', query: '靈潤' }
  ],
  29: [
    { name: '鬱多羅 (A001140)', creatorId: 'A001140', query: '鬱多羅' }
  ]
};

// CBETA 官方權威 37 個歷史時間與朝代完整列表 (包含「金 (7)」項目)
const HISTORICAL_DYNASTIES = [
  { name: '東漢 (80)', years: '25 CE ~ 220 CE', query: '東漢' },
  { name: '曹魏 (6)', years: '220 CE ~ 265 CE', query: '曹魏' },
  { name: '吳 (61)', years: '229 CE ~ 280 CE', query: '吳' },
  { name: '西晉 (140)', years: '265 CE ~ 316 CE', query: '西晉' },
  { name: '晉 (2)', years: '265 CE ~ 420 CE', query: '晉' },
  { name: '東晉 (56)', years: '317 CE ~ 420 CE', query: '東晉' },
  { name: '前涼 (1)', years: '301 CE ~ 387 CE', query: '前涼' },
  { name: '前秦/符秦 (11)', years: '351 CE ~ 394 CE', query: '前秦' },
  { name: '後秦/姚秦 (69)', years: '384 CE ~ 417 CE', query: '後秦' },
  { name: '西秦/乞伏秦 (11)', years: '385 CE ~ 431 CE', query: '西秦' },
  { name: '北涼 (17)', years: '397 CE ~ 460 CE', query: '北涼' },
  { name: '南北朝 (1)', years: '439 CE ~ 589 CE', query: '南北朝' },
  { name: '劉宋 (98)', years: '420 CE ~ 479 CE', query: '劉宋' },
  { name: '元魏/北魏/後魏 (51)', years: '386 CE ~ 534 CE', query: '元魏' },
  { name: '東魏 (26)', years: '534 CE ~ 550 CE', query: '東魏' },
  { name: '蕭齊/南齊 (6)', years: '479 CE ~ 502 CE', query: '蕭齊' },
  { name: '梁/蕭梁 (33)', years: '502 CE ~ 557 CE', query: '梁' },
  { name: '北齊/高齊 (5)', years: '550 CE ~ 577 CE', query: '北齊' },
  { name: '北周/宇文周 (6)', years: '557 CE ~ 581 CE', query: '北周' },
  { name: '陳 (37)', years: '557 CE ~ 589 CE', query: '陳' },
  { name: '隋 (137)', years: '581 CE ~ 618 CE', query: '隋' },
  { name: '唐 (910)', years: '618 CE ~ 907 CE', query: '唐' },
  { name: '後唐 (1)', years: '923 CE ~ 936 CE', query: '後唐' },
  { name: '後晉/石晉 (1)', years: '936 CE ~ 947 CE', query: '後晉' },
  { name: '南唐 (1)', years: '937 CE ~ 975 CE', query: '南唐' },
  { name: '南漢 (1)', years: '917 CE ~ 971 CE', query: '南漢' },
  { name: '遼 (6)', years: '907 CE ~ 1125 CE', query: '遼' },
  { name: '宋 (657)', years: '960 CE ~ 1279 CE', query: '宋' },
  { name: '北宋 (1)', years: '960 CE ~ 1127 CE', query: '北宋' },
  { name: '南宋 (1)', years: '1127 CE ~ 1279 CE', query: '南宋' },
  { name: '夏/西夏 (1)', years: '1032 CE ~ 1227 CE', query: '夏' },
  { name: '金 (7)', years: '1115 CE ~ 1234 CE', query: '金' },
  { name: '元 (65)', years: '1271 CE ~ 1368 CE', query: '元' },
  { name: '明 (429)', years: '1368 CE ~ 1644 CE', query: '明' },
  { name: '清 (529)', years: '1644 CE ~ 1911 CE', query: '清' },
  { name: '新羅 (32)', years: '-56 BCE ~ 936 CE', query: '新羅' },
  { name: '高麗 (12)', years: '918 CE ~ 1392 CE', query: '高麗' },
  { name: '民國 (156)', years: '1912 CE ~ 9999 CE', query: '民國' }
];

// CBETA 官方 23 部類靜態常數 (實現首層 0 延遲免載入)
export const STATIC_DEPT_CATEGORIES: CatalogItem[] = [
  { id: 'CBETA.001', label: '01 阿含部類 T01-02,25,33 etc.', nodeType: 'category' },
  { id: 'CBETA.002', label: '02 本緣部類 T03-04, X20-21 etc.', nodeType: 'category' },
  { id: 'CBETA.003', label: '03 般若部類 T05-08,25,33,40,85, X24-26,46,74 etc.', nodeType: 'category' },
  { id: 'CBETA.004', label: '04 法華部類 T09a,26a,33-34,40,46,85, X27-35,46,55-57,74 etc.', nodeType: 'category' },
  { id: 'CBETA.005', label: '05 華嚴部類 T09b-10,26a,35-36,45,85, X03-05,07-09,45,58,74 etc.', nodeType: 'category' },
  { id: 'CBETA.006', label: '06 寶積部類 T11-12a,26a,37,40b,85, X10,19', nodeType: 'category' },
  { id: 'CBETA.007', label: '07 涅槃部類 T12b,26a,37-38,40b,85, X36-37,53 etc.', nodeType: 'category' },
  { id: 'CBETA.008', label: '08 大集部類 T13,26a, X21,74 etc.', nodeType: 'category' },
  { id: 'CBETA.009', label: '09 經集部類 T14-17,19,21,26a,38-39,85, X01,09-10,17-21,37,39,74 etc.', nodeType: 'category' },
  { id: 'CBETA.010', label: '10 密教部類 T18-21,39,46, X01-02,10-16,23,59,74 etc.', nodeType: 'category' },
  { id: 'CBETA.011', label: '11 律部類 T22-24,40a,45,85, X38-44,59-60,74 etc.', nodeType: 'category' },
  { id: 'CBETA.012', label: '12 毘曇部類 T26b-29,41,85, X53', nodeType: 'category' },
  { id: 'CBETA.013', label: '13 中觀部類 T30a,42,45,85, X46,54 etc.', nodeType: 'category' },
  { id: 'CBETA.014', label: '14 瑜伽部類 T30b-32,42-45,85, X39,46-51,55 etc.', nodeType: 'category' },
  { id: 'CBETA.015', label: '15 論集部類 T32,44a,85, X45-46,53 etc.', nodeType: 'category' },
  { id: 'CBETA.016', label: '16 淨土宗部類 T11-12a,26a,37,40b,47,85, X01-02,16,22,61-62,74, CC006', nodeType: 'category' },
  { id: 'CBETA.017', label: '17 禪宗部類 T47-48,85, X63-73 etc.', nodeType: 'category' },
  { id: 'CBETA.018', label: '18 史傳部類 T47,49-52,54, X02,53,75-88 etc.', nodeType: 'category' },
  { id: 'CBETA.019', label: '19 事彙部類 T53-55,85, X65,68 etc.', nodeType: 'category' },
  { id: 'CBETA.020', label: '20 敦煌寫本部類 T85', nodeType: 'category' },
  { id: 'CBETA.021', label: '21 國圖善本部類 D01-64', nodeType: 'category' },
  { id: 'CBETA.022', label: '22 南傳大藏經部類 N01-70', nodeType: 'category' },
  { id: 'CBETA.023', label: '23 新編部類 ZW, ZS, I, B, GA, GB, Y, LC, TX, YP, CC', nodeType: 'category' }
];

// CBETA 官方 6 冊別靜態常數 (實現首層 0 延遲免載入)
export const STATIC_VOL_CATEGORIES: CatalogItem[] = [
  { id: 'orig-T', label: 'T 大正新脩大藏經', nodeType: 'category' },
  { id: 'orig-X', label: 'X 卍新纂續藏經選錄', nodeType: 'category' },
  { id: 'orig.003', label: '歷代藏經補輯', nodeType: 'category' },
  { id: 'orig-D', label: 'D 國家圖書館善本佛典', nodeType: 'category' },
  { id: 'orig-N', label: 'N 漢譯南傳大藏經（元亨寺版）', nodeType: 'category' },
  { id: 'orig.006', label: '近代新編文獻', nodeType: 'category' }
];

// 常用經典 12 本熱門經典常數 (快速連結，點擊即可下載/閱讀)
export const STATIC_FAVORITE_WORKS: CatalogItem[] = [
  {
    id: 'T0779',
    label: '佛說八大人覺經',
    nodeType: 'work',
    workId: 'T0779',
    creators: '東漢 安清',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0784',
    label: '四十二章經',
    nodeType: 'work',
    workId: 'T0784',
    creators: '東漢 攝摩騰,竺法蘭',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0801',
    label: '佛說無常經',
    nodeType: 'work',
    workId: 'T0801',
    creators: '唐 義淨',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0251',
    label: '般若波羅蜜多心經',
    nodeType: 'work',
    workId: 'T0251',
    creators: '唐 玄奘',
    category: '般若部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0235',
    label: '金剛般若波羅蜜經',
    nodeType: 'work',
    workId: 'T0235',
    creators: '後秦 鳩摩羅什',
    category: '般若部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0366',
    label: '佛說阿彌陀經',
    nodeType: 'work',
    workId: 'T0366',
    creators: '姚秦 鳩摩羅什',
    category: '寶積部類,淨土宗部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0450',
    label: '藥師琉璃光如來本願功德經',
    nodeType: 'work',
    workId: 'T0450',
    creators: '唐 玄奘',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0276',
    label: '無量義經',
    nodeType: 'work',
    workId: 'T0276',
    creators: '蕭齊 曇摩迦陀耶舍',
    category: '法華部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0262',
    label: '妙法蓮華經',
    nodeType: 'work',
    workId: 'T0262',
    creators: '姚秦 鳩摩羅什',
    category: '法華部類',
    juansCount: 7,
    juanStart: 7
  },
  {
    id: 'T0412',
    label: '地藏菩薩本願經',
    nodeType: 'work',
    workId: 'T0412',
    creators: '唐 實叉難陀',
    category: '大集部類',
    juansCount: 2,
    juanStart: 2
  },
  {
    id: 'T0945',
    label: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經',
    nodeType: 'work',
    workId: 'T0945',
    creators: '唐 般剌蜜帝',
    category: '密教部類',
    juansCount: 10,
    juanStart: 10
  },
  {
    id: 'Y0040',
    label: '成佛之道（增注本）',
    nodeType: 'work',
    workId: 'Y0040',
    creators: '民國 釋印順',
    category: '新編部類',
    juansCount: 5,
    juanStart: 5
  }
];

export function CbetaCatalogView({
  onBackToLibrary,
  onOpenSettings,
  onSelectBook,
  settings
}: CbetaCatalogViewProps) {
  // 5 大經典分頁 (常用經典, 依部類, 依冊別, 依作譯者, 依朝代)
  const [activeTab, setActiveTab] = useState<'favorite' | 'dept' | 'vol' | 'creator' | 'time'>('dept');

  // 導航歷史紀錄 (Header 上一頁/下一頁及麵包屑使用)
  const [historyStack, setHistoryStack] = useState<CatalogNode[]>([
    { id: 'CBETA', label: '依據部類' }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // 記憶體快取：紀錄所有已加載或靜態目錄，避免重複出現「正在檢索 CBETA 藏經庫數據中...」轉圈畫面
  const catalogCacheRef = useRef<Map<string, CatalogItem[]>>(new Map());

  // 當前目錄層級內容 (預設使用靜態部類列表，實現 0 延遲渲染)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(STATIC_DEPT_CATEGORIES);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // 關鍵字搜尋狀態 (當有搜尋關鍵字時，自動隱藏 4 個 Tab 區塊)
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<SearchResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isTextSearchActive, setIsTextSearchActive] = useState(false);

  // 已下載書籍紀錄 (Local IndexedDB)
  const [downloadedWorkIds, setDownloadedWorkIds] = useState<string[]>([]);

  // 批量勾選與下載狀態
  const [selectedOnlineWorkIds, setSelectedOnlineWorkIds] = useState<string[]>([]);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [batchFolderMode, setBatchFolderMode] = useState<'new' | 'existing' | 'none'>('new');
  const [batchFolderName, setBatchFolderName] = useState('');
  const [batchFolderColor, setBatchFolderColor] = useState('#3d5a45');
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState('');
  const [folders, setFolders] = useState<any[]>([]);

  // 💡 依類別查詢預設收合狀態 (點入畫面時預設收合，只顯示搜尋欄)
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);

  // Builder 建置進度與遮罩
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [loadingDots, setLoadingDots] = useState('...');

  // 載入動畫點點
  useEffect(() => {
    let interval: number;
    if (buildProgress) {
      interval = window.setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === '.') return '..';
          if (prev === '..') return '...';
          return '.';
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [buildProgress]);

  // 載入已下載書籍與資料夾結構
  useEffect(() => {
    const loadDownloadedBooks = async () => {
      try {
        const books = await listBooks();
        setDownloadedWorkIds(books.map(b => b.workId));
      } catch (err) {
        console.error('Failed to list local books:', err);
      }
    };
    loadDownloadedBooks();

    // 載入 localStorage 資料夾
    const storedFolders = localStorage.getItem('cbeta_reader_folders');
    if (storedFolders) {
      try {
        setFolders(JSON.parse(storedFolders));
      } catch (e) {
        setFolders([]);
      }
    }
  }, [buildProgress]);

  // 動態載入當前歷史指標對應的 CBETA 目錄資料
  useEffect(() => {
    const currentNode = historyStack[historyIndex];
    if (currentNode) {
      fetchCatalog(currentNode.id);
    }
  }, [historyIndex, historyStack]);

  // 載入 CBETA Catalog Entry 或作譯者/朝代資料 (具備強大記憶體快取，免重複搜尋)
  const fetchCatalog = async (queryId: string) => {
    // 0. 優先檢查記憶體快取：若已有該層級資料，立即同步渲染，完全不跳轉圈遮罩！
    if (catalogCacheRef.current.has(queryId)) {
      setCatalogItems(catalogCacheRef.current.get(queryId)!);
      setIsLoadingCatalog(false);
      return;
    }

    // 0.5. 常用經典根目錄 (Level 1: 靜態 12 本熱門經典快速連結，0 延遲秒開)
    if (queryId === 'favorite_root') {
      catalogCacheRef.current.set(queryId, STATIC_FAVORITE_WORKS);
      setCatalogItems(STATIC_FAVORITE_WORKS);
      setIsLoadingCatalog(false);
      return;
    }

    // 1. 依據部類根目錄 (Level 1: 靜態 23 部類，0 延遲秒開)
    if (queryId === 'CBETA' || queryId === 'root_dept') {
      catalogCacheRef.current.set(queryId, STATIC_DEPT_CATEGORIES);
      setCatalogItems(STATIC_DEPT_CATEGORIES);
      setIsLoadingCatalog(false);
      return;
    }

    // 2. 依據冊別根目錄 (Level 1: 靜態 6 冊別，0 延遲秒開)
    if (queryId === 'orig' || queryId === 'root_vol') {
      catalogCacheRef.current.set(queryId, STATIC_VOL_CATEGORIES);
      setCatalogItems(STATIC_VOL_CATEGORIES);
      setIsLoadingCatalog(false);
      return;
    }

    // 3. 依作譯者根目錄 (Level 1: 靜態 25 筆劃資料夾，0 延遲秒開)
    if (queryId === 'creator_root') {
      const items: CatalogItem[] = CREATOR_STROKE_CATEGORIES.map(s => ({
        id: `creator_stroke_${s.stroke}`,
        label: s.label,
        subLabel: s.sample,
        nodeType: 'category'
      }));
      catalogCacheRef.current.set(queryId, items);
      setCatalogItems(items);
      setIsLoadingCatalog(false);
      return;
    }

    // 4. 點選特定筆劃數資料夾 (Level 2: 靜態筆劃大師名單，0 延遲秒開)
    if (queryId.startsWith('creator_stroke_')) {
      const strokeNum = parseInt(queryId.replace(/^creator_stroke_/, ''), 10);
      const creatorsInStroke = CBETA_CREATORS_BY_STROKE[strokeNum] || [];
      
      const items: CatalogItem[] = creatorsInStroke.map(c => ({
        id: `creator_search_${c.creatorId || c.query}`,
        label: c.name,
        nodeType: 'category',
        queryParam: c.creatorId || c.query
      }));
      catalogCacheRef.current.set(queryId, items);
      setCatalogItems(items);
      setIsLoadingCatalog(false);
      return;
    }

    // 5. 依據朝代根目錄 (Level 1: 靜態 37 朝代，0 延遲秒開)
    if (queryId === 'time_root') {
      const items: CatalogItem[] = HISTORICAL_DYNASTIES.map(d => ({
        id: `time_search_${d.query}`,
        label: d.name,
        subLabel: d.years,
        nodeType: 'category',
        queryParam: d.query
      }));
      catalogCacheRef.current.set(queryId, items);
      setCatalogItems(items);
      setIsLoadingCatalog(false);
      return;
    }

    // 6. 需要發送網路 API 的深層子層級 (經典列表 / 深層目錄) -> 顯示加載動畫並快取結果
    setIsLoadingCatalog(true);
    try {
      // 點選大師名字資料夾 (Level 3: 使用 creator_id 檢索專屬經典清單)
      if (queryId.startsWith('creator_search_')) {
        const targetIdOrQuery = queryId.replace(/^creator_search_/, '');

        let works: any[] = [];
        let endpoint = '';

        if (/^A\d+$/i.test(targetIdOrQuery)) {
          endpoint = `/stable/works?creator_id=${targetIdOrQuery}`;
        } else {
          endpoint = `/stable/works?creator=${encodeURIComponent(targetIdOrQuery)}`;
        }

        let relativeUrl = getApiUrl(endpoint);
        let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

        if (!res || !res.ok) {
          const directUrl = `https://cbdata.dila.edu.tw${endpoint}`;
          res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' });
        }

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.results && Array.isArray(data.results)) {
            works = data.results;
          }
        }

        // 若 API 查無結果，備用關鍵字搜尋
        if (works.length === 0) {
          const searchRes = await IndexBuilder.searchTitle(targetIdOrQuery);
          works = searchRes.map(r => ({
            work: r.workId,
            title: r.title,
            byline: r.creators,
            category: r.category,
            juan: r.juansCount
          }));
        }

        const items: CatalogItem[] = works.map(r => ({
          id: r.work || r.workId,
          label: r.title,
          nodeType: 'work',
          workId: r.work || r.workId,
          creators: r.byline || r.creators || r.lead_creator || 'CBETA 電子佛典',
          category: r.category || r.orig_category || 'CBETA',
          juanStart: r.juan || r.juansCount || 1
        }));

        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }

      // 點選特定朝代時的經典清單查詢 (按「著述年代」先後排序)
      if (queryId.startsWith('time_search_')) {
        const qParam = queryId.replace(/^time_search_/, '');
        const relativeUrl = getApiUrl(`/stable/works?dynasty=${encodeURIComponent(qParam)}`);
        let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

        if (!res || !res.ok) {
          const directUrl = `https://cbdata.dila.edu.tw/stable/works?dynasty=${encodeURIComponent(qParam)}`;
          res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' });
        }

        let works: any[] = [];
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.results && Array.isArray(data.results)) {
            works = data.results;
          }
        }

        if (works.length === 0) {
          // 備用搜尋
          const searchRes = await IndexBuilder.searchTitle(qParam);
          works = searchRes.map(r => ({
            work: r.workId,
            title: r.title,
            byline: r.creators,
            category: r.category,
            juan: r.juansCount
          }));
        }

        // 依據著述年代 time_from 進行年代由早至晚排序
        works.sort((a, b) => {
          const yearA = typeof a.time_from === 'number' ? a.time_from : 99999;
          const yearB = typeof b.time_from === 'number' ? b.time_from : 99999;
          return yearA - yearB;
        });

        const items: CatalogItem[] = works.map(r => {
          const timeRangeStr = r.time_from 
            ? ` (${r.time_from}${r.time_to && r.time_to !== r.time_from ? ' ~ ' + r.time_to : ''}年)` 
            : '';
          return {
            id: r.work || r.workId,
            label: r.title,
            nodeType: 'work',
            workId: r.work || r.workId,
            creators: (r.byline || r.creators || r.lead_creator || 'CBETA 電子佛典') + timeRangeStr,
            category: r.category || r.orig_category || 'CBETA',
            juanStart: r.juan || r.juansCount || 1,
            timeFrom: r.time_from,
            timeTo: r.time_to
          };
        });

        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }

      // 處理 CBETA 官方 API (部類 q=CBETA / 冊別 q=orig 及子節點)
      let targetId = queryId;
      if (queryId === 'root_dept') targetId = 'CBETA';
      if (queryId === 'root_vol') targetId = 'orig';

      const relativeUrl = getApiUrl(`/stable/catalog_entry?q=${encodeURIComponent(targetId)}`);
      let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

      if (!res || !res.ok) {
        const directUrl = `https://cbdata.dila.edu.tw/stable/catalog_entry?q=${encodeURIComponent(targetId)}`;
        res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' });
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data && data.results && Array.isArray(data.results)) {
          const items: CatalogItem[] = data.results.map((r: any) => ({
            id: r.n || r.work || r.label,
            label: r.label || r.title || r.n,
            nodeType: r.node_type === 'work' || r.work ? 'work' : 'category',
            workId: r.work,
            juanStart: r.juan_start,
            creators: r.creators,
            category: r.category,
            file: r.file
          }));
          catalogCacheRef.current.set(queryId, items);
          setCatalogItems(items);
        } else {
          setCatalogItems([]);
        }
      } else {
        setCatalogItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch catalog entries:', err);
      setCatalogItems([]);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // 切換 5 個頁籤 (常用經典、依部類、依冊別、依作譯者、依朝代)
  const handleTabSelect = (tab: 'favorite' | 'dept' | 'vol' | 'creator' | 'time') => {
    setActiveTab(tab);
    setOnlineResults([]);
    setIsTextSearchActive(false);
    let rootNode: CatalogNode;

    switch (tab) {
      case 'favorite':
        rootNode = { id: 'favorite_root', label: '常用經典' };
        setCatalogItems(STATIC_FAVORITE_WORKS);
        break;
      case 'dept':
        rootNode = { id: 'CBETA', label: '依部類' };
        setCatalogItems(STATIC_DEPT_CATEGORIES);
        break;
      case 'vol':
        rootNode = { id: 'orig', label: '依冊別' };
        setCatalogItems(STATIC_VOL_CATEGORIES);
        break;
      case 'creator':
        rootNode = { id: 'creator_root', label: '依作譯者' };
        setCatalogItems(CREATOR_STROKE_CATEGORIES.map(s => ({
          id: `creator_stroke_${s.stroke}`,
          label: s.label,
          subLabel: s.sample,
          nodeType: 'category'
        })));
        break;
      case 'time':
        rootNode = { id: 'time_root', label: '依朝代' };
        setCatalogItems(HISTORICAL_DYNASTIES.map(d => ({
          id: `time_search_${d.query}`,
          label: d.name,
          subLabel: d.years,
          nodeType: 'category',
          queryParam: d.query
        })));
        break;
      default:
        rootNode = { id: 'CBETA', label: '依部類' };
        setCatalogItems(STATIC_DEPT_CATEGORIES);
    }

    setIsLoadingCatalog(false);
    setHistoryStack([rootNode]);
    setHistoryIndex(0);
  };

  // 點擊目錄項目 (資料夾 / 經典)
  const handleItemClick = (item: CatalogItem) => {
    if (item.nodeType === 'work' || item.workId) {
      const wId = item.workId || item.id;
      if (downloadedWorkIds.includes(wId)) {
        onSelectBook(wId);
      } else {
        // 下載單本經典
        handleDownloadSingleWork({
          workId: wId,
          title: item.label.replace(/^[A-Z]\d+\s*/, '').replace(/^[A-Z]\d+n\d+[A-Za-z]?\s*/, '').replace(/\s*\(\d+卷\)$/, ''),
          creators: item.creators || 'CBETA 電子佛典',
          juansCount: item.juansCount || item.juanStart || 1,
          category: item.category || 'CBETA'
        });
      }
    } else {
      // 點擊資料夾 -> 開啟下一層
      const newNode: CatalogNode = {
        id: item.id,
        label: item.label
      };
      const nextStack = [...historyStack.slice(0, historyIndex + 1), newNode];
      setHistoryStack(nextStack);
      setHistoryIndex(nextStack.length - 1);
    }
  };

  // 點擊麵包屑跳轉
  const handleBreadcrumbClick = (targetIndex: number) => {
    if (targetIndex !== historyIndex) {
      setHistoryIndex(targetIndex);
    }
  };

  // 控制列上一頁 / 下一頁
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  const handleHeaderPrev = () => {
    if (canGoBack) setHistoryIndex(prev => prev - 1);
  };

  const handleHeaderNext = () => {
    if (canGoForward) setHistoryIndex(prev => prev + 1);
  };

  const renderStepIcon = (targetStep: string, activeStep: string, percent: number) => {
    const stepsOrder = ['metadata', 'fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'];
    const targetIndex = stepsOrder.indexOf(targetStep);
    const activeIndex = stepsOrder.indexOf(activeStep);
    
    if (activeIndex > targetIndex) {
      return <Check size={14} style={{ color: '#2e7d32' }} />;
    } else if (activeIndex === targetIndex) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--theme-accent)', fontWeight: 'bold' }}>進行中 ({percent}%)</span>;
    }
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>等待中</span>;
  };

  // 執行線上關鍵字搜尋
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineSearchQuery.trim()) return;

    setIsSearchingOnline(true);
    setIsTextSearchActive(true);
    try {
      const results = await IndexBuilder.searchTitle(onlineSearchQuery.trim());
      setOnlineResults(results);
    } catch (err) {
      console.error('Failed to search online CBETA:', err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // 清除關鍵字搜尋 -> 自動恢復 4 個分頁與目錄瀏覽
  const handleClearSearch = () => {
    setOnlineSearchQuery('');
    setOnlineResults([]);
    setIsTextSearchActive(false);
    setSelectedOnlineWorkIds([]);
  };

  // 大部頭經典 (>= 80 卷) 確認對話框
  const [largeDownloadTarget, setLargeDownloadTarget] = useState<SearchResult | null>(null);

  // 觸發單本下載前進行卷數檢測
  const handleDownloadSingleWork = (res: SearchResult) => {
    // 💡 若總卷數 >= 80 卷 (如大般若經 600卷、大毘婆沙論 200卷、大寶積經 120卷、華嚴經 80卷)，先彈出提示確認視窗！
    if (res.juansCount >= 80 || res.workId === 'T0220') {
      setLargeDownloadTarget(res);
      return;
    }
    executeSingleWorkDownload(res);
  };

  // 實際執行單本經典下載
  const executeSingleWorkDownload = async (res: SearchResult) => {
    try {
      setBuildProgress({ step: 'metadata', message: `正在準備下載《${res.title}》...`, percent: 3 });
      const pkg = await PackageBuilder.downloadAndPackage(res, (prog: BuildProgress) => {
        setBuildProgress(prog);
      });

      if (pkg) {
        setDownloadedWorkIds(prev => [...prev, res.workId]);
        setTimeout(() => {
          setBuildProgress(null);
          onSelectBook(res.workId);
        }, 600);
      }
    } catch (err) {
      console.error('Failed to download book:', err);
      alert(`下載《${res.title}》失敗，請確認網路連線。`);
      setBuildProgress(null);
    }
  };

  // 批量勾選/取消
  const toggleSelectOnlineWork = (workId: string) => {
    setSelectedOnlineWorkIds(prev => 
      prev.includes(workId) ? prev.filter(id => id !== workId) : [...prev, workId]
    );
  };

  const handleSelectAllOnlineResults = (currentList: any[]) => {
    const unDownloaded = currentList.filter((r: any) => {
      const wId = r.workId || r.id;
      return !downloadedWorkIds.includes(wId);
    });
    const unDownloadedIds = unDownloaded.map((r: any) => r.workId || r.id);

    if (selectedOnlineWorkIds.length === unDownloadedIds.length && selectedOnlineWorkIds.length > 0) {
      setSelectedOnlineWorkIds([]);
    } else {
      setSelectedOnlineWorkIds(unDownloadedIds);
    }
  };

  // 執行批量下載
  const handleExecuteBatchDownload = async () => {
    if (selectedOnlineWorkIds.length === 0) return;
    const targetWorkIds = [...selectedOnlineWorkIds];
    setShowBatchDownloadModal(false);
    setSelectedOnlineWorkIds([]);

    let targetFolderId: string | null = null;
    if (batchFolderMode === 'new') {
      const newFId = `folder_${Date.now()}`;
      const newFolder = {
        id: newFId,
        name: batchFolderName.trim() || '下載經典',
        color: batchFolderColor,
        bookIds: [],
        subFolderIds: []
      };
      const updatedFolders = [...folders, newFolder];
      localStorage.setItem('cbeta_reader_folders', JSON.stringify(updatedFolders));
      setFolders(updatedFolders);
      targetFolderId = newFId;
    } else if (batchFolderMode === 'existing') {
      targetFolderId = selectedExistingFolderId;
    }

    const totalCount = targetWorkIds.length;
    let completedCount = 0;
    const newlyDownloaded: string[] = [];

    // 合併線上搜尋結果與當前目錄經典清單
    const availablePool = [
      ...onlineResults,
      ...catalogItems.map(item => ({
        workId: item.workId || item.id,
        title: item.label,
        creators: item.creators || 'CBETA',
        juansCount: item.juanStart || 1,
        category: item.category || 'CBETA'
      }))
    ];

    for (const wId of targetWorkIds) {
      completedCount++;
      const res = availablePool.find(r => r.workId === wId) || {
        workId: wId,
        title: wId,
        creators: 'CBETA',
        juansCount: 1,
        category: 'CBETA'
      };

      try {
        setBuildProgress({
          step: 'metadata',
          message: `批量下載中 (${completedCount}/${totalCount})：正在建置《${res.title}》...`,
          percent: Math.round(((completedCount - 1) / totalCount) * 100)
        });

        await PackageBuilder.downloadAndPackage(res, (prog: BuildProgress) => {
          const overallPercent = Math.round(((completedCount - 1) / totalCount) * 100 + (prog.percent / totalCount));
          setBuildProgress({
            ...prog,
            message: `批量下載中 (${completedCount}/${totalCount})：${prog.message}`,
            percent: Math.min(99, overallPercent)
          });
        });

        newlyDownloaded.push(wId);

        if (targetFolderId) {
          const currentFoldersStr = localStorage.getItem('cbeta_reader_folders');
          if (currentFoldersStr) {
            const currentFolders = JSON.parse(currentFoldersStr);
            const targetFolder = currentFolders.find((f: any) => f.id === targetFolderId);
            if (targetFolder && !targetFolder.bookIds.includes(wId)) {
              targetFolder.bookIds.push(wId);
              localStorage.setItem('cbeta_reader_folders', JSON.stringify(currentFolders));
              setFolders(currentFolders);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to download ${wId}:`, err);
      }
    }

    setDownloadedWorkIds(prev => [...prev, ...newlyDownloaded]);
    setBuildProgress({
      step: 'completed',
      message: `🎉 批量下載完成！成功匯入 ${newlyDownloaded.length} 本經典。`,
      percent: 100
    });

    setTimeout(() => {
      setBuildProgress(null);
    }, 1200);
  };

  // 計算當前目錄中未下載的經文清單
  const currentCategoryWorks = catalogItems.filter(item => item.nodeType === 'work' || !!item.workId);

  return (
    <div className={`cbeta-catalog-container theme-${settings.theme}`}>
      {/* 頂部固定控制列 (Header Bar) */}
      <header className="cbeta-catalog-header">
        <div className="cbeta-header-left">
          {/* 回首頁 (書架) 圖示 */}
          <button 
            className="icon-button" 
            onClick={onBackToLibrary}
            title="返回本地書架"
          >
            <Home size={20} />
          </button>

          <div className="cbeta-header-divider" />

          {/* 上一層 (<) 與 下一層 (>) 歷史導航按鈕 */}
          <button 
            className="nav-hist-btn" 
            onClick={handleHeaderPrev}
            disabled={!canGoBack}
            title="上一頁 / 上一層"
          >
            <ChevronLeft size={20} />
          </button>

          <button 
            className="nav-hist-btn" 
            onClick={handleHeaderNext}
            disabled={!canGoForward}
            title="下一頁 / 下一層"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="cbeta-header-right">
          {/* 右上角齒輪設定圖示 */}
          <button 
            className="icon-button" 
            onClick={onOpenSettings}
            title="偏好設定"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* 主頁面內容區 */}
      <main className="cbeta-catalog-body custom-scrollbar">
        {/* 上方固定控制與搜尋面板 */}
        <section className="cbeta-top-panel">
          {/* 1. 關鍵字搜尋卡片 */}
          <div className="cbeta-search-card">
            {/* 💡 搜尋框上方小字標題：「| 檢索CBETA 並下載書籍」（向右縮排半格） */}
            <div className="cbeta-header-title">
              <span className="cbeta-title-bar" />
              <span>檢索CBETA 並下載書籍</span>
            </div>

            <form className="cbeta-search-input-wrapper" onSubmit={handleSearchSubmit}>
              <input 
                type="text" 
                className="cbeta-search-input"
                placeholder="輸入關鍵字，例如：地藏、鳩摩羅什、T0235"
                value={onlineSearchQuery}
                onChange={(e) => {
                  setOnlineSearchQuery(e.target.value);
                  if (!e.target.value.trim() && isTextSearchActive) {
                    handleClearSearch();
                  }
                }}
              />
              <div className="cbeta-search-actions">
                {onlineSearchQuery && (
                  <button 
                    type="button" 
                    className="cbeta-search-clear-btn" 
                    onClick={handleClearSearch}
                    title="結束/清除搜尋"
                  >
                    <X size={18} />
                  </button>
                )}
                <button type="submit" className="cbeta-search-btn" disabled={isSearchingOnline} title="搜尋 CBETA 經典">
                  {isSearchingOnline ? <span style={{ fontSize: '0.75rem' }}>...</span> : <Search size={20} />}
                </button>
              </div>
            </form>

            {/* 💡 上方加一條細細的分隔線 + 粗體圓體「+依類別查詢」動態開關 */}
            {!isTextSearchActive && (
              <>
                <div 
                  className="cbeta-category-divider"
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--reader-border, rgba(0, 0, 0, 0.08))',
                    marginTop: '1.2rem',
                    marginBottom: '0.6rem',
                    width: '100%'
                  }}
                />
                <div 
                  className="cbeta-category-toggle"
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  title={isCategoriesExpanded ? '點擊收合類別查詢' : '點擊展開類別查詢'}
                >
                  {isCategoriesExpanded ? (
                    <Minus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
                  ) : (
                    <Plus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
                  )}
                  <span>依類別查詢</span>
                </div>
              </>
            )}
          </div>

          {/* 2. 5 個 Chrome 風精緻 Tab 頁籤 (預設收合，點選「+」後展開，圖示在上方) */}
          {!isTextSearchActive && isCategoriesExpanded && (
            <div className="cbeta-tabs-grid">
              {[
                { id: 'favorite', label: '常用經典', icon: Heart },
                { id: 'dept', label: '依部類', icon: Layers },
                { id: 'vol', label: '依冊別', icon: BookMarked },
                { id: 'creator', label: '依作譯者', icon: User },
                { id: 'time', label: '依朝代', icon: Clock }
              ].map((tabItem, idx, tabArr) => {
                const isActive = activeTab === tabItem.id;
                const isNextActive = tabArr[idx + 1] && tabArr[idx + 1].id === activeTab;
                const IconComp = tabItem.icon;

                return (
                  <div 
                    key={`cbeta-tab-${tabItem.id}`}
                    className={`cbeta-tab-block ${isActive ? 'active' : ''} ${isNextActive ? 'prev-active' : ''}`}
                    onClick={() => handleTabSelect(tabItem.id as any)}
                  >
                    <IconComp size={17} />
                    <span>{tabItem.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 文字搜尋結果區塊 */}
        {isTextSearchActive && (
          <section className="cbeta-content-pane">
            {isSearchingOnline ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                正在線上檢索 CBETA 藏經庫《{onlineSearchQuery}》經典中...
              </div>
            ) : onlineResults.length > 0 ? (
              <>
                <div className="cbeta-pane-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-rounded)', color: 'var(--text-primary)' }}>
                      搜尋結果 ({onlineResults.length} 本)
                    </h3>
                    
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="batch-btn batch-btn-secondary" 
                        onClick={() => handleSelectAllOnlineResults(onlineResults)}
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem', fontFamily: 'var(--font-rounded)' }}
                      >
                        {selectedOnlineWorkIds.length === onlineResults.filter(r => !downloadedWorkIds.includes(r.workId)).length && selectedOnlineWorkIds.length > 0
                          ? '取消全選'
                          : '全選未下載'}
                      </button>

                      <button 
                        type="button"
                        className="batch-btn batch-btn-primary"
                        disabled={selectedOnlineWorkIds.length === 0}
                        onClick={() => {
                          setBatchFolderName(onlineSearchQuery.trim() || '下載經典');
                          setBatchFolderMode('new');
                          setShowBatchDownloadModal(true);
                        }}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-rounded)' }}
                      >
                        <Download size={15} />
                        批量下載與收納 ({selectedOnlineWorkIds.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cbeta-items-scroll-area custom-scrollbar">
                  <div className="cbeta-items-grid">
                    {onlineResults.map((res) => {
                      const isDownloaded = downloadedWorkIds.includes(res.workId);
                      const isChecked = selectedOnlineWorkIds.includes(res.workId);

                      return (
                        <div 
                          key={`search-res-${res.workId}`} 
                          className={`cbeta-work-card ${isChecked ? 'selected' : ''}`}
                          onClick={() => !isDownloaded && toggleSelectOnlineWork(res.workId)}
                          style={{ cursor: isDownloaded ? 'default' : 'pointer' }}
                        >
                          {!isDownloaded && (
                            <div 
                              className={`batch-checkbox ${isChecked ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectOnlineWork(res.workId);
                              }}
                              style={{ marginRight: '6px' }}
                            >
                              {isChecked && <Check size={12} />}
                            </div>
                          )}

                          <div className="cbeta-work-badge">{res.workId}</div>

                          <div className="cbeta-work-info">
                            <div className="cbeta-work-title">{res.title}</div>
                            <div className="cbeta-work-meta">{res.creators} · {res.juansCount}卷</div>
                          </div>

                          {isDownloaded ? (
                            <div className="download-status-square" title="已匯入書架">
                              <Check size={16} />
                            </div>
                          ) : (
                            <button 
                              className="download-btn-square" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleWork(res);
                              }} 
                              title="下載匯入"
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                未找到與「{onlineSearchQuery}」相關的經典
              </div>
            )}
          </section>
        )}

        {/* 滿版樹狀與層級內容區 (非搜尋模式且點選「+依類別查詢」後呈現) */}
        {!isTextSearchActive && isCategoriesExpanded && (
          <section className="cbeta-content-pane">
            {/* 💡 僅在深入子層級 (historyIndex > 0) 時顯示麵包屑導航，根目錄不重複寫標題 */}
            {historyIndex > 0 && (
              <div className="cbeta-pane-header">
                <div className="cbeta-breadcrumb-row">
                  {historyStack.slice(0, historyIndex + 1).map((node, index) => {
                    const isLast = index === historyIndex;
                    return (
                      <React.Fragment key={`bc-${node.id}-${index}`}>
                        {index > 0 && <span className="cbeta-breadcrumb-sep">»</span>}
                        <span 
                          className={`cbeta-breadcrumb-crumb ${isLast ? 'current' : ''}`}
                          onClick={() => handleBreadcrumbClick(index)}
                        >
                          {node.label}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 當子層級包含經典時，顯示批量工具列 */}
                {currentCategoryWorks.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                      本層共有 {currentCategoryWorks.length} 本經典
                    </span>

                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="batch-btn batch-btn-secondary" 
                        onClick={() => handleSelectAllOnlineResults(currentCategoryWorks)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', fontFamily: 'var(--font-rounded)' }}
                      >
                        {selectedOnlineWorkIds.length === currentCategoryWorks.filter(r => !downloadedWorkIds.includes(r.workId || r.id)).length && selectedOnlineWorkIds.length > 0
                          ? '取消全選'
                          : '全選未下載'}
                      </button>

                      <button 
                        type="button"
                        className="batch-btn batch-btn-primary"
                        disabled={selectedOnlineWorkIds.length === 0}
                        onClick={() => {
                          const currentNode = historyStack[historyIndex];
                          setBatchFolderName(currentNode ? currentNode.label : '下載經典');
                          setBatchFolderMode('new');
                          setShowBatchDownloadModal(true);
                        }}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-rounded)' }}
                      >
                        <Download size={14} />
                        批量下載與收納 ({selectedOnlineWorkIds.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 獨立垂直滾動區：經典與資料夾卡片在這裡進行內部滾動 */}
            <div className="cbeta-items-scroll-area custom-scrollbar">
              {isLoadingCatalog ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                  正在檢索 CBETA 藏經庫數據中...
                </div>
              ) : catalogItems.length > 0 ? (
                <div className="cbeta-items-grid">
                  {catalogItems.map((item) => {
                    const isWork = item.nodeType === 'work' || !!item.workId;
                    const wId = item.workId || item.id;
                    const isDownloaded = downloadedWorkIds.includes(wId);
                    const isChecked = selectedOnlineWorkIds.includes(wId);

                    if (isWork) {
                      return (
                        <div 
                          key={`catalog-item-${item.id}`} 
                          className={`cbeta-work-card ${isChecked ? 'selected' : ''}`}
                          onClick={() => !isDownloaded && toggleSelectOnlineWork(wId)}
                          style={{ cursor: 'pointer' }}
                        >
                          {!isDownloaded && (
                            <div 
                              className={`batch-checkbox ${isChecked ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectOnlineWork(wId);
                              }}
                              style={{ marginRight: '6px' }}
                            >
                              {isChecked && <Check size={12} />}
                            </div>
                          )}

                          <div className="cbeta-work-badge">{wId}</div>
                          <div className="cbeta-work-info">
                            <div className="cbeta-work-title">{item.label}</div>
                            <div className="cbeta-work-meta">
                              {item.creators || 'CBETA 電子佛典'}
                            </div>
                          </div>

                          {isDownloaded ? (
                            <div className="download-status-square" title="已在書架">
                              <Check size={16} />
                            </div>
                          ) : (
                            <button 
                              className="download-btn-square" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }} 
                              title="下載匯入"
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      );
                    }

                    // 資料夾 (筆劃數資料夾 / 大師名字資料夾 / 部類冊別層級)
                    return (
                      <div 
                        key={`catalog-folder-${item.id}`}
                        className="cbeta-folder-card"
                        onClick={() => handleItemClick(item)}
                      >
                        <Folder size={20} style={{ color: 'var(--theme-accent, #cf9f60)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
                          <span className="cbeta-folder-title">{item.label}</span>
                          {item.subLabel && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                              {item.subLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                  此分類下無子項目
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* 批量下載與自動資料夾收納對話框 */}
      {showBatchDownloadModal && (
        <div className="search-dialog-overlay" style={{ zIndex: 1250 }} onClick={() => setShowBatchDownloadModal(false)}>
          <div className="changelog-dialog-card animate-slide-up" style={{ width: '92%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-rounded)' }}>批量下載經典收納設定</h3>
              <button className="icon-button close-btn" onClick={() => setShowBatchDownloadModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: 'var(--font-rounded)' }}>
                即將開始下載已勾選的 <strong style={{ color: 'var(--theme-accent)' }}>{selectedOnlineWorkIds.length}</strong> 本經典。
              </div>

              {/* 收納方式單選選項 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-rounded)' }}>
                  選擇下載收納方式：
                </span>

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-rounded)' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'new'} 
                    onChange={() => setBatchFolderMode('new')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  建立新資料夾收納經書
                </label>

                {batchFolderMode === 'new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>資料夾名稱：</span>
                    <input 
                      type="text" 
                      className="settings-select"
                      value={batchFolderName}
                      onChange={(e) => setBatchFolderName(e.target.value)}
                      placeholder="請輸入資料夾名稱..."
                      style={{ fontSize: '0.88rem', padding: '0.5rem 0.8rem', fontFamily: 'var(--font-rounded)' }}
                    />

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>主題色：</span>
                      {FOLDER_COLOR_OPTIONS.map(opt => (
                        <div 
                          key={`batch-color-${opt.value}`}
                          onClick={() => setBatchFolderColor(opt.value)}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: opt.value,
                            cursor: 'pointer',
                            border: batchFolderColor === opt.value ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                            boxShadow: batchFolderColor === opt.value ? '0 0 0 2px var(--theme-accent)' : 'none',
                            transition: 'transform 0.15s'
                          }}
                          title={opt.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-rounded)' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'existing'} 
                    onChange={() => setBatchFolderMode('existing')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  放入已有資料夾
                </label>

                {batchFolderMode === 'existing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    {folders.length > 0 ? (
                      <select 
                        className="settings-select"
                        value={selectedExistingFolderId}
                        onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                        style={{ fontSize: '0.88rem', padding: '0.55rem 0.8rem', fontFamily: 'var(--font-rounded)' }}
                      >
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name} ({f.bookIds.length} 本)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--theme-accent)', padding: '0.3rem 0', fontFamily: 'var(--font-rounded)' }}>
                        （目前書架尚未建立任何資料夾，請選擇「建立新資料夾」）
                      </div>
                    )}
                  </div>
                )}

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-rounded)' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'none'} 
                    onChange={() => setBatchFolderMode('none')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  下載至書架根目錄（不放入資料夾）
                </label>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setShowBatchDownloadModal(false)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={handleExecuteBatchDownload}
                  disabled={(batchFolderMode === 'new' && !batchFolderName.trim()) || (batchFolderMode === 'existing' && !selectedExistingFolderId)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  開始下載
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 大部頭經典 (> 80 卷) 下載前預估時間與確認對話框 */}
      {largeDownloadTarget && (
        <div className="search-dialog-overlay" style={{ zIndex: 1250 }} onClick={() => setLargeDownloadTarget(null)}>
          <div className="changelog-dialog-card animate-slide-up" style={{ width: '92%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-rounded)' }}>大部頭經典下載提示</h3>
              <button className="icon-button close-btn" onClick={() => setLargeDownloadTarget(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'var(--font-rounded)' }}>
                《<strong>{largeDownloadTarget.title}</strong>》全書共 <strong style={{ color: 'var(--theme-accent)' }}>{largeDownloadTarget.juansCount}</strong> 卷，篇幅宏大。
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)', padding: '0.85rem', borderRadius: '8px', lineHeight: 1.6, fontFamily: 'var(--font-rounded)' }}>
                🚀 系統已啟用 6 線程動態併行流極速下載引擎（配備自動 3 次重試與抗限流保護），全集預估下載與建置時間約需：
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--theme-accent)', marginTop: '0.35rem' }}>
                  {largeDownloadTarget.juansCount >= 500 ? '約 3 ~ 6 分鐘' : largeDownloadTarget.juansCount >= 200 ? '約 1 ~ 3 分鐘' : '約 30 ~ 60 秒'}
                </div>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.4rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setLargeDownloadTarget(null)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={() => {
                    const target = largeDownloadTarget;
                    setLargeDownloadTarget(null);
                    executeSingleWorkDownload(target);
                  }}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  🚀 確定下載全集
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder 進度遮罩 */}
      {buildProgress && (
        <div className={`builder-progress-overlay theme-${settings.theme}`}>
          <div className="builder-animation-box">
            <div 
              className="builder-outer-ring" 
              style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
            />
            <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
              <img 
                src="/apple-touch-icon.png" 
                alt="CBETA Reader 淨心閱讀"
                className="builder-logo-img"
              />
            </div>
          </div>

          <div className="builder-header-message">
            {buildProgress.message}
          </div>

          <div className="builder-details-card animate-slide-up">
            <div className="builder-title">下載中{loadingDots}</div>
            <div className="builder-progress-bar-wrapper">
              <div className="builder-progress-bar-fill" style={{ width: `${buildProgress.percent}%` }} />
            </div>
            
            <div className="builder-step-status">
              <div className={`builder-step-item ${buildProgress.step === 'metadata' ? 'active' : ''} ${['fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>1. 取得佛典詮釋資料(Index Builder)</span>
                <span>{renderStepIcon('metadata', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'fetch_content' ? 'active' : ''} ${['navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>2. 經典段落標記解析(Reader Builder)</span>
                <span>{renderStepIcon('fetch_content', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'navigation' ? 'active' : ''} ${['reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>3. 目錄結構與卷期編排(Navigation Builder)</span>
                <span>{renderStepIcon('navigation', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'reference' ? 'active' : ''} ${['search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>4. 校勘註解與學術比對(Reference Builder)</span>
                <span>{renderStepIcon('reference', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'search_index' ? 'active' : ''} ${['ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>5. 本地高速檢索索引建置(Search Index Builder)</span>
                <span>{renderStepIcon('search_index', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'ai_index' ? 'active' : ''} ${['saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>6. AI 輔助閱讀與語意索引(AI Indexer)</span>
                <span>{renderStepIcon('ai_index', buildProgress.step, buildProgress.percent)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CbetaCatalogView;
