(() => {
  const page = document.querySelector('.yz-story');
  if (!page) return;
  const cover = page.querySelector('[data-yz-cover]');
  const stage = cover.querySelector('.yz-cover-stage');
  const preface = page.querySelector('[data-yz-preface]');
  const reading = page.querySelector('.yz-reading-stage');
  const content = page.querySelector('#yz-content');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = number => Math.min(1, Math.max(0, number));
  let frame = 0;
  let observer;
  const observed = new WeakSet();

  function update() {
    frame = 0;
    const coverTop = cover.getBoundingClientRect().top;
    // Match the real sticky travel on desktop, mobile and after viewport changes.
    const coverTravel = Math.max(0, cover.offsetHeight - stage.offsetHeight);
    const progress = reduced.matches || !coverTravel ? 0 : clamp(-coverTop / coverTravel);
    const readingTop = reading.getBoundingClientRect().top;
    const readingProgress = clamp(-readingTop / Math.max(1, reading.offsetHeight - innerHeight));
    page.style.setProperty('--yz-cover-progress', progress.toFixed(4));
    page.style.setProperty('--yz-title-opacity', (1 - progress).toFixed(4));
    page.style.setProperty('--yz-reading-progress', readingProgress.toFixed(4));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function refreshReveals() {
    if (!observer || reduced.matches) return;
    page.querySelectorAll('[data-yz-reveal]').forEach(element => {
      if (observed.has(element) || element.closest('[hidden]')) return;
      observed.add(element);
      element.dataset.revealState = 'pending';
      observer.observe(element);
    });
  }
  function setMotion() {
    if (reduced.matches) {
      page.dataset.yzMotion = 'off';
      observer?.disconnect();
      page.querySelectorAll('[data-yz-reveal]').forEach(element => { element.dataset.revealState = 'shown'; });
    } else if ('IntersectionObserver' in window) {
      page.dataset.yzMotion = 'on';
      observer = new IntersectionObserver(items => items.forEach(item => {
        if (!item.isIntersecting) return;
        item.target.dataset.revealState = 'shown';
        observer.unobserve(item.target);
      }), { threshold: .04, rootMargin: '0px 0px -32px 0px' });
      refreshReveals();
    }
    schedule();
  }

  page.querySelectorAll('[data-yz-explore]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const target = link.dataset.yzExplore === 'preface' && preface ? preface : content;
    target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }));
  page.querySelector('[data-yz-top]').addEventListener('click', event => {
    event.preventDefault();
    document.body.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  });
  document.addEventListener('yangzhou:content-change', () => { refreshReveals(); schedule(); });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule);
  reduced.addEventListener?.('change', setMotion);
  setMotion();
})();
