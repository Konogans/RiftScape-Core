class Structure {
    constructor(game, x, z, type) {
        this.game = game;
        this.def = StructureRegistry.get(type);
        this.health = this.def.health;
        this.dead = false;
        
        // Snap to grid center
        this.x = Math.floor(x) + 0.5;
        this.z = Math.floor(z) + 0.5;
        
        this.initMesh();
		this.radius = Math.max(this.def.width, this.def.depth) * 0.7;
        
        // Register Collision
        if (this.game.world) {
            this.game.world.registerObstacle(this.x, this.z, this.def.width, this.def.depth);
        }
		
		//Register Structure
		this.game.structures.push(this);
		
		// Init Health Bar (Hidden)
        this.initHealthBar();
    }
    
    initMesh() {
        const geo = new THREE.BoxGeometry(this.def.width, this.def.height, this.def.depth);
        const mat = PSXify(new THREE.MeshStandardMaterial({ 
            color: this.def.color, 
            roughness: 0.2, 
            metalness: 0.8 
        }));
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(this.x, this.def.height/2, this.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }
	
	initHealthBar() {
        // 1. The Container (Centers everything above the structure)
        this.barContainer = new THREE.Object3D();
        this.barContainer.position.y = this.def.height + 0.5;
        this.barContainer.visible = false;
        
        // 2. Background (Dark Red) - Centered at 0
        const bgGeo = new THREE.PlaneGeometry(1, 0.15);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide });
        const barBg = new THREE.Mesh(bgGeo, bgMat);
        this.barContainer.add(barBg);
        
        // 3. Foreground (Green)
        // TRICK: Create geometry of width 1, but translate vertices so X=0 is the Left Edge.
        // This means scaling .scale.x will expand from left to right naturally.
        const fgGeo = new THREE.PlaneGeometry(1, 0.15);
        fgGeo.translate(0.5, 0, 0); // Shift so origin is at Left Edge
        
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, side: THREE.DoubleSide });
        this.barFg = new THREE.Mesh(fgGeo, fgMat);
        this.barFg.position.x = -0.5; // Move bar start to left edge of container
        this.barFg.position.z = 0.02; // Lift slightly to avoid Z-fighting
        
        this.barContainer.add(this.barFg);
        this.mesh.add(this.barContainer);
    }
	
    takeDamage(amount) {
        this.health -= amount;
        
        // SHOW BAR
        if (this.barContainer) {
            this.barContainer.visible = true;
            const ratio = Math.max(0, this.health / this.def.health);
            
            // CLEAN SCALING: Just set scale.x
            // Because we translated vertices, it shrinks to the left automatically.
            this.barFg.scale.x = ratio;
            
            if (ratio < 0.3) this.barFg.material.color.setHex(0xff0000);
            else this.barFg.material.color.setHex(0x00ffaa);
        }

        // FIX: Aggressive Flash
        // Save original color if not saved yet
        if (!this.baseColor) this.baseColor = this.mesh.material.color.getHex();
        
        // Flash Red immediately
        this.mesh.material.color.setHex(0xff0000);
        this.mesh.material.emissive.setHex(0xff0000);
        this.mesh.material.emissiveIntensity = 1.0;
        
        // Reset after 50ms
        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        this.flashTimeout = setTimeout(() => {
            if (this.mesh && !this.dead) {
                this.mesh.material.color.setHex(this.baseColor);
                this.mesh.material.emissive.setHex(0x000000);
                this.mesh.material.emissiveIntensity = 0.3; // Reset to baseline
            }
        }, 50);
        
        if (this.health <= 0) {
            this.dead = true;
            this.game.safeRemove(this);
            
            // Unregister
            const idx = this.game.structures.indexOf(this);
            if (idx > -1) this.game.structures.splice(idx, 1);
            
            // Collision Clear
            if (this.game.world) {
                this.game.world.unregisterObstacle(this.x, this.z, this.def.width, this.def.depth);
            }
            
            // Explosion
            this.game.spawnParticleBurst(this.x, this.z, this.def.color, 15);
            this.game.screenShake(0.2, 5);
        }
    }
    
    update(dt) {
        if (this.dead) return;
        if (this.def.onUpdate) this.def.onUpdate(this, dt, this.game);
		
		// Billboard the health bar
		if (this.barContainer && this.barContainer.visible) {
            this.barContainer.lookAt(this.game.camera.position);
        }
    }
    
    dispose() {
        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
		
		if (this.barContainer) {
            this.barContainer.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
        }
    }
}