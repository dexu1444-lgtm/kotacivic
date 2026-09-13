import {
  getIssues, mutateIssues, sendDiscord, json, corsHeaders, getAuth
} from '../utils/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (request.method === 'GET') {
      const { issues, error } = await getIssues(env);
      const list = Array.isArray(issues) ? issues.slice() : [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const stats = {
        total: list.length,
        resolved: list.filter((i) => i.status === 'resolved').length,
        open: list.filter((i) => i.status === 'open' || i.status === 'in_progress').length,
        rejected: list.filter((i) => i.status === 'rejected').length
      };
      return json({ ok: true, issues: list, stats, storageNote: error || undefined });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const auth = getAuth(request);
      const issue = {
        id: crypto.randomUUID(),
        type: body.type || 'Other',
        location: body.location || 'Unknown',
        area: body.area || '',
        description: body.description || '',
        priority: !!body.priority,
        lat: body.lat || null,
        lng: body.lng || null,
        photo: body.photo ? String(body.photo).slice(0, 100000) : null,
        reporter: body.reporter || (auth && auth.username) || 'Anonymous',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = await mutateIssues(env, (issues) => {
        issues.push(issue);
        return { issue };
      });

      if (!saved.ok) {
        // retry without photo
        if (issue.photo) {
          issue.photo = null;
          const saved2 = await mutateIssues(env, (issues) => {
            issues.push(issue);
            return { issue };
          });
          if (saved2.ok) {
            await sendDiscord(env, {
              title: '🆕 New Issue (no photo — storage limit)',
              color: 0xf59e0b,
              fields: [
                { name: 'Type', value: issue.type, inline: true },
                { name: 'Location', value: issue.location },
                { name: 'ID', value: '`' + issue.id + '`' }
              ],
              footer: 'Civic AI Reports'
            });
            return json({ ok: true, issue, backend: saved2.backend, note: 'saved without photo' }, 201);
          }
        }
        return json({ ok: false, message: saved.error || 'Could not save. Please try again.' }, 500);
      }

      await sendDiscord(env, {
        title: '🆕 New Issue Reported',
        color: issue.priority ? 0xef4444 : 0x3b82f6,
        fields: [
          { name: 'Type', value: issue.type, inline: true },
          { name: 'Priority', value: issue.priority ? 'Urgent' : 'Normal', inline: true },
          { name: 'Location', value: issue.location },
          { name: 'Reporter', value: issue.reporter, inline: true },
          { name: 'ID', value: '`' + issue.id + '`', inline: true }
        ],
        footer: 'Civic AI Reports'
      });
      return json({ ok: true, issue, backend: saved.backend }, 201);
    }

    if (request.method === 'PATCH') {
      const auth = getAuth(request);
      if (!auth || auth.role !== 'staff') {
        return json({ ok: false, message: 'Staff only' }, 403);
      }
      const body = await request.json().catch(() => ({}));
      const saved = await mutateIssues(env, (issues) => {
        const idx = issues.findIndex((i) => i.id === body.id);
        if (idx === -1) return { abort: true, notFound: true };
        if (body.status) issues[idx].status = body.status;
        if (typeof body.priority === 'boolean') issues[idx].priority = body.priority;
        issues[idx].updatedAt = new Date().toISOString();
        return { issue: issues[idx] };
      });
      if (saved.notFound) return json({ ok: false, message: 'Not found' }, 404);
      if (!saved.ok) return json({ ok: false, message: saved.error || 'Update failed. Try again.' }, 500);
      await sendDiscord(env, {
        title: '✅ Issue Updated (Staff)',
        color: 0x22c55e,
        fields: [
          { name: 'Status', value: String((saved.issue && saved.issue.status) || body.status || '-'), inline: true },
          { name: 'ID', value: '`' + body.id + '`', inline: true }
        ],
        footer: 'Civic AI Staff'
      });
      return json({ ok: true, issue: saved.issue });
    }

    if (request.method === 'DELETE') {
      const auth = getAuth(request);
      if (!auth || auth.role !== 'staff') {
        return json({ ok: false, message: 'Staff only' }, 403);
      }
      const body = await request.json().catch(() => ({}));
      const saved = await mutateIssues(env, (issues) => {
        const before = issues.length;
        for (let i = issues.length - 1; i >= 0; i--) {
          if (issues[i].id === body.id) issues.splice(i, 1);
        }
        return { removed: before !== issues.length };
      });
      if (!saved.ok) return json({ ok: false, message: saved.error || 'Delete failed' }, 500);
      await sendDiscord(env, {
        title: '🗑️ Issue Removed (Staff)',
        color: 0xef4444,
        fields: [{ name: 'ID', value: '`' + body.id + '`' }],
        footer: 'Civic AI Staff'
      });
      return json({ ok: true });
    }

    return json({ ok: false, message: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ ok: false, message: err.message || 'Server error' }, 500);
  }
}
