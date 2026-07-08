'use strict';

const state = {
  emails: [],
  mailboxes: [],
  markReadEnabled: true,
  emailBodies: new Map(),
  openEmailIds: new Set()
};

const $ = (selector) => document.querySelector(selector);
const emailsEl = $('#emails');
const template = $('#email-template');
const statusEl = $('#status');
const mailboxFilterEl = $('#mailbox-filter');
const textFilterEl = $('#text-filter');
const markVisibleReadEl = $('#mark-visible-read');
const POPUP_VIEW_KEY = 'popupViewState';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function emailMatchesText(email, query) {
  if (!query) return true;
  const haystack = [
    email.subject,
    email.from,
    email.fromEmail,
    email.preview,
    email.mailboxPath,
    ...(email.mailboxPaths || []),
    ...(email.to || []),
    ...(email.toEmails || [])
  ].map(normalizeText).join(' ');
  return haystack.includes(query);
}

function emailMatchesMailbox(email, mailboxId) {
  if (mailboxId === 'all') return true;
  return (email.mailboxIds || []).includes(mailboxId);
}

function getVisibleEmails() {
  const query = normalizeText(textFilterEl.value.trim());
  const mailboxId = mailboxFilterEl.value;
  return state.emails.filter((email) => emailMatchesText(email, query) && emailMatchesMailbox(email, mailboxId));
}

function renderMailboxFilter() {
  const selected = mailboxFilterEl.value || 'all';
  mailboxFilterEl.textContent = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'すべて';
  mailboxFilterEl.appendChild(allOption);

  for (const mailbox of state.mailboxes) {
    const option = document.createElement('option');
    option.value = mailbox.id;
    option.textContent = `${mailbox.path || mailbox.name} (${mailbox.unreadEmails || 0})`;
    mailboxFilterEl.appendChild(option);
  }

  mailboxFilterEl.value = [...mailboxFilterEl.options].some((option) => option.value === selected) ? selected : 'all';
}

async function restorePopupViewState() {
  const data = await browser.storage.local.get({ [POPUP_VIEW_KEY]: {} });
  const viewState = data[POPUP_VIEW_KEY] || {};

  if (typeof viewState.textFilter === 'string') {
    textFilterEl.value = viewState.textFilter;
  }

  if (typeof viewState.mailboxId === 'string') {
    mailboxFilterEl.value = [...mailboxFilterEl.options].some((option) => option.value === viewState.mailboxId)
      ? viewState.mailboxId
      : 'all';
  }
}

async function savePopupViewState() {
  await browser.storage.local.set({
    [POPUP_VIEW_KEY]: {
      mailboxId: mailboxFilterEl.value || 'all',
      textFilter: textFilterEl.value || ''
    }
  });
}

function makeChip(text) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = text;
  return chip;
}

function setBodyText(bodyEl, text) {
  bodyEl.classList.remove('html-body');
  bodyEl.textContent = text || '';
}

function normalizeSafeUrl(value, allowedProtocols) {
  const raw = String(value || '').trim();
  const candidate = raw.startsWith('//') ? `https:${raw}` : raw;
  try {
    const parsed = new URL(candidate);
    if (!allowedProtocols.includes(parsed.protocol)) return '';
    if (parsed.protocol === 'data:' && !/^data:image\/(?:png|jpe?g|gif|webp);/i.test(candidate)) return '';
    return parsed.href;
  } catch (_error) {
    return '';
  }
}

function sanitizeStyle(value) {
  const style = String(value || '');
  if (/url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(style)) {
    return '';
  }
  return style
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .filter((rule) => {
      const match = rule.match(/^color\s*:\s*(.+)$/i);
      if (!match) return true;
      return !isVeryLightColor(match[1]);
    })
    .join('; ');
}

function isVeryLightColor(value) {
  const color = String(value || '').trim().toLowerCase();
  if (['white', '#fff', '#ffffff'].includes(color)) return true;

  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split('').map((char) => char + char).join('')
      : hex[1];
    const rgb = [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)].map((part) => parseInt(part, 16));
    return rgb.every((part) => part >= 238);
  }

  const rgb = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]].map(Number).every((part) => part >= 238);
  }

  return false;
}

function appendAutoLinkedText(fragment, doc, text) {
  const tokenPattern = /(https?:\/\/[^\s<>"']+|■)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    if (token === '■') {
      if (fragment.childNodes.length > 0) {
        fragment.appendChild(doc.createElement('br'));
      }
      fragment.appendChild(doc.createTextNode(token));
    } else {
      const trailing = token.match(/[。、，,)）]+$/)?.[0] || '';
      const hrefText = trailing ? token.slice(0, -trailing.length) : token;
      const href = normalizeSafeUrl(hrefText, ['http:', 'https:']);

      if (href) {
        const link = doc.createElement('a');
        link.href = href;
        link.textContent = hrefText;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        fragment.appendChild(link);
        if (trailing) {
          fragment.appendChild(doc.createTextNode(trailing));
        }
      } else {
        fragment.appendChild(doc.createTextNode(token));
      }
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }
}

function improvePlainHtmlText(root, doc) {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let current = walker.nextNode();

  while (current) {
    const parentTag = current.parentElement?.tagName?.toLowerCase();
    if (!['a', 'code', 'pre'].includes(parentTag || '') && /(https?:\/\/|■)/.test(current.nodeValue || '')) {
      nodes.push(current);
    }
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const fragment = doc.createDocumentFragment();
    appendAutoLinkedText(fragment, doc, node.nodeValue || '');
    node.replaceWith(fragment);
  }
}

function sanitizeEmailHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const blockedTags = new Set([
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'meta',
    'link',
    'base',
    'svg',
    'math'
  ]);

  for (const el of [...doc.body.querySelectorAll('*')]) {
    const tagName = el.tagName.toLowerCase();
    if (blockedTags.has(tagName)) {
      el.remove();
      continue;
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'href') {
        const href = normalizeSafeUrl(value, ['http:', 'https:', 'mailto:']);
        if (tagName === 'a' && href) {
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        } else {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (name === 'src') {
        const src = normalizeSafeUrl(value, ['http:', 'https:', 'data:']);
        if (tagName === 'img' && src) {
          el.setAttribute('src', src);
          el.setAttribute('loading', 'lazy');
          el.setAttribute('referrerpolicy', 'no-referrer');
        } else {
          el.removeAttribute(attr.name);
          if (tagName === 'img' && !el.getAttribute('alt')) {
            el.setAttribute('alt', '[embedded image]');
          }
        }
        continue;
      }

      if (name === 'style') {
        const cleanStyle = sanitizeStyle(value);
        if (cleanStyle) {
          el.setAttribute('style', cleanStyle);
        } else {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (![
        'alt',
        'title',
        'width',
        'height',
        'align',
        'valign',
        'border',
        'cellpadding',
        'cellspacing',
        'colspan',
        'rowspan',
        'role',
        'aria-label'
      ].includes(name)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const link of [...doc.body.querySelectorAll('a[href]')]) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }

  improvePlainHtmlText(doc.body, doc);

  return doc.body.innerHTML.trim();
}

function renderEmailBody(bodyEl, message) {
  const html = message?.html ? sanitizeEmailHtml(message.html) : '';
  if (html) {
    bodyEl.classList.add('html-body');
    bodyEl.innerHTML = html;
    return;
  }
  setBodyText(bodyEl, message?.body || '(No readable message body.)');
}

async function toggleEmailBody(email, card, bodyEl) {
  const isOpen = state.openEmailIds.has(email.id);

  if (isOpen) {
    state.openEmailIds.delete(email.id);
    bodyEl.classList.add('hidden');
    card.setAttribute('aria-expanded', 'false');
    return;
  }

  state.openEmailIds.add(email.id);
  bodyEl.classList.remove('hidden');
  card.setAttribute('aria-expanded', 'true');

  if (state.emailBodies.has(email.id)) {
    renderEmailBody(bodyEl, state.emailBodies.get(email.id));
    return;
  }

  setBodyText(bodyEl, 'Loading full message...');
  await loadEmailBody(email, bodyEl);
}

async function loadEmailBody(email, bodyEl) {
  try {
    const result = await browser.runtime.sendMessage({ type: 'getEmailBody', emailId: email.id });
    const message = {
      body: result?.body || '(No readable message body.)',
      html: result?.html || ''
    };
    state.emailBodies.set(email.id, message);
    if (state.openEmailIds.has(email.id)) {
      renderEmailBody(bodyEl, message);
    }
  } catch (error) {
    const message = `Could not load full message: ${error.message || error}`;
    state.emailBodies.delete(email.id);
    if (state.openEmailIds.has(email.id)) {
      setBodyText(bodyEl, message);
    }
    setStatus(message);
  }
}

function senderSeed(email) {
  return email.fromEmail || email.from || email.subject || '';
}

function senderInitial(email) {
  const value = (email.from || email.fromEmail || '?').trim();
  const first = Array.from(value.replace(/^["'\s]+/, ''))[0];
  return first ? first.toUpperCase() : '?';
}

function senderColor(seed) {
  const palette = [
    '#1688d9',
    '#263e61',
    '#f4b328',
    '#2f6fbb',
    '#6a7fa0',
    '#0d6aa8',
    '#8a6a10',
    '#3b5f8c'
  ];
  let hash = 0;
  for (const char of seed) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function renderEmails() {
  emailsEl.textContent = '';
  const visible = getVisibleEmails();
  markVisibleReadEl.disabled = !state.markReadEnabled || visible.length === 0;

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.emails.length === 0 ? '未読メールはありません。' : '条件に合う未読メールはありません。';
    emailsEl.appendChild(empty);
    return;
  }

  for (const email of visible) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.email-card');
    const avatar = fragment.querySelector('.sender-avatar');
    const bodyEl = fragment.querySelector('.body');
    card.tabIndex = 0;
    card.setAttribute('aria-expanded', state.openEmailIds.has(email.id) ? 'true' : 'false');
    avatar.textContent = senderInitial(email);
    avatar.style.backgroundColor = senderColor(senderSeed(email));
    avatar.title = email.fromEmail || email.from;
    fragment.querySelector('.subject').textContent = email.subject;
    fragment.querySelector('.meta').textContent = `${email.from} ・ ${formatDate(email.receivedAt)}`;
    fragment.querySelector('.preview').textContent = email.preview || 'プレビューなし';

    if (state.openEmailIds.has(email.id)) {
      bodyEl.classList.remove('hidden');
      if (state.emailBodies.has(email.id)) {
        renderEmailBody(bodyEl, state.emailBodies.get(email.id));
      } else {
        setBodyText(bodyEl, 'Loading full message...');
        loadEmailBody(email, bodyEl);
      }
    }

    const chips = fragment.querySelector('.chips');
    for (const path of email.mailboxPaths || [email.mailboxPath]) {
      chips.appendChild(makeChip(path));
    }
    if (email.fromEmail) {
      const domain = email.fromEmail.split('@')[1];
      if (domain) chips.appendChild(makeChip(domain));
    }
    if (email.hasAttachment) chips.appendChild(makeChip('添付あり'));
    if ((email.toEmails || []).some((addr) => addr.includes('+') || addr.includes('masked'))) {
      chips.appendChild(makeChip('マスク/別名らしき宛先'));
    }

    const markButton = fragment.querySelector('.mark-read');
    markButton.disabled = !state.markReadEnabled;
    markButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      markButton.disabled = true;
      markButton.textContent = '処理中';
      try {
        await browser.runtime.sendMessage({ type: 'markRead', emailIds: [email.id] });
        await loadState(false);
      } catch (error) {
        setStatus(`既読化に失敗: ${error.message || error}`);
        markButton.disabled = false;
        markButton.textContent = '既読';
      }
    });

    card.addEventListener('click', () => {
      toggleEmailBody(email, card, bodyEl);
    });
    bodyEl.addEventListener('click', async (event) => {
      event.stopPropagation();
      const link = event.target.closest?.('a[href]');
      if (!link) return;

      event.preventDefault();
      try {
        await browser.runtime.sendMessage({ type: 'openUrl', url: link.href });
      } catch (error) {
        setStatus(`Could not open link: ${error.message || error}`);
      }
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleEmailBody(email, card, bodyEl);
      }
    });

    emailsEl.appendChild(fragment);
  }
}

async function loadState(runCheck = false) {
  setStatus(runCheck ? '確認中...' : '読み込み中...');
  if (runCheck) {
    await browser.runtime.sendMessage({ type: 'checkNow' });
  }

  const popupState = await browser.runtime.sendMessage({ type: 'getPopupState' });
  state.emails = popupState.emails || [];
  state.mailboxes = popupState.mailboxes || [];
  state.markReadEnabled = Boolean(popupState.markReadEnabled);

  $('#setup').classList.toggle('hidden', popupState.hasToken);
  $('#controls').classList.toggle('hidden', !popupState.hasToken);

  if (!popupState.hasToken) {
    setStatus('未設定');
    emailsEl.textContent = '';
    return;
  }

  renderMailboxFilter();
  await restorePopupViewState();
  renderEmails();

  if (popupState.lastError) {
    setStatus(`エラー: ${popupState.lastError}`);
  } else {
    const checked = popupState.lastCheckAt ? formatDate(popupState.lastCheckAt) : '未確認';
    setStatus(`通知対象: ${popupState.unreadCount || 0}件 ・ 表示対象: ${state.emails.length}件 ・ 最終確認 ${checked}`);
  }
}

$('#check-now').addEventListener('click', () => loadState(true).catch((error) => setStatus(`エラー: ${error.message || error}`)));
$('#open-fastmail').addEventListener('click', () => browser.runtime.sendMessage({ type: 'openFastmail' }));
$('#options').addEventListener('click', () => browser.runtime.sendMessage({ type: 'openOptions' }));
$('#open-options-setup').addEventListener('click', () => browser.runtime.sendMessage({ type: 'openOptions' }));
textFilterEl.addEventListener('input', () => {
  renderEmails();
  savePopupViewState().catch((error) => setStatus(`表示状態の保存に失敗: ${error.message || error}`));
});
mailboxFilterEl.addEventListener('change', () => {
  renderEmails();
  savePopupViewState().catch((error) => setStatus(`表示状態の保存に失敗: ${error.message || error}`));
});
markVisibleReadEl.addEventListener('click', async () => {
  const visible = getVisibleEmails();
  if (visible.length === 0) return;
  markVisibleReadEl.disabled = true;
  markVisibleReadEl.textContent = '処理中';
  try {
    await browser.runtime.sendMessage({ type: 'markRead', emailIds: visible.map((email) => email.id) });
    await loadState(false);
  } catch (error) {
    setStatus(`既読化に失敗: ${error.message || error}`);
  } finally {
    markVisibleReadEl.textContent = '表示分を既読';
    renderEmails();
  }
});

loadState(true).catch((error) => {
  emailsEl.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  div.textContent = error.message || String(error);
  emailsEl.appendChild(div);
  setStatus('エラー');
});
