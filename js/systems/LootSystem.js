/**
 * LootSystem.js
 * Interprets loot tables from EntityRegistry.
 * Can be extended for weighted drops, rarity, etc.
 */

const LootSystem = {
    /**
     * Roll loot from a definition and spawn pickups
     * @param {object} lootDef - The loot definition from EntityRegistry
     * @param {number} x - World X position
     * @param {number} z - World Z position  
     * @param {object} game - Game instance
     */
    drop(lootDef, x, z, game) {
        if (!lootDef) return;
        
        for (const [type, def] of Object.entries(lootDef)) {
            if (Math.random() < (def.chance || 1)) {
                const value = this.rollValue(def);
                const offsetX = x + (Math.random() - 0.5) * 0.8;
                const offsetZ = z + (Math.random() - 0.5) * 0.8;
                game.spawnPickup(offsetX, offsetZ, type, value);
            }
        }
    },
    
    rollValue(def) {
        if (def.min !== undefined && def.max !== undefined) {
            return def.min + Math.floor(Math.random() * (def.max - def.min + 1));
        }
        return def.value || 1;
    },
    
    // Rarity multiplier (for future use)
    applyRarity(baseDef, rarityMult = 1) {
        const modified = { ...baseDef };
        if (modified.chance) modified.chance = Math.min(1, modified.chance * rarityMult);
        if (modified.min) modified.min = Math.floor(modified.min * rarityMult);
        if (modified.max) modified.max = Math.floor(modified.max * rarityMult);
        return modified;
    }
};

window.LootSystem = LootSystem;
