# `STATUS.md`

## 🎸 RiftScape Engine Status & Roadmap

This document outlines the architecture, current state, known issues, and immediate development priorities for the RiftScape core engine (v3.0).

---

## I. ⚡ Project Philosophy: Punk Rock Coding

| Element | Rule | Rationale |
| :--- | :--- | :--- |
| **Toolchain** | **NO BUILD STEP.** Pure Vanilla JS (ES6+). | Maximum velocity. Zero friction between code and execution. |
| **State Management**| Global Managers (`window.Game`, `window.WorldState`). | Immediate, direct access. Simple state mutation. |
| **Content/Logic** | **Registry Pattern (Data over Code).** | Allows for simple modding and decoupling of content (Enemies, Abilities, Upgrades). |
| **Graphics** | **THREE.js r147** + `PSXify` Shader. | Enforces a consistent, low-fidelity aesthetic and performance target. |
| **Modding** | Hot-swappable via Drag-and-Drop (D&D). | "Porous" architecture. Testing and extension without rebuilding. |

---

## II. ✅ Current Implemented Features (MVP)

* **Core Loop:** Hub (Outpost) $\leftrightarrow$ Rift (Run) $\leftrightarrow$ Game Over.
* **Player System:** Custom "Wound" Health System (`PointPool.js`).
* **Loadouts:** Multiple playable characters (`Wanderer`, `Architect`, `Smith`, `Scribe`).
* **Abilities/Action:** Pedalboard system (`primary`, `secondary`, `mobility`, `utility`, `mastery`) managed by `Action` objects (Windup/Action/Cooldown).
* **Persistence:** Meta-Progression for Upgrades, Essence, and Character Unlocks.
* **Structure/Defense:** Placeable Structures (`Wall`, `Turret`) with persistence via `HubState.js`.
* **World Generation:** Dynamic grid-based chunk loading (`WorldManager.js`) with portals and flow field pathing for enemies.
* **Customization:** Implemented **Pedalboard Customization** via Architect NPC dialogue (Status: **UNDER IMPLEMENTATION**).

---

## III. 🚧 Known Bugs & Immediate Fixes (`BUGS.md`)

| ID | Location | Description | Priority |
| :--- | :--- | :--- | :--- |
| **B-001** | `Enemy.js` | **Animation De-sync:** Riftling models do not consistently play 'attack', 'walk', or 'idle' animations. Previous modding attempts failed stability checks. **FIX: Requires integration into the core framework.** | **Critical** |
| **B-002** | `Boss.js` | **Model Leak:** The `Boss` class creates the `moshRing` and adds it directly to `game.scene`, but the `dispose()` method does not fully clean up all its geometry/material (the geometry/material for the ring). | High |
| **B-003** | `Projectile.js` | **Collision:** Projectiles check collisions using a large radius (0.6) on enemies, which feels inconsistent. Should use the enemy's `radius` property if defined. | Low |

---

## IV. ➡️ Immediate Next Steps (`TODO.md`)

These are the immediate tasks required to stabilize the engine and complete the visual MVP.
The focus is now on establishing the **Pedalboard UI** and enabling **Custom Sound Loading**.

### A. 🎯 Pedalboard UI/Logic Integration

| Step | Action | Files Affected |
| :--- | :--- | :--- |
| **A-1** | **Character Model Prep:** Update `CharacterRegistry.js` to define the GLB model path and animation map (even if the file is a placeholder for now). | `js/data/CharacterRegistry.js` |
| **A-2** | **Player Loadout Refinement:** Ensure `Player.initLoadout()` handles the new custom loadouts correctly by reading the merged definition from `CharacterRegistry.get()`. | `js/entities/Player.js` |
| **A-3** | **Player Animation Sync Base:** Implement the base structure for animation state synchronization in `Player.update()` (Idle $\leftrightarrow$ Attack $\leftrightarrow$ Movement). | `js/entities/Player.js` |

### B. 🎶 Sound System Upgrade: Custom File Support

| Step | Action | Files Affected |
| :--- | :--- | :--- |
| **B-4** | **`SoundSystem` Upgrade:** Implement a method (e.g., `load(path)`) to fetch and decode an external audio file (like an MP3) using the Web Audio API (`AudioContext`). | `js/core/SoundSystem.js` |
| **B-5** | **`SoundSystem` Playback:** Implement a method (e.g., `playMusic(id)`) to create a persistent, looping `AudioBufferSourceNode` for music tracks. | `js/core/SoundSystem.js` |
| **B-6** | **Boss Wave Trigger:** In `RaidManager.js`, call the new `SoundSystem.playMusic('boss_theme')` when the boss is spawned. Implement a `stopMusic()` call when the boss dies or the raid ends. | `js/systems/RaidManager.js`, `js/entities/Boss.js` |

### C. 🎯 Animation Stability (Targeting B-001)

| Step | Action | Files Affected |
| :--- | :--- | :--- |
| **C-1** | **Ability "Pedalboard":** Finish implementation. | `*` |
| **C-2** | **Refactor `Enemy.js`:** Remove all remaining animation logic from the `mods/` directory. | `mods/*` |
| **C-3** | **Core Integration:** Introduce robust `loadAnimatedModel` logic directly into `Enemy.js`'s constructor/init. | `js/entities/Enemy.js` |
| **C-4** | **Animation Synchronization:** Implement the animation state machine (Attack/Walk/Idle) directly within `Enemy.update`, relying on the `attackAction.status` and movement speed calculated by `BehaviorSystem.execute`. | `js/entities/Enemy.js` |

### D. ✨ Polish & Cleanup (Targeting B-002, B-003)

| Step | Action | Files Affected |
| :--- | :--- | :--- |
| **D-1** | **Boss Cleanup (B-002):** Explicitly dispose of `moshRing.geometry` and `moshRing.material` inside `Boss.dispose()`. | `js/entities/Boss.js` |

---

## V. 🔮 Future Roadmap (Beyond MVP)

* **Ability Slot Unlocks:** Use `UpgradeRegistry` to gate ability slots (e.g., `mastery` slot is locked until purchased).
* **Affinity System Impact:** Have `magicAffinity` and `techAffinity` apply passive, run-long buffs to the player.
* **Minimap/World Overlay:** Implement a simple map display using the `WorldState` grid data.