
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
        this.mesh.position.x += this.velX * deltaTime;
        this.mesh.position.z += this.velZ * deltaTime;
        if (this.mesh.position.distanceTo(this.game.player.mesh.position) < 0.5) {
            if (!this.game.player.isInvulnerable) {
                this.game.player.health.delta(-this.damage);
                this.game.player.flashDamage();
            }
            this.dead = true; this.shouldRemove = true; return;
        }
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) { this.dead = true; this.shouldRemove = true; }
    }
    dispose() { if(this.mesh.geometry) this.mesh.geometry.dispose(); if(this.mesh.material) this.mesh.material.dispose(); }
}
