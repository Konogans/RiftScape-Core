
const UpgradeRegistry = {
    upgrades: [],
    register(upgrade) { this.upgrades.push(upgrade); },
    list() { return this.upgrades; },
    getByAffinity(affinity) { return this.upgrades.filter(u => u.affinity === affinity || u.affinity === 'neutral'); }
};

UpgradeRegistry.register({ id: 'vitality1', name: 'Vitality I', description: '+1 Max Health', cost: 100, affinity: 'neutral', effects: { maxHealth: 1 } });
UpgradeRegistry.register({ id: 'vitality2', name: 'Vitality II', description: '+2 Max Health', cost: 250, affinity: 'neutral', requires: 'vitality1', effects: { maxHealth: 2 } });
UpgradeRegistry.register({ id: 'reserves1', name: 'Deep Reserves', description: '+3 Reserve Pool', cost: 150, affinity: 'neutral', effects: { maxReserve: 3 } });
UpgradeRegistry.register({ id: 'swiftness1', name: 'Swiftness', description: '+15% Move Speed', cost: 120, affinity: 'neutral', effects: { moveSpeed: 0.15 } });

// Magic (Expensive, powerful)
UpgradeRegistry.register({ id: 'magic_regen', name: 'Aetheric Flow', description: '+0.3 Health Regen', cost: 300, affinity: 'magic', effects: { regenRate: 0.3 } });
UpgradeRegistry.register({ id: 'magic_burst', name: 'Arcane Burst', description: '+1 Attack Damage', cost: 400, affinity: 'magic', effects: { attackDamage: 1 } });

// Tech (Efficiency, cheaper)
UpgradeRegistry.register({ id: 'tech_speed', name: 'Overclock', description: '+20% Attack Speed', cost: 200, affinity: 'tech', effects: { attackSpeed: 0.2 } });
UpgradeRegistry.register({ id: 'tech_armor', name: 'Plating', description: '+2 Max Health, +2 Reserve', cost: 220, affinity: 'tech', effects: { maxHealth: 2, maxReserve: 2 } });

// ABILITY UNLOCKS
// Cheap (50 Essence) to act as the first major goal for a new player.

// Tech Path (Garrick)
UpgradeRegistry.register({ 
    id: 'dash_unlock', 
    name: 'Phase Module', 
    description: 'Unlock Ability: RIFT DASH [Shift]', 
    cost: 50, 
    affinity: 'tech', 
    effects: {} 
});

// Magic Path (Elara)
UpgradeRegistry.register({ 
    id: 'slam_unlock', 
    name: 'Gravity Well', 
    description: 'Unlock Ability: RIFT SLAM [RMB]', 
    cost: 50, 
    affinity: 'magic', 
    effects: {} 
});