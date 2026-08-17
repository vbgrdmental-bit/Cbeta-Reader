const fs = require('fs');

const OFFICIAL_SAMPLE_STROKES = {
  1: ['一'],
  2: ['丁', '九', '了', '力', '十'],
  3: ['三', '上', '久', '于', '及', '士', '大', '子', '尸', '工', '才'],
  4: ['不', '中', '仁', '今', '介', '允', '勿', '天', '太', '巨', '巴', '幻', '式', '心', '支', '文', '方', '日', '月', '木', '毛', '水', '王'],
  5: ['世', '丘', '功', '印', '古', '可', '平', '弗', '弘', '朱', '本', '札', '正', '永', '玄', '用', '白', '目', '矢', '石'],
  6: ['仲', '任', '伊', '先', '光', '全', '沖', '合', '吉', '地', '多', '如', '守', '安', '屾', '延', '廷', '成', '有', '朱', '朴', '汝', '江', '牟', '祁', '自', '至', '芝', '行', '衣', '西', '那'],
  7: ['伽', '住', '佐', '何', '余', '佛', '克', '利', '即', '含', '吳', '呂', '均', '妙', '孚', '宋', '完', '宏', '岑', '希', '序', '張', '志', '忖', '戒', '李', '杜', '求', '汪', '沈', '沙', '良', '芳', '見', '阿'],
  8: ['來', '其', '具', '受', '周', '孟', '宗', '定', '宜', '尚', '居', '岫', '岳', '帛', '建', '念', '性', '承', '拂', '拉', '拔', '明', '杭', '東', '林', '果', '武', '沮', '治', '法', '波', '知', '祇', '空', '竺', '舍', '若', '英', '范', '表', '迦', '金', '青', '非'],
  9: ['亮', '侯', '倡', '俊', '俞', '信', '修', '則', '威', '契', '姚', '彥', '思', '恆', '恒', '拾', '指', '施', '昭', '曷', '柳', '段', '毗', '毘', '洛', '洪', '珀', '省', '祖', '神', '紀', '胡', '胤', '貞', '退', '重', '音', '飛'],
  10: ['師', '乘', '條', '冥', '凌', '剛', '原', '員', '唐', '函', '夏', '孫', '徐', '悟', '振', '晃', '時', '朗', '栖', '浮', '海', '烏', '益', '真', '祥', '翁', '般', '莊', '華', '袁', '貢', '起', '通', '造', '郭', '陳', '陶', '陸', '馬', '高'],
  11: ['乾', '勒', '唯', '商', '啟', '堅', '婆', '寂', '屠', '崇', '崔', '常', '康', '張', '得', '從', '惟', '授', '旋', '曹', '曼', '梁', '梅', '梵', '梶', '淨', '深', '清', '盛', '眾', '章', '紹', '菩', '處', '姝', '許', '野', '隆', '雪'],
  12: ['傅', '勝', '善', '喻', '富', '寒', '尊', '彭', '復', '惠', '惹', '提', '敬', '普', '景', '晃', '智', '曾', '最', '湛', '湯', '無', '焦', '然', '琮', '發', '程', '等', '筏', '翔', '舒', '萬', '葉', '葛', '董', '訶', '費', '超', '跋', '遁', '遇', '運', '遍', '道', '達', '量', '開', '雅', '雲', '黃'],
  13: ['傳', '嗣', '圓', '塞', '愛', '慈', '暉', '楊', '楚', '業', '源', '薄', '照', '瑞', '皖', '寘', '福', '筠', '義', '聖', '與', '蒙', '蓮', '虞', '解', '註', '賈', '際', '鳩', '謎'],
  14: ['僧', '厲', '壽', '實', '寬', '廣', '榮', '滿', '熊', '熙', '碩', '管', '維', '翠', '聞', '蔡', '蔣', '裴', '趙', '鄧', '鄭', '閼', '齊'],
  15: ['儀', '劉', '德', '徹', '慧', '慶', '懡', '摩', '樓', '潘', '潤', '潭', '澄', '螢', '諸', '諾', '遵', '銳', '黎'],
  16: ['凝', '叡', '學', '曇', '曉', '機', '燈', '禪', '窺', '縛', '興', '蘊', '薩', '親', '諦', '賴', '辨', '錢', '閻', '靜', '鮑', '龍'],
  17: ['優', '嶽', '彌', '應', '戴', '濟', '禮', '聯', '膽', '藍', '藏', '謝', '鍾', '韓', '魏', '鮮'],
  18: ['瓊', '瞿', '聶', '豐', '鎮', '雙', '顏'],
  19: ['嚴', '懷', '羅', '蘇', '蘊', '譚', '贊', '關', '難', '願'],
  20: ['寶', '灌', '繼', '覺', '護', '釋'],
  21: ['攝', '續', '辯'],
  22: ['讀', '鑑', '體', '龔'],
  23: ['顯'],
  24: ['觀', '靈'],
  29: ['鬱']
};

const rawData = JSON.parse(fs.readFileSync('scratch/cbeta_creators_with_works.json', 'utf8'))[0];

const strokeCategories = [];

rawData.children.forEach(strokeNode => {
  const strokeTitle = strokeNode.title;
  const strokeNumMatch = strokeTitle.match(/(\d+)劃/);
  if (!strokeNumMatch) return;
  
  const strokeNumber = parseInt(strokeNumMatch[1], 10);
  const label = `${strokeNumber} 劃`;
  const officialChars = OFFICIAL_SAMPLE_STROKES[strokeNumber] || [];

  // 只保留官方認定的首字群組，且依官方順序排列
  const validGroups = [];

  officialChars.forEach(char => {
    const groupNode = (strokeNode.children || []).find(g => g.title === char);
    if (groupNode) {
      const creators = (groupNode.children || []).map(creatorNode => {
        const creatorId = creatorNode.key;
        const name = creatorNode.title;
        const works = (creatorNode.children || []).map(workNode => {
          const workId = workNode.key;
          const rawTitle = workNode.title;
          
          let title = rawTitle;
          let juans = 1;
          let byline = '';
          
          const match = rawTitle.match(/^[A-Z0-9_]+\s+([^(【]+)(?:\((\d+)卷\))?(?:【(.*?)】)?/);
          if (match) {
            title = match[1].trim();
            if (match[2]) juans = parseInt(match[2], 10);
            if (match[3]) byline = match[3].trim();
          } else {
            title = rawTitle.replace(/^[A-Z0-9_]+\s+/, '').replace(/\(.*?\)/g, '').replace(/【.*?】/g, '').trim();
          }

          return {
            workId,
            title,
            juansCount: juans,
            byline,
            rawTitle
          };
        });

        return {
          creatorId,
          name,
          displayName: `${name} (${creatorId})`,
          worksCount: works.length,
          works
        };
      });

      if (creators.length > 0) {
        validGroups.push({
          firstChar: char,
          creatorsCount: creators.length,
          creators
        });
      }
    }
  });

  let totalCreators = 0;
  let totalWorks = 0;
  validGroups.forEach(g => {
    totalCreators += g.creatorsCount;
    g.creators.forEach(c => totalWorks += c.worksCount);
  });

  if (validGroups.length > 0) {
    strokeCategories.push({
      stroke: strokeNumber,
      label,
      groupsCount: validGroups.length,
      creatorsCount: totalCreators,
      worksCount: totalWorks,
      groups: validGroups
    });
  }
});

strokeCategories.sort((a, b) => a.stroke - b.stroke);

fs.writeFileSync('public/data/cbeta-creators.json', JSON.stringify(strokeCategories), 'utf8');
console.log('Regenerated public/data/cbeta-creators.json successfully!');
strokeCategories.forEach(s => {
  console.log(`  - ${s.label}: [${s.groups.map(g => g.firstChar).join(', ')}] (${s.creatorsCount} 位作譯者, ${s.worksCount} 部經典)`);
});
