(() => {
  const page = document.querySelector('[data-yangzhou-page]');
  if (!page || !window.YangzhouModel) return;
  const model = window.YangzhouModel;
  const data = JSON.parse(document.querySelector('[data-yangzhou-data]').textContent);
  const source = page.querySelector('[data-yangzhou-source]');
  const entries = model.decorate(model.readEntries(source), data);
  const tierList = page.querySelector('[data-tier-list]');
  const dialog = document.querySelector('[data-entry-dialog]');
  const palette = ['#82b6ca', '#9ab9a4', '#cdb69a', '#a9a4c5'];
  let activeCategory = '全部';
  page.querySelector('[data-entry-count]').textContent = entries.length;
  const countSuffix = page.querySelector('[data-entry-count]').nextSibling;
  if (countSuffix?.nodeType === 3) countSuffix.textContent = ' 条评价 · 持续更新';

  function photoImage(entry, className) {
    const img = document.createElement('img');
    img.className = className;
    img.src = entry.image;
    img.alt = `${entry.name}：${entry.photoKind || '参考照片'}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    return img;
  }
  function openDialog(entry, poi) {
    dialog.querySelector('[data-dialog-title]').textContent = poi?.name || entry.name;
    dialog.querySelector('[data-dialog-meta]').textContent = `${entry.category}${entry.group ? ` · ${entry.group}` : ''} / ${entry.rating === '/' ? '待吃' : entry.rating === '*' ? '待评' : entry.rating || '待评'}`;
    dialog.querySelector('[data-dialog-content]').innerHTML = entry.detailHTML;
    const location = dialog.querySelector('[data-dialog-location]');
    location.hidden = !poi || !(poi.address || poi.rangeLabel);
    location.textContent = poi ? [poi.address, poi.rangeLabel].filter(Boolean).join(' · ') : '';
    const cover = dialog.querySelector('[data-dialog-cover]');
    cover.replaceChildren();
    if (entry.image) cover.append(photoImage(entry, 'yz-dialog-photo'));
    const credit = dialog.querySelector('[data-photo-credit]');
    credit.replaceChildren();
    credit.hidden = !entry.photo;
    if (entry.photo) {
      const kind = entry.photoKind || '参考图';
      if (!entry.photo.credit.includes(kind)) credit.append(document.createTextNode(`${kind} · `));
      if (entry.photo.source) {
        const link = document.createElement('a');
        link.textContent = `图片来源：${entry.photo.credit}`;
        link.href = entry.photo.source;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        credit.append(link);
      } else {
        // Uploaded photos can have truthful attribution without a source URL.
        credit.append(document.createTextNode(`图片来源：${entry.photo.credit}`));
      }
    }
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function cardFor(entry, index) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'yz-card';
    card.setAttribute('aria-label', `查看${entry.name}的评价详情`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-controls', 'yz-entry-dialog');
    const cover = document.createElement('span'); cover.className = 'yz-card-cover';
    cover.style.setProperty('--card-color', palette[index % palette.length]);
    if (entry.image) cover.append(photoImage(entry, 'yz-card-photo'));
    const copy = document.createElement('span'); copy.className = 'yz-card-copy';
    const name = document.createElement('strong'); name.textContent = entry.name;
    const rating = document.createElement('small'); rating.textContent = entry.rating === '/' ? '待吃' : entry.rating === '*' ? '待评' : entry.rating || '待评';
    copy.append(name, rating); card.append(cover, copy);
    card.addEventListener('click', () => openDialog(entry));
    return card;
  }
  function render() {
    tierList.replaceChildren();
    const filtered = entries.filter(entry => activeCategory === '全部' || entry.category === activeCategory);
    model.tiers.forEach(tier => {
      const row = document.createElement('section'); row.className = 'yz-tier-row'; row.style.setProperty('--tier-color', tier.color);
      row.setAttribute('data-yz-reveal', '');
      const title = document.createElement('h2'); title.className = 'yz-tier-name'; title.textContent = tier.label;
      const cards = document.createElement('div'); cards.className = 'yz-tier-cards';
      const items = filtered.filter(entry => entry.tier === tier.id).sort(model.compareRatings);
      if (items.length) {
        const groups = new Map();
        items.forEach(entry => {
          const score = model.ratingScore(entry.rating);
          if (!groups.has(score)) groups.set(score, []);
          groups.get(score).push(entry);
        });
        groups.forEach(group => {
          const block = document.createElement('div'); block.className = 'yz-rating-group';
          if (groups.size > 1) {
            const label = document.createElement('p'); label.className = 'yz-rating-label';
            label.textContent = [...new Set(group.map(entry => entry.rating))].join(' / ');
            block.append(label);
          }
          const grid = document.createElement('div'); grid.className = 'yz-rating-grid';
          group.forEach((entry, i) => grid.append(cardFor(entry, i)));
          block.append(grid); cards.append(block);
        });
      }
      else { const empty = document.createElement('p'); empty.className = 'yz-empty'; empty.textContent = '这一档还没有条目。'; cards.append(empty); }
      row.append(title, cards); tierList.append(row);
    });
    document.dispatchEvent(new Event('yangzhou:content-change'));
  }
  const tabs = page.querySelector('[data-category-tabs]');
  ['全部', ...new Set(entries.map(entry => entry.category))].forEach(category => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = category;
    button.classList.toggle('is-active', category === activeCategory); button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category;
      [...tabs.children].forEach(tab => { tab.classList.toggle('is-active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
      render();
    });
    tabs.append(button);
  });
  const mapView = window.createYangzhouMap({ page, entries, config: data.amap, coordinates: data.coordinates, model, openDialog });
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  const controls = [...page.querySelectorAll('[data-view]')];
  const panels = [...page.querySelectorAll('[data-panel]')];
  const content = page.querySelector('#yz-content');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const modes = {
    tier: { title: '用一张榜单，认识一座城。', description: '吃过的认真评，想去的慢慢补。评价很主观，出发前请结合原文。', action: '向下阅读前言', contentAction: '查看榜单' },
    map: { title: '把想去的，放在地图上。', description: '按位置找店 · 查看附近。只显示评级，点开才是地点和评价。', action: '向下阅读前言', contentAction: '打开评级地图' },
    markdown: { title: '完整记录，慢慢读。', description: '保留完整章节与评价，安静地读这份私人指南。', action: '向下阅读前言', contentAction: '阅读完整原文' }
  };
  let activeView = 'tier';
  let mapNearViewport = !('IntersectionObserver' in window);
  if ('IntersectionObserver' in window) {
    const mapObserver = new IntersectionObserver(items => {
      mapNearViewport = items.some(item => item.isIntersecting);
      if (mapNearViewport && activeView === 'map') mapView.show();
    }, { rootMargin: '160px 0px', threshold: 0 });
    mapObserver.observe(page.querySelector('.yz-reading-stage'));
  }
  function setView(view, { persist = true, navigate = false, animate = true } = {}) {
    if (!modes[view]) return;
    activeView = view;
    page.dataset.activeView = view;
    controls.forEach(item => {
      const selected = item.dataset.view === view;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
    for (const [selector, key] of [['[data-mode-heading]', 'title'], ['[data-mode-description]', 'description'], ['[data-explore-label]', 'action'], ['[data-content-explore-label]', 'contentAction']]) {
      const element = page.querySelector(selector); if (element) element.textContent = modes[view][key];
    }
    if (view === 'map' && mapNearViewport) mapView.show();
    if (navigate) content.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    const panel = panels.find(item => item.dataset.panel === view);
    if (animate && !reduced.matches && panel?.animate) panel.animate([{ opacity: .3, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.65,.25,1)' });
    if (persist) try { localStorage.setItem('yangzhou-view', view); } catch {}
    document.dispatchEvent(new Event('yangzhou:content-change'));
  }
  controls.forEach(button => button.addEventListener('click', () => setView(button.dataset.view, { navigate: button.dataset.viewOrigin === 'dock' })));
  render();
  let initialView = 'tier';
  try {
    const saved = localStorage.getItem('yangzhou-view');
    if (modes[saved]) initialView = saved;
  } catch {}
  setView(initialView, { persist: false, animate: false });
})();
