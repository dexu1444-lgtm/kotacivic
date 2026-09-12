const SESSION_KEY = 'kota_user';
const TOKEN_KEY = 'kota_token';

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCurrentUser(user, token) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function logout() {
  setCurrentUser(null);
  location.href = 'index.html';
}

async function api(path, options = {}) {
  try {
    const opts = {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch (err) {
    console.error(err);
    return { ok: false, message: 'Network error' };
  }
}

function logDiscord(title, body, from) {
  api('/api/message', {
    method: 'POST',
    body: JSON.stringify({
      title: title || 'Activity',
      body: body || '',
      from: from || getCurrentUser()?.username || 'System'
    })
  }).catch(() => {});
}

async function fetchIssues() {
  const res = await api('/api/issues');
  if (res.ok && Array.isArray(res.issues)) return res.issues;
  return [];
}

/** Animated number counter */
function animateValue(el, end, duration) {
  if (!el) return;
  const start = 0;
  const endNum = Number(end) || 0;
  if (endNum === 0) {
    el.textContent = '0';
    return;
  }
  const t0 = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (endNum - start) * eased);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function loadStats() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  // skeleton-like while loading
  set('statTotal', '…');
  set('statResolved', '…');
  set('statOpen', '…');
  set('statRejected', '…');

  const res = await api('/api/issues');
  let stats = res.ok && res.stats ? res.stats : null;
  if (!stats) {
    const issues = res.ok && Array.isArray(res.issues) ? res.issues : [];
    stats = {
      total: issues.length,
      resolved: issues.filter(i => i.status === 'resolved').length,
      open: issues.filter(i => i.status === 'open' || i.status === 'in_progress').length,
      rejected: issues.filter(i => i.status === 'rejected').length
    };
  }
  animateValue(document.getElementById('statTotal'), stats.total, 900);
  animateValue(document.getElementById('statResolved'), stats.resolved, 900);
  animateValue(document.getElementById('statOpen'), stats.open, 900);
  animateValue(document.getElementById('statRejected'), stats.rejected, 900);
  return stats;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

/** Toast notifications */
function ensureToastWrap() {
  let w = document.getElementById('toastWrap');
  if (!w) {
    w = document.createElement('div');
    w.id = 'toastWrap';
    w.className = 'toast-wrap';
    document.body.appendChild(w);
  }
  return w;
}

function showToast(message, type) {
  type = type || 'info';
  const w = ensureToastWrap();
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = message;
  w.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

/** Confetti (CDN canvas-confetti) */
function fireConfetti() {
  function go() {
    if (typeof confetti !== 'function') return;
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#3b82f6', '#60a5fa', '#8b5cf6', '#34d399', '#fbbf24']
    });
  }
  if (typeof confetti === 'function') {
    go();
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
  s.onload = go;
  document.head.appendChild(s);
}

function initNav() {
  const btn = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('navMenu');
  const overlay = document.getElementById('navOverlay');
  if (!btn || !menu) return;

  let open = false;
  function setOpen(v) {
    open = v;
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  }, { passive: true });

  if (overlay) overlay.addEventListener('click', () => setOpen(false), { passive: true });
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setOpen(false), { passive: true });
  });
}

function initAuthUI() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const user = getCurrentUser();
  if (user) {
    area.innerHTML =
      '<div class="auth-box logged-in">' +
      '<span class="auth-hello">Hi, ' + escapeHtml(user.username) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-block" onclick="logout()">Logout</button>' +
      '</div>';
  } else {
    area.innerHTML =
      '<div class="auth-box">' +
      '<a href="login.html" class="btn btn-primary btn-block">Citizen Login / Signup</a>' +
      '<a href="login.html?staff=1" class="btn btn-outline btn-block">Staff Login</a>' +
      '</div>';
  }
}

function toggleChat() {
  const win = document.getElementById('chatWindow');
  if (win) win.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  const toggle = document.getElementById('chatToggle');
  if (toggle) toggle.addEventListener('click', toggleChat, { passive: true });
});
