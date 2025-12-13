
class WorldNode {
    constructor(id, name, type, level, biomeId) {
        this.id = id;
        this.name = name;
        this.type = type; 
        this.level = level;
        this.biomeId = biomeId;
        
        // List of connections: { targetId, minDepth, type }
        this.connections = []; 
        
        this.savageness = 1.0 + (Math.random() * 0.5); 
        if (type === 'dungeon') this.savageness += 0.5;
    }
}

const WorldState = {
    nodes: {},
    currentNodeId: null,
    
    generate() {
        console.log("Generating Spatial World Graph...");
        this.nodes = {};
        
        const outpostNames = ['Dundee', 'Fort Bellicus', 'Karag Arath', 'Cartilla', 'Cassus'];
        const levels = [1, 10, 20, 30, 40];
        
        let prevOutpost = null;
        
        outpostNames.forEach((name, i) => {
            const id = `outpost_${i}`;
            const node = new WorldNode(id, name, 'outpost', levels[i], 'rift_wastes');
            this.nodes[id] = node;
            
            if (prevOutpost) {
                this.linkNodes(prevOutpost, node);
            }
            prevOutpost = node;
        });
        
        this.currentNodeId = 'outpost_0';
    },
    
	linkNodes(source, target) {
        // 1. Create Wilderness
        const wildId = `wild_${source.id}_${target.id}`;
        const wildName = `${this.generateName()} (Wilderness)`;
        const biomes = ['rift_wastes', 'crimson_hollow', 'flickering_expanse', 'void_cathedral'];
        const biome = biomes[Math.floor(Math.random() * biomes.length)];
        
        // Wilderness scales slightly above source
        const wilderness = new WorldNode(wildId, wildName, 'wilderness', source.level + 1, biome);
        this.nodes[wildId] = wilderness;
        
        // 2. Create Dungeon
        const dungeonId = `dungeon_${wildId}`;
        const dungeonName = `The ${this.generateDungeonName()}`;
        
        // FIX: LEVEL SCALING
        // Rule: Level cannot be lower than Depth / 10.
        // Connection depth is 150m. So min level is 15.
        // We take the higher of: (Source+2) OR (Depth/10).
        const dungeonDepth = 150;
        const depthLevel = Math.floor(dungeonDepth / 10);
        const dungeonLevel = Math.max(source.level + 2, depthLevel);
        
        const dungeon = new WorldNode(dungeonId, dungeonName, 'dungeon', dungeonLevel, 'void_cathedral');
        this.nodes[dungeonId] = dungeon;
        
        // --- CONNECTIONS ---
        source.connections.push({ targetId: wildId, minDepth: 50, type: 'main' });
        wilderness.connections.push({ targetId: target.id, minDepth: 300, type: 'main' });
        
        // Update connection with the depth we used for calculation
        wilderness.connections.push({ targetId: dungeonId, minDepth: dungeonDepth, type: 'dungeon' });
        
        // Return portals
        wilderness.connections.push({ targetId: source.id, minDepth: 15, type: 'exit' });
        target.connections.push({ targetId: wildId, minDepth: 15, type: 'exit' });
        dungeon.connections.push({ targetId: wildId, minDepth: 15, type: 'exit' });
    },
    
    generateName() {
        const adjs = ['Scary', 'Misty', 'Dark', 'Forgotten', 'Silent', 'Burning'];
        const nouns = ['Forest', 'Pass', 'Crags', 'Tundra', 'Path', 'Road', 'Wastes'];
        return adjs[Math.floor(Math.random()*adjs.length)] + ' ' + nouns[Math.floor(Math.random()*nouns.length)];
    },
    
    generateDungeonName() {
        const nouns = ['Crypt', 'Tower', 'Den', 'Palace', 'Lair', 'Pit'];
        const suffixes = ['of Evil', 'of Doom', 'of the Spider', 'of Malus', 'of Ghor'];
        return nouns[Math.floor(Math.random()*nouns.length)] + ' ' + suffixes[Math.floor(Math.random()*suffixes.length)];
    },
    
    getCurrentNode() {
        if (!this.nodes[this.currentNodeId]) this.generate();
        return this.nodes[this.currentNodeId];
    }
};

window.WorldState = WorldState;
