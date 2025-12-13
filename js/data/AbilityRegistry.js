//
const AbilityRegistry = {
    abilities: {},
    register(id, definition) { this.abilities[id] = { id, ...definition }; },
    get(id) { return this.abilities[id]; },
    list() { return Object.values(this.abilities); }
};

// --- PRIMARIES (Left Click) ---

AbilityRegistry.register('swipe', {
    name: 'Rusty Blade',
    description: 'Standard melee swipe.',
    type: 'primary',
    timing: { windup: 200, action: 150, cooldown: 350 },
    onWindup: (p) => { 
        p.attackMesh.material.opacity = 0.3; 
        p.attackMesh.position.z = -0.4; 
        p.attackMesh.scale.set(0.5, 1, 0.5); 
    },
    onAction: (p, game) => { 
		if(game.sound) game.sound.play('swipe'); // SWOOSH
        p.attackMesh.material.opacity = 0.8; 
        p.attackMesh.position.z = -1.0; 
        p.attackMesh.scale.set(1, 1, 1); 
        game.screenShake(0.1, 2);
        p.performAttackHit(1.5, p.attackDamage); // Range, Dmg
    },
    onFinish: (p) => { p.attackMesh.material.opacity = 0; }
});

AbilityRegistry.register('shotgun', {
    name: 'Shrapnel Cannon',
    description: 'Close range burst.',
    type: 'primary',
    timing: { windup: 300, action: 100, cooldown: 800 },
    onWindup: (p) => { p.baseMaterial.emissiveIntensity = 1.0; },
    onAction: (p, game) => {
		if(game.sound) game.sound.play('shotgun'); // BOOM
        game.screenShake(0.2, 4);
        // Recoil
        const baseAngle = p.mesh.rotation.y + Math.PI; 
        p.mesh.position.x -= Math.sin(baseAngle) * 0.5; 
        p.mesh.position.z -= Math.cos(baseAngle) * 0.5;
        
        // Fire Pellets
        const count = 5;
        const spread = 0.8;
        const dmg = p.attackDamage * 0.4;
        for (let i = 0; i < count; i++) {
            const angle = baseAngle - (spread/2) + (spread * (i/(count-1)));
            const proj = new PlayerProjectile(game, p.mesh.position.x, p.mesh.position.z, angle, 'shrapnel', dmg);
            game.entities.push(proj); game.scene.add(proj.mesh);
        }
    },
    onFinish: (p) => { p.baseMaterial.emissiveIntensity = 0.3; }
});

AbilityRegistry.register('bolt', {
    name: 'Aether Bolt',
    description: 'Homing magic missile.',
    type: 'primary',
    timing: { windup: 50, action: 100, cooldown: 200 },
    onWindup: (p) => { p.baseMaterial.emissiveIntensity = 0.8; },
    onAction: (p, game) => {
		if(game.sound) game.sound.play('laser');
        const angle = p.mesh.rotation.y + Math.PI;
        const dmg = p.attackDamage * 0.7;
        const proj = new PlayerProjectile(game, p.mesh.position.x, p.mesh.position.z, angle, 'bolt', dmg);
        game.entities.push(proj); game.scene.add(proj.mesh);
    },
    onFinish: (p) => { p.baseMaterial.emissiveIntensity = 0.3; }
});

// --- SECONDARIES (Right Click) ---

AbilityRegistry.register('slam', {
    name: 'Seismic Slam',
    description: 'AoE Stun and Damage.',
    type: 'secondary',
    // Increase action time slightly so we can see the animation play out
    timing: { windup: 100, action: 400, cooldown: 4000 },
    
    onAction: (p, game) => {
        game.screenShake(0.3, 6);
        game.spawnParticleBurst(p.mesh.position.x, p.mesh.position.z, 0xffaa44, 12);
        
        // 1. DAMAGE LOGIC
        const slamPos = p.mesh.position;
        for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            const dist = enemy.mesh.position.distanceTo(slamPos);
            if (dist < 3.5) {
                enemy.takeDamage(2 * p.attackDamage); 
                game.spawnParticleBurst(enemy.mesh.position.x, enemy.mesh.position.z, 0xff6644, 4);
            }
        }
        
        // 2. VISUAL SETUP (The Fix)
        if(p.slamRing) {
            p.slamRing.visible = true;
            p.slamRing.position.copy(p.mesh.position); // FIX: Snap to player!
            p.slamRing.position.y = 0.1;               // Keep on floor
            p.slamRing.scale.set(0.1, 0.1, 0.1);       // Reset size
            p.slamRingMaterial.opacity = 1;            // Reset opacity
        }
    },

    // 3. ANIMATION LOOP (The Fix)
	onUpdate: (p, game, action) => {
        if (action.status === 'action' && p.slamRing) {
            const progress = action.getPhaseProgress(); 
            
            // FIX: Tuned scale to match hitbox
            // Base Radius (3) * Max Scale (1.2) = 3.6m Visual
            // Hitbox = 3.5m
            const maxScale = 1.2; 
            const currentScale = 0.1 + (progress * maxScale);
            
            p.slamRing.scale.set(currentScale, currentScale, currentScale);
            p.slamRingMaterial.opacity = 1.0 - progress;
        }
    },
    
    onFinish: (p) => {
        if(p.slamRing) p.slamRing.visible = false;
    }
});

AbilityRegistry.register('snipe', {
    name: 'Power Shot',
    description: 'High damage, long range.',
    type: 'secondary',
    timing: { windup: 500, action: 100, cooldown: 3000 },
    onAction: (p, game) => {
        const angle = p.mesh.rotation.y + Math.PI;
        const proj = new PlayerProjectile(game, p.mesh.position.x, p.mesh.position.z, angle, 'bolt', p.attackDamage * 4);
        proj.speed *= 2; // Faster
        proj.color = 0xff0000;
        proj.mesh.material.color.setHex(0xff0000);
        game.entities.push(proj); game.scene.add(proj.mesh);
    }
});

// --- MOBILITY (Shift) ---

AbilityRegistry.register('dash', {
    name: 'Phase Shift',
    description: 'Quick directional dash.',
    type: 'mobility',
    timing: { windup: 0, action: 150, cooldown: 1500 },
    
    // FIX: ADDED onUpdate for Visuals
    onUpdate: (p, game, action) => {
        if (action.status === 'action') {
            p.dashTrail.visible = true;
            p.dashTrail.position.copy(p.mesh.position);
            p.dashTrail.rotation.y = p.mesh.rotation.y;
            
            // Fade out based on progress (0 to 1)
            const progress = action.getPhaseProgress(); 
            p.dashTrailMaterial.opacity = 0.5 * (1 - progress);
        }
    },
    
    onAction: (p, game) => {
        const input = game.input;
        const move = input.getMovementVector();
        
        let dx = move.x, dz = move.z;
        if (dx === 0 && dz === 0) {
            dx = -Math.sin(p.mesh.rotation.y);
            dz = -Math.cos(p.mesh.rotation.y);
        } else {
             const len = Math.sqrt(dx*dx + dz*dz);
             dx /= len; dz /= len;
        }
        
        p.velocityOverride = { x: dx * 25, z: dz * 25, time: 0.15 };
        p.isInvulnerable = true;
        
        // Initial Visuals
        p.dashTrail.visible = true;
        p.dashTrail.position.copy(p.mesh.position);
        p.dashTrailMaterial.opacity = 0.5;
        game.screenShake(0.1, 3);
    },
    
    onFinish: (p) => {
        p.isInvulnerable = false;
        p.dashTrail.visible = false;
    }
});

// --- UTILITY (Q) ---

AbilityRegistry.register('heal', {
    name: 'Field Ration',
    description: 'Restore active health.',
    type: 'utility',
    timing: { windup: 500, action: 100, cooldown: 8000 },
    onAction: (p, game) => {
        p.health.delta(3); // Heal 3
        p.flashHeal();
        game.spawnFloatingText(p.mesh.position.x, p.mesh.position.z, "+3 HP", 0x00ff00);
    }
});


// HELPER: Shared Cleanup Logic
const cleanupGhost = (p, game) => {
    if (p.buildGhost) {
        game.scene.remove(p.buildGhost);
        if (p.buildGhost.geometry) p.buildGhost.geometry.dispose();
        if (p.buildGhost.material) p.buildGhost.material.dispose();
        p.buildGhost = null;
    }
};

const getConstructionPos = (p, dist) => {
    const rawX = p.mesh.position.x - Math.sin(p.mesh.rotation.y) * dist;
    const rawZ = p.mesh.position.z - Math.cos(p.mesh.rotation.y) * dist;
    return { x: Math.floor(rawX) + 0.5, z: Math.floor(rawZ) + 0.5 };
};

// --- UTILITY: Construct Wall ---
AbilityRegistry.register('wall', {
    name: 'Hardlight Barrier',
    description: 'Deploy cover. Cost: 10 Essence.',
    type: 'utility',
    cost: 10,
    releaseToFire: true,
    timing: { windup: 100000, action: 100, cooldown: 2000 },
    
    canActivate: (p) => {
        const cost = 10;
        const balance = (p.game.currentBiome === 'sanctuary') ? MetaProgression.data.essence : p.game.runEssence;
        return balance >= cost;
    },
    
    onWindup: (p, game) => {
        cleanupGhost(p, game); // Safety Clean
        
        const geo = new THREE.BoxGeometry(1, 2, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x888899, transparent: true, opacity: 0.5, wireframe: true });
        p.buildGhost = new THREE.Mesh(geo, mat);
        p.buildGhost.visible = false;
        game.scene.add(p.buildGhost);
    },
    
    onUpdate: (p, game, action) => {
        if (p.buildGhost && action.status === 'windup') {
            const pos = getConstructionPos(p, 2.0);
            p.buildGhost.position.set(pos.x, 1, pos.z);
            p.buildGhost.visible = true;
            
            if (game.world && game.world.checkCollision(pos.x, pos.z, 0.4)) {
                 p.buildGhost.material.color.setHex(0xff0000); // Red = Blocked
            } else {
                 p.buildGhost.material.color.setHex(0x00ff00); // Green = Good
            }
        }
    },
    
    onAction: (p, game) => {
        // 1. KILL THE GHOST IMMEDIATELY
        // We don't wait for cooldown/onFinish anymore.
        cleanupGhost(p, game);

        const pos = getConstructionPos(p, 2.0);
        
        // 2. CHECK COLLISION (The Cancel Logic)
        // If blocked, we just return. Ghost is gone. No cost spent. 
        // (Action still goes on cooldown, which is a fair penalty for missing)
        if (game.world && game.world.checkCollision(pos.x, pos.z, 0.4)) return;

        // 3. SPEND & SPAWN
		if(game.sound) game.sound.play('build'); // CHIME
        const cost = 10;
		
        if (game.currentBiome === 'sanctuary') {
            MetaProgression.data.essence -= cost; // Correctly deduct from permanent bank
            MetaProgression.save(); // CRITICAL: Save the change immediately!
            p.refreshStats(); // Trigger player stat update (though stats aren't changed, this forces HUD sync)
        } else {
            game.runEssence -= cost;
        }
        
        const wall = new Structure(game, pos.x, pos.z, 'wall');
        game.entities.push(wall);
        game.scene.add(wall.mesh);
        game.spawnParticleBurst(wall.x, wall.z, 0x8888ff, 8);
    },
    
    onFinish: (p, game) => {
        cleanupGhost(p, game); // Just in case
    }
});

// --- SECONDARY: Deploy Turret ---
AbilityRegistry.register('turret', {
    name: 'Sentry Turret',
    description: 'Automated defense. Cost: 25 Essence.',
    type: 'secondary',
    cost: 25,
    releaseToFire: true,
    timing: { windup: 100000, action: 200, cooldown: 5000 },
    
    canActivate: (p) => {
        const cost = 25;
        const balance = (p.game.currentBiome === 'sanctuary') ? MetaProgression.data.essence : p.game.runEssence;
        return balance >= cost;
    },
    
    onWindup: (p, game) => {
        cleanupGhost(p, game);
        const geo = new THREE.BoxGeometry(1, 1.5, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.5, wireframe: true });
        p.buildGhost = new THREE.Mesh(geo, mat);
        p.buildGhost.visible = false;
        game.scene.add(p.buildGhost);
    },
    
    onUpdate: (p, game, action) => {
        if (p.buildGhost && action.status === 'windup') {
            const pos = getConstructionPos(p, 2.0);
            p.buildGhost.position.set(pos.x, 0.75, pos.z);
            p.buildGhost.visible = true;
            
            if (game.world && game.world.checkCollision(pos.x, pos.z, 0.4)) {
                 p.buildGhost.material.color.setHex(0xff0000);
            } else {
                 p.buildGhost.material.color.setHex(0x00ff00);
            }
        }
    },
    
    onAction: (p, game) => {
        cleanupGhost(p, game); // Kill ghost

        const pos = getConstructionPos(p, 2.0);
        if (game.world && game.world.checkCollision(pos.x, pos.z, 0.4)) return;

		if(game.sound) game.sound.play('build'); // CHIME
        const cost = 25;
		
        if (game.currentBiome === 'sanctuary') {
            MetaProgression.data.essence -= cost; // Correctly deduct from permanent bank
            MetaProgression.save(); // CRITICAL: Save the change immediately!
            p.refreshStats(); // Trigger player stat update (forces HUD sync)
        } else {
            game.runEssence -= cost;
        }
        
        const turret = new Structure(game, pos.x, pos.z, 'turret');
        game.entities.push(turret);
        game.scene.add(turret.mesh);
        game.spawnParticleBurst(turret.x, turret.z, 0x44aaff, 12);
    },
    
    onFinish: (p, game) => {
        cleanupGhost(p, game);
    }
});

// --- PRIMARY: Wrench (Melee + Repair) ---
AbilityRegistry.register('wrench', {
    name: 'Omni-Wrench',
    description: 'Smash enemies, repair structures.',
    type: 'primary',
    timing: { windup: 200, action: 100, cooldown: 400 },
    onWindup: (p) => { 
        // Visuals (Maybe scale the box to look like a hammer swing)
        p.attackMesh.scale.set(0.4, 1, 1.5); 
        p.attackMesh.material.opacity = 0.3;
        p.attackMesh.position.z = -0.5;
    },
    onAction: (p, game) => {
        game.screenShake(0.1, 2);
        p.attackMesh.material.opacity = 0.8;
        p.attackMesh.position.z = -1.2;
        
        // 1. Hit Enemies
        p.performAttackHit(1.5, 1.5);
        
        // 2. Repair Structures
        const hitPos = p.mesh.position.clone().add(new THREE.Vector3(0,0,-1).applyEuler(p.mesh.rotation));
        for (const e of game.entities) {
            if (e instanceof Structure && e.mesh.position.distanceTo(hitPos) < 2.0) {
                if (e.health < e.def.health) {
                    e.health = Math.min(e.health + 10, e.def.health);
                    game.spawnFloatingText(e.x, e.z, "REPAIR", 0x00ff00, 0.5);
                }
            }
        }
    },
    onFinish: (p) => { p.attackMesh.material.opacity = 0; }
});

// --- MASTERY: Dismantle ---
AbilityRegistry.register('dismantle', {
    name: 'Salvage Beam',
    description: 'Destroy structure. Recover 50% cost.',
    type: 'mastery',
    timing: { windup: 200, action: 100, cooldown: 500 },
    
    onAction: (p, game) => {
        // Raycast logic (Simple distance check for now)
        const range = 3.0;
        let target = null;
        let minDst = range;
        
        // Find closest structure in front of player
        // Simple sphere check around player for MVP
        for (const e of game.entities) {
            // Check if it's a Structure (duck typing or instanceof if class global)
            // checking 'e.def' and 'e.health' usually safe enough or check constructor name
            if (e.constructor.name === 'Structure') {
                const d = e.mesh.position.distanceTo(p.mesh.position);
                if (d < minDst) {
                    minDst = d;
                    target = e;
                }
            }
        }
        
        if (target) {
            // Calculate Refund
            // Default cost 10 if undefined.
            // We need to look up the original cost from AbilityRegistry (tricky, as StructureRegistry doesn't track cost)
            // Hack: Hardcode refund based on type or store cost on structure.
            // Let's assume Wall=10, Turret=25.
			if(game.sound) game.sound.play('build');
            let refund = 5; 
            if (target.def.id === 'turret') refund = 12;
            
            // Pay the player
            if (game.currentBiome === 'sanctuary') MetaProgression.data.essence += refund;
            else game.runEssence += refund;
            
            // Floating Text
            game.spawnFloatingText(target.x, target.z, `+${refund}`, 0xffcc00);
            
            // FX
            game.spawnParticleBurst(target.x, target.z, 0xffaa00, 10);
            
            // Destroy
            target.takeDamage(9999); // Force kill
            
        } else {
            // Whiff sound/visual
			if(game.sound) game.sound.play('error');
            game.spawnFloatingText(p.mesh.position.x, p.mesh.position.z, "NO TARGET", 0x888888, 0.5);
        }
    }
});