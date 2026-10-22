import { CELL_CONTRACT, FINAL_INSTRUCTION, JSON_RESPONSE_SCHEMA, SYSTEM_PROMPT } from '../prompt.js';
import { ProviderError, type VisionProvider } from './types.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * A local or self-hosted Ollama runtime. The endpoint is fixed by server configuration
 * (OLLAMA_URL), never by the browser. `local` is true only for a loopback endpoint.
 */
export function ollamaProvider(env = process.env): VisionProvider {
  const base = (env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const modelName = env.OLLAMA_MODEL || 'gemma4:e2b';
  let host = '';
  try { host = new URL(base).hostname; } catch { /* reported by configError */ }
  const local = LOOPBACK.has(host);
  const configError = () => {
    try {
      const u = new URL(base);
      return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'OLLAMA_URL must be an http(s) URL.';
    } catch {
      return 'OLLAMA_URL is not a valid URL.';
    }
  };
  return {
    id: 'ollama',
    label: local ? 'Ollama on this machine' : `Ollama at ${host}`,
    modelName,
    local,
    destination: local
      ? 'Your photo goes to the RakeLess server on this machine and to the Ollama runtime on the same machine. It is not sent to a cloud model.'
      : `Your photo goes to the RakeLess server and then to the Ollama runtime at ${host}, which the server operator configured.`,
    configError,

    async health(signal) {
      const err = configError();
      if (err) return { status: 'config_error', reason: err };
      let res: Response;
      try {
        res = await fetch(`${base}/api/show`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: modelName }) });
      } catch {
        return { status: 'unavailable', reason: `Ollama is not reachable at ${local ? 'localhost' : host}. Is \`ollama serve\` running?` };
      }
      if (res.status === 404) return { status: 'config_error', reason: `Model ${modelName} is not pulled. Run: ollama pull ${modelName}` };
      if (!res.ok) return { status: 'unavailable', reason: `Ollama answered ${res.status}.` };
      const body = (await res.json().catch(() => ({}))) as { capabilities?: string[]; details?: { quantization_level?: string; parameter_size?: string } };
      if (Array.isArray(body.capabilities) && !body.capabilities.includes('vision')) {
        return { status: 'config_error', reason: `Model ${modelName} does not accept images. Use a vision-capable Gemma tag.` };
      }
      const digest = await modelDigest(base, modelName, signal);
      const d = body.details;
      return { status: 'ready', modelVersion: digest, detail: d ? [d.parameter_size, d.quantization_level].filter(Boolean).join(' · ') || null : null };
    },

    async attempt(input, signal) {
      const messages: { role: string; content: string; images?: string[] }[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: CELL_CONTRACT, images: [input.overview.toString('base64')] },
        ...input.crops.map((c) => ({ role: 'user', content: `Cell ${c.id}:`, images: [c.buffer.toString('base64')] })),
        { role: 'user', content: FINAL_INSTRUCTION + (input.retryNote ? `\n${input.retryNote}` : '') },
      ];
      let res: Response;
      try {
        res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: modelName, messages, format: JSON_RESPONSE_SCHEMA, stream: false, think: false, options: { temperature: 0, num_predict: 1800 } }),
        });
      } catch (e) {
        if (signal.aborted) throw e;
        throw new ProviderError('Ollama could not be reached.', 'transient');
      }
      if (res.status === 404) throw new ProviderError(`Model ${modelName} is not pulled in Ollama.`, 'not_found');
      if (res.status === 400) throw new ProviderError('Ollama rejected the request (does this model accept images?).', 'bad_request');
      if (!res.ok) throw new ProviderError(`Ollama returned ${res.status}.`, 'transient');
      const body = (await res.json().catch(() => null)) as { message?: { content?: string } } | null;
      if (!body) throw new ProviderError('Ollama returned an unreadable body.', 'transient');
      return { text: body.message?.content ?? '', modelVersion: await modelDigest(base, modelName, signal).catch(() => null) };
    },
  };
}

/** The local manifest digest identifies exactly which weights answered. Null if Ollama does not list it. */
async function modelDigest(base: string, model: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${base}/api/tags`, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { models?: { name?: string; model?: string; digest?: string }[] };
    const want = model.includes(':') ? model : `${model}:latest`;
    const m = body.models?.find((x) => x.name === want || x.model === want);
    return m?.digest ? `${want}@sha256:${m.digest.replace(/^sha256:/, '')}` : null;
  } catch {
    return null;
  }
}
