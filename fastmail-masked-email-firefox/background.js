'use strict';

const FASTMAIL_SESSION_URL = 'https://api.fastmail.com/jmap/session';
const JMAP_CORE = 'urn:ietf:params:jmap:core';
const JMAP_MAIL = 'urn:ietf:params:jmap:mail';
const FASTMAIL_MASKED_EMAIL = 'https://www.fastmail.com/dev/maskedemail';

const DEFAULT_SETTINGS = {
  token: '',
  accountId: '',
  apiUrl: '',
  maskedCapability: '',
  lastSession: null,
  lastError: '',
  history: [],
  historyLimit: 20,
  historyMaxAgeDays: 0
};

async function getSettings() {
  return browser.storage.local.get(DEFAULT_SETTINGS);
}

async function saveSettings(patch) {
  await browser.storage.local.set(patch);
}

function clampNumber(value, { min, max, fallback }) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeHistoryLimit(value) {
  return clampNumber(value, { min: 3, max: 20, fallback: DEFAULT_SETTINGS.historyLimit });
}

function normalizeHistoryMaxAgeDays(value) {
  return clampNumber(value, { min: 0, max: 365, fallback: DEFAULT_SETTINGS.historyMaxAgeDays });
}

function filterHistory(history, settings) {
  const limit = normalizeHistoryLimit(settings.historyLimit);
  const maxAgeDays = normalizeHistoryMaxAgeDays(settings.historyMaxAgeDays);
  const cutoff = maxAgeDays > 0 ? Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000) : 0;

  return (history || [])
    .filter((item) => !cutoff || Number(item.createdAt || 0) >= cutoff)
    .slice(0, limit);
}

function normalizeApiUrl(apiUrl, accountId) {
  if (!apiUrl) return apiUrl;
  return apiUrl.replace('{accountId}', accountId || '');
}

function compactSession(session) {
  const capabilities = Object.keys(session.capabilities || {});
  const accounts = Object.entries(session.accounts || {}).map(([id, account]) => ({
    id,
    name: account.name,
    isPersonal: account.isPersonal,
    isReadOnly: account.isReadOnly,
    accountCapabilities: Object.keys(account.accountCapabilities || {})
  }));

  return {
    username: session.username || '',
    capabilities,
    accounts,
    primaryAccounts: session.primaryAccounts || {}
  };
}

function findMaskedCapability(session, accountId) {
  const account = session.accounts?.[accountId] || {};
  const accountCapabilities = Object.keys(account.accountCapabilities || {});
  const serverCapabilities = Object.keys(session.capabilities || {});
  const candidates = [...new Set([...accountCapabilities, ...serverCapabilities])];

  return candidates.includes(FASTMAIL_MASKED_EMAIL) ? FASTMAIL_MASKED_EMAIL : '';
}

function missingMaskedCapabilityMessage(session) {
  const capabilities = Object.keys(session.capabilities || {});
  const accountCapabilities = Object.values(session.accounts || {})
    .flatMap((account) => Object.keys(account.accountCapabilities || {}));
  const visible = [...new Set([...capabilities, ...accountCapabilities])].sort();

  return [
    `Masked Email capability was not found. Expected: ${FASTMAIL_MASKED_EMAIL}.`,
    `This API token currently exposes: ${visible.join(', ') || '(none)'}.`,
    'Create a new JMAP API token with only the Masked Email scope enabled, then save that token here.'
  ].join(' ');
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
  const maskedCapability = findMaskedCapability(session, session.primaryAccounts?.[FASTMAIL_MASKED_EMAIL] || '');
  const accountId =
    session.primaryAccounts?.[maskedCapability] ||
    session.primaryAccounts?.[FASTMAIL_MASKED_EMAIL] ||
    session.primaryAccounts?.[JMAP_MAIL] ||
    Object.keys(session.accounts || {})[0];
  if (!accountId) {
    throw new Error('JMAP account was not found in the Fastmail session response.');
  }

  const apiUrl = normalizeApiUrl(session.apiUrl, accountId);
  if (!apiUrl) {
    throw new Error('JMAP apiUrl was not found in the Fastmail session response.');
  }

  return {
    session,
    accountId,
    apiUrl,
    maskedCapability: findMaskedCapability(session, accountId)
  };
}

async function ensureSession(settings) {
  if (!settings.token) {
    throw new Error('Fastmail API token is not configured.');
  }

  if (settings.accountId && settings.apiUrl && settings.maskedCapability) {
    return settings;
  }

  const sessionData = await fetchSession(settings.token);
  const lastSession = compactSession(sessionData.session);
  await saveSettings({
    accountId: sessionData.accountId,
    apiUrl: sessionData.apiUrl,
    maskedCapability: sessionData.maskedCapability,
    lastSession,
    lastError: ''
  });

  return {
    ...settings,
    accountId: sessionData.accountId,
    apiUrl: sessionData.apiUrl,
    maskedCapability: sessionData.maskedCapability,
    lastSession
  };
}

async function jmapRequest(settings, methodCalls, capabilities) {
  const active = await ensureSession(settings);
  const using = [...new Set([JMAP_CORE, ...(capabilities || []).filter(Boolean)])];
  const response = await fetch(active.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${active.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ using, methodCalls })
  });

  if (!response.ok) {
    throw new Error(`JMAP request error: HTTP ${response.status}`);
  }

  return response.json();
}

function getMethodResponse(data, callId, methodName) {
  const response = data.methodResponses?.find(([name, _args, id]) => id === callId && (!methodName || name === methodName));
  return response ? response[1] : null;
}

function firstMethodError(data) {
  const error = data.methodResponses?.find(([name]) => name === 'error');
  if (!error) return null;
  const details = error[1] || {};
  return `${details.type || 'unknown'} ${details.description || ''}`.trim();
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

function normalizeDomain(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return domainFromUrl(trimmed) || trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function buildCreateVariants(input) {
  const forDomain = normalizeDomain(input.domain) || domainFromUrl(input.url);
  const description = input.description || input.label || forDomain || 'Created from Firefox add-on';
  const url = input.url || '';

  return [
    {
      description,
      forDomain,
      url,
      state: 'enabled'
    },
    {
      description,
      domain: forDomain,
      url,
      state: 'enabled'
    },
    {
      description,
      forDomain,
      url
    },
    {
      description,
      domain: forDomain,
      url
    }
  ];
}

function normalizeCreatedMaskedEmail(created) {
  if (!created) return null;
  const value = Object.values(created)[0];
  if (!value) return null;

  return {
    id: value.id || '',
    email: value.email || value.address || value.maskedEmail || '',
    description: value.description || '',
    state: value.state || '',
    raw: value
  };
}

async function diagnose() {
  const settings = await getSettings();
  if (!settings.token) {
    return { ok: false, error: 'Fastmail API token is not configured.' };
  }

  try {
    const sessionData = await fetchSession(settings.token);
    const lastSession = compactSession(sessionData.session);
    const lastError = sessionData.maskedCapability ? '' : missingMaskedCapabilityMessage(sessionData.session);
    await saveSettings({
      accountId: sessionData.accountId,
      apiUrl: sessionData.apiUrl,
      maskedCapability: sessionData.maskedCapability,
      lastSession,
      lastError
    });

    return {
      ok: Boolean(sessionData.maskedCapability),
      accountId: sessionData.accountId,
      apiUrl: sessionData.apiUrl,
      maskedCapability: sessionData.maskedCapability,
      session: lastSession,
      error: lastError
    };
  } catch (error) {
    const message = error.message || String(error);
    await saveSettings({ lastError: message });
    return { ok: false, error: message };
  }
}

async function createMaskedEmail(input) {
  const settings = await ensureSession(await getSettings());
  const capability = settings.maskedCapability;

  if (!capability) {
    throw new Error(settings.lastSession ? settings.lastError : 'Masked Email capability was not found in this API token/session.');
  }

  const variants = buildCreateVariants(input);
  const errors = [];

  for (let index = 0; index < variants.length; index += 1) {
    const createId = `masked-${Date.now()}-${index}`;
    const data = await jmapRequest(settings, [[
      'MaskedEmail/set',
      {
        accountId: settings.accountId,
        create: {
          [createId]: variants[index]
        }
      },
      'maskedEmailCreate'
    ]], [capability]);

    const methodError = firstMethodError(data);
    if (methodError) {
      errors.push(methodError);
      continue;
    }

    const response = getMethodResponse(data, 'maskedEmailCreate', 'MaskedEmail/set');
    const created = normalizeCreatedMaskedEmail(response?.created);

    if (created?.email) {
      const historyItem = {
        email: created.email,
        description: input.description || '',
        domain: input.domain || '',
        url: input.url || '',
        createdAt: Date.now()
      };
      const history = filterHistory([historyItem, ...(settings.history || [])], settings);
      await saveSettings({ history, lastError: '' });
      return { ok: true, maskedEmail: created, history };
    }

    errors.push(JSON.stringify(response || data));
  }

  throw new Error(`Masked Email creation failed. ${errors.join(' / ')}`);
}

async function getPopupState() {
  const settings = await getSettings();
  const history = filterHistory(settings.history || [], settings);
  return {
    hasToken: Boolean(settings.token),
    maskedCapability: settings.maskedCapability,
    lastSession: settings.lastSession,
    lastError: settings.lastError,
    history,
    historyLimit: normalizeHistoryLimit(settings.historyLimit),
    historyMaxAgeDays: normalizeHistoryMaxAgeDays(settings.historyMaxAgeDays)
  };
}

async function openOptions() {
  await browser.runtime.openOptionsPage();
  return { ok: true };
}

async function saveToken(token) {
  const current = await getSettings();
  const normalized = String(token || '').trim();
  const patch = { token: normalized, lastError: '' };

  if (normalized !== current.token) {
    patch.accountId = '';
    patch.apiUrl = '';
    patch.maskedCapability = '';
    patch.lastSession = null;
    patch.history = [];
  }

  await saveSettings(patch);
  if (normalized) {
    return diagnose();
  }
  return { ok: true };
}

async function saveHistoryOptions(options = {}) {
  const settings = await getSettings();
  const historyLimit = normalizeHistoryLimit(options.historyLimit);
  const historyMaxAgeDays = normalizeHistoryMaxAgeDays(options.historyMaxAgeDays);
  const history = filterHistory(settings.history || [], { historyLimit, historyMaxAgeDays });
  await saveSettings({ historyLimit, historyMaxAgeDays, history });
  return { ok: true, historyLimit, historyMaxAgeDays, history };
}

browser.runtime.onMessage.addListener((message) => {
  switch (message?.type) {
    case 'getPopupState':
      return getPopupState();
    case 'saveToken':
      return saveToken(message.token);
    case 'openOptions':
      return openOptions();
    case 'diagnose':
      return diagnose();
    case 'saveHistoryOptions':
      return saveHistoryOptions(message.options);
    case 'createMaskedEmail':
      return createMaskedEmail(message.input || {}).catch(async (error) => {
        const messageText = error.message || String(error);
        await saveSettings({ lastError: messageText });
        return { ok: false, error: messageText };
      });
    default:
      return Promise.resolve({ ok: false, error: 'Unknown message type.' });
  }
});
