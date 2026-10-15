window.createYangzhouMap = function ({ page, entries, config, coordinates, model, openDialog }) {
  const panel = page.querySelector('[data-panel="map"]');
  const canvas = panel.querySelector('[data-map-canvas]');
  const status = panel.querySelector('[data-map-status]');
  const unavailable = panel.querySelector('[data-map-unavailable]');
  const locateButton = panel.querySelector('[data-map-locate]');
  const fitButton = panel.querySelector('[data-map-fit]');
  // Remove the former maintenance panel in an older local-preview wrapper too.
  panel.querySelector('[data-map-issues]')?.remove?.();
  let dataCredit = panel.querySelector('[data-map-data-credit]');
  if (!dataCredit) {
    dataCredit = document.createElement('p'); dataCredit.className = 'yz-map-note'; dataCredit.hidden = true;
    dataCredit.setAttribute('data-map-data-credit', '');
    const attribution = document.createElement('a'); attribution.href = 'https://www.openstreetmap.org/copyright';
    attribution.textContent = '© OpenStreetMap contributors · ODbL'; attribution.target = '_blank'; attribution.rel = 'noopener noreferrer';
    const download = document.createElement('a'); download.href = '/yangzhou/coordinates.json'; download.textContent = ' · 地图数据';
    dataCredit.append(attribution, download); panel.append(dataCredit);
  }
  const records = new Map();
  let activeCategory = '全部';
  let map;
  let api;
  let starting;
  let positionMarker;
  let accuracyCircle;
  const eligible = entries.filter(model.mapEligible);
  let incomplete = false;
  function markerContent(entry) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'yz-map-marker';
    button.textContent = model.labelOf(entry);
    button.setAttribute('aria-label', `${model.labelOf(entry)}，点击显示地点与详情`);
    button.style.setProperty('--tier-color', model.tiers.find(tier => tier.id === entry.tier).color);
    return button;
  }
  function applyFilter() {
    let shown = 0;
    records.forEach(record => {
      const visible = activeCategory === '全部' || record.entry.category === activeCategory;
      [...record.overlays].forEach(overlay => visible ? overlay.show() : overlay.hide());
      if (visible) shown++;
    });
    requestAnimationFrame(layoutMarkers);
    return shown;
  }
  function layoutMarkers() {
    if (!map?.lngLatToContainer || !api?.Pixel) return;
    const boxes = [];
    const offsets = [[0, 0], [0, 44], [-76, 0], [76, 0], [0, -44], [-76, 44], [76, 44], [-76, -44], [76, -44], [0, 88]];
    records.forEach(record => {
      if (record.leader) { map.remove(record.leader); record.overlays = record.overlays.filter(overlay => overlay !== record.leader); record.leader = null; }
      if (activeCategory !== '全部' && record.entry.category !== activeCategory) return;
      const pixel = map.lngLatToContainer(record.position);
      const x = pixel.getX(); const y = pixel.getY();
      const width = record.content.offsetWidth || (model.labelOf(record.entry).length * 14 + 24);
      const height = record.content.offsetHeight || 35;
      let offset = offsets.at(-1); let box;
      for (const candidate of offsets) {
        const next = { left: x + candidate[0] - width / 2 - 4, right: x + candidate[0] + width / 2 + 4, top: y + candidate[1] - height - 4, bottom: y + candidate[1] + 4 };
        if (!boxes.some(other => next.left < other.right && next.right > other.left && next.top < other.bottom && next.bottom > other.top)) { offset = candidate; box = next; break; }
      }
      boxes.push(box || { left: x + offset[0] - width / 2 - 4, right: x + offset[0] + width / 2 + 4, top: y + offset[1] - height - 4, bottom: y + offset[1] + 4 });
      record.marker.setOffset(new api.Pixel(offset[0], offset[1]));
      if (offset[0] || offset[1]) {
        record.leader = new api.Polyline({ path: [record.position, map.containerToLngLat(new api.Pixel(x + offset[0], y + offset[1]))], strokeColor: '#52788b', strokeWeight: 1, strokeOpacity: 0.65, zIndex: 110, bubble: false });
        record.overlays.push(record.leader); map.add(record.leader);
      }
    });
  }
  function fit() {
    if (!map) return;
    const visible = [...records.values()].filter(record => activeCategory === '全部' || record.entry.category === activeCategory).flatMap(record => record.overlays.filter(overlay => overlay !== record.leader));
    if (visible.length) map.setFitView(visible, false, [48, 48, 48, 48], 16);
  }
  ['全部', ...new Set(eligible.map(entry => entry.category))].forEach(category => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = category;
    button.classList.toggle('is-active', category === activeCategory);
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category;
      [...button.parentElement.children].forEach(tab => { tab.classList.toggle('is-active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
      if (map) { const count = applyFilter(); fit(); status.textContent = `当前分类 ${count} 个地点。点击评级查看详情。`; }
    });
    panel.querySelector('[data-map-tabs]').append(button);
  });
  model.tiers.forEach(tier => {
    const badge = document.createElement('span'); badge.className = 'yz-map-key'; badge.textContent = tier.label;
    badge.style.setProperty('--tier-color', tier.color); panel.querySelector('[data-map-legend]').append(badge);
  });
  function loadApi() {
    if (window.AMapLoader) return load();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove(); reject(new Error('地图服务加载超时，请检查网络后刷新页面。')); }, 15000);
      script.src = 'https://webapi.amap.com/loader.js';
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('无法连接高德地图，请检查网络后刷新页面。')); };
      document.head.append(script);
    }).then(load);
    function load() {
      window._AMapSecurityConfig = { serviceHost: config.service_host };
      let timeout;
      return Promise.race([
        window.AMapLoader.load({ key: config.key, version: '2.0', plugins: ['AMap.Scale', 'AMap.ToolBar'] }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('地图加载超时，请稍后重试。')), 20000); })
      ]).finally(() => clearTimeout(timeout));
    }
  }
  function addPlace(entry, poi, range) {
    const id = poi.id || `${poi.name}:${poi.location}`;
    const previous = records.get(id);
    // A combined rated review supersedes the table's pending cross-reference.
    if (previous) {
      if (previous.entry.tier !== 'unrated' || entry.tier === 'unrated') return;
      map.remove(previous.overlays); records.delete(id);
    }
    const content = markerContent(entry);
    const marker = new api.Marker({ position: poi.location, content, anchor: 'bottom-center', zIndex: 150, bubble: false });
    const overlays = [marker];
    content.addEventListener('click', event => { event.stopPropagation(); openDialog(entry, { ...poi, rangeLabel: range?.label }); });
    if (range?.radius) {
      const area = new api.Circle({ center: poi.location, radius: range.radius, strokeColor: '#2094f3', strokeWeight: 2, strokeStyle: 'dashed', fillColor: '#2094f3', fillOpacity: 0.08, bubble: true, zIndex: 40 });
      area.on('click', () => openDialog(entry, { ...poi, rangeLabel: range.label })); overlays.push(area);
    }
    if (range?.polygon?.length >= 3) {
      const area = new api.Polygon({ path: range.polygon, strokeColor: '#2094f3', strokeWeight: 2, strokeStyle: 'dashed', fillColor: '#2094f3', fillOpacity: 0.08, bubble: true, zIndex: 40 });
      area.on('click', () => openDialog(entry, { ...poi, rangeLabel: range.label })); overlays.push(area);
    }
    map.add(overlays); records.set(id, { entry, overlays, marker, content, position: poi.location }); applyFilter();
  }
  function addStreet(entry, saved) {
    const routePath = saved.path;
    const middle = routePath[Math.floor(routePath.length / 2)];
    const poi = { id: `street:${entry.name}`, name: entry.name, address: '汶河路至皮市街', location: middle, rangeLabel: '街道沿线示意，非导航路线' };
    addPlace(entry, poi);
    const line = new api.Polyline({ path: routePath, strokeColor: '#2094f3', strokeWeight: 12, strokeOpacity: 0.28, lineJoin: 'round', lineCap: 'round', zIndex: 40 });
    line.on('click', () => openDialog(entry, poi));
    records.get(poi.id).overlays.push(line); map.add(line); applyFilter();
  }
  function populate() {
    if (dataCredit) dataCredit.hidden = coordinates?.license !== 'ODbL-1.0';
    eligible.forEach(entry => {
      if (entry.mapSpec?.street) {
        const result = model.staticStreetFor(entry, coordinates);
        if (result.issue) incomplete = true;
        else addStreet(entry, result.street);
        return;
      }
      model.targetsFor(entry).forEach(item => {
        const target = { kind: entry.category === '景点' ? 'sight' : 'food', ...item };
        const result = model.staticPlacesFor(target, coordinates);
        if (result.issue) incomplete = true;
        result.places.forEach(poi => addPlace(entry, poi, poi.range || entry.mapSpec?.range));
      });
    });
    const count = applyFilter();
    status.textContent = count ? `已收录 ${count} 处地点${incomplete ? '，地图持续补充中' : ''}。` : '地图地点持续补充中，可以先查看榜单和原文。';
    fit();
  }
  locateButton.addEventListener('click', async () => {
    if (!map) return;
    locateButton.disabled = true; status.textContent = '正在请求当前位置，请在浏览器中允许定位。';
    try {
      if (window.isSecureContext === false) throw new Error('当前页面无法使用定位，请通过 HTTPS 链接访问。');
      if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('此浏览器不支持定位，请换用支持定位的浏览器。');
      // Native browser coordinates are WGS-84. Convert once on this device;
      // do not call AMap online location, geocoding or conversion services.
      const location = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('浏览器定位超时，请检查设备定位服务或稍后重试。')), 15000);
        navigator.geolocation.getCurrentPosition(result => { clearTimeout(timer); resolve(result); }, error => {
          clearTimeout(timer);
          reject(new Error(({ 1: '浏览器或系统未允许定位，请在站点权限和设备设置中开启。', 2: '设备暂时无法取得位置，请检查系统定位服务；手机通常更容易取得位置。', 3: '浏览器定位超时，请稍后重试。' })[error.code] || '浏览器定位失败，请检查设备定位服务。'));
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      });
      const position = model.wgs84ToGcj02([location.coords?.longitude, location.coords?.latitude]);
      const accuracy = Number.isFinite(location.coords?.accuracy) && location.coords.accuracy > 0 ? location.coords.accuracy : 0;
      if (positionMarker) map.remove(positionMarker);
      if (accuracyCircle) map.remove(accuracyCircle);
      const content = document.createElement('span'); content.className = 'yz-current-location'; content.setAttribute('aria-label', '我的位置');
      positionMarker = new api.Marker({ position, content, anchor: 'center', zIndex: 200 });
      map.add(positionMarker);
      if (accuracy) {
        accuracyCircle = new api.Circle({ center: position, radius: accuracy, strokeWeight: 0, fillColor: '#2094f3', fillOpacity: 0.14 }); map.add(accuracyCircle);
      }
      map.setZoomAndCenter(accuracy > 1000 ? 13 : 16, position);
      status.textContent = `已显示当前位置${accuracy ? `，精度约 ${Math.round(accuracy)} 米` : ''}${accuracy > 1000 ? '，仅供大致参考' : ''}。`;
    } catch (error) { status.textContent = `定位未成功：${error.message}`; }
    finally { locateButton.disabled = false; }
  });
  fitButton.addEventListener('click', fit);
  return {
    async show() {
      if (!config.key || !config.service_host) {
        unavailable.hidden = false; status.textContent = '地图暂时不可用，请稍后再试。'; return;
      }
      if (map) { requestAnimationFrame(() => map.resize()); return; }
      if (starting) return;
      status.textContent = '正在连接高德地图…';
      starting = (async () => {
        try {
          // Also supports an already-running Hexo preview with an older page wrapper.
          // This fetch is a static file on this blog, never a provider place search.
          if (!coordinates) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
              const response = await fetch('/yangzhou/coordinates.json', { cache: 'no-cache', signal: controller.signal });
              if (!response.ok) throw new Error();
              coordinates = await response.json();
            } catch { throw new Error('地图地点暂时无法加载，请稍后重试。'); }
            finally { clearTimeout(timeout); }
          }
          api = await loadApi(); canvas.hidden = false;
          map = new api.Map(canvas, { center: [119.428, 32.394], zoom: 13, viewMode: '2D', features: ['bg', 'road', 'building'], showLabel: false });
          if (map.on) ['complete', 'zoomend', 'moveend', 'resize'].forEach(event => map.on(event, layoutMarkers));
          map.addControl(new api.Scale()); map.addControl(new api.ToolBar());
          locateButton.disabled = false; fitButton.disabled = false;
          populate();
        } catch { canvas.hidden = true; unavailable.hidden = false; status.textContent = '地图暂时无法加载，请稍后刷新重试。'; starting = null; }
      })();
      await starting;
    }
  };
};
