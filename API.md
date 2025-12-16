# RiftScape Engine API Reference

**Version:** 3.2  
**Last Updated:** January 2025

This document provides API reference for public interfaces and commonly accessed systems.

---

## Global Access

### Core Systems

**Window Properties:**
```javascript
// Main game instance (set after page load)
window.game              // Game instance

// Static systems (also available as bare globals)
window.WorldState        // WorldState object (world generation and node graph)
window.WorldManager      // WorldManager class (instantiated per Game)
window.HubState          // HubState class (static methods)
window.PSXify            // Material shader patcher function
```

**Bare Const Globals (accessible directly, not on window):**
```javascript
// Core Systems
MetaProgression          // Meta-progression system (data persistence, upgrades, equipment)

// Registries (all follow same pattern: register(), get(), list())
EntityRegistry           // Enemy definitions
AbilityRegistry          // Player abilities
CharacterRegistry        // Playable characters
EquipmentRegistry        // Equippable weapons and trinkets
NPCRegistry             // NPC definitions (dialogue, shops)
UpgradeRegistry          // Meta-progression upgrades
BiomeRegistry            // World biomes
StructureRegistry        // Placeable structures
PickupRegistry           // Loot pickups

// Gameplay Systems
BehaviorSystem           // Enemy AI behaviors
AttackSystem             // Attack pattern execution
```

**Window Properties (Void Entity Systems):**
```javascript
window.VoidBridge        // API communication bridge
window.VoidSystem        // Code execution and action system
window.VoidMemoryStore   // Persistent memory for Void Entity
```

### Game Instance Properties

```javascript
window.game.player           // Player entity
window.game.entities         // Array of all entities
window.game.enemies          // Array of enemy entities
window.game.structures       // Array of player-placed structures
window.game.world            // WorldManager instance
window.game.sound            // SoundSystem instance
window.game.hud              // HUDSystem instance
window.game.raidManager      // RaidManager instance
window.game.dialogueSystem   // DialogueSystem instance
```

---

## Game Class

### Main Methods

#### `new Game()`
Creates and initializes the game. Automatically starts the game loop.

#### `getMouseWorldPosition(): THREE.Vector3`
Converts mouse screen position to world coordinates.

**Returns:** `THREE.Vector3` - World position on Y=0 plane

#### `spawnEnemy(forceType?: string): void`
Spawns an enemy near the player.

**Parameters:**
- `forceType` (optional) - Enemy type ID to force spawn

#### `spawnPickup(x: number, z: number, type: string, value: number): void`
Spawns a pickup item at the specified position.

**Parameters:**
- `x` - X position
- `z` - Z position
- `type` - Pickup type (essence, health, etc.)
- `value` - Pickup value

#### `addKill(): void`
Increments kill counter and updates HUD.

#### `screenShake(intensity: number, duration: number): void`
Triggers screen shake effect.

**Parameters:**
- `intensity` - Shake intensity (0-1)
- `duration` - Duration in seconds

#### `spawnFloatingText(x: number, z: number, text: string, color: number, duration?: number): void`
Spawns floating damage/heal text.

**Parameters:**
- `x` - X position
- `z` - Z position
- `text` - Text to display
- `color` - Hex color (e.g., 0xff0000)
- `duration` (optional) - Display duration in seconds

#### `spawnParticleBurst(x: number, z: number, color: number, count: number): void`
Spawns a particle burst effect.

**Parameters:**
- `x` - X position
- `z` - Z position
- `color` - Hex color
- `count` - Number of particles

#### `safeRemove(entity: Entity, array?: Array): void`
Safely removes an entity from the game.

**Parameters:**
- `entity` - Entity to remove
- `array` (optional) - Specific array to remove from (defaults to entities)

---

## Player Class

### Properties

```javascript
player.health            // PointPool instance
player.actions           // Object with pedalboard actions
player.actions.primary   // Primary attack action
player.actions.secondary // Secondary attack action
player.actions.mobility  // Mobility ability action
player.actions.utility   // Utility ability action
player.actions.mastery   // Mastery ability action
player.speed             // Current movement speed
player.attackDamage      // Current attack damage
player.mesh              // THREE.js mesh
```

### Methods

#### `takeDamage(amount: number): void`
Applies damage to the player.

**Parameters:**
- `amount` - Damage amount

#### `initLoadout(): void`
Initializes player's ability loadout from character definition or custom loadout.

#### `refreshStats(): void`
Recalculates player stats from upgrades and character definition.

---

## Enemy Class

### Properties

```javascript
enemy.def                // Enemy definition from EntityRegistry
enemy.health             // PointPool instance
enemy.attackAction       // Attack action managed by AttackSystem
enemy.currentBehavior    // Current behavior state
enemy.mesh               // THREE.js mesh
enemy.dead               // Boolean - entity is dead
```

### Methods

#### `takeDamage(amount: number): void`
Applies damage to the enemy.

**Parameters:**
- `amount` - Damage amount

#### `playAnim(name: string, fadeTime?: number): void`
Plays an animation with crossfade.

**Parameters:**
- `name` - Animation name
- `fadeTime` (optional) - Crossfade duration in seconds (default: 0.15)

---

## WorldState

### Methods

#### `generate(): void`
Generates the procedural world node graph.

#### `getCurrentNode(): WorldNode`
Gets the current world node.

**Returns:** `WorldNode` object with `id`, `name`, `type`, `level`, `biomeId`, `savageness`

#### `getNode(id: string): WorldNode`
Gets a specific world node by ID.

**Parameters:**
- `id` - Node ID (e.g., 'outpost_0')

**Returns:** `WorldNode` object

---

## WorldManager

### Methods

#### `checkCollision(x: number, z: number, radius: number): boolean`
Checks if a position collides with world geometry.

**Parameters:**
- `x` - X position
- `z` - Z position
- `radius` - Collision radius

**Returns:** `boolean` - true if collision detected

#### `updateFlowField(targetX: number, targetZ: number): void`
Updates the flow field for enemy pathfinding.

**Parameters:**
- `targetX` - Target X position
- `targetZ` - Target Z position

---

## MetaProgression

### Properties

```javascript
MetaProgression.data.essence              // Current essence
MetaProgression.data.currentCharacter    // Current character ID
MetaProgression.data.unlockedCharacters  // Array of unlocked character IDs
MetaProgression.data.customLoadouts      // Object with custom loadouts per character
MetaProgression.data.equipment           // Object with { weapon: string|null, trinkets: [string|null, string|null, string|null] }
MetaProgression.data.upgrades            // Object with owned upgrade IDs
```

### Methods

#### `load(): void`
Loads saved progression from localStorage.

#### `save(): void`
Saves current progression to localStorage.

#### `hasUpgrade(id: string): boolean`
Checks if an upgrade is owned.

**Parameters:**
- `id` - Upgrade ID

**Returns:** `boolean`

#### `buyUpgrade(upgrade: Object): boolean`
Purchases an upgrade.

**Parameters:**
- `upgrade` - Upgrade definition object

**Returns:** `boolean` - true if purchase successful

#### `getStatMods(): Object`
Gets stat modifiers from all owned upgrades.

**Returns:** Object with `maxHealth`, `maxReserve`, `regenRate`, `moveSpeed`, `attackDamage`, `attackSpeed`

#### `setCharacter(id: string): boolean`
Sets the current character.

**Parameters:**
- `id` - Character ID

**Returns:** `boolean` - true if character is unlocked

#### `equipWeapon(equipmentId: string): boolean`
Equips a weapon.

**Parameters:**
- `equipmentId` - Equipment ID from EquipmentRegistry

**Returns:** `boolean` - true if equipment is valid and equipped

#### `unequipWeapon(): boolean`
Unequips the current weapon.

**Returns:** `boolean` - always true

#### `equipTrinket(equipmentId: string, slotIndex: number): boolean`
Equips a trinket to a specific slot.

**Parameters:**
- `equipmentId` - Equipment ID from EquipmentRegistry
- `slotIndex` - Slot index (0-2)

**Returns:** `boolean` - true if equipment is valid and equipped

#### `unequipTrinket(slotIndex: number): boolean`
Unequips a trinket from a specific slot.

**Parameters:**
- `slotIndex` - Slot index (0-2)

**Returns:** `boolean` - true if slot index is valid

#### `getEquipmentStats(): Object`
Gets aggregated stat bonuses from all equipped items.

**Returns:** Object with stat modifiers from weapons and trinkets

---

## Registries

All registries follow the same pattern:

### Methods

#### `register(id: string, definition: Object): void`
Registers a new entry.

**Parameters:**
- `id` - Unique identifier
- `definition` - Definition object

#### `get(id: string): Object`
Gets an entry by ID.

**Parameters:**
- `id` - Entry ID

**Returns:** Definition object or default if not found

#### `list(): Array<Object>`
Gets all registered entries.

**Returns:** Array of definition objects

### Available Registries

- `AbilityRegistry` - Player abilities
- `EntityRegistry` - Enemy definitions
- `CharacterRegistry` - Playable characters
- `UpgradeRegistry` - Meta-progression upgrades
- `EquipmentRegistry` - Equippable weapons and trinkets
- `NPCRegistry` - NPC definitions (dialogue, shop inventories, UI types)
- `BiomeRegistry` - World biomes
- `StructureRegistry` - Placeable structures
- `PickupRegistry` - Loot pickups

---

## ModManager

### Methods

#### `register(name: string, version: string, initFn: Function): void`
Registers a mod.

**Parameters:**
- `name` - Mod name
- `version` - Mod version string
- `initFn` - Initialization function `(game, mods) => {}`

#### `patch(target: Object, methodName: string, wrapper: Function): void`
Patches a class method.

**Parameters:**
- `target` - Target object/class
- `methodName` - Method name to patch
- `wrapper` - Wrapper function `(original, ...args) => {}`

#### `on(event: string, callback: Function): void`
Subscribes to an event.

**Parameters:**
- `event` - Event name ('update', 'gameStart', etc.)
- `callback` - Callback function

#### `trigger(event: string, ...args): void`
Triggers an event.

**Parameters:**
- `event` - Event name
- `...args` - Arguments to pass to callbacks

---

## SoundSystem

### Methods

#### `loadMusic(id: string, path: string): Promise<void>`
Loads a music track.

**Parameters:**
- `id` - Music ID
- `path` - Path to audio file

#### `playMusic(id: string, loop?: boolean): void`
Plays a music track.

**Parameters:**
- `id` - Music ID
- `loop` (optional) - Whether to loop (default: true)

#### `stopMusic(fadeTime?: number): void`
Stops current music with optional fade.

**Parameters:**
- `fadeTime` (optional) - Fade duration in seconds (default: 0.5)

#### `play(id: string): void`
Plays a procedural sound effect.

**Parameters:**
- `id` - Sound ID ('shotgun', 'laser', 'swipe', 'hit', 'build', 'error', 'turret')

---

## Common Patterns

### Accessing Game from Entity

```javascript
class MyEntity {
    constructor(game) {
        this.game = game;
        // Access other entities
        this.game.player
        this.game.enemies
        this.game.entities
    }
}
```

### Adding New Entity

```javascript
const entity = new MyEntity(this.game, x, z);
this.game.entities.push(entity);
this.game.scene.add(entity.mesh);
```

### Registering New Content

```javascript
EntityRegistry.register('my_enemy', {
    name: 'My Enemy',
    color: 0xff0000,
    speed: { min: 2.0, max: 3.0 },
    health: { active: 5, reserve: 10 },
    behavior: 'chase',
    attack: { type: 'melee', range: 1.5 }
});
```

---

*This API reference covers the most commonly accessed interfaces. For detailed implementation, see source code and ARCHITECTURE.md.*

