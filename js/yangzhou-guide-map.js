(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.mountAll(document);
})(function () {
  // Offline SVG maps: no tiles, location requests, SDKs or search endpoints.
  function layoutLabels(labels, { zoom = 1, x = 0, y = 0, width = 960, height = 660, viewportWidth = width, viewportHeight = height, pins = [] } = {}) {
    const screenScale = Math.min(viewportWidth / width, viewportHeight / height);
    const density = viewportWidth < 500 ? .82 : 1;
    const fontScale = density / Math.max(.01, screenScale * zoom);
    const left = (viewportWidth - width * screenScale) / 2;
    const top = (viewportHeight - height * screenScale) / 2;
    const boxes = pins.map(pin => {
      const cx = left + (pin.x * zoom + x) * screenScale;
      const cy = top + (pin.y * zoom + y) * screenScale;
      const radius = 15 * density;
      return { left: cx - radius, right: cx + radius, top: cy - radius, bottom: cy + radius };
    });
    const visible = [], positions = {};
    const limit = viewportWidth < 500 ? 17 : 38;
    for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
      if (label.minZoom > zoom) continue;
      const labelX = (label.baseX ?? label.x) + (label.offsetX || 0) * fontScale;
      const labelY = (label.baseY ?? label.y) + (label.offsetY || 0) * fontScale;
      const cx = left + (labelX * zoom + x) * screenScale;
      const cy = top + (labelY * zoom + y) * screenScale;
      const w = label.width * density, h = label.height * density;
      const anchor = label.anchor || 'middle';
      if (visible.length >= limit && label.priority < 90) continue;
      // Essential names get nearby alternatives before being hidden. Never pull
      // an offscreen feature back into view when the reader pans or zooms.
      const featureX = left + ((label.baseX ?? label.x) * zoom + x) * screenScale;
      const featureY = top + ((label.baseY ?? label.y) * zoom + y) * screenScale;
      if (featureX < 0 || featureX > viewportWidth || featureY < 0 || featureY > viewportHeight) continue;
      const essential = label.priority >= 90;
      const step = Math.max(20, h + 9);
      const alternatives = essential ? [[0, 0], [0, step], [0, -step], [24, 0], [-24, 0], [48, 0], [-48, 0], [0, step * 2], [0, -step * 2], [48, step], [-48, step], [48, -step], [-48, -step]] : [[0, 0]];
      for (const [dx, dy] of alternatives) {
        let px = cx + dx, py = cy + dy;
        const inset = anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0;
        if (essential) {
          px = Math.max(12 + inset, Math.min(viewportWidth - 12 - w + inset, px));
          py = Math.max(12 + h, Math.min(viewportHeight - 12, py));
        }
        const labelLeft = px - inset;
        const box = { left: labelLeft - 5, right: labelLeft + w + 5, top: py - h - 4, bottom: py + 5 };
        if (box.left < 7 || box.right > viewportWidth - 7 || box.top < 7 || box.bottom > viewportHeight - 7) continue;
        if (boxes.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
        boxes.push(box); visible.push(label.id);
        positions[label.id] = { x: ((px - left) / screenScale - x) / zoom, y: ((py - top) / screenScale - y) / zoom };
        break;
      }
    }
    return { fontScale, visible, positions };
  }
  function mount(figure, doc) {
    if (figure.dataset.guideMapReady === 'true') return;
    const stage = figure.querySelector('[data-guide-map-stage]');
    const svg = figure.querySelector('svg');
    const scene = figure.querySelector('[data-guide-map-scene]');
    if (!stage || !svg || !scene) return;
    figure.dataset.guideMapReady = 'true';
    const width = Number(figure.dataset.mapWidth) || 960;
    const height = Number(figure.dataset.mapHeight) || 660;
    const output = figure.querySelector('[data-guide-zoom-level]');
    const zoomIn = figure.querySelector('[data-guide-zoom="in"]');
    const zoomOut = figure.querySelector('[data-guide-zoom="out"]');
    const interact = figure.querySelector('[data-guide-map-interact]');
    const labelNodes = [...(figure.querySelectorAll?.('[data-guide-label]') || [])];
    const pins = [...(figure.querySelectorAll?.('[data-guide-map-pin]') || [])];
    const labels = labelNodes.map((node, id) => ({ id, x: Number(node.dataset.labelX), y: Number(node.dataset.labelY), baseX: Number(node.dataset.labelBaseX ?? node.dataset.labelX), baseY: Number(node.dataset.labelBaseY ?? node.dataset.labelY), offsetX: Number(node.dataset.labelDx || 0), offsetY: Number(node.dataset.labelDy || 0), width: Number(node.dataset.labelWidth), height: Number(node.dataset.labelHeight), priority: Number(node.dataset.labelPriority), minZoom: Number(node.dataset.labelZoom), anchor: node.dataset.labelAnchor }));
    const pinPositions = pins.map(node => ({ x: Number(node.dataset.pinX), y: Number(node.dataset.pinY) }));
    let zoom = 1, x = 0, y = 0, interactive = false;
    let gesture;
    const pointers = new Map();
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    function point(clientX, clientY) {
      const matrix = svg.getScreenCTM?.();
      if (matrix && typeof DOMPoint === 'function') {
        const local = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
        return { x: local.x, y: local.y };
      }
      const rect = svg.getBoundingClientRect();
      return { x: (clientX - rect.left) / Math.max(1, rect.width) * width, y: (clientY - rect.top) / Math.max(1, rect.height) * height };
    }
    function draw() {
      x = clamp(x, -width * (zoom - 1), 0);
      y = clamp(y, -height * (zoom - 1), 0);
      scene.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${zoom.toFixed(3)})`);
      const rect = svg.getBoundingClientRect();
      const layout = layoutLabels(labels, { zoom, x, y, width, height, viewportWidth: rect.width || width, viewportHeight: rect.height || height, pins: pinPositions });
      scene.style?.setProperty('--yg-label-scale', layout.fontScale.toFixed(4));
      const visible = new Set(layout.visible);
      labelNodes.forEach((node, id) => {
        node.setAttribute('data-label-visible', String(visible.has(id)));
        const position = layout.positions[id];
        if (position) { node.setAttribute('x', position.x.toFixed(2)); node.setAttribute('y', position.y.toFixed(2)); }
      });
      pins.forEach(node => node.setAttribute('transform', `scale(${layout.fontScale.toFixed(4)})`));
      if (output) output.textContent = `${Math.round(zoom * 100)}%`;
      if (zoomOut) zoomOut.disabled = zoom <= 1;
      if (zoomIn) zoomIn.disabled = zoom >= 4;
      stage.dataset.zoomed = String(zoom > 1);
      figure.dataset.mapDetail = zoom >= 2 ? 'street' : zoom >= 1.3 ? 'neighborhood' : 'overview';
    }
    function setZoom(next, anchor = { x: width / 2, y: height / 2 }) {
      const target = clamp(next, 1, 4);
      const ratio = target / zoom;
      x = anchor.x - (anchor.x - x) * ratio;
      y = anchor.y - (anchor.y - y) * ratio;
      zoom = target; draw();
    }
    zoomIn?.addEventListener('click', () => setZoom(zoom * 1.35));
    zoomOut?.addEventListener('click', () => setZoom(zoom / 1.35));
    figure.querySelector('[data-guide-map-reset]')?.addEventListener('click', () => { zoom = 1; x = 0; y = 0; draw(); });
    interact?.addEventListener('click', () => {
      interactive = !interactive;
      stage.dataset.interactive = String(interactive);
      interact.setAttribute('aria-pressed', String(interactive));
      interact.textContent = interactive ? '完成移动' : '移动地图';
      if (!interactive) { pointers.clear(); gesture = undefined; }
    });
    stage.addEventListener('keydown', event => {
      if (event.target !== stage) return;
      const amount = 60;
      if (['+', '='].includes(event.key)) setZoom(zoom * 1.35);
      else if (['-', '_'].includes(event.key)) setZoom(zoom / 1.35);
      else if (event.key === 'Home' || event.key === '0') { zoom = 1; x = 0; y = 0; draw(); }
      else if (event.key === 'ArrowLeft') { x += amount; draw(); }
      else if (event.key === 'ArrowRight') { x -= amount; draw(); }
      else if (event.key === 'ArrowUp') { y += amount; draw(); }
      else if (event.key === 'ArrowDown') { y -= amount; draw(); }
      else return;
      event.preventDefault();
    });
    // Normal wheel/touch input still scrolls the article. Map zoom requires Ctrl.
    stage.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoom * Math.exp(-event.deltaY * .004), point(event.clientX, event.clientY));
    }, { passive: false });
    const snapshot = () => {
      const points = [...pointers.values()];
      gesture = { points, x, y, zoom };
      if (points.length >= 2) {
        gesture.distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        gesture.center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      }
    };
    stage.addEventListener('pointerdown', event => {
      // A nested interaction button must keep its own click target/capture.
      if (event.target?.closest?.('button, a, input, select, textarea')) return;
      if (event.pointerType === 'touch' && !interactive) return;
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      pointers.set(event.pointerId, point(event.clientX, event.clientY));
      stage.setPointerCapture?.(event.pointerId);
      stage.dataset.dragging = 'true'; snapshot();
    });
    stage.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      pointers.set(event.pointerId, point(event.clientX, event.clientY));
      const points = [...pointers.values()];
      if (points.length >= 2 && gesture.distance) {
        const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        zoom = clamp(gesture.zoom * distance / Math.max(1, gesture.distance), 1, 4);
        x = center.x - (gesture.center.x - gesture.x) * zoom / gesture.zoom;
        y = center.y - (gesture.center.y - gesture.y) * zoom / gesture.zoom;
      } else if (points.length === 1) {
        x = gesture.x + points[0].x - gesture.points[0].x;
        y = gesture.y + points[0].y - gesture.points[0].y;
      }
      draw();
    });
    const finish = event => {
      pointers.delete(event.pointerId);
      if (pointers.size) snapshot();
      else { gesture = undefined; stage.dataset.dragging = 'false'; }
    };
    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', finish);
    stage.addEventListener('lostpointercapture', finish);
    if (typeof ResizeObserver === 'function') new ResizeObserver(draw).observe(stage);
    doc?.addEventListener?.('yangzhou:content-change', draw);
    draw();
  }
  function mountAll(doc) { doc.querySelectorAll('[data-guide-map]').forEach(figure => mount(figure, doc)); }
  return { layoutLabels, mountAll };
});
