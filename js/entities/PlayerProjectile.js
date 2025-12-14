const GLOW_TEXTURE = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
})();

class PlayerProjectile {
    constructor(game, x, z, angle, type, damage) {
        this.game = game;
        this.type = type; 
        this.damage = damage;
        this.dead = false;
        
        // 1. CONFIGURATION
        if (type === 'shrapnel') {
            this.speed = 18;
            this.life = 0.35; 
            this.size = 0.15;
            this.color = 0xffaa44;
            this.homing = false;
        } else { // bolt
            this.speed = 12;
            this.life = 1.5; 
            this.size = 0.25;
            this.color = 0x8844ff;
            this.homing = true;
        }

        // 2. PHYSICS
        this.velocity = { 
            x: Math.sin(angle) * this.speed, 
            z: Math.cos(angle) * this.speed 
        };

		// 3. MESH 
        const geometry = new THREE.SphereGeometry(this.size);
        const material = new THREE.MeshBasicMaterial({ color: this.color });
        this.material = window.PSXify ? PSXify(material) : material;
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, 1.0, z); 
        
        // FIX: REPLACE LIGHT WITH SPRITE GLOW
        if (this.type === 'bolt') {
            // OLD: const light = new THREE.PointLight(this.color, 1, 3);
            // OLD: this.mesh.add(light);

            // NEW: Fake Glow (Zero performance cost)
            const spriteMat = new THREE.SpriteMaterial({ 
                map: GLOW_TEXTURE, 
                color: this.color, 
                transparent: true, 
                blending: THREE.AdditiveBlending,
                opacity: 0.8
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(2, 2, 2); // Make it larger than the bullet
            this.mesh.add(sprite);
        }
    }

    update(deltaTime) {
        if (this.dead) return;
        
        this.life -= deltaTime;
        if (this.life <= 0) { this.destroy(); return; } // FIX: Call destroy, not dispose

        // HOMING LOGIC
        if (this.homing) {
            let closest = null;
            let minDst = 12.0; // Increased scan range
            
            for (const e of this.game.enemies) {
                if (e.dead) continue;
                const d = this.mesh.position.distanceTo(e.mesh.position);
                if (d < minDst) { minDst = d; closest = e; }
            }
            
            if (closest) {
                const targetX = closest.mesh.position.x;
                const targetZ = closest.mesh.position.z;
                
                // Steer
                const steerStrength = 8.0 * deltaTime; // Snappier turning
                const dx = targetX - this.mesh.position.x;
                const dz = targetZ - this.mesh.position.z;
                
                // Apply steering force
                this.velocity.x += (dx - this.velocity.x) * steerStrength;
                this.velocity.z += (dz - this.velocity.z) * steerStrength;
                
                // FIX: NORMALIZE VELOCITY (The Gas Pedal)
                // Force the bullet to maintain its original speed, no matter how hard it turns.
                const currentSpeed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
                if (currentSpeed > 0) {
                    this.velocity.x = (this.velocity.x / currentSpeed) * this.speed;
                    this.velocity.z = (this.velocity.z / currentSpeed) * this.speed;
                }
            }
        }

        // MOVE
        const nextX = this.mesh.position.x + this.velocity.x * deltaTime;
        const nextZ = this.mesh.position.z + this.velocity.z * deltaTime;

        // WALL COLLISION
        if (this.game.world && this.game.world.checkCollision(nextX, nextZ, 0.1)) {
            this.destroy(); // FIX: Call destroy
            return;
        }

        this.mesh.position.set(nextX, 1.0, nextZ);

        // ENEMY COLLISION
        for (const e of this.game.enemies) {
            if (e.dead) continue;
            const enemyRadius = e.radius || 0.6;
            const projectileRadius = this.size || 0.25;
            const hitDist = enemyRadius + projectileRadius;
            const distSq = (e.mesh.position.x - nextX)**2 + (e.mesh.position.z - nextZ)**2;
            if (distSq < hitDist * hitDist) { 
                e.takeDamage(this.damage);
                this.destroy(); // FIX: Call destroy
                return;
            }
        }
    }

    // FIX: "destroy" initiates the removal from the game
    destroy() {
        if (this.dead) return;
        this.dead = true;
        this.game.safeRemove(this); 
    }

    // FIX: "dispose" is passively called BY safeRemove to clean memory
    // It MUST NOT call safeRemove again.
    dispose() {
        if(this.mesh) {
            if(this.mesh.geometry) this.mesh.geometry.dispose();
            if(this.mesh.material) this.mesh.material.dispose();
        }
    }
}