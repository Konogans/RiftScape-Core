/**
 * EquipmentRegistry.js
 * Defines all equippable items (weapons and trinkets).
 * 
 * Equipment can be equipped in slots:
 * - weapon: 1 slot (attaches to character hand bone)
 * - trinket: 3 slots (future: attach to hips, for now just stat bonuses)
 */

const EquipmentRegistry = {
    items: {},
    
    register(id, def) {
        this.items[id] = { id, ...def };
    },
    
    get(id) {
        return this.items[id] || null;
    },
    
    list() {
        return Object.values(this.items);
    },
    
    /**
     * Get all equipment of a specific type
     * @param {'weapon'|'trinket'} type 
     * @returns {Array<Object>}
     */
    getByType(type) {
        return this.list().filter(item => item.type === type);
    }
};

// ============================================
// WEAPONS
// ============================================

// 1. Magitech Battleaxe (Default Wanderer weapon)
EquipmentRegistry.register('battleaxe', {
    name: 'Magitech Battleaxe',
    type: 'weapon',
    description: 'A balanced melee weapon with good reach.',
    model: {
        path: 'models/Magitech_Battleaxe.glb',
        bone: 'RightHand',
        scale: 0.5,
        position: { x: 0.0, y: 0.1, z: -0.2 },
        rotation: { x: 0, y: -0.5, z: 1.5 }
    },
    stats: {
        attackDamage: 0,      // +0 base damage
        attackSpeed: 0,        // +0 attack speed
        attackRange: 0.2       // +0.2 range
    }
});

// 2. Iron Hammer (Heavy weapon)
EquipmentRegistry.register('hammer', {
    name: 'Iron Hammer',
    type: 'weapon',
    description: 'A heavy weapon that hits hard but swings slow.',
    model: {
        path: 'models/Magitech_Battleaxe.glb', // TODO: Replace with hammer model
        bone: 'RightHand',
        scale: 0.6,
        position: { x: 0.0, y: 0.1, z: -0.2 },
        rotation: { x: 0, y: -0.5, z: 1.5 }
    },
    stats: {
        attackDamage: 2,      // +2 base damage
        attackSpeed: -0.2,    // -20% attack speed
        attackRange: 0.1      // +0.1 range
    }
});

// 3. Swift Blade (Fast weapon)
EquipmentRegistry.register('blade', {
    name: 'Swift Blade',
    type: 'weapon',
    description: 'A fast weapon that strikes quickly.',
    model: {
        path: 'models/Magitech_Battleaxe.glb', // TODO: Replace with blade model
        bone: 'RightHand',
        scale: 0.4,
        position: { x: 0.0, y: 0.1, z: -0.2 },
        rotation: { x: 0, y: -0.5, z: 1.5 }
    },
    stats: {
        attackDamage: -1,     // -1 base damage
        attackSpeed: 0.3,     // +30% attack speed
        attackRange: -0.1     // -0.1 range
    }
});

// ============================================
// TRINKETS
// ============================================

// 1. Health Amulet
EquipmentRegistry.register('health_amulet', {
    name: 'Health Amulet',
    type: 'trinket',
    description: 'Increases maximum health.',
    stats: {
        maxHealth: 2,          // +2 max active health
        maxReserve: 3          // +3 max reserve health
    }
});

// 2. Speed Boots
EquipmentRegistry.register('speed_boots', {
    name: 'Speed Boots',
    type: 'trinket',
    description: 'Increases movement speed.',
    stats: {
        moveSpeed: 0.15       // +15% movement speed
    }
});

// 3. Damage Ring
EquipmentRegistry.register('damage_ring', {
    name: 'Damage Ring',
    type: 'trinket',
    description: 'Increases attack damage.',
    stats: {
        attackDamage: 1       // +1 base damage
    }
});

// 4. Regen Pendant
EquipmentRegistry.register('regen_pendant', {
    name: 'Regen Pendant',
    type: 'trinket',
    description: 'Increases health regeneration.',
    stats: {
        healthRegen: 0.5      // +0.5 health per second
    }
});

// 5. Essence Finder
EquipmentRegistry.register('essence_finder', {
    name: 'Essence Finder',
    type: 'trinket',
    description: 'Increases essence drop rate.',
    stats: {
        essenceBonus: 0.2     // +20% essence drops
    }
});

// 6. Defense Charm
EquipmentRegistry.register('defense_charm', {
    name: 'Defense Charm',
    type: 'trinket',
    description: 'Reduces incoming damage.',
    stats: {
        damageReduction: 0.1  // -10% damage taken
    }
});

