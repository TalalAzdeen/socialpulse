import json
from pathlib import Path
p=Path(__file__).parent
items=[
('T01','تثبيت وتشغيل التطبيق المحلي','implemented',[], 'server.py and index.html','HTTP 200 from GET / and JSON 200 from GET /api/status'),
('T02','البحث عن منشورات Bluesky العامة','implemented',['T01'],'Bluesky public XRPC','Return genuine search results or explicit upstream failure; no mock fallback'),
('T03','عرض بيانات الحسابات والمنشورات','implemented',['T02'],'Post metadata','Show author, original link, text, engagement and available media'),
('T04','جلب ردود المنشورات','implemented',['T02'],'Bluesky getPostThread','Display accessible public replies; do not imply comprehensive capture'),
('T05','تحليل مشاعر أولي','implemented',['T02'],'Arabic/English lexicon','Label positive/neutral/negative as approximate only'),
('T06','تصدير نتائج CSV وJSON','implemented',['T02'],'CSV formula neutralization and JSON provenance','Download UTF-8 CSV and JSON for filtered displayed sample'),
('T07','اختبار بحث Bluesky على الإنترنت','blocked',['T02'],'Reachable external API','Successful live test of search and thread endpoints'),
('T08','إضافة YouTube Data API','planned',['T01'],'YouTube API key + quotas','Search videos and retrieve public comment threads per API limits'),
('T09','تقييم TikTok Instagram X APIs','planned',['T01'],'Approved access and platform policies','Document legal access, supported scopes, pricing and coverage'),
('T10','توحيد مصادر البيانات','planned',['T08','T09'],'Normalized Post/Comment/Author/Media model','Normalized records with source, timestamps and provenance'),
('T11','تحسين تحليل العربية واللهجات','planned',['T10'],'Validation dataset, model budget','Document measured precision/recall and confidence/uncertainty'),
('T12','تجميع وتحليل الانطباع عبر الزمن','implemented',['T02','T05'],'Time-series aggregation','Charts show source, sample size, collection period and limitations'),
('T13','حفظ البيانات والجدولة','planned',['T10'],'Database, legal retention, scheduler','Configurable retention, deduplication, background jobs and error logs'),
('T14','ضوابط أمان أساسية للنشر','implemented',['T01'],'HTTPS, allowlists, quotas, CORS policy','Rate limits, safe query validation, dependency/security review'),
('T15','رفع الكود إلى GitHub','blocked',['T01'],'Repository Contents: write permission','Files readable in TalalAzdeen/socialpulse on main'),
('T16','نشر المنصة على استضافة عامة','blocked',['T14','T15'],'External hosting authorization','HTTPS public URL, /api/status works, real search test'),
('T17','اختبارات تلقائية وCI (المراقبة المستمرة غير مهيأة)','implemented',['T01','T14'],'Test harness and CI','API health, regression, mock upstream, deployment monitoring'),
('T18','توثيق الخصوصية والامتثال','planned',['T09','T13'],'Platform terms and applicable privacy law','Data inventory, rights handling, consent/access policy and retention')]
ctx={'@vocab':'https://schema.org/','sp':'https://example.org/socialpulse/ontology#','Task':'sp:Task','status':'sp:status','dependsOn':{'@id':'sp:dependsOn','@type':'@id'},'acceptanceCriteria':'sp:acceptanceCriteria','resource':'sp:resource','taskId':'sp:taskId'}
graph=[]
for i,name,status,deps,res,accept in items:
 graph.append({'@id':'sp:'+i,'@type':'Task','taskId':i,'name':name,'status':status,'dependsOn':['sp:'+d for d in deps],'resource':res,'acceptanceCriteria':accept})
(p/'tasks.jsonld').write_text(json.dumps({'@context':ctx,'@graph':graph},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
# Turtle uses a local vocabulary rather than claiming standardized task semantics
esc=lambda s:s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n')
out=['@prefix sp: <https://example.org/socialpulse/ontology#> .','@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .','']
for i,name,status,deps,res,accept in items:
 attrs=[f'sp:taskId "{i}"',f'sp:name "{esc(name)}"',f'sp:status "{status}"',f'sp:resource "{esc(res)}"',f'sp:acceptanceCriteria "{esc(accept)}"']
 if deps: attrs.append('sp:dependsOn '+', '.join('sp:'+d for d in deps))
 out.append(f'sp:{i} a sp:Task ;\n    '+' ;\n    '.join(attrs)+' .\n')
(p/'tasks.ttl').write_text('\n'.join(out),encoding='utf8')
summary={'implemented':0,'planned':0,'blocked':0}
for x in graph:summary[x['status']]+=1
(p/'status.json').write_text(json.dumps({'asOf':'2026-10-30','statusCounts':summary,'notes':['Implemented refers to code presence, not complete production validation','GitHub Contents API returned 403 Resource not accessible by integration on 2026-10-30','Owner-private Sites deployment succeeded; see docs/DELIVERY.md for receipt. Public access was not requested','Live verification is recorded separately; mock tests do not prove live API availability']},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
