const fs = require('fs');
const path = require('path');

const rawData = JSON.parse(fs.readFileSync('scratch/cbeta_creators_with_works.json', 'utf8'))[0];

if (!fs.existsSync('public/data')) {
  fs.mkdirSync('public/data', { recursive: true });
}

const strokeCategories = [];

rawData.children.forEach(strokeNode => {
  const strokeTitle = strokeNode.title;
  if (strokeTitle === '缺作譯者 ID' && (!strokeNode.children || strokeNode.children.length === 0)) {
    return;
  }
  const strokeNumMatch = strokeTitle.match(/(\d+)劃/);
  const strokeNumber = strokeNumMatch ? parseInt(strokeNumMatch[1], 10) : 0;
  const label = strokeNumMatch ? `${strokeNumber} 劃` : strokeTitle;

  const firstCharGroups = (strokeNode.children || []).map(groupNode => {
    const firstChar = groupNode.title;
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

    return {
      firstChar,
      creatorsCount: creators.length,
      creators
    };
  }).filter(g => g.creatorsCount > 0);

  let totalCreators = 0;
  let totalWorks = 0;
  firstCharGroups.forEach(g => {
    totalCreators += g.creatorsCount;
    g.creators.forEach(c => totalWorks += c.worksCount);
  });

  if (firstCharGroups.length > 0) {
    strokeCategories.push({
      stroke: strokeNumber,
      label,
      groupsCount: firstCharGroups.length,
      creatorsCount: totalCreators,
      worksCount: totalWorks,
      groups: firstCharGroups
    });
  }
});

strokeCategories.sort((a, b) => a.stroke - b.stroke);

fs.writeFileSync('public/data/cbeta-creators.json', JSON.stringify(strokeCategories), 'utf8');
console.log('Saved public/data/cbeta-creators.json successfully!');
console.log('Total stroke categories:', strokeCategories.length);
strokeCategories.forEach(s => {
  console.log(`  - ${s.label}: ${s.groupsCount} 首字群組, ${s.creatorsCount} 位作譯者, ${s.worksCount} 部經典`);
});
