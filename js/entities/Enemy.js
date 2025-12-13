/**
 * Enemy.js (REFACTORED)
 * Now a thin shell that delegates to BehaviorSystem and AttackSystem.
 * 
 * The entity IS the data; this class just gives it a heartbeat.
 */

class Enemy {
    constructor(game, x, z, type = 'default') {
        this.game = game;
        this.type = type;
        this.def = EntityRegistry.get(type);
        
        // Level scaling
        let level = 1, savageness = 1.0;
        if (window.WorldState && WorldState.getCurrentNode()) {
            const node = WorldState.getCurrentNode();
            level = (node.level || 1) + (WorldState.currentFloor || 1) - 1;
            savageness = node.savageness || 1.0;
        }
        this.level = level;
        const difficultyMult = (1 + (level * 0.2)) * savageness;
        
        // Stats from definition
        this.speed = (this.def.speed.min + Math.random() * (this.def.speed.max - this.def.speed.min));
        this.speed *= Math.min(1.5, 1 + (level * 0.01));
        
        this.attackRange = this.def.attack?.range || this.def.attackRange || 1.2;
        this.attackCooldown = 0;
        this.attackCooldownTime = this.def.attackCooldown;
        this.damage = Math.ceil((this.def.damage || 1) * difficultyMult);
        
        this.dead = false;
        this.animController = null;
        this.hasModel = false;
        
        // Behavior state
        this.currentBehavior = this.def.behavior || 'chase';
        this.behaviorSwitchTimer = 0;
        
        this.initMesh(x, z);
        this.initHealth(difficultyMult);
        this.initAttack();
    }
    
    initMesh(x, z) {
        const scale = this.def.scale || 1.0;
        const geometry = new THREE.BoxGeometry(0.5 * scale, 0.8 * scale, 0.5 * scale);
        this.material = PSXify(new THREE.MeshStandardMaterial({
            color: this.def.color,
            roughness: 0.5,
            metalness: 0.4,
            emissive: this.def.emissive,
            emissiveIntensity: 0.3
        }));
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.baseY = 0.4 * scale;
        this.mesh.position.set(x, this.baseY, z);
        this.mesh.castShadow = true;
        
        // Eyes
        const eyeGeom = new THREE.SphereGeometry(0.06 * scale, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.12 * scale, 0.15 * scale, 0.25 * scale);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.12 * scale, 0.15 * scale, 0.25 * scale);
        this.mesh.add(rightEye);
        
        // Model loading (async) - same as before
        if (this.def.model) {
            this.loadModel(x, z, scale);
        }
    }
    
    async loadModel(x, z, scale) {
        try {
            const { scene, animations } = await ModelLoader.load(this.def.model);
            const parent = this.mesh.parent;
            if (!this.game.entities.includes(this) && !parent) return;
            
            if (parent) {
                parent.remove(this.mesh);
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.material) this.material.dispose();
            }
            this.mesh = scene;
            this.mesh.position.set(x, 0, z);
            this.mesh.scale.setScalar(scale);
            this.hasModel = true;
            this.baseY = 0;
            
            if (parent) parent.add(this.mesh);
            else if (this.game.scene) this.game.scene.add(this.mesh);
            
            if (animations.length > 0 && this.def.animations) {
                this.animController = new AnimationController(this.mesh, animations, this.def.animations);
                this.animController.play('idle');
            }
        } catch (e) { /* Model load failed, keep cube */ }
    }
    
    initHealth(difficultyMult) {
        let baseActive = (this.def.health.active || 2) * difficultyMult;
        let baseReserve = (this.def.health.reserve || 2) * difficultyMult;
        if (isNaN(baseActive)) baseActive = 5;
        if (isNaN(baseReserve)) baseReserve = 5;
        
        this.health = new PointPool({
            active: baseActive,
            reserve: baseReserve,
            regen: 0.2,
            reserveRegen: 0,
            onReachZero: () => this.onDeath()
        });
    }
    
    initAttack() {
        // Delegate to AttackSystem
        this.attackAction = AttackSystem.createAction(this, this.game);
    }
    
    takeDamage(amount) {
        if (this.dead) return;
        this.health.delta(-amount);
        
        // Hit flash
        if (!this.baseHex) this.baseHex = this.material?.color?.getHex();
        if (!this.baseEmissive) this.baseEmissive = this.material?.emissive?.getHex();
        
        if (this.material) {
            this.material.color.setHex(0xffffff);
            this.material.emissive.setHex(0xffffff);
            this.material.emissiveIntensity = 1.0;
        }
        
        this.flashTimer = 0.08;
        
        // Floating damage text
        if (this.game.spawnFloatingText) {
            this.game.spawnFloatingText(
                this.mesh.position.x,
                this.mesh.position.z,
                `-${amount}`,
                0xff4444
            );
        }
    }
    
    onDeath() {
        if (this.dead) return;
        this.dead = true;
        
        this.game.addKill();
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, this.def.color, 10);
        
        // Loot drop (from definition)
        this.dropLoot();
        
        this.game.safeRemove(this, this.game.enemies);
    }
    
    dropLoot() {
        const loot = this.def.loot;
        if (!loot) return;
        
        const x = this.mesh.position.x;
        const z = this.mesh.position.z;
        
        for (const [type, def] of Object.entries(loot)) {
            if (Math.random() < def.chance) {
                const value = def.min !== undefined 
                    ? def.min + Math.floor(Math.random() * (def.max - def.min + 1))
                    : def.value || 1;
                this.game.spawnPickup(x + (Math.random() - 0.5), z + (Math.random() - 0.5), type, value);
            }
        }
    }
    
	update(deltaTime, elapsed) {
        if (this.dead) return;
        
        this.health.update(deltaTime);
        
        // FIX 1: Time Scale
        this.attackAction.update(deltaTime * 1000); 
        
        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime * 1000;
        
        // Flash timer... (keep existing code)
        
        // FIX 3: Stop moving when attacking
        const isAttacking = this.attackAction.status === 'windup' || this.attackAction.status === 'action';
        
        if (!isAttacking) {
             // Only move if we aren't busy swinging
             this.updateBehavior(deltaTime);
             const behaviorResult = BehaviorSystem.execute(this, this.currentBehavior, deltaTime, this.game);
             
             // Check attack trigger
             if (behaviorResult.inRange && this.attackCooldown <= 0) {
                 this.attackAction.trigger();
             }
             
             // Animation Walk/Idle
             this.updateAnimation(behaviorResult, elapsed);
             
        } else {
            // If we have a memorized target, look at it. Otherwise default to player.
            const target = this.currentTarget || this.game.player;
            const targetPos = target.mesh ? target.mesh.position : target.position;
            
            // Safety check in case target died/vanished
            if (targetPos) {
                this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
            }
            
            // Animation Attack
            if (this.animController) this.animController.play('attack', { loop: false });
        }
		
		if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            if (this.flashTimer <= 0 && this.material) {
                // FIX: FORCE FACTORY RESET
                // Don't trust 'baseHex' or 'baseEmissive' because they might have captured
                // a temporary attack state (Windup Red). 
                // Always return to the Definition color.
                
                this.material.color.setHex(this.def.color);
                this.material.emissive.setHex(this.def.emissive);
                this.material.emissiveIntensity = 0.3;
                
                // Clear the cache just to be clean
                this.baseHex = null;
                this.baseEmissive = null;
            }
        }
    }
    
    updateBehavior(deltaTime) {
        const switchDef = this.def.behaviorSwitch;
        if (!switchDef) return;
        
        // Check if we should switch behavior
        if (this.currentBehavior !== switchDef.newBehavior) {
            const healthPercent = this.health.active / this.health.maxActive;
            if (switchDef.healthBelow && healthPercent < switchDef.healthBelow) {
                this.currentBehavior = switchDef.newBehavior;
                this.behaviorSwitchTimer = switchDef.revertAfter || 0;
            }
        } else if (this.behaviorSwitchTimer > 0) {
            this.behaviorSwitchTimer -= deltaTime;
            if (this.behaviorSwitchTimer <= 0) {
                this.currentBehavior = this.def.behavior;
            }
        }
    }
    
    updateAnimation(behaviorResult, elapsed) {
        if (this.animController) {
            if (this.attackAction.status === 'windup' || this.attackAction.status === 'action') {
                this.animController.play('attack', { loop: false });
            } else if (behaviorResult.dist > this.attackRange && this.speed > 0) {
                this.animController.play('walk');
            } else {
                this.animController.play('idle');
            }
        } else {
            // Bob animation for cubes
            this.mesh.position.y = this.baseY + Math.sin(elapsed * 4 + this.mesh.position.x) * 0.02;
        }
    }
    
    dispose() {
        if (this.animController) this.animController.dispose();
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}
