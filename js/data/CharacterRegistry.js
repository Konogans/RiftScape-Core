//
const CharacterRegistry = {
    characters: {},
    register(id, def) { this.characters[id] = { id, ...def }; },
    get(id) { return this.characters[id] || this.characters['wanderer']; },
    list() { return Object.values(this.characters); }
};

// 1. Wanderer (Adventurer)
CharacterRegistry.register('wanderer', {
    name: 'Wanderer',
    description: 'Balanced survivalist.',
    color: 0x44aaff,
    stats: { moveSpeed: 0, maxHealth: 0, maxReserve: 0, attackDamage: 0, attackSpeed: 0 },
    // NEW: Character restrictions
    allowedWeaponTypes: ['melee'], // Can only use melee weapons
    allowedAbilities: null, // null = no restrictions (can use all abilities)
    model: {
        path: 'models/Wanderer.glb',
        scale: 1.0,
        animations: {
            idle: 'Idle_10',
            walk: 'Walking',
            run: 'Running',
            attack: 'Attack',
            dash: 'Run_Fast',
            slam: 'Charged_Ground_Slam',
            death: 'Shot_and_Slow_Fall_Backward'
        },
        weapon: {
            path: 'models/Magitech_Battleaxe.glb',
            bone: 'RightHand', // Common Mixamo bone name
            scale: 0.5,
			position: { x: 0.0, y: 0.1, z: -0.2 },
			rotation: { x: 0, y: -0.5, z: 1.5 }
        }
    },
    // THE PEDALBOARD
    loadout: {
        primary: 'swipe',
        secondary: 'slam', // Unlocked via Meta normally, but defaults here for testing?
        mobility: 'dash',
        utility: 'heal',
        mastery: null
    }
});

// 2. Ironclad (Warrior/Mechaneer)
CharacterRegistry.register('smith', {
    name: 'Ironclad',
    description: 'Heavy armor. Shotgun.',
    color: 0xaa4444,
    stats: { moveSpeed: -0.15, maxHealth: 5, maxReserve: 5, attackDamage: 1, attackSpeed: -0.3 },
    // NEW: Character restrictions
    allowedWeaponTypes: ['ranged'], // Can only use ranged weapons
    allowedAbilities: ['shotgun', 'slam', 'dash', 'turret'], // Restricted ability list
    loadout: {
        primary: 'shotgun',
        secondary: 'slam',
        mobility: 'dash', // Could be 'shield_charge' later
        utility: 'turret',
        mastery: null
    }
});

// 3. Weaver (Wizard)
CharacterRegistry.register('scribe', {
    name: 'Weaver',
    description: 'Glass cannon. Homing bolts.',
    color: 0x8844ff,
    stats: { moveSpeed: 0.2, maxHealth: -2, maxReserve: -2, attackDamage: 0, attackSpeed: 0.3 },
    // NEW: Character restrictions
    allowedWeaponTypes: ['magic'], // Can only use magic weapons
    allowedAbilities: ['bolt', 'snipe', 'dash', 'heal'], // Restricted ability list
    loadout: {
        primary: 'bolt',
        secondary: 'snipe',
        mobility: 'dash', // Could be 'blink' later
        utility: 'heal',
        mastery: null
    }
});

CharacterRegistry.register('builder', {
    name: 'Architect',
    description: 'Controls the battlefield.',
    color: 0xffaa00, // Orange
    stats: { moveSpeed: 0, maxHealth: 2, maxReserve: 5, attackDamage: 0, attackSpeed: 0 },
    // NEW: Character restrictions
    allowedWeaponTypes: ['melee'], // Can only use melee weapons (tools)
    allowedAbilities: ['wrench', 'turret', 'dash', 'wall', 'dismantle'], // Restricted ability list
    loadout: {
        primary: 'wrench',
        secondary: 'turret',
        mobility: 'dash', 
        utility: 'wall',
        mastery: 'dismantle'
    }
});