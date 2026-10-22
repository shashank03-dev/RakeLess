import { CELL_CONTRACT, FINAL_INSTRUCTION, GEMINI_RESPONSE_SCHEMA, SYSTEM_PROMPT } from '../prompt.js';
import { ProviderError, type VisionProvider } from './types.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Hosted Gemma through the Gemini API. The photo leaves this server and goes to Google. */
export function geminiProvider(env = process.env): VisionProvider {
  const modelName = env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  const key = () => env.GEMINI_API_KEY || '';
  return {
    id: 'gemini',
    label: 'Google Gemini API (hosted Gemma)',
    modelName,
    local: false,
    destination: 'Your photo is sent from this server to Google’s Gemini API, which runs the Gemma model. Google’s Gemini API terms apply there: on unpaid (free-tier) keys Google may use inputs to improve its products and human reviewers may see them. Do not upload photos of people, house numbers, or anything private.',
    configError: () => (key() ? null : 'GEMINI_API_KEY is not set on the server.'),

    async health(signal) {
      if (!key()) return { status: 'config_error', reason: 'GEMINI_API_KEY is not set on the server.' };
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/models/${modelName}`, { headers: { 'x-goog-api-key': key() }, signal });
      } catch {
        return { status: 'unavailable', reason: 'The Gemini API could not be reached.' };
      }
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { version?: string };
        return { status: 'ready', modelVersion: body.version ?? null, detail: null };
      }
      if (res.status === 404) return { status: 'config_error', reason: `Model ${modelName} is not available to this key.` };
      if (res.status === 401 || res.status === 403) return { status: 'config_error', reason: 'The Gemini API rejected this server’s key.' };
      return { status: 'unavailable', reason: `The Gemini API answered ${res.status}.` };
    },

    async attempt(input, signal) {
      const parts: unknown[] = [{ text: CELL_CONTRACT }, { inline_data: { mime_type: 'image/jpeg', data: input.overview.toString('base64') } }];
      for (const c of input.crops) parts.push({ text: `Cell ${c.id}:` }, { inline_data: { mime_type: 'image/jpeg', data: c.buffer.toString('base64') } });
      parts.push({ text: FINAL_INSTRUCTION });
      if (input.retryNote) parts.push({ text: input.retryNote });

      const res = await fetch(`${API_BASE}/models/${modelName}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 1800, responseMimeType: 'application/json', responseSchema: GEMINI_RESPONSE_SCHEMA },
        }),
      });
      if (res.status === 429) throw new ProviderError('The model quota is exhausted right now. Try again later.', 'quota');
      if (res.status === 401 || res.status === 403) throw new ProviderError('The model rejected this server’s credentials.', 'auth');
      if (res.status === 404) throw new ProviderError(`Model ${modelName} is not available.`, 'not_found');
      if (res.status === 400) throw new ProviderError('The model service rejected the request.', 'bad_request');
      if (!res.ok) throw new ProviderError(`The model service returned ${res.status}.`, 'transient');
      let body: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; modelVersion?: string };
      try {
        body = await res.json();
      } catch {
        throw new ProviderError('The model service returned an unreadable body.', 'transient');
      }
      // Only the answer text; thought parts are discarded, never stored or logged.
      const text = body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
      return { text, modelVersion: body.modelVersion ?? null };
    },
  };
}
