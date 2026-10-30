import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../src/core.js').catch(() => ({}));

test('sentiment matches whole tokens and explains local evidence', () => {
  assert.equal(typeof core.sentiment, 'function');
  assert.equal(core.sentiment('goodness newspaper').label, 'neutral');
  assert.equal(core.sentiment('هذا رَائِع وممتاز').label, 'positive');
  assert.equal(core.sentiment('not good').label, 'negative');
  assert.equal(core.sentiment('ليس سيئ').label, 'positive');
  assert.equal(core.sentiment('رائع وسيئ').label, 'neutral');
  assert.ok(core.sentiment('رائع').matches.includes('رائع'));
});
test('CSV keeps multiline quotes and neutralizes formula cells', () => {
  assert.equal(typeof core.toCSV, 'function');
  const text=core.toCSV([['نص','حساب'],['=1+1',' \t@evil'],['a"b\nc','normal']]);
  assert.ok(text.startsWith('\uFEFF'));
  assert.ok(text.includes('"\'=1+1"'));
  assert.ok(text.includes('"\' \t@evil"'));
  assert.ok(text.includes('"a""b\nc"'));
});
test('pagination retains first occurrence and metrics use unique accounts', () => {
  assert.equal(typeof core.uniquePosts, 'function');
  const posts=core.uniquePosts([{uri:'at://1',author:{did:'a'},likeCount:2,record:{text:'رائع'}},{uri:'at://1',author:{did:'a'},likeCount:99},{uri:'at://2',author:{did:'a'},replyCount:3,record:{text:'سيئ'}}]);
  assert.equal(posts.length,2);
  const stats=core.summarize(posts);
  assert.equal(stats.accounts,1);assert.equal(stats.likes,2);assert.equal(stats.replies,3);
  assert.deepEqual(stats.sentiments,{positive:1,neutral:0,negative:1});
});
test('search validates dates, ranges and bounded parameters', () => {
  assert.equal(typeof core.searchParams, 'function');
  const p=core.searchParams(new URLSearchParams({q:' قهوة ',lang:'ar',since:'2026-10-01',until:'2026-10-30',cursor:'next',limit:'40'}));
  assert.equal(p.q,'قهوة');assert.equal(p.cursor,'next');assert.equal(p.until,'2026-10-31T00:00:00.000Z');
  for (const invalid of [{q:''},{q:'x',limit:'wat'},{q:'x',since:'2026-02-30'},{q:'x',since:'2026-10-30',until:'2026-10-01'},{q:'x',lang:'file://x'},{q:'x',cursor:'x'.repeat(2001)}]) assert.throws(()=>core.searchParams(new URLSearchParams(invalid)));
});
test('only safe links and full AT post references are accepted', () => {
  assert.equal(typeof core.safeURL, 'function');
  assert.equal(core.safeURL('javascript:alert(1)'), '');
  assert.equal(core.safeURL('https://bsky.app/x'), 'https://bsky.app/x');
  assert.equal(core.validPostURI('at://did:plc:abc/app.bsky.feed.post/123'),true);
  assert.equal(core.validPostURI('at://bad'),false);
  assert.equal(core.validPostURI('https://evil.test'),false);
});
