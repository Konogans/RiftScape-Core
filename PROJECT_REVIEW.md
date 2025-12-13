# RiftScape Core Engine - Project Review & Next Steps

**Review Date:** December 2024
**Engine Version:** v3.0
**Reviewer:** Claude AI

---

## Executive Summary

RiftScape Core is a **well-architected browser-based action RPG** built on vanilla JavaScript and THREE.js. The project follows a "Punk Rock Coding" philosophy that prioritizes developer velocity over architectural purity. The codebase is approximately **6,500+ lines of JavaScript** with a clean separation between data (registries) and logic (systems).

### Overall Assessment: **MVP 95% Complete**

| Category | Status | Score |
|----------|--------|-------|
| Core Game Loop | Complete | 10/10 |
| Player Systems | Complete | 9/10 |
| Enemy AI & Behavior | Complete | 8/10 |
| World Generation | Complete | 9/10 |
| Meta-Progression | Complete | 9/10 |
| Animation System | Implemented (Option A) | 8/10 |
| Sound System | Partial | 6/10 |
| Visual Polish | Needs Work | 6/10 |

---

## I. Architecture Review

### Strengths

1. **Clean Data-Logic Separation**
   - All game content defined in registries (`AbilityRegistry`, `EntityRegistry`, etc.)
   - Easy to add new content without touching core logic
   - Perfect foundation for modding

2. **Efficient Spatial Systems**
   - Chunk-based world loading prevents memory bloat
   - Spatial grid enables O(1) collision queries
   - Flow field pathfinding runs at 5Hz (performance optimized)

3. **Modular Entity System**
   - Each entity manages its own lifecycle (`update()`, `dispose()`)
   - Self-contained classes reduce coupling
   - Hot-swappable via ModManager

4. **Zero Friction Development**
   - No build step means instant iteration
   - Drag-and-drop modding enables live debugging
   - Global state intentionally exposed for rapid prototyping

### Technical Debt

| Issue | Impact | Remediation |
|-------|--------|-------------|
| No Type Safety | Runtime errors possible | Add JSDoc annotations for critical APIs |
| **Legacy Model Loading** | Entity model code untested | Port working code from `mods/riftling_remastered.js` |
| Animation Code Scattered | Hard to maintain | Integrate V4.4 animation system into core |
| Sound System Incomplete | Missing music support | Implement Web Audio file loading |
| Some Memory Leaks | Long session degradation | Audit all `dispose()` methods |

> **Note:** The model loading code in `js/entities/*.js` files is legacy and untested.
> The proven working implementation is in `mods/riftling_remastered.js` (V4.4).

---

## II. Code Quality Assessment

### File-by-File Analysis

| File | Lines | Quality | Notes |
|------|-------|---------|-------|
| `js/core/Game.js` | ~638 | Good | Main loop clean, state management solid |
| `js/core/WorldManager.js` | ~400 | Good | Chunk system well-implemented |
| `js/core/Utils.js` | ~262 | Good | PointPool, Action classes work well |
| `js/entities/Player.js` | ~300 | Good | Loadout system functional |
| `js/entities/Enemy.js` | ~150 | Fair | Animation integration fragile |
| `js/entities/Boss.js` | ~100 | Fair | Memory leak in moshRing |
| `js/systems/RaidManager.js` | ~150 | Good | Wave system complete |
| `js/ui/HUDSystem.js` | ~300 | Good | Canvas-based, performant |

### Pattern Compliance

The codebase consistently follows the project's stated patterns:

- **Registry Pattern**: All content in `js/data/*Registry.js` files
- **Global State**: Managers accessible via `window.Game`, `window.WorldState`
- **Entity Lifecycle**: All entities have `update()` and `dispose()` methods
- **No Build Tools**: Pure ES6+ with CDN-loaded THREE.js

---

## III. Known Bugs Analysis

### Critical Priority

#### B-001: Animation De-sync in Enemy.js ✅ FIXED
**Location:** `js/entities/Enemy.js`, `js/systems/AttackSystem.js`
**Impact:** Attack animations don't sync with actual damage timing
**Status:** Implemented Option A - Animation speed synced to AttackSystem timing

**Root Cause Analysis:**

There are **two separate timing systems** that don't communicate:

| System | Timing Source | When Damage Occurs |
|--------|---------------|-------------------|
| `AttackSystem.js` | `Action` class (`windupTime`, `actionTime`) | At fixed ms after trigger (e.g., 200-350ms) |
| Animation (GLB) | Clip duration | Visual hit at 50-75% of clip (e.g., 500-750ms for 1s clip) |

The `riftling_remastered.js` mod handles model loading and basic animations (Idle/Walk/Run) correctly, but its attack hit detection is a **placeholder** that logs but doesn't integrate with `AttackSystem.onAction()`.

**Current Flow (Broken):**
```
1. attackAction.trigger() called
2. Action enters 'windup' phase (e.g., 200ms)
3. Action enters 'action' phase → AttackSystem.onAction() deals damage
4. Meanwhile, animation plays independently at its own speed
5. Visual "hit" moment doesn't match gameplay damage moment
```

**Fix Approach Options:**

**Option A: Sync Animation Speed to Action Timing**
- Calculate animation playback rate: `animSpeed = clipDuration / (windupTime + actionTime)`
- Force animation to complete its hit frame when `onAction()` fires
- Pros: Keeps AttackSystem as source of truth
- Cons: Animations may look sped up or slowed down

**Option B: Animation-Driven Damage (Mod Approach)**
- Use animation percentage (50-75%) to trigger damage
- Replace `AttackSystem.onAction()` timing with animation callbacks
- Pros: Visual and gameplay always match
- Cons: Requires significant refactor of AttackSystem

**Option C: Animation Events / Notifies**
- Add "hit" event markers in GLB animations (if supported)
- Fire damage on animation event rather than fixed timing
- Pros: Industry-standard approach
- Cons: Requires model re-export with events

**Recommended: Option A** (least disruptive, keeps existing architecture)

### High Priority

#### B-002: Boss Memory Leak
**Location:** `js/entities/Boss.js`
**Impact:** `moshRing` geometry/material not disposed, memory grows over time
**Fix:** Add explicit disposal in `Boss.dispose()`:
```javascript
if (this.moshRing) {
    if (this.moshRing.geometry) this.moshRing.geometry.dispose();
    if (this.moshRing.material) this.moshRing.material.dispose();
    this.game.scene.remove(this.moshRing);
}
```

### Low Priority

#### B-003: Projectile Collision Radius
**Location:** `js/entities/Projectile.js`
**Impact:** Projectiles use fixed 0.6 radius, feels inconsistent
**Fix:** Use enemy's defined `radius` property for collision checks

---

## IV. Priority Ranking of Next Steps

Based on impact and dependencies, here's the recommended priority order:

### Priority 1: Critical Bug Fixes (Blocks Visual Polish)
1. **B-001 Animation Fix** - Must be done first, everything visual depends on this
2. **B-002 Memory Leak** - Important for production stability

### Priority 2: Sound System (High User Impact)
3. **SoundSystem Upgrade** - Add Web Audio file loading
4. **Boss Music Integration** - Play music on boss spawn

### Priority 3: Pedalboard UI/Logic (Core Feature Completion)
5. **Character Model Prep** - Update CharacterRegistry with GLB paths
6. **Player Loadout Refinement** - Ensure custom loadouts work correctly
7. **Player Animation Sync** - Implement animation state machine

### Priority 4: Polish (Final Touch)
8. **B-003 Collision Fix** - Minor gameplay improvement
9. **UI Tooltips** - Optional but nice quality of life

---

## V. Detailed Implementation Plan

### Phase 1: Critical Fixes (Estimated: High Priority)

#### Task 1.1: Fix Enemy Animation De-sync (B-001)

**Files:** `js/entities/Enemy.js`

**Reference Implementation:** `mods/riftling_remastered.js` (V4.4) - This is the working, tested implementation.

> **IMPORTANT:** The model loading code currently in entity files is legacy and untested.
> The `riftling_remastered.js` mod provides the proven working example that should be
> integrated into the core.

**Key Patterns from Working Implementation:**

1. **Model Loading with GLTFLoader:**
   ```javascript
   const gltfLoader = new THREE.GLTFLoader();
   const glb = await new Promise((res, rej) => {
       gltfLoader.load('models/Riftling_Clean.glb?v=' + (++counter), res, undefined, rej);
   });
   enemy.mesh = glb.scene;
   enemy.mixer = new THREE.AnimationMixer(glb.scene);
   ```

2. **Animation Action Setup:**
   ```javascript
   enemy.animActions = {};
   glb.animations.forEach(clip => {
       const action = enemy.mixer.clipAction(clip);
       action.setLoop(THREE.LoopRepeat);
       enemy.animActions[clip.name] = action;

       // Special handling for attack animations
       if (clip.name.includes('Attack')) {
           action.setLoop(THREE.LoopOnce, 0);
           action.clampWhenFinished = true;
       }
   });
   ```

3. **playAnim() Method with CrossFade:**
   ```javascript
   enemy.playAnim = function(name, fadeTime = 0.15) {
       if (this.currentAnim === name || !this.animActions[name]) return;

       const newAction = this.animActions[name];
       if (this.currentAnim && this.animActions[this.currentAnim]) {
           const oldAction = this.animActions[this.currentAnim];
           newAction.reset().play();
           newAction.crossFadeFrom(oldAction, fadeTime, true);
       } else {
           newAction.reset().play();
       }
       this.currentAnim = name;
   };
   ```

4. **Attack Enforcement System (Critical!):**
   ```javascript
   // Prevents animation interruption during attack windup (0-75%)
   const percentPlayed = attackAction.time / attackAction.getClip().duration;
   const windupEndPercent = 0.50;  // Hit window starts
   const actionEndPercent = 0.75;  // Recovery phase starts

   if (percentPlayed < actionEndPercent) {
       enemy.isAttackEnforced = true;
       return; // BLOCKS movement/idle transitions
   }
   ```

5. **Movement State Detection (Speed-based):**
   ```javascript
   const dx = pos.x - enemy.lastPos.x;
   const dz = pos.z - enemy.lastPos.z;
   const actualSpeed = Math.sqrt(dx*dx + dz*dz) / dt;

   if (actualSpeed > 2.0) enemy.playAnim('Running');
   else if (actualSpeed > 0.3) enemy.playAnim('Walking');
   else enemy.playAnim('Idle');
   ```

**Integration Steps:**

**Step 1: Port Model Loading (from riftling_remastered.js)**
1. Port the `loadModel` patch logic directly into `Enemy.js` constructor
2. Add the `playAnim()` method with crossFade support
3. Port Idle/Walk/Run state detection into `Enemy.update()`

**Step 2: Fix Attack Animation Sync (the actual bug)**
The model loading works, but attack timing is broken. Choose one approach:

*Option A Implementation (Recommended):*
```javascript
// In Enemy.js, when attack animation starts:
if (this.animActions['Attack'] && this.def.attackTiming) {
    const clip = this.animActions['Attack'].getClip();
    const targetDuration = (this.def.attackTiming.windup + this.def.attackTiming.action) / 1000;
    const timeScale = clip.duration / targetDuration;
    this.animActions['Attack'].setEffectiveTimeScale(timeScale);
}
```

*Option B Implementation (Animation-Driven):*
```javascript
// Replace AttackSystem timing with animation-percentage-based damage
// In Enemy.update():
if (isCurrentlyAttacking && attackAction) {
    const percent = attackAction.time / attackAction.getClip().duration;
    if (percent >= 0.50 && percent < 0.75 && !this.hasHitThisAttack) {
        AttackSystem.patterns[this.def.attack.type].onAction(this, this.game, this.def.attack);
        this.hasHitThisAttack = true;
    }
}
```

**Step 3: Cleanup**
4. Remove animation code from `mods/` directory after core integration
5. Test with Riftling_Clean.glb model

#### Task 1.2: Fix Boss Memory Leak (B-002)

**Files:** `js/entities/Boss.js`

**Implementation Steps:**
1. Locate `dispose()` method
2. Add before scene removal:
   ```javascript
   if (this.moshRing) {
       this.moshRing.geometry?.dispose();
       this.moshRing.material?.dispose();
       this.game.scene.remove(this.moshRing);
       this.moshRing = null;
   }
   ```

---

### Phase 2: Sound System Upgrade

#### Task 2.1: Add File Loading to SoundSystem

**Files:** `js/core/SoundSystem.js`

**Implementation Steps:**
1. Add audio context and buffer cache:
   ```javascript
   this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
   this.buffers = {};
   this.currentMusic = null;
   ```

2. Implement `load(id, path)` method:
   ```javascript
   async load(id, path) {
       const response = await fetch(path);
       const arrayBuffer = await response.arrayBuffer();
       this.buffers[id] = await this.audioContext.decodeAudioData(arrayBuffer);
   }
   ```

3. Implement `playMusic(id, loop = true)`:
   ```javascript
   playMusic(id, loop = true) {
       this.stopMusic();
       const source = this.audioContext.createBufferSource();
       source.buffer = this.buffers[id];
       source.loop = loop;
       source.connect(this.audioContext.destination);
       source.start(0);
       this.currentMusic = source;
   }
   ```

4. Implement `stopMusic()`:
   ```javascript
   stopMusic() {
       if (this.currentMusic) {
           this.currentMusic.stop();
           this.currentMusic = null;
       }
   }
   ```

#### Task 2.2: Integrate Boss Music

**Files:** `js/systems/RaidManager.js`, `js/entities/Boss.js`

**Implementation Steps:**
1. In `RaidManager.spawnBoss()`:
   ```javascript
   if (window.game.soundSystem) {
       window.game.soundSystem.playMusic('boss_theme');
   }
   ```

2. In `Boss.dispose()` or when raid ends:
   ```javascript
   if (window.game.soundSystem) {
       window.game.soundSystem.stopMusic();
   }
   ```

---

### Phase 3: Pedalboard UI/Logic Integration

#### Task 3.1: Character Model Preparation

**Files:** `js/data/CharacterRegistry.js`

**Implementation Steps:**
1. Update each character definition with model info:
   ```javascript
   CharacterRegistry.register('wanderer', {
       name: 'The Wanderer',
       // ... existing stats ...
       model: {
           path: 'models/wanderer.glb',  // or placeholder
           scale: 1.0,
           animations: {
               idle: 'Idle',
               walk: 'Walk',
               attack: 'Attack'
           }
       }
   });
   ```

#### Task 3.2: Player Loadout Refinement

**Files:** `js/entities/Player.js`

**Implementation Steps:**
1. Review `initLoadout()` method
2. Ensure it correctly merges base character abilities with custom loadout
3. Handle edge cases where ability slots are locked/unavailable

#### Task 3.3: Player Animation Sync

**Files:** `js/entities/Player.js`

**Implementation Steps:**
1. Port the animation state machine from Enemy fix to Player
2. Sync with pedalboard action states
3. Handle special cases (dash invincibility frames, etc.)

---

### Phase 4: Polish & Cleanup

#### Task 4.1: Fix Projectile Collision (B-003)

**Files:** `js/entities/Projectile.js`

**Implementation Steps:**
1. Find collision check code
2. Replace hardcoded `0.6` with `enemy.radius || 0.6`

#### Task 4.2: Additional Polish (Optional)

- Add UI tooltips for ability icons
- Improve particle effects
- Add screen transitions between biomes

---

## VI. Long-Term Roadmap Recommendations

Based on IDEAS.md, here's a prioritized long-term vision:

### Near-Term (Post-MVP)
1. **Loadout Presets** - Save/load ability configurations
2. **Ability Slot Unlocks** - Gate mastery slot behind upgrades
3. **Affinity System Buffs** - Magic/Tech affinity provides passive bonuses

### Medium-Term
1. **Dynamic World Events** - Mid-run objectives and challenges
2. **Raid Boss Mechanics** - Unique attack patterns for high-level bosses
3. **Crafting Basics** - Tech Scraps and Aether Shards resources

### Long-Term (Major Features)
1. **Aetherspace Map** - Persistent world navigation system
2. **Mounted Combat** - Vehicle/creature summoning
3. **Monster Zoo** - Collect enemy abilities for player use

---

## VII. Metrics & Success Criteria

### MVP Completion Criteria
- [ ] All characters have working animations
- [ ] No memory leaks in 30+ minute sessions
- [ ] Boss music plays and stops correctly
- [ ] All 4 characters playable with distinct loadouts
- [ ] Raid system stable through Level 3

### Quality Targets
- Frame Rate: Stable 60fps on mid-range hardware
- Load Time: <3 seconds to playable state
- Session Stability: No crashes in 60+ minute sessions

---

## VIII. Conclusion

RiftScape Core is a well-crafted project with solid foundations. The "Punk Rock Coding" philosophy has enabled rapid iteration but has left some technical debt around animation and sound systems.

**Recommended immediate actions:**
1. Fix B-001 (animation sync) - This is the critical blocker
2. Fix B-002 (memory leak) - Important for stability
3. Complete sound system - High impact for player experience

With these fixes in place, the game will be at true MVP quality and ready for expanded content development.

---

*This review was generated based on comprehensive codebase analysis. Implementation estimates should be validated against actual development velocity.*
