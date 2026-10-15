(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.YangzhouModel = model;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const tiers = [
    { id: 'hang', label: '夯', color: '#ff806b' },
    { id: 'top', label: '顶级', color: '#ffb365' },
    { id: 'good', label: '人上人', color: '#f5d977' },
    { id: 'npc', label: 'NPC', color: '#c2dca0' },
    { id: 'bad', label: '拉', color: '#acd6d4' },
    { id: 'unrated', label: '待吃 / 待评', color: '#ddd7cb' }
  ];
  const plain = value => (value || '').replace(/\s+/g, ' ').trim();
  const normalize = value => plain(value).replace(/[\s·・，,、（）()\-]/g, '').replace(/茶舍/g, '茶社');
  const ratingHeading = node => /^H[3-6]$/.test(node.tagName) && /^(评级|评)\s*[：:]/.test(plain(node.textContent));
  function tierOf(rating) {
    if (!rating || ['/', '*'].includes(rating) || /待|未|没吃/.test(rating)) return 'unrated';
    if (rating.includes('夯')) return 'hang';
    if (rating.includes('顶级')) return 'top';
    if (rating.includes('人上人')) return 'good';
    if (/npc/i.test(rating)) return 'npc';
    if (rating.includes('拉')) return 'bad';
    return 'unrated';
  }
  function labelOf(entry) {
    if (entry.tier !== 'unrated') return tiers.find(t => t.id === entry.tier).label;
    return !entry.rating || entry.rating === '/' || /没吃|未吃|待吃/.test(entry.rating) ? '待吃' : '待评';
  }
  function ratingScore(rating) {
    if (tierOf(rating) === 'unrated') return 0;
    const scores = tiers.slice(0, -1).flatMap((tier, index) => plain(rating).toLowerCase().includes(tier.label.toLowerCase()) ? [5 - index] : []);
    return (Math.max(...scores) + Math.min(...scores)) / 2;
  }
  // Pure ratings outrank ranges ending at that tier. Ties retain Markdown order.
  const compareRatings = (a, b) => ratingScore(b.rating) - ratingScore(a.rating);
  function readEntries(source) {
    const entries = [];
    const nodes = [...source.children];
    let category = '其他';
    let group = '';
    nodes.forEach((node, index) => {
      if (node.tagName === 'H1') { category = plain(node.textContent); group = ''; return; }
      if (node.tagName === 'H2') { group = plain(node.textContent); return; }
      if (node.tagName === 'TABLE') {
        node.querySelectorAll('tbody tr').forEach(row => {
          if (!plain(row.cells[0]?.textContent)) return;
          const details = document.createElement('div');
          ['评价', '备注', '总店'].forEach((label, i) => {
            const cell = row.cells[i + 2];
            if (!cell || !plain(cell.textContent) || cell.textContent.trim() === '/') return;
            const paragraph = document.createElement('p');
            if (i) { const title = document.createElement('strong'); title.textContent = `${label}：`; paragraph.append(title); }
            paragraph.insertAdjacentHTML('beforeend', cell.innerHTML);
            details.append(paragraph);
          });
          const img = details.querySelector('img');
          entries.push({ name: plain(row.cells[0].textContent), category, group, rating: plain(row.cells[1]?.textContent), branch: plain(row.cells[4]?.textContent).replace(/^\/$/, ''), image: img?.getAttribute('data-src') || img?.getAttribute('src') || '', detailHTML: details.innerHTML || '<p>详情待补充。</p>' });
        });
        group = '';
        return;
      }
      // An H3/H4 venue is identified by the following rating, not a fixed heading level.
      if (!/^H[34]$/.test(node.tagName) || ratingHeading(node) || !nodes[index + 1] || !ratingHeading(nodes[index + 1])) return;
      const level = Number(node.tagName.slice(1));
      const details = document.createElement('div');
      for (let j = index + 2; j < nodes.length; j++) {
        const next = nodes[j];
        if (/^H[34]$/.test(next.tagName) && !ratingHeading(next) && nodes[j + 1] && ratingHeading(nodes[j + 1])) break;
        if (/^H[1-6]$/.test(next.tagName) && Number(next.tagName.slice(1)) <= level) break;
        details.append(next.cloneNode(true));
      }
      const img = details.querySelector('img');
      entries.push({ name: plain(node.textContent), category, group, rating: plain(nodes[index + 1].textContent).replace(/^(评级|评)\s*[：:]\s*/, ''), image: img?.getAttribute('data-src') || img?.getAttribute('src') || '', detailHTML: details.innerHTML || '<p>详情待补充。</p>' });
    });
    return entries;
  }
  function decorate(entries, data) {
    const catalog = new Map(Object.entries(data.places || {}).map(([name, meta]) => [normalize(name), meta]));
    return entries.map(entry => {
      const metadata = catalog.get(normalize(entry.name)) || {};
      const photo = data.photos?.[metadata.photo];
      const customImage = entry.image || metadata.image;
      return { ...entry, tier: tierOf(entry.rating), image: customImage || (photo ? `/yangzhou/images/${metadata.photo}.webp` : ''), photo: customImage ? null : photo, photoKind: customImage ? '自定义照片' : metadata.photoKind, mapSpec: metadata.map };
    });
  }
  function targetsFor(entry) {
    if (entry.mapSpec?.enabled === false) return [];
    if (entry.mapSpec?.street) return [];
    if (entry.mapSpec?.targets) return entry.mapSpec.targets;
    const branchFromName = entry.name.match(/[（(]([^）)]+)[）)]/);
    let branch = entry.branch || branchFromName?.[1] || '';
    // Infer only explicit positive phrasing, never mentions of disliked branches.
    if (!branch) {
      const text = entry.detailHTML.replace(/<[^>]*>/g, '');
      branch = text.match(/(?:只去过|只推荐|要去)([\u4e00-\u9fff]{2,10}(?:路|池|街))(?:那家|总店|店)/)?.[1] || text.match(/总店在([\u4e00-\u9fff]{2,10}(?:路|街))/)?.[1] || '';
    }
    return entry.name.replace(/[（(][^）)]+[）)]/, '').split(/[、，,]/).map(name => ({ name: name.trim(), branch, address: branch ? [branch.replace(/(?:总店|店)$/, '')] : [], kind: entry.category === '景点' ? 'sight' : 'food', single: entry.category === '景点' }));
  }
  function mapEligible(entry) {
    if (entry.mapSpec?.enabled === false) return false;
    return targetsFor(entry).some(target => target.branch) || !['npc', 'bad'].includes(entry.tier);
  }
  function matchPoi(poi, target) {
    const name = normalize(poi.name);
    const aliases = [target.name, ...(target.aliases || [])].map(normalize);
    if (!(target.single ? aliases.includes(name) : aliases.some(alias => name.includes(alias)))) return false;
    if (poi.cityname && !poi.cityname.includes('扬州')) return false;
    if (target.branch) {
      const haystack = normalize(`${poi.name}${poi.address || ''}`);
      const hints = (target.address?.length ? target.address : [target.branch.replace(/(?:总店|店)$/, '') || target.branch]).filter(Boolean);
      if (!hints.some(hint => haystack.includes(normalize(hint)))) return false;
    }
    return !!poi.location;
  }
  const validCoordinate = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
  /* Adapted from wandergis/coordtransform (https://github.com/wandergis/coordtransform).
   * MIT License. Copyright (c) 2015 记忆的残骸.
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   */
  function wgs84ToGcj02(point) {
    if (!validCoordinate(point)) throw new Error('坐标不是有效经纬度');
    const [lng, lat] = point;
    if (!(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)) return [lng, lat];
    const x = lng - 105; const y = lat - 35; const pi = Math.PI;
    let dlat = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    dlat += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
    dlat += (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3;
    dlat += (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3;
    let dlng = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    dlng += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
    dlng += (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3;
    dlng += (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3;
    const a = 6378245; const eccentricity = 0.00669342162296594323;
    const rad = lat / 180 * pi; const magic = 1 - eccentricity * Math.sin(rad) ** 2; const sqrt = Math.sqrt(magic);
    dlat = dlat * 180 / ((a * (1 - eccentricity)) / (magic * sqrt) * pi);
    dlng = dlng * 180 / (a / sqrt * Math.cos(rad) * pi);
    return [Number((lng + dlng).toFixed(7)), Number((lat + dlat).toFixed(7))];
  }
  const targetKey = target => `${normalize(target.name)}|${normalize(target.branch) || '*'}|${target.kind || 'food'}`;
  const targetFingerprint = target => JSON.stringify([normalize(target.name), (target.aliases || []).map(normalize).sort(), normalize(target.branch), (target.address || []).map(normalize).sort(), target.kind || 'food', !!target.single]);
  const streetFingerprint = spec => JSON.stringify([plain(spec.from), plain(spec.to)]);
  const validCatalog = catalog => catalog?.version === 1 && catalog.coordinateSystem === 'GCJ-02';
  function staticPlacesFor(target, catalog) {
    const saved = validCatalog(catalog) ? catalog.targets?.[targetKey(target)] : null;
    if (!saved) return { places: [], issue: '尚未录入静态坐标' };
    if (saved.fingerprint !== targetFingerprint(target)) return { places: [], issue: '名称或分店规则已改变，请重新确认坐标' };
    const locations = Array.isArray(saved.locations) ? saved.locations : [];
    const places = locations.filter(poi => poi?.confirmed === true && validCoordinate(poi.location) && matchPoi(poi, target));
    if ((target.branch || target.single) && places.length > 1) return { places: [], issue: '指定分店／景点有多个坐标，请先核对' };
    if (places.length !== locations.length) return { places, issue: '部分坐标未确认、格式错误或不符合分店规则' };
    if (!places.length) return { places, issue: '尚无已确认坐标' };
    return { places, issue: saved.complete === true ? '' : '已显示录入的门店，全部分店仍待确认' };
  }
  function staticStreetFor(entry, catalog) {
    const saved = validCatalog(catalog) ? catalog.streets?.[normalize(entry.name)] : null;
    if (!saved) return { issue: '尚未录入街道沿线坐标' };
    if (saved.fingerprint !== streetFingerprint(entry.mapSpec.street)) return { issue: '街道起终点已改变，请重新确认沿线' };
    if (saved.confirmed !== true || !Array.isArray(saved.path) || saved.path.length < 2 || !saved.path.every(validCoordinate)) return { issue: '街道沿线坐标未确认或格式错误' };
    return { street: saved };
  }
  return { tiers, plain, normalize, tierOf, labelOf, ratingScore, compareRatings, readEntries, decorate, targetsFor, mapEligible, matchPoi, validCoordinate, wgs84ToGcj02, targetKey, targetFingerprint, streetFingerprint, validCatalog, staticPlacesFor, staticStreetFor };
});
