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
        // Support both string path and object with path property
        const modelPath = typeof this.def.model === 'string' ? this.def.model : this.def.model.path;
        if (!modelPath) return;

        try {
            // Use model cache to avoid re-parsing GLB for each enemy
            if (!Enemy._modelCache) Enemy._modelCache = {};

            let glb = Enemy._modelCache[modelPath];
            if (!glb) {
                // First time loading this model - parse and cache
                const gltfLoader = new THREE.GLTFLoader();
                glb = await new Promise((resolve, reject) => {
                    gltfLoader.load(modelPath, resolve, undefined, reject);
                });
                Enemy._modelCache[modelPath] = glb;
            }

            const parent = this.mesh.parent;
            if (!this.game.entities.includes(this) && !parent) return;

            // Cleanup old mesh
            if (parent) {
                parent.remove(this.mesh);
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.material) this.material.dispose();
            }

            // Clone the cached model for this instance
            // Use SkeletonUtils if available (for skinned meshes), otherwise basic clone
            if (THREE.SkeletonUtils) {
                this.mesh = THREE.SkeletonUtils.clone(glb.scene);
            } else {
                this.mesh = glb.scene.clone(true);
            }
            this.glbAnimations = glb.animations; // Store for mixer setup
            this.mesh.position.set(x, 0, z);
            this.mesh.scale.setScalar(scale);
            this.hasModel = true;
            this.baseY = 0;

            // Store original materials for hit flash effect and reduce shininess
            this.modelMaterials = [];
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Handle both single materials and material arrays
                    const materials = Array.isArray(child.material) ? child.material : [child.material];

                    for (const mat of materials) {
                        // Reduce metallic/shiny look
                        if (mat.metalness !== undefined) mat.metalness = 0.1;
                        if (mat.roughness !== undefined) mat.roughness = 0.8;

                        this.modelMaterials.push({
                            material: mat,
                            color: mat.color ? mat.color.getHex() : null,
                            emissive: mat.emissive ? mat.emissive.getHex() : null,
                            emissiveIntensity: mat.emissiveIntensity || 0
                        });
                    }
                }
            });

            if (parent) parent.add(this.mesh);
            else if (this.game.scene) this.game.scene.add(this.mesh);

            // Setup animation system (use stored animations from cache)
            const animations = this.glbAnimations || glb.animations;
            if (animations && animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.mesh);
                this.animActions = {};
                this.currentAnim = null;
                this.lastPos = { x: x, z: z };
                this.isAttackEnforced = false;
                this.hasHitThisAttack = false;

                // Check for explicit animation mappings in entity definition
                const explicitAnims = this.def.model?.animations;

                animations.forEach(clip => {
                    const action = this.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    this.animActions[clip.name] = action;
                });

                // Use explicit mappings if available, otherwise auto-detect
                if (explicitAnims) {
                    this.idleAnimName = explicitAnims.idle;
                    this.walkAnimName = explicitAnims.walk;
                    this.runAnimName = explicitAnims.run;
                    this.attackAnimName = explicitAnims.attack;
                    this.deathAnimName = explicitAnims.death;
                } else {
                    // Auto-detect from animation names
                    for (const clipName of Object.keys(this.animActions)) {
                        const nameUpper = clipName.toUpperCase();

                        if ((nameUpper.includes('RUN') || nameUpper.includes('SPRINT')) && !this.runAnimName) {
                            this.runAnimName = clipName;
                        }
                        if (nameUpper.includes('WALK') && !this.walkAnimName) {
                            this.walkAnimName = clipName;
                        }
                        if ((nameUpper.includes('IDLE') || nameUpper.includes('STAND') || nameUpper === 'ALERT') && !this.idleAnimName) {
                            this.idleAnimName = clipName;
                        }
                        if (nameUpper.includes('ATTACK') && !this.attackAnimName) {
                            this.attackAnimName = clipName;
                        }
                        if ((nameUpper.includes('DEATH') || nameUpper.includes('DEAD') || nameUpper.includes('DIE') || nameUpper.includes('BEHIT')) && !this.deathAnimName) {
                            this.deathAnimName = clipName;
                        }
                    }

                    // Fallback: if no Attack found but has Skill animations, use highest-numbered Skill
                    if (!this.attackAnimName) {
                        const skillAnims = Object.keys(this.animActions).filter(n => n.toUpperCase().startsWith('SKILL'));
                        if (skillAnims.length > 0) {
                            skillAnims.sort().reverse();
                            this.attackAnimName = skillAnims[0];
                        }
                    }
                }

                // Configure attack animation
                if (this.attackAnimName && this.animActions[this.attackAnimName]) {
                    const action = this.animActions[this.attackAnimName];
                    action.setLoop(THREE.LoopOnce, 0);
                    action.clampWhenFinished = true;
                    this.attackClipAction = action;

                    if (this.def.attackTiming) {
                        const t = this.def.attackTiming;
                        const totalAttackDuration = (t.windup + t.action + t.cooldown) / 1000;
                        const timeScale = action.getClip().duration / totalAttackDuration;
                        this.attackTimeScale = timeScale;
                        action.setEffectiveTimeScale(timeScale);
                    }
                }

                // Configure death animation
                if (this.deathAnimName && this.animActions[this.deathAnimName]) {
                    const action = this.animActions[this.deathAnimName];
                    action.setLoop(THREE.LoopOnce, 0);
                    action.clampWhenFinished = true;
                    this.deathClipAction = action;
                    this.deathClipDuration = action.getClip().duration;
                }

                // Start with idle (or first available locomotion)
                this.playAnim(this.idleAnimName || this.walkAnimName || this.runAnimName || 'Idle');
            }
        } catch (e) {
            console.warn('[Enemy] Model load failed:', e);
            // Keep cube fallback
        }
    }

    /**
     * Play animation with crossFade transition
     * Pattern from mods/riftling_remastered.js (V4.4)
     */
    playAnim(name, fadeTime = 0.15) {
        if (!this.animActions || this.currentAnim === name || !this.animActions[name]) return;

        // Check if this is the attack animation (using stored name)
        const isAttackAnim = this.attackAnimName && name === this.attackAnimName;

        // Reset attack state when transitioning to attack
        if (isAttackAnim) {
            this.hasHitThisAttack = false;
        }

        // Stop previous attack action to release clampWhenFinished
        const wasAttackAnim = this.attackAnimName && this.currentAnim === this.attackAnimName;
        if (this.attackClipAction && wasAttackAnim) {
            this.attackClipAction.stop();
        }

        const newAction = this.animActions[name];

        if (this.currentAnim && this.animActions[this.currentAnim]) {
            const oldAction = this.animActions[this.currentAnim];
            newAction.reset();
            newAction.play();
            newAction.crossFadeFrom(oldAction, fadeTime, true);
        } else {
            newAction.reset();
            newAction.play();
        }

        // Re-apply attack animation timeScale after reset() clears it
        if (isAttackAnim && this.attackTimeScale) {
            newAction.setEffectiveTimeScale(this.attackTimeScale);
        }

        this.currentAnim = name;
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

        // Floating damage text (show even on killing blows)
        if (this.game.spawnFloatingText) {
            this.game.spawnFloatingText(
                this.mesh.position.x,
                this.mesh.position.z,
                `-${amount}`,
                0xff4444
            );
        }

        this.health.delta(-amount);

        // Skip flash if this hit killed us (onDeath already triggered)
        if (this.dead) return;

        // Hit flash - quick pure-white pulse for both cube and model
        if (this.hasModel && this.modelMaterials) {
            for (const entry of this.modelMaterials) {
                const mat = entry.material;
                if (mat.color) mat.color.setHex(0xffffff);
                if (mat.emissive) mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 5.0;
            }
        } else if (this.material) {
            this.material.color.setHex(0xffffff);
            this.material.emissive.setHex(0xffffff);
            this.material.emissiveIntensity = 1.0;
        }

        this.flashTimer = 0.05; // Quick pulse
    }
    
    onDeath() {
        if (this.dead) return;
        this.dead = true;

        // Clear any active flash - restore original materials
        this.flashTimer = 0;
        if (this.hasModel && this.modelMaterials) {
            for (const entry of this.modelMaterials) {
                const mat = entry.material;
                if (mat.color && entry.color !== null) mat.color.setHex(entry.color);
                if (mat.emissive && entry.emissive !== null) mat.emissive.setHex(entry.emissive);
                mat.emissiveIntensity = entry.emissiveIntensity;
            }
        } else if (this.material) {
            this.material.color.setHex(this.def.color);
            this.material.emissive.setHex(this.def.emissive);
            this.material.emissiveIntensity = 0.3;
        }

        this.game.addKill();

        // If we have a death animation, play it before removing
        if (this.deathClipAction && this.mixer && this.deathAnimName) {
            this.playAnim(this.deathAnimName);
            // Delay particle burst and removal until animation finishes
            const deathDuration = this.deathClipDuration || 1.0;
            this.deathTimer = deathDuration;
            this.pendingRemoval = true;
        } else {
            // No death animation - immediate removal
            this.finalizeDeath();
        }
    }

    finalizeDeath() {
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

    teleportNearPlayer() {
        // Find a valid position near the player (similar to spawnEnemy logic)
        const playerPos = this.game.player.mesh.position;
        let x, z, attempts = 0;
        let valid = false;

        while (!valid && attempts < 30) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 8; // Spawn 12-20 units away
            x = playerPos.x + Math.cos(angle) * dist;
            z = playerPos.z + Math.sin(angle) * dist;

            if (this.game.world) {
                if (!this.game.world.checkCollision(x, z, 0.4)) {
                    valid = true;
                }
            } else {
                valid = true;
            }
            attempts++;
        }

        if (valid) {
            this.mesh.position.set(x, this.baseY, z);
            // Update lastPos for animation system
            this.lastPos = { x, z };
        }
        // If no valid position found, enemy stays where it is (rare edge case)
    }

	update(deltaTime, elapsed) {
        // Handle death animation timer
        if (this.pendingRemoval) {
            if (this.mixer) this.mixer.update(deltaTime);
            this.deathTimer -= deltaTime;
            if (this.deathTimer <= 0) {
                this.finalizeDeath();
            }
            return;
        }

        if (this.dead) return;

        // Leash system: teleport enemies that are too far from player
        const playerPos = this.game.player.mesh.position;
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        if (distToPlayer > 40) {
            this.teleportNearPlayer();
        }

        this.health.update(deltaTime);

        // Update animation mixer
        if (this.mixer) this.mixer.update(deltaTime);

        // FIX 1: Time Scale
        this.attackAction.update(deltaTime * 1000);

        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime * 1000;

        // FIX 3: Stop moving when attacking (include cooldown so animation finishes)
        const isAttacking = this.attackAction.status === 'windup' ||
                           this.attackAction.status === 'action' ||
                           this.attackAction.status === 'cooldown';

        if (!isAttacking) {
             // Only move if we aren't busy swinging
             this.updateBehavior(deltaTime);
             const behaviorResult = BehaviorSystem.execute(this, this.currentBehavior, deltaTime, this.game);

             // Check attack trigger
             if (behaviorResult.inRange && this.attackCooldown <= 0) {
                 this.attackAction.trigger();
             }

             // Animation Walk/Idle
             this.updateAnimation(behaviorResult, elapsed, deltaTime);

        } else {
            // If we have a memorized target, look at it. Otherwise default to player.
            const target = this.currentTarget || this.game.player;
            const targetPos = target.mesh ? target.mesh.position : target.position;

            // Safety check in case target died/vanished
            if (targetPos) {
                this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
            }

            // Animation Attack - use stored name or fallback
            if (this.attackAnimName) this.playAnim(this.attackAnimName);
        }

        // Flash timer reset
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            if (this.flashTimer <= 0) {
                // Restore materials after flash
                if (this.hasModel && this.modelMaterials) {
                    // Restore all model materials to original colors
                    for (const entry of this.modelMaterials) {
                        const mat = entry.material;
                        if (mat.color && entry.color !== null) mat.color.setHex(entry.color);
                        if (mat.emissive && entry.emissive !== null) mat.emissive.setHex(entry.emissive);
                        mat.emissiveIntensity = entry.emissiveIntensity;
                    }
                } else if (this.material) {
                    // Restore cube material
                    this.material.color.setHex(this.def.color);
                    this.material.emissive.setHex(this.def.emissive);
                    this.material.emissiveIntensity = 0.3;
                }
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
    
    updateAnimation(behaviorResult, elapsed, deltaTime) {
        // New animation system using playAnim() with speed-based detection
        if (this.mixer && this.animActions) {
            // Speed-based movement detection (from riftling_remastered.js V4.4)
            const pos = this.mesh.position;
            const dx = pos.x - (this.lastPos?.x || pos.x);
            const dz = pos.z - (this.lastPos?.z || pos.z);
            const distMoved = Math.sqrt(dx * dx + dz * dz);
            const actualSpeed = distMoved / Math.max(deltaTime, 0.001);
            this.lastPos = { x: pos.x, z: pos.z };

            // Choose animation based on actual movement speed (use stored names)
            if (actualSpeed > 2.0 && this.runAnimName) {
                this.playAnim(this.runAnimName);
            } else if (actualSpeed > 0.3 && (this.walkAnimName || this.runAnimName)) {
                this.playAnim(this.walkAnimName || this.runAnimName);
            } else if (this.idleAnimName) {
                this.playAnim(this.idleAnimName);
            }
        } else if (this.animController) {
            // Legacy animController fallback
            if (this.attackAction.status === 'windup' || this.attackAction.status === 'action') {
                this.animController.play('attack', { loop: false });
            } else if (behaviorResult.dist > this.attackRange && this.speed > 0) {
                this.animController.play('walk');
            } else {
                this.animController.play('idle');
            }
        } else {
            // Bob animation for cubes (no model)
            this.mesh.position.y = this.baseY + Math.sin(elapsed * 4 + this.mesh.position.x) * 0.02;
        }
    }
    
    dispose() {
        // Cleanup new animation system
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        this.animActions = null;
        this.attackClipAction = null;
        this.attackAnimName = null;
        this.deathClipAction = null;
        this.deathAnimName = null;
        this.runAnimName = null;
        this.walkAnimName = null;
        this.idleAnimName = null;

        // Legacy animController fallback
        if (this.animController) this.animController.dispose();

        // Cleanup all mesh children (eyes, model parts, etc.)
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
        }

        // Cleanup cube material (for non-model enemies)
        if (this.material) this.material.dispose();
    }
}
