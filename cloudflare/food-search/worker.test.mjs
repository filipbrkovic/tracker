import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProduct,searchRequest} from './src/worker.js';
const env={SEARCH_TOKEN:'test-token-at-least-16-characters',OFF_USER_AGENT:'LocalCal-test/1.0'};
const product={code:'3858888602825',product_name:'Example biscuits',product_name_hr:'Primjer keksi',brands:'Example',quantity:'300 g',nutrition_data_per:'serving',nutriments:{'energy-kcal_100g':447,proteins_100g:6.6,fat_100g:18,carbohydrates_100g:62,'energy-kcal_serving':134}};
const request=(query='keksi',token=env.SEARCH_TOKEN)=>new Request('https://lookup.example/search?q='+encodeURIComponent(query),{headers:{Authorization:'Bearer '+token}});
test('normalization uses as-sold per-100-unit values and requires explicit basis confirmation',()=>{
 const result=normalizeProduct(product);
 assert.equal(result.name,'Primjer keksi');assert.equal(result.kcal,447);assert.equal(result.basis,null);assert.equal(result.p,6.6);assert.equal(result.usable,true);
 const limited=normalizeProduct({...product,nutriments:{...product.nutriments,fat_modifier:'<',fat_100g:0.5}});
 assert.equal(limited.g,null);assert.ok(limited.notes.some(n=>n.includes('left blank')));
 assert.equal(normalizeProduct({...product,nutriments:{'energy-kcal_prepared_100g':100}}).usable,false);
 assert.equal(normalizeProduct({...product,nutriments:{...product.nutriments,proteins_100g:null}}).p,null);
 assert.equal(normalizeProduct({...product,nutriments:{'energy-kj_100g':418.4}}).kcal,100);
 assert.equal(normalizeProduct(null),null);
});
test('Worker authenticates before network/cache, validates input, filters Croatia and caches successful results',async()=>{
 let calls=0;const cacheValues=new Map(),tasks=[];
 const deps={fetcher:async(url,options)=>{calls++;assert.equal(url.hostname,'world.openfoodfacts.org');assert.equal(url.searchParams.get('tag_0'),'en:croatia');assert.equal(url.searchParams.get('search_terms'),'keksi');assert.equal(options.headers['User-Agent'],'LocalCal-test/1.0');return Response.json({products:[product,product,null]})},cache:{match:async k=>cacheValues.get(k.url)?.clone(),put:async(k,v)=>cacheValues.set(k.url,v)}};
 const ctx={waitUntil:p=>tasks.push(p)};
 assert.equal((await searchRequest(request('keksi','bad'),env,ctx,deps)).status,401);
 assert.equal((await searchRequest(request('a'),env,ctx,deps)).status,400);assert.equal(calls,0);
 const first=await searchRequest(request(),env,ctx,deps);assert.equal(first.status,200);assert.equal((await first.json()).results.length,1);
 await Promise.all(tasks);await searchRequest(request(),env,ctx,deps);assert.equal(calls,1);
 assert.equal((await searchRequest(request('keksi','bad'),env,ctx,deps)).status,401);
});
test('upstream failures and rate limits never become successful or cached results',async()=>{
 const ctx={waitUntil:()=>assert.fail('errors must not be cached')};
 for(const [status,expected] of [[429,429],[503,502]]){
  const result=await searchRequest(request(),env,ctx,{fetcher:async()=>new Response('unavailable',{status})});assert.equal(result.status,expected);assert.ok((await result.json()).error);
 }
 const result=await searchRequest(request(),env,ctx,{fetcher:async()=>new Response('<html>no data</html>')});assert.equal(result.status,502);
});
