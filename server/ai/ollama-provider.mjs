import { BriefBrainError, CancelledError } from '../shared/errors.mjs';

function isLoopbackOllama(baseUrl) {
  const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '');
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

function requestHeaders(config) {
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (config.ollamaApiKey) headers.authorization = `Bearer ${config.ollamaApiKey}`;
  return headers;
}

function timeoutSignal(signal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function parseStrictJson(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new BriefBrainError('OLLAMA_INVALID_JSON', 'The Ollama model returned an empty response.', { status: 502 });
  }
  try {
    const trimmed = content.trim();
    // Some compliant chat models put their otherwise valid structured result
    // in one complete Markdown JSON fence. Accept only that exact wrapper;
    // prose before or after the object remains invalid.
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    return JSON.parse(fenced ? fenced[1] : trimmed);
  } catch (cause) {
    throw new BriefBrainError('OLLAMA_INVALID_JSON', 'The Ollama model did not return valid JSON.', { status: 502, cause });
  }
}

function validationMessage(error) {
  const issues = error?.issues || error?.errors;
  if (Array.isArray(issues)) {
    return issues.slice(0, 8).map((issue) => `${issue.path?.join('.') || 'root'}: ${issue.message}`).join('; ');
  }
  // A domain rule ("this id is not in the catalog") is the most useful repair
  // hint we have. Forward it verbatim rather than a generic schema complaint.
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message ? message.slice(0, 600) : 'The result did not match the required JSON schema.';
}

/**
 * Sole AI adapter. The browser never chooses a model or receives the API key;
 * every call uses exactly config.ollamaModel.
 */
export function createOllamaProvider({ config, fetchImpl = globalThis.fetch, logger } = {}) {
  if (!config) throw new Error('Ollama provider requires server configuration.');
  const base = config.ollamaBaseUrl.replace(/\/$/, '');

  function assertConfigured() {
    if (!isLoopbackOllama(base) && !config.ollamaApiKey) {
      throw new BriefBrainError('OLLAMA_NOT_CONFIGURED', 'Ollama is not configured on this server.', { status: 503 });
    }
  }

  async function rawRequest(path, init, { signal } = {}) {
    assertConfigured();
    const deadline = timeoutSignal(signal, config.ollamaTimeoutMs);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: { ...requestHeaders(config), ...init.headers },
        signal: deadline.signal,
      });
      if (!response.ok) {
        const message = response.status === 401 || response.status === 403
          ? 'Ollama Cloud denied access to the configured model. Check the API key, subscription, and model access.'
          : 'Ollama could not complete the request.';
        throw new BriefBrainError('OLLAMA_UNAVAILABLE', message, { status: 503, details: { status: response.status } });
      }
      return await response.json();
    } catch (error) {
      if (deadline.timedOut()) throw new BriefBrainError('OLLAMA_TIMEOUT', 'Ollama took too long to respond.', { status: 504, cause: error });
      if (signal?.aborted || error?.name === 'AbortError') throw new CancelledError();
      if (error instanceof BriefBrainError) throw error;
      throw new BriefBrainError('OLLAMA_UNAVAILABLE', 'Ollama could not be reached.', { status: 503, cause: error });
    } finally {
      deadline.dispose();
    }
  }

  async function status() {
    const configured = isLoopbackOllama(base) || Boolean(config.ollamaApiKey);
    if (!configured) return { provider: 'ollama', model: config.ollamaModel, configured: false, available: false };
    try {
      const payload = await rawRequest('/tags', { method: 'GET' });
      const models = Array.isArray(payload.models) ? payload.models : [];
      const names = models.map((model) => model.name).filter(Boolean);
      // Some hosted endpoints do not expose /tags. A successful probe still
      // means the service is reachable; the chat request remains authoritative.
      return {
        provider: 'ollama',
        model: config.ollamaModel,
        configured: true,
        available: true,
        modelAvailable: names.length === 0 || names.includes(config.ollamaModel),
      };
    } catch (error) {
      logger?.warn('ollama_status_unavailable', { code: error.code });
      return { provider: 'ollama', model: config.ollamaModel, configured: true, available: false, modelAvailable: false };
    }
  }

  function numPredict(maxTokens) {
    const requested = Number.isInteger(maxTokens) ? maxTokens : config.ollamaNumPredict;
    if (!Number.isInteger(requested)) return {};
    // A generous ceiling keeps one long page draft from being truncated while
    // still bounding a runaway response.
    return { num_predict: Math.max(256, Math.min(8_192, requested)) };
  }

  async function chatOnce({ systemPrompt, userPrompt, jsonSchema, images = [], maxTokens, signal }) {
    const payload = await rawRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        format: jsonSchema,
        options: { temperature: 0, ...numPredict(maxTokens) },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt, images: images.map((image) => Buffer.from(image).toString('base64')) },
        ],
      }),
    }, { signal });
    return parseStrictJson(payload?.message?.content ?? payload?.response);
  }

  async function generateJson({ systemPrompt, userPrompt, jsonSchema, images, maxTokens, validate, signal }) {
    let repair = null;
    let lastError;
    for (let attempt = 1; attempt <= config.aiAttempts; attempt += 1) {
      if (signal?.aborted) throw new CancelledError();
      try {
        const prompt = repair
          ? `${userPrompt}\n\nYour previous result failed validation. Return the complete JSON object again, with no markdown. Validation errors: ${repair}`
          : userPrompt;
        const value = await chatOnce({ systemPrompt, userPrompt: prompt, jsonSchema, images, maxTokens, signal });
        return validate ? await validate(value) : value;
      } catch (error) {
        if (error instanceof CancelledError || signal?.aborted) throw new CancelledError();
        lastError = error;
        const retryable = error?.code === 'OLLAMA_INVALID_JSON' || error?.name === 'ZodError' || error?.code === 'SCHEMA_INVALID';
        if (!retryable || attempt >= config.aiAttempts) break;
        repair = validationMessage(error);
      }
    }
    if (lastError?.name === 'ZodError') {
      throw new BriefBrainError('OLLAMA_SCHEMA_INVALID', 'Ollama returned a result outside the required schema.', { status: 502, cause: lastError });
    }
    throw lastError;
  }

  return Object.freeze({
    kind: 'ollama',
    model: config.ollamaModel,
    status,
    generateJson,
  });
}
