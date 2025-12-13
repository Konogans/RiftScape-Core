// Safety Check
if (window.game && window.game.modManager) {

    // Note: We now use the 'mods' argument (2nd arg) to access the manager
    window.game.modManager.register("CyberKatana", "1.0", (game, mods) => {
        
        console.log("Initializing Cyber Katana Protocol...");

        // 1. ADD WEAPON (Registry Injection)
        // We use the global AbilityRegistry
        if (window.AbilityRegistry) {
            AbilityRegistry.register('cyber_slash', {
                name: 'Neon Edge',
                description: 'High DMG. Drains Essence.',
                type: 'primary',
                timing: { windup: 100, action: 50, cooldown: 200 },
                onWindup: (p) => {
                    p.attackMesh.material.color.setHex(0x00ffff);
                    p.attackMesh.material.opacity = 0.5;
                },
                onAction: (p, game) => {
                    // Huge hit
                    p.performAttackHit(3.0, 10); 
                    
                    // Cyber FX
                    game.spawnParticleBurst(p.mesh.position.x, p.mesh.position.z, 0x00ffff, 20);
                    game.screenShake(0.2, 5);
                    
                    // Cost Logic
                    if (game.currentBiome !== 'sanctuary') {
                        game.runEssence = Math.max(0, game.runEssence - 1);
                    }
                },
                onFinish: (p) => {
                    p.attackMesh.material.opacity = 0;
                }
            });
            
            // Force equip it to the player immediately for testing
            if (game.player) {
                // Manually override the primary slot
                const def = AbilityRegistry.get('cyber_slash');
                
                // We have to rebuild the Action instance for the player
                game.player.actions.primary = new Action({
                    windupTime: def.timing.windup,
                    actionTime: def.timing.action,
                    cooldownTime: def.timing.cooldown,
                    onWindup: () => def.onWindup(game.player, game),
                    onAction: () => def.onAction(game.player, game),
                    onFinish: () => def.onFinish(game.player, game),
                    onUpdate: (a) => game.hud.updateAction(a)
                });
                game.player.actions.primary.def = def;
                game.hud.setAbilityLabel('actionLabel', 'NEON');
                game.spawnFloatingText(game.player.mesh.position.x, game.player.mesh.position.z, "WEAPON EQUIPPED", 0x00ffff);
            }
        }

        // 2. ADD ENEMY (Registry Injection)
        if (window.EntityRegistry) {
            EntityRegistry.register('glitch_demon', {
                name: 'Null Pointer',
                color: 0x111111,
                emissive: 0x00ff00, // Matrix Green
                scale: 1.5,
                speed: { min: 6, max: 8 }, // Fast!
                health: { active: 1, reserve: 0 }, // Glass Cannon
                behavior: 'chase',
                attack: { type: 'melee', range: 1.0 },
                loot: { essence: { chance: 1.0, value: 50 } }
            });
        }

        // 3. MODIFY LOGIC (The Patch)
        // Force spawn Glitch Demons sometimes
        mods.patch(Game, 'spawnEnemy', (original, gameInstance, forceType) => {
            // 20% chance to override, but ONLY if not forcing a type already
            if (!forceType && Math.random() < 0.2) {
                console.log("Mod: Glitch in the system... spawning Null Pointer.");
                original('glitch_demon'); 
            } else {
                original(forceType);
            }
        });

        // 4. RUNTIME VISUALS (The Hook)
        mods.on('update', (dt) => {
            // Matrix Pulse Effect on the world fog
            if (game.scene.fog) {
                const time = Date.now() * 0.002;
                const r = 0;
                const g = Math.sin(time) * 0.1 + 0.1; // Pulse Green
                const b = 0;
                game.scene.fog.color.setRGB(r, g, b);
                game.scene.background.setRGB(r, g, b);
            }
        });
        
        console.log("CyberKatana loaded. Reality compromised.");
    });
}