async function sendChat() {
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.textContent = text;
  messages.appendChild(userDiv);
  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  const typing = document.createElement('div');
  typing.className = 'chat-msg bot';
  typing.id = 'typing';
  typing.textContent = 'Thinking...';
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;

  let reply = '';
  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    });
    if (res.ok && res.reply) {
      reply = res.reply;
    } else {
      reply = localFallbackReply(text);
    }
  } catch (e) {
    reply = localFallbackReply(text);
  }

  typing.remove();
  const botDiv = document.createElement('div');
  botDiv.className = 'chat-msg bot';
  botDiv.textContent = reply;
  messages.appendChild(botDiv);
  messages.scrollTop = messages.scrollHeight;
}

// Offline / fallback answers so chatbot always works
function localFallbackReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('report') || m.includes('pothole') || m.includes('garbage') || m.includes('drainage')) {
    return 'To report an issue: 1) Login or Signup 2) Go to Report page 3) Choose type, location & optional photo 4) Submit. You can track it on the Cases page.';
  }
  if (m.includes('login') || m.includes('signup') || m.includes('account')) {
    return 'Use Citizen Login / Signup from the menu (☰). Staff login is only for municipal staff (daksh@admin.com).';
  }
  if (m.includes('status') || m.includes('case') || m.includes('track')) {
    return 'Open the Cases page from the menu to see all open, in-progress, resolved and rejected issues with status bars.';
  }
  if (m.includes('contact') || m.includes('phone') || m.includes('email') || m.includes('help')) {
    return 'Contact: pourushsoni027@gmail.com or +91 6378256027. You can also send a message from the Help Desk page.';
  }
  if (m.includes('team') || m.includes('hexagon') || m.includes('who')) {
    return 'Team Hexagon: Shreya Vijay (Leader), Ruchi Sharma (Co-Leader), Pourush Soni (Developer), Apeksha Jain (Co-Developer), Nitya Soni & Burhan Khan (Members). Powered by Dex.';
  }
  if (m.includes('kota') || m.includes('map')) {
    return 'This platform is for civic issues in Kota, Rajasthan. The map on Home and Cases shows reported locations.';
  }
  return 'I can help with reporting issues, checking cases, login help, or contact info. Try asking: "How do I report a pothole?" or "How to contact admin?" If AI is offline, these basic answers still work.';
}
