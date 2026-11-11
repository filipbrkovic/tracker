import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const dir=new URL('./sources/',import.meta.url);
let sitemap;
try{sitemap=await fs.readFile(new URL('podravka-products-0.txt',dir),'utf8')}
catch{const response=await fetch('https://podravkagrupa.com/hr/pio-product-sitemap.xml');if(!response.ok)throw new Error('Sitemap HTTP '+response.status);sitemap=await response.text();await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('podravka-products-0.txt',dir),sitemap)}
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]).filter(u=>u.includes('/proizvod/'));
await fs.mkdir(new URL('podravka/',dir),{recursive:true});
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#8211;|&ndash;/g,'–').replace(/&#8217;|&rsquo;/g,'’').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
let done=0;const records=[];
async function one(url){
 const slug=url.split('/').filter(Boolean).at(-1),file=new URL('podravka/'+slug+'.json',dir);
 try{const cached=JSON.parse(await fs.readFile(file,'utf8'));records.push(cached);done++;return}catch{}
 let out={url,retrieved:'2026-11-11'};
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'LocalCal-food-reference/1.0 (private nutrition reference; public product labels)'}});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const html=await res.text();out.sha256=crypto.createHash('sha256').update(html).digest('hex');
  out.name=clean((html.match(/<meta property="og:title" content="([^"]*)"/)||[])[1]||'').replace(/\s*\| Podravka$/,'');
  const brand=(html.match(/<a[^>]*href="[^"]*\/brend\/[^>]*>([\s\S]*?)<\/a>/)||[])[1];out.brand=brand?clean(brand):'Podravka';
  const start=html.indexOf('<div class="product-composition__nutrition-values">');
  if(start<0){out.excluded='no nutrition panel';}
  else{
   const block=html.slice(start,html.indexOf('<!--',start)>start?Math.min(html.indexOf('<!--',start),start+9000):start+9000);
   const boundary=block.indexOf('Na 100');out.nutritionText=clean(block.slice(0,boundary>=0?boundary+180:7000));
   const energy=block.match(/([\d.,]+)\s*kcal\s*\/\s*([\d.,]+)\s*kJ/i);
   const labels=[...block.matchAll(/<h6 class="item__label[^>]*>([\s\S]*?)<\/h6>\s*<h6 class="item__value[^>]*>([\s\S]*?)<\/h6>/g)].map(m=>[clean(m[1]),clean(m[2])]);
   out.labelValues=Object.fromEntries(labels);
   const amount=clean((block.match(/class="item__grammage[^>]*>([\s\S]*?)<\/div>/)||[])[1]||'');out.basisText=amount;
   out.basis=/100\s*ml/i.test(amount)?'100ml':/100\s*g/i.test(amount)?'100g':null;
   const number=text=>{if(text==null||/[<>≤≥]/.test(text))return null;const m=text.match(/(?:^|=\s*)([\d.,]+)/);return m?Number(m[1].replace(',','.')):null};
   out.kcal=energy?Number(energy[1].replace(',','.')):null;out.kj=energy?Number(energy[2].replace(',','.')):null;
   out.p=number(out.labelValues['Bjelančevine']);out.g=number(out.labelValues.Masti);out.c=number(out.labelValues.Ugljikohidrati);
   out.salt=number(out.labelValues.Sol);out.sugars=number(out.labelValues['- šećeri']);
   if(!out.basis)out.excluded='missing explicit 100g/100ml basis';
   else if(out.kcal==null||[out.p,out.g,out.c].some(v=>v==null))out.excluded='missing, bounded or unparsed energy/macros';
   else if(out.kcal<0||out.kcal>1000||[out.p,out.g,out.c].some(v=>v<0||v>100))out.excluded='implausible nutrition';
  }
 }catch(e){out.excluded=e.message}
 await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');records.push(out);done++;
 if(done%25===0)console.log(`${done}/${urls.length} fetched; ${records.filter(x=>!x.excluded).length} with explicit label values`);
}
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<urls.length){const u=urls[cursor++];await one(u);await new Promise(r=>setTimeout(r,180))}}));
records.sort((a,b)=>a.url.localeCompare(b.url));
await fs.writeFile(new URL('podravka-labels.json',dir),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({total:records.length,valid:records.filter(x=>!x.excluded).length,reasons:records.filter(x=>x.excluded).reduce((a,x)=>(a[x.excluded]=(a[x.excluded]||0)+1,a),{})}));
