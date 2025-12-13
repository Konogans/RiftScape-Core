// Ensure this file is loaded *after* core/Game.js and core/ModManager.js
if (window.game && window.game.modManager && typeof Enemy !== 'undefined' && typeof AttackSystem !== 'undefined') {

    window.game.modManager.register("Riftling Final Sync", "2.0", (game, mods) => {
        
        console.log("%c[FINAL SYNC] Re-linking Animation Controller and Damage Timing.", "color: #00ffff; background: #111; padding: 4px;");

        // --- 1. CONFIGURE DEFAULT ENEMY ---
        // Ensure default enemy uses the GLB and has animation map
        const riftling = EntityRegistry.get('default');
        if (riftling) {
            riftling.model = 'models/Riftling_Clean.glb'; 
            riftling.animations = {
                idle: 'Idle',
                walk: 'Walking',
                attack: 'Attack',
                death: 'Dead',
                run: 'Running'
            };
        }
        
        // --- 2. PATCH: HOOK INTO AttackSystem.createAction ---
        // We use the ModManager.patch for the AttackSystem utility (which works by overriding its property, as confirmed)
        const originalCreateAction = AttackSystem.createAction;

        AttackSystem.createAction = function(entity, game) {
            
            // Call the original to get the Action object
            const action = originalCreateAction.call(this, entity, game);

            // ----------------------------------------------------
            // CORE DAMAGE TIMING FIX: 
            // We move the onAction logic to a new wrapper and delay it.
            // ----------------------------------------------------
            const originalOnAction = action.onAction;

            action.onAction = function() {
                // If enemy has a model, delay the actual damage to align with the visual swing.
                // Assuming attack animation hits 50ms (or 50% of the action duration) after the action starts.
                const delayMs = action.actionTime * 0.5; // Damage hits halfway through the action phase

                // Use setTimeout to delay the *original* damage logic.
                setTimeout(() => {
                    // Re-run the original function that was created by AttackSystem.createAction.
                    originalOnAction.call(this);
                }, delayMs);
                
                // Do NOT call originalOnAction() here, only inside the timeout.
            };
            
            // ----------------------------------------------------
            // ANIMATION SYNC FIX: (Fixing the "don't animate anymore" issue)
            // ----------------------------------------------------
            const originalOnWindup = action.onWindup;

            action.onWindup = function() {
                // 1. Play the attack animation when the windup starts
                if (entity.animController) {
                    entity.animController.play('attack', { loop: false, fadeIn: 0.1 });
                }
                // 2. Run the original AttackSystem onWindup logic
                originalOnWindup?.call(this);
            };

            const originalOnFinish = action.onFinish;
            action.onFinish = function() {
                // The animation will naturally finish the clip since loop:false was set.
                // We just ensure the original logic (cooldown reset) runs.
                originalOnFinish?.call(this);
            };
            
            return action;
        };
        
        // --- 3. PATCH: Simplify Enemy Update for Movement/Idle ---
        // This is the clean fallback to ensure animations run when NOT attacking.
        mods.patch(Enemy, 'update', (original, enemy, dt, elapsed) => {
            
            // Execute the original logic (handles movement, health, behavior).
            original(dt, elapsed);

            // If no model, or if the enemy is attacking, let the AttackSystem hook handle it.
            if (!enemy.hasModel || !enemy.mixer || 
                enemy.attackAction.status === 'windup' || 
                enemy.attackAction.status === 'action') {
                return;
            }
            
            // Handle Movement/Idle (only if a model is present and we're not busy)
            const pos = enemy.mesh.position;
            const dx = pos.x - (enemy.lastPos?.x || pos.x);
            const dz = pos.z - (enemy.lastPos?.z || pos.z);
            const distMoved = Math.sqrt(dx * dx + dz * dz);
            const actualSpeed = distMoved / Math.max(dt, 0.001);
            enemy.lastPos = { x: pos.x, z: pos.z };

            if (actualSpeed > 2.0) {
                enemy.animController.play('run');
            } else if (actualSpeed > 0.3) {
                enemy.animController.play('walk');
            } else {
                enemy.animController.play('idle');
            }
        });
    });
}