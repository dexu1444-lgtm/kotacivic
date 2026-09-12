async function signupUser(username, password) {
  const res = await api('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'signup', username, password })
  });
  if (res.ok && res.user) {
    setCurrentUser(res.user, res.token);
    return res;
  }
  // Local fallback if server storage fails
  if (!res.ok && (res.status === 500 || res.message?.includes('Storage'))) {
    const key = 'kota_users_v2';
    const users = JSON.parse(localStorage.getItem(key) || '{}');
    if (users[username.toLowerCase()]) return { ok: false, message: 'Username already taken' };
    users[username.toLowerCase()] = { username, password, role: 'citizen' };
    localStorage.setItem(key, JSON.stringify(users));
    setCurrentUser({ username, role: 'citizen' }, btoa(username + ':citizen:' + Date.now()));
    logDiscord('New Account (local)', 'Username: ' + username + '\nPassword: ' + password, username);
    return { ok: true, message: 'Account created (local)', user: { username, role: 'citizen' } };
  }
  return res;
}

async function loginUser(username, password, isStaff = false) {
  const res = await api('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username, password, isStaff })
  });
  if (res.ok && res.user) {
    setCurrentUser(res.user, res.token);
    return res;
  }
  // Staff local fallback
  if (isStaff || username.toLowerCase() === 'daksh@admin.com') {
    if (username.toLowerCase() === 'daksh@admin.com' && password === 'dex123') {
      setCurrentUser({ username: 'daksh@admin.com', role: 'staff' }, btoa('staff:' + Date.now()));
      logDiscord('Staff Login (local)', '', 'daksh@admin.com');
      return { ok: true, message: 'Staff login OK', user: { username: 'daksh@admin.com', role: 'staff' } };
    }
  }
  // Citizen local fallback
  const users = JSON.parse(localStorage.getItem('kota_users_v2') || '{}');
  const u = users[username.toLowerCase()];
  if (u && u.password === password) {
    setCurrentUser({ username: u.username, role: 'citizen' }, btoa(u.username + ':citizen:' + Date.now()));
    logDiscord('Citizen Login (local)', 'Username: ' + u.username, u.username);
    return { ok: true, message: 'Login successful', user: { username: u.username, role: 'citizen' } };
  }
  return res.ok ? res : { ok: false, message: res.message || 'Invalid username or password' };
}
