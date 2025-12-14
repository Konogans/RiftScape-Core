# RiftScape Engine: Contributor Style Guide & Context

**Project Philosophy:** "Punk Rock Coding." No build tools, no transpilers, no friction. We trade architectural purity for velocity and creative flow. The code is "porous"—open to mutation and extension.

## 1. Technical Context
* **Environment:** Vanilla JavaScript (ES6+) running directly in the browser.
* **Graphics Engine:** THREE.js **r147** (Global `THREE` variable).
* **Physics:** Custom AABB/Circle collision (No physics engine).
* **Build System:** **NONE.** Do not use `import`, `export`, or `require`.

## 2. Core Architecture Patterns

### A. The "Manager-Global" Pattern
Core systems are instantiated once and attached to `window` or the `Game` instance.
* **Access:** Logic communicates via global state.
* **Example:** `Game.js` accesses `window.WorldState`. `Enemy.js` accesses `this.game.player`.
* **Rule:** Do not inject dependencies via constructors unless necessary. Assume globals exist.

**Namespace Consolidation:**
For future-proofing, all core systems are also available via `window.RiftScape.*`:
```javascript
// Both work (backward compatible):
window.WorldState.getCurrentNode()
window.RiftScape.WorldState.getCurrentNode()
```
Prefer `window.RiftScape.*` for new code to reduce global namespace pollution.

### B. The Registry Pattern (Content)
All game content (Stats, Visuals, Rules) must be separated from logic.
* **Structure:** Static objects with a `register(id, def)` and `get(id)` method.
* **Rule:** Never hardcode magic numbers or assets in a class. Create a Registry entry and query it.
    * *Bad:* `this.health = 100;`
    * *Good:* `this.def = EntityRegistry.get(type); this.health = this.def.health;`

### C. The "Loop & Update" Pattern
* **Entities:** Must have an `update(deltaTime, elapsed)` method.
* **Lifecycle:** Entities must manage their own state flags: `this.dead` and `this.shouldRemove`.
* **Cleanup:** Entities must have a `dispose()` method to clean up Three.js geometries/materials.

## 3. Coding Conventions

### A. Syntax & Formatting
* **Classes:** Use ES6 Classes (`class Player { ... }`).
* **Conciseness:** Multiple assignments on one line are acceptable for initialization.
    * *Example:* `this.runTime = 0; this.kills = 0; this.isGameOver = false;`
* **Math:** Use raw math for simple logic. Use `THREE.Vector3` only when necessary for rendering or complex 3D transforms.
* **HTML/UI:** Direct DOM manipulation is standard (`document.getElementById`).
    * *Note:* Avoid setting `style` every frame if possible (Performance).

### B. File Structure
* **1 Class = 1 File:** Generally preferred.
* **Grouping:** tightly coupled helpers (like `PointPool` inside `Utils.js`) are allowed in the same file.
* **Organization:** Keep related files together:
  * `js/core/` - Core engine systems
  * `js/systems/` - Gameplay systems
  * `js/entities/` - Entity classes
  * `js/data/` - Registry definitions
  * `js/ui/` - UI systems
  * `js/effects/` - Visual effects

## 4. Specific "Do Not" Rules for AI
1.  **NO Imports:** Never write `import * as THREE from 'three'`. Assume `THREE` is globally available.
2.  **NO Build Steps:** Do not suggest TypeScript, Webpack, or Babel.
3.  **NO strict ECS:** Do not try to refactor `Player` or `Enemy` into a generic `Entity` with `Components`. Keep them as distinct classes.

## 5. THREE.js Specifics (v0.147)
* **Geometry:** Use `BufferGeometry` (Standard in recent Three.js).
* **Lighting:** `MeshStandardMaterial` is the default material workflow.
* **Loading:** Use `GLTFLoader` (via `ModelLoader` wrapper) for assets.

***

### How to use this:
Whenever you prompt an AI, add this "System Header":

> "I am working on the RiftScape project. It is a raw JS game using Three.js r147 with no build step. Use global variables for managers (window.Game, window.WorldState or window.RiftScape.*). Use the Registry pattern for content. Keep code terse and functional. Refer to CONTRIBUTING.md and ARCHITECTURE.md for details."

---

## 6. Documentation Standards

### JSDoc Annotations
Add JSDoc comments to public APIs:

```javascript
/**
 * Creates a new entity.
 * @param {Game} game - Game instance
 * @param {number} x - X position
 * @param {number} z - Z position
 * @param {string} [type='default'] - Entity type ID
 * @returns {Entity} New entity instance
 */
constructor(game, x, z, type = 'default') { ... }
```

### Inline Comments
Add comments for complex logic:
* Algorithm explanations
* Performance considerations
* Non-obvious workarounds
* TODO/FIXME notes

---

## 7. Future-Proofing Guidelines

### Namespace Usage
* **New code:** Prefer `window.RiftScape.*` over direct `window.*` access
* **Existing code:** Both patterns work (backward compatible)
* **Mods:** Can use either pattern

### Code Organization
As the codebase grows:
* Keep systems focused and single-purpose
* Use Registry pattern for all content
* Follow Entity lifecycle consistently
* Document complex algorithms

See `ARCHITECTURE.md` for detailed system documentation.

