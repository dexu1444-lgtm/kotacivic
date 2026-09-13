import { sendDiscord, json, corsHeaders } from '../utils/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ ok: false }, 405);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title || 'Activity';
    const from = body.from || 'System';
    const msg = body.body || body.message || '';
    const result = await sendDiscord(env, {
      title: '💬 ' + title,
      color: 0x06b6d4,
      description: msg.slice(0, 2000),
      fields: [{ name: 'From', value: from, inline: true }],
      footer: 'Civic AI Help Desk'
    });
    return json({ ok: true, discord: result });
  } catch (err) {
    return json({ ok: false, message: String(err.message || err) });
  }
}
