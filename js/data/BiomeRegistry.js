
const BiomeRegistry = {
    biomes: {},
    register(id, definition) { this.biomes[id] = definition; },
    get(id) { return this.biomes[id] || this.biomes['rift_wastes']; },
    getRandomBiome(excludeId = null) {
        const ids = Object.keys(this.biomes).filter(id => id !== excludeId);
        return ids[Math.floor(Math.random() * ids.length)];
    },
    list() { return Object.keys(this.biomes); }
};
BiomeRegistry.register('rift_wastes', {
    name: 'The Rift Wastes', groundColor: 0x1a1a2e,
    groundTexture: 'images/tex_scorched_aether_ash.jpg', // Seamless ground texture
    groundTextureRepeat: 1, // Repeat per chunk
	fogColor: 0x0a0a15, fogDensity: 0.03, ambientColor: 0x404060,
    enemyWeights: { default: 0.6, swift: 0.25, brute: 0.1, spitter: 0.05 }, spawnRateMultiplier: 1, portalThreshold: { kills: 15, time: 45 }
});
BiomeRegistry.register('crimson_hollow', {
    name: 'Crimson Hollow', groundColor: 0x2e1a1a, fogColor: 0x150a0a, fogDensity: 0.04, ambientColor: 0x604040,
    enemyWeights: { default: 0.3, swift: 0.15, brute: 0.4, spitter: 0.15 }, spawnRateMultiplier: 0.8, portalThreshold: { kills: 12, time: 40 }
});
BiomeRegistry.register('flickering_expanse', {
    name: 'Flickering Expanse', groundColor: 0x1a2e2e, fogColor: 0x0a1515, fogDensity: 0.025, ambientColor: 0x406060,
    enemyWeights: { default: 0.2, swift: 0.6, brute: 0.05, spitter: 0.15 }, spawnRateMultiplier: 1.5, portalThreshold: { kills: 20, time: 35 }
});
BiomeRegistry.register('void_cathedral', {
    name: 'Void Cathedral', groundColor: 0x1a1a30, fogColor: 0x080818, fogDensity: 0.05, ambientColor: 0x303050,
    enemyWeights: { default: 0.2, swift: 0.2, brute: 0.2, spitter: 0.4 }, spawnRateMultiplier: 0.7, portalThreshold: { kills: 10, time: 50 }
});
BiomeRegistry.register('sanctuary', {
    name: 'The Outpost',
    groundColor: 0x224422, // Fallback color
    groundTexture: 'images/tex_garrisoned_earth.jpg', // Seamless ground texture
    groundTextureRepeat: 1, // Repeat per chunk
    fogColor: 0x88ccff,    // Blue sky
    fogDensity: 0.005,     // Very clear view
    ambientColor: 0x8888aa, // Bright ambient light
    enemyWeights: {},       // No enemies
    spawnRateMultiplier: 0, // 0 means peaceful
    portalThreshold: { kills: 0, time: 0 } // Portals always open (or handled manually)
});