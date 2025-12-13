class NPC {
    constructor(game, x, z, name, role, color) {
        this.game = game;
        this.name = name;
        this.role = role; // "blacksmith", "scribe", etc.
        
        this.initMesh(x, z, color);
    }
    
    initMesh(x, z, color) {
        const geometry = new THREE.BoxGeometry(0.6, 1.2, 0.6);
        const material = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.8 
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.6, z);
        this.mesh.castShadow = true;
        
        // Floaty Name
        this.addLabel();
    }
    
    addLabel() {
        // Reuse your Portal label logic here later
        // For now, simple colored marker
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.2),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        marker.position.y = 1.5;
        this.mesh.add(marker);
    }
    
	update(deltaTime, elapsed) {
        // Face the player
        this.mesh.lookAt(this.game.player.mesh.position);
        
        if (this.game.input.wasPressed('KeyE')) {
            const dist = this.mesh.position.distanceTo(this.game.player.mesh.position);
            
            if (dist < 2.5) {
                this.interact();
            }
        }
    }
    
    interact() {
		this.game.dialogueSystem.open(this);
    }
    
    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}