(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('Stellar.theme');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* The page also works when browser storage is unavailable. */ }
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-yangzhou-theme]');
    if (!button) return;
    button.addEventListener('click', () => {
      const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('Stellar.theme', next); } catch { /* Optional preference only. */ }
    });
  });
})();
