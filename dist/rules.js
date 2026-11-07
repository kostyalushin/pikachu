export const LEVELS = [
  { name: 'Изумрудная долина', boss: 'Райчу · Хранитель долины', health: 120, interval: 3.8, speed: 2.0, color: 0x78b44a, side: 0x8b7955, sky: 0xb6dce3, accent: '#b5df6a' },
  { name: 'Янтарный лес', boss: 'Райчу · Лесной охотник', health: 180, interval: 3.2, speed: 2.5, color: 0xb7a145, side: 0x866046, sky: 0xf0d8b2, accent: '#f5bd62' },
  { name: 'Песчаный каньон', boss: 'Райчу · Песчаная буря', health: 250, interval: 2.7, speed: 3.0, color: 0xd6b976, side: 0xa17453, sky: 0xe8cbb0, accent: '#f7d58d' },
  { name: 'Ледяные вершины', boss: 'Райчу · Полярный гром', health: 330, interval: 2.2, speed: 3.5, color: 0xd6e8eb, side: 0x789ca8, sky: 0xb6cddf, accent: '#b3efff' },
  { name: 'Остров грозы', boss: 'Райчу · Повелитель молний', health: 440, interval: 1.8, speed: 4.0, color: 0x696e9c, side: 0x454259, sky: 0x7a85ac, accent: '#d1b2ff' },
];
export function createState() {
  return { phase: 'menu', level: 0, health: 100, energy: 0, jumpLevel: 0, jumps: 0, cooldown: 0, invulnerable: 0, bossHealth: LEVELS[0].health, score: 0, collected: 0 };
}
export function collect(s, type) {
  if (type === 'bolt') s.energy = Math.min(12, s.energy + 3);
  if (type === 'jump') s.jumpLevel = 1;
  if (type === 'heart') s.health = Math.min(100, s.health + 25);
  s.collected++; s.score += 25;
}
export function attack(s) {
  if (s.energy < 1 || s.cooldown > 0) return false;
  s.energy--; s.cooldown = 0.55; return true;
}
export function jump(s) {
  if (s.jumps >= (s.jumpLevel ? 2 : 1)) return false;
  s.jumps++; return true;
}
export function damage(s, amount) {
  if (s.invulnerable > 0 || s.phase === 'lost') return false;
  s.health = Math.max(0, s.health - amount); s.invulnerable = 1.2;
  if (!s.health) s.phase = 'lost';
  return true;
}
export function nextLevel(s) {
  if (s.bossHealth > 0) return false;
  if (s.level === LEVELS.length - 1) { s.phase = 'won'; return true; }
  s.level++; s.bossHealth = LEVELS[s.level].health; s.health = 100;
  s.energy = Math.min(12, s.energy + 3); s.jumps = 0; s.invulnerable = 2; s.phase = 'playing';
  return true;
}
