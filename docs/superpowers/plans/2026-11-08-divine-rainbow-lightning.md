# Divine Rainbow Lightning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanently available hidden `6` key finisher that kills Raichu with a cinematic rainbow lightning animation.

**Architecture:** Keep eligibility and state transitions in the pure rules module so they are unit-tested. Keep Three.js meshes, timing, input binding, and cleanup in the existing browser game module, reusing the current boss-victory flow after the finisher completes.

**Tech Stack:** JavaScript ES modules, Node.js test runner, Three.js.

**Spec:** `docs/superpowers/specs/2026-11-08-divine-rainbow-lightning-design.md`

## Global Constraints

- The secret is available without energy during every active boss fight.
- No button, HUD status, help copy, toast, or README text may reveal it.
- `Digit6` starts the finisher; repeat presses during the sequence do nothing.
- The battle freezes until the animation hands control to the existing victory flow.
- Add no assets or dependencies.
- Do not create commits unless the user explicitly requests them.

## Review Focus

- Pressing `6` with zero energy still kills the boss; covered by Task 1.
- Pressing `6` during cooldown still kills the boss; covered by Task 1.
- Holding or repeating `6` cannot start overlapping finishers; covered by Task 1.
- Pressing `6` outside an active fight changes nothing; covered by Task 1.
- Completing a level resets the finisher lock for the next boss; covered by Task 1.

---

### Task 1: Divine strike game rule

**Files:**
- Modify: `tests/game.test.mjs`
- Modify: `dist/rules.js`

**Interfaces:**
- Consumes: Existing mutable game state from `createState()`.
- Produces: `divineAttack(state): boolean`, plus `state.divineStrikeActive: boolean` reset by `nextLevel(state)`.

- [ ] **Step 1: Add failing rule tests**

Add focused tests asserting that `divineAttack` succeeds in `playing` with zero energy and nonzero cooldown, sets `bossHealth` to `0`, changes the phase to `finisher`, and sets `divineStrikeActive`. Add rejection assertions for a second invocation and for menu/between phases. Extend the level-transition test to assert that `nextLevel` clears `divineStrikeActive`.

- [ ] **Step 2: Run the rule tests and verify RED**

Run: `npm test`

Expected: FAIL because `divineAttack` is not exported.

- [ ] **Step 3: Implement the minimal pure rule**

Add `divineStrikeActive: false` to `createState()`. Implement `divineAttack(state): boolean` with the phase/active/boss-health guards and state changes pinned by the tests. Reset the flag inside successful `nextLevel(state)` transitions, including the final win branch.

- [ ] **Step 4: Run the rule tests and verify GREEN**

Run: `npm test`

Expected: all tests pass with no warnings.

### Task 2: Cinematic Three.js finisher

**Files:**
- Modify: `dist/game.js`

**Interfaces:**
- Consumes: `divineAttack(state): boolean` from Task 1 and the existing `defeatBoss()` victory flow.
- Produces: `doDivineAttack()` input handler and a time-based finisher state updated by `tick(dt)`.

- [ ] **Step 1: Bind the hidden input**

Import `divineAttack`, add `Digit6` to the keydown handler as a non-repeating one-shot action, and do not add any visible copy or UI controls.

- [ ] **Step 2: Create the strike visuals**

On a successful rule call, clear held movement keys and hazards, then create a temporary effect group above the boss: seven emissive lightning layers using red, orange, yellow, green, cyan, blue, and violet; a white core; expanding impact rings; and a short-lived flash light.

- [ ] **Step 3: Animate the boss defeat**

While `state.phase === 'finisher'`, advance a local timer instead of battle logic. Shake and brighten the boss, then shrink and sink it; at the burst threshold hide it and emit glowing cubes across the seven rainbow colors. Ignore repeat triggers until completion.

- [ ] **Step 4: Hand off to normal victory**

After the cinematic duration, remove and dispose temporary geometry/materials/light, clear the local finisher object, then call the existing boss defeat flow without its normal yellow burst so the current next-world/final-win modal behavior is preserved.

- [ ] **Step 5: Check browser-module syntax**

Run: `node --check dist/game.js && node --check dist/rules.js`

Expected: both commands exit `0` with no output.

### Task 3: Full verification

**Files:**
- Verify only: `dist/index.html`, `dist/style.css`, `README.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: Verified release-ready static game files.

- [ ] **Step 1: Verify the easter egg remains undisclosed**

Search visible game copy and documentation for `Digit6`, `клавиша 6`, `супер`, and `божествен`; confirm no matching disclosure exists outside tests, implementation, spec, and plan.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test && node --check dist/game.js && node --check dist/rules.js`

Expected: all tests pass and syntax checks exit `0`.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git diff -- tests/game.test.mjs dist/rules.js dist/game.js`

Expected: no whitespace errors; diff contains only the rule, hidden input, cinematic effect, and tests.
