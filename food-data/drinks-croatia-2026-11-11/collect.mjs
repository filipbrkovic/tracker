import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export const dir=new URL('./sources/',import.meta.url);
export const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export const rows=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1])));
export const links=(html,base)=>[...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map(m=>{try{return new URL(m[1].replaceAll('&amp;','&'),base).href.split('#')[0]}catch{return ''}}))];
export const numeric=s=>/^\s*\d+(?:[.,]\d+)?\s*(?:g)?\s*$/.test(s||'')?Number(s.replace(/g/g,'').replace(',','.').trim()):null;
export async function get(url){const hash=crypto.createHash('sha256').update(url).digest('hex').slice(0,20);const file=new URL(`pages/${hash}.html`,dir);try{return await fs.readFile(file,'utf8')}catch{};const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();await fs.mkdir(new URL('pages/',dir),{recursive:true});await fs.writeFile(file,h);return h;}
export async function batch(urls,fn,n=3){for(let i=0;i<urls.length;i+=n){await Promise.all(urls.slice(i,i+n).map(async u=>{try{await fn(u,await get(u))}catch(e){console.log('FETCH FAIL',u,e.message)}}));if(i%30===0)console.log('Progress',i,'/',urls.length);await new Promise(r=>setTimeout(r,200));}}
if(process.argv[2]==='discover'){
 const hbc='https://hr.coca-colahellenic.com';
 const h=await fs.readFile(new URL('discovery-0.html',dir),'utf8');
 const action=h.match(/data-action="([^"]+product-list[^" ]+)"/)?.[1];
 if(action){const j=await get(hbc+action);await fs.writeFile(new URL('hbc-products.json',dir),j);console.log('HBC',j.slice(0,900));}
 const host='https://www.konzum.hr';
 const cats=['pica/bezalkoholna/voda','pica/bezalkoholna/gazirana','pica/bezalkoholna/negazirana','pica/bezalkoholna/energetska-pica','pica/pivo','pica/vino','pica/alkoholna-pica','zdravi-kutak/napitci','zdravi-kutak/sportska-prehrana/izotonicni-napitci','mlijecni-proizvodi-i-jaja/mlijeko'];
 const products=new Map();let pages=[];
 await batch(cats.map(c=>host+'/web/t/kategorije/'+c),async(u,h)=>{for(const l of links(h,u)){if(l.includes('/web/products/'))products.set(l,u);if(l.startsWith(u+'?')&&/page=/.test(l))pages.push(l)}},2);
 pages=[...new Set(pages)].filter(l=>Number(new URL(l).searchParams.get('page'))<=10);
 await batch(pages,async(u,h)=>{for(const l of links(h,u))if(l.includes('/web/products/'))products.set(l,u.split('?')[0]);},2);
 await fs.writeFile(new URL('konzum-products.json',dir),JSON.stringify([...products].map(([url,category])=>({url,category})),null,2));console.log('KONZUM products',products.size,'pages',pages.length);
 const sample=[...products.keys()].find(u=>/jana-vitamin/.test(u))||[...products.keys()][0];console.log('SAMPLE',sample);const sh=await get(sample);await fs.writeFile(new URL('konzum-sample.html',dir),sh);console.log('TABLES', [...sh.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>clean(m[0])).join('\n').slice(0,4000));
}
