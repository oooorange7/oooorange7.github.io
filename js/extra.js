(function () {
  function isMdContentImage(el) {
    if (!el || el.tagName !== 'IMG') return false;
    if (el.classList.contains('error')) return false;
    // Only intercept real content images (usually rendered as <p><img ...></p>)
    // Avoid hijacking UI icons (share buttons, footer icons, etc.) that also live inside .md-text.
    const mdRoot = el.closest('article.md-text, .md-text');
    if (!mdRoot) return false;

    // Exclude common non-content areas
    if (el.closest('.article-footer, #share, .social-wrap, .share-item, footer, header, nav')) return false;

    // Content images in this theme are typically placed directly inside paragraphs
    const p = el.closest('p');
    if (!p) return false;

    // Ensure the paragraph belongs to the markdown article body, not footers/widgets
    if (p.closest('.article-footer, #share, .social-wrap')) return false;
    return true;
  }

  function getFullImageSrc(img) {
    const dataSrc = img.getAttribute('data-src') || img.dataset?.src;
    const src = img.getAttribute('src');

    // Stellar lazyload uses a tiny placeholder in src and real url in data-src
    if (dataSrc && src && src.startsWith('data:image')) return dataSrc;
    return dataSrc || src;
  }

  function getGallerySlides(root) {
    const container = root || document;
    const imgs = Array.from(container.querySelectorAll('article.md-text p>img, .md-text p>img'))
      .filter((img) => !img.classList.contains('error'));

    const slides = imgs
      .map((img) => {
        const src = getFullImageSrc(img);
        if (!src) return null;
        return {
          src,
          type: 'image',
          caption: img.getAttribute('alt') || img.dataset?.caption || ''
        };
      })
      .filter(Boolean);

    return { imgs, slides };
  }

  async function ensureFancyboxLoaded() {
    if (window.Fancybox) return true;

    // Try to load it via Stellar's utils + ctx config (if present)
    if (window.utils && window.ctx && window.ctx.fancybox) {
      try {
        if (window.ctx.fancybox.css) window.utils.css(window.ctx.fancybox.css);
        if (window.ctx.fancybox.js) await window.utils.js(window.ctx.fancybox.js, { defer: true });
        return !!window.Fancybox;
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  function showFancyboxAtIndex(slides, startIndex) {
    // Fancybox v5
    window.Fancybox.show(slides, {
      startIndex,
      hideScrollbar: false,
      Thumbs: {
        autoStart: false
      }
    });
  }

  // Make images feel clickable
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('article.md-text p>img, .md-text p>img').forEach((img) => {
      if (img && img.style) img.style.cursor = 'zoom-in';
    });
  });

  // Capture phase to override Stellar's default Fancybox.bind on img (which may use placeholder src)
  document.addEventListener(
    'click',
    async function (event) {
      const target = event.target;
      if (!isMdContentImage(target)) return;

      const { imgs, slides } = getGallerySlides(target.closest('article.md-text, .md-text'));
      if (!slides.length) return;

      const clickedSrc = getFullImageSrc(target);
      const startIndex = Math.max(0, slides.findIndex((s) => s.src === clickedSrc));

      const ok = await ensureFancyboxLoaded();
      if (!ok) return;

      event.preventDefault();
      event.stopPropagation();

      showFancyboxAtIndex(slides, startIndex);
    },
    true
  );
})();
