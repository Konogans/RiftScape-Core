class Boss extends Enemy {
    constructor(game, x, z, type) {
        super(game, x, z, type);

        // 2. Boss Specifics (Match Registry)
        this.scale = 1.8;
        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.mesh.position.y = 0.9; // Adjusted Y for 1.8 scale

        this.mesh.material.color.setHex(0x222222);
        this.mesh.material.emissive.setHex(0xff0000);

        this.state = 'chase';
        this.stateTimer = 0;
        this.moveSpeed = this.speed;

        // Define explicit radius for collision checks (Fat hitbox)
        this.radius = 0.9;

        // Animation
        this.mixer = null;
        this.animActions = {};
        this.currentAnim = null;

        // Load model if defined
        if (this.def.model) {
            this.loadModel();
        }

		// NEW: MOSH WARNING RING
        // Reusing the player's Slam logic but purple and attached to the Boss
        const ringGeo = new THREE.RingGeometry(0.5, 4.5, 32); // 4.5m Radius
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        this.moshRing = new THREE.Mesh(ringGeo, ringMat);
        this.moshRing.rotation.x = -Math.PI / 2;
        this.moshRing.visible = false;

        // Add to SCENE (not mesh) so it stays flat on floor even if boss tilts/bobs
        this.game.scene.add(this.moshRing);
    }

    async loadModel() {
        try {
            const loader = new THREE.GLTFLoader();
            const modelDef = this.def.model;
            const modelPath = typeof modelDef === 'string' ? modelDef : modelDef.path;
            const x = this.mesh.position.x;
            const z = this.mesh.position.z;
            const scale = modelDef.scale || this.scale || 1.8;

            const glb = await new Promise((resolve, reject) => {
                const cacheBuster = '?v=' + Date.now();
                loader.load(modelPath + cacheBuster, resolve, undefined, reject);
            });

            // Store parent before replacing mesh
            const parent = this.mesh.parent;
            if (!parent) return;

            // Cleanup old mesh completely (like Enemy.js)
            parent.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();

            // Replace mesh with GLB scene
            this.mesh = glb.scene;
            this.mesh.position.set(x, 0, z);
            this.mesh.scale.setScalar(scale);
            this.hasModel = true;

            // Store materials for flash effects and reduce shininess
            this.modelMaterials = [];
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    for (const mat of materials) {
                        if (mat.metalness !== undefined) mat.metalness = 0.1;
                        if (mat.roughness !== undefined) mat.roughness = 0.8;
                        this.modelMaterials.push({
                            material: mat,
                            color: mat.color ? mat.color.getHex() : null,
                            emissive: mat.emissive ? mat.emissive.getHex() : null,
                            emissiveIntensity: mat.emissiveIntensity || 0
                        });
                    }
                    child.castShadow = true;
                }
            });

            parent.add(this.mesh);

            // Setup animations
            if (glb.animations && glb.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.mesh);
                const animNames = modelDef.animations || {};

                glb.animations.forEach(clip => {
                    const action = this.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    this.animActions[clip.name] = action;
                });

                // Configure attack animation (like Enemy.js)
                if (animNames.attack && this.animActions[animNames.attack]) {
                    const action = this.animActions[animNames.attack];
                    action.setLoop(THREE.LoopOnce, 0);
                    action.clampWhenFinished = true;

                    // Sync with attack timing
                    if (this.def.attackTiming) {
                        const t = this.def.attackTiming;
                        const totalDuration = (t.windup + t.action + t.cooldown) / 1000;
                        const timeScale = action.getClip().duration / totalDuration;
                        this.attackTimeScale = timeScale;
                        action.setEffectiveTimeScale(timeScale);
                    }
                }

                // Configure mosh animation - sync with mosh duration (3 seconds)
                if (animNames.mosh && this.animActions[animNames.mosh]) {
                    const action = this.animActions[animNames.mosh];
                    const moshDuration = 3.0; // matches stateTimer in startMosh
                    const timeScale = action.getClip().duration / moshDuration;
                    this.moshTimeScale = timeScale;
                    action.setEffectiveTimeScale(timeScale);
                }

                // Configure death animation
                if (animNames.death && this.animActions[animNames.death]) {
                    const action = this.animActions[animNames.death];
                    action.setLoop(THREE.LoopOnce, 0);
                    action.clampWhenFinished = true;
                }

                // Start with idle
                if (animNames.idle && this.animActions[animNames.idle]) {
                    this.playAnim(animNames.idle);
                }

                console.log(`[Boss] Model loaded: ${modelPath}, animations:`, Object.keys(this.animActions));
            }
        } catch (e) {
            console.warn('[Boss] Model load failed:', e);
        }
    }

    playAnim(name, fadeTime = 0.2) {
        if (!this.animActions || this.currentAnim === name || !this.animActions[name]) return;

        const newAction = this.animActions[name];
        const animNames = this.def.model?.animations || {};

        // Stop previous one-shot anims
        if (this.currentAnim && this.animActions[this.currentAnim]) {
            const oldAction = this.animActions[this.currentAnim];
            const oneShotAnims = [animNames.attack, animNames.death];
            if (oneShotAnims.includes(this.currentAnim)) {
                oldAction.stop();
            }
            newAction.reset();
            newAction.play();
            newAction.crossFadeFrom(oldAction, fadeTime, true);
        } else {
            newAction.reset();
            newAction.play();
        }

        // Re-apply timeScale after reset() clears it
        if (name === animNames.attack && this.attackTimeScale) {
            newAction.setEffectiveTimeScale(this.attackTimeScale);
        }
        if (name === animNames.mosh && this.moshTimeScale) {
            newAction.setEffectiveTimeScale(this.moshTimeScale);
        }

        this.currentAnim = name;
    }

    updateBossAnimation() {
        if (!this.mixer || !this.def.model?.animations) return;

        const animNames = this.def.model.animations;

        // Death takes priority
        if (this.dead) {
            if (animNames.death) this.playAnim(animNames.death);
            return;
        }

        // State-based animations
        if (this.state === 'charge') {
            // Use run animation for charging
            if (animNames.run) this.playAnim(animNames.run);
        } else if (this.state === 'mosh') {
            if (animNames.mosh) this.playAnim(animNames.mosh);
        } else if (this.state === 'recover') {
            // Use idle for recovery (panting/vulnerable)
            if (animNames.idle) this.playAnim(animNames.idle);
        } else if (this.state === 'chase') {
            // Check if attacking
            if (this.attackAction.status === 'windup' || this.attackAction.status === 'action') {
                if (animNames.attack) this.playAnim(animNames.attack);
            } else if (this.inRange) {
                // In range but not attacking - idle
                if (animNames.idle) this.playAnim(animNames.idle);
            } else {
                // Walking while chasing
                if (animNames.walk) this.playAnim(animNames.walk);
            }
        }
    }
	
	// Cleanup required since we added to scene manually
    dispose() {
        super.dispose();
        if (this.moshRing) {
            this.game.scene.remove(this.moshRing);
            this.moshRing.geometry.dispose();
            this.moshRing.material.dispose();
        }
    }
    
    // Override update to use custom Boss Logic
    update(deltaTime, elapsed) {
        // Update mixer even when dead (for death animation)
        if (this.mixer) this.mixer.update(deltaTime);

        if (this.dead) {
            this.updateBossAnimation();
            return;
        }

        this.health.update(deltaTime);

        // Update attack action state machine (required for damage to be dealt)
        this.attackAction.update(deltaTime * 1000);

        // Decrement attack cooldown
        this.attackCooldown -= deltaTime * 1000;

        // Flash timer logic
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            if (this.flashTimer <= 0) {
                // Restore materials after flash
                if (this.hasModel && this.modelMaterials) {
                    for (const entry of this.modelMaterials) {
                        const mat = entry.material;
                        if (mat.color && entry.color !== null) mat.color.setHex(entry.color);
                        if (mat.emissive && entry.emissive !== null) mat.emissive.setHex(entry.emissive);
                        mat.emissiveIntensity = entry.emissiveIntensity;
                    }
                } else if (this.material) {
                    // Restore cube material
                    this.material.color.setHex(this.def.color || 0x222222);
                    this.material.emissive.setHex(0xff0000);
                }
            }
        }

        // BOSS AI: " The Setlist"
        this.stateTimer -= deltaTime;
        
        if (this.state === 'chase') {
            // Standard Chase (Gate Priority)
            const result = BehaviorSystem.execute(this, 'chase', deltaTime, this.game);
            this.inRange = result.inRange; // Store for animation

            // Trigger Special Moves randomly
            if (this.stateTimer <= 0) {
                const roll = Math.random();
                if (roll < 0.4) this.startCharge();
                else if (roll < 0.7) this.startMosh();
                else this.stateTimer = 2.0; // Keep chasing
            }

            // Melee Attack (if close)
            if (result.inRange && this.attackCooldown <= 0) {
                this.attackAction.trigger();
                this.attackCooldown = 2000;

                // Boss explicitly damages RiftGate if in melee range
                const gate = this.game.riftGate;
                if (gate && !gate.dead) {
                    const distToGate = this.mesh.position.distanceTo(gate.mesh.position);
                    const gateReach = this.attackRange + gate.radius + 0.5;
                    if (distToGate < gateReach) {
                        gate.takeDamage(this.damage);
                    }
                }
            }
            
        } else if (this.state === 'charge') {
            // Rushes forward blindly
            this.performCharge(deltaTime);
            
        } else if (this.state === 'mosh') {
            // Spams AoE
            this.performMosh(deltaTime);
            
        } else if (this.state === 'recover') {
            // Panting (Vulnerable)
            if (this.stateTimer <= 0) {
                this.state = 'chase';
                this.stateTimer = 3.0;
                if (!this.hasModel) this.mesh.material.emissiveIntensity = 0.5;
            }
        }

        // Update animations based on state
        this.updateBossAnimation();
    }
    
    startCharge() {
        this.state = 'charge';
        this.stateTimer = 2.0; // Charge duration
        if (!this.hasModel) this.mesh.material.emissive.setHex(0xffff00); // Warning Yellow
        this.game.sound.play('error'); // Telegraph Sound

        // Aim at current target (gate, player, or structure)
        const target = this.currentTarget || this.game.player;
        const targetPos = target.mesh ? target.mesh.position : target.position;
        this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
    }
    
    performCharge(dt) {
        const speed = 15.0;
        const moveDist = speed * dt;
        
        // Calculate velocity vector based on rotation
        const vx = Math.sin(this.mesh.rotation.y) * moveDist;
        const vz = Math.cos(this.mesh.rotation.y) * moveDist;
        
        const nextX = this.mesh.position.x + vx;
        const nextZ = this.mesh.position.z + vz;
        
        // 1. COLLISION CHECK (World/Walls)
        let blocked = false;
        if (this.game.world) {
            // Check collision with a larger radius (0.8)
            if (this.game.world.checkCollision(nextX, nextZ, 0.8)) {
                blocked = true;
            }
        }
        
        // 2. IMPACT LOGIC
        if (blocked) {
            this.game.screenShake(0.3, 5);
            this.game.spawnParticleBurst(nextX, nextZ, 0x888888, 10); // Dust
            
            // Check if we hit a Structure specifically
            // (The world check doesn't tell us WHAT we hit, so we scan structures)
            for (const s of this.game.structures) {
                if (s.dead) continue;
                const dist = Math.sqrt((s.x - nextX)**2 + (s.z - nextZ)**2);
                if (dist < 1.5) {
                    s.takeDamage(10); // Smash the wall
                }
            }

            // Check if we hit the RiftGate
            const gate = this.game.riftGate;
            if (gate && !gate.dead) {
                const gateDist = this.mesh.position.distanceTo(gate.mesh.position);
                if (gateDist < gate.radius + 1.5) {
                    gate.takeDamage(15); // Charge into gate
                }
            }

            // End Charge
            this.state = 'recover';
            this.stateTimer = 1.5;
            return;
        }
        
        // 3. MOVE
        this.mesh.position.x = nextX;
        this.mesh.position.z = nextZ;
        
        // 4. PLAYER HIT CHECK
        const hitRange = 2.0;
        const playerDist = this.mesh.position.distanceTo(this.game.player.mesh.position);
        
        if (playerDist < hitRange) {
            this.game.player.takeDamage(2);
            this.game.screenShake(0.5, 8);
            this.game.player.velocityOverride = {
                x: Math.sin(this.mesh.rotation.y) * 20,
                z: Math.cos(this.mesh.rotation.y) * 20,
                time: 0.2
            };
            this.state = 'recover';
            this.stateTimer = 1.5;
        }
        
        if (this.stateTimer <= 0) {
            this.state = 'recover';
            this.stateTimer = 1.0;
        }
    }
    
    startMosh() {
        this.state = 'mosh';
        this.stateTimer = 3.0; // Duration
        if (!this.hasModel) this.mesh.material.emissive.setHex(0xff00ff); // Purple Haze
        this.moshPulse = 0;
		
		// SHOW RING
        this.moshRing.visible = true;
        this.moshRing.position.copy(this.mesh.position);
        this.moshRing.position.y = 0.1;
        this.moshRing.material.opacity = 0.5;
        this.moshRing.scale.set(0.1, 0.1, 0.1); // Start small
        
        this.game.sound.play('build'); // Warning Chime
    }
    
    performMosh(dt) {
        // VISUAL: Expand Ring to match AoE range (4.5)
        // Lerp scale up
        this.moshRing.position.copy(this.mesh.position);
        this.moshRing.position.y = 0.1;
        this.moshRing.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 2);
        
        this.moshPulse -= dt;
        if (this.moshPulse <= 0) {
            this.moshPulse = 0.8; // Slower pulses (more telegraph)
            
            this.game.screenShake(0.3, 5);
            this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, 0xff00ff, 20);
            this.game.sound.play('shotgun'); // BOOM
            
            // AoE Damage Logic ...
            const range = 4.5; // Match Visuals
			
            // 1. Player
            if (this.mesh.position.distanceTo(this.game.player.mesh.position) < range) {
                this.game.player.takeDamage(1);
            }
            
            // 2. Structures
            this.game.structures.forEach(s => {
                if (!s.dead && s.mesh.position.distanceTo(this.mesh.position) < range) {
                    s.takeDamage(3);
                }
            });
            
            // 3. FIX: Rift Gate
            const gate = this.game.riftGate;
            if (gate && !gate.dead) {
                const dist = this.mesh.position.distanceTo(gate.mesh.position);
                // Gate Radius (2.5) + AoE Range (4.5) logic? 
                // Simple distance check to center is usually fine for AoE
                if (dist < range + 2.0) { 
                    gate.takeDamage(5); // Boss screams at the crystal
                }
            }
        }
        
        if (this.stateTimer <= 0) {
            this.state = 'recover';
            this.stateTimer = 2.0;
            this.moshRing.visible = false; // Hide Ring
        }
    }
}