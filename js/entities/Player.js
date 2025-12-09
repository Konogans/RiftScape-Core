
class Player {
    constructor(game) {
        this.game = game;
        this.mods = MetaProgression.getStatMods();
        this.baseSpeed = 5;
        this.speed = this.baseSpeed * (1 + this.mods.moveSpeed);
        this.baseAttackDamage = 1 + this.mods.attackDamage;
        this.attackDamage = this.baseAttackDamage;
        this.buffs = {};
        this.abilityCooldowns = { dash: 0, slam: 0 };
        this.isDashing = false; this.dashTimer = 0; this.dashDirection = { x: 0, z: 0 };
        this.isInvulnerable = false;
        this.isSlamming = false; this.slamTimer = 0; this.slamHit = false;
        
        this.initMesh();
        this.initHealth();
        this.initAttack();
        this.initAbilities();
        this.initUI();
    }
    
    initMesh() {
        const geometry = new THREE.BoxGeometry(0.6, 1, 0.6);
        this.baseMaterial = new THREE.MeshStandardMaterial({ color: 0x44aaff, roughness: 0.4, metalness: 0.6, emissive: 0x112244, emissiveIntensity: 0.3 });
        this.mesh = new THREE.Mesh(geometry, this.baseMaterial);
        this.mesh.position.y = 0.5;
        this.mesh.castShadow = true;
        
        const indicatorGeom = new THREE.ConeGeometry(0.15, 0.3, 8);
        const indicatorMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.5 });
        this.indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        this.indicator.rotation.x = Math.PI / 2;
        this.indicator.position.z = -0.4;
        this.mesh.add(this.indicator);
        
        const attackGeom = new THREE.BoxGeometry(0.8, 0.1, 1.2);
        const attackMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1, transparent: true, opacity: 0 });
        this.attackMesh = new THREE.Mesh(attackGeom, attackMat);
        this.attackMesh.position.z = -0.8;
        this.mesh.add(this.attackMesh);
    }
    
    initHealth() {
        const baseActive = 5 + this.mods.maxHealth;
        const baseReserve = 10 + this.mods.maxReserve;
        const baseRegen = 0.5 + this.mods.regenRate;
        this.health = new PointPool({ active: baseActive, reserve: baseReserve, regen: baseRegen, onChanged: () => this.updateHealthUI(), onReachZero: () => this.onDeath() });
    }
    
    initAttack() {
        const self = this;
        const speedMult = 1 / (1 + this.mods.attackSpeed);
        this.attackAction = new Action({
            windupTime: 150 * speedMult, actionTime: 100 * speedMult, cooldownTime: 250 * speedMult,
            onWindup: () => { self.attackMesh.material.opacity = 0.3; self.attackMesh.position.z = -0.4; self.attackMesh.scale.set(0.5, 1, 0.5); },
            onAction: () => { self.attackMesh.material.opacity = 0.8; self.attackMesh.position.z = -1.0; self.attackMesh.scale.set(1, 1, 1); self.game.screenShake(0.1, 2); self.performAttackHit(); },
            onCooldown: () => { self.attackMesh.material.opacity = 0.2; },
            onFinish: () => { self.attackMesh.material.opacity = 0; self.attackMesh.position.z = -0.8; self.attackMesh.scale.set(1, 1, 1); },
            onUpdate: (action) => { self.updateActionUI(action); }
        });
    }
    
    initAbilities() {
        this.dashTrailMaterial = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0 });
        this.dashTrail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), this.dashTrailMaterial);
        this.dashTrail.visible = false;
        this.game.scene.add(this.dashTrail);
        
        this.slamRingMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0, side: THREE.DoubleSide });
        this.slamRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 32), this.slamRingMaterial);
        this.slamRing.rotation.x = -Math.PI / 2;
        this.slamRing.visible = false;
        this.game.scene.add(this.slamRing);
    }
    
    initUI() {
        this.ui = {
            healthActive: document.getElementById('health-active'),
            healthMax: document.getElementById('health-max'),
            healthReserve: document.getElementById('health-reserve'),
            actionBar: document.getElementById('action-bar'),
            actionBarFill: document.getElementById('action-bar-fill'),
            actionLabel: document.getElementById('action-label')
        };
        this.updateHealthUI();
    }
    
    updateHealthUI() {
        this.ui.healthActive.style.width = (this.health.getActiveRatio() * 100) + '%';
        this.ui.healthMax.style.width = (this.health.getCurrentMaxRatio() * 100) + '%';
        this.ui.healthReserve.style.width = (this.health.getReserveRatio() * 100) + '%';
    }
    
    updateActionUI(action) {
        this.ui.actionBarFill.style.width = (action.getTotalProgress() * 100) + '%';
        this.ui.actionBar.className = action.status;
        const labels = { idle: 'Ready', windup: 'Charging...', action: 'STRIKE!', cooldown: 'Recovering' };
        this.ui.actionLabel.textContent = labels[action.status] || 'Ready';
    }
    
    performAttackHit() {
        const attackPos = new THREE.Vector3();
        this.attackMesh.getWorldPosition(attackPos);
        if (this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.mesh) continue;
                if (attackPos.distanceTo(enemy.mesh.position) < 1.5) enemy.takeDamage(this.attackDamage);
            }
        }
    }
    
    onDeath() { this.dead = true; this.game.triggerGameOver(); }
    
    flashDamage() {
        this.baseMaterial.emissive.setHex(0xff0000); this.baseMaterial.emissiveIntensity = 1;
        this.game.screenShake(0.2, 5);
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, 0xff4444, 6);
        setTimeout(() => { this.baseMaterial.emissive.setHex(0x112244); this.baseMaterial.emissiveIntensity = 0.3; }, 100);
    }
    
    flashHeal() {
        this.baseMaterial.emissive.setHex(0x00ff44); this.baseMaterial.emissiveIntensity = 1;
        setTimeout(() => { this.baseMaterial.emissive.setHex(0x112244); this.baseMaterial.emissiveIntensity = 0.3; }, 100);
    }
    
    applyBuff(type, multiplier, duration) {
        this.buffs[type] = { multiplier: multiplier, remaining: duration, total: duration };
        this.recalculateStats();
    }
    
    updateBuffs(deltaTime) {
        let needsRecalc = false;
        for (const type in this.buffs) {
            this.buffs[type].remaining -= deltaTime;
            if (this.buffs[type].remaining <= 0) { delete this.buffs[type]; needsRecalc = true; }
        }
        if (needsRecalc) this.recalculateStats();
    }
    
    recalculateStats() {
        this.speed = this.baseSpeed * (1 + this.mods.moveSpeed);
        this.attackDamage = this.baseAttackDamage;
        if (this.buffs.speed) this.speed *= this.buffs.speed.multiplier;
        if (this.buffs.damage) this.attackDamage *= this.buffs.damage.multiplier;
    }
    
    update(deltaTime, elapsed) {
        if (this.dead) return;
        const input = this.game.input;
        
        for (const id in this.abilityCooldowns) if (this.abilityCooldowns[id] > 0) this.abilityCooldowns[id] -= deltaTime;
        for (const ability of AbilityRegistry.list()) if (ability.onUpdate) ability.onUpdate(this, this.game, deltaTime);
        
        if (!this.isDashing && !this.isSlamming) {
            // Get Aim Direction
            const mousePos = this.game.getMouseWorldPosition();
            const dx = mousePos.x - this.mesh.position.x;
            const dz = mousePos.z - this.mesh.position.z;
            const mouseAngle = Math.atan2(dx, dz) + Math.PI;

            if (this.attackAction.status === 'idle' || this.attackAction.status === 'cooldown') {
                const movement = input.getMovementVector();
                const isMoving = movement.x !== 0 || movement.z !== 0;

                // ROTATION: Move direction if running, otherwise look at mouse
                if (isMoving) {
                     this.mesh.rotation.y = Math.atan2(movement.x, movement.z) + Math.PI;
                } else {
                     this.mesh.rotation.y = mouseAngle;
                }
                
                // MOVEMENT
                if (isMoving) {
                    const moveDist = this.speed * deltaTime;
                    const nextX = this.mesh.position.x + movement.x * moveDist;
                    const nextZ = this.mesh.position.z + movement.z * moveDist;
                    
                    let canMoveX = true;
                    if (this.game.world && this.game.world.checkCollision(nextX, this.mesh.position.z)) canMoveX = false;
                    
                    let canMoveZ = true;
                    if (this.game.world && this.game.world.checkCollision(this.mesh.position.x, nextZ)) canMoveZ = false;
                    
                    if (canMoveX) this.mesh.position.x = nextX;
                    if (canMoveZ) this.mesh.position.z = nextZ;
                }
            } else if (this.attackAction.status === 'windup') {
                // Aim at mouse while charging
                this.mesh.rotation.y = mouseAngle;
                
                // Allow movement while charging
                const movement = input.getMovementVector();
                if (movement.x !== 0 || movement.z !== 0) {
                    const moveDist = (this.speed * 0.7) * deltaTime; // Slower while charging
                    const nextX = this.mesh.position.x + movement.x * moveDist;
                    const nextZ = this.mesh.position.z + movement.z * moveDist;
                     let canMoveX = true;
                    if (this.game.world && this.game.world.checkCollision(nextX, this.mesh.position.z)) canMoveX = false;
                    
                    let canMoveZ = true;
                    if (this.game.world && this.game.world.checkCollision(this.mesh.position.x, nextZ)) canMoveZ = false;
                    
                    if (canMoveX) this.mesh.position.x = nextX;
                    if (canMoveZ) this.mesh.position.z = nextZ;
                }
                
                // Cancel if button released
                if (!input.isMouseHeld(0)) {
                    this.attackAction.reset();
                    // Visual reset
                    this.attackMesh.material.opacity = 0;
                    this.ui.actionBarFill.style.width = '0%';
                }
            }
            
            // Abilities
            for (const ability of AbilityRegistry.list()) {
                let triggered = false;
                if (ability.key && input.wasPressed(ability.key)) triggered = true;
                if (ability.altKey && input.wasPressed(ability.altKey)) triggered = true;
                if (ability.mouseButton !== undefined && input.wasMousePressed(ability.mouseButton)) triggered = true;
                
                if (triggered) this.tryAbility(ability.id);
            }
            
            // Start Attack
            if (input.isMouseHeld(0) && this.attackAction.status === 'idle') {
                this.attackAction.trigger();
            }
        }
        
        this.attackAction.update(deltaTime * 1000);
        this.health.update(deltaTime);
        this.updateBuffs(deltaTime);
        
        const bobAmount = (this.attackAction.status === 'idle' && !this.isDashing && !this.isSlamming) ? 0.03 : 0.01;
        this.mesh.position.y = 0.5 + Math.sin(elapsed * 3) * bobAmount;
        
        if (this.attackAction.status === 'idle' && this.attackAction.isComplete) {
            this.ui.actionBarFill.style.width = '0%';
            this.ui.actionLabel.textContent = 'Ready';
            this.attackAction.isComplete = false;
        }
    }
    
    tryAbility(abilityId) {
        const ability = AbilityRegistry.get(abilityId);
        if (ability && ability.canActivate && ability.canActivate(this)) ability.onActivate(this, this.game);
    }
    
    getAbilityCooldownRatio(abilityId) {
        const ability = AbilityRegistry.get(abilityId);
        if (!ability) return 0;
        return Math.max(0, this.abilityCooldowns[abilityId] / ability.cooldown);
    }
}
