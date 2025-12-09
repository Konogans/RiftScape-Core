
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

EntityRegistry.register('default', {
    name: 'Riftling', color: 0xff4444, emissive: 0x441111,
    scale: 1, speed: { min: 1.5, max: 2.5 }, health: { active: 2, reserve: 3 },
    attackRange: 1.2, attackCooldown: 1500, attackTiming: { windup: 300, action: 100, cooldown: 400 },
    lore: 'A minor creature drawn through the rifts.'
});
EntityRegistry.register('brute', {
    name: 'Rift Brute', color: 0x884422, emissive: 0x331111,
    scale: 1.4, speed: { min: 0.8, max: 1.2 }, health: { active: 4, reserve: 6 },
    attackRange: 1.5, attackCooldown: 2000, attackTiming: { windup: 500, action: 150, cooldown: 500 },
    damage: 2, lore: 'A hulking mass of rift-stuff.'
});
EntityRegistry.register('swift', {
    name: 'Flicker', color: 0x44ffaa, emissive: 0x114433,
    scale: 0.7, speed: { min: 3, max: 4 }, health: { active: 1, reserve: 2 },
    attackRange: 1.0, attackCooldown: 800, attackTiming: { windup: 150, action: 50, cooldown: 200 },
    lore: 'A darting fragment.'
});
EntityRegistry.register('spitter', {
    name: 'Rift Spewer', color: 0xaa44ff, emissive: 0x331144,
    scale: 1.1, speed: { min: 1, max: 1.5 }, health: { active: 2, reserve: 4 },
    attackRange: 5.0, attackCooldown: 2500, attackTiming: { windup: 600, action: 100, cooldown: 400 },
    ranged: true, projectileSpeed: 8, lore: 'Keeps its distance.'
});
// EXAMPLE MODEL ENTRY:
/*
EntityRegistry.register('skeleton_warrior', {
    name: 'Risen Guard',
    model: 'assets/models/skeleton_warrior.glb',
    animations: { idle: 'Idle', walk: 'Walk', attack: 'Attack', death: 'Death' },
    // ... stats ...
});
*/
