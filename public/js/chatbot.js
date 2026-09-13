async function sendChat() {
  const input = document.getElementById('chatInput');
  const box = document.getElementById('chatMessages');
  if (!input || !box) return;
  const message = (input.value || '').trim();
  if (!message) return;
  input.value = '';

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.textContent = message;
  box.appendChild(userDiv);

  const botDiv = document.createElement('div');
  botDiv.className = 'chat-msg bot';
  botDiv.textContent = '…';
  box.appendChild(botDiv);
  box.scrollTop = box.scrollHeight;

  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    botDiv.textContent = (res && res.reply) || localFallback(message);
  } catch {
    botDiv.textContent = localFallback(message);
  }
  box.scrollTop = box.scrollHeight;
}

function localFallback(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('report')) return 'Go to Report Issue, log in, fill the form, add a photo (required), then submit.';
  if (m.includes('login') || m.includes('signup')) return 'Open Citizen Login / Signup from the menu. Staff use Staff Login.';
  if (m.includes('case') || m.includes('status')) return 'Open Cases to see open, in progress, resolved and rejected issues.';
  if (m.includes('team')) return 'Team Hexagon built Civic AI, powered by Dex.';
  if (m.includes('photo')) return 'A photo is required for every report (max 99 KB). Large images are auto-compressed.';
  return 'Civic AI helps report civic issues in Kota. Try Report Issue, Cases, or Help Desk.';
}
