
const PickupRegistry = {
    pickups: {},
    register(type, definition) { this.pickups[type] = definition; },
    get(type) { return this.pickups[type]; }
};
PickupRegistry.register('essence', {
    name: 'Essence', 
    color: 0xffcc44, 
    emissive: 0xffaa00, 
    emissiveIntensity: 0.8,
    scale: 0.15, 
    bobSpeed: 3, 
    bobHeight: 0.1, 
    lifetime: 15, 
    magnetRange: 2.5, 
    collectRange: 0.5,
    onCollect: (game, pickup) => {
		if (game.currentBiome === 'sanctuary') {
            // Direct Deposit to Bank
            MetaProgression.data.essence += pickup.value;
            // Optional: Save immediately so a crash doesn't lose loot
            MetaProgression.save(); 
        } else {
            // Add to Run Score
            game.runEssence += pickup.value; 
        }
    }
})
PickupRegistry.register('health', {
    name: 'Health Shard', color: 0x44ff66, emissive: 0x22aa44, emissiveIntensity: 0.6,
    scale: 0.2, shape: 'octahedron', bobSpeed: 2, bobHeight: 0.15, lifetime: 12, magnetRange: 2, collectRange: 0.5,
    onCollect: (game, pickup) => { game.player.health.delta(pickup.value); game.player.flashHeal(); }
});
PickupRegistry.register('reserve', {
    name: 'Soul Fragment', 
    color: 0x8844ff, 
    emissive: 0x6622cc, 
    emissiveIntensity: 0.9,
    scale: 0.25, 
    shape: 'octahedron', 
    bobSpeed: 1.5, 
    bobHeight: 0.2, 
    lifetime: 10, 
    magnetRange: 3, 
    collectRange: 0.5,
    onCollect: (game, pickup) => { 
        // FIX: Use the new method
        game.player.health.restoreReserve(pickup.value); 
        game.player.flashHeal(); 
    }
});
PickupRegistry.register('speed', {
    name: 'Swift Essence', color: 0x44ffff, emissive: 0x22aaaa, emissiveIntensity: 0.7,
    scale: 0.18, shape: 'tetrahedron', bobSpeed: 5, bobHeight: 0.12, lifetime: 8, magnetRange: 2, collectRange: 0.5,
    onCollect: (game, pickup) => { game.player.applyBuff('speed', 1.5, 5); }
});
PickupRegistry.register('damage', {
    name: 'Fury Shard', color: 0xff4444, emissive: 0xaa2222, emissiveIntensity: 0.7,
    scale: 0.18, shape: 'tetrahedron', bobSpeed: 4, bobHeight: 0.12, lifetime: 8, magnetRange: 2, collectRange: 0.5,
    onCollect: (game, pickup) => { game.player.applyBuff('damage', 2, 5); }
});
