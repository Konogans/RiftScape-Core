# RiftScape Engine Architecture

**Version:** 3.2  
**Last Updated:** January 2025

This document provides a comprehensive overview of the RiftScape engine's architecture, design patterns, and system organization.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [System Architecture](#system-architecture)
3. [Global State Management](#global-state-management)
4. [Registry Pattern](#registry-pattern)
5. [Entity System](#entity-system)
6. [Game Loop](#game-loop)
7. [File Organization](#file-organization)
8. [Extension Points](#extension-points)

---

## Core Philosophy

**"Punk Rock Coding"** - Prioritize velocity and creative flow over architectural purity.

### Key Principles

- **Zero Build Step** - Pure vanilla JavaScript, runs directly in browser
- **Global State** - Core systems accessible via `window` for immediate access
- **Data-Driven** - Content separated from logic via Registry pattern
- **Porous Architecture** - Hot-swappable mods enable live debugging
- **Terse & Functional** - Code should be concise and readable

---

## System Architecture

### Core Systems

The engine is organized into distinct systems, each handling a specific domain:

| System | File | Responsibility |
|--------|------|----------------|
| **Game** | `js/core/Game.js` | Main game loop, scene management, state coordination |
| **WorldManager** | `js/core/WorldManager.js` | Chunk loading, collision detection, flow field pathfinding |
| **WorldState** | `js/core/WorldState.js` | Procedural world generation, node graph, biome management |
| **Input** | `js/core/Input.js` | Keyboard and mouse input handling |
| **SoundSystem** | `js/core/SoundSystem.js` | Audio playback (music + procedural SFX) |
| **ModManager** | `js/core/ModManager.js` | Hot-swappable mod system, runtime patching |
| **HubState** | `js/core/HubState.js` | Outpost structure persistence |

### Gameplay Systems

| System | File | Responsibility |
|--------|------|----------------|
| **BehaviorSystem** | `js/systems/BehaviorSystem.js` | Enemy AI behaviors (chase, patrol, etc.) |
| **AttackSystem** | `js/systems/AttackSystem.js` | Attack pattern execution, damage timing |
| **LootSystem** | `js/systems/LootSystem.js` | Loot drop logic (handled via Entity definitions) |
| **RaidManager** | `js/systems/RaidManager.js` | Wave-based raid system, boss spawning |
| **VisualFactory** | `js/systems/VisualFactory.js` | Particle effects, visual feedback |

### UI Systems

| System | File | Responsibility |
|--------|------|----------------|
| **HUDSystem** | `js/ui/HUDSystem.js` | Canvas-based HUD rendering (health, stats, compass) |
| **DialogueSystem** | `js/ui/DialogueSystem.js` | NPC dialogue, shop UI, Pedalboard customization |

---

## Global State Management

### Current Global Variables

The engine uses global state for core systems:

**Window Properties:**
```javascript
window.game          // Main Game instance (set after page load)
window.WorldState    // WorldState object (const global, also on window)
window.WorldManager  // WorldManager class (instantiated per Game)
window.HubState      // HubState class (static methods)
window.PSXify        // Material shader patcher function
```

**Bare Const Globals (not on window, accessible directly):**
```javascript
MetaProgression      // Meta-progression system (const global)
EntityRegistry       // Enemy definitions registry
AbilityRegistry      // Player abilities registry
CharacterRegistry    // Playable characters registry
EquipmentRegistry    // Equippable items registry
NPCRegistry         // NPC definitions registry
UpgradeRegistry     // Meta-progression upgrades registry
BiomeRegistry       // World biomes registry
StructureRegistry   // Placeable structures registry
PickupRegistry      // Loot pickups registry
BehaviorSystem      // Enemy AI system
AttackSystem        // Attack pattern system
```

**Window Properties (Void Entity Systems):**
```javascript
window.VoidBridge          // Void Entity API bridge
window.VoidSystem          // Void Entity code execution system
window.VoidMemoryStore     // Void Entity memory persistence
```

### Access Patterns

**From Game Instance:**
```javascript
this.game.player          // Player entity
this.game.entities        // All entities array
this.game.world          // WorldManager instance
this.game.sound          // SoundSystem instance
```

**From Global State:**
```javascript
window.WorldState.getCurrentNode()  // Static method
window.HubState.save(entities)      // Static method
```

### Namespace Consolidation (Implemented)

For better scalability, all core systems are now available via a consolidated namespace:

```javascript
window.RiftScape = {
    Game: Game,
    WorldState: WorldState,
    WorldManager: WorldManager,
    HubState: HubState,
    ModManager: ModManager,
    PSXify: PSXify,
    // Registries
    AbilityRegistry: AbilityRegistry,
    EntityRegistry: EntityRegistry,
    CharacterRegistry: CharacterRegistry,
    UpgradeRegistry: UpgradeRegistry,
    BiomeRegistry: BiomeRegistry,
    StructureRegistry: StructureRegistry,
    PickupRegistry: PickupRegistry,
    // Systems
    BehaviorSystem: BehaviorSystem,
    AttackSystem: AttackSystem,
    MetaProgression: MetaProgression
};
```

**Note:** `EquipmentRegistry` and `NPCRegistry` are defined as `const` globals (not on `window`) and are accessible directly. They are not currently in the `window.RiftScape` namespace, but can be accessed as bare globals: `EquipmentRegistry.get('battleaxe')` or `NPCRegistry.get('pedalboard')`.

**Void Entity Systems:** `VoidBridge`, `VoidSystem`, and `VoidMemoryStore` are available on `window` (e.g., `window.VoidBridge`) for Void Entity functionality.

**Backward Compatibility:** All existing `window.*` access still works. New code should prefer `window.RiftScape.*` to reduce global namespace pollution.

---

## Registry Pattern

### Overview

All game content is separated from logic using Registry objects. This enables:
- Easy content addition without code changes
- Hot-swappable content via mods
- Data-driven game design

### Registry Structure

All registries follow this pattern:

```javascript
const SomeRegistry = {
    items: {},
    register(id, definition) {
        this.items[id] = { id, ...definition };
    },
    get(id) {
        return this.items[id] || this.items['default'];
    },
    list() {
        return Object.values(this.items);
    }
};
```

### Available Registries

| Registry | File | Content Type |
|----------|------|--------------|
| **AbilityRegistry** | `js/data/AbilityRegistry.js` | Player abilities (swipe, dash, heal, etc.) |
| **EntityRegistry** | `js/data/EntityRegistry.js` | Enemy definitions (riftling, spitter, etc.) |
| **CharacterRegistry** | `js/data/CharacterRegistry.js` | Playable characters (wanderer, smith, etc.) |
| **UpgradeRegistry** | `js/data/UpgradeRegistry.js` | Meta-progression upgrades |
| **EquipmentRegistry** | `js/data/EquipmentRegistry.js` | Equippable weapons and trinkets |
| **NPCRegistry** | `js/data/NPCRegistry.js` | NPC definitions (dialogue, shop inventories, UI types) |
| **BiomeRegistry** | `js/data/BiomeRegistry.js` | World biomes (rift_wastes, sanctuary, etc.) |
| **StructureRegistry** | `js/data/StructureRegistry.js` | Placeable structures (wall, turret) |
| **PickupRegistry** | `js/data/PickupRegistry.js` | Loot pickups (essence, health) |

### Adding New Content

**Example: Adding a new enemy**

```javascript
// In js/data/EntityRegistry.js
EntityRegistry.register('my_enemy', {
    name: 'My Enemy',
    color: 0xff0000,
    speed: { min: 2.0, max: 3.0 },
    health: { active: 5, reserve: 10 },
    behavior: 'chase',
    attack: { type: 'melee', range: 1.5 },
    attackCooldown: 2000,
    model: 'models/MyEnemy.glb'
});
```

No code changes needed - the enemy will work with existing systems.

---

## Entity System

### Entity Lifecycle

All entities follow a consistent lifecycle pattern:

```javascript
class MyEntity {
    constructor(game, x, z, ...args) {
        // 1. Initialize properties
        this.game = game;
        this.dead = false;
        this.shouldRemove = false;
        
        // 2. Load definition from registry
        this.def = SomeRegistry.get(type);
        
        // 3. Initialize mesh/visuals
        this.initMesh(x, z);
        
        // 4. Initialize systems (health, attack, etc.)
        this.initHealth();
        this.initAttack();
    }
    
    update(deltaTime, elapsed) {
        if (this.dead) return;
        
        // Update logic here
        this.health.update(deltaTime);
    }
    
    dispose() {
        // Cleanup THREE.js resources
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
            });
        }
    }
}
```

### Entity Types

| Entity | File | Purpose |
|--------|------|---------|
| **Player** | `js/entities/Player.js` | Player character, pedalboard system |
| **Enemy** | `js/entities/Enemy.js` | Base enemy class, delegates to systems |
| **Boss** | `js/entities/Boss.js` | Boss enemy with special attack patterns |
| **NPC** | `js/entities/NPC.js` | Non-player characters in hub |
| **Structure** | `js/entities/Structure.js` | Placeable structures (walls, turrets) |
| **Pickup** | `js/entities/Pickup.js` | Loot items (essence, health) |
| **Portal** | `js/entities/Portal.js` | Biome transition portals |
| **RiftGate** | `js/entities/RiftGate.js` | Main objective in raids |
| **Projectile** | `js/entities/Projectile.js` | Enemy projectiles |
| **PlayerProjectile** | `js/entities/PlayerProjectile.js` | Player projectiles (homing, etc.) |

### Entity State Flags

- `dead` - Entity is dead/destroyed (stops updating)
- `shouldRemove` - Entity should be removed from game (cleanup pending)

---

## Game Loop

### Main Loop Structure

```javascript
// In Game.js
loop() {
    const deltaTime = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    
    // 1. Input
    this.input.update();
    
    // 2. Update systems
    this.update(deltaTime, elapsed);
    
    // 3. Render
    this.renderer.render(this.scene, this.camera);
    
    // 4. Request next frame
    requestAnimationFrame(() => this.loop());
}
```

### Update Order

1. **Input System** - Process keyboard/mouse
2. **World Systems** - WorldManager, WorldState
3. **Entities** - All entities update in order
4. **Systems** - BehaviorSystem, AttackSystem execute
5. **UI** - HUDSystem, DialogueSystem update
6. **Cleanup** - Remove dead entities

### Performance Considerations

- Flow field pathfinding runs at 5Hz (not every frame)
- Chunk loading/unloading happens asynchronously
- Entity arrays are filtered once per frame (not per entity)

---

## File Organization

### Current Structure

```
js/
├── core/           # Core engine systems
│   ├── Game.js
│   ├── WorldManager.js
│   ├── WorldState.js
│   ├── Input.js
│   ├── SoundSystem.js
│   ├── ModManager.js
│   ├── HubState.js
│   └── Utils.js
├── systems/        # Gameplay systems
│   ├── BehaviorSystem.js
│   ├── AttackSystem.js
│   ├── LootSystem.js
│   ├── RaidManager.js
│   └── VisualFactory.js
├── entities/       # Entity classes
│   ├── Player.js
│   ├── Enemy.js
│   ├── Boss.js
│   └── ...
├── data/           # Registry definitions
│   ├── AbilityRegistry.js
│   ├── EntityRegistry.js
│   ├── CharacterRegistry.js
│   └── ...
└── ui/             # UI systems
    ├── HUDSystem.js
    └── DialogueSystem.js
```

### Future Organization (for scale)

As the codebase grows, consider sub-organizing:

```
js/
├── systems/
│   ├── combat/     # Combat-related systems
│   ├── world/       # World-related systems
│   └── meta/        # Meta-progression systems
```

---

## Extension Points

### Modding System

The ModManager provides three extension mechanisms:

1. **Registry Injection** - Add new content to registries
2. **Method Patching** - Override existing class methods
3. **Event Hooks** - Subscribe to game events (update, gameStart, etc.)

See `mods/mod_template.js` for examples.

### Adding New Systems

To add a new system:

1. Create class in `js/systems/YourSystem.js`
2. Instantiate in `Game.js` constructor
3. Call `update()` in `Game.update()` if needed
4. Access via `this.game.yourSystem`

### Adding New Entity Types

1. Create class in `js/entities/YourEntity.js`
2. Follow Entity lifecycle pattern
3. Add to `this.game.entities` array
4. Add to scene: `this.game.scene.add(entity.mesh)`

---

## Performance Characteristics

### Current Scale

- **Lines of Code:** ~6,500
- **Entity Limit:** No hard limit, but performance degrades ~100+ entities
- **Chunk System:** Efficient, handles large worlds
- **Memory:** Proper cleanup via `dispose()` methods

### Optimization Strategies

- Chunk-based world loading prevents memory bloat
- Flow field pathfinding throttled to 5Hz
- Entity arrays filtered once per frame
- THREE.js resource cleanup in `dispose()` methods

---

## Documentation

### Available Documentation

- **ARCHITECTURE.md** (this file) - System architecture and design patterns
- **API.md** - Public API reference for all systems
- **CONTRIBUTING.md** - Contributor guidelines and coding standards
- **STATUS.md** - Current development status and roadmap
- **IDEAS.md** - Future feature backlog

### Code Documentation

**JSDoc Annotations:** Critical APIs now have JSDoc annotations:
- `Game` class - Main game loop and coordination
- `Player` class - Player entity and pedalboard system
- `Enemy` class - Base enemy entity
- `BehaviorSystem` - AI behavior execution
- `AttackSystem` - Attack pattern execution
- `WorldState` - World generation methods

**Inline Comments:** Complex algorithms are documented:
- Flow field pathfinding (BFS algorithm)
- Bilinear interpolation for smooth pathfinding
- Entity spawning with collision checking
- Entity cleanup and lifecycle management

---

## Future Considerations

### Completed Improvements

1. ✅ **Namespace Consolidation** - Implemented `window.RiftScape.*` wrapper (backward compatible)
2. ✅ **JSDoc Annotations** - Added to critical APIs for better IDE support
3. ✅ **Architecture Documentation** - Comprehensive system documentation created
4. ✅ **API Documentation** - Public interface reference available

### Remaining Scalability Improvements

1. **Dependency Loader** - Simple script loader to replace manual `<script>` tags (optional)
2. **Testing Infrastructure** - Manual testing becomes bottleneck at scale (future consideration)
3. **File Organization** - Current structure works well; consider sub-folders at 15k+ lines

### Architecture Evolution

The current architecture should scale well to ~15k lines. Beyond that:
- Namespace consolidation is in place ✅
- JSDoc annotations added for type safety ✅
- File organization is clear and maintainable
- Consider simple dependency management if script loading becomes unwieldy

---

*This document is a living guide. Update as the architecture evolves.*

