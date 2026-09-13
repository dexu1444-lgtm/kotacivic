import { json, corsHeaders } from '../utils/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'POST only' }, 405);
  }

  try {
    const { message } = await request.json().catch(() => ({}));
    if (!message) return json({ ok: false, message: 'Message required' }, 400);

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return json({
        ok: true,
        reply:
          'AI is not configured. Set OPENROUTER_API_KEY in Cloudflare variables.'
      });
    }

    const systemPrompt =
      'You are the Civic AI assistant for civic issue reporting in Kota, Rajasthan. Help with potholes, drainage, garbage, login, cases, and photos (required). Be concise. Team Hexagon builds Civic AI, powered by Dex.';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kota-civic.pages.dev',
        'X-Title': 'Civic AI Assistant'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 350,
        temperature: 0.6
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return json({
        ok: true,
        reply: 'AI is temporarily busy. Use Help Desk or contact pourushsoni027@gmail.com.'
      });
    }
    const reply =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      'No reply';
    return json({ ok: true, reply });
  } catch (err) {
    return json({
      ok: true,
      reply: 'Something went wrong with AI. Try Help Desk contact.'
    });
  }
}
