
console.log("Parsing WorldManager (Physics Update)...");

class Chunk {
    constructor(x, z, size, scene, game) {
        this.x = x;
        this.z = z;
        this.size = size;
        this.scene = scene;
        this.game = game;
        this.meshes = [];
        this.colliders = [];
        
        this.generate();
    }

    generate() {
        const biomeId = this.game.currentBiome || 'rift_wastes';
        // Ensure BiomeRegistry exists
        if (typeof BiomeRegistry === 'undefined') return;
        
        const biome = BiomeRegistry.get(biomeId);
        
        // 1. Floor
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
        floorGeo.rotateX(-Math.PI / 2);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: biome.groundColor, 
            roughness: 0.9, 
            metalness: 0.1 
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(this.x * this.size, -0.01, this.z * this.size);
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.meshes.push(floor);

        // Deterministic RNG
        const seed = Math.sin(this.x * 12.9898 + this.z * 78.233) * 43758.5453;
        const rng = () => {
            let t = seed + Math.random(); 
            return t - Math.floor(t);
        };

        // 2. Obstacles
        if (this.x !== 0 || this.z !== 0) {
            const obstacleCount = 3 + Math.floor(rng() * 4);
            const obsMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.2 });
            
            for(let i=0; i<obstacleCount; i++) {
                const lx = (Math.random() - 0.5) * (this.size - 2);
                const lz = (Math.random() - 0.5) * (this.size - 2);
                const ox = (this.x * this.size) + lx;
                const oz = (this.z * this.size) + lz;
                
                const width = 1 + Math.random() * 1.5;
                const depth = 1 + Math.random() * 1.5;
                const height = 1 + Math.random() * 3;
                
                const obsGeo = new THREE.BoxGeometry(width, height, depth);
                const obs = new THREE.Mesh(obsGeo, obsMat);
                obs.position.set(ox, height/2, oz);
                obs.castShadow = true;
                obs.receiveShadow = true;
                
                this.scene.add(obs);
                this.meshes.push(obs);
                
                // Store precise dimensions for AABB collision
                this.colliders.push({ 
                    x: ox, 
                    z: oz, 
                    width: width, 
                    depth: depth 
                });
            }
        }
        
        // 3. Decorations
        const decorCount = 5 + Math.floor(Math.random() * 10);
        const decorMat = new THREE.MeshStandardMaterial({ color: 0x334433 });
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
            if(m.material) m.material.dispose();
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
        
        console.log("WorldManager physics ready");
        this.update(0, 0);
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
                    this.chunks[key] = new Chunk(cx, cz, this.chunkSize, this.scene, this.game);
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
    
    clear() {
        for (const key in this.chunks) {
            this.chunks[key].dispose();
        }
        this.chunks = {};
    }

    // Precise Box vs Point/Radius Collision
    checkCollision(x, z, radius = 0.5) {
        const cx = Math.round(x / this.chunkSize);
        const cz = Math.round(z / this.chunkSize);
        
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${cx + i},${cz + j}`;
                const chunk = this.chunks[key];
                if (!chunk) continue;

                for (const obs of chunk.colliders) {
                    // Calculate bounds of the obstacle
                    const minX = obs.x - obs.width / 2;
                    const maxX = obs.x + obs.width / 2;
                    const minZ = obs.z - obs.depth / 2;
                    const maxZ = obs.z + obs.depth / 2;

                    // Find closest point on the box to the entity
                    const closestX = Math.max(minX, Math.min(x, maxX));
                    const closestZ = Math.max(minZ, Math.min(z, maxZ));

                    // Calculate distance from that closest point to the entity center
                    const dx = x - closestX;
                    const dz = z - closestZ;
                    const distSq = dx * dx + dz * dz;

                    // If distance is less than entity radius, we are colliding
                    if (distSq < radius * radius) {
                        return true; 
                    }
                }
            }
        }
        return false;
    }
}

window.WorldManager = WorldManager;
