import {sentiment,safeURL,postLink,uniquePosts,summarize,toCSV,searchParams} from '/core.js';
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('ar-SA').format(n);
const labels={positive:'إيجابي',neutral:'محايد / غير محسوم',negative:'سلبي'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=s=>{const d=new Date(s);return Number.isNaN(+d)?'تاريخ غير متاح':new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',calendar:'gregory'}).format(d);};
let posts=[],visible=[],cursor=null,querySnapshot=null,collectedAt=null,busy=false,selected='all',serial=0,controller,toastTimer,searchError=null;
let saved=[];try{const list=JSON.parse(localStorage.getItem('socialpulse.queries.v2')||'[]');if(Array.isArray(list))saved=list.filter(x=>x&&typeof x.q==='string'&&x.q.length<=180).slice(0,20);}catch{}
function updateSaved(){ $('savedCount').textContent=fmt(saved.length); }
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function dialog(title,content){$('dialogTitle').textContent=title;$('dialogContent').className='dialog-content';$('dialogContent').innerHTML=content;$('infoDialog').showModal();}
function methodology(){dialog('عن البيانات وطريقة التحليل',`<p><strong>المصدر المتصل: Bluesky فقط.</strong> نستخدم واجهة القراءة العامة للبحث وجلب الردود. لا نجمع محتوى خاصًا، وقد تتأخر فهرسة بعض الكلمات أو يقيّد المصدر البحث. مؤشر الصفحة لا يضمن الوصول إلى جميع المنشورات.</p><p><strong>الانطباع تقدير قاموسي محلي.</strong> نطابق كلمات عربية وإنجليزية ونراعي بعض صيغ النفي. لا يوجد نموذج ذكاء اصطناعي أو قياس دقة مُعتمد. السخرية واللهجات والمواقف المركبة قد تُصنّف خطأ؛ والمحايد يشمل غياب الكلمات المعروفة أو تعادلها. هذه العينة لا تمثل جمهور المنصة.</p><p><strong>الأرقام:</strong> التفاعل هو مجموع الإعجابات والردود وإعادة النشر المسجّلة وقت الاسترجاع. الحسابات الفريدة بحسب المعرّف. المخطط يصف تواريخ المنشورات المسترجعة بتوقيت UTC، ولا يمثل حجم النقاش الكلي. فلاتر الانطباع والوسائط تغيّر العينة المعروضة والتحليل والتصدير معًا.</p><p><strong>الخصوصية:</strong> عمليات البحث المحفوظة تبقى في تخزين هذا المتصفح ويمكن حذفها. التطبيق لا يحفظ المنشورات في قاعدة بيانات ولا يجمعها في الخلفية. طلبات البحث تُرسل إلى خادم الموقع ثم Bluesky؛ قد تسجّل البنية المستضيفة طلبات الشبكة. الصور تُحمّل من عناوينها العامة. التصدير يُنشئ ملفًا على جهازك.</p><p>لا يُنصح باستخدام هذه التقديرات وحدها في قرارات حساسة أو لإصدار أحكام على أشخاص. الحد الأقصى للجلسة ٥٠٠ منشور. تحديد الطلبات في الخادم تقريبي ضمن كل نسخة تشغيل.</p>`);}
function avatar(author){const url=safeURL(author?.avatar);return url?`<img class="avatar" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="avatar avatar-fallback" aria-hidden="true">${esc((author?.displayName||author?.handle||'ن').slice(0,1))}</span>`;}
function media(p){return p.embed?.media||p.embed||{};}
function hasMedia(p){const m=media(p);return !!(m.images?.length||m.playlist||m.external?.thumb||m.$type?.includes('video'));}
function renderMedia(p){
  if((p.labels||[]).some(l=>['porn','sexual','nudity','graphic-media'].includes(l.val)))return '<p class="panel-note">وسائط حساسة مخفية؛ يمكنك فتح المنشور الأصلي لمراجعتها.</p>';
  const m=media(p);let html='';
  if(m.images?.length)html='<div class="post-media">'+m.images.map(i=>{const image=safeURL(i.thumb||i.fullsize),full=safeURL(i.fullsize||i.thumb);return image?`<a href="${esc(full)}" target="_blank" rel="noopener noreferrer"><img src="${esc(image)}" alt="${esc(i.alt||'صورة من المنشور')}" loading="lazy" referrerpolicy="no-referrer"></a>`:'';}).join('')+'</div>';
  if(m.external){const url=safeURL(m.external.uri);if(url)html+=`<a class="external-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(m.external.title||url)}</a>`;}
  if(m.playlist||m.$type?.includes('video')){const url=postLink(p);if(url)html+=`<a class="external-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer">▷ شاهد الفيديو في المنشور الأصلي</a>`;}
  return html;
}
function renderPost(p,index){
  const s=sentiment(p.record?.text),link=postLink(p),author=p.author||{};
  return `<article class="post"><div class="post-author">${avatar(author)}<div class="post-author-info"><strong>${esc(author.displayName||author.handle||'حساب عام')}</strong><small>@${esc(author.handle||'غير متاح')}</small></div><span class="sentiment-badge ${s.label}" title="${esc(s.matches.length?'كلمات مطابقة: '+s.matches.join('، '):'لا توجد إشارة قاموسية واضحة')}">${labels[s.label]}</span></div><p class="post-text" dir="auto">${esc(p.record?.text||'منشور دون نص')}</p>${renderMedia(p)}<div class="post-meta"><span>♡ ${fmt(p.likeCount||0)} إعجاب</span><span>☏ ${fmt(p.replyCount||0)} رد</span><span>⇄ ${fmt(p.repostCount||0)} إعادة نشر</span></div><div class="post-bottom"><time>${esc(dateLabel(p.record?.createdAt))}</time>${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">المصدر ↗</a>`:''}<button class="comment-button" data-comments="${index}" aria-expanded="false">الردود العامة</button></div><div id="thread-${index}"></div></article>`;
}
function render(){
  visible=posts.filter(p=>(selected==='all'||sentiment(p.record?.text).label===selected)&&(!$('mediaOnly').checked||hasMedia(p)));
  const s=summarize(visible);$('total').textContent=fmt(s.total);$('users').textContent=fmt(s.accounts);$('engagement').textContent=fmt(s.likes+s.replies+s.reposts);$('positive').textContent=s.total?fmt(Math.round(s.sentiments.positive/s.total*100))+'٪':'—';$('donutTotal').textContent=fmt(s.total);
  $('sampleLabel').textContent=querySnapshot?`المعروض ${fmt(visible.length)} من ${fmt(posts.length)} مسترجعة`:'ابدأ بحثًا لجمع البيانات';
  const a=s.total?s.sentiments.positive/s.total*100:0,b=s.total?s.sentiments.neutral/s.total*100:0;
  $('donut').style.background=s.total?`conic-gradient(var(--green) 0 ${a}%,var(--neutral) ${a}% ${a+b}%,var(--red) ${a+b}% 100%)`:'#eeedf5';
  $('donut').setAttribute('aria-label',s.total?Object.entries(s.sentiments).map(([k,n])=>labels[k]+': '+fmt(n)).join('، '):'لا توجد بيانات');
  $('legend').innerHTML=Object.entries(s.sentiments).map(([key,n])=>`<div><span><i class="dot ${key}"></i> ${labels[key]}</span><strong>${fmt(n)} <small>(${s.total?fmt(Math.round(n/s.total*100)):fmt(0)}٪)</small></strong></div>`).join('');
  $('speakers').className=s.speakers.length?'':'speakers-empty';$('speakers').innerHTML=s.speakers.length?s.speakers.map(x=>`<div class="speaker">${avatar(x.author)}<div class="speaker-name"><strong>${esc(x.author.displayName||x.author.handle)}</strong><small>@${esc(x.author.handle)}</small></div><span class="speaker-count">${fmt(x.count)}</span></div>`).join(''):'<span>♧</span><p>لا توجد حسابات في العينة المعروضة.</p>';
  if(s.days.length){
    const groups=[],size=Math.ceil(s.days.length/28);for(let i=0;i<s.days.length;i+=size){const g=s.days.slice(i,i+size);groups.push({start:g[0][0],end:g.at(-1)[0],count:g.reduce((v,d)=>v+d[1],0)});}
    const max=Math.max(...groups.map(g=>g.count));$('timeline').className='';$('timeline').innerHTML='<div class="timeline-bars">'+groups.map(g=>`<div class="day-bar" style="height:${Math.max(3,g.count/max*100)}%" title="${esc(g.start+(g.end!==g.start?' — '+g.end:''))}: ${fmt(g.count)} منشور" role="img" aria-label="${esc(g.start)}: ${fmt(g.count)} منشور"></div>`).join('')+'</div><div class="chart-labels"><span>'+esc(groups[0].start)+'</span><span>'+esc(groups.at(-1).end)+'</span></div>';
  }else{$('timeline').className='chart-empty';$('timeline').innerHTML='<span class="tiny-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><p>لا توجد تواريخ لعرضها في العينة الحالية.</p>';}
  $('resultBadge').textContent=fmt(visible.length);$('resultContext').textContent=querySnapshot?`«${querySnapshot.q}» · Bluesky · ${fmt(posts.length)} منشور مسترجع${collectedAt?' · '+dateLabel(collectedAt):''}`:'المنشورات العامة، من المصدر إلى أمامك.';
  $('feed').innerHTML=visible.map(renderPost).join('');$('exportCSV').disabled=$('exportJSON').disabled=!visible.length||busy;$('saveSearch').disabled=!querySnapshot||busy;
  $('loadMore').hidden=!cursor||posts.length>=500;$('loadMore').disabled=busy;
  if(!busy&&querySnapshot){if(searchError&&!posts.length)showStatus('تعذر إكمال البحث',searchError,true);else if(!visible.length)showStatus(posts.length?'لا توجد نتائج تطابق الفلاتر الحالية.':'لم نجد منشورات في العينة الحالية.','جرّب عبارة أخرى أو وسّع الفترة واللغة.');else $('status').hidden=true;}
}
function showStatus(title,description='',error=false){$('status').hidden=false;$('status').className='empty-state'+(error?' error':'');$('status').innerHTML=`<h3>${esc(title)}</h3><p>${esc(description)}</p>`;}
function snapshot(){
  const s={q:$('query').value.trim(),sort:$('sort').value,lang:$('language').value,limit:'40'};const period=$('period').value;
  if(period==='custom'){if($('since').value)s.since=$('since').value;if($('until').value)s.until=$('until').value;}
  else if(period!=='all'){const d=new Date();d.setUTCDate(d.getUTCDate()-Number(period)+1);s.since=d.toISOString().slice(0,10);}
  searchParams(new URLSearchParams(s));return s;
}
async function search(more=false){
  let next;try{next=more?querySnapshot:snapshot();if(!next) return;}catch(error){toast(error.message);return;}
  if(more&&(!cursor||busy))return;
  controller?.abort();controller=new AbortController();const ticket=++serial,requestedCursor=more?cursor:null;
  if(!more){posts=[];cursor=null;collectedAt=null;searchError=null;querySnapshot={...next};selected='all';$('mediaOnly').checked=false;updateTabs();}
  busy=true;render();$('searchBtn').disabled=true;$('searchBtn').textContent='جارٍ الرصد…';$('feed').setAttribute('aria-busy','true');
  if(!more){$('status').hidden=false;$('status').className='empty-state';$('status').innerHTML='<span class="loading-icon"></span><h3>نستمع إلى الحديث الآن…</h3><p>نبحث في منشورات Bluesky العامة. قد يستغرق المصدر بعض الوقت.</p>';}
  else $('loadMore').textContent='جارٍ تحميل المزيد…';
  const params=new URLSearchParams(next);if(requestedCursor)params.set('cursor',requestedCursor);
  let failure=null;
  try{
    const response=await fetch('/api/search?'+params,{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'تعذر البحث.');if(!Array.isArray(data.posts))throw Error('استجابة غير صالحة من الخادم.');if(ticket!==serial)return;
    posts=uniquePosts([...posts,...data.posts]).slice(0,500);cursor=data.cursor&&data.cursor!==requestedCursor?data.cursor:null;collectedAt=data.collectedAt||new Date().toISOString();
    if(posts.length>=500)toast('وصلت إلى حد الجلسة: ٥٠٠ منشور. يمكنك تصدير العينة أو بدء بحث جديد.');
  }catch(error){if(ticket!==serial||error.name==='AbortError')return;failure=error.message;}
  finally{if(ticket===serial){busy=false;$('searchBtn').disabled=false;$('searchBtn').innerHTML='ابدأ الرصد <span>←</span>';$('feed').setAttribute('aria-busy','false');$('loadMore').textContent='تحميل المزيد من المصدر ↓';if(failure&&!more)searchError=failure;render();if(failure&&more)toast(failure);}}
}
function updateTabs(){document.querySelectorAll('[data-sentiment]').forEach(b=>{const on=b.dataset.sentiment===selected;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
function flattenThread(root){const out=[],stack=[...(root?.replies||[])].reverse();while(stack.length&&out.length<80){const t=stack.pop();if(t.post)out.push(t.post);if(Array.isArray(t.replies))stack.push(...[...t.replies].reverse());}return out;}
async function comments(button){
  const index=Number(button.dataset.comments),p=visible[index],target=$('thread-'+index);if(!p||!target)return;
  if(target.dataset.loaded){target.hidden=!target.hidden;button.setAttribute('aria-expanded',String(!target.hidden));return;}
  button.disabled=true;button.textContent='جارٍ التحميل…';
  try{
    const r=await fetch('/api/thread?uri='+encodeURIComponent(p.uri),{signal:AbortSignal.timeout(25000)}),data=await r.json();if(!r.ok)throw Error(data.error||'تعذر جلب الردود.');if(!target.isConnected)return;
    if(data.thread?.blocked||data.thread?.notFound||!data.thread?.post)throw Error('هذا المنشور محذوف أو الردود غير متاحة للعامة.');
    const list=flattenThread(data.thread);target.innerHTML=`<div class="comments"><strong>الردود المتاحة: ${fmt(list.length)}</strong>${list.map(c=>`<div class="comment"><strong>@${esc(c.author?.handle)}</strong><div dir="auto">${esc(c.record?.text||'')}</div></div>`).join('')||'<p>لا توجد ردود عامة متاحة.</p>'}<small>حتى ٣ مستويات و٨٠ ردًا؛ قد لا تشمل السلسلة كاملة.</small></div>`;target.dataset.loaded='true';button.setAttribute('aria-expanded','true');button.textContent='إظهار / إخفاء الردود';
  }catch(error){if(target.isConnected){target.innerHTML='<div class="comments">'+esc(error.message)+'</div>';button.textContent='إعادة تحميل الردود';}}
  finally{button.disabled=false;}
}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('تم تجهيز تصدير العينة المعروضة.');}
function saveQuery(){if(!querySnapshot)return;const q={...querySnapshot};saved=[q,...saved.filter(x=>JSON.stringify(x)!==JSON.stringify(q))].slice(0,20);try{localStorage.setItem('socialpulse.queries.v2',JSON.stringify(saved));updateSaved();toast('تم حفظ البحث في هذا المتصفح.');}catch{toast('تعذر الحفظ. قد يكون تخزين المتصفح غير متاح.');}}
function savedDialog(){dialog('عمليات البحث المحفوظة',saved.length?saved.map((s,i)=>`<div class="saved-item"><button data-restore="${i}">${esc(s.q)} ←</button><button class="delete" data-delete="${i}" aria-label="حذف ${esc(s.q)}">×</button></div>`).join(''):'<p>احفظ بحثًا من زر «حفظ البحث» بعد تشغيله. ستظهر عمليات البحث هنا في هذا المتصفح.</p>');}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
$('period').addEventListener('change',()=>{$('customDates').hidden=$('period').value!=='custom';});
$('loadMore').addEventListener('click',()=>search(true));
$('mediaOnly').addEventListener('change',render);
$('feed').addEventListener('click',e=>{const b=e.target.closest('[data-comments]');if(b)comments(b);});
for(const b of document.querySelectorAll('[data-sentiment]'))b.addEventListener('click',()=>{selected=b.dataset.sentiment;updateTabs();render();});
for(const b of document.querySelectorAll('[data-query]'))b.addEventListener('click',()=>{$('query').value=b.dataset.query;search();});
$('saveSearch').addEventListener('click',saveQuery);$('savedNav').addEventListener('click',savedDialog);$('mobileSavedNav').addEventListener('click',savedDialog);
for(const id of ['aboutBtn','methodBtn','privacyBtn'])$(id).addEventListener('click',methodology);
$('closeDialog').addEventListener('click',()=>$('infoDialog').close());
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const rect=$('infoDialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('infoDialog').close();}});
$('dialogContent').addEventListener('click',e=>{
  const restore=e.target.closest('[data-restore]'),del=e.target.closest('[data-delete]');
  if(restore){const s=saved[Number(restore.dataset.restore)];if(!s)return;$('query').value=s.q;$('sort').value=s.sort||'latest';$('language').value=s.lang||'';$('period').value=s.since||s.until?'custom':'all';$('since').value=s.since||'';$('until').value=s.until||'';$('customDates').hidden=$('period').value!=='custom';$('infoDialog').close();search();}
  if(del){saved.splice(Number(del.dataset.delete),1);try{localStorage.setItem('socialpulse.queries.v2',JSON.stringify(saved));}catch{}updateSaved();$('infoDialog').close();savedDialog();}
});
$('exportCSV').addEventListener('click',()=>download('socialpulse-results.csv',toCSV([['المصدر','الوقت','الحساب','المنشور','الانطباع التقريبي','الكلمات المطابقة','الإعجابات','الردود','إعادة النشر','الرابط'],...visible.map(p=>{const s=sentiment(p.record?.text);return ['Bluesky',p.record?.createdAt,p.author?.handle,p.record?.text,labels[s.label],s.matches.join('، '),p.likeCount||0,p.replyCount||0,p.repostCount||0,postLink(p)];})]),'text/csv;charset=utf-8'));
$('exportJSON').addEventListener('click',()=>download('socialpulse-results.json',JSON.stringify({source:'Bluesky',query:querySnapshot,filters:{sentiment:selected,mediaOnly:$('mediaOnly').checked},collectedAt,exportedAt:new Date().toISOString(),sampleSize:visible.length,retrievedCount:posts.length,limitations:'Public search sample only; local lexicon sentiment is approximate and not representative of public opinion.',posts:visible.map(p=>({...p,analysis:sentiment(p.record?.text),originalURL:postLink(p)}))},null,2),'application/json;charset=utf-8'));
$('today').textContent=new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'long',year:'numeric',calendar:'gregory'}).format(new Date());
updateSaved();
