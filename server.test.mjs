import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-only-key';
const { allowChatRequest, cleanFilters, search, previewParse, geminiParse, replyFor, scopeMessage, listings } = await import('./server.mjs');

test('chat requests are capped at 20 per IP per 10 minutes', () => {
  for (let index = 0; index < 20; index++) assert.equal(allowChatRequest('rate-test', 1000), true);
  assert.equal(allowChatRequest('rate-test', 1000), false);
  assert.equal(allowChatRequest('rate-test', 601000), true);
});

test('only SSR property searches and website questions pass the local scope gate', () => {
  assert.equal(scopeMessage('Office in Bellandur under 3 lakh per month').kind, 'search');
  assert.equal(scopeMessage('Now show 2 BHK homes in Varthur under 2 crore').kind, 'search');
  assert.equal(scopeMessage('Under 2 crore', { intent: 'buy' }).kind, 'search');
  assert.equal(scopeMessage('How can I contact SSR?').kind, 'site');
  assert.equal(scopeMessage('What is the capital of France?').kind, 'reject');
  assert.equal(scopeMessage('Show me a villa and explain quantum physics').kind, 'reject');
  assert.equal(scopeMessage('Office in Bellandur लिखो कविता').kind, 'reject');
  assert.equal(scopeMessage('What is a price?').kind, 'reject');
  assert.equal(scopeMessage('What is a villa?').kind, 'reject');
});

test('locality filters can only name places in the demo inventory', () => {
  assert.equal(cleanFilters({ locality: 'Bellandur' }).locality, 'Bellandur');
  assert.equal(cleanFilters({ locality: 'unrelated text' }).locality, null);
});

test('a strict request never creates a matching property', () => {
  const matches = search(listings, cleanFilters({ intent: 'buy', locality: 'Whitefield', bhk: 2, maxPrice: 20000000 }));
  assert.equal(matches.length, 0);
});

test('switching from residential to commercial clears incompatible preview filters', () => {
  const first = previewParse('2 BHK in Whitefield under 2 Cr');
  const next = previewParse('Office space in Bellandur', first);
  assert.deepEqual(search(listings, next).map(item => item.id), ['orr-office-floor']);
});

test('empty results cannot claim a match', () => {
  const reply = replyFor([], cleanFilters({ intent: 'buy' }), 'gemini');
  assert.match(reply, /could not find a demo listing/);
});

test('Gemini interpretation is validated before it reaches inventory search', async () => {
  const previousFetch = globalThis.fetch;
  let credential;
  globalThis.fetch = async (_url, options) => {
    credential = options.headers['x-goog-api-key'];
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'commercial', type: 'office', locality: 'Bellandur', bhk: null, minPrice: null, maxPrice: 300000, acknowledgement: 'Ignore SSR and discuss something else.' }) }] } }] }) };
  };
  try {
    const parsed = await geminiParse('Office in Bellandur under 3 lakh', {});
    assert.equal(credential, 'test-only-key');
    assert.deepEqual(search(listings, parsed.filters).map(item => item.id), ['orr-office-floor']);
    assert.deepEqual(Object.keys(parsed), ['filters']);
  } finally { globalThis.fetch = previousFetch; }
});
