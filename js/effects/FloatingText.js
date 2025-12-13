class FloatingText {
    constructor(game, x, z, text, color = 0xffffff, size = 1.0) {
        this.game = game;
        this.life = 1.0; // 1 second lifetime
        
        // Create Sprite
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        
        ctx.font = "bold 40px Courier New";
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.textAlign = "center";
        
        // Add a black outline for readability
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(text, 128, 40);
        ctx.fillText(text, 128, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        
        this.mesh = new THREE.Sprite(material);
        this.mesh.position.set(x, 2.0, z);
        this.mesh.scale.set(2 * size, 0.5 * size, 1);
        
        this.game.scene.add(this.mesh);
    }
    
    update(deltaTime) {
        this.life -= deltaTime;
        
        // Float up
        this.mesh.position.y += 1.5 * deltaTime;
        
        // Fade out
        this.mesh.material.opacity = this.life;
        
        if (this.life <= 0) {
            this.game.scene.remove(this.mesh);
            this.mesh.material.dispose();
            this.mesh.material.map.dispose();
            return false; // Signal to remove from update list
        }
        return true;
    }
}