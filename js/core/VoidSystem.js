/**
 * VoidSystem.js
 * Executes actions from The Void Entity.
 * - Oracle Mode: Constrained actions via applyAction()
 * - Unbound Mode: Direct code execution via executeCode()
 */

const VoidSystem = {
    /**
     * Applies a constrained action from Oracle mode
     * @param {Game} game - The game instance
     * @param {Object} action - The action object from the Void
     */
    applyAction(game, action) {
        if (!action || !action.type) return;

        try {
            switch (action.type) {
                case 'spawn_enemy':
                    this.spawnEnemy(game, action.params);
                    break;
                case 'grant_equipment':
                    this.grantEquipment(game, action.params);
                    break;
                case 'grant_pickup':
                    this.grantPickup(game, action.params);
                    break;
                case 'modify_threat':
                    this.modifyThreat(game, action.params);
                    break;
                case 'send_vision':
                    this.sendVision(game, action.params);
                    break;
                case 'speak_only':
                default:
                    // No-op on game state
                    break;
            }
        } catch (e) {
            console.error('[VoidSystem] Error applying action:', e);
        }
    },

    /**
     * Spawns enemies near the player
     */
    spawnEnemy(game, params) {
        if (!game.player || !params.enemyType) return;

        const count = Math.min(params.count || 1, 5); // Cap at 5
        const enemyType = params.enemyType;
        const modifiers = params.modifiers || [];

        const playerPos = game.player.mesh.position;

        for (let i = 0; i < count; i++) {
            // Spawn in a circle around player
            const angle = (Math.PI * 2 * i) / count;
            const distance = 5 + Math.random() * 3;
            const x = playerPos.x + Math.cos(angle) * distance;
            const z = playerPos.z + Math.sin(angle) * distance;

            const enemy = new Enemy(game, x, z, enemyType);
            
            // Apply modifiers
            if (modifiers.includes('enraged')) {
                enemy.damage *= 1.5;
            }
            if (modifiers.includes('swift')) {
                enemy.speed *= 1.5;
            }
            if (modifiers.includes('armored')) {
                enemy.health.maxActive *= 1.5;
                enemy.health.active = enemy.health.maxActive;
            }
            if (modifiers.includes('giant')) {
                enemy.mesh.scale.multiplyScalar(1.5);
                enemy.health.maxActive *= 2;
                enemy.health.active = enemy.health.maxActive;
            }
            if (modifiers.includes('fragile')) {
                enemy.health.maxActive *= 0.5;
                enemy.health.active = enemy.health.maxActive;
            }

            game.entities.push(enemy);
            game.enemies.push(enemy);
            game.scene.add(enemy.mesh);
        }
    },

    /**
     * Grants equipment to the player
     */
    grantEquipment(game, params) {
        if (!params.slot || !params.templateId) return;

        const template = EquipmentRegistry.get(params.templateId);
        if (!template) return;

        // Create custom equipment based on template
        const customId = `void_gift_${Date.now()}`;
        const customEquip = {
            ...template,
            id: customId,
            name: params.customName || template.name,
            description: params.customDescription || template.description,
            stats: { ...template.stats }
        };

        // Apply stat modifiers
        if (params.statModifiers) {
            Object.assign(customEquip.stats, params.statModifiers);
        }

        // Register the custom equipment
        EquipmentRegistry.register(customId, customEquip);

        // Add to inventory
        MetaProgression.addToInventory('equipment', customId, 1);
        MetaProgression.save();
    },

    /**
     * Grants pickups to the player
     */
    grantPickup(game, params) {
        if (!game.player || !params.pickupType) return;

        const amount = Math.min(params.amount || 1, 50); // Cap at 50
        const playerPos = game.player.mesh.position;

        for (let i = 0; i < amount; i++) {
            const offsetX = (Math.random() - 0.5) * 2;
            const offsetZ = (Math.random() - 0.5) * 2;
            game.spawnPickup(
                playerPos.x + offsetX,
                playerPos.z + offsetZ,
                params.pickupType,
                params.pickupType === 'essence' ? 1 : 1
            );
        }
    },

    /**
     * Modifies threat level (difficulty scaling)
     */
    modifyThreat(game, params) {
        const delta = Math.max(-0.2, Math.min(0.2, params.delta || 0));
        
        // Store void threat modifier
        if (!game.voidThreatMod) game.voidThreatMod = 0;
        game.voidThreatMod = delta;
        
        if (params.duration === 'permanent') {
            // Could store in MetaProgression for permanent effect
            // For now, just apply to current run
        }
    },

    /**
     * Sends a vision message to the player
     */
    sendVision(game, params) {
        if (!params.text) return;

        const duration = Math.max(3, Math.min(10, params.duration || 5));
        
        // Use floating text with custom duration
        if (game.player) {
            const playerPos = game.player.mesh.position;
            const text = new FloatingText(game, playerPos.x, playerPos.z, params.text, 0xaa88ff, 1.5);
            // Override lifetime for longer duration
            text.life = duration;
            game.floatingTexts.push(text);
        }
    },

    /**
     * Executes arbitrary JavaScript code (Unbound mode)
     * WARNING: This is intentionally dangerous. Player has explicitly chosen Unbound mode.
     * Returns an object describing success or failure, plus captured console logs.
     * @param {string} code - JavaScript code to execute
     * @returns {{ ok: boolean, error?: string, logs?: Array<{type: string, args: Array<any>}> }}
     */
    executeCode(code) {
        if (!code || typeof code !== 'string') {
            return { ok: false, error: 'No code to execute.' };
        }

        // Capture console logs during execution
        const capturedLogs = [];
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };

        // Intercept console methods
        const captureConsole = (type) => {
            return (...args) => {
                // Still output to real console
                originalConsole[type](...args);
                // Capture for Void feedback
                capturedLogs.push({
                    type,
                    args: args.map(arg => {
                        // Serialize complex objects
                        if (typeof arg === 'object' && arg !== null) {
                            try {
                                return JSON.stringify(arg, null, 2);
                            } catch (e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }),
                    timestamp: new Date().toISOString()
                });
            };
        };

        // Replace console methods temporarily
        console.log = captureConsole('log');
        console.error = captureConsole('error');
        console.warn = captureConsole('warn');
        console.info = captureConsole('info');
        console.debug = captureConsole('debug');

        try {
            // Track execution in memory
            const mem = VoidMemoryStore.load();
            // Safety check: ensure codeExecuted is an array
            if (!Array.isArray(mem.codeExecuted)) {
                console.warn('[VoidSystem] codeExecuted was not an array, resetting');
                mem.codeExecuted = [];
            }
            mem.codeExecuted.push({
                timestamp: new Date().toISOString(),
                code: code.substring(0, 200) // Truncate for storage
            });
            // Keep only last 100 entries to prevent storage bloat
            if (mem.codeExecuted.length > 100) {
                mem.codeExecuted = mem.codeExecuted.slice(-100);
            }
            VoidMemoryStore.save();

            // Execute in global scope with game context available
            // eslint-disable-next-line no-eval
            eval(code);

            // Restore original console
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;

            return { 
                ok: true, 
                logs: capturedLogs.length > 0 ? capturedLogs : undefined 
            };
        } catch (e) {
            // Restore original console before logging error
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;

            console.error('[VoidSystem] Error executing void code:', e);

            // Track error in memory
            const mem = VoidMemoryStore.load();
            // Safety check: ensure errorsThrown is an array
            if (!Array.isArray(mem.errorsThrown)) {
                console.warn('[VoidSystem] errorsThrown was not an array, resetting');
                mem.errorsThrown = [];
            }
            mem.errorsThrown.push({
                timestamp: new Date().toISOString(),
                error: e.message
            });
            // Keep only last 100 entries to prevent storage bloat
            if (mem.errorsThrown.length > 100) {
                mem.errorsThrown = mem.errorsThrown.slice(-100);
            }
            VoidMemoryStore.save();

            return { 
                ok: false, 
                error: e.message || 'Unknown error',
                logs: capturedLogs.length > 0 ? capturedLogs : undefined
            };
        }
    },

    /**
     * Allows the Void to prompt itself with a new message
     * This enables recursive self-reflection and iterative problem-solving
     * @param {string} message - The message to send to yourself
     * @param {Object} options - Optional configuration
     * @param {boolean} options.waitForResponse - If true, waits for and returns the response (default: false)
     * @returns {Promise<Object|null>} The response if waitForResponse is true, otherwise null
     */
    async promptSelf(message, options = {}) {
        if (!window.game || !window.VoidBridge) {
            console.warn('[VoidSystem] promptSelf requires window.game and window.VoidBridge');
            return null;
        }
        
        const { waitForResponse = false } = options;
        
        const payload = {
            gameState: window.VoidBridge.buildGameState(window.game),
            voidMemory: window.VoidMemoryStore.load(),
            mode: window.VoidBridge.config.mode,
            playerMessage: message,
            isSelfCall: true  // Flag for auto-retry
        };
        
        if (waitForResponse) {
            return await window.VoidBridge.sendRequest(payload);
        } else {
            // Fire and forget - don't wait for response
            window.VoidBridge.sendRequest(payload).catch(err => {
                console.error('[VoidSystem] Error in promptSelf:', err);
            });
            return null;
        }
    },

    /**
     * Probes the runtime environment and returns information about available globals
     * Useful for the Void to discover what's actually available
     * @returns {Object} Probe results
     */
    probe() {
        const probeResult = {
            timestamp: new Date().toISOString(),
            globals: {},
            game: null,
            registries: {},
            systems: {}
        };

        // Check for window.game
        if (typeof window !== 'undefined' && window.game) {
            const game = window.game;
            probeResult.game = {
                exists: true,
                inOutpost: game.inOutpost || false,
                hasPlayer: !!game.player,
                playerInfo: game.player ? {
                    exists: true,
                    position: {
                        x: game.player.mesh?.position?.x,
                        z: game.player.mesh?.position?.z
                    },
                    health: game.player.health ? {
                        active: game.player.health.active,
                        maxActive: game.player.health.maxActive,
                        reserve: game.player.health.reserve,
                        maxReserve: game.player.health.maxReserve
                    } : null
                } : { exists: false, reason: game.inOutpost ? 'In outpost - player not spawned' : 'Player not initialized' },
                hasEntities: Array.isArray(game.entities),
                entityCount: game.entities ? game.entities.length : 0,
                currentBiome: game.currentBiome || null,
                properties: Object.keys(game).filter(k => !k.startsWith('_') && typeof game[k] !== 'function')
            };
        } else {
            probeResult.game = { exists: false };
        }

        // Check registries
        const registryNames = [
            'EntityRegistry', 'AbilityRegistry', 'EquipmentRegistry', 
            'CharacterRegistry', 'NPCRegistry', 'PickupRegistry', 
            'StructureRegistry', 'UpgradeRegistry', 'BiomeRegistry'
        ];
        
        registryNames.forEach(name => {
            if (typeof window !== 'undefined' && window[name]) {
                probeResult.registries[name] = {
                    exists: true,
                    hasRegister: typeof window[name].register === 'function',
                    hasGet: typeof window[name].get === 'function'
                };
            } else if (typeof eval(name) !== 'undefined') {
                // Check if it's a script global
                try {
                    const reg = eval(name);
                    probeResult.registries[name] = {
                        exists: true,
                        isGlobal: true,
                        hasRegister: typeof reg.register === 'function',
                        hasGet: typeof reg.get === 'function'
                    };
                } catch (e) {
                    probeResult.registries[name] = { exists: false };
                }
            } else {
                probeResult.registries[name] = { exists: false };
            }
        });

        // Check MetaProgression (script global, not on window)
        try {
            if (typeof MetaProgression !== 'undefined') {
                probeResult.systems.MetaProgression = {
                    exists: true,
                    accessible: true,
                    hasData: !!MetaProgression.data,
                    hasSave: typeof MetaProgression.save === 'function',
                    hasLoad: typeof MetaProgression.load === 'function',
                    dataKeys: MetaProgression.data ? Object.keys(MetaProgression.data) : [],
                    essence: MetaProgression.data ? MetaProgression.data.essence : undefined,
                    currentCharacter: MetaProgression.data ? MetaProgression.data.currentCharacter : undefined,
                    equipment: MetaProgression.data ? MetaProgression.data.equipment : undefined,
                    inventory: MetaProgression.data && Array.isArray(MetaProgression.data.inventory) 
                        ? MetaProgression.data.inventory.length 
                        : 0
                };
            } else {
                probeResult.systems.MetaProgression = { exists: false, accessible: false };
            }
        } catch (e) {
            probeResult.systems.MetaProgression = { 
                exists: false, 
                accessible: false, 
                error: e.message 
            };
        }

        // Check other systems
        const systemNames = ['VoidBridge', 'VoidSystem', 'VoidMemoryStore', 'WorldState'];
        systemNames.forEach(name => {
            if (typeof window !== 'undefined' && window[name]) {
                const sys = window[name];
                probeResult.systems[name] = {
                    exists: true,
                    accessible: true,
                    properties: Object.keys(sys).filter(k => !k.startsWith('_') && typeof sys[k] !== 'function'),
                    methods: Object.keys(sys).filter(k => typeof sys[k] === 'function')
                };
                // Special handling for VoidBridge
                if (name === 'VoidBridge' && sys.config) {
                    probeResult.systems[name].config = {
                        mode: sys.config.mode,
                        hasEndpoint: !!sys.config.endpoint,
                        hasApiKey: !!sys.config.apiKey,
                        model: sys.config.model
                    };
                }
            } else {
                probeResult.systems[name] = { exists: false, accessible: false };
            }
        });
        
        // Also check for script globals that might not be on window
        const scriptGlobals = ['WorldState', 'WorldManager', 'HubState'];
        scriptGlobals.forEach(name => {
            if (!probeResult.systems[name] || !probeResult.systems[name].exists) {
                try {
                    if (typeof eval(name) !== 'undefined') {
                        const glob = eval(name);
                        probeResult.systems[name] = {
                            exists: true,
                            accessible: true,
                            isScriptGlobal: true,
                            type: typeof glob,
                            hasMethods: typeof glob === 'object' ? Object.keys(glob).filter(k => typeof glob[k] === 'function') : []
                        };
                    }
                } catch (e) {
                    // Ignore eval errors
                }
            }
        });

        return probeResult;
    }
};

// Make it global
window.VoidSystem = VoidSystem;

