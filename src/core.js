const positive = new Set(['جميل','رائع','ممتاز','احب','عظيم','حلو','مبدع','شكرا','نجاح','مبروك','افضل','مذهل','love','great','amazing','excellent','good','best','awesome','happy']);
const negative = new Set(['سيئ','سيء','فاشل','مشكله','كارثه','غالي','سيئه','ضعيف','مخيب','زعلان','اسوا','bad','worst','hate','terrible','awful','disappointed','poor','broken']);
const negations = new Set(['لا','ليس','مو','مش','ما','not','never','no']);
export function normalize(text='') {return String(text).toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');}
export function sentiment(text='') {
  const tokens=normalize(text).match(/[\p{L}\p{N}]+/gu)||[];let score=0;const matches=[];
  tokens.forEach((token,i)=>{
    let word=token;
    if(!positive.has(word)&&!negative.has(word)&&word.startsWith('و'))word=word.slice(1);
    let value=positive.has(word)?1:negative.has(word)?-1:0;
    if(value){if(tokens.slice(Math.max(0,i-2),i).some(x=>negations.has(x)))value*=-1;score+=value;matches.push(token);}
  });
  return {label:score>0?'positive':score<0?'negative':'neutral',score,matches,method:'local-lexicon'};
}
export function safeURL(value) {try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function validPostURI(uri) {return typeof uri==='string'&&uri.length<=500&&/^at:\/\/[a-zA-Z0-9.:%_-]+\/app\.bsky\.feed\.post\/[a-zA-Z0-9_-]+$/.test(uri);}
export function postLink(p) {if(!validPostURI(p?.uri))return '';return `https://bsky.app/profile/${encodeURIComponent(p.author?.did||p.uri.split('/')[2])}/post/${encodeURIComponent(p.uri.split('/').at(-1))}`;}
export function uniquePosts(posts) {const seen=new Set();return posts.filter(p=>p&&typeof p.uri==='string'&&!seen.has(p.uri)&&seen.add(p.uri));}
export function summarize(posts) {
  const accounts=new Set(),speakers=new Map(),days=new Map(),sentiments={positive:0,neutral:0,negative:0};let likes=0,replies=0,reposts=0;
  for(const p of posts){const id=p.author?.did||p.author?.handle;if(id){accounts.add(id);const a=speakers.get(id)||{author:p.author,count:0};a.count++;speakers.set(id,a);}likes+=Number(p.likeCount)||0;replies+=Number(p.replyCount)||0;reposts+=Number(p.repostCount)||0;sentiments[sentiment(p.record?.text).label]++;const d=p.record?.createdAt?.slice(0,10);if(d&&/^\d{4}-\d{2}-\d{2}$/.test(d))days.set(d,(days.get(d)||0)+1);}
  return {total:posts.length,accounts:accounts.size,likes,replies,reposts,sentiments,speakers:[...speakers.values()].sort((a,b)=>b.count-a.count).slice(0,5),days:[...days].sort((a,b)=>a[0].localeCompare(b[0]))};
}
export function toCSV(rows) {return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
export function searchParams(input) {
  const q=(input.get('q')||'').trim();if(!q||q.length>180)throw new Error('أدخل عبارة بحث من ١ إلى ١٨٠ حرفًا.');
  const limit=Number(input.get('limit')||40);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('عدد النتائج يجب أن يكون بين ١ و١٠٠.');
  const sort=input.get('sort')||'latest';if(!['latest','top'].includes(sort))throw new Error('ترتيب النتائج غير صالح.');
  const lang=input.get('lang')||'';if(lang&&!['ar','en'].includes(lang))throw new Error('اللغة غير صالحة.');
  const cursor=input.get('cursor')||'';if(cursor.length>2000||/[\u0000-\u001f]/.test(cursor))throw new Error('مؤشر الصفحة غير صالح.');
  const dates={};for(const key of ['since','until']){const d=input.get(key);if(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw new Error('التاريخ غير صالح.');dates[key]=d;}}
  if(dates.since&&dates.until&&dates.since>dates.until)throw new Error('تاريخ البداية يجب أن يسبق النهاية.');
  const result={q,sort,limit};if(lang)result.lang=lang;if(cursor)result.cursor=cursor;
  if(dates.since)result.since=new Date(dates.since).toISOString();
  if(dates.until)result.until=new Date(Date.parse(dates.until)+86400000).toISOString();
  return result;
}
