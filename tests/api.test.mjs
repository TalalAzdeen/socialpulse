import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../worker/index.js').catch(()=>({}));
const call=(handler,path,options)=>handler(new Request('https://example.test'+path,options));
test('API validates before contacting upstream',async()=>{
  assert.equal(typeof mod.createHandler,'function');let calls=0;
  const handler=mod.createHandler(async()=>{calls++;throw Error('unexpected');});
  for(const path of ['/api/search?q=','/api/search?q=x&limit=oops','/api/thread?uri=at://bad','/api/search?q=x&since=2026-02-30'])assert.equal((await call(handler,path)).status,400);
  assert.equal(calls,0);
});
test('search forwards approved filters and cursor and preserves pagination',async()=>{
  assert.equal(typeof mod.createHandler,'function');let target;
  const h=mod.createHandler(async url=>{target=new URL(url);return Response.json({posts:[{uri:'at://x'}],cursor:'page2'});});
  const r=await call(h,'/api/search?q=coffee&lang=en&since=2026-10-01&until=2026-10-30&cursor=page1');
  assert.equal(r.status,200);const data=await r.json();assert.equal(data.cursor,'page2');assert.equal(data.source,'Bluesky');assert.equal(target.searchParams.get('cursor'),'page1');assert.equal(target.searchParams.get('until'),'2026-10-31T00:00:00.000Z');assert.equal(target.hostname,'public.api.bsky.app');
});
test('upstream failures stay errors with no fabricated or empty success',async()=>{
  assert.equal(typeof mod.createHandler,'function');let calls=0;
  const h=mod.createHandler(async()=>{calls++;return Response.json({error:'Unavailable'},{status:503});});
  const r=await call(h,'/api/search?q=coffee');assert.equal(r.status,502);assert.equal(calls,2);const data=await r.json();assert.ok(data.error);assert.equal(data.posts,undefined);
});
test('upstream throttling returns 429 without retrying another host',async()=>{
  assert.equal(typeof mod.createHandler,'function');let calls=0;
  const h=mod.createHandler(async()=>{calls++;return Response.json({},{status:429});});
  const r=await call(h,'/api/search?q=x');assert.equal(r.status,429);assert.equal(calls,1);assert.ok(r.headers.get('retry-after'));
});
test('API methods, unknown resources, root and security headers',async()=>{
  assert.equal(typeof mod.createHandler,'function');const h=mod.createHandler();
  assert.equal((await call(h,'/api/status',{method:'POST'})).status,405);
  assert.equal((await call(h,'/.env')).status,404);
  const r=await call(h,'/api/status');assert.equal((await r.json()).upstream,'not-checked');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
});
test('thread response exposes root and accessible replies',async()=>{
  assert.equal(typeof mod.createHandler,'function');const h=mod.createHandler(async url=>{assert.equal(new URL(url).searchParams.get('depth'),'3');return Response.json({thread:{post:{uri:'root'},replies:[]}});});
  const r=await call(h,'/api/thread?uri='+encodeURIComponent('at://did:plc:abc/app.bsky.feed.post/123'));assert.equal(r.status,200);assert.equal((await r.json()).thread.post.uri,'root');
});
test('per-isolate limiter stops rapid requests with a known client IP',async()=>{
  assert.equal(typeof mod.createHandler,'function');const h=mod.createHandler(async()=>Response.json({posts:[]}));let r;
  for(let i=0;i<31;i++)r=await call(h,'/api/search?q=x',{headers:{'cf-connecting-ip':'192.0.2.4'}});
  assert.equal(r.status,429);
});
