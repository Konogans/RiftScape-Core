console.log("Parsing WorldManager (Spatial Grid Optimized)...");

class Chunk {
    constructor(x, z, size, scene, game, worldManager) {
        this.x = x;
        this.z = z;
        this.size = size;
        this.scene = scene;
        this.game = game;
        this.worldManager = worldManager;
        this.meshes = [];
        this.colliders = []; // Still needed to track what to unregister on dispose
        
        this.generate();
    }

    generate() {
        const worldX = this.x * this.size;
        const worldZ = this.z * this.size;
        
        const biomeId = this.game.currentBiome || 'rift_wastes';
        if (typeof BiomeRegistry === 'undefined') return;
        const biome = BiomeRegistry.get(biomeId);
        
        // Determine Node Type
        let isDungeon = false;
        if (window.WorldState) {
            const node = WorldState.getCurrentNode();
            if (node.type === 'dungeon') isDungeon = true;
        }

        if (isDungeon) {
            this.generateDungeonChunk(worldX, worldZ, biome);
        } else {
            this.generateWildernessChunk(worldX, worldZ, biome);
        }
    }

    generateWildernessChunk(worldX, worldZ, biome) {
        // Create floor material - use texture if available
        let floorMat;
        if (biome.groundTexture) {
            const texture = new THREE.TextureLoader().load(biome.groundTexture);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(biome.groundTextureRepeat || 4, biome.groundTextureRepeat || 4);
            floorMat = PSXify(new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.9,
                metalness: 0.1
            }));
        } else {
            floorMat = PSXify(new THREE.MeshStandardMaterial({
                color: biome.groundColor,
                roughness: 0.9,
                metalness: 0.1
            }));
        }

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(this.size, this.size),
            floorMat
        );
        floor.rotateX(-Math.PI / 2);
        floor.position.set(worldX, -0.01, worldZ);
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.meshes.push(floor);

        this.spawnFeatures(worldX, worldZ, false);
    }

    generateDungeonChunk(worldX, worldZ, biome) {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(this.size, this.size),
            PSXify(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.3 }))
        );
        floor.rotateX(-Math.PI / 2);
        floor.position.set(worldX, -0.01, worldZ);
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.meshes.push(floor);

        const cellSize = 2;
        const cellsPerChunk = this.size / cellSize; 
        const wallMat = PSXify(new THREE.MeshStandardMaterial({ color: 0x332233, roughness: 0.1 }));
        const wallGeo = new THREE.BoxGeometry(cellSize, 4, cellSize); 

        for (let ix = 0; ix < cellsPerChunk; ix++) {
            for (let iz = 0; iz < cellsPerChunk; iz++) {
                const cx = worldX - (this.size/2) + (ix * cellSize) + (cellSize/2);
                const cz = worldZ - (this.size/2) + (iz * cellSize) + (cellSize/2);
                
                if (this.isDungeonWall(cx, cz)) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(cx, 2, cz);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.scene.add(wall);
                    this.meshes.push(wall);
                    
                    // OPTIMIZATION: Register to Spatial Grid
                    this.worldManager.registerObstacle(cx, cz, cellSize, cellSize);
                    this.colliders.push({ x: cx, z: cz, width: cellSize, depth: cellSize });
                }
            }
        }
        
        this.spawnFeatures(worldX, worldZ, true);
    }

    isDungeonWall(x, z) {
        if (Math.abs(x) < 8 && Math.abs(z) < 8) return false;

        const portals = this.worldManager.getRealmPortals();
        for (const p of portals) {
            const dx = p.x - x;
            const dz = p.z - z;
            if ((dx*dx + dz*dz) < 64) return false;
        }

        const macroSize = 20;
        const mx = Math.floor(x / macroSize);
        const mz = Math.floor(z / macroSize);
        let lx = x % macroSize;
        let lz = z % macroSize;
        if (lx < 0) lx += macroSize;
        if (lz < 0) lz += macroSize;

        const seed = Math.sin(mx * 12.9898 + mz * 78.233) * 43758.5453;
        const rand = seed - Math.floor(seed);
        
        const roomSize = 6 + (rand * 8);
        const center = macroSize / 2;
        
        if (Math.abs(lx - center) < roomSize / 2 && Math.abs(lz - center) < roomSize / 2) return false; 

        const corridorWidth = 3;
        if (Math.abs(lz - center) < corridorWidth / 2) return false;
        if (Math.abs(lx - center) < corridorWidth / 2) return false;

        return true; 
    }

	spawnFeatures(worldX, worldZ, isDungeon) {
        // 1. Define RNG (Crucial: This was likely missing)
        const seed = Math.sin(this.x * 12.9898 + this.z * 78.233) * 43758.5453;
        const rng = () => { let t = seed + Math.random(); return t - Math.floor(t); };

        const portals = this.worldManager.getRealmPortals();
        
        // 2. Spawn Portals (Only if NOT in Sanctuary)
        if (this.game.currentBiome !== 'sanctuary') {
            for (const p of portals) {
                // Check bounds
                if (p.x >= (worldX - 10) && p.x < (worldX + 10) &&
                    p.z >= (worldZ - 10) && p.z < (worldZ + 10)) {
						
					const targetNode = WorldState.nodes[p.targetId];
					const name = targetNode ? targetNode.name : "Unknown";
					const level = targetNode ? targetNode.level : 1; // GET LEVEL
                    
                    const portal = new Portal(this.game, p.x, p.z, p.targetId, name, level);
                    this.game.entities.push(portal);
                    this.game.scene.add(portal.mesh);
                }
            }
        }

        // 3. Spawn Obstacles (Wilderness Only)
        if (!isDungeon) {
            // Check: Not Center Chunk AND Not Sanctuary
            if ((this.x !== 0 || this.z !== 0) && this.game.currentBiome !== 'sanctuary') {
                
                const obstacleCount = 5 + Math.floor(rng() * 5);
                const obsMat = PSXify(new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.2 }));
                
                for(let i=0; i<obstacleCount; i++) {
                    // GRID ALIGNMENT LOGIC
                    const range = (this.size / 2) - 2;
                    const localGridX = Math.round((rng() - 0.5) * 2 * range);
                    const localGridZ = Math.round((rng() - 0.5) * 2 * range);
                    
                    const gridX = Math.round(worldX + localGridX);
                    const gridZ = Math.round(worldZ + localGridZ);
                    
                    // Integer Sizes
                    const w = 1 + Math.floor(Math.random() * 2);
                    const d = 1 + Math.floor(Math.random() * 2);
                    const h = 1 + Math.random() * 3;
                    
                    // Half-Step Centering (Aligns mesh to grid cells)
                    const finalX = gridX + (w / 2);
                    const finalZ = gridZ + (d / 2);

                    // Portal Clearance Check
                    let nearPortal = false;
                    for(const p of portals) {
                        const distSq = (p.x - finalX)**2 + (p.z - finalZ)**2;
                        if(distSq < 64) nearPortal = true;
                    }
                    if(nearPortal) continue;

                    // Create Mesh
                    const obs = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), obsMat);
                    obs.position.set(finalX, h/2, finalZ);
                    obs.castShadow = true;
                    obs.receiveShadow = true;
                    this.scene.add(obs);
                    this.meshes.push(obs);
                    
                    // Register Collision
                    this.worldManager.registerObstacle(finalX, finalZ, w, d);
                    this.colliders.push({ x: finalX, z: finalZ, width: w, depth: d });
                }
            }
        }
		
		// 3a. RESCUE MISSIONS (Rare Event)
        // 1% chance per chunk to contain a prisoner
        if (rng() < 0.01 && this.game.currentBiome !== 'sanctuary') {
            const possibleRescues = ['smith', 'scribe', 'builder'];
            // Pick one random ID
            const charId = possibleRescues[Math.floor(rng() * possibleRescues.length)];
            
            // Don't spawn if we already unlocked them? 
            // Optional: Keep spawning them for Essence rewards (Rescue loop)
            
            const cX = worldX + (rng() - 0.5) * 5;
            const cZ = worldZ + (rng() - 0.5) * 5;
            
            const cage = new Cage(this.game, cX, cZ, charId);
            this.game.entities.push(cage);
            this.game.scene.add(cage.mesh);
            
            // Register collision so you can't walk through the cage
            this.worldManager.registerObstacle(cX, cZ, 1, 1); 
            this.colliders.push({ x: cX, z: cZ, width: 1, depth: 1 });
            
            console.log(`[Rift] Rescue Signal detected at ${Math.floor(cX)}, ${Math.floor(cZ)}`);
        }
        
        // 4. Decorations (Grass/Rocks)
        const decorCount = 5 + Math.floor(Math.random() * 10);
        const decorMat = PSXify(new THREE.MeshStandardMaterial({ color: 0x334433 }));
        const decorGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
        
        for(let i=0; i<decorCount; i++) {
             const dx = (this.x * this.size) + (Math.random() - 0.5) * (this.size - 1);
             const dz = (this.z * this.size) + (Math.random() - 0.5) * (this.size - 1);
             const decor = new THREE.Mesh(decorGeo, decorMat);
             decor.position.set(dx, 0.2, dz);
             decor.rotation.y = Math.random() * Math.PI;
             const s = 0.5 + Math.random() * 0.5;
             decor.scale.set(s, s, s);
             this.scene.add(decor);
             this.meshes.push(decor);
        }
    }

    dispose() {
        this.meshes.forEach(m => {
            this.scene.remove(m);
            if(m.geometry) m.geometry.dispose();
            if(m.material) m.material.dispose(); // Added material dispose
        });
        
        // OPTIMIZATION: Unregister obstacles from global grid
        this.colliders.forEach(c => {
            this.worldManager.unregisterObstacle(c.x, c.z, c.width, c.depth);
        });
        
        this.meshes = [];
        this.colliders = [];
    }
}

class WorldManager {
    constructor(game, chunkSize = 20) {
        this.game = game;
        this.scene = game.scene;
        this.chunkSize = chunkSize;
        this.chunks = {}; 
        this.renderDistance = 2; 
        
        // OPTIMIZATION: The Spatial Grid
        // Stores blocked coordinates as strings "x,z"
        // Resolution: 1 meter (1x1 blocks)
		this.spatialGrid = new Set();
        
        // Key: "x,z" -> Value: { x: 0, z: 0 } (Direction to player)
        this.flowField = {}; 
        this.lastFlowUpdate = 0;
        
        console.log("WorldManager initialized (Spatial Grid + Flow Field)");
        this.update(0, 0);
    }
	
	updateFlowField(targetX, targetZ) {
        this.flowField = {}; 
        const q = [];
        const visited = new Set();
        
        const tX = Math.floor(targetX);
        const tZ = Math.floor(targetZ);
        
        q.push({x: tX, z: tZ, dist: 0});
        visited.add(`${tX},${tZ}`);
        
        const range = 40; 
        
        while(q.length > 0) {
            const curr = q.shift();
            
            // FIX: Check 8 neighbors (Cardinals + Diagonals)
            const neighbors = [
                {x: curr.x+1, z: curr.z}, {x: curr.x-1, z: curr.z}, // East, West
                {x: curr.x, z: curr.z+1}, {x: curr.x, z: curr.z-1}, // North, South
                {x: curr.x+1, z: curr.z+1}, {x: curr.x-1, z: curr.z+1}, // NE, NW
                {x: curr.x+1, z: curr.z-1}, {x: curr.x-1, z: curr.z-1}  // SE, SW
            ];
            
            for(const n of neighbors) {
                const key = `${n.x},${n.z}`;
                
                if(visited.has(key)) continue;
                if(Math.abs(n.x - tX) > range || Math.abs(n.z - tZ) > range) continue;
                if(this.spatialGrid.has(key)) continue;
                
                visited.add(key);
                
                // Calculate raw vector
                let vx = curr.x - n.x;
                let vz = curr.z - n.z;
                
                // FIX: Normalize the vector
                // This ensures diagonal movement (length 1.41) isn't faster than cardinal (length 1)
                const len = Math.sqrt(vx*vx + vz*vz);
                if (len > 0) {
                    vx /= len;
                    vz /= len;
                }
                
                // Store the normalized direction
                this.flowField[key] = { x: vx, z: vz };
                
                q.push({x: n.x, z: n.z, dist: curr.dist + 1});
            }
        }
    }
    
    // 3. Helper for Entities to ask for directions
    getFlowVector(x, z) {
        // FIX: Bilinear Interpolation
        // Instead of grabbing one rough direction, we blend the 4 nearest grid cells.
        // This effectively simulates "infinite" directions.

        // We shift by -0.5 so that the vector is centered on the cell
        const sampleX = x - 0.5;
        const sampleZ = z - 0.5;
        
        const x0 = Math.floor(sampleX);
        const z0 = Math.floor(sampleZ);
        
        // Decimals (Weights)
        const u = sampleX - x0;
        const v = sampleZ - z0;
        
        // Helper to safely get vector or zero
        const getV = (gx, gz) => this.flowField[`${gx},${gz}`] || {x:0, z:0};
        
        // Sample 2x2 grid
        const v00 = getV(x0, z0);
        const v10 = getV(x0+1, z0);
        const v01 = getV(x0, z0+1);
        const v11 = getV(x0+1, z0+1);
        
        // Blend X
        const topX = v00.x * (1-u) + v10.x * u;
        const botX = v01.x * (1-u) + v11.x * u;
        const finalX = topX * (1-v) + botX * v;
        
        // Blend Z
        const topZ = v00.z * (1-u) + v10.z * u;
        const botZ = v01.z * (1-u) + v11.z * u;
        const finalZ = topZ * (1-v) + botZ * v;
        
        // Normalize result
        const len = Math.sqrt(finalX*finalX + finalZ*finalZ);
        if (len > 0.001) {
            return { x: finalX/len, z: finalZ/len };
        }
        
        return null; 
    }

    update(playerX, playerZ) {
        const currentChunkX = Math.round(playerX / this.chunkSize);
        const currentChunkZ = Math.round(playerZ / this.chunkSize);
        const activeKeys = new Set();

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const cx = currentChunkX + x;
                const cz = currentChunkZ + z;
                const key = `${cx},${cz}`;
                activeKeys.add(key);
                if (!this.chunks[key]) {
                    this.chunks[key] = new Chunk(cx, cz, this.chunkSize, this.scene, this.game, this);
                }
            }
        }

        for (const key in this.chunks) {
            if (!activeKeys.has(key)) {
                this.chunks[key].dispose();
                delete this.chunks[key];
            }
        }
    }
    
    // OPTIMIZATION: Grid Helpers
    getGridKey(x, z) {
        return `${Math.floor(x)},${Math.floor(z)}`;
    }


    registerObstacle(x, z, width, depth) {
        const minX = x - width / 2;
        const maxX = x + width / 2;
        const minZ = z - depth / 2;
        const maxZ = z + depth / 2;

        // FIX: Subtract 0.05 before flooring the End coordinates.
        // This prevents a wall ending exactly at 11.0 from blocking the 11-12 cell.
        const startX = Math.floor(minX);
        const endX = Math.floor(maxX - 0.05); 
        const startZ = Math.floor(minZ);
        const endZ = Math.floor(maxZ - 0.05);

        for(let ix = startX; ix <= endX; ix++) {
            for(let iz = startZ; iz <= endZ; iz++) {
                this.spatialGrid.add(`${ix},${iz}`);
            }
        }
    }
    
    unregisterObstacle(x, z, width, depth) {
        const minX = x - width / 2;
        const maxX = x + width / 2;
        const minZ = z - depth / 2;
        const maxZ = z + depth / 2;

        // FIX: Must match the register logic exactly to generate same keys
        const startX = Math.floor(minX);
        const endX = Math.floor(maxX - 0.05); 
        const startZ = Math.floor(minZ);
        const endZ = Math.floor(maxZ - 0.05);

        for(let ix = startX; ix <= endX; ix++) {
            for(let iz = startZ; iz <= endZ; iz++) {
                this.spatialGrid.delete(`${ix},${iz}`);
            }
        }
    }

    hash(str) {
        let h = 0xdeadbeef;
        for(let i=0; i<str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }

    getRealmPortals() {
        if (!window.WorldState) return [];
        const node = WorldState.getCurrentNode();
        const portals = [];
        
        node.connections.forEach(conn => {
            const seedStr = `${node.id}_to_${conn.targetId}`;
            const randAngle = this.hash(seedStr + "_angle");
            const randDist = this.hash(seedStr + "_dist");
            
            const angle = randAngle * Math.PI * 2;
            const dist = conn.minDepth + (randDist * 50); 
            
            let x = Math.cos(angle) * dist;
            let z = Math.sin(angle) * dist;
            
            if (node.type === 'dungeon') {
                x = Math.round(x / 20) * 20;
                z = Math.round(z / 20) * 20;
            }
            
            const targetNode = WorldState.nodes[conn.targetId];
            const name = targetNode ? targetNode.name : "Unknown";
            portals.push({ x: x, z: z, targetId: conn.targetId, name: name });
        });
        return portals;
    }
    
    findNearestPortal(playerX, playerZ) {
        const portals = this.getRealmPortals();
        let nearest = null;
        let minDist = Infinity;
        for (const p of portals) {
            const d = (p.x - playerX)**2 + (p.z - playerZ)**2;
            if (d < minDist) {
                minDist = d;
                nearest = p;
            }
        }
        return nearest;
    }
    
    clear() {
        for (const key in this.chunks) this.chunks[key].dispose();
        this.chunks = {};
        this.spatialGrid.clear(); // Clear the grid
    }

	checkCollision(x, z, radius = 0.2) { 
        // Note: Default radius reduced to 0.3 because Player box is 0.6 wide.
        // Using 0.5 made the player feel "fat" and get stuck on invisible corners.

        // Calculate the integer grid cells the player covers
        const startX = Math.floor(x - radius);
        const endX = Math.floor(x + radius);
        const startZ = Math.floor(z - radius);
        const endZ = Math.floor(z + radius);

        // Check every cell in that rectangle
        for(let ix = startX; ix <= endX; ix++) {
            for(let iz = startZ; iz <= endZ; iz++) {
                if (this.spatialGrid.has(`${ix},${iz}`)) {
                    return true;
                }
            }
        }
        return false;
    }
}

window.WorldManager = WorldManager;