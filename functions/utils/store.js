function hasJsonBin(env) {
  return !!(env.JSONBIN_BIN_ID && env.JSONBIN_API_KEY);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, options, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error('JSONBin ' + res.status + ': ' + text.slice(0, 180));
        await sleep(400 + i * 500);
        continue;
      }
      return { res, text };
    } catch (e) {
      lastErr = e;
      await sleep(300 + i * 400);
    }
  }
  throw lastErr || new Error('Network failed');
}

async function jsonbinRead(env) {
  const binId = env.JSONBIN_BIN_ID;
  const key = env.JSONBIN_API_KEY;
  if (!binId || !key) throw new Error('JSONBIN not configured');
  const { res, text } = await fetchWithRetry(
    'https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId) + '/latest',
    { headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' } },
    4
  );
  if (!res.ok) throw new Error('JSONBin read ' + res.status + ': ' + text.slice(0, 200));
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSONBin returned invalid JSON');
  }
  return data.record !== undefined ? data.record : data;
}

async function jsonbinWrite(env, record) {
  const binId = env.JSONBIN_BIN_ID;
  const key = env.JSONBIN_API_KEY;
  if (!binId || !key) throw new Error('JSONBIN not configured');
  const { res, text } = await fetchWithRetry(
    'https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify(record)
    },
    4
  );
  if (!res.ok) throw new Error('JSONBin write ' + res.status + ': ' + text.slice(0, 200));
  return true;
}

export async function readRoot(env) {
  const empty = { issues: [], users: {} };
  if (!hasJsonBin(env)) {
    return {
      data: empty,
      backend: 'none',
      error: 'Add JSONBIN_BIN_ID and JSONBIN_API_KEY in Cloudflare Settings → Variables and secrets, then redeploy'
    };
  }
  try {
    const record = await jsonbinRead(env);
    return {
      data: {
        issues: Array.isArray(record.issues) ? record.issues : [],
        users: record.users && typeof record.users === 'object' ? record.users : {}
      },
      backend: 'jsonbin'
    };
  } catch (e) {
    return { data: empty, backend: 'none', error: String(e.message || e), readFailed: true };
  }
}

export async function writeRoot(env, data) {
  if (!hasJsonBin(env)) {
    return {
      ok: false,
      error: 'JSONBIN not configured. Set JSONBIN_BIN_ID and JSONBIN_API_KEY in Cloudflare variables.'
    };
  }
  const payload = { issues: data.issues || [], users: data.users || {} };
  try {
    await jsonbinWrite(env, payload);
    return { ok: true, backend: 'jsonbin' };
  } catch (e) {
    const msg = String(e.message || e);
    if (/100kb|100 kb|over 100/i.test(msg)) {
      try {
        const stripped = (data.issues || []).map((i) => {
          const c = { ...i };
          delete c.photo;
          return c;
        });
        await jsonbinWrite(env, { issues: stripped, users: data.users || {} });
        return { ok: true, backend: 'jsonbin', photosStripped: true };
      } catch (e2) {
        return { ok: false, error: String(e2.message || e2) };
      }
    }
    try {
      await sleep(600);
      await jsonbinWrite(env, payload);
      return { ok: true, backend: 'jsonbin' };
    } catch (e3) {
      return { ok: false, error: String(e3.message || e3 || msg) };
    }
  }
}

export async function getIssues(env) {
  const { data, backend, error } = await readRoot(env);
  return { issues: data.issues || [], backend, error };
}

export async function saveIssues(env, issues) {
  const { data, readFailed, error } = await readRoot(env);
  if (readFailed) return { ok: false, error: error || 'Read failed' };
  data.issues = issues;
  return writeRoot(env, data);
}

/**
 * Never write if read failed (prevents wiping the bin).
 * Retries full read-modify-write cycle.
 */
export async function mutateIssues(env, mutator) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error, readFailed } = await readRoot(env);
    if (readFailed || error) {
      lastErr = error || 'Storage read failed';
      await sleep(400 + attempt * 400);
      continue;
    }
    const issues = Array.isArray(data.issues) ? data.issues.slice() : [];
    const users = data.users && typeof data.users === 'object' ? data.users : {};
    const result = mutator(issues) || {};
    if (result.abort) {
      return { ...result, ok: false };
    }
    const saved = await writeRoot(env, { issues, users });
    if (saved.ok) {
      return { ok: true, issues, backend: saved.backend, photosStripped: saved.photosStripped, ...result };
    }
    lastErr = saved.error;
    await sleep(400 + attempt * 400);
  }
  return { ok: false, error: lastErr || 'Could not save. Try again in a few seconds.' };
}

export async function getUsers(env) {
  const { data, backend, error } = await readRoot(env);
  return { users: data.users || {}, backend, error };
}

export async function saveUsers(env, users) {
  const { data, readFailed, error } = await readRoot(env);
  if (readFailed) return { ok: false, error: error || 'Read failed' };
  data.users = users;
  return writeRoot(env, data);
}

export async function storageStatus(env) {
  return {
    host: 'cloudflare',
    jsonbinConfigured: hasJsonBin(env),
    jsonbinBinIdSet: !!env.JSONBIN_BIN_ID,
    jsonbinKeySet: !!env.JSONBIN_API_KEY
  };
}

export async function sendDiscord(env, content) {
  const webhook = env.DISCORD_WEBHOOK_URL;
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.DISCORD_CHANNEL_ID;
  const text = String(content || '').slice(0, 1900);
  try {
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      return { method: 'webhook' };
    }
    if (token && channelId) {
      await fetch('https://discord.com/api/v10/channels/' + channelId + '/messages', {
        method: 'POST',
        headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      return { method: 'bot' };
    }
  } catch (e) {
    console.error('Discord', e);
  }
  return { method: 'none' };
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

export function getAuth(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const decoded = atob(auth.slice(7));
    if (decoded.startsWith('staff:')) return { role: 'staff', username: 'daksh@admin.com' };
    const parts = decoded.split(':');
    return { username: parts[0], role: parts[1] || 'citizen' };
  } catch {
    return null;
  }
}
