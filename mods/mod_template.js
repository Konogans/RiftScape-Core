/**
 * RIFTSCAPE MOD TEMPLATE
 * ----------------------
 * usage: Copy this file, rename it (e.g. 'my_cool_mod.js'), and drag it into the game window.
 * * CORE CONCEPTS:
 * 1. REGISTRIES: Add new content (Weapons, Enemies, Items) by pushing to global Registries.
 * 2. PATCHING:   Change how the game works by wrapping existing class methods.
 * 3. HOOKS:      Run code every frame or on specific events.
 */

// 1. SAFETY CHECK: Ensure the engine is running and ModManager is present.
if (window.game && window.game.modManager) {

    // 2. REGISTRATION: Tell the engine who you are.
    // 'game' is the global Game instance.
    // 'mods' is the ModManager instance (used for patching/hooks).
    window.game.modManager.register("My Mod Name", "1.0", (game, mods) => {
        
        console.log("My Mod is initializing...");

        // =====================================================================
        // SECTION A: ADDING CONTENT (The "Registry" Pattern)
        // =====================================================================

        // Example A1: Add a new WEAPON / ABILITY
        if (window.AbilityRegistry) {
            AbilityRegistry.register('my_super_weapon', {
                name: 'Doombringer',
                description: 'A custom weapon from a mod.',
                type: 'primary', // primary, secondary, utility, mobility, mastery
                timing: { windup: 200, action: 100, cooldown: 500 }, // in ms
                
                // Visuals before the hit
                onWindup: (player, game) => {
                    player.attackMesh.material.color.setHex(0xff00ff); // Magenta
                    player.attackMesh.material.opacity = 0.5;
                },
                
                // The actual hit logic
                onAction: (player, game) => {
                    // Deal 5 damage in a 3.0 radius
                    player.performAttackHit(3.0, 5); 
                    
                    // Spawn effects (x, z, color, count)
                    game.spawnParticleBurst(player.mesh.position.x, player.mesh.position.z, 0xff00ff, 15);
                    
                    // Screen shake (intensity, duration)
                    game.screenShake(0.2, 3);
                },
                
                // Cleanup
                onFinish: (player) => {
                    player.attackMesh.material.opacity = 0;
                }
            });

            // OPTIONAL: Force equip this weapon immediately to test it
            // game.player.actions.primary = game.player.initAction('my_super_weapon'); // (Pseudo-code, requires manual wiring currently)
        }

        // Example A2: Add a new ENEMY
        if (window.EntityRegistry) {
            EntityRegistry.register('my_custom_enemy', {
                name: 'Void Slime',
                color: 0x00ff00,    // Green
                emissive: 0x004400, // Glow color
                scale: 0.8,         // Size multiplier
                speed: { min: 2, max: 3 },
                health: { active: 3, reserve: 0 },
                
                // Behavior: 'chase', 'flee', 'orbit', 'brute', 'swift'
                behavior: 'chase',
                
                // Attack: 'melee', 'ranged', 'burst'
                attack: { type: 'melee', range: 1.0 },
                
                // Loot Table
                loot: { 
                    essence: { chance: 1.0, value: 10 },
                    health: { chance: 0.2, value: 1 }
                }
            });
        }

        // =====================================================================
        // SECTION B: MODIFYING LOGIC (The "Patch" Pattern)
        // =====================================================================

        // Example B1: Modify how enemies take damage
        // We patch the 'takeDamage' method of the Enemy class.
        // 'original' is the old function. 'instance' is 'this' (the enemy).
        mods.patch(Enemy, 'takeDamage', (original, instance, amount) => {
            
            // Custom Logic: Double damage if enemy is a "Void Slime"
            if (instance.type === 'my_custom_enemy') {
                amount *= 2;
                game.spawnFloatingText(instance.mesh.position.x, instance.mesh.position.z, "CRIT!", 0xff0000);
            }
            
            // Run the original logic (so they actually die)
            original(amount);
        });

        // Example B2: Modify Spawning Logic to include our new enemy
        mods.patch(Game, 'spawnEnemy', (original, gameInstance, forceType) => {
            // 5% chance to force our custom enemy, unless a type is already forced (like in raids)
            if (!forceType && Math.random() < 0.05) {
                console.log("Mod: Spawning custom enemy!");
                original('my_custom_enemy');
            } else {
                original(forceType);
            }
        });

        // =====================================================================
        // SECTION C: RUNTIME HOOKS (The "Loop" Pattern)
        // =====================================================================

        // Run code every single frame
        mods.on('update', (deltaTime) => {
            // Example: Heal player slowly if they stand still
            // (Just a silly example to show access to game state)
            /*
            if (game.player.speed === 0) {
                game.player.health.delta(0.1 * deltaTime);
            }
            */
        });

        // =====================================================================
        // SECTION D: NOTIFICATIONS
        // =====================================================================
        console.log("My Mod loaded successfully!");
    });
}