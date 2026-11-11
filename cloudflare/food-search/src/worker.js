const FIELDS = ['code','product_name','product_name_en','product_name_hr','brands','quantity','nutriments','no_nutrition_data','nutrition_data_per','countries_tags'];
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value.trim().slice(0,240) : '';
const json = (body,status=200,headers={}) => Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});

export function normalizeProduct(product) {
  if(!product||typeof product!=='object')return null;
  const code=text(product.code), name=text(product.product_name_hr)||text(product.product_name)||text(product.product_name_en);
  if(!/^\d{8,14}$/.test(code)||!name)return null;
  const notes=[], n=product.nutriments||{};
  const nutrient=(key)=>{
    const modifier=n[key+'_modifier'];
    if(modifier&&modifier!=='='){notes.push(`${key}: ${text(modifier)} ${n[key+'_100g']??'unknown'}; numeric value left blank`);return null;}
    return numeric(n[key+'_100g']);
  };
  let kcal=nutrient('energy-kcal');
  if(kcal==null&&!n['energy-kcal_modifier']){
    const kj=nutrient('energy-kj')??nutrient('energy');
    if(kj!=null){kcal=Math.round(kj/4.184*10)/10;notes.push('Calories converted from source kJ using 4.184 kJ per kcal');}
  }
  const p=nutrient('proteins'),g=nutrient('fat'),c=nutrient('carbohydrates');
  const usable=product.no_nutrition_data!=='on'&&kcal!=null&&kcal<=1500&&[p,g,c].every(v=>v==null||v<=150);
  if(!usable)notes.push('Nutrition is missing or implausible; use manual entry after checking the label');
  if([p,g,c].some(v=>v==null))notes.push('Missing macros remain unknown, not zero');
  const url=`https://world.openfoodfacts.org/product/${code}`;
  return {code,name,brand:text(product.brands),quantity:text(product.quantity),aliases:[...new Set([text(product.product_name_hr),text(product.product_name_en),text(product.product_name)].filter(v=>v&&v!==name))],kcal,p,g,c,usable,url,notes,
    // OFF's _100g values also mean per 100ml for liquids. Do not infer density
    // or copy a per-serving declaration as if it were a per-100-unit value.
    basis:null,source:`Open Food Facts; barcode ${code}; as-sold nutrition per 100g or 100ml (basis confirmed by user); ${url}; ODbL`,cat:'packaged'};
}

async function readJSON(response) {
  const reader=response.body.getReader();let length=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1_000_000)throw new Error('Response too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function searchRequest(request,env,ctx,{fetcher=fetch,cache}={}) {
  const url=new URL(request.url);
  if(url.pathname!=='/search')return json({error:'Not found'},404);
  if(request.method!=='GET')return json({error:'Use GET'},405,{Allow:'GET'});
  if(typeof env.SEARCH_TOKEN!=='string'||env.SEARCH_TOKEN.length<16)return json({error:'Food search is not configured'},503);
  if(request.headers.get('Authorization')!==`Bearer ${env.SEARCH_TOKEN}`)return json({error:'Unauthorized'},401);
  const q=(url.searchParams.get('q')||'').trim().replace(/\s+/g,' '),market=url.searchParams.get('market')||'croatia';
  if([...q].length<2||[...q].length>100||/[\x00-\x1f\x7f]/.test(q))return json({error:'Enter between 2 and 100 characters'},400);
  if(!['croatia','world'].includes(market))return json({error:'Unknown market'},400);
  const cacheURL=new URL('/cached-search',url.origin);cacheURL.searchParams.set('q',q.toLowerCase());cacheURL.searchParams.set('market',market);
  const cacheKey=new Request(cacheURL);
  const cached=await cache?.match(cacheKey);if(cached)return cached;
  const upstream=new URL('https://world.openfoodfacts.org/cgi/search.pl');
  for(const [key,value] of Object.entries({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'20',fields:FIELDS.join(',')}))upstream.searchParams.set(key,value);
  if(market==='croatia'){upstream.searchParams.set('tagtype_0','countries');upstream.searchParams.set('tag_contains_0','contains');upstream.searchParams.set('tag_0','en:croatia');}
  try {
    const response=await fetcher(upstream,{headers:{Accept:'application/json','User-Agent':env.OFF_USER_AGENT||'LocalCal/1.0 (https://github.com/heizelnut/tracker)'},signal:AbortSignal.timeout(15000),redirect:'manual'});
    if(response.status===429)return json({error:'Open Food Facts is busy. Try again in a minute.'},429,{'Retry-After':'60'});
    if(!response.ok)return json({error:'Open Food Facts is temporarily unavailable. Please try again later.'},502);
    const data=await readJSON(response);
    if(!Array.isArray(data.products))throw new Error('Unexpected response');
    const seen=new Set();const products=data.products.map(normalizeProduct).filter(p=>p&&!seen.has(p.code)&&seen.add(p.code));
    products.sort((a,b)=>Number(b.usable)-Number(a.usable));
    const result=json({provider:'Open Food Facts',query:q,market,results:products.slice(0,8),attribution:{name:'Open Food Facts',url:'https://world.openfoodfacts.org',license:'ODbL',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/'}},200,{'Cache-Control':'public, max-age=300'});
    if(cache)ctx.waitUntil(cache.put(cacheKey,result.clone()));
    return result;
  }catch{return json({error:'The food database did not respond with usable results. Please try again later.'},502);}
}

export default {fetch(request,env,ctx){return searchRequest(request,env,ctx,{cache:caches.default});}};
