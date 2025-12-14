/**
 * EntityRegistry.js (UPDATED)
 * Now includes behavior and attack patterns as DATA, not logic.
 * 
 * Structure:
 * - behavior: string ID interpreted by BehaviorSystem
 * - behaviorSwitch: optional conditions to change behavior
 * - attack: { type, ...params } interpreted by AttackSystem
 */

const EntityRegistry = {
    enemies: {},
    register(type, definition) { this.enemies[type] = definition; },
    get(type) { return this.enemies[type] || this.enemies['default']; },
    getRandomEnemy() {
        const types = Object.keys(this.enemies);
        const type = types[Math.floor(Math.random() * types.length)];
        return { type, definition: this.enemies[type] };
    },
    list() { return Object.keys(this.enemies); }
};

// =============================================================================
// ENEMY DEFINITIONS
// =============================================================================

EntityRegistry.register('default', {
    name: 'Riftling',
    color: 0xff4444,
    emissive: 0x441111,
    scale: 1,
    speed: { min: 1.5, max: 2.5 },
    health: { active: 3, reserve: 5 },

    // MODEL (loaded by Enemy.loadModel)
    model: 'models/Riftling.glb',

    // BEHAVIOR (interpreted by BehaviorSystem)
    behavior: 'chase',

    // ATTACK (interpreted by AttackSystem)
    attack: { type: 'melee', range: 1.2 },
    attackCooldown: 1500,
    attackTiming: { windup: 300, action: 100, cooldown: 400 },

    // LOOT (interpreted by LootSystem or spawn logic)
    loot: {
        essence: { chance: 0.8, min: 1, max: 2 },
        health: { chance: 0.1, value: 1 }
    },

    lore: 'A minor creature drawn through the rifts.'
});

EntityRegistry.register('brute', {
    name: 'Rift Brute',
    color: 0x884422,
    emissive: 0x331111,
    scale: 1.4,
    speed: { min: 0.8, max: 1.2 },
    health: { active: 8, reserve: 12 },

    model: {
        path: 'models/Brute.glb',
        scale: 1.0,
        animations: {
            idle: 'Idle',
            walk: 'Walking',
            run: 'Running',
            attack: 'Attack',
            death: 'Dead'
        }
    },

    behavior: 'brute',

    attack: { type: 'melee', range: 1.5 },
    attackCooldown: 2000,
    attackTiming: { windup: 500, action: 150, cooldown: 500 },
    damage: 2,

    loot: {
        essence: { chance: 1.0, min: 3, max: 5 },
        health: { chance: 0.3, value: 2 },
        reserve: { chance: 0.15, value: 1 }
    },

    lore: 'A hulking mass of rift-stuff.'
});

EntityRegistry.register('swift', {
    name: 'Flicker',
    color: 0x44ffaa,
    emissive: 0x114433,
    scale: 0.7,
    speed: { min: 3, max: 4 },
    health: { active: 1, reserve: 2 },
	
    model: 'models/Swift.glb',
    
    behavior: 'swift',
    
    attack: { type: 'melee', range: 1.0 },
    attackCooldown: 800,
    attackTiming: { windup: 150, action: 50, cooldown: 200 },
    
    loot: {
        essence: { chance: 0.6, min: 1, max: 1 },
        speed: { chance: 0.05, duration: 3 }
    },
    
    lore: 'A darting fragment.'
});

EntityRegistry.register('spitter', {
    name: 'Rift Spewer',
    color: 0xaa44ff,
    emissive: 0x331144,
    scale: 1.1,
    speed: { min: 1, max: 1.5 },
    health: { active: 2, reserve: 4 },
	
    model: {
        path: 'models/Spitter.glb',
        scale: 1.0,
        animations: {
            idle: 'Idle',
            walk: 'Unsteady_Walk',
            run: 'Running',
            attack: 'Skill_01',
            death: 'Dead'
        }
    },
    
    behavior: 'ranged_kite',
    
    attack: { 
        type: 'ranged', 
        range: 5.0,
        projectileSpeed: 8 
    },
    attackCooldown: 2500,
    attackTiming: { windup: 600, action: 100, cooldown: 400 },
    
    loot: {
        essence: { chance: 0.9, min: 2, max: 3 }
    },
    
    lore: 'Keeps its distance.'
});

// EXAMPLE: More complex enemy with behavior switching
EntityRegistry.register('berserker', {
    name: 'Rift Berserker',
    color: 0xff2200,
    emissive: 0x661100,
    scale: 1.2,
    speed: { min: 2.0, max: 2.5 },
    health: { active: 5, reserve: 8 },
    
    // Primary behavior
    behavior: 'chase',
    // Switch behavior when conditions met
    behaviorSwitch: {
        healthBelow: 0.3,  // When health drops below 30%
        newBehavior: 'flee',
        revertAfter: 3.0   // Seconds, then back to primary
    },
    
    attack: { type: 'melee', range: 1.3 },
    attackCooldown: 1200,
    attackTiming: { windup: 200, action: 100, cooldown: 300 },
    damage: 2,
    
    lore: 'Driven mad by rift exposure.'
});

// EXAMPLE: Burst attack enemy
EntityRegistry.register('artillery', {
    name: 'Rift Artillery',
    color: 0xff44aa,
    emissive: 0x441133,
    scale: 1.3,
    speed: { min: 0.5, max: 0.8 },
    health: { active: 4, reserve: 6 },
    
    behavior: 'ranged_kite',
    
    attack: { 
        type: 'burst',
        range: 6.0,
        projectileCount: 3,
        spread: 0.3,
        projectileSpeed: 6
    },
    attackCooldown: 3500,
    attackTiming: { windup: 800, action: 200, cooldown: 600 },
    
    lore: 'Fires in volleys.'
});

EntityRegistry.register('headliner', {
    name: 'The Headliner',
    color: 0x111111,
    emissive: 0xff0000,
    scale: 1.8, // REDUCED (was 2.5)
    speed: { min: 4, max: 4 }, 
    health: { active: 300, reserve: 0 }, // BUFFED (was 100)
    damage: 3,
    loot: { essence: { chance: 1.0, value: 500 } },
    attackRange: 2.0, // Reduced slightly to match scale
	
	health: { active: 400, reserve: 400 },
    
    attack: { type: 'melee', range: 2.5 },
    attackCooldown: 2000,
    attackTiming: { windup: 500, action: 200, cooldown: 1000 }
});