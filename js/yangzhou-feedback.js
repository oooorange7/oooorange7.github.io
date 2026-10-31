(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { window.YangzhouFeedback = api; api.mount(document); }
})(function () {
  const PAGE_URL = 'https://oooorange7.github.io/yangzhou/';
  const validEmail = value => /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(value || '');
  const cleanTitle = value => [...String(value || '扬州指南 · 意见与纠错').replace(/[\u0000-\u001f\u007f]/g, ' ')].slice(0, 100).join('').trim();
  function pending(entry) {
    return entry?.tier === 'unrated' || /待补充|待完善/.test(`${entry?.rating || ''} ${entry?.detailHTML || ''}`);
  }
  function feedbackContent(title) {
    const context = cleanTitle(title);
    return { title: context, subject: `[扬州指南] ${context}`, body: `关于：${context}\n页面：${PAGE_URL}\n\n我想补充或纠正的内容：\n\n\n相关信息（如门店、时间或来源）：\n\n` };
  }
  function mailURL(email, title) {
    if (!validEmail(email)) return '';
    const note = feedbackContent(title);
    return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(note.subject)}&body=${encodeURIComponent(note.body)}`;
  }
  function setEntry(dialog, entry) {
    const area = dialog.querySelector('[data-entry-feedback]');
    if (!area) return;
    area.hidden = !pending(entry) || document.querySelector('[data-yangzhou-page]')?.dataset.feedbackEnabled === 'false';
    const button = area.querySelector('[data-feedback-open]');
    if (button) {
      button.dataset.feedbackTopic = `place:${entry.name}`.slice(0, 100);
      button.dataset.feedbackTitle = `${entry.name} · 补充线索`.slice(0, 160);
    }
  }
  function mount(doc) {
    const payload = doc.querySelector('[data-yangzhou-data]');
    const dialog = doc.querySelector('[data-feedback-dialog]');
    if (!payload) return;
    const config = JSON.parse(payload.textContent).feedback || {};
    const page = doc.querySelector('[data-yangzhou-page]');
    if (page) page.dataset.feedbackEnabled = String(config.enabled !== false);
    if (config.enabled === false || !dialog) return;
    let opener;
    const title = dialog.querySelector('[data-feedback-context]');
    const link = dialog.querySelector('[data-feedback-mail]');
    const email = dialog.querySelector('[data-feedback-email]');
    const template = dialog.querySelector('[data-feedback-template]');
    const details = dialog.querySelector('[data-feedback-details]');
    const status = dialog.querySelector('[data-feedback-status]');
    email.value = config.email || '';
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('[data-feedback-open]');
      if (!button) return;
      event.preventDefault(); opener = button;
      const note = feedbackContent(button.dataset.feedbackTitle);
      title.textContent = note.title;
      link.href = mailURL(config.email, note.title);
      template.value = `收件人：${config.email}\n主题：${note.subject}\n\n${note.body}`;
      status.textContent = ''; details.open = false;
      if (!dialog.open) dialog.showModal();
    });
    function copy(selector, field, message) {
      dialog.querySelector(selector).addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(field.value);
          status.textContent = message;
        } catch {
          if (field === template) details.open = true;
          field.focus(); field.select();
          status.textContent = '自动复制未成功，已选中内容，请手动复制。';
        }
      });
    }
    copy('[data-feedback-copy-email]', email, '邮箱已复制，可以粘贴到你常用的邮箱中。');
    copy('[data-feedback-copy-template]', template, '反馈模板已复制，请在邮箱中补充内容后发送。');
    dialog.querySelector('[data-feedback-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus?.({ preventScroll: true }));
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  }
  return { validEmail, pending, feedbackContent, mailURL, setEntry, mount };
});
