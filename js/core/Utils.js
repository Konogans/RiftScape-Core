
// PointPool - Dual-pool health system
class PointPool {
    constructor(options = {}) {
        this.maxActive = options.active || 5;
        this.active = this.maxActive;
        this.maxReserve = options.reserve || 10;
        this.reserve = this.maxReserve;
        this.regenPerSecond = options.regen || 0.5;
        this.onChanged = options.onChanged || (() => {});
        this.onReachZero = options.onReachZero || (() => {});
    }
    getCurrentMax() { return Math.ceil((this.reserve / this.maxReserve) * this.maxActive); }
    delta(amount) {
        const currentMax = this.getCurrentMax();
        if (amount >= 0) {
            if (this.active < currentMax) this.active += amount;
            if (amount > 0 && this.reserve < this.maxReserve) this.reserve += amount / 2;
        } else {
            const damage = -amount;
            this.active -= damage;
            this.reserve -= damage;
            this.active = Math.floor(this.active);
            this.reserve = Math.floor(this.reserve);
            if (this.active <= 0) {
                this.active = 0;
                this.onReachZero();
            }
        }
        if (this.active > currentMax) this.active = currentMax;
        if (this.reserve > this.maxReserve) this.reserve = this.maxReserve;
        if (this.reserve < 0) this.reserve = 0;
        this.onChanged();
    }
    update(deltaTime) { this.delta(this.regenPerSecond * deltaTime); }
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
        magicAffinity: 0, techAffinity: 0, upgrades: {}, startingAbilities: []
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
            magicAffinity: 0, techAffinity: 0, upgrades: {}, startingAbilities: []
        };
        this.save();
    },
    calculateRunEssence(time, kills) { return Math.floor(time / 10) + (kills * 2); },
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
    }
};
