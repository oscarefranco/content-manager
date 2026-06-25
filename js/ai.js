// ══════════════════════════════════════════════════════════════════════════
// AI HELPER
// ══════════════════════════════════════════════════════════════════════════

async function callAI(messages, opts = {}) {
  const { token, model } = getAIConfig();
  if (!token) throw new Error('NO_TOKEN');
  const resp = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: opts.maxTokens || 2000,
      temperature: opts.temperature || 0.3,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `AI API error: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

