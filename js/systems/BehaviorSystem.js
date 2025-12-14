/**
 * BehaviorSystem - Interprets behavior patterns defined in EntityRegistry.
 * 
 * Behaviors are composable - an enemy can have a primary behavior
 * that switches based on conditions (health, distance, etc.)
 * 
 * @namespace BehaviorSystem
 * @property {Object} behaviors - Registered behavior functions
 */
const BehaviorSystem = {
    behaviors: {},
    
    /**
     * Registers a new behavior pattern.
     * @param {string} id - Behavior ID
     * @param {Function} behaviorFn - Behavior function (entity, deltaTime, game) => { dist, inRange, ... }
     */
    register(id, behaviorFn) {
        this.behaviors[id] = behaviorFn;
    },
    
    /**
     * Executes a behavior for an entity.
     * @param {Enemy} entity - Enemy entity
     * @param {string} behaviorId - Behavior ID
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {Game} game - Game instance
     * @returns {Object} Behavior result with { dist, inRange, ... }
     */
    execute(entity, behaviorId, deltaTime, game) {
        const behavior = this.behaviors[behaviorId];
        if (!behavior) {
            console.warn(`Unknown behavior: ${behaviorId}, falling back to chase`);
            return this.behaviors['chase'](entity, deltaTime, game);
        }
        return behavior(entity, deltaTime, game);
    },
    
    // Helper: Get movement vector toward target
    getDirectionTo(from, to) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.001) return { x: 0, z: 0, dist: 0 };
        return { x: dx / dist, z: dz / dist, dist };
    },
    
    // Helper: Apply separation from other entities
    applySeparation(entity, game, radius = 1.5, strength = 2.0) {
        let pushX = 0, pushZ = 0;
        const myPos = entity.mesh.position;
        
        for (const other of game.enemies) {
            if (other === entity || other.dead) continue;
            const dx = myPos.x - other.mesh.position.x;
            const dz = myPos.z - other.mesh.position.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < radius * radius && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = (radius - dist) / radius * strength;
                pushX += (dx / dist) * force;
                pushZ += (dz / dist) * force;
            }
        }
        return { x: pushX, z: pushZ };
    },
    
    // Helper: Check and apply world collision (slide along walls)
    applyMovement(entity, game, moveX, moveZ) {
        const pos = entity.mesh.position;
        let nextX = pos.x + moveX;
        let nextZ = pos.z + moveZ;
        
        if (game.world) {
            if (!game.world.checkCollision(nextX, pos.z, 0.3)) pos.x = nextX;
            if (!game.world.checkCollision(pos.x, nextZ, 0.3)) pos.z = nextZ;
        } else {
            pos.x = nextX;
            pos.z = nextZ;
        }
    },
	// HELPER: Universal Target Resolution
	resolveTarget(entity, game) {
		// 1. Default: Player
		let target = game.player;
		let isOverride = false;

		// 2. Check Override
        if (entity.targetOverride) {
            const distToPlayer = entity.mesh.position.distanceTo(game.player.mesh.position);
            
            // FIX: Dynamic Aggro
            // Bosses (scale > 1.5) get larger aggro radius (8.0)
            // Grunts get standard (4.0)
            const aggroRange = (entity.scale && entity.scale > 1.5) ? 12.0 : 4.0;
            
            if (distToPlayer > aggroRange) {
                target = entity.targetOverride;
                isOverride = true;
            }
        }
		
		// 3. Breacher Logic (Check for Walls)
		// Only run if we aren't already targeting a structure (to avoid flickering)
		// Check "is this a structure?" by duck-typing 'def.health' or constructor name
		const currentIsStructure = target.constructor.name === 'Structure';
		
		if (!currentIsStructure) {
			const myPos = entity.mesh.position;
			const targetPos = target.mesh ? target.mesh.position : target.position;
			
			for (const s of game.structures) {
				if (s.dead) continue;
				
				const dx = s.x - myPos.x;
				const dz = s.z - myPos.z;
				const distSq = dx*dx + dz*dz;
				const breachRange = entity.attackRange + 0.7;
				
				if (distSq < breachRange * breachRange) {
					// Dot Product check (Is it in front?)
					const toTargetX = targetPos.x - myPos.x;
					const toTargetZ = targetPos.z - myPos.z;
					const lenT = Math.sqrt(toTargetX*toTargetX + toTargetZ*toTargetZ) || 1;
					const lenS = Math.sqrt(distSq) || 1;
					const dot = (dx/lenS) * (toTargetX/lenT) + (dz/lenS) * (toTargetZ/lenT);
					
					if (dot > 0.6) { // 0.6 is a bit more generous than 0.7
						return { target: s, isOverride: true };
					}
				}
			}
		}
		
		return { target, isOverride };
	}
};



// =============================================================================
// CORE BEHAVIORS
// =============================================================================

// [Punk Rock Patch: BehaviorSystem.js]

// Smart Chase - Uses Flow Field if available, falls back to direct line
BehaviorSystem.register('chase', (entity, deltaTime, game) => {
    // 1. DETERMINE PRIMARY TARGET
    let target = game.player;
    let usingOverride = false;
    
    if (entity.targetOverride) {
        const distToPlayer = entity.mesh.position.distanceTo(game.player.mesh.position);
        if (distToPlayer > 3.0) {
            target = entity.targetOverride;
            usingOverride = true;
        }
    }
    
    // FIX: Define position EARLY so Breacher Logic can use it
    let targetPos = target.mesh ? target.mesh.position : target.position;
    const myPos = entity.mesh.position;
    let distToTarget = Math.sqrt((targetPos.x - myPos.x)**2 + (targetPos.z - myPos.z)**2); 

    // 3. MOVEMENT LOGIC (Use Flow or Direct)
    let moveX = 0;
    let moveZ = 0;
    let useFlow = !usingOverride; 
    let flow = null;
    
    const targetRadius = target.radius || 0.5;
    const effectiveRange = entity.attackRange + targetRadius;

    if (distToTarget > effectiveRange * 0.8) {
        if (useFlow && game.world && game.world.getFlowVector) {
            flow = game.world.getFlowVector(myPos.x, myPos.z);
        }
        
        if (flow) {
            moveX = flow.x * entity.speed * deltaTime;
            moveZ = flow.z * entity.speed * deltaTime;
        } else {
            const dir = BehaviorSystem.getDirectionTo(myPos, targetPos);
            moveX = dir.x * entity.speed * deltaTime;
            moveZ = dir.z * entity.speed * deltaTime;
        }
    }

    // 4. SEPARATION & PHYSICS
    const sep = BehaviorSystem.applySeparation(entity, game);
    moveX += sep.x * deltaTime;
    moveZ += sep.z * deltaTime;

    if (distToTarget > effectiveRange * 0.8) {
        BehaviorSystem.applyMovement(entity, game, moveX, moveZ);
    }
    
    // 5. BREACHER LOGIC (Check structures)
    // Now we can safely use 'targetPos' because it is defined above.
    
    for (const s of game.structures) {
        if (s.dead) continue;
        
        const dx = s.x - myPos.x;
        const dz = s.z - myPos.z;
        const distSq = dx*dx + dz*dz;
        
        const breachRange = entity.attackRange + 0.5; 
        
        if (distSq < breachRange * breachRange) {
            // DOT PRODUCT CHECK
            const toTargetX = targetPos.x - myPos.x;
            const toTargetZ = targetPos.z - myPos.z;
            
            const lenT = Math.sqrt(toTargetX*toTargetX + toTargetZ*toTargetZ) || 1;
            const lenS = Math.sqrt(distSq) || 1;
            
            const dot = (dx/lenS) * (toTargetX/lenT) + (dz/lenS) * (toTargetZ/lenT);
            
            if (dot > 0.7) {
                // SWITCH TARGET
                target = s;
                // Update local position variable for the facing logic below
                targetPos = s.mesh.position; 
                distToTarget = lenS;
                break;
            }
        }
    }
    
    // 6. FACE TARGET
    // Uses the (possibly updated) targetPos
    entity.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);
    
    entity.currentTarget = target;
    
    const finalRadius = target.radius || (target.def ? 0.7 : 0.5);
    const finalEffectiveRange = entity.attackRange + finalRadius;
    
    return { inRange: distToTarget < finalEffectiveRange, dist: distToTarget };
});

// Ranged kiting - maintain distance, back up if too close
BehaviorSystem.register('ranged_kite', (entity, deltaTime, game) => {
    // USE HELPER
    const { target } = BehaviorSystem.resolveTarget(entity, game);
    entity.currentTarget = target;

    const targetPos = target.mesh ? target.mesh.position : target.position;
    const myPos = entity.mesh.position;
    const dir = BehaviorSystem.getDirectionTo(myPos, targetPos);
    
    const targetRadius = target.radius || 0.5;
    
    // Kiting Logic
    // We want to be at 'attackRange' distance.
    const preferredDist = entity.attackRange * 0.8;
    const actualDist = dir.dist - targetRadius; // Distance to edge
    
    let moveX = 0, moveZ = 0;
    
    if (actualDist < preferredDist * 0.5) {
        // Too close: Back up
        moveX = -dir.x * entity.speed * 0.8 * deltaTime;
        moveZ = -dir.z * entity.speed * 0.8 * deltaTime;
    } else if (actualDist > entity.attackRange * 0.9) {
        // Too far: Approach
        moveX = dir.x * entity.speed * deltaTime;
        moveZ = dir.z * entity.speed * deltaTime;
    }
    
    // Strafe
    const strafeAngle = Math.sin(game.runTime * 2 + entity.mesh.position.x) * 0.3;
    moveX += -dir.z * strafeAngle * entity.speed * deltaTime;
    moveZ += dir.x * strafeAngle * entity.speed * deltaTime;
    
    const sep = BehaviorSystem.applySeparation(entity, game);
    BehaviorSystem.applyMovement(entity, game, moveX + sep.x * deltaTime, moveZ + sep.z * deltaTime);
    
    entity.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);
    
    // For Ranged, inRange is a bit loose
    return { inRange: actualDist < entity.attackRange, dist: dir.dist };
});

// Swift - fast, erratic movement with sudden direction changes
BehaviorSystem.register('swift', (entity, deltaTime, game) => {
    // USE HELPER
    const { target } = BehaviorSystem.resolveTarget(entity, game);
    
    // Save for AttackSystem
    entity.currentTarget = target;
    
    const targetPos = target.mesh ? target.mesh.position : target.position;
    const myPos = entity.mesh.position;
    const dir = BehaviorSystem.getDirectionTo(myPos, targetPos);
    
    // Erratic movement
    const jitterX = (Math.random() - 0.5) * 0.5;
    const jitterZ = (Math.random() - 0.5) * 0.5;
    
    const targetRadius = target.radius || 0.5;
    const effectiveRange = entity.attackRange + targetRadius;
    
    if (dir.dist > effectiveRange * 0.6) {
        const sep = BehaviorSystem.applySeparation(entity, game, 1.0, 3.0);
        const moveX = (dir.x + jitterX) * entity.speed * deltaTime + sep.x * deltaTime;
        const moveZ = (dir.z + jitterZ) * entity.speed * deltaTime + sep.z * deltaTime;
        BehaviorSystem.applyMovement(entity, game, moveX, moveZ);
    }
    
    entity.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);
    
    return { inRange: dir.dist < effectiveRange, dist: dir.dist };
});

// Brute - slow, deliberate, doesn't stop for separation much
BehaviorSystem.register('brute', (entity, deltaTime, game) => {
    // FIX: Respect Target Override
    let target = entity.targetOverride || game.player;
    
    // Switch to player if they get too close (Aggro Radius)
    if (entity.targetOverride) {
        const distToPlayer = entity.mesh.position.distanceTo(game.player.mesh.position);
        if (distToPlayer < 4.0) target = game.player;
    }
    
    // Save for AttackSystem
    entity.currentTarget = target;

    const targetPos = target.mesh ? target.mesh.position : target.position;
    const myPos = entity.mesh.position;
    
    // Recalculate Distance to ACTUAL target
    const dir = BehaviorSystem.getDirectionTo(myPos, targetPos);
    
    // Include Radius (Gate/Wall size)
    const targetRadius = target.radius || 0.5;
    const effectiveRange = entity.attackRange + targetRadius;

    // Movement (Slow & Steady)
    if (dir.dist > effectiveRange * 0.9) {
        const sep = BehaviorSystem.applySeparation(entity, game, 1.0, 0.5);
        const moveX = dir.x * entity.speed * deltaTime + sep.x * 0.5 * deltaTime;
        const moveZ = dir.z * entity.speed * deltaTime + sep.z * 0.5 * deltaTime;
        BehaviorSystem.applyMovement(entity, game, moveX, moveZ);
    }
    
    entity.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);
    
    return { inRange: dir.dist < effectiveRange, dist: dir.dist };
});

// Flee - run away when health is low (can be used as secondary behavior)
BehaviorSystem.register('flee', (entity, deltaTime, game) => {
    const playerPos = game.player.mesh.position;
    const myPos = entity.mesh.position;
    const dir = BehaviorSystem.getDirectionTo(myPos, playerPos);
    
    // Run away from player
    const moveX = -dir.x * entity.speed * 1.2 * deltaTime;
    const moveZ = -dir.z * entity.speed * 1.2 * deltaTime;
    BehaviorSystem.applyMovement(entity, game, moveX, moveZ);
    
    return { inRange: false, dist: dir.dist };
});

// Orbit - circle around the player at attack range
BehaviorSystem.register('orbit', (entity, deltaTime, game) => {
    const playerPos = game.player.mesh.position;
    const myPos = entity.mesh.position;
    const dir = BehaviorSystem.getDirectionTo(myPos, playerPos);
    
    const orbitDist = entity.attackRange * 0.8;
    let moveX = 0, moveZ = 0;
    
    // Maintain orbit distance
    if (dir.dist < orbitDist * 0.8) {
        moveX -= dir.x * entity.speed * 0.5 * deltaTime;
        moveZ -= dir.z * entity.speed * 0.5 * deltaTime;
    } else if (dir.dist > orbitDist * 1.2) {
        moveX += dir.x * entity.speed * deltaTime;
        moveZ += dir.z * entity.speed * deltaTime;
    }
    
    // Perpendicular movement (orbit)
    const orbitSpeed = entity.speed * 0.7;
    moveX += -dir.z * orbitSpeed * deltaTime;
    moveZ += dir.x * orbitSpeed * deltaTime;
    
    const sep = BehaviorSystem.applySeparation(entity, game);
    BehaviorSystem.applyMovement(entity, game, moveX + sep.x * deltaTime, moveZ + sep.z * deltaTime);
    
    entity.mesh.lookAt(playerPos.x, myPos.y, playerPos.z);
    
    return { inRange: dir.dist < entity.attackRange, dist: dir.dist };
});

window.BehaviorSystem = BehaviorSystem;
