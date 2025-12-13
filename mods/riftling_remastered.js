/**
 * Riftling Loader V4.4 (Integral File: Attack Timing Refinement)
 * ===================================================================
 * - Adjusts hit timing to occur later in the animation (50%-75%).
 * - Allows animation to be interrupted and transition to Idle/Walk immediately
 * after the hit phase (75%) to prevent overplaying.
 */

if (window.game && window.game.modManager) {
    window.game.modManager.register("Riftling (V4.4)", "4.4", (game, mods) => {
        
        console.log("%c[Riftling V4.4] Registered - Timing Refined", "color: #00FF00; background: #000; padding: 4px;");

        const riftling = EntityRegistry.get('default');
        if (riftling) {
            riftling.model = 'models/Riftling_Clean.glb'; 
        }

        const gltfLoader = new THREE.GLTFLoader();
        let enemyCounter = 0;
        
        // --- 1. PROTOTYPE EXTENSION (Unique Flags) ---
        if (typeof Enemy !== 'undefined') {
            Enemy.prototype.isAttackEnforced = false;
            Enemy.prototype.modAttackClipAction = null; 
            Enemy.prototype.hasHitThisAttack = false; 
        }


        if (typeof Enemy !== 'undefined') {
            
            // --- 2. loadModel PATCH (Initial setup) ---
            mods.patch(Enemy, 'loadModel', async (original, enemy, x, z, scale) => {
                
                enemy.modAttackClipAction = null; 
                enemy.hasHitThisAttack = false;

                if (!enemy.def?.model?.includes('Riftling_Clean')) {
                    return original(x, z, scale);
                }

                try {
                    const glb = await new Promise((res, rej) => {
                        gltfLoader.load('models/Riftling_Clean.glb?v=' + (++enemyCounter), res, undefined, rej);
                    });
                    
                    const scene = glb.scene;

                    if (enemy.mesh?.parent) enemy.mesh.parent.remove(enemy.mesh);

                    enemy.mesh = scene;
                    enemy.mesh.position.set(x, 0, z);
                    enemy.hasModel = true;
                    game.scene.add(enemy.mesh);

                    enemy.mixer = new THREE.AnimationMixer(scene);
                    enemy.animActions = {};
                    enemy.currentAnim = null;
                    enemy.lastPos = { x: x, z: z };
                    
                    glb.animations.forEach(clip => {
                        const action = enemy.mixer.clipAction(clip);
                        action.setLoop(THREE.LoopRepeat); 
                        enemy.animActions[clip.name] = action;

                        if (clip.name.includes('Attack')) {
                            enemy.modAttackClipAction = action;
                            action.setLoop(THREE.LoopOnce, 0); 
                            action.clampWhenFinished = true;
                        }
                    });

                    enemy.playAnim = function(name, fadeTime = 0.15) {
                        if (this.currentAnim === name) return;
                        if (!this.animActions[name]) return;
                        
                        // Reset attack state when transitioning to ANY new animation
                        if (name.includes('Attack')) {
                            this.hasHitThisAttack = false;
                        }
                        
                        // Stop the previous attack action to release clampWhenFinished
                        if (this.modAttackClipAction && this.currentAnim && this.currentAnim.includes('Attack')) {
                            this.modAttackClipAction.stop(); 
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
                        
                        this.currentAnim = name;
                    };

                    enemy.playAnim('Idle');

                } catch (e) {
                    console.error("[Riftling] Load failed:", e);
                    original(x, z, scale);
                }
            });

            // --- 3. update PATCH (Animation Logic) ---
            mods.patch(Enemy, 'update', (original, enemy, dt, elapsed) => {
                original(dt, elapsed);
                
                if (!enemy.mixer || !enemy.playAnim) return;
                
                enemy.mixer.update(dt);
                
                const attackClipName = 'Attack';
                const isCurrentlyAttacking = enemy.currentAnim === attackClipName;
                const attackAction = enemy.modAttackClipAction;

                // --- 1. Dead Check ---
                if (enemy.dead) {
                    enemy.playAnim('Dead');
                    enemy.isAttackEnforced = false;
                    return;
                }
                
                // --- 2. ATTACK ENFORCEMENT & HIT TRIGGER ---
                if (isCurrentlyAttacking && attackAction) {
                    const duration = attackAction.getClip().duration;
                    const timePlayed = attackAction.time;
                    const percentPlayed = timePlayed / duration;

                    // V4.4 TIMING ADJUSTMENT: Longer windup, shorter recovery
                    const windupEndPercent = 0.50;  // Hit starts at 50%
                    const actionEndPercent = 0.75;  // Recovery starts at 75%

                    // A. HIT DETECTION
                    if (percentPlayed >= windupEndPercent && percentPlayed < actionEndPercent) {
                        if (!enemy.hasHitThisAttack) {
                            console.log(`[Riftling HIT] Damage applied at ${Math.round(percentPlayed * 100)}% animation progress.`);
                            // IMPORTANT: REPLACE THIS LINE WITH YOUR GAME'S DAMAGE/HIT CODE
                            // e.g., enemy.dealDamageToTarget(); 
                            // ----------------------------------------------------
                            enemy.hasHitThisAttack = true; 
                        }
                    }

                    // B. ANIMATION ENFORCEMENT
                    if (percentPlayed >= 1.0) {
                        enemy.isAttackEnforced = false;
                    } else if (percentPlayed < actionEndPercent) {
                        // Windup/Action Phase (0% to 75%): MUST continue playing.
                        enemy.isAttackEnforced = true; 
                        return; // BLOCKS movement/idle
                    } else {
                        // Recovery Phase (After 75%): Allow transition out immediately.
                        enemy.isAttackEnforced = false;
                    }
                } else {
                    enemy.isAttackEnforced = false;
                }
                
                // --- 3. Attack Trigger ---
                const cooldownMax = enemy.attackCooldownTime || 1500;
                const cooldownNow = enemy.attackCooldown || 0;
                const shouldAttack = cooldownNow > cooldownMax * 0.85; 

                if (shouldAttack) {
                    if (enemy.currentAnim !== attackClipName) {
                        
                        enemy.playAnim(attackClipName); 
                        
                        if (attackAction) {
                            attackAction.reset(); 
                            attackAction.play(); 
                        }
                    }
                    return; // Prioritize Attack trigger
                }
                
                // --- 4. MOVEMENT STATES ---
                if (enemy.isAttackEnforced) {
                    return; 
                }
                
                const pos = enemy.mesh.position;
                const dx = pos.x - (enemy.lastPos?.x || pos.x);
                const dz = pos.z - (enemy.lastPos?.z || pos.z);
                const distMoved = Math.sqrt(dx * dx + dz * dz);
                const actualSpeed = distMoved / Math.max(dt, 0.001);
                enemy.lastPos = { x: pos.x, z: pos.z };

                if (actualSpeed > 2.0) {
                    enemy.playAnim('Running');
                } else if (actualSpeed > 0.3) {
                    enemy.playAnim('Walking');
                } else {
                    enemy.playAnim('Idle');
                }
            });
        }
    });
}