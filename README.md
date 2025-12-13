-----

# `README.md`

# 🎸 RiftScape Core Engine

A vanilla JavaScript, browser-based, **"Punk Rock Coding"** engine built on THREE.js (r147). RiftScape is a fast-paced, grid-based action RPG that also shares a blend of survival and survivor elements.

## 🚀 Getting Started

RiftScape requires **NO** local build steps, compilers, or Node.js dependencies. It runs directly in the browser via a local server.

### Prerequisites

1.  Python 3 (Pre-installed on most modern systems).
2.  A modern web browser (Chrome, Firefox, Edge).

### Running the Game

1.  Navigate to the project's root directory: `C:\...\RiftScape-core`
2.  Execute the server batch file:
    ```bash
    .\run_server.bat
    ```
3.  Open your web browser and go to: `http://localhost:8000`

-----

## 🛠️ Project Architecture & Philosophy

The RiftScape engine is defined by its core philosophy: **"Punk Rock Coding"**—prioritizing velocity and frictionlessness over architectural boilerplate.

| Pattern | Description | Key Files |
| :--- | :--- | :--- |
| **Vanilla Stack** | Pure JavaScript (ES6+). No `import`, `export`, Webpack, or TypeScript. Assumes global scope for managers. | `index.html`, `js/core/Game.js` |
| **Global State** | Core systems are globally accessible (e.g., `window.Game`, `window.WorldState`). Classes assume dependencies exist. | `js/core/Game.js`, `js/core/Utils.js` |
| **Registry Pattern** | Game content (Abilities, Enemies, Upgrades) is stored in static JSON-like objects, decoupling data from game logic. | `js/data/*.js` |
| **Visuals** | THREE.js r147 with custom shader logic (`PSXify` in `Utils.js`) to enforce a low-fidelity, vertex-snapped retro aesthetic. | `js/core/Utils.js` |
| **Modding** | The **ModManager** allows hot-swapping `.js` files via Drag-and-Drop when in the Outpost (Hub), enabling runtime patching and content injection. | `js/core/ModManager.js`, `js/core/Game.js` |

-----

## 🎯 Core Game Systems

| System | Concept | Unique Implementation |
| :--- | :--- | :--- |
| **Health** | **PointPool** | Dual-pool "Wound" system: `Active` HP (Shield/Current) is limited by `Reserve` (Max HP/Soul). Damage reduces both pools. |
| **Actions** | **Pedalboard** | Player abilities defined in `AbilityRegistry.js` and loaded into slots (`primary`, `mobility`, etc.). Managed by the `Action` class (Windup/Action/Cooldown phases). |
| **World** | **Spatial Grid** | Efficient, dynamic chunk loading and collision management (`WorldManager.js`). Uses a **Flow Field** for enemy pathfinding around obstacles. |
| **Defense** | **HubState** | Persistence layer for player-placed structures (`Wall`, `Turret`) built in the Outpost, crucial for Raid defense. |

-----

## 🌎 World Coordinate System

RiftScape follows the standard THREE.js convention, but applies it to a top-down action game context:

  * **X-Axis:** Represents **East/West** (Lateral Movement).
  * **Y-Axis:** Represents **Up/Down** (Vertical Height).
      * *Note: All core gameplay takes place on the Y=0 plane.*
  * **Z-Axis:** Represents **North/South** (Forward/Backward Movement).
      * *Note: The camera is typically placed looking down the positive Z-axis.*

-----

## 🎸 The Power of Live Mod-Debugging

The ModManager combined with a global, non-module architecture isn't just a quirky constraint—it's a high-velocity, low-friction live debugging and tweaking tool.

This approach, where you treat temporary .js files dropped into the running game as immediate debugging scripts, offers several unique advantages:

| Feature | Advantage in Debugging/Tweaking | Example Usage |
| :--- | :--- | :--- |
| **Runtime Patching** (`mods.patch`) | Modify class methods (like `Enemy.update` or `Player.takeDamage`) *while the game is running* to isolate variables, bypass buggy code, or inject logging without stopping and restarting the server. | Patch `RaidManager.spawnBoss` to force a specific enemy type for testing, or patch `Player.takeDamage` to return `0` (God Mode). |
| **Global Access** (`window.Game`) | Immediately access and mutate core game state from a simple, single-line script dropped into the game. | `window.Game.player.health.reserve += 500;` or `window.Game.entities.forEach(e => e.mesh.visible = false);` |
| **On-the-Fly FX** (`mods.on('update')`) | Hook into the main game loop to visualize data (e.g., entity velocity vectors, collision radiuses) or perform frame-by-frame stress testing. | In `cyber_katana.js`, the mod hooks `update` to make the fog pulse. This is ideal for visualizing runtime variables. |
| **Immediate Content Injection** | Add new abilities, enemies, or loot definitions on the fly to test a concept in seconds. | Drop in the `cyber_katana.js` mod to gain a custom primary attack instantly. |

-----

## 💻 Development Checklist (TODO/BUGS)

For the current development status, please consult the `STATUS.md` file.

| Status | Item |
| :--- | :--- |
| **CRITICAL** | **Animation Integration:** Player/Enemy models need stable animation synchronization, starting with Player as the base case. |
| **TODO** | **Custom Sounds:** Upgrade `SoundSystem.js` to support loading external audio files (e.g., MP3 boss theme). |
| **BUGS** | **B-002:** Boss `moshRing` memory leak in `dispose()` method. |

-----

## 🤝 Contribution

Contributions may eventually be accepted, provided they strictly adhere to the **"Punk Rock Coding"** philosophy, and the project's creative vision.

  * **Do Not** introduce external dependencies, build tools, or transpilers.
  * **Use** the `ModManager.patch()` utility for minimal, surgical changes to existing class functionality.
  * **Register** new content (enemies, abilities) directly into the relevant `js/data/*Registry.js` file.

*Thank you for contributing to the RiftScape Engine.*
