import { storageStatus, getIssues, json, corsHeaders } from '../utils/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  try {
    const status = await storageStatus(env);
    const { issues, backend, error } = await getIssues(env);
    return json({
      ok: true,
      storage: status,
      issuesCount: (issues || []).length,
      backend: backend || null,
      error: error || null,
      host: 'cloudflare'
    });
  } catch (e) {
    return json({ ok: false, message: String(e.message || e) });
  }
}
