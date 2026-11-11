export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Calls Gemini directly from this browser. The key is never sent to OWL servers,
 * but it is necessarily visible to this device's browser and Google receives
 * the prompt. Keep the key restricted and do not send sensitive content.
 */
export async function askGemini(
  apiKey: string,
  messages: GeminiMessage[],
  systemInstruction = 'You are the helpful assistant inside the OWL retro phone simulator. Be concise, friendly, and reply in the language used by the user.'
): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new Error('Add a Gemini API key in Settings → AI & online services.');
  const contents = messages
    .filter((m) => m.text.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, 6000) }],
    }));
  if (!contents.length) throw new Error('Write a message first.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.75, maxOutputTokens: 500 },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed (${response.status}).`;
    throw new Error(String(message).slice(0, 260));
  }
  const reply = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part.text || '')
    .join('')
    .trim();
  if (!reply) throw new Error('Gemini returned an empty response. Try again.');
  return reply;
}
