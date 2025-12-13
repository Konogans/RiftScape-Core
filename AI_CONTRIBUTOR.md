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

> "I am working on the RiftScape project. It is a raw JS game using Three.js r147 with no build step. Use global variables for managers (window.Game, window.WorldState). Use the Registry pattern for content. Keep code terse and functional. Refer to the Style Guide if unsure."