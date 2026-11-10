import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadCore} from './extract-core.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.split('/* SYNC-CORE-START */')[1].split('/* SYNC-CORE-END */')[0];
const ctx=vm.createContext({crypto:globalThis.crypto});
vm.runInContext(code+';globalThis.api={validateFood,previewFoods,foodMatches,snapshotFood,stampDiaryItems,mergeDiaryItems}',ctx);
const api=ctx.api;
test('regional names, aliases and distinct brands',()=>{
 const food=api.validateFood({name:'Svježi sir',brand:'A',aliases:'kruh|hljeb',kcal:'98,5'});
 for(const q of ['svjezi sir','KRUH','hljeb']) assert.ok(api.foodMatches(food,q));
 const report=api.previewFoods([food,{...food,brand:'B'}],[]);
 assert.equal(report.added,2);
 assert.equal(api.previewFoods([food,{...food,brand:'B'}],report.foods).added,0);
 assert.equal(food.p,null);
});
test('validation preserves zero and label energy; fractional serving snapshots',()=>{
 const food=api.validateFood({name:'Soup',basis:'serving',kcal:100,p:0,g:0,c:0});
 assert.equal(api.snapshotFood(food,0.5).kcal,50);
 assert.equal(api.snapshotFood(food,0.5).p,0);
 assert.throws(()=>api.validateFood({name:'X',kcal:-1}));
 assert.throws(()=>api.validateFood({name:'X',kcal:10,piece:0}));
 assert.equal(api.previewFoods([{name:'X',kcal:-1}],[]).rejected,1);
});
test('imports work without secure-context UUID and grams convert to servings',()=>{
 const insecure=vm.createContext({crypto:{}});
 vm.runInContext(code+';globalThis.preview=previewFoods',insecure);
 assert.equal(insecure.preview([{name:'LAN food',kcal:10}],[]).added,1);
 const food=api.validateFood({name:'Portion',basis:'serving',piece:200,kcal:300});
 assert.equal(api.snapshotFood(food,100,'g').kcal,150);
 assert.throws(()=>api.snapshotFood(food,100,'ml'));
});
test('explicit reorder survives merge',()=>{
 const before={items:[{id:'a'},{id:'b'}]};api.stampDiaryItems({}, {day:before},100);
 const after=JSON.parse(JSON.stringify(before));after.items.reverse();
 api.stampDiaryItems({day:before},{day:after},200);
 assert.deepEqual(Array.from(api.mergeDiaryItems(before,after,100,200).items,i=>i.id),['b','a']);
});
test('independent same-day offline additions survive; stale copies cannot resurrect deletion',()=>{
 const a={items:[{id:'a',kcal:10}]},b={items:[{id:'b',kcal:20}]};
 api.stampDiaryItems({}, {day:a},100);api.stampDiaryItems({}, {day:b},200);
 const merged=api.mergeDiaryItems(a,b,100,200);
 assert.equal(merged.items.length,2);
 const removed=JSON.parse(JSON.stringify(merged));removed.items=removed.items.filter(i=>i.id!=='a');
 api.stampDiaryItems({day:merged},{day:removed},300);
 assert.deepEqual(Array.from(api.mergeDiaryItems(removed,a,300,100).items,i=>i.id),['b']);
 const core=loadCore();const left={diary:{day:a},meta:core.emptyMeta()},right={diary:{day:b},meta:core.emptyMeta()};
 left.meta.updated.diary.day=100;right.meta.updated.diary.day=200;
 assert.equal(core.syncMerge(left,right).state.diary.day.items.length,2);
});
