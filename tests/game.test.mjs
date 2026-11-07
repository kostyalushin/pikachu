import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, collect, attack, jump, damage, nextLevel, LEVELS } from '../dist/rules.js';

test('lightning must be collected and spent, and cannot fire during cooldown', () => {
  const s = createState();
  assert.equal(attack(s), false);
  collect(s, 'bolt');
  assert.equal(attack(s), true);
  assert.equal(s.energy, 2);
  assert.equal(attack(s), false);
});
test('jump pickup unlocks a midair jump, with a maximum of two jumps', () => {
  const s = createState();
  assert.ok(jump(s));
  assert.equal(jump(s), false);
  collect(s, 'jump');
  assert.ok(jump(s));
  assert.equal(jump(s), false);
});
test('damage grants temporary immunity and health cannot go negative', () => {
  const s = createState();
  damage(s, 40);
  damage(s, 40);
  assert.equal(s.health, 60);
  s.invulnerable = 0;
  damage(s, 500);
  assert.equal(s.health, 0);
  assert.equal(s.phase, 'lost');
});
test('each boss is stronger and defeating the fifth completes the game', () => {
  const s = createState();
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].health > LEVELS[i - 1].health);
    assert.ok(LEVELS[i].interval < LEVELS[i - 1].interval);
    s.bossHealth = 0;
    nextLevel(s);
    assert.equal(s.level, i);
    assert.equal(s.health, 100);
  }
  s.bossHealth = 0;
  nextLevel(s);
  assert.equal(s.phase, 'won');
});
test('a living boss blocks progression, and healing and energy have limits', () => {
  const s = createState();
  nextLevel(s);
  assert.equal(s.level, 0);
  for (let i = 0; i < 20; i++) collect(s, 'bolt');
  collect(s, 'heart');
  assert.equal(s.energy, 12);
  assert.equal(s.health, 100);
});
