class RiftGate {
    constructor(game, x, z) {
        this.game = game;
        this.health = 300;
        this.maxHealth = 300;
        this.dead = false;
        
        this.initMesh(x, z);
        
        // Register as Obstacle (3x3)
        if (this.game.world) {
            this.game.world.registerObstacle(x, z, 3, 3);
        }
    }

    initMesh(x, z) {
		this.radius = 2.5;
        // 1. Base
        const geometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 8);
        const material = PSXify(new THREE.MeshStandardMaterial({ color: 0x333333 }));
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.25, z);
        
        // 2. The Crystal
        const crystalGeo = new THREE.OctahedronGeometry(1.5, 0);
        const crystalMat = PSXify(new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x0088ff, 
            emissiveIntensity: 0.8,
            roughness: 0.2
        }));
        this.crystal = new THREE.Mesh(crystalGeo, crystalMat);
        this.crystal.position.y = 2.5;
        this.mesh.add(this.crystal);
        
        // 3. Floating Label
        this.addLabel("RIFT GATE [READY]");
    }
    
    addLabel(text) {
        if (this.label) this.mesh.remove(this.label);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512; canvas.height = 64;
        ctx.font = "bold 32px Courier New";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(text, 256, 40);
        
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.position.y = 5.0;
        sprite.scale.set(8, 1, 1);
        this.label = sprite;
        this.mesh.add(sprite);
    }

    takeDamage(amount) {
        this.health -= amount;
        
        // Visual Feedback
        this.crystal.material.emissive.setHex(0xff0000);
        setTimeout(() => this.crystal.material.emissive.setHex(0x0088ff), 100);
        
        if (this.health <= 0) {
            this.game.raidManager.failRaid();
        }
    }

    update(dt, elapsed) {
        // Float animation
        this.crystal.position.y = 2.5 + Math.sin(elapsed) * 0.2;
        this.crystal.rotation.y += dt;
        
        // Interaction: Start Raid or Enter Rift
        const dist = this.mesh.position.distanceTo(this.game.player.mesh.position);
        if (dist < 4.0 && this.game.input.wasPressed('KeyE')) {
            
            // CHECK RAID STATE
            if (this.game.raidManager) {
                if (this.game.raidManager.active) {
                    // Raid active? Maybe just show status or do nothing
                    this.game.spawnFloatingText(this.mesh.position.x, this.mesh.position.z, "DEFEND!", 0xff0000);
                } 
                else if (this.game.raidManager.awaitingChoice) {
                    // NEW: Open the Pause Menu
                    this.game.dialogueSystem.openRaidPauseMenu();
                } 
                else {
                    // Standard Menu (Start Raid / Enter Rift)
                    this.game.dialogueSystem.openRiftMenu(this);
                }
            }
        }
    }
	
	dispose() {
        // Dispose Base
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
        
        // FIX: Dispose Crystal & Label
        this.mesh.traverse((child) => {
            if (child.isMesh || child.isSprite) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose(); // Texture
                    child.material.dispose();
                }
            }
        });
    }
}