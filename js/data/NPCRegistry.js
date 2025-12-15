/**
 * NPCRegistry.js
 * Defines all NPCs and their dialogue/shop data.
 * 
 * This registry decouples NPC data from DialogueSystem logic,
 * following the Registry pattern used throughout the codebase.
 */

const NPCRegistry = {
    npcs: {},
    
    register(id, definition) {
        this.npcs[id] = { id, ...definition };
    },
    
    get(id) {
        return this.npcs[id] || null;
    },
    
    getByRole(role) {
        return Object.values(this.npcs).filter(npc => npc.role === role);
    },
    
    list() {
        return Object.values(this.npcs);
    }
};

// ============================================
// NPC DEFINITIONS
// ============================================

// 1. Smith (Garrick) - Tech upgrades
NPCRegistry.register('smith', {
    name: 'Garrick',
    role: 'smith',
    greeting: 'The flesh is weak. Improve the hardware.',
    characterId: 'smith', // Maps to CharacterRegistry
    affinityType: 'tech', // Gives tech affinity on purchase
    shopInventory: [
        'dash_unlock',
        'vitality1',
        'vitality2',
        'reserves1',
        'tech_armor',
        'tech_speed',
        'swiftness1'
    ],
    uiType: 'shop' // Uses standard shop UI
});

// 2. Scribe (Elara) - Magic upgrades
NPCRegistry.register('scribe', {
    name: 'Elara',
    role: 'scribe',
    greeting: 'Knowledge is power. Expand your mind.',
    characterId: 'scribe',
    affinityType: 'magic',
    shopInventory: [
        'slam_unlock',
        'magic_regen',
        'magic_burst'
    ],
    uiType: 'shop'
});

// 3. Architect (Kael) - Structure/defense upgrades
NPCRegistry.register('builder', {
    name: 'Kael',
    role: 'builder',
    greeting: 'The battlefield is a canvas. Build your defenses.',
    characterId: 'builder',
    affinityType: null, // No affinity bonus
    shopInventory: [
        'dash_unlock' // Placeholder - add actual builder upgrades
    ],
    uiType: 'shop'
});

// 4. The Tinkerer - Pedalboard customization
NPCRegistry.register('pedalboard', {
    name: 'The Tinkerer',
    role: 'pedalboard',
    greeting: 'Customize your loadout. Each slot defines your combat style.',
    characterId: null,
    affinityType: null,
    shopInventory: [],
    uiType: 'pedalboard' // Uses pedalboard UI
});

// 5. The Armorer - Equipment management
NPCRegistry.register('equipment', {
    name: 'The Armorer',
    role: 'equipment',
    greeting: 'Arm yourself. Choose your weapon and trinkets.',
    characterId: null,
    affinityType: null,
    shopInventory: [],
    uiType: 'equipment' // Uses equipment UI
});

// 6. The Trader - Sell items
NPCRegistry.register('trader', {
    name: 'The Trader',
    role: 'trader',
    greeting: 'I\'ll buy your loot. Show me what you\'ve found.',
    characterId: null,
    affinityType: null,
    shopInventory: [],
    uiType: 'trader' // Uses trader UI
});

// 7. Reset NPC - Wipe save
NPCRegistry.register('reset', {
    name: 'The Void',
    role: 'reset',
    greeting: 'To begin again is to lose everything. Are you certain?',
    characterId: null,
    affinityType: null,
    shopInventory: [],
    uiType: 'reset' // Uses reset UI
});

// 8. The Void Entity - LLM-powered game master
NPCRegistry.register('void', {
    name: 'The Void',
    role: 'void',
    greeting: 'The space between rifts looks back.',
    characterId: null,
    affinityType: null,
    shopInventory: [],
    uiType: 'void' // Uses void UI (LLM integration)
});

