import { speciesById, decorById } from './catalog'
export interface Item { uid:string; id:string; x:number; z:number; rotation:number; scale:number }
export interface Fish {uid:string; id:string}
export interface TankState {version:1; name:string; fish:Fish[]; items:Item[]; light:boolean; sand:string; savedAt:number; modelSpecies:string|null}
export const uid = () => crypto.randomUUID()
export function initialState():TankState {
 return {version:1,name:'窗边的水下花园',fish:[...Array.from({length:5},()=>({uid:uid(),id:'neon'})),...Array.from({length:2},()=>({uid:uid(),id:'guppy'})),{uid:uid(),id:'panda'}],items:[
  {uid:uid(),id:'stone',x:0.6,z:0.2,rotation:0.2,scale:1.35},
  {uid:uid(),id:'stone',x:1.25,z:0.25,rotation:-0.9,scale:0.8},
  {uid:uid(),id:'driftwood',x:0.45,z:0.15,rotation:-0.4,scale:1.3},
  {uid:uid(),id:'fern',x:-1.45,z:-0.65,rotation:0.4,scale:1.2},
  {uid:uid(),id:'grass',x:1.8,z:-0.7,rotation:1.1,scale:1.15},
  {uid:uid(),id:'grass',x:-1.9,z:-0.8,rotation:0.2,scale:1},
  {uid:uid(),id:'redplant',x:-0.65,z:-0.6,rotation:0,scale:1.1},
  {uid:uid(),id:'fern',x:1.05,z:-0.65,rotation:0.8,scale:0.85},
  {uid:uid(),id:'carpet',x:-1,z:0.65,rotation:0,scale:1.1},
  {uid:uid(),id:'carpet',x:1.4,z:0.6,rotation:0.6,scale:0.8},
  {uid:uid(),id:'pebble',x:-0.2,z:0.75,rotation:0.7,scale:0.65},
 ],light:true,sand:'natural',savedAt:Date.now(),modelSpecies:null}
}
const finite = (n:unknown): n is number => typeof n === 'number' && Number.isFinite(n)
export function parseState(raw:unknown):TankState {
 if(!raw || typeof raw!=='object') throw new Error('存档格式无效')
 const s=raw as Record<string,unknown>
 if(s.version!==1 || typeof s.name!=='string' || s.name.length>40 || !Array.isArray(s.fish) || !Array.isArray(s.items) || s.fish.length>30 || s.items.length>100 || typeof s.light!=='boolean' || !['natural','white','dark'].includes(s.sand as string)) throw new Error('存档格式或版本无效')
 if(s.modelSpecies!=null&&(typeof s.modelSpecies!=='string'||!Object.hasOwn(speciesById,s.modelSpecies)))throw new Error('存档的模型鱼种无效')
 const ids=new Set<string>()
 const validId=(v:Record<string,unknown>)=>{if(typeof v.uid!=='string'||ids.has(v.uid)) throw new Error('存档对象标识无效'); ids.add(v.uid)}
 const fish=s.fish.map((v)=>{if(!v||typeof v!=='object'||(typeof v.id!=='string'||!Object.hasOwn(speciesById,v.id)))throw new Error('存档包含未知鱼种');validId(v);return {uid:v.uid,id:v.id} as Fish})
 const items=s.items.map(v=>{if(!v||typeof v!=='object'||(typeof v.id!=='string'||!Object.hasOwn(decorById,v.id))||![v.x,v.z,v.rotation,v.scale].every(finite)||Math.abs(v.x)>2.5||Math.abs(v.z)>1.15||v.scale<0.4||v.scale>1.8)throw new Error('存档造景数据无效');validId(v);return {uid:v.uid,id:v.id,x:v.x,z:v.z,rotation:v.rotation,scale:v.scale} as Item})
 return {version:1,name:s.name,fish,items,light:s.light,sand:s.sand as string,savedAt:finite(s.savedAt)?s.savedAt:Date.now(),modelSpecies:typeof s.modelSpecies==='string'?s.modelSpecies:null}
}
export const cloneState=(s:TankState):TankState=>JSON.parse(JSON.stringify(s))
const DB='little-aquarium'; const STORE='tanks'
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export async function saveTank(state:TankState){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(cloneState(state),'single');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
export async function loadTank():Promise<TankState|null>{const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction(STORE).objectStore(STORE).get('single');req.onsuccess=()=>{try{resolve(req.result?parseState(req.result):null)}catch(e){reject(e)}};req.onerror=()=>reject(req.error)})}finally{db.close()}}
