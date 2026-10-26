import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {output,read} from './common.mjs';
const base=path.join(output,'builds'),port=Number(process.env.PORT||4387);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.map':'application/json'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>jQuery recovery fixtures</title><h1>jQuery 4.0.0 build matrix</h1><ul>'+read(path.join(output,'build-manifest.json')).builds.map(b=>`<li><a href="/${b.id}/index.html">${b.id}</a></li>`).join('')+'</ul>');return}
 const target=path.resolve(base,'.'+decodeURIComponent(url.pathname));
 if(!target.startsWith(base+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.statusCode=404;res.end('Not found');return}
 res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`jQuery fixtures: http://127.0.0.1:${port}`));
