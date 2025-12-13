const HubState = {
    data: {
        structures: [] // { type, x, z, health }
    },

    save(entities) {
        // Filter only Structures
        this.data.structures = entities
            .filter(e => e.constructor.name === 'Structure' && !e.dead)
            .map(s => ({
                type: s.def.id,
                x: s.x,
                z: s.z,
                health: s.health
            }));
        
        localStorage.setItem('riftscape_hub', JSON.stringify(this.data));
        console.log(`[HubState] Saved ${this.data.structures.length} structures.`);
    },

    load(game) {
        const json = localStorage.getItem('riftscape_hub');
        if (json) {
            this.data = JSON.parse(json);
            
            // Rebuild the base
            this.data.structures.forEach(s => {
                // Verify class exists (Structure.js loaded)
                if (typeof Structure !== 'undefined') {
                    const struct = new Structure(game, s.x, s.z, s.type);
                    struct.health = s.health; // Restore HP
                    game.entities.push(struct);
                    game.scene.add(struct.mesh);
                }
            });
            console.log(`[HubState] Restored ${this.data.structures.length} structures.`);
        }
    },
    
    clear() {
        this.data.structures = [];
        localStorage.removeItem('riftscape_hub');
    }
};

window.HubState = HubState;