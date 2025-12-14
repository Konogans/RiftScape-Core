# 🎸 RiftScape Core Engine

A vanilla JavaScript, browser-based, **"Punk Rock Coding"** engine built on THREE.js (r147). RiftScape is a fast-paced, grid-based action RPG that also shares a blend of survival and survivor elements.

**🎮 [Play RiftScape](https://riftscape.io)** | **📦 [itch.io Page](https://wizewizardgames.itch.io/riftscape)** | **💻 [Source Code](https://github.com/Konogans/RiftScape-Core)**

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

## 💻 Development Status

For detailed status information, please consult the `STATUS.md` file.

| Status | Item |
| :--- | :--- |
| **MVP Status** | **~95% Complete** - Core systems fully functional, only Pedalboard UI customization remains. |
| **Animation System** | ✅ **COMPLETE** - Enemy and player animation synchronization integrated. |
| **Sound System** | ✅ **COMPLETE** - Music loading and procedural SFX fully implemented. |
| **Bugs** | ✅ **ALL RESOLVED** - All documented bugs have been fixed. |
| **Remaining Work** | **Pedalboard Customization UI** - Allow players to customize ability loadouts in the Outpost. |

-----

## 🤝 Contribution

Contributions are welcome! This project follows the **"Punk Rock Coding"** philosophy—prioritizing velocity and creative flow over architectural purity.

### Guidelines

  * **Do Not** introduce external dependencies, build tools, or transpilers.
  * **Use** the `ModManager.patch()` utility for minimal, surgical changes to existing class functionality.
  * **Register** new content (enemies, abilities) directly into the relevant `js/data/*Registry.js` file.
  * **Follow** the Registry Pattern—separate data from logic.
  * **Maintain** the global state pattern (`window.Game`, `window.WorldState`).

### For AI Contributors

See `CONTRIBUTING.md` for detailed style guidelines and architecture patterns.

### How to Contribute

1. Fork the repository
2. Make your changes following the guidelines above
3. Submit a pull request with a clear description

*Thank you for contributing to the RiftScape Engine.*

-----

## 📜 License

### Code
All source code in this repository is licensed under the MIT License.

Copyright (c) 2025 Wize Wizard Games

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Assets
All non-code assets (art, audio, models, textures) are licensed under
Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0),
unless otherwise stated.