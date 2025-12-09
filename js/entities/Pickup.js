
class Pickup {
    constructor(game, x, z, type, value) {
        this.game = game; this.type = type; this.def = PickupRegistry.get(type); this.value = value || 1;
        this.dead = false; this.shouldRemove = false; this.lifetime = this.def.lifetime; this.spawnTime = 0;
        this.initMesh(x, z);
    }
    initMesh(x, z) {
        const scale = this.def.scale; let geometry;
        if (this.def.shape === 'octahedron') geometry = new THREE.OctahedronGeometry(scale);
        else if (this.def.shape === 'tetrahedron') geometry = new THREE.TetrahedronGeometry(scale);
        else geometry = new THREE.SphereGeometry(scale, 8, 8);
        this.material = new THREE.MeshStandardMaterial({ color: this.def.color, emissive: this.def.emissive, emissiveIntensity: this.def.emissiveIntensity, roughness: 0.3, metalness: 0.7 });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, 0.3, z);
        this.baseY = 0.3; this.rotSpeed = 1 + Math.random() * 2;
    }
    update(deltaTime, elapsed) {
        if (this.dead) return;
        this.spawnTime += deltaTime; this.lifetime -= deltaTime;
        if (this.lifetime <= 0) { this.dead = true; this.shouldRemove = true; return; }
        if (this.lifetime < 3) this.mesh.visible = (Math.sin(this.lifetime * 10) > 0);
        this.mesh.position.y = this.baseY + Math.sin(elapsed * this.def.bobSpeed) * this.def.bobHeight;
        this.mesh.rotation.y += deltaTime * this.rotSpeed;
        const playerPos = this.game.player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < this.def.magnetRange) {
            const magnetStrength = 8 * (1 - dist / this.def.magnetRange);
            this.mesh.position.add(playerPos.clone().sub(this.mesh.position).normalize().multiplyScalar(magnetStrength * deltaTime));
        }
        if (dist < this.def.collectRange) this.collect();
    }
    collect() {
        if (this.dead) return;
        this.dead = true; this.shouldRemove = true;
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, this.def.color, 5);
        if (this.def.onCollect) this.def.onCollect(this.game, this);
    }
    dispose() { if(this.mesh.geometry) this.mesh.geometry.dispose(); if(this.material) this.material.dispose(); }
}
