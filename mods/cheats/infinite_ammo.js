// Check if manager exists
if (window.game && window.game.modManager) {
    
    window.game.modManager.register("Infinite Ammo", "1.0", (game) => {
        
        // 1. PATCH UTILITY COSTS
        // We patch the 'canActivate' check on the player to always return true
        // And patch the cost deduction to be 0
        
        // Access the AbilityRegistry directly
        const turret = AbilityRegistry.get('turret');
        const wall = AbilityRegistry.get('wall');
        
        // Patch Costs
        turret.cost = 0;
        wall.cost = 0;
        
        // Patch Description
        turret.description = "MODDED: FREE PLACEMENT";
        wall.description = "MODDED: FREE PLACEMENT";
        
        // 2. MAKE PLAYER GIANT
        game.player.mesh.scale.set(2, 2, 2);
        
        // 3. LOGIC HOOK
        game.modManager.on('update', (dt) => {
             // Make the player spin rainbow colors
             const time = Date.now() * 0.001;
             const r = Math.sin(time) * 0.5 + 0.5;
             const g = Math.sin(time + 2) * 0.5 + 0.5;
             const b = Math.sin(time + 4) * 0.5 + 0.5;
             game.player.baseMaterial.color.setRGB(r, g, b);
        });
        
        console.log("God Mode Engaged.");
    });
}