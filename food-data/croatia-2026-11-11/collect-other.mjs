import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base=new URL('./sources/',import.meta.url);
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#039;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
function links(html,host){return [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map(m=>{try{return new URL(m[1],host).href.split('#')[0].replace(/\/$/,'')}catch{return ''}}).filter(u=>u.startsWith(host+'/hr/proizvodi/')&&!u.includes('?')))];}
const num=s=>{if(/[<>≤≥]/.test(s))return null;const m=s.match(/^\s*([\d.,]+)/);return m?Number(m[1].replace(',','.')):null};
async function crawl(host,label,initial){
 const sub=new URL(label+'/',base);await fs.mkdir(sub,{recursive:true});
 const queue=[...initial],seen=new Set(),records=[];
 async function one(url){
  const file=new URL(crypto.createHash('sha256').update(url).digest('hex').slice(0,20)+'.json',sub);
  let out;try{out=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
  if(!out){
   out={url,retrieved:'2026-11-11'};
   try{
    const res=await fetch(url,{signal:AbortSignal.timeout(35000)});if(!res.ok)throw new Error('HTTP '+res.status);
    const html=await res.text();out.sha256=crypto.createHash('sha256').update(html).digest('hex');out.links=links(html,host);
    if(label==='kras'){
     const headings=[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(m=>clean(m[1])).filter(t=>t!=='Kraš');out.name=headings[0];out.brand='Kraš';
    }else{
     const field=className=>clean((html.match(new RegExp('class="'+className+'"[^>]*>([\\s\\S]*?)<\\/[^>]+>'))||[])[1]);
     const title=field('brand-product__title'),sub=field('brand-product__subtitle');out.name=[title,sub].filter(Boolean).join(' – ');out.brand=field('brand-product__label')||'Vindija';
    }
    const table=[...html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].find(m=>/kcal/i.test(m[0])&&/Masti/i.test(m[0]));
    if(!table||!out.name){out.excluded='no product-specific nutrition table'}
    else{
     const context=html.slice(Math.max(0,table.index-600),table.index+Math.min(table[0].length,400));
     const basisMatch=clean(context).match(/(?:na|u|\/|per)\s*100\s*(ml|g)\b/i);out.basis=basisMatch?(basisMatch[1].toLowerCase()==='ml'?'100ml':'100g'):null;
     out.basisText=clean(context).slice(-250);
     out.nutritionText=clean(table[0]);
     const rows=[...table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(n=>clean(n[1]))).filter(r=>r.length>=2);
     out.labelValues=Object.fromEntries(rows.map(r=>[r[0],r[1]]));
     const energy=rows.find(r=>/energ/i.test(r[0]));const kcal=energy?.[1].match(/([\d.,]+)\s*kcal/i);const kj=energy?.[1].match(/([\d.,]+)\s*kJ/i);
     out.kcal=kcal?Number(kcal[1].replace(',','.')):null;out.kj=kj?Number(kj[1].replace(',','.')):null;
     for(const [key,rx] of [['p',/^(Bjelančevine|Proteini)/i],['g',/^Masti/i],['c',/^Ugljikohidrati/i],['salt',/^Sol/i]]){const row=rows.find(r=>rx.test(r[0]));out[key]=row?num(row[1]):null;}
     if(!out.basis)out.excluded='missing explicit 100g/100ml basis';
     else if([out.kcal,out.p,out.g,out.c].some(x=>x==null))out.excluded='missing, bounded or unparsed energy/macros';
    }
   }catch(e){out.excluded=e.message}
   await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');
  }
  records.push(out);for(const link of out.links||[])if(!seen.has(link)&&!queue.includes(link))queue.push(link);
 }
 // Batch by wave so discovered category links are fetched too; per host max 3 requests.
 while(queue.length&&seen.size<360){const batch=[];while(batch.length<3&&queue.length){const url=queue.shift();if(seen.has(url))continue;seen.add(url);batch.push(one(url))}await Promise.all(batch);if(seen.size%30<3)console.log(label,seen.size,'pages;',records.filter(r=>!r.excluded).length,'nutrition tables');await new Promise(r=>setTimeout(r,180))}
 await fs.writeFile(new URL(label+'-labels.json',base),JSON.stringify(records,null,2)+'\n');console.log(label,'DONE',records.length,records.filter(r=>!r.excluded).length);
}
const krasHost='https://www.kras.hr',vindijaHost='https://www.vindija.hr';
async function initialLinks(file,host){try{return links(await fs.readFile(new URL(file,base),'utf8'),host)}catch{return[host+'/hr/proizvodi']}}
await Promise.all([
 crawl(krasHost,'kras',await initialLinks('discover-other-4.txt',krasHost)),
 crawl(vindijaHost,'vindija',await initialLinks('other-index-1.txt',vindijaHost))
]);
