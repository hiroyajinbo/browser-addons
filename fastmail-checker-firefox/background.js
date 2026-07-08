'use strict';

const browser = globalThis.browser || globalThis.chrome;
const actionApi = browser.action || browser.browserAction;
const FASTMAIL_SESSION_URL = 'https://api.fastmail.com/jmap/session';
const JMAP_CORE = 'urn:ietf:params:jmap:core';
const JMAP_MAIL = 'urn:ietf:params:jmap:mail';
const CHECK_ALARM_NAME = 'fastmail-checker-check';
const FASTMAIL_WEB_URL = 'https://app.fastmail.com/mail/';
const EMAIL_FETCH_LIMIT = 30;
const ICON_COLOR_PATHS = {
  48: 'icon-48.png',
  96: 'icon-96.png',
  128: 'icon-128.png'
};
const ICON_GRAY_PATHS = {
  48: 'icon-gray-48.png',
  96: 'icon-gray-96.png',
  128: 'icon-gray-128.png'
};

const DEFAULT_SETTINGS = {
  token: '',
  checkIntervalMinutes: 5,
  fetchLimit: EMAIL_FETCH_LIMIT,
  showDetailedNotifications: true,
  markReadEnabled: true,
  renderHtmlEnabled: true,
  loadExternalImages: false,
  enabledMailboxIds: [],
  hasConfiguredMailboxSelection: false,
  knownUnreadEmailIds: [],
  initialized: false,
  accountId: '',
  apiUrl: '',
  mailboxes: [],
  lastCheckAt: 0,
  lastError: '',
  lastUnreadCount: 0,
  lastEmails: []
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

async function getSettings() {
  return browser.storage.local.get(DEFAULT_SETTINGS);
}

async function saveSettings(patch) {
  await browser.storage.local.set(patch);
}

function normalizeApiUrl(apiUrl, accountId) {
  if (!apiUrl) return apiUrl;
  return apiUrl.replace('{accountId}', accountId || '');
}

async function fetchSession(token) {
  const response = await fetch(FASTMAIL_SESSION_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Fastmail session error: HTTP ${response.status}`);
  }

  const session = await response.json();
  const accountId = session.primaryAccounts?.[JMAP_MAIL] || Object.keys(session.accounts || {})[0];
  if (!accountId) {
    throw new Error('JMAP mail account was not found in the Fastmail session response.');
  }

  const apiUrl = normalizeApiUrl(session.apiUrl, accountId);
  if (!apiUrl) {
    throw new Error('JMAP apiUrl was not found in the Fastmail session response.');
  }

  return { session, accountId, apiUrl };
}

async function jmapRequest(settings, methodCalls) {
  if (!settings.token) {
    throw new Error('Fastmail API token is not configured.');
  }

  let accountId = settings.accountId;
  let apiUrl = settings.apiUrl;

  if (!accountId || !apiUrl) {
    const session = await fetchSession(settings.token);
    accountId = session.accountId;
    apiUrl = session.apiUrl;
    await saveSettings({ accountId, apiUrl });
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      using: [JMAP_CORE, JMAP_MAIL],
      methodCalls
    })
  });

  if (!response.ok) {
    throw new Error(`JMAP request error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data.methodResponses)) {
    const error = data.methodResponses.find(([name]) => name === 'error');
    if (error) {
      const details = error[1] || {};
      throw new Error(`JMAP method error: ${details.type || 'unknown'} ${details.description || ''}`.trim());
    }
  }

  return data;
}

function getMethodResponse(data, callId, methodName) {
  const response = data.methodResponses?.find(([name, _args, id]) => id === callId && (!methodName || name === methodName));
  return response ? response[1] : null;
}

function buildMailboxPaths(mailboxes) {
  const byId = new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox]));

  function pathFor(mailbox) {
    const parts = [];
    let current = mailbox;
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.name || '(no name)');
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return parts.join(' / ');
  }

  return mailboxes
    .map((mailbox) => ({
      ...mailbox,
      path: pathFor(mailbox)
    }))
    .sort((a, b) => {
      const roleRank = (role) => ({ inbox: 0, drafts: 90, sent: 91, archive: 92, trash: 98, junk: 99 }[role] ?? 10);
      const r = roleRank(a.role) - roleRank(b.role);
      if (r !== 0) return r;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.path.localeCompare(b.path);
    });
}

async function refreshMailboxes() {
  const settings = await getSettings();
  if (!settings.token) {
    throw new Error('Fastmail API token is not configured.');
  }

  const session = await fetchSession(settings.token);
  const data = await jmapRequest(
    { ...settings, accountId: session.accountId, apiUrl: session.apiUrl },
    [[
      'Mailbox/get',
      {
        accountId: session.accountId,
        properties: ['id', 'name', 'role', 'parentId', 'sortOrder', 'totalEmails', 'unreadEmails']
      },
      'mailboxes'
    ]]
  );

  const mailboxResponse = getMethodResponse(data, 'mailboxes', 'Mailbox/get');
  const mailboxes = buildMailboxPaths(mailboxResponse?.list || []);

  let enabledMailboxIds = settings.enabledMailboxIds || [];
  const validIds = new Set(mailboxes.map((mailbox) => mailbox.id));
  enabledMailboxIds = enabledMailboxIds.filter((id) => validIds.has(id));

  if (enabledMailboxIds.length === 0 && !settings.hasConfiguredMailboxSelection) {
    const inboxes = mailboxes.filter((mailbox) => mailbox.role === 'inbox');
    enabledMailboxIds = (inboxes.length ? inboxes : mailboxes.slice(0, 1)).map((mailbox) => mailbox.id);
  }

  await saveSettings({
    accountId: session.accountId,
    apiUrl: session.apiUrl,
    mailboxes,
    enabledMailboxIds,
    lastError: ''
  });

  return { accountId: session.accountId, apiUrl: session.apiUrl, mailboxes, enabledMailboxIds };
}

function mailboxMap(mailboxes) {
  return new Map((mailboxes || []).map((mailbox) => [mailbox.id, mailbox]));
}

function primaryMailboxPath(email, mailboxesById) {
  const ids = Object.keys(email.mailboxIds || {});
  const mailbox = ids.map((id) => mailboxesById.get(id)).find(Boolean);
  return mailbox?.path || mailbox?.name || 'Unknown';
}

function emailMatchesEnabledMailboxes(email, enabledMailboxIds) {
  const ids = Object.keys(email.mailboxIds || {});
  return ids.some((id) => enabledMailboxIds.includes(id));
}

function unreadCountForMailboxIds(mailboxes, mailboxIds) {
  const enabledSet = new Set(mailboxIds || []);
  return (mailboxes || [])
    .filter((mailbox) => enabledSet.has(mailbox.id))
    .reduce((sum, mailbox) => sum + Number(mailbox.unreadEmails || 0), 0);
}

function mailboxIdsWithUnread(mailboxes) {
  return (mailboxes || [])
    .filter((mailbox) => Number(mailbox.unreadEmails || 0) > 0)
    .map((mailbox) => mailbox.id)
    .filter(Boolean);
}

function unionIds(...idLists) {
  return [...new Set(idLists.flat().filter(Boolean))];
}

function displayAddress(address) {
  if (!address) return '';
  return address.name || address.email || '';
}

function normalizeEmail(email, mailboxesById) {
  const from = Array.isArray(email.from) ? email.from[0] : null;
  const to = Array.isArray(email.to) ? email.to : [];
  const mailboxIds = Object.keys(email.mailboxIds || {});
  const mailboxPaths = mailboxIds
    .map((id) => mailboxesById.get(id)?.path || mailboxesById.get(id)?.name)
    .filter(Boolean);

  return {
    id: email.id,
    threadId: email.threadId,
    subject: email.subject || '(no subject)',
    preview: email.preview || '',
    receivedAt: email.receivedAt || '',
    from: displayAddress(from) || '(unknown sender)',
    fromEmail: from?.email || '',
    to: to.map(displayAddress).filter(Boolean),
    toEmails: to.map((a) => a.email).filter(Boolean),
    mailboxIds,
    mailboxPath: primaryMailboxPath(email, mailboxesById),
    mailboxPaths,
    keywords: email.keywords || {},
    isUnread: !email.keywords?.['$seen'],
    hasAttachment: Boolean(email.hasAttachment)
  };
}

function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function bodyValueForPart(email, part) {
  if (!part?.partId) return '';
  return email.bodyValues?.[part.partId]?.value || '';
}

async function fetchEmailBody(emailId) {
  let settings = await getSettings();
  if (!settings.token) throw new Error('Fastmail API token is not configured.');
  if (!emailId) throw new Error('Email id is required.');

  if (!settings.accountId || !settings.apiUrl) {
    const session = await fetchSession(settings.token);
    await saveSettings({ accountId: session.accountId, apiUrl: session.apiUrl });
    settings = { ...settings, accountId: session.accountId, apiUrl: session.apiUrl };
  }

  const data = await jmapRequest(settings, [[
    'Email/get',
    {
      accountId: settings.accountId,
      ids: [emailId],
      properties: ['id', 'subject', 'textBody', 'htmlBody', 'bodyValues'],
      bodyProperties: ['partId', 'type', 'charset', 'size'],
      fetchTextBodyValues: true,
      fetchHTMLBodyValues: true
    },
    'emailBody'
  ]]);

  const response = getMethodResponse(data, 'emailBody', 'Email/get');
  const email = response?.list?.[0];
  if (!email) {
    throw new Error('Email was not found.');
  }

  const textParts = Array.isArray(email.textBody) ? email.textBody : [];
  const htmlParts = Array.isArray(email.htmlBody) ? email.htmlBody : [];
  const text = textParts.map((part) => bodyValueForPart(email, part)).filter(Boolean).join('\n\n').trim();
  const html = htmlParts.map((part) => bodyValueForPart(email, part)).filter(Boolean).join('\n\n').trim();
  const htmlText = htmlToText(html);

  return {
    ok: true,
    id: email.id,
    subject: email.subject || '',
    body: text || htmlText || '(No readable message body.)',
    html
  };
}

async function openUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
    throw new Error('Unsupported link URL.');
  }
  return browser.tabs.create({ url: parsed.href });
}

async function fetchUnreadEmails(settings, mailboxes, enabledMailboxIds) {
  const accountId = settings.accountId;
  const fetchLimit = EMAIL_FETCH_LIMIT;
  const activeIds = enabledMailboxIds.filter(Boolean);

  if (activeIds.length === 0) {
    return { emails: [], unreadCount: 0 };
  }

  const queryCalls = activeIds.map((mailboxId, index) => [
    'Email/query',
    {
      accountId,
      filter: {
        operator: 'AND',
        conditions: [
          { inMailbox: mailboxId },
          { notKeyword: '$seen' }
        ]
      },
      sort: [{ property: 'receivedAt', isAscending: false }],
      limit: fetchLimit
    },
    `q${index}`
  ]);

  const queryData = await jmapRequest(settings, queryCalls);
  const ids = [];
  for (let i = 0; i < activeIds.length; i += 1) {
    const response = getMethodResponse(queryData, `q${i}`, 'Email/query');
    if (response?.ids) ids.push(...response.ids);
  }

  const uniqueIds = [...new Set(ids)].slice(0, Math.max(fetchLimit, 100));
  const mailboxesById = mailboxMap(mailboxes);

  let emails = [];
  if (uniqueIds.length > 0) {
    const getData = await jmapRequest(settings, [[
      'Email/get',
      {
        accountId,
        ids: uniqueIds,
        properties: [
          'id',
          'threadId',
          'mailboxIds',
          'keywords',
          'from',
          'to',
          'subject',
          'receivedAt',
          'preview',
          'hasAttachment'
        ]
      },
      'emails'
    ]]);

    const emailResponse = getMethodResponse(getData, 'emails', 'Email/get');
    emails = (emailResponse?.list || [])
      .filter((email) => !email.keywords?.['$seen'])
      .filter((email) => emailMatchesEnabledMailboxes(email, activeIds))
      .map((email) => normalizeEmail(email, mailboxesById))
      .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  }

  const enabledSet = new Set(activeIds);
  const unreadCount = (mailboxes || [])
    .filter((mailbox) => enabledSet.has(mailbox.id))
    .reduce((sum, mailbox) => sum + Number(mailbox.unreadEmails || 0), 0);

  return { emails, unreadCount };
}

async function updateBadge(count, errorText = '') {
  if (errorText) {
    await actionApi.setBadgeText({ text: '!' });
    await actionApi.setBadgeBackgroundColor({ color: '#a40000' });
    await setActionIcon('color');
    return;
  }

  const text = count > 999 ? '999+' : count > 0 ? String(count) : '';
  await actionApi.setBadgeText({ text });
  await actionApi.setBadgeBackgroundColor({ color: '#1688d9' });
  await setActionIcon(count > 0 ? 'color' : 'gray');
}

async function setActionIcon(mode) {
  await actionApi.setIcon({
    path: mode === 'gray' ? ICON_GRAY_PATHS : ICON_COLOR_PATHS
  });
}

async function notifyEmails(emails, settings) {
  const detailed = Boolean(settings.showDetailedNotifications);
  for (const email of emails.slice(0, 5)) {
    const title = detailed ? email.subject : 'Fastmail: new unread email';
    const body = detailed
      ? `${email.from}\n${email.mailboxPath}${email.preview ? `\n${email.preview}` : ''}`
      : 'Open Fastmail Checker to view details.';

    await browser.notifications.create(`fastmail-${email.id}-${Date.now()}`, {
      type: 'basic',
      title,
      message: body,
      iconUrl: browser.runtime.getURL('icon-96.png')
    });
  }

  if (emails.length > 5) {
    await browser.notifications.create(`fastmail-more-${Date.now()}`, {
      type: 'basic',
      title: 'Fastmail: multiple unread emails',
      message: `${emails.length} new unread emails were found.`,
      iconUrl: browser.runtime.getURL('icon-96.png')
    });
  }
}

async function checkNow({ manual = false, notify = true } = {}) {
  let settings = await getSettings();

  if (!settings.token) {
    await saveSettings({ lastError: '', lastUnreadCount: 0, lastEmails: [] });
    await updateBadge(0);
    return { ok: false, error: 'Fastmail API token is not configured.' };
  }

  try {
    if (!settings.accountId || !settings.apiUrl || !settings.mailboxes?.length) {
      await refreshMailboxes();
      settings = await getSettings();
    }

    const mailboxData = await refreshMailboxes();
    settings = await getSettings();

    const enabledMailboxIds = settings.enabledMailboxIds || mailboxData.enabledMailboxIds || [];
    const displayMailboxIds = unionIds(enabledMailboxIds, mailboxIdsWithUnread(mailboxData.mailboxes));
    const enabledResult = await fetchUnreadEmails(settings, mailboxData.mailboxes, enabledMailboxIds);
    const displayResult = displayMailboxIds.length === enabledMailboxIds.length
      ? enabledResult
      : await fetchUnreadEmails(settings, mailboxData.mailboxes, displayMailboxIds);
    const emails = enabledResult.emails;
    const displayEmails = displayResult.emails;
    const unreadCount = enabledResult.unreadCount;
    const badgeCount = unreadCount;
    const previousKnown = new Set(settings.knownUnreadEmailIds || []);
    const newEmails = emails.filter((email) => !previousKnown.has(email.id));
    const currentKnown = emails.map((email) => email.id).slice(0, 1000);
    const shouldNotify = notify && settings.initialized && newEmails.length > 0;

    if (shouldNotify) {
      await notifyEmails(newEmails, settings);
    }

    await saveSettings({
      knownUnreadEmailIds: currentKnown,
      initialized: true,
      lastCheckAt: Date.now(),
      lastError: '',
      lastUnreadCount: unreadCount,
      lastEmails: displayEmails
    });

    await updateBadge(badgeCount);
    return { ok: true, manual, unreadCount, emails: displayEmails, badgeCount, newCount: shouldNotify ? newEmails.length : 0 };
  } catch (error) {
    const message = error?.message || String(error);
    await saveSettings({ lastError: message, lastCheckAt: Date.now() });
    await updateBadge(0, message);
    return { ok: false, error: message };
  }
}

async function markRead(emailIds) {
  const settings = await getSettings();
  const ids = [...new Set(emailIds || [])].filter(Boolean);
  if (ids.length === 0) return { ok: true, updated: 0 };
  if (!settings.token) throw new Error('Fastmail API token is not configured.');

  const update = {};
  for (const id of ids) {
    update[id] = { 'keywords/$seen': true };
  }

  const data = await jmapRequest(settings, [[
    'Email/set',
    {
      accountId: settings.accountId,
      update
    },
    'markRead'
  ]]);

  const response = getMethodResponse(data, 'markRead', 'Email/set');
  const updated = response?.updated ? Object.keys(response.updated).length : 0;
  const notUpdated = response?.notUpdated ? Object.keys(response.notUpdated) : [];
  if (notUpdated.length > 0) {
    throw new Error(`Some messages could not be marked read: ${notUpdated.join(', ')}`);
  }

  await checkNow({ manual: true, notify: false });
  return { ok: true, updated };
}

async function getPopupState() {
  const settings = await getSettings();
  return {
    ok: !settings.lastError,
    lastError: settings.lastError,
    lastCheckAt: settings.lastCheckAt,
    unreadCount: settings.lastUnreadCount,
    emails: settings.lastEmails || [],
    mailboxes: settings.mailboxes || [],
    enabledMailboxIds: settings.enabledMailboxIds || [],
    hasToken: Boolean(settings.token),
    markReadEnabled: Boolean(settings.markReadEnabled),
    renderHtmlEnabled: Boolean(settings.renderHtmlEnabled),
    loadExternalImages: Boolean(settings.loadExternalImages)
  };
}

async function getOptionsData() {
  const settings = await getSettings();
  return {
    token: settings.token,
    checkIntervalMinutes: settings.checkIntervalMinutes,
    showDetailedNotifications: settings.showDetailedNotifications,
    markReadEnabled: settings.markReadEnabled,
    renderHtmlEnabled: settings.renderHtmlEnabled,
    loadExternalImages: settings.loadExternalImages,
    mailboxes: settings.mailboxes || [],
    enabledMailboxIds: settings.enabledMailboxIds || [],
    lastError: settings.lastError,
    lastCheckAt: settings.lastCheckAt,
    hasToken: Boolean(settings.token)
  };
}

async function configureAlarm() {
  const settings = await getSettings();
  await browser.alarms.clear(CHECK_ALARM_NAME);
  if (!settings.token) return;
  const periodInMinutes = clampNumber(settings.checkIntervalMinutes, 1, 60, DEFAULT_SETTINGS.checkIntervalMinutes);
  await browser.alarms.create(CHECK_ALARM_NAME, { periodInMinutes });
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM_NAME) {
    checkNow({ notify: true });
  }
});

browser.notifications.onClicked.addListener(async () => {
  await browser.tabs.create({ url: FASTMAIL_WEB_URL });
});

browser.runtime.onInstalled.addListener(async () => {
  await configureAlarm();
  await checkNow({ notify: false });
});

browser.runtime.onStartup.addListener(async () => {
  await configureAlarm();
  await checkNow({ notify: false });
});

browser.runtime.onMessage.addListener((message) => {
  switch (message?.type) {
    case 'checkNow':
      return checkNow({ manual: true, notify: false });
    case 'refreshMailboxes':
      return refreshMailboxes();
    case 'markRead':
      return markRead(message.emailIds || []);
    case 'getEmailBody':
      return fetchEmailBody(message.emailId);
    case 'openUrl':
      return openUrl(message.url);
    case 'getPopupState':
      return getPopupState();
    case 'getOptionsData':
      return getOptionsData();
    case 'savePreferences':
      return (async () => {
        const options = message.options || {};
        const current = await getSettings();
        const enabledMailboxIds = Array.isArray(options.enabledMailboxIds) ? options.enabledMailboxIds : current.enabledMailboxIds;
        const unreadCount = unreadCountForMailboxIds(current.mailboxes, enabledMailboxIds);
        await saveSettings({
          checkIntervalMinutes: clampNumber(options.checkIntervalMinutes, 1, 60, DEFAULT_SETTINGS.checkIntervalMinutes),
          showDetailedNotifications: Boolean(options.showDetailedNotifications),
          markReadEnabled: Boolean(options.markReadEnabled),
          renderHtmlEnabled: options.renderHtmlEnabled !== false,
          loadExternalImages: Boolean(options.loadExternalImages),
          enabledMailboxIds,
          hasConfiguredMailboxSelection: true,
          lastUnreadCount: unreadCount
        });
        await configureAlarm();
        await updateBadge(unreadCount);
        return getOptionsData();
      })();
    case 'saveOptions':
      return (async () => {
        const options = message.options || {};
        const current = await getSettings();
        const hasTokenOption = Object.prototype.hasOwnProperty.call(options, 'token');
        const patch = {
          token: hasTokenOption ? String(options.token || '').trim() : current.token,
          checkIntervalMinutes: clampNumber(options.checkIntervalMinutes, 1, 60, DEFAULT_SETTINGS.checkIntervalMinutes),
          showDetailedNotifications: Boolean(options.showDetailedNotifications),
          markReadEnabled: Boolean(options.markReadEnabled),
          renderHtmlEnabled: options.renderHtmlEnabled !== false,
          loadExternalImages: Boolean(options.loadExternalImages),
          enabledMailboxIds: Array.isArray(options.enabledMailboxIds) ? options.enabledMailboxIds : current.enabledMailboxIds,
          hasConfiguredMailboxSelection: current.mailboxes?.length > 0 ? true : current.hasConfiguredMailboxSelection
        };

        if (patch.token !== current.token) {
          patch.accountId = '';
          patch.apiUrl = '';
          patch.mailboxes = [];
          patch.knownUnreadEmailIds = [];
          patch.initialized = false;
          patch.hasConfiguredMailboxSelection = false;
          patch.lastEmails = [];
          patch.lastUnreadCount = 0;
        }

        await saveSettings(patch);
        await configureAlarm();
        if (patch.token) {
          await refreshMailboxes();
          await checkNow({ manual: true, notify: false });
        } else {
          await saveSettings({ lastError: '', lastUnreadCount: 0, lastEmails: [] });
          await updateBadge(0);
        }
        return getOptionsData();
      })();
    case 'openOptions':
      return browser.runtime.openOptionsPage();
    case 'openFastmail':
      return browser.tabs.create({ url: FASTMAIL_WEB_URL });
    default:
      return Promise.resolve({ ok: false, error: 'Unknown message type.' });
  }
});

configureAlarm();
checkNow({ notify: false });
