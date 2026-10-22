/** One boundary for every vision runtime. Each provider returns raw answer text; validation and rules are shared. */

export type ProviderId = 'gemini' | 'ollama';

/** What the model is shown: the gridded overview plus nine labeled crops, all JPEG. */
export type VisionInput = { overview: Buffer; crops: { id: string; buffer: Buffer }[]; retryNote?: string };

export type AttemptOutput = { text: string; modelVersion: string | null };

export type HealthResult =
  | { status: 'ready'; modelVersion: string | null; detail: string | null }
  | { status: 'unavailable' | 'config_error'; reason: string };

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  modelName: string;
  /** True only when inference runs on the same machine as this server process (loopback endpoint). */
  local: boolean;
  /** Plain-language disclosure of where the photo goes. Shown before upload. */
  destination: string;
};

export interface VisionProvider extends ProviderInfo {
  /** Is the server configured for this provider at all? Returns a reason when not. */
  configError(): string | null;
  health(signal: AbortSignal): Promise<HealthResult>;
  /** One upstream call. Throws ProviderError; must honour `signal`. */
  attempt(input: VisionInput, signal: AbortSignal): Promise<AttemptOutput>;
}

/**
 * kind decides retry policy: 'transient' (5xx, network) and 'schema' may be retried while the deadline allows;
 * 'quota', 'auth', 'not_found', 'config' never are.
 */
export type ProviderErrorKind = 'transient' | 'quota' | 'auth' | 'not_found' | 'config' | 'bad_request';

export class ProviderError extends Error {
  constructor(message: string, public kind: ProviderErrorKind) {
    super(message);
  }
}
