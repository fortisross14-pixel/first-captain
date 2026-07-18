import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Backpack,Users,Sword,Shield,HeartPulse,Footprints,Coins,Star,Scale,Skull,X,DoorOpen,Target,PackageOpen} from 'lucide-react';

type Scene='town'|'road'|'home'|'tavern'|'sheriff'|'smith';
type Vec={x:number;y:number};
type Quest='intro'|'accepted'|'bossDefeated'|'resolved'|'complete';
type Item={id:string;name:string;type:'weapon'|'shield'|'armor'|'consumable'|'trinket';atk?:number;def?:number;heal?:number;desc:string;qty:number};
type Enemy={id:string;name:string;hp:number;maxHp:number;atk:number;xp:number;gold:number;kind:string;pos:Vec;alive:boolean};
type Fighter={id:string;name:string;hp:number;maxHp:number;atk:number;def:number;speed:number;icon:string;side:'party'|'enemy'};
type Combat={enemyIds:string[];enemyHp:Record<string,number>;partyHp:Record<string,number>;order:Fighter[];turn:number;targetId:string;log:string[];anim:string|null;guarded:string[]}|null;

const W=64,H=32,OX=440,OY=84;
const iso=(x:number,y:number)=>({x:OX+(x-y)*W/2,y:OY+(x+y)*H/2});
const fromIso=(sx:number,sy:number)=>{const a=(sx-OX)/(W/2),b=(sy-OY)/(H/2);return{x:(a+b)/2,y:(b-a)/2}};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

const NPCS=[
{id:'mother',name:'Mother',pos:{x:4,y:6},icon:'👩',lines:['Your father has been pretending not to worry all morning.','Come home safely. Fame is useless to a grave.']},
{id:'father',name:'Father',pos:{x:5.5,y:6},icon:'👨',lines:['The sword is plain, but the amulet belonged to your grandfather.','A captain earns loyalty before demanding it.']},
{id:'miller',name:'Miller Tomas',pos:{x:5,y:10},icon:'🧑‍🌾',lines:['The robbers took two flour carts this week.','Bring their leader back breathing, if you can.']},
{id:'child',name:'Nia',pos:{x:7,y:5},icon:'👧',lines:['Are you really going to fight bandits?','When you become famous, remember I knew you first!']},
{id:'veteran',name:'Old Garrick',pos:{x:10,y:6},icon:'🧓',lines:['Watch the feet, not the blade. Feet tell you who attacks next.','Guarding at the right time wins ugly fights.']},
{id:'merchant',name:'Traveling Merchant',pos:{x:9,y:10},icon:'🧕',lines:['I sell bandages for 20 gold.','Open your pack with the Inventory button to use or equip items.']},
];
const ENEMIES:Enemy[]=[
{id:'r1',name:'Road Robber',hp:42,maxHp:42,atk:10,xp:22,gold:24,kind:'robber',pos:{x:5,y:6},alive:true},
{id:'r2',name:'Robber Pair',hp:58,maxHp:58,atk:11,xp:34,gold:38,kind:'pair',pos:{x:9,y:4},alive:true},
{id:'poacher',name:'Poacher',hp:48,maxHp:48,atk:12,xp:28,gold:30,kind:'poacher',pos:{x:8,y:9},alive:true},
{id:'boss',name:'Bandit Leader',hp:110,maxHp:110,atk:15,xp:80,gold:90,kind:'leader',pos:{x:12,y:10},alive:true},
];
const START_ITEMS:Item[]=[
{id:'rusty',name:'Basic Sword',type:'weapon',atk:4,desc:'A serviceable village blade.',qty:1},
{id:'buckler',name:'Wooden Buckler',type:'shield',def:2,desc:'Light protection against knives.',qty:1},
{id:'shirt',name:'Padded Shirt',type:'armor',def:1,desc:'Quilted cloth armor.',qty:1},
{id:'amulet',name:'Ancient Amulet',type:'trinket',desc:'A warm family heirloom. Its purpose is unknown.',qty:1},
{id:'bandage',name:'Bandage',type:'consumable',heal:30,desc:'Restores 30 HP outside or during combat.',qty:3},
];

export default function App(){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [scene,setScene]=useState<Scene>('town'); const [player,setPlayer]=useState<Vec>({x:4,y:8}); const [dest,setDest]=useState<Vec|null>(null);
 const [dialog,setDialog]=useState<{name:string;lines:string[]}|null>(null); const [notice,setNotice]=useState('Visit your family home, then speak to Sheriff Mara.');
 const [quest,setQuest]=useState<Quest>('intro'); const [gold,setGold]=useState(45); const [fame,setFame]=useState(0); const [noble,setNoble]=useState(0); const [dread,setDread]=useState(0);
 const [hp,setHp]=useState(100); const [stamina,setStamina]=useState(40); const [xp,setXp]=useState(0); const [level,setLevel]=useState(1);
 const [items,setItems]=useState<Item[]>(START_ITEMS); const [equipment,setEquipment]=useState({weapon:'rusty',shield:'buckler',armor:'shirt',trinket:'amulet'});
 const [enemies,setEnemies]=useState(ENEMIES); const [combat,setCombat]=useState<Combat>(null); const [choice,setChoice]=useState(false); const [inventory,setInventory]=useState(false); const [company,setCompany]=useState(false);
 const attack=12+(items.find(i=>i.id===equipment.weapon)?.atk||0); const defense=5+(items.find(i=>i.id===equipment.shield)?.def||0)+(items.find(i=>i.id===equipment.armor)?.def||0);
 const liveEnemies=useMemo(()=>combat?combat.enemyIds.filter(id=>(combat.enemyHp[id]||0)>0):[],[combat]);
 const actor=combat?.order[combat.turn%combat.order.length];

 useEffect(()=>{const t=setInterval(()=>{if(!dest||dialog||combat||inventory||company||choice)return;setPlayer(p=>{const dx=dest.x-p.x,dy=dest.y-p.y,d=Math.hypot(dx,dy);if(d<.08){setDest(null);return dest}return{x:p.x+dx/d*.09,y:p.y+dy/d*.09}})},16);return()=>clearInterval(t)},[dest,dialog,combat,inventory,company,choice]);
 useEffect(()=>{if(scene==='town'&&player.x>13.5){setScene('road');setPlayer({x:1,y:7});setDest(null);setNotice('East Road — click enemies to approach and engage.')}if(scene==='road'&&player.x<.2){setScene('town');setPlayer({x:13,y:7});setDest(null)}},[player,scene]);
 useEffect(()=>{if(scene==='road'&&!combat&&!choice){const e=enemies.find(e=>e.alive&&Math.hypot(player.x-e.pos.x,player.y-e.pos.y)<.65);if(e)beginCombat(e)}},[player,scene,enemies,combat,choice]);
 useEffect(()=>{if(combat&&actor?.side==='enemy'){const id=setTimeout(()=>enemyAct(actor),720);return()=>clearTimeout(id)}},[combat?.turn]);

 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext('2d')!;let raf=0;const draw=()=>{ctx.clearRect(0,0,c.width,c.height);drawWorld(ctx);raf=requestAnimationFrame(draw)};draw();return()=>cancelAnimationFrame(raf)},[scene,player,dest,enemies,quest]);

 function drawWorld(ctx:CanvasRenderingContext2D){
  const sky=ctx.createLinearGradient(0,0,0,560);sky.addColorStop(0,scene==='road'?'#8fc6da':'#91cde4');sky.addColorStop(.45,'#cfe8c1');sky.addColorStop(1,'#314933');ctx.fillStyle=sky;ctx.fillRect(0,0,900,560);
  if(['home','tavern','sheriff','smith'].includes(scene)){drawInterior(ctx);return}
  for(let y=0;y<14;y++)for(let x=0;x<15;x++){const p=iso(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+32,p.y+16);ctx.lineTo(p.x,p.y+32);ctx.lineTo(p.x-32,p.y+16);ctx.closePath();let col=(x+y)%2?'#6fa854':'#78b45c';if(scene==='town'&&(y===7||x===7))col='#c9ad77';if(scene==='road'&&Math.abs(y-7)<2)col='#bca170';ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#35523833';ctx.stroke()}
  if(scene==='town'){
   building(ctx,2,2,'HOME','#b85f4a');building(ctx,10,1,'SMITH','#59636e');building(ctx,2,10,'TAVERN','#7a4c34');building(ctx,10,10,'SHERIFF','#42607b');
   pond(ctx,12,4); market(ctx,7,10); flower(ctx,6,3); flower(ctx,8,3); barrel(ctx,3,8); barrel(ctx,11,8);
   NPCS.forEach(n=>actorSprite(ctx,n.pos,n.icon,n.name));
   const g=iso(14,7);ctx.fillStyle='#553c2c';ctx.fillRect(g.x-12,g.y-40,24,58);label(ctx,g.x,g.y-48,'EAST ROAD');
  } else {
   for(let i=0;i<22;i++){const x=(i*7+2)%15,y=(i*11+1)%14;if(Math.abs(y-7)>2)tree(ctx,x,y)}
   camp(ctx,11,11); bridge(ctx,6,7); stump(ctx,4,10); crate(ctx,10,5);
   enemies.filter(e=>e.alive).forEach(e=>actorSprite(ctx,e.pos,e.kind==='leader'?'👑':e.kind==='poacher'?'🏹':'🗡️',e.name));label(ctx,iso(0,7).x,iso(0,7).y-18,'← TOWN');
  }
  actorSprite(ctx,player,'🧑‍✈️','');if(dest){const d=iso(dest.x,dest.y);ctx.strokeStyle='#fff0a0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(d.x,d.y+16,15,7,0,0,Math.PI*2);ctx.stroke()}
 }
 function drawInterior(ctx:CanvasRenderingContext2D){ctx.fillStyle='#2d241d';ctx.fillRect(0,0,900,560);for(let y=1;y<13;y++)for(let x=2;x<13;x++){const p=iso(x,y);ctx.fillStyle=(x+y)%2?'#8b6847':'#967352';ctx.fillRect(p.x-31,p.y,62,30);ctx.strokeStyle='#493522';ctx.strokeRect(p.x-31,p.y,62,30)}
  if(scene==='home'){furniture(ctx,5,4,'🛏️');furniture(ctx,9,4,'🪑');actorSprite(ctx,{x:6,y:7},'👩','Mother');actorSprite(ctx,{x:8,y:7},'👨','Father')}
  if(scene==='tavern'){furniture(ctx,5,5,'🍺');furniture(ctx,9,5,'🍖');actorSprite(ctx,{x:7,y:7},'🧔','Innkeeper');actorSprite(ctx,{x:10,y:8},'🏹','Lyra')}
  if(scene==='sheriff'){furniture(ctx,6,4,'📜');furniture(ctx,10,4,'⚔️');actorSprite(ctx,{x:8,y:7},'🛡️','Sheriff Mara')}
  if(scene==='smith'){furniture(ctx,6,5,'🔥');furniture(ctx,10,5,'🔨');actorSprite(ctx,{x:8,y:7},'🧔','Blacksmith')}
  actorSprite(ctx,player,'🧑‍✈️','');label(ctx,iso(3,10).x,iso(3,10).y,'EXIT');
 }
 function clickMap(ev:React.MouseEvent){if(dialog||combat||inventory||company||choice)return;const r=ev.currentTarget.getBoundingClientRect();const sx=(ev.clientX-r.left)*900/r.width,sy=(ev.clientY-r.top)*560/r.height;const w=fromIso(sx,sy-16);
  if(['home','tavern','sheriff','smith'].includes(scene)){if(Math.hypot(w.x-3,w.y-10)<1.2){setScene('town');setPlayer({x:scene==='home'?3:scene==='tavern'?3:11,y:scene==='smith'?3:11});return}return interiorInteract(w)}
  if(scene==='town'){
   const doors=[{s:'home' as Scene,p:{x:2,y:3.5}},{s:'smith' as Scene,p:{x:10,y:2.5}},{s:'tavern' as Scene,p:{x:2,y:11.5}},{s:'sheriff' as Scene,p:{x:10,y:11.5}}];const d=doors.find(d=>Math.hypot(w.x-d.p.x,w.y-d.p.y)<1);if(d){if(Math.hypot(player.x-d.p.x,player.y-d.p.y)>1.4){setDest(d.p);return}setScene(d.s);setPlayer({x:4,y:9});setDest(null);setNotice(`Inside ${d.s}. Click the occupants or EXIT.`);return}
   const n=NPCS.find(n=>Math.hypot(w.x-n.pos.x,w.y-n.pos.y)<.8);if(n){if(Math.hypot(player.x-n.pos.x,player.y-n.pos.y)>1.3){setDest(n.pos);return}talkNPC(n.id);return}
  }
  if(scene==='road'){const e=enemies.find(e=>e.alive&&Math.hypot(w.x-e.pos.x,w.y-e.pos.y)<.8);if(e){setDest(e.pos);return}}
  setDest({x:clamp(w.x,0,14),y:clamp(w.y,0,13)});
 }
 function interiorInteract(w:Vec){if(scene==='home'){if(Math.hypot(w.x-6,w.y-7)<1)setDialog({name:'Mother',lines:['I packed another bandage in your satchel.','Your father has the amulet ready.']});else if(Math.hypot(w.x-8,w.y-7)<1){setDialog({name:'Father',lines:['Take the Basic Sword and this old amulet.','The amulet feels warmer than it should.']});setQuest(q=>q==='intro'?'accepted':q);setNotice('Speak to Sheriff Mara in the sheriff office.')}}
  if(scene==='sheriff'&&Math.hypot(w.x-8,w.y-7)<1){if(quest==='intro')setDialog({name:'Sheriff Mara',lines:['Say farewell at home first. Then I have work for you.']});else if(quest==='accepted')setDialog({name:'Sheriff Mara',lines:['Robbers are camped east of town. Defeat their leader and return with proof.']});else if(quest==='resolved'){setGold(g=>g+140);setFame(f=>f+18);setQuest('complete');setDialog({name:'Sheriff Mara',lines:['The road is safe again. Here is 140 gold.','People are already repeating your name in the tavern.']})}else setDialog({name:'Sheriff Mara',lines:['You earned this town a quiet night, Captain.']})}
  if(scene==='tavern'){if(Math.hypot(w.x-7,w.y-7)<1)setDialog({name:'Innkeeper',lines:['Recruitment and salaries unlock fully after this first bounty.','For now, speak with Lyra to hear what fighters expect.']});else if(Math.hypot(w.x-10,w.y-8)<1)setDialog({name:'Lyra Vale',lines:['A captain pays a signing fee, then wages every few battles.','A larger party is safer, but rewards are divided.']})}
  if(scene==='smith'&&Math.hypot(w.x-8,w.y-7)<1)setDialog({name:'Blacksmith',lines:['Open Inventory, select an item, then choose Equip.','Your attack and defense update immediately.']});
 }
 function talkNPC(id:string){const n=NPCS.find(n=>n.id===id)!;if(id==='merchant'&&gold>=20){setGold(g=>g-20);setItems(xs=>xs.map(i=>i.id==='bandage'?{...i,qty:i.qty+1}:i));setDialog({name:n.name,lines:['One bandage added for 20 gold.']})}else setDialog({name:n.name,lines:n.lines})}

 function beginCombat(primary:Enemy){const group=primary.kind==='pair'?[primary,{...primary,id:primary.id+'b',name:'Knife Robber',hp:36,maxHp:36,atk:9}]:[primary];const ef:Record<string,number>={};group.forEach(e=>ef[e.id]=e.hp);const order:Fighter[]=[{id:'captain',name:'Captain Rowan',hp,maxHp:100,atk:attack,def:defense,speed:11,icon:'🧑‍✈️',side:'party'},...group.map(e=>({id:e.id,name:e.name,hp:e.hp,maxHp:e.maxHp,atk:e.atk,def:2,speed:e.kind==='poacher'?12:8,icon:e.kind==='leader'?'👑':e.kind==='poacher'?'🏹':'🗡️',side:'enemy' as const}))].sort((a,b)=>b.speed-a.speed);setCombat({enemyIds:group.map(e=>e.id),enemyHp:ef,partyHp:{captain:hp},order,turn:0,targetId:group[0].id,log:[`${group.map(e=>e.name).join(' and ')} block the road!`],anim:null,guarded:[]});setDest(null)}
 function act(kind:'attack'|'skill'|'guard'|'item') {if(!combat||actor?.side!=='party')return;let c={...combat,enemyHp:{...combat.enemyHp},partyHp:{...combat.partyHp},log:[...combat.log],guarded:[...combat.guarded],anim:'captain'};if(kind==='guard'){c.guarded.push('captain');c.log.push('Captain raises a guarded stance.');return advance(c)}if(kind==='item'){const b=items.find(i=>i.id==='bandage');if(!b||b.qty<1){c.log.push('No bandages remain.');return setCombat(c)}setItems(xs=>xs.map(i=>i.id==='bandage'?{...i,qty:i.qty-1}:i));c.partyHp.captain=Math.min(100,c.partyHp.captain+30);c.log.push('Captain uses a bandage and restores 30 HP.');return advance(c)}const target=c.targetId;if(!target||c.enemyHp[target]<=0)return;const dmg=Math.max(1,Math.floor((kind==='skill'?attack*1.55:attack)+(Math.random()*6-2)));if(kind==='skill'&&stamina<12){c.log.push('Not enough stamina.');return setCombat(c)}if(kind==='skill')setStamina(s=>s-12);c.enemyHp[target]-=dmg;c.anim=target;c.log.push(`${kind==='skill'?'Heavy Slash':'Attack'} hits ${nameFor(target)} for ${dmg}.`);if(c.enemyHp[target]<=0)c.log.push(`${nameFor(target)} is defeated.`);setTimeout(()=>finishOrAdvance(c),280)}
 function enemyAct(a:Fighter){if(!combat)return;let c={...combat,partyHp:{...combat.partyHp},log:[...combat.log],anim:'captain'};const guarded=c.guarded.includes('captain');const dmg=Math.max(1,Math.floor(a.atk-(guarded?defense*.75:defense*.35)+Math.random()*5));c.partyHp.captain-=dmg;c.log.push(`${a.name} attacks Captain Rowan for ${dmg}${guarded?' (guarded)':''}.`);c.guarded=c.guarded.filter(x=>x!=='captain');setTimeout(()=>{if(c.partyHp.captain<=0){setHp(45);setGold(g=>Math.max(0,g-20));setCombat(null);setScene('town');setPlayer({x:8,y:8});setNotice('Defeated. You were carried back to town and lost 20 gold.')}else advance(c)},280)}
 function finishOrAdvance(c:NonNullable<Combat>){if(c.enemyIds.every(id=>c.enemyHp[id]<=0)){const primary=enemies.find(e=>e.id===c.enemyIds[0])!;setHp(c.partyHp.captain);setGold(g=>g+primary.gold);setXp(x=>{const n=x+primary.xp;if(n>=100){setLevel(l=>l+1);setNotice('Level up! Maximum stamina increased.');return n-100}return n});setEnemies(es=>es.map(e=>e.id===primary.id?{...e,alive:false}:e));setCombat(null);if(primary.kind==='leader'){setQuest('bossDefeated');setChoice(true)}else setNotice(`Victory: +${primary.gold} gold, +${primary.xp} XP.`);return}advance(c)}
 function advance(c:NonNullable<Combat>){c.turn=(c.turn+1)%c.order.length;c.anim=null;let guard=0;while(c.order[c.turn].side==='enemy'&&c.enemyHp[c.order[c.turn].id]<=0&&guard++<20)c.turn=(c.turn+1)%c.order.length;setCombat(c)}
 function resolveBoss(mode:'capture'|'execute'){setChoice(false);setQuest('resolved');if(mode==='capture'){setNoble(n=>n+20);setNotice('Bandit leader captured. Return to Sheriff Mara.')}else{setDread(n=>n+20);setNotice('Bandit leader executed. Return to Sheriff Mara.')}}
 function nameFor(id:string){return combat?.order.find(x=>x.id===id)?.name||id}
 function equip(i:Item){if(i.type==='consumable')return;if(i.type==='trinket')setEquipment(e=>({...e,trinket:i.id}));if(i.type==='weapon')setEquipment(e=>({...e,weapon:i.id}));if(i.type==='shield')setEquipment(e=>({...e,shield:i.id}));if(i.type==='armor')setEquipment(e=>({...e,armor:i.id}))}

 return <div className="app"><header><div><h1>THE FIRST CAPTAIN</h1><p>Phase 2.1 — interactive vertical slice</p></div><div className="header-actions"><button onClick={()=>setInventory(true)}><Backpack size={17}/>Inventory</button><button onClick={()=>setCompany(true)}><Users size={17}/>Company</button></div></header><main><section className="game-shell"><canvas ref={canvas} width={900} height={560} onClick={clickMap}/><div className="notice">{notice}</div>
 {dialog&&<div className="dialog"><strong>{dialog.name}</strong>{dialog.lines.map((l,i)=><p key={i}>{l}</p>)}<button onClick={()=>setDialog(null)}>Continue</button></div>}
 {combat&&<CombatView combat={combat} actor={actor} target={combat.targetId} setTarget={id=>setCombat(c=>c?{...c,targetId:id}:c)} act={act}/>} 
 {choice&&<div className="choice"><h2>The bandit leader is beaten</h2><p>He drops his weapon and waits for your judgment.</p><div><button className="noble" onClick={()=>resolveBoss('capture')}><Scale/>Capture alive<small>+20 Noble</small></button><button className="dread" onClick={()=>resolveBoss('execute')}><Skull/>Execute<small>+20 Dreadful</small></button></div></div>}
 {inventory&&<Inventory items={items} equipment={equipment} hp={hp} setHp={setHp} setItems={setItems} equip={equip} close={()=>setInventory(false)}/>} {company&&<SimpleCompany close={()=>setCompany(false)}/>} </section>
 <aside><div className="portrait">🧑‍✈️</div><h2>CAPTAIN ROWAN</h2><div className="level">Level {level}</div><Stat icon={<HeartPulse/>} label="HP" value={`${hp}/100`} pct={hp}/><Stat icon={<Footprints/>} label="Stamina" value={`${stamina}/40`} pct={stamina/40*100}/><div className="grid"><Metric icon={<Coins/>} label="Gold" value={gold}/><Metric icon={<Star/>} label="Fame" value={fame}/><Metric icon={<Scale/>} label="Noble" value={noble}/><Metric icon={<Skull/>} label="Dread" value={dread}/></div><div className="panel"><h3>COMBAT</h3><p><Sword/> Attack {attack}</p><p><Shield/> Defense {defense}</p><p><Target/> Click an enemy portrait to target it.</p></div><div className="panel"><h3>QUEST</h3><p>{quest==='intro'?'Say farewell at home.':quest==='accepted'?'Defeat the east-road bandit leader.':quest==='bossDefeated'?'Choose his fate.':quest==='resolved'?'Return to Sheriff Mara.':'First bounty complete.'}</p></div></aside></main></div>
}

function CombatView({combat,actor,target,setTarget,act}:{combat:NonNullable<Combat>;actor:Fighter|undefined;target:string;setTarget:(id:string)=>void;act:(x:'attack'|'skill'|'guard'|'item')=>void}){return <div className="combat"><div className="combat-title"><div><span className="tag">TURN-BASED COMBAT</span><h2>{actor?.name}'s turn</h2></div><div className="initiative">Next: {combat.order.map(x=>x.name.split(' ')[0]).join(' → ')}</div></div><div className="battlefield"><div className={`fighter hero ${combat.anim==='captain'?'hit':''}`}><div className="sprite">🧑‍✈️</div><b>Captain Rowan</b><div className="bar"><i style={{width:`${Math.max(0,combat.partyHp.captain)}%`}}/></div><small>{Math.max(0,combat.partyHp.captain)}/100 HP</small></div><div className="versus">⚔</div><div className="enemy-line">{combat.enemyIds.map(id=>{const f=combat.order.find(x=>x.id===id)!;const hp=Math.max(0,combat.enemyHp[id]);return <button key={id} disabled={hp<=0} onClick={()=>setTarget(id)} className={`enemy-card ${target===id?'selected':''} ${combat.anim===id?'hit':''}`}><div className="sprite">{f.icon}</div><b>{f.name}</b><div className="bar"><i style={{width:`${hp/f.maxHp*100}%`}}/></div><small>{hp}/{f.maxHp} HP</small>{target===id&&<span className="target-mark">TARGET</span>}</button>})}</div></div><div className="combat-log" aria-live="polite">{combat.log.slice(-4).map((x,i)=><div key={i}>{x}</div>)}</div><div className="actions"><button disabled={actor?.side!=='party'} onClick={()=>act('attack')}><Sword/>Attack selected</button><button disabled={actor?.side!=='party'} onClick={()=>act('skill')}><Target/>Heavy Slash</button><button disabled={actor?.side!=='party'} onClick={()=>act('guard')}><Shield/>Guard</button><button disabled={actor?.side!=='party'} onClick={()=>act('item')}><PackageOpen/>Bandage</button></div></div>}
function Inventory({items,equipment,hp,setHp,setItems,equip,close}:{items:Item[];equipment:any;hp:number;setHp:any;setItems:any;equip:(i:Item)=>void;close:()=>void}){const [sel,setSel]=useState(items[0].id);const item=items.find(i=>i.id===sel)!;const equipped=Object.values(equipment).includes(item.id);function use(){if(item.type==='consumable'&&item.qty>0){setHp((h:number)=>Math.min(100,h+(item.heal||0)));setItems((xs:Item[])=>xs.map(i=>i.id===item.id?{...i,qty:i.qty-1}:i))}}return <div className="overlay-card"><div className="modal-title"><div><span className="tag">PACK & LOADOUT</span><h2>Inventory and Equipment</h2></div><button onClick={close}><X/>Close</button></div><div className="inventory-layout"><section><h3>Equipped</h3>{Object.entries(equipment).map(([slot,id])=><div className="equip-row" key={slot}><span>{slot}</span><b>{items.find(i=>i.id===id)?.name}</b></div>)}</section><section className="item-list">{items.map(i=><button className={sel===i.id?'selected':''} key={i.id} onClick={()=>setSel(i.id)}><span>{i.type==='weapon'?'⚔️':i.type==='shield'?'🛡️':i.type==='armor'?'🥋':i.type==='trinket'?'📿':'🩹'}</span><div><b>{i.name}</b><small>{i.type} • Qty {i.qty}</small></div></button>)}</section><section className="item-detail"><h3>{item.name}</h3><p>{item.desc}</p>{item.atk&&<p>Attack +{item.atk}</p>}{item.def&&<p>Defense +{item.def}</p>}{item.heal&&<p>Healing {item.heal}</p>}<p>{equipped?'Currently equipped':''}</p>{item.type==='consumable'?<button disabled={item.qty<1||hp>=100} onClick={use}>Use item</button>:<button disabled={equipped} onClick={()=>equip(item)}>Equip</button>}</section></div></div>}
function SimpleCompany({close}:{close:()=>void}){return <div className="overlay-card"><div className="modal-title"><div><span className="tag">COMPANY</span><h2>Captain's Retinue</h2></div><button onClick={close}><X/>Close</button></div><div className="empty-company"><Users size={48}/><h3>Recruitment unlocks after the first bounty</h3><p>The tavern will offer melee, ranged, and support characters. Active fighters divide XP and gold, while all hired fighters require wages.</p></div></div>}
function Stat({icon,label,value,pct}:{icon:any;label:string;value:string;pct:number}){return <div className="stat"><div>{icon}<span>{label}</span><b>{value}</b></div><div className="bar"><i style={{width:`${Math.max(0,pct)}%`}}/></div></div>}
function Metric({icon,label,value}:{icon:any;label:string;value:number}){return <div className="metric">{icon}<span>{label}</span><b>{value}</b></div>}
function label(ctx:CanvasRenderingContext2D,x:number,y:number,t:string){ctx.fillStyle='#172019dd';ctx.fillRect(x-42,y-13,84,16);ctx.fillStyle='#fff0c0';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(t,x,y-2);ctx.textAlign='start'}
function actorSprite(ctx:CanvasRenderingContext2D,pos:Vec,icon:string,name:string){const p=iso(pos.x,pos.y);ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(p.x,p.y+24,14,6,0,0,Math.PI*2);ctx.fill();ctx.font='27px serif';ctx.textAlign='center';ctx.fillText(icon,p.x,p.y+16);if(name)label(ctx,p.x,p.y-28,name);ctx.textAlign='start'}
function building(ctx:CanvasRenderingContext2D,x:number,y:number,name:string,color:string){const p=iso(x,y);ctx.fillStyle='#d8c198';ctx.fillRect(p.x-48,p.y-48,96,68);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p.x-60,p.y-48);ctx.lineTo(p.x,p.y-84);ctx.lineTo(p.x+60,p.y-48);ctx.closePath();ctx.fill();ctx.fillStyle='#49301f';ctx.fillRect(p.x-10,p.y-10,20,30);ctx.fillStyle='#89b9d1';ctx.fillRect(p.x-37,p.y-26,16,14);ctx.fillRect(p.x+21,p.y-26,16,14);label(ctx,p.x,p.y-58,name)}
function tree(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.fillStyle='#69472e';ctx.fillRect(p.x-5,p.y-7,10,31);ctx.fillStyle='#2f7345';ctx.beginPath();ctx.arc(p.x,p.y-21,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#55945e';ctx.beginPath();ctx.arc(p.x-8,p.y-27,10,0,Math.PI*2);ctx.fill()}
function pond(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.fillStyle='#509db0';ctx.beginPath();ctx.ellipse(p.x,p.y+16,54,22,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7e4df';ctx.stroke()}
function market(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.fillStyle='#754b2f';ctx.fillRect(p.x-35,p.y-8,70,25);ctx.fillStyle='#d9b64d';ctx.fillRect(p.x-42,p.y-28,84,21);label(ctx,p.x,p.y-35,'MARKET')}
function flower(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.font='16px serif';ctx.fillText('🌼',p.x,p.y+18)}
function barrel(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.font='24px serif';ctx.fillText('🛢️',p.x-12,p.y+20)}
function bridge(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.fillStyle='#77563b';ctx.fillRect(p.x-46,p.y+3,92,25);for(let i=0;i<6;i++){ctx.strokeStyle='#3f2b20';ctx.strokeRect(p.x-46+i*15,p.y+3,15,25)}}
function camp(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.font='28px serif';ctx.fillText('⛺',p.x-36,p.y+10);ctx.fillText('🔥',p.x+10,p.y+18)}
function stump(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.font='24px serif';ctx.fillText('🪵',p.x,p.y+20)}function crate(ctx:CanvasRenderingContext2D,x:number,y:number){const p=iso(x,y);ctx.font='24px serif';ctx.fillText('📦',p.x,p.y+20)}
function furniture(ctx:CanvasRenderingContext2D,x:number,y:number,icon:string){const p=iso(x,y);ctx.font='35px serif';ctx.fillText(icon,p.x-15,p.y+15)}
