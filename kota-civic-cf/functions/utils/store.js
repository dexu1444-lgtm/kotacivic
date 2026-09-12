function hasJsonBin(env) {
  return !!(env.JSONBIN_BIN_ID && env.JSONBIN_API_KEY);
}

async function jsonbinRead(env) {
  const binId = env.JSONBIN_BIN_ID;
  const key = env.JSONBIN_API_KEY;
  if (!binId || !key) throw new Error('JSONBIN not configured');
  const res = await fetch('https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId) + '/latest', {
    headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
  });
  const text = await res.text();
  if (!res.ok) throw new Error('JSONBin read ' + res.status + ': ' + text.slice(0, 200));
  const data = JSON.parse(text);
  return data.record !== undefined ? data.record : data;
}

async function jsonbinWrite(env, record) {
  const binId = env.JSONBIN_BIN_ID;
  const key = env.JSONBIN_API_KEY;
  if (!binId || !key) throw new Error('JSONBIN not configured');
  const res = await fetch('https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
    body: JSON.stringify(record)
  });
  const text = await res.text();
  if (!res.ok) throw new Error('JSONBin write ' + res.status + ': ' + text.slice(0, 200));
  return true;
}

export async function readRoot(env) {
  const empty = { issues: [], users: {} };
  if (!hasJsonBin(env)) {
    return {
      data: empty,
      backend: 'none',
      error: 'Add JSONBIN_BIN_ID and JSONBIN_API_KEY in Cloudflare Settings → Variables and secrets'
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
    return { data: empty, backend: 'none', error: String(e.message || e) };
  }
}

export async function writeRoot(env, data) {
  if (!hasJsonBin(env)) {
    return {
      ok: false,
      error: 'Add JSONBIN_BIN_ID and JSONBIN_API_KEY in Cloudflare Settings → Variables and secrets'
    };
  }
  try {
    await jsonbinWrite(env, { issues: data.issues || [], users: data.users || {} });
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
    return { ok: false, error: msg };
  }
}

export async function getIssues(env) {
  const { data, backend, error } = await readRoot(env);
  return { issues: data.issues || [], backend, error };
}

export async function saveIssues(env, issues) {
  const { data } = await readRoot(env);
  data.issues = issues;
  return writeRoot(env, data);
}

export async function getUsers(env) {
  const { data, backend, error } = await readRoot(env);
  return { users: data.users || {}, backend, error };
}

export async function saveUsers(env, users) {
  const { data } = await readRoot(env);
  data.users = users;
  return writeRoot(env, data);
}

export async function storageStatus(env) {
  return {
    blobs: 'not used on Cloudflare',
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
