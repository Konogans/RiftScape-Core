# `STATUS.md`

## 🎸 RiftScape Engine Status & Roadmap

This document outlines the architecture, current state, and remaining development priorities for the RiftScape core engine (v3.0).

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
* **Animation System:** ✅ **COMPLETE** - Enemy and player animation synchronization integrated into core.
* **Sound System:** ✅ **COMPLETE** - Music loading and procedural SFX fully implemented.

---

## III. 🚧 Known Bugs

All previously documented bugs have been resolved:

| ID | Status |
| :--- | :--- |
| **B-001** | ✅ **FIXED** - Animation system integrated into core with proper sync. |
| **B-002** | ✅ **FIXED** - Boss memory leak resolved, proper cleanup implemented. |
| **B-003** | ✅ **FIXED** - Projectile collision now uses entity radius properties. |

---

## IV. ➡️ Remaining Work: Pedalboard Customization UI

The **Pedalboard Customization** system allows players to customize their ability loadouts via the Architect NPC dialogue in the Outpost. This is the final feature needed to complete the MVP.

### 🎯 Pedalboard UI Implementation

| Step | Action | Files Affected |
| :--- | :--- | :--- |
| **1** | **UI System:** Create the Pedalboard customization interface accessible from Architect NPC dialogue. | `js/ui/DialogueSystem.js`, `js/ui/HUDSystem.js` (or new `PedalboardUI.js`) |
| **2** | **Loadout Management:** Implement ability slot selection UI (drag-and-drop or click-to-select from available abilities). | `js/entities/Player.js`, `js/data/CharacterRegistry.js` |
| **3** | **Persistence:** Save custom loadouts to `MetaProgression` and load them when entering the Rift. | `js/core/HubState.js` or `MetaProgression` |
| **4** | **Validation:** Ensure custom loadouts respect character restrictions and slot availability. | `js/entities/Player.js`, `js/data/AbilityRegistry.js` |

### Current State

The Pedalboard system is **partially implemented**:
- ✅ Ability slots are defined and functional (`primary`, `secondary`, `mobility`, `utility`, `mastery`)
- ✅ Characters have default loadouts in `CharacterRegistry.js`
- ✅ `Player.initLoadout()` correctly loads abilities from character definitions
- ⚠️ **Missing:** UI for players to customize loadouts in the Outpost

---

## V. 🔮 Future Roadmap (Beyond MVP)

* **Ability Slot Unlocks:** Use `UpgradeRegistry` to gate ability slots (e.g., `mastery` slot is locked until purchased).
* **Affinity System Impact:** Have `magicAffinity` and `techAffinity` apply passive, run-long buffs to the player.
* **Minimap/World Overlay:** Implement a simple map display using the `WorldState` grid data.
* **Loadout Presets:** Allow players to save and name multiple loadout configurations per character.

---

*Last Updated: January 2025*
