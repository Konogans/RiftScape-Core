# `STATUS.md`

## 🎸 RiftScape Engine Status & Roadmap

This document outlines the architecture, current state, and remaining development priorities for the RiftScape core engine (v3.2).

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
* **Equipment System:** ✅ **COMPLETE** - Weapon slot (1) and trinket slots (3) with model attachment support. Equipment persists via `MetaProgression` and modifies player stats. Equipment drops from all enemy types with rarity-based loot tables. Equipment can be sold to the Trader NPC for essence.
* **Persistence:** Meta-Progression for Upgrades, Essence, Character Unlocks, Custom Loadouts, and Equipment.
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

## IV. ✅ MVP Complete

All core MVP features have been implemented:

* ✅ **Pedalboard Customization UI** - Players can customize ability loadouts via "The Tinkerer" NPC in the Outpost
* ✅ **Equipment System** - Weapon and trinket slots with full UI, persistence, enemy drops, and trading
* ✅ **Animation System** - Enemy and player animation synchronization
* ✅ **Sound System** - Music loading and procedural SFX
* ✅ **All Bugs Resolved** - All documented bugs have been fixed

The MVP is **complete** and ready for playtesting and content expansion.

---

## V. 🔮 Future Roadmap (Beyond MVP)

* **Ability Slot Unlocks:** Use `UpgradeRegistry` to gate ability slots (e.g., `mastery` slot is locked until purchased).
* **Affinity System Impact:** Have `magicAffinity` and `techAffinity` apply passive, run-long buffs to the player.
* **Minimap/World Overlay:** Implement a simple map display using the `WorldState` grid data.
* **Loadout Presets:** Allow players to save and name multiple loadout configurations per character.
* **Trinket Visual Attachments:** Extend trinket system to support model attachments (e.g., attach to character hips).
* **Equipment Crafting:** Add equipment crafting system for advanced item creation.

---

*Last Updated: January 2025*
