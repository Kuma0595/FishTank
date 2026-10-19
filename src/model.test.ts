import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, parseState, cloneState } from './model'
import { species } from './catalog'

test('ten distinct freshwater entries and default tank survive a JSON round trip',()=>{
 assert.equal(species.length,10);assert.equal(new Set(species.map(s=>s.id)).size,10)
 const state=initialState();const parsed=parseState(JSON.parse(JSON.stringify(state)));assert.deepEqual(parsed,state)
 assert.equal(new Set([...state.fish,...state.items].map(v=>v.uid)).size,state.fish.length+state.items.length)
})
test('snapshots do not mutate the original tank',()=>{const state=initialState();const snapshot=cloneState(state);snapshot.fish.pop();snapshot.items[0]!.x=2;assert.equal(state.fish.length,8);assert.notEqual(state.items[0]!.x,2)})
test('reject incompatible versions, unknown species, invalid transforms and duplicate identities',()=>{
 const state=initialState()
 assert.throws(()=>parseState({...state,version:2}))
 assert.throws(()=>parseState({...state,fish:[{uid:'a',id:'shark'}]}))
 assert.throws(()=>parseState({...state,fish:[{uid:'a',id:'__proto__'}]}))
 assert.throws(()=>parseState({...state,items:[{...state.items[0],id:'constructor'}]}))
 assert.throws(()=>parseState({...state,fish:[...state.fish,state.fish[0]]}))
 for(const value of [NaN,Infinity,99,'1']){const copy=cloneState(state);(copy.items[0] as any).x=value;assert.throws(()=>parseState(copy))}
 assert.throws(()=>parseState({...state,items:[{...state.items[0],scale:0.01}]}))
 assert.throws(()=>parseState({...state,sand:'unsupported'}))
 assert.throws(()=>parseState({...state,fish:Array.from({length:31},()=>({uid:crypto.randomUUID(),id:'neon'}))}))
})
test('empty tanks can be restored without silently reintroducing inhabitants',()=>{const state=initialState();state.fish=[];state.items=[];const restored=parseState(state);assert.equal(restored.fish.length,0);assert.equal(restored.items.length,0)})
