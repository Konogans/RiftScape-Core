
// PointPool - Dual-pool "Wound" system
class PointPool {
    constructor(options = {}) {
        this.maxActive = options.active || 5;
        this.active = this.maxActive;
        
        this.maxReserve = options.reserve || 10;
        this.reserve = this.maxReserve;
        
        // FIX: Split regen rates. Active regens, Reserve (Max HP) usually doesn't.
        this.activeRegen = options.regen || 0; 
        this.reserveRegen = options.reserveRegen || 0; // Default to 0 (No free max hp recovery)
        
        this.onChanged = options.onChanged || (() => {});
        this.onReachZero = options.onReachZero || (() => {});
    }
    
    getCurrentMax() { 
        // Your "Active" cap is proportional to how much "Reserve" (Soul) you have left
        return Math.ceil((this.reserve / this.maxReserve) * this.maxActive); 
    }
    
    delta(amount) {
        const currentMax = this.getCurrentMax();
        
        if (amount >= 0) {
            // HEALING
            if (this.active < currentMax) this.active += amount;
            
            // Reserve only heals if explicitly specified (e.g. pickups), 
            // NOT from standard regen (because reserveRegen is 0)
            if (this.reserve < this.maxReserve && this.reserveRegen > 0) {
                 this.reserve += amount / 2;
            }
        } else {
            // DAMAGE
            const damage = -amount;
            this.active -= damage;
            this.reserve -= damage; // You lose Max HP when you take damage (The Wound)
            
            // Clamp
            if (this.active <= 0) {
                this.active = 0;
                this.onReachZero();
            }
        }
        
        // Hard Clamps
        if (this.active > currentMax) this.active = currentMax;
        if (this.reserve > this.maxReserve) this.reserve = this.maxReserve;
        if (this.reserve < 0) this.reserve = 0;
        
        this.onChanged();
    }
    
    update(deltaTime) {
        // Only regenerate Active health automatically
        if (this.activeRegen > 0) {
            const currentMax = this.getCurrentMax();
            if (this.active < currentMax) {
                this.delta(this.activeRegen * deltaTime);
            }
        }
        
        // Reserve regen (usually 0) handled separately if needed
        if (this.reserveRegen > 0) {
            this.reserve += this.reserveRegen * deltaTime;
            if(this.reserve > this.maxReserve) this.reserve = this.maxReserve;
        }
    }
	
	restoreReserve(amount) {
        this.reserve += amount;
        
        // Clamp to max
        if (this.reserve > this.maxReserve) this.reserve = this.maxReserve;
        
        // Optional: restoring reserve also heals active? 
        // For "Wound" systems, usually no, it just raises the ceiling.
        
        this.onChanged();
    }
    
    isDepleted() { return this.active <= 0; }
    getActiveRatio() { return this.active / this.maxActive; }
    getReserveRatio() { return this.reserve / this.maxReserve; }
    getCurrentMaxRatio() { return this.getCurrentMax() / this.maxActive; }
}

// Action - Windup/action/cooldown phases
class Action {
    constructor(options = {}) {
        this.windupTime = options.windupTime || 200;
        this.actionTime = options.actionTime || 100;
        this.cooldownTime = options.cooldownTime || 300;
        this.onWindup = options.onWindup || (() => {});
        this.onAction = options.onAction || (() => {});
        this.onCooldown = options.onCooldown || (() => {});
        this.onFinish = options.onFinish || (() => {});
        this.onUpdate = options.onUpdate || (() => {});
        this.status = 'idle';
        this.currentTime = 0;
        this.isComplete = false;
    }
    trigger() {
        if (this.status !== 'idle') return false;
        this.status = 'windup';
        this.currentTime = 0;
        this.isComplete = false;
        this.onWindup();
        return true;
    }
    update(deltaTimeMs) {
        if (this.status === 'idle' || this.isComplete) return;
        this.currentTime += deltaTimeMs;
        this.onUpdate(this);
        if (this.status === 'windup' && this.currentTime >= this.windupTime) {
            this.status = 'action';
            this.onAction();
        } else if (this.status === 'action' && this.currentTime >= this.windupTime + this.actionTime) {
            this.status = 'cooldown';
            this.onCooldown();
        } else if (this.status === 'cooldown' && this.currentTime >= this.windupTime + this.actionTime + this.cooldownTime) {
            this.status = 'idle';
            this.isComplete = true;
            this.onFinish();
        }
    }
    getPhaseProgress() {
        switch (this.status) {
            case 'windup': return this.currentTime / this.windupTime;
            case 'action': return (this.currentTime - this.windupTime) / this.actionTime;
            case 'cooldown': return (this.currentTime - this.windupTime - this.actionTime) / this.cooldownTime;
            default: return 0;
        }
    }
    getTotalProgress() {
        const total = this.windupTime + this.actionTime + this.cooldownTime;
        return Math.min(this.currentTime / total, 1);
    }
    canInterrupt() { return this.status === 'idle' || this.status === 'cooldown'; }
    reset() {
        this.status = 'idle';
        this.currentTime = 0;
        this.isComplete = false;
    }
}

// Meta-Progression System
const MetaProgression = {
    data: {
        essence: 0, totalEssence: 0, runs: 0, bestTime: 0, bestKills: 0,
        magicAffinity: 0, techAffinity: 0, upgrades: {}, 
        // NEW: Identity Tracking
        currentCharacter: 'wanderer', 
        unlockedCharacters: ['wanderer'], // Everyone starts as Wanderer
        // NEW: Custom Loadouts (per character)
        customLoadouts: {} // Format: { characterId: { primary: 'swipe', secondary: 'slam', ... } }
    },
    save() {
        try { localStorage.setItem('riftscape_meta', JSON.stringify(this.data)); } 
        catch (e) { console.log('Save failed'); }
    },
    load() {
        try {
            const saved = localStorage.getItem('riftscape_meta');
            if (saved) Object.assign(this.data, JSON.parse(saved));
        } catch (e) { console.log('Load failed'); }
    },
    reset() {
		this.data = {
            essence: 0, totalEssence: 0, runs: 0, bestTime: 0, bestKills: 0,
            magicAffinity: 0, techAffinity: 0, upgrades: {}, 
            currentCharacter: 'wanderer',
            unlockedCharacters: ['wanderer'],
            customLoadouts: {}
        };
        this.save();
    },
    calculateRunEssence(time, kills) { 
        return Math.floor(time / 10) + Math.floor(kills * 0.2); 
    },
    endRun(time, kills, affinityChoice, collectedEssence = 0) {
        const bonusEssence = this.calculateRunEssence(time, kills);
        const earned = bonusEssence + collectedEssence;
        this.data.essence += earned;
        this.data.totalEssence += earned;
        this.data.runs++;
        if (time > this.data.bestTime) this.data.bestTime = time;
        if (kills > this.data.bestKills) this.data.bestKills = kills;
        if (affinityChoice === 'magic') this.data.magicAffinity += Math.floor(kills / 5) + 1;
        else if (affinityChoice === 'tech') this.data.techAffinity += Math.floor(kills / 5) + 1;
        this.save();
        return earned;
    },
    hasUpgrade(id) { return this.data.upgrades[id] || false; },
    buyUpgrade(upgrade) {
        if (this.data.essence >= upgrade.cost && !this.hasUpgrade(upgrade.id)) {
            this.data.essence -= upgrade.cost;
            this.data.upgrades[upgrade.id] = true;
            this.save();
            return true;
        }
        return false;
    },
    getStatMods() {
        const mods = { maxHealth: 0, maxReserve: 0, regenRate: 0, moveSpeed: 0, attackDamage: 0, attackSpeed: 0 };
        for (const upgrade of UpgradeRegistry.list()) {
            if (this.hasUpgrade(upgrade.id)) {
                for (const [stat, value] of Object.entries(upgrade.effects)) {
                    if (mods[stat] !== undefined) mods[stat] += value;
                }
            }
        }
        return mods;
    },
    setCharacter(id) {
        if (this.data.unlockedCharacters.includes(id)) {
            this.data.currentCharacter = id;
            this.save();
            return true;
        }
        return false;
    },
    
    unlockCharacter(id) {
        if (!this.data.unlockedCharacters.includes(id)) {
            this.data.unlockedCharacters.push(id);
            this.save();
            return true;
        }
        return false;
    }
};

// The "PlayStation 1" Material Patcher
const PSXify = (material) => {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.resolution = { value: new THREE.Vector2(320, 224) };
        
        // Inject the jitter logic into the vertex shader
        shader.vertexShader = `
            uniform vec2 resolution;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            
            // PSX VERTEX JITTER / SNAPPING
            // We divide by W to get screen coordinates, snap them, then multiply back
            vec4 pos = gl_Position;
            pos.xyz /= pos.w;
            pos.xy = floor(pos.xy * resolution * 0.7) / (resolution * 0.7); // 0.7 scales the jitter intensity
            pos.xyz *= pos.w;
            gl_Position = pos;
            `
        );
    };
    return material; // Return it for chaining
};
// Make it global so we can use it everywhere
window.PSXify = PSXify;