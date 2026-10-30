import {searchParams,validPostURI} from '../src/core.js';
// Build substitutes these tokens with source assets as JavaScript string literals.
const assets = {'/':'__HTML__','/app.js':'__APP__','/styles.css':'__CSS__','/core.js':'__CORE__'};
const headers={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
function json(body,status=200,extra={}) {return new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});}
class UpstreamError extends Error {constructor(message,status=502){super(message);this.status=status;}}
export function createHandler(fetcher=(...args)=>fetch(...args)) {
  const clients=new Map();
  async function upstream(endpoint,params){
    for(const host of ['https://public.api.bsky.app','https://api.bsky.app']){
      try{
        const response=await fetcher(`${host}/xrpc/${endpoint}?${new URLSearchParams(params)}`,{headers:{Accept:'application/json','User-Agent':'SocialPulse/2.0'},signal:AbortSignal.timeout(10000),redirect:'error'});
        if(response.status===429)throw new UpstreamError('Bluesky يقيّد الطلبات مؤقتًا. انتظر دقيقة ثم أعد المحاولة.',429);
        if(!response.ok)throw new UpstreamError('تعذر الاتصال بمصدر Bluesky. أعد المحاولة لاحقًا.');
        return await response.json();
      }catch(error){if(error.status===429)throw error;}
    }
    throw new UpstreamError('تعذر جلب البيانات من Bluesky حاليًا. قد يكون البحث العام مقيّدًا أو المصدر غير متاح. لم تُنشأ نتائج بديلة.');
  }
  return async function handle(request) {
    const url=new URL(request.url),path=url.pathname;
    if(!['GET','HEAD'].includes(request.method))return json({error:'الطريقة غير مدعومة.'},405,{Allow:'GET, HEAD'});
    if(path==='/favicon.ico')return new Response(null,{status:204,headers});
    if(Object.hasOwn(assets,path))return new Response(request.method==='HEAD'?null:assets[path],{headers:{...headers,'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
    if(path==='/api/status')return json({status:'ok',version:'2.0.0',source:'Bluesky public API',upstream:'not-checked',sentiment:'local-lexicon',persistence:'browser saved queries only'});
    if(!['/api/search','/api/thread'].includes(path))return json({error:'المسار غير موجود.'},404);
    let params;
    try{
      if(path==='/api/search')params=searchParams(url.searchParams);
      else{const uri=url.searchParams.get('uri');if(!validPostURI(uri))throw Error('رابط المنشور غير صالح.');params={uri,depth:3,parentHeight:0};}
    }catch(error){return json({error:error.message},400);}
    const ip=request.headers.get('cf-connecting-ip');
    if(ip){
      const now=Date.now();let entry=clients.get(ip);if(!entry||entry.reset<=now){entry={count:0,reset:now+60000};clients.set(ip,entry);}
      if(++entry.count>30)return json({error:'طلبات كثيرة. انتظر دقيقة ثم حاول مجددًا.'},429,{'Retry-After':'60'});
      if(clients.size>2000){for(const [k,v] of clients){if(v.reset<=now)clients.delete(k);}if(clients.size>2000)clients.delete(clients.keys().next().value);}
    }
    try{
      const result=await upstream(path==='/api/search'?'app.bsky.feed.searchPosts':'app.bsky.feed.getPostThread',params);
      if(path==='/api/search'){
        if(!Array.isArray(result.posts))throw new UpstreamError('استجابة غير متوقعة من مصدر البيانات.');
        return json({posts:result.posts,cursor:typeof result.cursor==='string'?result.cursor:null,source:'Bluesky',query:params.q,collectedAt:new Date().toISOString()});
      }
      if(!result.thread)throw new UpstreamError('لا توجد سلسلة ردود متاحة لهذا المنشور.');
      return json(result);
    }catch(error){return json({error:error.message||'تعذر جلب البيانات.'},error.status||502,error.status===429?{'Retry-After':'60'}:{});}
  };
}
export default {fetch:createHandler()};
