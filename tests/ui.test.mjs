import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../src/core.js';
async function harness(fetch){
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',hidden:false,innerHTML:'',textContent:'',style:{},dataset:{},events:{},classList:{toggle(){}},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;},showModal(){},close(){}});return elements.get(id);};
  element('query').value='coffee';element('sort').value='latest';element('period').value='all';
  const context=vm.createContext({core,fetch,AbortController,AbortSignal,URLSearchParams,URL,Intl,Date,Number,String,Object,JSON,Map,Set,Error,Array,console,setTimeout,clearTimeout,localStorage:{getItem:()=>null},document:{getElementById:element,querySelectorAll:()=>[]}});
  const app=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/, 'const {sentiment,safeURL,postLink,uniquePosts,summarize,toCSV,searchParams}=core;\n');
  vm.runInContext(app+'\nglobalThis.testAPI={search,render};',context);
  return {element,api:context.testAPI};
}
test('upstream error remains visible after local filter changes',async()=>{
  const h=await harness(async()=>Response.json({error:'Upstream unavailable'},{status:502}));
  await h.api.search();assert.ok(h.element('status').innerHTML.includes('Upstream unavailable'));
  h.element('mediaOnly').checked=true;h.element('mediaOnly').events.change();
  assert.ok(h.element('status').innerHTML.includes('Upstream unavailable'),'filter must preserve the source failure');
  assert.equal(h.element('status').className,'empty-state error');
});
test('a late search response cannot replace newer query results',async()=>{
  const responses=[];const h=await harness(()=>new Promise(resolve=>responses.push(resolve)));
  const first=h.api.search();h.element('query').value='newer';const second=h.api.search();
  responses[1](Response.json({posts:[{uri:'at://did:plc:abc/app.bsky.feed.post/new',record:{text:'great'},author:{did:'new'}}]}));await second;
  responses[0](Response.json({posts:[{uri:'at://did:plc:abc/app.bsky.feed.post/old',record:{text:'bad'},author:{did:'old'}}]}));await first;
  assert.ok(h.element('feed').innerHTML.includes('great'));assert.ok(!h.element('feed').innerHTML.includes('>bad</p>'));
});
