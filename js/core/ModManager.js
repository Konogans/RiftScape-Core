class ModManager {
    constructor(game) {
        this.game = game;
        this.registeredMods = [];
        this.hooks = {}; 
        
        window.ModManager = this; 
        
        console.log("%c[ModManager] SYSTEM ONLINE. WAITING FOR INPUT.", "color: #00ff00; background: #111; padding: 4px;");
    }

    register(name, version, initFn) {
        console.log(`%c[INJECTION] Installing: ${name} v${version}`, "color: #00ffff");
        
        try {
            this.registeredMods.push({ name, version });
            
            // FIX: Pass 'this' as the second argument so mods can access the manager directly
            if (initFn) initFn(this.game, this);
            
            this.game.hud.updateDebug(`SYSTEM HACKED: ${name.toUpperCase()} INSTALLED`);
            this.game.sound.play('build'); 
            
            if (this.game.player && this.game.player.mesh) {
                this.game.spawnFloatingText(this.game.player.mesh.position.x, this.game.player.mesh.position.z, "MOD ACTIVE", 0x00ff00);
                this.game.spawnParticleBurst(this.game.player.mesh.position.x, this.game.player.mesh.position.z, 0x00ff00, 20);
            }
        } catch (e) {
            console.error(`[INJECTION FAILED] ${name} crashed on entry:`, e);
            this.game.sound.play('error');
            this.game.hud.updateDebug(`ERR: ${name.toUpperCase()} FAILED`);
        }
    }

    on(event, callback) {
        if (!this.hooks[event]) this.hooks[event] = [];
        this.hooks[event].push(callback);
    }

    trigger(event, data) {
        if (this.hooks[event]) {
            this.hooks[event].forEach(fn => fn(data));
        }
    }

    patch(ClassRef, methodName, newFn) {
        const original = ClassRef.prototype[methodName];
        if (!original) {
            console.warn(`[ModManager] Cannot patch ${ClassRef.name}.${methodName} - method not found.`);
            return;
        }

        console.log(`[ModManager] Patching ${ClassRef.name}.${methodName}...`);
        
        ClassRef.prototype[methodName] = function(...args) {
            return newFn(original.bind(this), this, ...args);
        };
    }
}