import http from 'node:http';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
const server=http.createServer(async(req,res)=>{
  try{const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers});const result=await worker.fetch(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}
  catch{res.writeHead(500);res.end('Preview error');}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('SocialPulse preview is ready'));
