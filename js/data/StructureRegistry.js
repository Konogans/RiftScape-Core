const StructureRegistry = {
    structures: {},
    register(id, def) { this.structures[id] = { id, ...def }; },
    get(id) { return this.structures[id]; }
};

StructureRegistry.register('wall', {
    name: 'Barricade',
    health: 50,
    width: 1, height: 2, depth: 1,
    color: 0x888899,
    cost: 0, // Maybe costs Essence later?
    onUpdate: (structure, dt, game) => {
        // Passive logic (e.g. spikes?)
    }
});

StructureRegistry.register('turret', {
    name: 'Sentry Turret',
    health: 10,
    width: 1, height: 1.5, depth: 1,
    color: 0x44aaff,
    range: 10, // Increased range slightly
    fireRate: 0.8,
    damage: 1,
    onUpdate: (s, dt, game) => {
        s.timer = (s.timer || 0) + dt;
        if (s.timer >= 0.8) {
            // 1. Find Target
            let target = null;
            let minDst = 10;
            for (const e of game.enemies) {
                if (e.dead) continue;
                const d = s.mesh.position.distanceTo(e.mesh.position);
                if (d < minDst) { minDst = d; target = e; }
            }
            
            if (target) {
                s.timer = 0;
				
				if (game.sound) game.sound.play('turret');
                
                // 2. Calculate Angle
                const dx = target.mesh.position.x - s.mesh.position.x;
                const dz = target.mesh.position.z - s.mesh.position.z;
                const angle = Math.atan2(dx, dz); // Correct angle for Sin/Cos physics
                
                // 3. FIX: Spawn Offset (The Muzzle)
                // Turret is 1x1 (Radius ~0.5). We spawn at 0.8 to clear the collider.
                const offset = 0.8;
                const spawnX = s.mesh.position.x + Math.sin(angle) * offset;
                const spawnZ = s.mesh.position.z + Math.cos(angle) * offset;
                
				// 4. Create Projectile
                const proj = new PlayerProjectile(game, spawnX, spawnZ, angle, 'bolt', 1);
                proj.mesh.material.color.setHex(0xffff00); 
                proj.speed = 15; 
                
                // NERF: Disable Homing
                proj.homing = false; // The PlayerProjectile class will respect this if we inject it
                
                game.entities.push(proj); 
                game.projectiles.push(proj);
                game.scene.add(proj.mesh);
                
                // Add to game
                game.entities.push(proj); 
                game.projectiles.push(proj); // Good practice to add here too
                game.scene.add(proj.mesh);
                
                // Optional: Recoil animation or flash?
                // s.mesh.position.y -= 0.1; // Bob down
            }
        }
    }
});