class Cage {
    constructor(game, x, z, charId) {
        this.game = game;
        this.charId = charId; // 'smith' or 'scribe'
        this.def = CharacterRegistry.get(charId);
        this.dead = false;
        
        this.initMesh(x, z);
    }
    
    initMesh(x, z) {
        // 1. The Cage Bars
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = PSXify(new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            wireframe: true, // Simple cage look
            emissive: 0x222222 
        }));
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 1, z);
        
        // 2. The Prisoner (Visual Ghost)
        const innerGeom = new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const innerMat = PSXify(new THREE.MeshStandardMaterial({ 
            color: this.def.color, 
            transparent: true, 
            opacity: 0.6 
        }));
        this.prisoner = new THREE.Mesh(innerGeom, innerMat);
        this.mesh.add(this.prisoner);
        
        // 3. Floating Label
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.font = "bold 24px Courier New";
        ctx.fillStyle = "#ffcc44";
        ctx.textAlign = "center";
        ctx.fillText("TRAPPED SOUL", 128, 40);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.position.y = 1.5;
        sprite.scale.set(4, 1, 1);
        this.mesh.add(sprite);
    }
    
    update(deltaTime) {
        // Rotate prisoner slowly
        this.prisoner.rotation.y += deltaTime;
        
        // Check for interaction
        const dist = this.mesh.position.distanceTo(this.game.player.mesh.position);
        if (dist < 2.0 && this.game.input.wasPressed('KeyE')) {
            this.unlock();
        }
    }
    
    unlock() {
        this.dead = true;
        this.game.safeRemove(this);
        
        // UNLOCK LOGIC
        if (MetaProgression.unlockCharacter(this.charId)) {
            // First time unlock
            console.log(`UNLOCKED: ${this.def.name}`);
            this.game.dialogueSystem.textEl.textContent = `RESCUE SUCCESSFUL: ${this.def.name} unlocked.`; // Hacky feedback
        } else {
            // Duplicate rescue (Essence reward)
            this.game.runEssence += 30;
        }
		
		if (this.game.world) {
            this.game.world.unregisterObstacle(this.mesh.position.x, this.mesh.position.z, 1, 1);
        }
        
        // FX
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, this.def.color, 20);
        this.game.screenShake(0.3, 5);
    }

    dispose() {
        // Dispose all meshes and materials including children (prisoner, label sprite)
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh || child.isSprite) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
        }
    }
}