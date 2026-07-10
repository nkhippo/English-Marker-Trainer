const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16384;
const ENDPOINT = import.meta.env.VITE_GAS_ENDPOINT || '';

function sanitizeJsonText(text) {
  return text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'");
}

function extractJsonObject(text) {
  const cleaned = sanitizeJsonText(text);
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('レスポンスからJSONオブジェクトを抽出できませんでした');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  throw new Error('JSONオブジェクトが途中で切れています');
}

function parseJsonObject(text) {
  const json = extractJsonObject(text);
  const candidates = [json, json.replace(/,\s*([\]}])/g, '$1')];
  let lastError;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('JSONの解析に失敗しました');
}

export function isApiConfigured() {
  return Boolean(ENDPOINT);
}

export async function callClaudeApi(systemBlocks, userMessage) {
  if (!ENDPOINT) {
    throw new Error('API エンドポイントが設定されていません（VITE_GAS_ENDPOINT）');
  }

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages: [{ role: 'user', content: userMessage }],
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return parseJsonObject(text);
}

export async function generateSetFromApi(userMessage, systemBlocks) {
  return callClaudeApi(systemBlocks, userMessage);
}

export async function regenerateItemFromApi(userMessage, systemBlocks) {
  return callClaudeApi(systemBlocks, userMessage);
}
