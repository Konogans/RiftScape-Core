
const AbilityRegistry = {
    abilities: {},
    register(id, definition) { this.abilities[id] = { id, ...definition }; },
    get(id) { return this.abilities[id]; },
    list() { return Object.values(this.abilities); }
};
AbilityRegistry.register('dash', {
    name: 'Rift Dash', description: 'Phase through enemies briefly', key: 'ShiftLeft', altKey: 'ShiftRight', cooldown: 1.5, duration: 0.15,
    canActivate: (player) => { return !player.isDashing && player.abilityCooldowns.dash <= 0; },
    onActivate: (player, game) => {
        const input = game.input;
        const movement = input.getMovementVector();
        if (movement.x !== 0 || movement.z !== 0) {
            const len = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
            player.dashDirection.x = movement.x / len;
            player.dashDirection.z = movement.z / len;
        } else {
            player.dashDirection.x = -Math.sin(player.mesh.rotation.y);
            player.dashDirection.z = -Math.cos(player.mesh.rotation.y);
        }
        player.isDashing = true; player.isInvulnerable = true; player.dashTimer = 0.15; player.abilityCooldowns.dash = 1.5;
        player.dashTrail.visible = true; player.dashTrail.position.copy(player.mesh.position); player.dashTrail.rotation.y = player.mesh.rotation.y;
        game.screenShake(0.15, 3);
    },
    onUpdate: (player, game, deltaTime) => {
        if (!player.isDashing) return;
        player.dashTimer -= deltaTime;
        const dashSpeed = 25;
        player.mesh.position.x += player.dashDirection.x * dashSpeed * deltaTime;
        player.mesh.position.z += player.dashDirection.z * dashSpeed * deltaTime;
        player.dashTrail.position.copy(player.mesh.position);
        player.dashTrail.position.x -= player.dashDirection.x * 0.5;
        player.dashTrail.position.z -= player.dashDirection.z * 0.5;
        player.dashTrail.rotation.y = player.mesh.rotation.y;
        player.dashTrailMaterial.opacity = 0.5 * (player.dashTimer / 0.15);
        player.baseMaterial.emissive.setHex(0x4488ff); player.baseMaterial.emissiveIntensity = 1;
        if (player.dashTimer <= 0) {
            player.isDashing = false; player.isInvulnerable = false; player.dashTrail.visible = false;
            player.baseMaterial.emissive.setHex(0x112244); player.baseMaterial.emissiveIntensity = 0.3;
        }
    }
});
AbilityRegistry.register('slam', {
    name: 'Rift Slam', description: 'Damage all nearby enemies', mouseButton: 2, cooldown: 4, duration: 0.3, radius: 3, damage: 2,
    canActivate: (player) => { return !player.isSlamming && player.abilityCooldowns.slam <= 0; },
    onActivate: (player, game) => {
        player.isSlamming = true; player.slamTimer = 0.3; player.abilityCooldowns.slam = 4;
        player.slamRing.visible = true; player.slamRing.scale.set(0.1, 0.1, 0.1); player.slamRingMaterial.opacity = 0.8;
        game.screenShake(0.25, 6);
        game.spawnParticleBurst(player.mesh.position.x, player.mesh.position.z, 0xffaa44, 12);
    },
    onUpdate: (player, game, deltaTime) => {
        if (!player.isSlamming) return;
        player.slamTimer -= deltaTime;
        const progress = 1 - (player.slamTimer / 0.3);
        const scale = progress * 3;
        player.slamRing.scale.set(scale, scale, scale);
        player.slamRing.position.copy(player.mesh.position);
        player.slamRing.position.y = 0.1;
        player.slamRingMaterial.opacity = 0.8 * (1 - progress);
        if (progress > 0.3 && !player.slamHit) {
            player.slamHit = true;
            const slamPos = player.mesh.position;
            for (const enemy of game.enemies) {
                if (enemy.dead) continue;
                const dist = enemy.mesh.position.distanceTo(slamPos);
                if (dist < 3) {
                    enemy.takeDamage(2 * player.attackDamage);
                    game.spawnParticleBurst(enemy.mesh.position.x, enemy.mesh.position.z, 0xff6644, 4);
                }
            }
        }
        if (player.slamTimer <= 0) { player.isSlamming = false; player.slamHit = false; player.slamRing.visible = false; }
    }
});
