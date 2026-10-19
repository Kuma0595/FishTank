export interface Species {
  id: string; name: string; latin: string; group: 'cold' | 'warm'; label: string;
  color: string; accent: string; size: number; shape: 'round' | 'slim' | 'fan' | 'tall' | 'bottom';
  pattern: 'plain' | 'neon' | 'stripe' | 'panda' | 'spots'; speed: number; note: string; temperature: string;
}
export const species: Species[] = [
  {id:'goldfish', name:'金鱼',latin:'Carassius auratus',group:'cold',label:'圆润 · 悠游',color:'#ee963e',accent:'#f4d89a',size:0.8,shape:'round',pattern:'plain',speed:0.65,note:'圆润的身形，摇曳的尾鳍，水里的小太阳。',temperature:'冷水鱼'},
  {id:'whitecloud',name:'白云金丝',latin:'Tanichthys albonubes',group:'cold',label:'轻盈 · 群游',color:'#bcbb88',accent:'#dc7459',size:0.43,shape:'slim',pattern:'neon',speed:1.05,note:'细细的金色侧线与红尾，一群游过像流动的微光。',temperature:'冷水鱼'},
  {id:'medaka',name:'青鳉',latin:'Oryzias latipes',group:'cold',label:'银光 · 上层',color:'#dfd9b2',accent:'#efcf7b',size:0.40,shape:'slim',pattern:'plain',speed:0.8,note:'小巧通透，喜欢在水面下轻轻穿行。',temperature:'广温鱼'},
  {id:'guppy',name:'孔雀鱼',latin:'Poecilia reticulata',group:'warm',label:'彩尾 · 灵动',color:'#e8b263',accent:'#de765d',size:0.52,shape:'fan',pattern:'spots',speed:0.85,note:'扇形大尾巴像一片轻盈的彩色绸缎。',temperature:'热带鱼'},
  {id:'neon',name:'红绿灯',latin:'Paracheirodon innesi',group:'warm',label:'蓝红 · 群游',color:'#5b9b9e',accent:'#db5d50',size:0.42,shape:'slim',pattern:'neon',speed:1.05,note:'一抹蓝光，一笔朱红，是草缸里的小小流星。',temperature:'热带鱼'},
  {id:'zebra',name:'斑马鱼',latin:'Danio rerio',group:'warm',label:'条纹 · 活泼',color:'#d8cd9e',accent:'#4b6869',size:0.49,shape:'slim',pattern:'stripe',speed:1.3,note:'身披横向条纹，游动轻快，给鱼缸添一点活力。',temperature:'广温鱼'},
  {id:'molly',name:'玛丽鱼',latin:'Poecilia sphenops',group:'warm',label:'墨色 · 从容',color:'#3e4a49',accent:'#747c6e',size:0.61,shape:'tall',pattern:'plain',speed:0.75,note:'柔和的黑色轮廓，在明亮水草间显得格外沉静。',temperature:'热带鱼'},
  {id:'platy',name:'月光鱼',latin:'Xiphophorus maculatus',group:'warm',label:'暖橙 · 温和',color:'#ed9c5d',accent:'#c76d42',size:0.55,shape:'tall',pattern:'plain',speed:0.8,note:'像一枚橙色的小月亮，缓缓经过沉木和水草。',temperature:'热带鱼'},
  {id:'betta',name:'斗鱼',latin:'Betta splendens',group:'warm',label:'长鳍 · 独游',color:'#597e99',accent:'#7eacc0',size:0.66,shape:'fan',pattern:'plain',speed:0.5,note:'舒展的长鳍像裙摆，独自游动也足够动人。',temperature:'热带鱼'},
  {id:'panda',name:'熊猫鼠鱼',latin:'Corydoras panda',group:'warm',label:'黑白 · 底栖',color:'#ddd6b7',accent:'#46514b',size:0.52,shape:'bottom',pattern:'panda',speed:0.55,note:'黑白相间的小家伙，贴着砂面慢慢探索。',temperature:'热带鱼'},
]
export interface Decoration {id:string; name:string; category:'plant'|'rock'|'wood'; color:string; description:string}
export const decorations: Decoration[] = [
{id:'fern',name:'爪哇蕨',category:'plant',color:'#49774b',description:'舒展叶片，适合作为中后景'},
{id:'grass',name:'苦草',category:'plant',color:'#779256',description:'细长叶片，营造轻盈的背景'},
{id:'redplant',name:'红丁香',category:'plant',color:'#a5675c',description:'一抹暖红，让景观更有层次'},
{id:'carpet',name:'前景草',category:'plant',color:'#8ca66a',description:'低矮成簇，铺成柔软绿毯'},
{id:'stone',name:'青灰岩',category:'rock',color:'#7a8074',description:'自然石纹，搭出景观的骨架'},
{id:'pebble',name:'溪流卵石',category:'rock',color:'#aaa38e',description:'圆润石形，带来溪流的气息'},
{id:'driftwood',name:'枝状沉木',category:'wood',color:'#96724e',description:'向上伸展，为造景增加姿态'},
]
export const speciesById = Object.fromEntries(species.map(s => [s.id,s])) as Record<string,Species>
export const decorById = Object.fromEntries(decorations.map(s => [s.id,s])) as Record<string,Decoration>
