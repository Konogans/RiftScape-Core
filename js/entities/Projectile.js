
class Projectile {
    constructor(game, x, z, targetX, targetZ, speed, damage) {
        this.game = game; this.speed = speed; this.damage = damage || 1; this.dead = false;
        const dx = targetX - x; const dz = targetZ - z; const dist = Math.sqrt(dx * dx + dz * dz);
        this.velX = (dx / dist) * speed; this.velZ = (dz / dist) * speed;
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0xaa44ff, emissiveIntensity: 0.8 }));
        this.mesh.position.set(x, 0.5, z);
        this.lifetime = 3;
    }
    update(deltaTime) {
        if (this.dead) return;
        
        // Move
        this.mesh.position.x += this.velX * deltaTime;
        this.mesh.position.z += this.velZ * deltaTime;
        
        // 1. CHECK PLAYER COLLISION
        const playerRadius = this.game.player.radius || 0.5;
        const projectileRadius = 0.15;
        if (this.mesh.position.distanceTo(this.game.player.mesh.position) < playerRadius + projectileRadius) {
            if (!this.game.player.isInvulnerable) {
                // Now using the standardized takeDamage method we added
                this.game.player.takeDamage(this.damage);
            }
            this.dead = true; 
            this.shouldRemove = true; 
            return;
        }
        
        // 2. CHECK STRUCTURE COLLISION (The Fix)
        if (this.game.structures) {
            for (const s of this.game.structures) {
                if (s.dead) continue;
                
                // Projectile radius (0.15) + Structure radius (stored on entity or default 0.7)
                const hitDist = (s.radius || 0.7) + 0.15;
                const distSq = (s.x - this.mesh.position.x)**2 + (s.z - this.mesh.position.z)**2;
                
                if (distSq < hitDist * hitDist) {
                    if (s.takeDamage) s.takeDamage(this.damage);
                    this.dead = true;
                    this.shouldRemove = true;
                    return;
                }
            }
        }
        
        // 3. CHECK RIFT GATE COLLISION
        const gate = this.game.riftGate;
        if (gate && !gate.dead) {
            // Gate is big (radius ~2.5), projectile is small
            const dist = this.mesh.position.distanceTo(gate.mesh.position);
            const hitDist = (gate.radius || 2.5) + 0.15;
            
            if (dist < hitDist) {
                gate.takeDamage(this.damage);
                this.dead = true;
                this.shouldRemove = true;
                return;
            }
        }

        // Lifetime
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) { this.dead = true; this.shouldRemove = true; }
    }
    dispose() { if(this.mesh.geometry) this.mesh.geometry.dispose(); if(this.mesh.material) this.mesh.material.dispose(); }
}
