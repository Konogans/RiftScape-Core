/**
 * AttackSystem.js
 * Interprets attack patterns defined in EntityRegistry.
 * 
 * Separates attack LOGIC from attack DATA.
 * Entity definitions specify attack type, system executes it.
 */

const AttackSystem = {
    patterns: {},
    
    register(id, patternDef) {
        this.patterns[id] = patternDef;
    },
    
    createAction(entity, game) {
        const attackDef = entity.def.attack || { type: 'melee' };
        const pattern = this.patterns[attackDef.type] || this.patterns['melee'];
        const timing = entity.def.attackTiming;
        
        return new Action({
            windupTime: timing.windup,
            actionTime: timing.action,
            cooldownTime: timing.cooldown,
            onWindup: () => pattern.onWindup?.(entity, game),
            onAction: () => pattern.onAction(entity, game, attackDef),
            onCooldown: () => pattern.onCooldown?.(entity, game),
            onFinish: () => {
                pattern.onFinish?.(entity, game);
                entity.attackCooldown = entity.attackCooldownTime;
            }
        });
    }
};

// =============================================================================
// ATTACK PATTERNS
// =============================================================================

AttackSystem.register('melee', {
    onWindup(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0x881111);
            entity.material.emissiveIntensity = 0.8;
        }
    },
    onAction(entity, game, attackDef) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0xff4444);
            entity.material.emissiveIntensity = 1;
        }
        
        // 1. Resolve Target
        let target = entity.currentTarget; 
        
        if (!target) {
            target = game.player;
            if (entity.targetOverride) {
                const distToPlayer = entity.mesh.position.distanceTo(game.player.mesh.position);
                if (distToPlayer > 3.0) target = entity.targetOverride;
            }
        }

        if (!target || !target.mesh) return;

        const dist = entity.mesh.position.distanceTo(target.mesh.position);
        
        // FIX: Generous Hitbox
        // Structures are fat. Give them a bigger hit radius.
        // If target has 'def' (Structure/Enemy), assume it's wider than a player.
        const targetRadius = target.radius || (target.def ? 0.8 : 0.5);
        
        // Add +0.8 buffer (was 0.5) to ensure "Breach Range" is always < "Hit Range"
        const reach = (attackDef.range || entity.attackRange || 1.2) + targetRadius + 0.8;
        
        if (dist < reach) { 
             if (typeof target.takeDamage === 'function') {
                 target.takeDamage(entity.damage);
                 if (target.flashDamage) target.flashDamage();
             }
        }
    },
    onCooldown(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(entity.def.emissive);
            entity.material.emissiveIntensity = 0.5;
        }
    },
    onFinish(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(entity.def.emissive);
            entity.material.emissiveIntensity = 0.3;
        }
    }
});

AttackSystem.register('ranged', {
    onWindup(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0x440088);
            entity.material.emissiveIntensity = 0.8;
        }
    },
    onAction(entity, game, attackDef) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0x8844ff);
            entity.material.emissiveIntensity = 1;
        }
        
        const speed = attackDef.projectileSpeed || entity.def.projectileSpeed || 6;
        const proj = new Projectile(
            game,
            entity.mesh.position.x,
            entity.mesh.position.z,
            game.player.mesh.position.x,
            game.player.mesh.position.z,
            speed,
            entity.damage
        );
        game.projectiles.push(proj);
        game.entities.push(proj);
        game.scene.add(proj.mesh);
    },
    onCooldown(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(entity.def.emissive);
            entity.material.emissiveIntensity = 0.5;
        }
    },
    onFinish(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(entity.def.emissive);
            entity.material.emissiveIntensity = 0.3;
        }
    }
});

AttackSystem.register('burst', {
    // Fires multiple projectiles in a spread
    onWindup(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0x880044);
            entity.material.emissiveIntensity = 0.8;
        }
    },
    onAction(entity, game, attackDef) {
        const count = attackDef.projectileCount || 3;
        const spread = attackDef.spread || 0.4; // radians
        const speed = attackDef.projectileSpeed || 6;
        
        const dx = game.player.mesh.position.x - entity.mesh.position.x;
        const dz = game.player.mesh.position.z - entity.mesh.position.z;
        const baseAngle = Math.atan2(dz, dx);
        
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (i - (count - 1) / 2) * spread;
            const targetX = entity.mesh.position.x + Math.cos(angle) * 10;
            const targetZ = entity.mesh.position.z + Math.sin(angle) * 10;
            
            const proj = new Projectile(
                game,
                entity.mesh.position.x,
                entity.mesh.position.z,
                targetX,
                targetZ,
                speed,
                entity.damage
            );
            game.projectiles.push(proj);
            game.entities.push(proj);
            game.scene.add(proj.mesh);
        }
    },
    onCooldown(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(entity.def.emissive);
            entity.material.emissiveIntensity = 0.5;
        }
    }
});

AttackSystem.register('aoe', {
    // Ground slam / area damage
    onWindup(entity, game) {
        if (!entity.hasModel && entity.material) {
            entity.material.emissive.setHex(0x884400);
            entity.material.emissiveIntensity = 1.0;
        }
        // Could show charging VFX here
    },
    onAction(entity, game, attackDef) {
        const radius = attackDef.radius || 2.5;
        const pos = entity.mesh.position;
        
        // Damage player if in range
        const playerDist = pos.distanceTo(game.player.mesh.position);
        if (playerDist < radius && !game.player.isInvulnerable) {
            game.player.health.delta(-entity.damage);
            game.player.flashDamage();
        }
        
        // VFX
        game.spawnParticleBurst(pos.x, pos.z, 0xff6600, 15);
        game.screenShake(0.3, 4);
    }
});

window.AttackSystem = AttackSystem;
