/**
 * Claude API プロキシ（GAS ウェブアプリ）— English Marker Trainer 専用
 *
 * デプロイ: ウェブアプリ / 実行ユーザー=自分 / アクセス=全員
 * Script Properties: ANTHROPIC_API_KEY
 *
 * フロントは POST body を text/plain で送る（CORS プリフライト回避）。
 */
function doPost(e) {
  if (!e?.postData?.contents) {
    return jsonResponse({ error: { message: 'Empty request body' } }, 400);
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: { message: 'Invalid JSON body' } }, 400);
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: { message: 'ANTHROPIC_API_KEY not configured' } }, 500);
  }

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code >= 400) {
    return jsonResponse({ error: { message: 'Upstream API error', status: code, detail: text } }, 502);
  }

  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj, status) {
  const output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
