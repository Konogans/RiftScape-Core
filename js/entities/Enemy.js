
class Enemy {
    constructor(game, x, z, type = 'default') {
        this.game = game;
        this.type = type;
        this.def = EntityRegistry.get(type);
        this.speed = this.def.speed.min + Math.random() * (this.def.speed.max - this.def.speed.min);
        this.attackRange = this.def.attackRange;
        this.attackCooldown = 0;
        this.attackCooldownTime = this.def.attackCooldown;
        this.damage = this.def.damage || 1;
        this.isRanged = this.def.ranged || false;
        this.dead = false;
        this.animController = null;
        this.hasModel = false;
        
        this.initMesh(x, z);
        this.initHealth();
        this.initAttack();
    }
    
    async initMesh(x, z) {
        const scale = this.def.scale;
        const geometry = new THREE.BoxGeometry(0.5 * scale, 0.8 * scale, 0.5 * scale);
        this.material = new THREE.MeshStandardMaterial({
            color: this.def.color, roughness: 0.5, metalness: 0.4,
            emissive: this.def.emissive, emissiveIntensity: 0.3
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, 0.4 * scale, z);
        this.mesh.castShadow = true;
        this.baseY = 0.4 * scale;
        
        const eyeGeom = new THREE.SphereGeometry(0.06 * scale, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.12 * scale, 0.15 * scale, -0.25 * scale);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.12 * scale, 0.15 * scale, -0.25 * scale);
        this.mesh.add(rightEye);

        if (this.def.model) {
            try {
                const { scene, animations } = await ModelLoader.load(this.def.model);
                const parent = this.mesh.parent;
                if (parent) {
                    parent.remove(this.mesh);
                    if(this.mesh.geometry) this.mesh.geometry.dispose();
                    if(this.material) this.material.dispose();
                }

                this.mesh = scene;
                this.mesh.position.set(x, 0, z);
                this.mesh.scale.setScalar(scale);
                this.hasModel = true;
                this.baseY = 0;
                
                if (parent) parent.add(this.mesh);

                if (animations.length > 0 && this.def.animations) {
                    this.animController = new AnimationController(this.mesh, animations, this.def.animations);
                    this.animController.play('idle');
                }
            } catch (e) {
                console.warn(`Model failed for ${this.type}, keeping box.`);
            }
        }
    }
    
    initHealth() {
        this.health = new PointPool({
            active: this.def.health.active, reserve: this.def.health.reserve, regen: 0,
            onReachZero: () => this.onDeath()
        });
    }
    
    initAttack() {
        const self = this;
        const timing = this.def.attackTiming;
        this.attackAction = new Action({
            windupTime: timing.windup, actionTime: timing.action, cooldownTime: timing.cooldown,
            onWindup: () => {
                if(!self.hasModel) { self.material.emissive.setHex(0x881111); self.material.emissiveIntensity = 0.8; }
            },
            onAction: () => {
                if(!self.hasModel) { self.material.emissive.setHex(0xff4444); self.material.emissiveIntensity = 1; }
                if (self.isRanged) {
                    const proj = new Projectile(self.game, self.mesh.position.x, self.mesh.position.z, self.game.player.mesh.position.x, self.game.player.mesh.position.z, self.def.projectileSpeed || 6, self.damage);
                    self.game.projectiles.push(proj); self.game.entities.push(proj); self.game.scene.add(proj.mesh);
                } else {
                    const dist = self.mesh.position.distanceTo(self.game.player.mesh.position);
                    if (dist < self.attackRange + 0.3 && !self.game.player.isInvulnerable) {
                        self.game.player.health.delta(-self.damage);
                        self.game.player.flashDamage();
                    }
                }
            },
            onCooldown: () => {
                if(!self.hasModel) { self.material.emissive.setHex(self.def.emissive); self.material.emissiveIntensity = 0.5; }
            },
            onFinish: () => {
                if(!self.hasModel) { self.material.emissive.setHex(self.def.emissive); self.material.emissiveIntensity = 0.3; }
                self.attackCooldown = self.attackCooldownTime;
            }
        });
    }
    
    takeDamage(amount) {
        if (this.dead) return;
        this.health.delta(-amount);
        if (!this.hasModel) {
            this.material.emissive.setHex(0xffffff); this.material.emissiveIntensity = 1;
            setTimeout(() => { if (!this.dead) { this.material.emissive.setHex(this.def.emissive); this.material.emissiveIntensity = 0.3; } }, 100);
        }
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, this.def.color, 4);
        this.game.screenShake(0.08, 2);
    }
    
    onDeath() {
        this.dead = true;
        if (!this.hasModel) {
            this.material.color.setHex(0x222222); this.material.emissive.setHex(0x000000);
        }
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, this.def.color, 12);
        this.game.screenShake(0.15, 4);
        this.game.addKill();
        
        const x = this.mesh.position.x; const z = this.mesh.position.z;
        const essenceValue = Math.ceil(this.def.health.active + this.def.health.reserve * 0.5);
        this.game.spawnPickup(x, z, 'essence', essenceValue);
        
        const roll = Math.random();
        if (roll < 0.08) this.game.spawnPickup(x + 0.3, z, 'reserve', 2);
        else if (roll < 0.20) this.game.spawnPickup(x + 0.3, z, 'health', 1);
        else if (roll < 0.25) this.game.spawnPickup(x + 0.3, z, 'speed', 1);
        else if (roll < 0.30) this.game.spawnPickup(x + 0.3, z, 'damage', 1);
        
        this.deathTimer = 0;
    }
    
    dispose() {
        if (this.animController) this.animController.dispose();
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    if(child.geometry) child.geometry.dispose();
                    if(child.material) child.material.dispose();
                }
            });
        }
    }
    
    update(deltaTime, elapsed) {
        if (!this.mesh) return;

        if (this.dead) {
            this.deathTimer += deltaTime;
            if (this.hasModel) {
                if(this.animController) this.animController.play('death', { loop: false });
                this.mesh.position.y -= deltaTime * 0.5;
            } else {
                this.mesh.scale.setScalar(Math.max(0, 1 - this.deathTimer * 2));
                this.mesh.position.y = this.baseY - this.deathTimer * 0.5;
            }
            if (this.deathTimer > 0.5) this.shouldRemove = true;
            return;
        }
        
        const playerPos = this.game.player.mesh.position;
        const myPos = this.mesh.position;
        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
        
        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime * 1000;
        this.attackAction.update(deltaTime * 1000);
        
        if (this.attackAction.status === 'idle') {
            const preferredRange = this.isRanged ? this.attackRange * 0.8 : this.attackRange;
            
            // Movement logic with sliding collision
            if (dist > preferredRange) {
                const moveDist = this.speed * deltaTime;
                const vx = (dx / dist) * moveDist;
                const vz = (dz / dist) * moveDist;
                
                let nextX = myPos.x + vx;
                let nextZ = myPos.z + vz;
                
                // FIXED: Check world existence
                if (this.game.world) {
                    if (!this.game.world.checkCollision(nextX, myPos.z)) myPos.x = nextX;
                    if (!this.game.world.checkCollision(myPos.x, nextZ)) myPos.z = nextZ;
                } else {
                    // Fallback if world is broken/missing
                    myPos.x = nextX;
                    myPos.z = nextZ;
                }
            } else if (this.isRanged && dist < this.attackRange * 0.5) {
                myPos.x -= (dx / dist) * this.speed * deltaTime * 0.5;
                myPos.z -= (dz / dist) * this.speed * deltaTime * 0.5;
            }
            if (dist < this.attackRange && this.attackCooldown <= 0) this.attackAction.trigger();
        }
        
        if (this.animController) {
             if (this.attackAction.status === 'windup' || this.attackAction.status === 'action') {
                this.animController.play('attack', { loop: false });
            } else if (dist > this.attackRange && this.speed > 0) {
                this.animController.play('walk');
            } else {
                this.animController.play('idle');
            }
        } else {
            this.mesh.position.y = this.baseY + Math.sin(elapsed * 4 + this.mesh.position.x) * 0.02;
        }
    }
}
