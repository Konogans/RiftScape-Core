
class Portal {
    constructor(game, x, z, targetBiome) {
        this.game = game; this.targetBiome = targetBiome; this.targetDef = BiomeRegistry.get(targetBiome);
        this.dead = false; this.shouldRemove = false; this.activationDelay = 1; this.age = 0;
        this.initMesh(x, z);
    }
    initMesh(x, z) {
        this.ringMaterial = new THREE.MeshStandardMaterial({ color: 0x8844ff, emissive: 0x4422aa, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
        this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 8, 32), this.ringMaterial);
        this.ring.rotation.x = Math.PI / 2;
        this.innerMaterial = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        this.inner = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), this.innerMaterial);
        this.inner.rotation.x = -Math.PI / 2; this.inner.position.y = 0.01;
        this.mesh = new THREE.Group(); this.mesh.add(this.ring); this.mesh.add(this.inner);
        this.mesh.position.set(x, 0.1, z);
    }
    update(deltaTime, elapsed) {
        if (this.dead) return;
        this.age += deltaTime;
        this.ring.rotation.z += deltaTime * 2; this.inner.rotation.z -= deltaTime * 1.5;
        this.ringMaterial.emissiveIntensity = 0.8 + Math.sin(elapsed * 3) * 0.2;
        this.mesh.scale.setScalar(Math.min(1, this.age * 2));
        if (this.age > this.activationDelay && this.mesh.position.distanceTo(this.game.player.mesh.position) < 1.0) {
            this.dead = true; this.shouldRemove = true; this.game.transitionToBiome(this.targetBiome);
        }
    }
    dispose() { this.ring.geometry.dispose(); this.ringMaterial.dispose(); this.inner.geometry.dispose(); this.innerMaterial.dispose(); }
}
