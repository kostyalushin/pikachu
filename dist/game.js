import * as THREE from './vendor/three.module.js';
import { LEVELS, createState, collect, attack, jump, damage, nextLevel } from './rules.js';

const $ = id => document.getElementById(id);
let state = createState(), scene, camera, renderer, world, player, boss, portal;
let velocityY = 0, elapsed = 0, attackTimer = 2, spawnTimer = 0, toastTimer = 0, shake = 0;
let pickups = [], hazards = [], effects = [], obstacles = [], clouds = [];
let audio, soundEnabled = false, modalAction = null, helpReturn = 'menu';
const keys = new Set(), clock = new THREE.Clock(), boxGeo = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map(), tmp = new THREE.Vector3();
const directions = { up: new THREE.Vector3(-1, 0, -1).normalize(), right: new THREE.Vector3(1, 0, -1).normalize() };
const grassPalette = [0x86b752, 0x80ad4b, 0x91bb59, 0x82b14f, 0x8dbc58, 0x76a746];
let rngSeed = 251;
function rand() { rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0; return rngSeed / 4294967296; }
function mat(color, glow = false) {
  const key = `${color}-${glow}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...(glow ? { emissive: color, emissiveIntensity: .65 } : {}) }));
  return materials.get(key);
}
function cube(parent, color, x, y, z, w = 1, h = 1, d = 1, glow = false) {
  const mesh = new THREE.Mesh(boxGeo, mat(color, glow));
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function pixelTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 145 + Math.floor(rand() * 40); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function character(isBoss = false) {
  const g = new THREE.Group(), skin = isBoss ? 0xeaa04a : 0xffd64e, dark = 0x403326;
  cube(g, skin, 0, .9, 0, .92, 1.12, .67);
  const head = new THREE.Group(); g.add(head); head.position.set(0, 1.77, -.03);
  cube(head, skin, 0, 0, 0, 1.23, .91, .9);
  for (const side of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(side * .42, .58, .02); ear.rotation.z = side * -.22; head.add(ear);
    cube(ear, skin, 0, .22, 0, .24, .78, .25); cube(ear, dark, 0, .66, 0, .24, .22, .25);
    cube(head, dark, side * .29, .08, .461, .15, .19, .03); cube(head, 0xfffef0, side * .31, .13, .482, .055, .065, .02);
    cube(head, isBoss ? 0xffd75d : 0xed6350, side * .45, -.17, .465, .23, .19, .035);
    cube(g, skin, side * .63, .9, .06, .34, .49, .36);
    cube(g, isBoss ? 0x7a5538 : skin, side * .3, .22, .16, .34, .3, .64);
    cube(g, 0x98613a, side * .2, 1.12, -.35, .23, .16, .06);
  }
  cube(head, dark, 0, -.09, .48, .09, .07, .025);
  cube(head, dark, -.07, -.26, .48, .1, .035, .025); cube(head, dark, .07, -.26, .48, .1, .035, .025);
  const tail = new THREE.Group(); tail.position.set(.43, .6, -.47); tail.rotation.z = -.35; g.add(tail);
  cube(tail, 0x9d6834, 0, .05, -.1, .22, .46, .22);
  cube(tail, skin, .15, .4, -.2, .5, .32, .22); cube(tail, skin, .32, .7, -.2, .24, .6, .22); cube(tail, skin, .55, 1.03, -.2, .7, .36, .22);
  if (isBoss) { cube(g, 0xffe1a1, 0, .82, .35, .59, .64, .06); g.scale.setScalar(1.5); }
  g.userData = { head, tail }; return g;
}
function tree(x, z, scale = 1, level = 0) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(scale); world.add(t);
  const leaves = level === 1 ? [0xb9783c, 0xd89c44, 0xe2b14c] : level === 3 ? [0x809d9b, 0xb8d7d5, 0xe4efdf] : level === 4 ? [0x51547a, 0x63648c, 0x777b9a] : [0x4a793e, 0x5d8c45, 0x739c4f];
  cube(t, 0x78563c, 0, 1.55, 0, .72, 3.1, .72);
  cube(t, leaves[0], 0, 3.1, 0, 3.2, 1.65, 3); cube(t, leaves[1], .1, 4.1, 0, 2.65, 1.4, 2.6); cube(t, leaves[2], -.15, 5.0, .05, 1.8, .8, 1.75);
  cube(t, leaves[1], 1.4, 3.5, .15, 1.2, 1.15, 1.6);
  if (Math.abs(x) < 17 && Math.abs(z) < 17) obstacles.push({ x, z, r: .7 * scale });
}
function flower(x, z, color) { cube(world, 0x53783c, x, .21, z, .08, .4, .08); cube(world, color, x, .44, z, .28, .16, .28); }
function buildWorld() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world); pickups = []; hazards = []; effects = []; obstacles = []; clouds = []; rngSeed = 251 + state.level * 71;
  const level = LEVELS[state.level];
  scene.background = new THREE.Color(level.sky); scene.fog = new THREE.Fog(level.sky, 58, 135);
  const grassMap = pixelTexture();
  const groundMats = Array.from({ length: 6 }, (_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color(level.color).multiplyScalar(.93 + i * .025), map: grassMap, roughness: 1 }));
  const ground = new THREE.InstancedMesh(boxGeo, groundMats[0], 37 * 37);
  const dummy = new THREE.Object3D(); let count = 0;
  for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++) {
    if (Math.abs(x) + Math.abs(z) > 32) continue;
    dummy.position.set(x, -.32, z); dummy.scale.set(1, .64, 1); dummy.updateMatrix(); ground.setMatrixAt(count, dummy.matrix);
    ground.setColorAt(count, new THREE.Color(level.color).multiplyScalar(.91 + rand() * .17)); count++;
  }
  ground.count = count; ground.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grassMap, roughness: 1 }); ground.receiveShadow = true; world.add(ground);
  for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++) {
    if (Math.abs(x) + Math.abs(z) > 32) continue;
    if (Math.abs(x) >= 17 || Math.abs(z) >= 17 || Math.abs(x) + Math.abs(z) >= 31) {
      const depth = 2 + Math.floor(rand() * 3); cube(world, level.side, x, -.65 - depth / 2, z, 1, depth, 1);
      if (rand() > .55) cube(world, 0x777c68, x, -depth - .3, z, 1, .8 + rand(), 1);
    }
  }
  cube(world, level.side, 0, -2.3, 0, 32, 3.8, 32);
  const positions = [[-14,-11],[-8,-16],[0,-17],[10,-15],[16,-8],[17,4],[13,14],[-15,9],[-17,-2],[-9,17],[3,17],[-17,15]];
  positions.forEach(([x,z], i) => {
    if (state.level === 2) { cube(world, 0x6b9860, x, 1.4, z, .8, 2.8, .8); cube(world, 0x6b9860, x + .7, 1.5, z, 1.1, .5, .5); }
    else tree(x, z, .8 + (i % 3) * .18, state.level);
  });
  for (let i = 0; i < 85; i++) { const x = rand() * 33 - 16.5, z = rand() * 33 - 16.5; if (Math.abs(x) < 5 && Math.abs(z) < 12) continue; flower(x,z,[0xffe08b,0xf5efcb,0xedac8f][i%3]); }
  for (const [x,z] of [[-8,-5],[10,2],[-10,7],[7,-9],[-4,11]]) {
    const rockColor = state.level === 3 ? 0xb1c9cf : 0x929a7f;
    cube(world, rockColor, x, .35, z, 1.35, .7, 1.3); cube(world, rockColor, x + .3, .9, z, .9, .4, .85); obstacles.push({ x, z, r: 1 });
  }
  // Square rune platform under the boss.
  cube(world, 0x80916e, 0, .025, -9, 5.5, .05, 5.5);
  for (let i = -2; i <= 2; i++) for (const k of [-1, 1]) cube(world, 0xd4d9a0, i, .065, -9 + k * 2.5, .65, .05, .24);
  portal = new THREE.Group(); portal.position.set(0, 0, -15); world.add(portal);
  for (const side of [-1,1]) { cube(portal, 0x7b8870, side * 2, 2, 0, .85, 4, .9); cube(portal, 0xc4cba0, side * 2, 4.1, 0, 1.1, .4, 1.1); }
  cube(portal, 0x889477, 0, 4.6, 0, 4.9, .6, 1); cube(portal, 0xead98d, 0, 4.65, .55, .55, .5, .15, true);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.8), new THREE.MeshBasicMaterial({ color: 0xffde7a, side: THREE.DoubleSide, transparent: true, opacity: .18 })); p.position.set(0, 2, 0); portal.add(p); portal.userData.field = p;
  // Distant floating voxel islands and cube clouds.
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2, r = 48 + rand() * 20, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const island = new THREE.Group(); island.position.set(x, -4 + rand() * 7, z); world.add(island);
    cube(island, level.color, 0, 0, 0, 8, 1, 7); cube(island, level.side, 0, -1.8, 0, 7, 3, 6); cube(island, level.side, 1, -3.8, -.5, 4, 2, 3);
    cube(island, 0x66824f, 0, 2, 0, 3.5, 3, 3.5);
    const cloud = new THREE.Group(); cloud.position.set(x * .75, 14 + rand() * 8, z * .75); world.add(cloud);
    const cm = new THREE.MeshLambertMaterial({ color: 0xfffbea, transparent: true, opacity: .85 });
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(boxGeo, cm); m.position.set(k * 2.6, k%2 * .6, 0); m.scale.set(4, 1.6, 2.4); cloud.add(m); }
    clouds.push(cloud);
  }
  player = character(); player.position.set(4, 0, 7); player.rotation.y = .2; world.add(player);
  boss = character(true); boss.position.set(0, 0, -9); world.add(boss);
  for (const [x,z] of [[2,5],[-3,2],[6,0],[-5,-6],[5,-5],[-2,-11],[10,7],[-7,12]]) addPickup('bolt', x, z);
  addPickup('jump', -3, 6); addPickup('heart', 9, -7);
  velocityY = 0; attackTimer = 2.6; spawnTimer = 0; state.jumps = 0;
}
function addPickup(type, x, z) {
  const g = new THREE.Group(); g.position.set(x, .95, z); const color = type === 'bolt' ? 0xffd65a : type === 'jump' ? 0xaeea7c : 0xff8880;
  const gem = cube(g, color, 0, 0, 0, .42, .65, .42, true); gem.rotation.z = -.3;
  if (type === 'bolt') { cube(g, color, .16, .35, 0, .35, .19, .25, true); cube(g, color, -.16, -.35, 0, .35, .19, .25, true); }
  else if (type === 'jump') { cube(g, color, -.26, .06, 0, .25, .35, .35, true); cube(g, color, .26, .06, 0, .25, .35, .35, true); }
  else { cube(g, color, -.19, .15, 0, .35, .4, .35, true); cube(g, color, .19, .15, 0, .35, .4, .35, true); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.45, .52, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .3, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI/2; ring.position.y = -.85; g.add(ring);
  world.add(g); pickups.push({ mesh: g, type, base: .95, offset: rand() * 6 });
}
function burst(pos, color, n = 12) {
  for (let i = 0; i < n; i++) { const m = cube(world, color, pos.x, pos.y + .8, pos.z, .14, .14, .14, true); effects.push({ mesh: m, life: .55 + Math.random() * .3, velocity: new THREE.Vector3((Math.random()-.5)*5,Math.random()*5,(Math.random()-.5)*5) }); }
}
function tone(freq = 600, length = .1, shape = 'square', volume = .025) {
  if (!soundEnabled) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const o = audio.createOscillator(), g = audio.createGain(); o.type = shape; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(freq * .5, audio.currentTime + length); g.gain.setValueAtTime(volume, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length); o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + length); } catch {}
}
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastTimer = 3; }
function updateHUD() {
  $('health-value').textContent = `${state.health} / 100`; $('health-fill').style.width = `${state.health}%`;
  $('energy-value').textContent = `${state.energy} / 12`;
  $('energy-slots').innerHTML = Array.from({length:12},(_,i)=>`<i class="${i<state.energy?'filled':''}"></i>`).join('');
  $('boss-value').textContent = `${Math.ceil(state.bossHealth)} / ${LEVELS[state.level].health}`;
  $('boss-fill').style.width = `${state.bossHealth / LEVELS[state.level].health * 100}%`;
  $('boss-name').textContent = LEVELS[state.level].boss; $('world-name').textContent = LEVELS[state.level].name;
  $('level-label').textContent = `УРОВЕНЬ 0${state.level + 1}`; $('track-count').textContent = `${state.level + 1} / 5`;
  $('level-dots').innerHTML = LEVELS.map((_,i)=>`<i class="${i===state.level?'active':i<state.level?'done':''}"></i>`).join('');
  $('jump-status').textContent = state.jumpLevel ? 'ДВОЙНОЙ · SPACE' : 'SPACE';
  $('attack-status').textContent = state.energy ? `ЗАРЯДЫ: ${state.energy} · E` : 'СОБЕРИ ЭНЕРГИЮ';
  $('quest-bolt').classList.toggle('done', state.collected > 0); $('quest-jump').classList.toggle('done', !!state.jumpLevel); $('quest-boss').classList.toggle('done', state.bossHealth <= 0);
  for (const id of ['quest-bolt', 'quest-jump', 'quest-boss']) $(id).querySelector('.quest-check').textContent = $(id).classList.contains('done') ? '✓' : '◇';
}
function doJump() {
  if (state.phase !== 'playing' || !jump(state)) return;
  velocityY = state.jumps === 2 ? 10 : 8.8;
  burst(player.position, 0xbfe994, 7); tone(state.jumps === 2 ? 800 : 500, .12);
  if (state.jumps === 2) toast('↟ Двойной прыжок! Молния в воздухе наносит больше урона');
}
function doAttack() {
  if (state.phase !== 'playing') return;
  if (state.energy === 0) { toast('ϟ Собери золотые кристаллы, чтобы зарядить молнию'); return; }
  if (!attack(state)) return;
  const start = player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), end = boss.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const distance = start.distanceTo(end);
  player.rotation.y = Math.atan2(end.x-start.x, end.z-start.z);
  if (distance > 19) { toast('Райчу слишком далеко — подойди ближе'); state.energy++; state.cooldown = .2; updateHUD(); return; }
  const points = [];
  for (let i = 0; i <= 14; i++) { const p = start.clone().lerp(end, i/14); if(i>0 && i<14) p.add(new THREE.Vector3((Math.random()-.5)*.7,(Math.random()-.5)*.7,(Math.random()-.5)*.7)); points.push(p); }
  for (let i = 0; i < points.length-1; i++) { const a=points[i], b=points[i+1], line = new THREE.Mesh(boxGeo, mat(0xfff3a7,true)); line.position.copy(a).lerp(b,.5); line.scale.set(.11,.11,a.distanceTo(b)); line.lookAt(b); world.add(line); effects.push({ mesh:line,life:.18 }); }
  const dealt = player.position.y > 1 ? 36 : 24;
  state.bossHealth = Math.max(0, state.bossHealth - dealt); state.score += dealt; shake = .15; burst(boss.position, 0xffdf68, 18); tone(180,.2,'sawtooth',.04);
  boss.userData.hit = .2; updateHUD();
  if (state.bossHealth <= 0) defeatBoss();
}
function hurt(amount) {
  if (!damage(state,amount)) return;
  shake = .25; $('damage-flash').style.opacity = '1'; setTimeout(()=>$('damage-flash').style.opacity='0',200); tone(100,.2,'sawtooth',.035); updateHUD();
  if(state.phase==='lost') openModal('Попробуем ещё раз?', '<p>Райчу оказался сильнее. Собирай кристаллы и перепрыгивай электрические кольца. Удар молнией в воздухе наносит больше урона!</p>', 'ПОВТОРИТЬ УРОВЕНЬ →', ()=>{ state.health=100; state.energy=0; state.invulnerable=2; state.cooldown=0; state.bossHealth=LEVELS[state.level].health; state.phase='playing'; buildWorld(); updateHUD(); closeModal(); });
}
function spawnRing() {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(.9,1.15,48),new THREE.MeshBasicMaterial({color:state.level>2?0xb8bcff:0xffd175,side:THREE.DoubleSide,transparent:true,opacity:.85}));
  mesh.rotation.x=-Math.PI/2; mesh.position.copy(boss.position); mesh.position.y=.13; world.add(mesh); hazards.push({type:'ring',mesh,radius:1,speed:6+state.level*.7,hit:false,life:6}); tone(260,.2,'triangle');
}
function spawnShot(angleOffset = 0) {
  const delta = player.position.clone().sub(boss.position); delta.y=0; delta.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),angleOffset);
  const mesh=cube(world,0xffb47b,boss.position.x,.6,boss.position.z,.5,.5,.5,true); hazards.push({type:'shot',mesh,velocity:delta.multiplyScalar(6+state.level),life:7});
}
function defeatBoss() {
  state.phase='between'; state.score+=500; burst(boss.position,0xffec96,55); boss.visible=false; portal.userData.field.material.opacity=.75;
  tone(900,.4,'triangle',.07);
  if (state.level === 4) {
    nextLevel(state); openModal('Ты — повелитель грозы!', `<p>Все пять Райчу побеждены. Ты прошёл долину, лес, каньон, ледяные вершины и остров грозы.<br><br><b>Твой счёт: ${state.score}</b><br>Маленький Пикачу. Большая победа.</p>`, 'СЫГРАТЬ ЕЩЁ РАЗ ϟ', restart);
  } else openModal('Райчу побеждён!', `<p>Отличный разряд! Впереди — <b>${LEVELS[state.level+1].name.toLowerCase()}</b>.<br>Следующий Райчу будет быстрее и сильнее.<br><br>Здоровье восстановится, а двойной прыжок останется с тобой.</p>`, 'СЛЕДУЮЩИЙ МИР →', ()=>{nextLevel(state);buildWorld();updateHUD();closeModal();toast(`Мир ${state.level+1}: ${LEVELS[state.level].name}`);});
}
function openModal(title, copy, button, action) { keys.clear(); $('modal-title').textContent=title; $('modal-copy').innerHTML=copy; $('modal-action').textContent=button; modalAction=action; $('modal').hidden=false; }
function closeModal() { $('modal').hidden=true; modalAction=null; }
function pause() {
  if(state.phase==='playing'){state.phase='paused';openModal('Небольшая передышка','<p>Гроза подождёт. Возвращайся, когда будешь готов продолжить приключение.</p>','ПРОДОЛЖИТЬ →',()=>{state.phase='playing';closeModal();});}
  else if(state.phase==='paused'){state.phase='playing';closeModal();}
}
function restart() { state=createState();state.phase='playing';document.body.classList.add('playing');buildWorld();closeModal();updateHUD();toast('Собери золотые молнии и зелёный двойной прыжок!'); }
function start() { if(state.phase!=='menu')return;state.phase='playing';document.body.classList.add('playing');toast('WASD — движение · Space — прыжок · E — молния');updateHUD(); }
function tick(dt) {
  elapsed+=dt;
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible');}
  if(state.phase==='playing') {
    state.cooldown=Math.max(0,state.cooldown-dt);state.invulnerable=Math.max(0,state.invulnerable-dt);
    let dx=0,dz=0;
    if(keys.has('w')||keys.has('arrowup')){dx+=directions.up.x;dz+=directions.up.z;}
    if(keys.has('s')||keys.has('arrowdown')){dx-=directions.up.x;dz-=directions.up.z;}
    if(keys.has('d')||keys.has('arrowright')){dx+=directions.right.x;dz+=directions.right.z;}
    if(keys.has('a')||keys.has('arrowleft')){dx-=directions.right.x;dz-=directions.right.z;}
    const moving=dx||dz;
    if(moving){const l=Math.hypot(dx,dz);dx/=l;dz/=l;const speed=6.5;const nx=player.position.x+dx*speed*dt,nz=player.position.z+dz*speed*dt;
      if(Math.abs(nx)<16.4&&Math.abs(nz)<16.4&&Math.abs(nx)+Math.abs(nz)<29.5&&!obstacles.some(o=>Math.hypot(nx-o.x,nz-o.z)<o.r+.4&&player.position.y<1.2))player.position.set(nx,player.position.y,nz);
      const target=Math.atan2(dx,dz);player.rotation.y+=Math.atan2(Math.sin(target-player.rotation.y),Math.cos(target-player.rotation.y))*Math.min(1,dt*15);
    }
    velocityY-=22*dt;player.position.y+=velocityY*dt;
    if(player.position.y<=0){player.position.y=0;velocityY=0;state.jumps=0;}
    player.userData.head.rotation.z=moving?Math.sin(elapsed*13)*.045:Math.sin(elapsed*2)*.025;
    player.userData.tail.rotation.z=-.35+Math.sin(elapsed*5)*.12;
    player.visible=state.invulnerable>0?Math.floor(elapsed*14)%2===0:true;
    if(keys.has('e')||keys.has('f'))doAttack();
    for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];if(Math.hypot(p.mesh.position.x-player.position.x,p.mesh.position.z-player.position.z)<1.1&&player.position.y<2.5){collect(state,p.type);burst(p.mesh.position,p.type==='bolt'?0xffde6b:0xb3e98a,9);world.remove(p.mesh);pickups.splice(i,1);tone(p.type==='jump'?950:700,.12,'triangle');toast(p.type==='bolt'?'ϟ +3 заряда молнии':p.type==='jump'?'↟ Двойной прыжок открыт! Нажми Space ещё раз в воздухе':'♥ +25 здоровья');updateHUD();}}
    spawnTimer+=dt;if(spawnTimer>4.2){spawnTimer=0;if(pickups.filter(p=>p.type==='bolt').length<8)addPickup('bolt',(rand()-.5)*23,(rand()-.5)*23);if(state.health<65&&!pickups.some(p=>p.type==='heart'))addPickup('heart',(rand()-.5)*20,(rand()-.5)*20);}
    const delta=player.position.clone().sub(boss.position);delta.y=0;const dist=delta.length();
    if(dist>2.5){delta.normalize();boss.position.addScaledVector(delta,LEVELS[state.level].speed*dt);}
    boss.rotation.y=Math.atan2(player.position.x-boss.position.x,player.position.z-boss.position.z);
    boss.userData.head.rotation.z=Math.sin(elapsed*4)*.04;
    if(dist<2&&player.position.y<2.2)hurt(16+state.level*3);
    attackTimer-=dt;
    const warning=attackTimer<.65;boss.scale.setScalar(1.5+(warning?Math.sin(elapsed*22)*.06:0));
    if(attackTimer<=0){spawnRing();if(state.level>=1)spawnShot();if(state.level>=3){spawnShot(.36);spawnShot(-.36);}attackTimer=LEVELS[state.level].interval;}
    for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.life-=dt;
      if(h.type==='ring'){h.radius+=h.speed*dt;h.mesh.scale.setScalar(h.radius);const d=Math.hypot(player.position.x-h.mesh.position.x,player.position.z-h.mesh.position.z);if(Math.abs(d-h.radius)<.65&&player.position.y<.95&&!h.hit){h.hit=true;hurt(20+state.level*3);}h.mesh.material.opacity=Math.min(.9,h.life*.6);}
      else{h.mesh.position.addScaledVector(h.velocity,dt);h.mesh.rotation.x+=dt*5;h.mesh.rotation.z+=dt*5;if(player.position.distanceTo(h.mesh.position)<1.15&&player.position.y<1.3){hurt(14+state.level*3);h.life=0;}}
      if(h.life<=0){world.remove(h.mesh);if(h.type==='ring'){h.mesh.geometry.dispose();h.mesh.material.dispose();}hazards.splice(i,1);}
    }
  }
  for(const p of pickups){p.mesh.position.y=p.base+Math.sin(elapsed*2.7+p.offset)*.16;p.mesh.rotation.y+=dt*1.2;}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.velocity){e.mesh.position.addScaledVector(e.velocity,dt);e.velocity.y-=dt*10;e.mesh.rotation.x+=dt*4;e.mesh.scale.multiplyScalar(1-dt*1.1);}if(e.life<=0){world.remove(e.mesh);effects.splice(i,1);}}
  clouds.forEach((c,i)=>{c.position.x+=dt*(.13+i*.01);});
  const playing=state.phase!=='menu';
  const target=new THREE.Vector3(playing?player.position.x*.3:0,0,playing?player.position.z*.3:0);
  const desired=target.clone().add(new THREE.Vector3(25,26,31));camera.position.lerp(desired,Math.min(1,dt*2));
  camera.lookAt(target.x,target.y,target.z);
  if(shake>0){shake-=dt;camera.position.x+=(Math.random()-.5)*shake*2;camera.position.y+=(Math.random()-.5)*shake;}
  renderer.render(scene,camera);
}
function resize(){const w=innerWidth,h=innerHeight,view=w/h<.8?24:32;camera.left=-view*w/h/2;camera.right=view*w/h/2;camera.top=view/2;camera.bottom=-view/2;camera.updateProjectionMatrix();renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));}
function init(){
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-25,25,16,-16,.1,200);camera.position.set(25,26,31);camera.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;$('scene').appendChild(renderer.domElement);
  const hemi=new THREE.HemisphereLight(0xfff5d8,0x68874c,2.5);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0cd,3.1);sun.position.set(-15,32,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:85});sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;scene.add(sun);
  buildWorld();resize();updateHUD();$('loading').remove();
  renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.04);tick(dt);});
}
$('start').onclick=start;$('attack-btn').onpointerdown=e=>{e.preventDefault();doAttack();};$('jump-btn').onpointerdown=e=>{e.preventDefault();doJump();};
$('pause').onclick=pause;$('restart').onclick=restart;$('modal-action').onclick=()=>modalAction?.();
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'♫':'♪';$('sound').setAttribute('aria-label',soundEnabled?'Выключить звук':'Включить звук');$('sound').style.color=soundEnabled?'#ffdb63':'';tone(700,.15,'triangle');toast(soundEnabled?'Звук включён':'Звук выключен');};
$('help').onclick=()=>{if(!$('modal').hidden)return;helpReturn=state.phase;if(state.phase==='playing')state.phase='paused';openModal('Как стать грозой', '<div class="help-lines"><b>WASD / ↑↓←→</b><span>Исследуй остров и собирай кристаллы.</span><b>Space</b><span>Перепрыгивай кольца Райчу. Зелёный жетон открывает второй прыжок.</span><b>E / F</b><span>Молния сама находит босса. Золотой кристалл даёт 3 заряда.</span><b>Комбо</b><span>Удар в прыжке сильнее: 36 урона вместо 24!</span><b>♥</b><span>Сердечки восстанавливают здоровье.</span></div>', 'ВСЁ ПОНЯТНО →',()=>{state.phase=helpReturn;closeModal();});};
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){pause();return;}if(!$('modal').hidden){if(e.code==='Enter')modalAction?.();return;}if(e.code==='Enter'&&state.phase==='menu'){start();return;}const map={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',KeyF:'f'};keys.add(map[e.code]||e.key.toLowerCase());if(e.code==='Space'&&!e.repeat)doJump();});
document.addEventListener('keyup',e=>{const map={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',KeyF:'f'};keys.delete(map[e.code]||e.key.toLowerCase());});
document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.move));});
addEventListener('blur',()=>{keys.clear();if(state.phase==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(state.phase==='playing')pause();}});addEventListener('resize',()=>{if(renderer)resize();});
window.addEventListener('error',e=>{console.error('Game error:',e.error);});
try{init();}catch(error){console.error(error);$('loading')?.remove();$('fatal').hidden=false;}
