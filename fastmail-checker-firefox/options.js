'use strict';

const browser = globalThis.browser || globalThis.chrome;
const $ = (selector) => document.querySelector(selector);

const tokenEl = $('#token');
const intervalEl = $('#interval');
const fetchLimitEl = $('#fetch-limit');
const detailedNotificationsEl = $('#detailed-notifications');
const markReadEnabledEl = $('#mark-read-enabled');
const renderHtmlEnabledEl = $('#render-html-enabled');
const loadExternalImagesEl = $('#load-external-images');
const mailboxesEl = $('#mailboxes');
const statusEl = $('#status');

let mailboxes = [];
let enabledMailboxIds = new Set();

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function formatDate(value) {
  if (!value) return '未確認';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function renderMailboxes() {
  mailboxesEl.textContent = '';

  if (mailboxes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'フォルダ未取得です。API tokenを保存して「フォルダ再取得」を押してください。';
    mailboxesEl.appendChild(empty);
    return;
  }

  for (const mailbox of mailboxes) {
    const id = `mailbox-${mailbox.id}`;
    const label = document.createElement('label');
    label.className = 'mailbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = enabledMailboxIds.has(mailbox.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) enabledMailboxIds.add(mailbox.id);
      else enabledMailboxIds.delete(mailbox.id);
    });

    const body = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = mailbox.path || mailbox.name;
    const meta = document.createElement('small');
    const role = mailbox.role ? `role: ${mailbox.role} / ` : '';
    meta.textContent = `${role}未読 ${mailbox.unreadEmails || 0} / 合計 ${mailbox.totalEmails || 0}`;

    body.appendChild(title);
    body.appendChild(meta);
    label.appendChild(checkbox);
    label.appendChild(body);
    mailboxesEl.appendChild(label);
  }
}

async function loadOptions() {
  const data = await browser.runtime.sendMessage({ type: 'getOptionsData' });
  tokenEl.value = data.token || '';
  intervalEl.value = data.checkIntervalMinutes || 5;
  fetchLimitEl.value = data.fetchLimit || 30;
  detailedNotificationsEl.checked = Boolean(data.showDetailedNotifications);
  markReadEnabledEl.checked = Boolean(data.markReadEnabled);
  renderHtmlEnabledEl.checked = data.renderHtmlEnabled !== false;
  loadExternalImagesEl.checked = Boolean(data.loadExternalImages);
  mailboxes = data.mailboxes || [];
  enabledMailboxIds = new Set(data.enabledMailboxIds || []);
  renderMailboxes();

  if (data.lastError) {
    setStatus(`前回エラー: ${data.lastError}`, 'error');
  } else {
    setStatus(`読み込み完了。最終確認: ${formatDate(data.lastCheckAt)}`, 'ok');
  }
}

function collectOptions() {
  return {
    token: tokenEl.value,
    checkIntervalMinutes: intervalEl.value,
    fetchLimit: fetchLimitEl.value,
    showDetailedNotifications: detailedNotificationsEl.checked,
    markReadEnabled: markReadEnabledEl.checked,
    renderHtmlEnabled: renderHtmlEnabledEl.checked,
    loadExternalImages: loadExternalImagesEl.checked,
    enabledMailboxIds: [...enabledMailboxIds]
  };
}

async function saveOptions() {
  setStatus('保存中...');
  const data = await browser.runtime.sendMessage({ type: 'saveOptions', options: collectOptions() });
  tokenEl.value = data.token || tokenEl.value;
  mailboxes = data.mailboxes || [];
  enabledMailboxIds = new Set(data.enabledMailboxIds || []);
  renderMailboxes();
  setStatus('保存しました。', 'ok');
}

async function refreshMailboxes() {
  setStatus('フォルダ取得中...');
  await browser.runtime.sendMessage({ type: 'saveOptions', options: collectOptions() });
  const result = await browser.runtime.sendMessage({ type: 'refreshMailboxes' });
  mailboxes = result.mailboxes || [];
  enabledMailboxIds = new Set(result.enabledMailboxIds || []);
  renderMailboxes();
  setStatus('フォルダを再取得しました。', 'ok');
}

async function testConnection() {
  setStatus('接続テスト中...');
  await browser.runtime.sendMessage({ type: 'saveOptions', options: collectOptions() });
  const result = await browser.runtime.sendMessage({ type: 'checkNow' });
  if (result.ok) {
    await loadOptions();
    setStatus(`接続OK。通知対象の未読: ${result.unreadCount || 0}件`, 'ok');
  } else {
    setStatus(`接続エラー: ${result.error}`, 'error');
  }
}

function setMailboxSelection(predicate) {
  enabledMailboxIds = new Set(mailboxes.filter(predicate).map((mailbox) => mailbox.id));
  renderMailboxes();
}

$('#save').addEventListener('click', () => saveOptions().catch((error) => setStatus(error.message || String(error), 'error')));
$('#refresh').addEventListener('click', () => refreshMailboxes().catch((error) => setStatus(error.message || String(error), 'error')));
$('#check').addEventListener('click', () => testConnection().catch((error) => setStatus(error.message || String(error), 'error')));
$('#select-inbox').addEventListener('click', () => setMailboxSelection((mailbox) => mailbox.role === 'inbox'));
$('#select-unread').addEventListener('click', () => setMailboxSelection((mailbox) => Number(mailbox.unreadEmails || 0) > 0));
$('#select-all').addEventListener('click', () => setMailboxSelection(() => true));
$('#select-none').addEventListener('click', () => setMailboxSelection(() => false));

loadOptions().catch((error) => setStatus(error.message || String(error), 'error'));
