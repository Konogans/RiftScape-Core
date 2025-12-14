/**
 * Player entity - handles player character, abilities, and pedalboard system.
 * 
 * @class Player
 * @property {Game} game - Reference to Game instance
 * @property {Object} charDef - Character definition from CharacterRegistry
 * @property {Object} actions - Pedalboard actions (primary, secondary, mobility, utility, mastery)
 * @property {PointPool} health - Dual-pool health system (active/reserve)
 * @property {THREE.Mesh} mesh - THREE.js mesh
 * @property {THREE.AnimationMixer} mixer - Animation mixer for model animations
 * @property {Object} animActions - Animation actions by name
 * @property {number} speed - Current movement speed
 * @property {number} attackDamage - Current attack damage
 */
class Player {
    /**
     * Creates a new Player instance.
     * @param {Game} game - Game instance
     * @constructor
     */
    constructor(game) {
        this.game = game;
        
        // 1. SETUP STATS
        const charId = MetaProgression.data.currentCharacter || 'wanderer';
        this.charDef = CharacterRegistry.get(charId);
        this.mods = MetaProgression.getStatMods();
        
        this.baseSpeed = 4.0;
        this.speed = this.baseSpeed * (1 + this.mods.moveSpeed + (this.charDef.stats.moveSpeed||0));
        this.baseAttackDamage = 1 + this.mods.attackDamage + (this.charDef.stats.attackDamage||0);
        this.attackDamage = this.baseAttackDamage;
        
        // 2. STATE
        this.buffs = {};
        this.isInvulnerable = false;
        this.velocityOverride = null; // For dashes/knockbacks
        
        // 3. MESH & HEALTH
        this.initMesh();
        this.initHealth();
        
        // 4. THE PEDALBOARD (Loadout)
        this.actions = {};
        this.initLoadout();
        
        // 5. ABILITY VISUALS (Trails, Rings)
        this.initVisuals();
        
        // 6. UI
        this.initUI();
    }
    
	initLoadout() {
        // Check for custom loadout first, then fall back to default
        const charId = MetaProgression.data.currentCharacter;
        const customLoadout = MetaProgression.data.customLoadouts && MetaProgression.data.customLoadouts[charId];
        const loadoutDef = customLoadout || this.charDef.loadout || {};
        const slots = ['primary', 'secondary', 'mobility', 'utility', 'mastery'];
        
        slots.forEach(slot => {
            const abilityId = loadoutDef[slot];
            if (!abilityId) return;
            
            const def = AbilityRegistry.get(abilityId);
            if (!def) return;
            
            const speedMod = (this.mods.attackSpeed||0) + (this.charDef.stats.attackSpeed||0);
            const speedMult = 1 / (1 + speedMod);
            
            this.actions[slot] = new Action({
                windupTime: def.timing.windup * speedMult,
                actionTime: def.timing.action * speedMult,
                cooldownTime: def.timing.cooldown * speedMult,
                
                onWindup: () => def.onWindup && def.onWindup(this, this.game),
                onAction: () => def.onAction && def.onAction(this, this.game),
                onFinish: () => def.onFinish && def.onFinish(this, this.game),
                // FIX: Pass the onUpdate handler so animations work!
                onUpdate: (action) => def.onUpdate && def.onUpdate(this, this.game, action)
            });
            this.actions[slot].def = def; 
        });
    }
    
    initMesh() {
        // Create fallback cube mesh (always needed as container)
        const geometry = new THREE.BoxGeometry(0.6, 1, 0.6);
        this.baseMaterial = PSXify(new THREE.MeshStandardMaterial({ color: this.charDef.color || 0x44aaff, roughness: 0.4, metalness: 0.6, emissive: 0x112244, emissiveIntensity: 0.3 }));
        this.mesh = new THREE.Mesh(geometry, this.baseMaterial);
        this.mesh.position.y = 0.5;
        this.mesh.castShadow = true;

        const indicatorGeom = new THREE.ConeGeometry(0.15, 0.3, 8);
        const indicatorMat = PSXify(new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.5 }));
        this.indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        this.indicator.rotation.x = Math.PI / 2;
        this.indicator.position.z = -0.4;
        this.mesh.add(this.indicator);

        const attackGeom = new THREE.BoxGeometry(0.8, 0.1, 1.2);
        const attackMat = PSXify(new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1, transparent: true, opacity: 0 }));
        this.attackMesh = new THREE.Mesh(attackGeom, attackMat);
        this.attackMesh.position.z = -0.8;
        this.mesh.add(this.attackMesh);

        // Animation system state
        this.hasModel = false;
        this.mixer = null;
        this.animActions = {};
        this.currentAnim = null;
        this.lastPos = { x: 0, z: 0 };

        // Load model if character has one defined
        if (this.charDef.model && this.charDef.model.path) {
            this.loadModel();
        }
    }

    async loadModel() {
        try {
            const loader = new THREE.GLTFLoader();
            const modelDef = this.charDef.model;

            const glb = await new Promise((resolve, reject) => {
                loader.load(modelDef.path, resolve, undefined, reject);
            });

            // Hide cube, use model instead
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh.geometry = new THREE.BufferGeometry(); // Empty geometry
            this.mesh.material.visible = false;

            // Add model as child
            const model = glb.scene;
            model.scale.setScalar(modelDef.scale || 1.0);
            model.position.y = -0.5; // Adjust for mesh.position.y = 0.5
            model.rotation.y = Math.PI; // Face forward (model exported backward)
            this.mesh.add(model);
            this.modelRoot = model;
            this.hasModel = true;

            // Hide debug visuals (indicator cone, attack mesh)
            if (this.indicator) this.indicator.visible = false;
            if (this.attackMesh) this.attackMesh.visible = false;

            // Store materials for flash effects and reduce shininess
            this.modelMaterials = [];
            model.traverse((child) => {
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
                    child.castShadow = true;
                }
            });

            // Setup animations
            if (glb.animations && glb.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                const animNames = modelDef.animations || {};

                glb.animations.forEach(clip => {
                    const action = this.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    this.animActions[clip.name] = action;

                    // One-shot animations (attack, slam, death, dash)
                    const oneShotAnims = [animNames.attack, animNames.slam, animNames.death, animNames.dash];
                    if (oneShotAnims.includes(clip.name)) {
                        action.setLoop(THREE.LoopOnce, 0);
                        action.clampWhenFinished = true;
                    }

                    // Sync attack animation to primary ability timing
                    if (clip.name === animNames.attack && this.actions.primary) {
                        const timing = this.actions.primary.def.timing;
                        const totalDuration = (timing.windup + timing.action) / 1000;
                        const timeScale = clip.duration / totalDuration;
                        action.setEffectiveTimeScale(timeScale);
                        this.attackTimeScale = timeScale;
                    }

                    // Sync slam animation to secondary ability timing
                    if (clip.name === animNames.slam && this.actions.secondary) {
                        const timing = this.actions.secondary.def.timing;
                        const totalDuration = (timing.windup + timing.action) / 1000;
                        const timeScale = clip.duration / totalDuration;
                        action.setEffectiveTimeScale(timeScale);
                        this.slamTimeScale = timeScale;
                    }
                });

                // Start with idle
                if (animNames.idle && this.animActions[animNames.idle]) {
                    this.playAnim(animNames.idle);
                }
            }

            // Load weapon if defined
            if (modelDef.weapon) {
                this.loadWeapon(model, modelDef.weapon);
            }
        } catch (e) {
            console.warn('[Player] Model load failed:', e);
            // Keep cube fallback
        }
    }

    async loadWeapon(model, weaponDef) {
        try {
            const loader = new THREE.GLTFLoader();
            const glb = await new Promise((resolve, reject) => {
                loader.load(weaponDef.path, resolve, undefined, reject);
            });

            const weapon = glb.scene;
            weapon.scale.setScalar(weaponDef.scale || 1.0);

            // Debug: check weapon contents
            let meshCount = 0;
            weapon.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    child.geometry.computeBoundingBox();
                    const box = child.geometry.boundingBox;
                    console.log(`[Player] Weapon mesh: ${child.name}, bounds:`, box.min, box.max);
                }
            });
            console.log(`[Player] Weapon has ${meshCount} meshes, scale: ${weaponDef.scale || 1.0}`);

            // Find the bone/object to attach to
            let targetBone = null;
            model.traverse((child) => {
                // Match by name - check bones first, then any object
                if (child.name === weaponDef.bone) {
                    targetBone = child;
                }
            });

            if (targetBone) {
                // Store offset transforms
                this.weaponOffset = {
                    position: new THREE.Vector3(
                        weaponDef.position?.x || 0,
                        weaponDef.position?.y || 0,
                        weaponDef.position?.z || 0
                    ),
                    rotation: new THREE.Euler(
                        weaponDef.rotation?.x || 0,
                        weaponDef.rotation?.y || 0,
                        weaponDef.rotation?.z || 0
                    )
                };

                // Reduce shininess on weapon and ensure visibility
                weapon.traverse((child) => {
                    if (child.isMesh) {
                        child.frustumCulled = false;
                        child.castShadow = true;
                        child.visible = true;

                        if (child.material) {
                            // Handle both single materials and material arrays
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            for (const mat of materials) {
                                if (mat.metalness !== undefined) mat.metalness = 0.3;
                                if (mat.roughness !== undefined) mat.roughness = 0.6;
                            }
                        }
                    }
                });

                // Add weapon to mesh container (not bone) - we'll update position manually
                this.mesh.add(weapon);
                this.weapon = weapon;
                this.weaponBone = targetBone;
                console.log(`[Player] Weapon loaded, will follow ${weaponDef.bone}`);
                console.log(`[Player] Use game.player.tweakWeapon(x,y,z, rx,ry,rz) to adjust position/rotation`);
            } else {
                console.warn(`[Player] Attachment point '${weaponDef.bone}' not found. Available objects:`);
                model.traverse((child) => {
                    if (child.name) console.log(`  - ${child.name} (${child.type})`);
                });
            }
        } catch (e) {
            console.warn('[Player] Weapon load failed:', e);
        }
    }

    // Debug helper to adjust weapon position/rotation
    tweakWeapon(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
        if (!this.weaponOffset) {
            console.warn('[Player] No weapon loaded');
            return;
        }
        this.weaponOffset.position.set(x, y, z);
        this.weaponOffset.rotation.set(rx, ry, rz);
        console.log(`[Player] Weapon offset updated. Copy to CharacterRegistry:`);
        console.log(`position: { x: ${x}, y: ${y}, z: ${z} },`);
        console.log(`rotation: { x: ${rx}, y: ${ry}, z: ${rz} }`);
    }

    playAnim(name, fadeTime = 0.15) {
        if (!this.animActions || this.currentAnim === name || !this.animActions[name]) return;

        const newAction = this.animActions[name];
        const animNames = this.charDef.model?.animations || {};

        // Stop previous one-shot animation if switching away
        if (this.currentAnim && this.animActions[this.currentAnim]) {
            const oldAction = this.animActions[this.currentAnim];
            const oneShotAnims = [animNames.attack, animNames.slam, animNames.death, animNames.dash];
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
        if (name === animNames.slam && this.slamTimeScale) {
            newAction.setEffectiveTimeScale(this.slamTimeScale);
        }

        this.currentAnim = name;
    }
    
	initHealth() {
        const baseActive = 5 + this.mods.maxHealth + this.charDef.stats.maxHealth;
        const baseReserve = 10 + this.mods.maxReserve + this.charDef.stats.maxReserve;
        
        // NERF: Reduced base regen from 0.5 to 0.1 (5x slower)
        const baseRegen = 0.1 + this.mods.regenRate; 
        
        this.health = new PointPool({ 
            active: baseActive, 
            reserve: baseReserve, 
            regen: baseRegen, // This now only affects Active pool
            reserveRegen: 0,  // Explicitly 0. Reserve requires pickups.
            onChanged: () => this.updateHealthUI(), 
            onReachZero: () => this.onDeath() 
        });
    }
	
	initVisuals() {
        // DASH TRAIL
        // Save the MATERIAL to 'this.dashTrailMaterial' so the Registry can fade it
        this.dashTrailMaterial = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0 });
        this.dashTrail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), this.dashTrailMaterial);
        this.dashTrail.visible = false;
        this.game.scene.add(this.dashTrail);
        
        // SLAM RING
        // Save the MATERIAL to 'this.slamRingMaterial' so the Registry can fade it
        this.slamRingMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0, side: THREE.DoubleSide });
        this.slamRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 3, 32), this.slamRingMaterial);
        this.slamRing.rotation.x = -Math.PI/2;
        this.slamRing.visible = false;
        this.game.scene.add(this.slamRing);
    }
	
	initAttack() {
        const self = this;
        
        // 1. STATS CALCULATION
        const totalSpeedMod = this.mods.attackSpeed + this.charDef.stats.attackSpeed;
        const speedMult = 1 / (1 + totalSpeedMod);
        const weaponType = this.charDef.weapon || 'standard';

        // 2. WEAPON TUNING
        let windup = 200, action = 150, cooldown = 350;
        
        if (weaponType === 'heavy') { 
            // Ironclad: Slow, heavy recoil
            windup = 300; action = 100; cooldown = 800; 
        } else if (weaponType === 'swift') { 
            // Weaver: Machine gun rapid fire
            windup = 50; action = 100; cooldown = 200; 
        }

        // 3. THE ACTION DEFINITION
        this.attackAction = new Action({
            windupTime: windup * speedMult,
            actionTime: action * speedMult,
            cooldownTime: cooldown * speedMult,
            
            onWindup: () => { 
                // Visual Telegraph
                if (weaponType === 'standard') {
                    // Show Sword Swipe
                    self.attackMesh.material.opacity = 0.3; 
                    self.attackMesh.position.z = -0.4; 
                    self.attackMesh.scale.set(0.5, 1, 0.5); 
                } else {
                    // Gun Charge-up (Flash)
                    self.baseMaterial.emissiveIntensity = 1.0;
                }
            },
            
            onAction: () => { 
                self.game.screenShake(0.1, 2);
                
                // === A. WANDERER (MELEE) ===
                if (weaponType === 'standard') {
                    self.attackMesh.material.opacity = 0.8; 
                    self.attackMesh.position.z = -1.0; 
                    self.attackMesh.scale.set(1, 1, 1); 
                    self.performAttackHit(); 
                } 
                
                // === B. IRONCLAD (SHOTGUN) ===
                else if (weaponType === 'heavy') {
                    // Forward direction
                    const baseAngle = self.mesh.rotation.y + Math.PI; 
                    // Recoil (Push player back)
                    const knockX = Math.sin(baseAngle) * 0.5;
                    const knockZ = Math.cos(baseAngle) * 0.5;
                    self.mesh.position.x -= knockX; 
                    self.mesh.position.z -= knockZ;

                    // Spawn 5 Pellets
                    const count = 5;
                    const spread = 0.8; // ~45 degrees
                    const pelletDmg = self.attackDamage * 0.4; // 40% dmg per pellet (200% total if point blank)
                    
                    for (let i = 0; i < count; i++) {
                        // Calculate fan angle
                        const angle = baseAngle - (spread/2) + (spread * (i/(count-1)));
                        const p = new PlayerProjectile(self.game, self.mesh.position.x, self.mesh.position.z, angle, 'shrapnel', pelletDmg);
                        self.game.entities.push(p); 
                        self.game.scene.add(p.mesh);
                    }
                }
                
                // === C. WEAVER (HOMING) ===
                else if (weaponType === 'swift') {
                    const angle = self.mesh.rotation.y + Math.PI;
                    // Lower damage per shot, but high fire rate
                    const boltDmg = self.attackDamage * 0.7; 
                    
                    const p = new PlayerProjectile(self.game, self.mesh.position.x, self.mesh.position.z, angle, 'bolt', boltDmg);
                    self.game.entities.push(p);
                    self.game.scene.add(p.mesh);
                }
            },
            
            onCooldown: () => { 
                self.attackMesh.material.opacity = 0.2; 
                self.baseMaterial.emissiveIntensity = 0.3; // Reset flash
            },
            
            onFinish: () => { 
                self.attackMesh.material.opacity = 0; 
                self.attackMesh.position.z = -0.8; 
                self.attackMesh.scale.set(1, 1, 1); 
            },
            
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
        if (!this.game.hud) return;
        
        // Sync Labels
        const map = {
            mobility: 'slot_mobility',
            secondary: 'slot_secondary',
            utility: 'slot_utility',
            mastery: 'slot_mastery'
        };
        
        for (const [slot, hudId] of Object.entries(map)) {
            if (this.actions[slot]) {
                // Use the Ability Name (First word or short code)
                let name = this.actions[slot].def.name.split(' ')[0].toUpperCase();
                // Shorten huge names
                if (name.length > 5) name = name.substring(0, 4);
                this.game.hud.setAbilityLabel(hudId, name);
            } else {
                this.game.hud.setAbilityLabel(hudId, '-');
            }
        }
        
        this.updateHealthUI();
    }
    
    updateHealthUI() {
        if (this.game && this.game.hud) {
            this.game.hud.updateHealth(this.health);
        }
    }
    
    updateActionUI(action) {
        if (this.game && this.game.hud) {
            this.game.hud.updateAction(action);
        }
    }
    
	performAttackHit(range = 1.5, damage = 1) {
        const attackPos = new THREE.Vector3();
        this.attackMesh.getWorldPosition(attackPos);
        if (this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.mesh) continue;
                if (attackPos.distanceTo(enemy.mesh.position) < range) enemy.takeDamage(damage);
            }
        }
    }
    
    onDeath() {
        this.dead = true;

        this.game.screenShake(0.4, 8); // Heavy impact shake

        // Play death animation if available
        if (this.hasModel && this.charDef.model?.animations?.death) {
            this.playAnim(this.charDef.model.animations.death);

            // Delay game over until animation plays
            const deathAction = this.animActions[this.charDef.model.animations.death];
            const deathDuration = deathAction ? deathAction.getClip().duration : 1.0;

            setTimeout(() => {
                this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, 0x44aaff, 20);
                this.mesh.visible = false;
                this.game.triggerGameOver();
            }, deathDuration * 1000);
        } else {
            // Fallback: immediate death
            this.mesh.visible = false;
            this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, 0x44aaff, 20);
            this.game.triggerGameOver();
        }
    }
    
    flashDamage() {
        this.game.screenShake(0.2, 5);
        this.game.spawnParticleBurst(this.mesh.position.x, this.mesh.position.z, 0xff4444, 6);

        if (this.hasModel && this.modelMaterials) {
            // Flash model white then restore
            for (const entry of this.modelMaterials) {
                const mat = entry.material;
                if (mat.emissive) mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 5.0;
            }
            setTimeout(() => {
                for (const entry of this.modelMaterials) {
                    const mat = entry.material;
                    if (mat.emissive) mat.emissive.setHex(entry.emissive || 0x000000);
                    mat.emissiveIntensity = entry.emissiveIntensity;
                }
            }, 50);
        } else {
            this.baseMaterial.emissive.setHex(0xff0000);
            this.baseMaterial.emissiveIntensity = 1;
            setTimeout(() => {
                this.baseMaterial.emissive.setHex(0x112244);
                this.baseMaterial.emissiveIntensity = 0.3;
            }, 100);
        }
    }

    flashHeal() {
        if (this.hasModel && this.modelMaterials) {
            for (const entry of this.modelMaterials) {
                const mat = entry.material;
                if (mat.emissive) mat.emissive.setHex(0x00ff44);
                mat.emissiveIntensity = 3.0;
            }
            setTimeout(() => {
                for (const entry of this.modelMaterials) {
                    const mat = entry.material;
                    if (mat.emissive) mat.emissive.setHex(entry.emissive || 0x000000);
                    mat.emissiveIntensity = entry.emissiveIntensity;
                }
            }, 100);
        } else {
            this.baseMaterial.emissive.setHex(0x00ff44);
            this.baseMaterial.emissiveIntensity = 1;
            setTimeout(() => {
                this.baseMaterial.emissive.setHex(0x112244);
                this.baseMaterial.emissiveIntensity = 0.3;
            }, 100);
        }
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
    
	// Called when buying upgrades to pull fresh Meta data
    refreshStats() {
        // 1. Re-fetch Meta Mods
        this.mods = MetaProgression.getStatMods();
        
        // 2. Update Base Stats (Stats from Character + Meta)
        this.baseSpeed = 4.0 * (1 + this.mods.moveSpeed + (this.charDef.stats.moveSpeed||0));
        this.baseAttackDamage = 1 + this.mods.attackDamage + (this.charDef.stats.attackDamage||0);
        
        // 3. Update Health Pools (Grow max, keep current ratio or just add flat?)
        // Simple approach: Update max, current stays same (percentage drops)
        const oldMaxActive = this.health.maxActive;
        const oldMaxReserve = this.health.maxReserve;
        
        this.health.maxActive = 5 + this.mods.maxHealth + (this.charDef.stats.maxHealth||0);
        this.health.maxReserve = 10 + this.mods.maxReserve + (this.charDef.stats.maxReserve||0);
        
        // Optional: Heal the difference if you want upgrades to feel good immediately
        if (this.health.maxActive > oldMaxActive) this.health.active += (this.health.maxActive - oldMaxActive);
        if (this.health.maxReserve > oldMaxReserve) this.health.reserve += (this.health.maxReserve - oldMaxReserve);
        
        this.health.activeRegen = 0.1 + this.mods.regenRate;

        // 4. Re-run Buff calculations
        this.recalculateStats();
        
        // 5. Update HUD immediately
        this.updateHealthUI();
		this.updateEssenceUI();
    }

    recalculateStats() {
        // Start from the (possibly updated) base
        this.speed = this.baseSpeed;
        this.attackDamage = this.baseAttackDamage;
        
        // Apply Buffs
        if (this.buffs.speed) this.speed *= this.buffs.speed.multiplier;
        if (this.buffs.damage) this.attackDamage *= this.buffs.damage.multiplier;
        
        // Debug
        // console.log(`Stats: Spd ${this.speed.toFixed(1)}, Dmg ${this.attackDamage.toFixed(1)}`);
    }
    
	update(deltaTime, elapsed) {
        if (this.game.dialogueSystem && this.game.dialogueSystem.isOpen) return;

        // Update weapon to follow bone (runs even when dead)
        if (this.weapon && this.weaponBone) {
            this.weaponBone.updateWorldMatrix(true, false);
            const boneWorldPos = new THREE.Vector3();
            const boneWorldQuat = new THREE.Quaternion();
            this.weaponBone.getWorldPosition(boneWorldPos);
            this.weaponBone.getWorldQuaternion(boneWorldQuat);

            // Convert world position to local (relative to this.mesh)
            this.mesh.worldToLocal(boneWorldPos);
            this.weapon.position.copy(boneWorldPos);
            if (this.weaponOffset) {
                this.weapon.position.add(this.weaponOffset.position);
            }

            // Apply bone rotation + offset (convert world to local space)
            const meshWorldQuat = new THREE.Quaternion();
            this.mesh.getWorldQuaternion(meshWorldQuat);
            meshWorldQuat.invert();
            this.weapon.quaternion.copy(meshWorldQuat).multiply(boneWorldQuat);
            if (this.weaponOffset) {
                const offsetQuat = new THREE.Quaternion().setFromEuler(this.weaponOffset.rotation);
                this.weapon.quaternion.multiply(offsetQuat);
            }
        }

        // Keep updating mixer for death animation even when dead
        if (this.dead) {
            if (this.mixer) this.mixer.update(deltaTime);
            return;
        }

        this.health.update(deltaTime);
        this.updateBuffs(deltaTime);

        // 1. UPDATE ACTIONS
        for (const slot in this.actions) {
            this.actions[slot].update(deltaTime * 1000);
        }

        const input = this.game.input;
        
        // 2. INPUT & CANCELLING
        
        // Helper to check cost/conditions before triggering
        const tryTrigger = (action) => {
            if (action.def.canActivate) {
                if (!action.def.canActivate(this)) {
                    // Optional: Feedback for "Not enough energy"
                    // this.game.spawnFloatingText(this.mesh.position.x, this.mesh.position.z, "NO ENERGY", 0xff0000, 0.5);
                    return false;
                }
            }
            return action.trigger();
        };

        // --- PRIMARY (Left Click) ---
        if (this.actions.primary) {
            if (this.actions.primary.status === 'windup' && !input.isMouseHeld(0)) {
                this.actions.primary.reset();
                if(this.actions.primary.def.onFinish) this.actions.primary.def.onFinish(this, this.game);
                this.updateActionUI(this.actions.primary);
            }
            if (input.isMouseHeld(0)) tryTrigger(this.actions.primary);
        }

        // --- SECONDARY (Right Click) ---
        if (this.actions.secondary) {
            if (this.actions.secondary.status === 'windup' && !input.isMouseHeld(2)) {
                if (this.actions.secondary.def.releaseToFire) {
                    this.actions.secondary.currentTime = this.actions.secondary.windupTime; // COMMIT
                } else {
                    this.actions.secondary.reset(); // CANCEL
                    if(this.actions.secondary.def.onFinish) this.actions.secondary.def.onFinish(this, this.game);
                    this.updateActionUI(this.actions.secondary);
                }
            }
            if (input.isMouseHeld(2)) tryTrigger(this.actions.secondary);
        }

        // --- UTILITY (Q) ---
        if (this.actions.utility) {
            if (this.actions.utility.status === 'windup' && !input.isHeld('KeyQ')) {
                if (this.actions.utility.def.releaseToFire) {
                    this.actions.utility.currentTime = this.actions.utility.windupTime; // COMMIT
                } else {
                    this.actions.utility.reset(); // CANCEL
                    if(this.actions.utility.def.onFinish) this.actions.utility.def.onFinish(this, this.game);
                }
            }
            if (input.wasPressed('KeyQ')) tryTrigger(this.actions.utility);
        }

        // --- MOBILITY & MASTERY ---
        if (this.actions.mobility && input.wasPressed('ShiftLeft')) tryTrigger(this.actions.mobility);
        if (this.actions.mastery && input.wasPressed('KeyF')) tryTrigger(this.actions.mastery);

        // 3. MOVEMENT LOGIC
        let moveSpeed = this.speed;
        
        // FIX: Movement Locking
        // Windup = Slow (0.5x), Action = STOP (0x), Cooldown = Full
        if (this.actions.primary) {
            if (this.actions.primary.status === 'windup') moveSpeed *= 0.5;
            if (this.actions.primary.status === 'action') moveSpeed = 0; // Lock feet while swinging
        }
        
        // Velocity Override (Dash)
        if (this.velocityOverride) {
            this.velocityOverride.time -= deltaTime;
            const nextX = this.mesh.position.x + this.velocityOverride.x * deltaTime;
            const nextZ = this.mesh.position.z + this.velocityOverride.z * deltaTime;
            
            if (this.game.world) {
                if (!this.game.world.checkCollision(nextX, this.mesh.position.z, 0.3)) this.mesh.position.x = nextX;
                if (!this.game.world.checkCollision(this.mesh.position.x, nextZ, 0.3)) this.mesh.position.z = nextZ;
            } else {
                this.mesh.position.x = nextX; this.mesh.position.z = nextZ;
            }
            if (this.velocityOverride.time <= 0) this.velocityOverride = null;
            
        } else {
            // Standard Movement
            const movement = input.getMovementVector();
            const mousePos = this.game.getMouseWorldPosition();
            const dx = mousePos.x - this.mesh.position.x;
            const dz = mousePos.z - this.mesh.position.z;
            const mouseAngle = Math.atan2(dx, dz) + Math.PI;

            // Only move if speed > 0 (prevents sliding during attack)
            if ((movement.x !== 0 || movement.z !== 0) && moveSpeed > 0) {
                const moveDist = moveSpeed * deltaTime;
                const nextX = this.mesh.position.x + movement.x * moveDist;
                const nextZ = this.mesh.position.z + movement.z * moveDist;
                
                let canMoveX = true;
                if (this.game.world && this.game.world.checkCollision(nextX, this.mesh.position.z)) canMoveX = false;
                let canMoveZ = true;
                if (this.game.world && this.game.world.checkCollision(this.mesh.position.x, nextZ)) canMoveZ = false;
                
                if (canMoveX) this.mesh.position.x = nextX;
                if (canMoveZ) this.mesh.position.z = nextZ;
                
                if (!input.isMouseHeld(0)) this.mesh.rotation.y = Math.atan2(movement.x, movement.z) + Math.PI;
            }
            
		
			// FIX: AIM OVERRIDE
			// Check if ANY action is active (Primary, Secondary, Utility, etc.)
			// Exception: Mobility (dash) should face movement direction, not mouse
			let isAiming = input.isMouseHeld(0); // Always aim if LMB held

			// Check slots for 'windup' or 'action' status (exclude mobility)
			const aimSlots = ['primary', 'secondary', 'utility', 'mastery'];
			for (const slot of aimSlots) {
				if (this.actions[slot]) {
					const status = this.actions[slot].status;
					if (status === 'windup' || status === 'action') {
						isAiming = true;
						break;
					}
				}
			}

			if (isAiming) {
				this.mesh.rotation.y = mouseAngle;
			}
        }

		// 4. HUD UPDATES
        if (this.game.hud) {
            if (this.actions.primary) this.game.hud.updateAction(this.actions.primary);
            
            // Helper to update generic slots
            const updateSlot = (action, hudId) => {
                if (action) {
                    let cd = 0;
                    if (action.status === 'cooldown') {
                        cd = 1 - (action.currentTime - action.windupTime - action.actionTime) / action.cooldownTime;
                    } else if (action.status !== 'idle') {
                        cd = 1; 
                    }
                    
                    // CHECK COST
                    let affordable = true;
                    if (action.def.canActivate) {
                        affordable = action.def.canActivate(this);
                    }
                    
                    this.game.hud.setAbilityIcon(hudId, cd <= 0, cd, affordable);
                } else {
                    this.game.hud.setAbilityIcon(hudId, false, 0); 
                }
            };

            updateSlot(this.actions.mobility, 'slot_mobility');
            updateSlot(this.actions.secondary, 'slot_secondary');
            updateSlot(this.actions.utility, 'slot_utility');
            updateSlot(this.actions.mastery, 'slot_mastery');
        }

        // 5. ANIMATION STATE MACHINE
        if (this.mixer) {
            this.mixer.update(deltaTime);
            this.updatePlayerAnimation(deltaTime);
        } else {
            // Fallback bob animation for cube
            const bobAmount = (this.actions.primary && this.actions.primary.status === 'idle' && !this.velocityOverride) ? 0.03 : 0.01;
            this.mesh.position.y = 0.5 + Math.sin(elapsed * 3) * bobAmount;
        }
    }

    updatePlayerAnimation(deltaTime) {
        if (!this.hasModel || !this.charDef.model) return;

        const animNames = this.charDef.model.animations;
        if (!animNames) return;

        // Priority: Death > Dash > Slam > Attack > Run/Walk/Idle

        // Check for special ability animations
        const mobilityAction = this.actions.mobility;
        const secondaryAction = this.actions.secondary;
        const primaryAction = this.actions.primary;

        // Dash animation (mobility in windup or action)
        if (mobilityAction && (mobilityAction.status === 'windup' || mobilityAction.status === 'action')) {
            if (animNames.dash) this.playAnim(animNames.dash);
            return;
        }

        // Slam animation (secondary in windup or action, if it's the slam ability)
        if (secondaryAction && secondaryAction.def && secondaryAction.def.name === 'Seismic Slam') {
            if (secondaryAction.status === 'windup' || secondaryAction.status === 'action') {
                if (animNames.slam) this.playAnim(animNames.slam);
                return;
            }
        }

        // Attack animation (primary in windup or action)
        if (primaryAction && (primaryAction.status === 'windup' || primaryAction.status === 'action')) {
            if (animNames.attack) this.playAnim(animNames.attack);
            return;
        }

        // Locomotion based on actual speed
        const pos = this.mesh.position;
        const dx = pos.x - (this.lastPos?.x || pos.x);
        const dz = pos.z - (this.lastPos?.z || pos.z);
        const distMoved = Math.sqrt(dx * dx + dz * dz);
        const actualSpeed = distMoved / Math.max(deltaTime, 0.001);
        this.lastPos = { x: pos.x, z: pos.z };

        if (actualSpeed > 3.0 && animNames.run) {
            this.playAnim(animNames.run);
        } else if (actualSpeed > 0.5 && animNames.walk) {
            this.playAnim(animNames.walk);
        } else if (animNames.idle) {
            this.playAnim(animNames.idle);
        }
    }
	
	updateEssenceUI() {
        // The HUD updateStats method expects three arguments: time, kills, essence.
        // When in the hub, time/kills are fixed, so we only need to pass the banked essence.
        if (this.game && this.game.hud && this.game.currentBiome === 'sanctuary') {
             // We can pass the static hub run stats, but replace the essence with the banked value.
             this.game.hud.updateStats('--:--', '-', MetaProgression.data.essence);
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
	
	takeDamage(amount) {
        // 1. Invulnerability Checks
        if (this.dead || this.isInvulnerable || this.isDashing) return;

        // 2. Apply Damage
        this.health.delta(-amount);
        
        // 3. Feedback
        this.flashDamage();
        
        // Note: The Health Pool's 'onChanged' callback handles the HUD update automatically
    }
}
