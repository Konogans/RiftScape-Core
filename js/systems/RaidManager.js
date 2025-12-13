//

class RaidManager {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.awaitingChoice = false;
        this.wave = 1; // Tracks 1-5 within the current Level
        this.timer = 0;
        this.raidLevel = 1; 
    }

    startRaid() {
        if (this.active || this.awaitingChoice) return;
        
        // RESET STATE
        this.reset();
        this.active = true;
        this.game.hud.updateDebug("RAID INITIALIZED: WAVE 1");
        this.game.sound.play('error');
        if (this.game.riftGate) this.game.riftGate.addLabel("⚠ DEFEND THE GATE ⚠");
        
        // Hide Civilians
        this.game.entities.forEach(e => {
            if (e.constructor.name === 'NPC') e.mesh.visible = false;
        });
    }
    
    continueRaid() {
        this.active = true;
        this.awaitingChoice = false;
        
        this.raidLevel++; // Level 1 -> 2 (Boss Stage)
        this.wave = 1;    // Reset counter
        this.timer = 5.0; // Warmup
        
        this.game.sound.play('error');
        if (this.game.riftGate) this.game.riftGate.addLabel(`⚠ LEVEL ${this.raidLevel} START ⚠`);
    }
    
    reset() {
        this.active = false;
        this.awaitingChoice = false;
        this.wave = 1;
        this.timer = 5.0;
        this.raidLevel = 1;
        this.bossSpawnPending = false;
        this.bossSpawnTimer = 0;

        // Stop any playing music
        if (this.game.sound) this.game.sound.stopMusic();

        if (this.game.hud) {
            this.game.hud.updateRaid(false);
            this.game.hud.updateBoss(false);
            this.game.hud.updateDebug("");
        }
        
        // Show Civilians
        if (this.game && this.game.entities) {
            this.game.entities.forEach(e => {
                if (e.constructor.name === 'NPC') e.mesh.visible = true;
            });
        }
    }

    update(dt) {
        const gate = this.game.riftGate;
        const hp = gate ? gate.health : 0;
        const maxHp = gate ? gate.maxHealth : 1;

        // PAUSE STATE
        if (!this.active) {
            if (this.awaitingChoice && this.game.hud) {
                this.game.hud.setText('raidTimer', "SIEGE HALTED: CHECK GATE");
                this.game.hud.setBar('raidGateHealth', 1);
            } else if (this.game.hud) {
                this.game.hud.updateRaid(false);
            }
            return;
        }
        
        this.timer -= dt;
        const activeEnemies = this.game.enemies.filter(e => !e.dead).length;

        // BOSS SPAWN COUNTDOWN (music plays, boss spawns after delay)
        if (this.bossSpawnPending) {
            this.bossSpawnTimer -= dt;
            if (this.bossSpawnTimer <= 0) {
                this.actuallySpawnBoss();
            }
            // Show countdown in HUD
            if (this.game.hud) {
                this.game.hud.updateDebug(`⚠ THREAT INCOMING: ${Math.ceil(this.bossSpawnTimer)}s ⚠`);
            }
            return;
        }

        // BOSS STATE (If Boss is alive, pause wave timer/logic)
        if (this.game.currentBoss && !this.game.currentBoss.dead) {
            // Update Boss Bar
            this.game.hud.updateBoss(true, this.game.currentBoss.def.name, this.game.currentBoss.health.active, this.game.currentBoss.health.maxActive);

            // Wait for boss death...
            return;
        } else if (this.game.currentBoss) {
            // Boss just died - clear boss state (let music finish naturally)
            if (this.game.hud) this.game.hud.updateBoss(false);
            this.game.currentBoss = null;
        }
        
        // FAST FORWARD
        if (activeEnemies === 0 && this.timer > 5.0) {
            this.timer = 5.0;
            this.game.hud.updateDebug("SECTOR CLEAR. ACCELERATING...");
        }
        
        // WAVE SPAWNING
        if (this.timer <= 0) {
            // INTERMISSION CHECK
            // If we finished Wave 5, we stop.
            if (this.wave > 5) {
                if (activeEnemies === 0) {
                    this.pauseRaid();
                } else {
                    this.timer = 1.0; // Wait for clear
                }
                return;
            }

            // SPAWN
            this.spawnWave();
            
            // Advance
            this.timer = 30.0;
            this.wave++; // 1 becomes 2 (Next wave)
        }
        
        // UPDATE HUD
        if (this.game.hud) {
            // Logic: if this.wave is 2, we are FIGHTING Wave 1.
            // But we incremented it AFTER spawn.
            // So Active Wave = this.wave - 1.
            const currentWaveNum = Math.max(1, this.wave - 1);
            const globalWave = ((this.raidLevel - 1) * 5) + currentWaveNum;
            
            this.game.hud.updateRaid(
                true, hp, maxHp, 
                globalWave, 
                this.timer, activeEnemies, 
                currentWaveNum === 5 // Final wave of the set?
            );
        }
    }

    spawnWave() {
        // BOSS CHECK
        // If it's Wave 5 AND Raid Level is Even (2, 4, 6...) -> BOSS
        // NOTE: this.wave is currently 5 (about to spawn 5th wave)
        if (this.wave === 5 && (this.raidLevel % 2 === 0)) {
            this.spawnBoss();
            return;
        }

        // NORMAL WAVE
        const baseCount = 5 + (this.wave * 2);
        const count = Math.floor(baseCount * (1 + (this.raidLevel * 0.2))); 
        this.game.sound.play('shotgun');
        
        const pool = ['default'];
        if (this.raidLevel >= 1) pool.push('swift');
        if (this.raidLevel >= 2) pool.push('brute');
        if (this.raidLevel >= 3) pool.push('spitter');
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 30;
            const x = Math.sin(angle) * r;
            const z = Math.cos(angle) * r;
            
            const type = pool[Math.floor(Math.random() * pool.length)];
            const enemy = new Enemy(this.game, x, z, type);
            
            // Difficulty Scaling
            const mult = 1 + (this.raidLevel * 0.25);
            enemy.health.maxActive *= mult;
            enemy.health.active = enemy.health.maxActive;
            enemy.damage = Math.ceil(enemy.damage * mult);
            
            enemy.targetOverride = this.game.riftGate;
            
            this.game.enemies.push(enemy);
            this.game.entities.push(enemy);
            this.game.scene.add(enemy.mesh);
        }
    }

    spawnBoss() {
        // Start boss music first (no loop - let it play through)
        this.game.sound.playMusic('boss', false);
        this.game.hud.updateDebug(`⚠ WARNING: HIGH THREAT INCOMING ⚠`);
        this.game.sound.play('error');

        // Delay actual boss spawn by 20 seconds for dramatic buildup
        this.bossSpawnTimer = 20.0;
        this.bossSpawnPending = true;
    }

    actuallySpawnBoss() {
        this.bossSpawnPending = false;
        this.game.hud.updateDebug(`⚠ THE HEADLINER HAS ARRIVED ⚠`);
        this.game.sound.play('error');

        const x = 0;
        const z = -35;

        if (typeof Boss !== 'undefined') {
            const boss = new Boss(this.game, x, z, 'headliner');

            // SCALING: Base * (1 + (Level * 0.5))
            const mult = 1 + (this.raidLevel * 0.5);
            const def = EntityRegistry.get('headliner');

            boss.health.maxActive = Math.floor(def.health.active * mult);
            boss.health.active = boss.health.maxActive;
            boss.health.maxReserve = Math.floor(def.health.reserve * mult);
            boss.health.reserve = boss.health.maxReserve;
            boss.damage = Math.ceil(def.damage * mult);

            boss.targetOverride = this.game.riftGate;

            this.game.enemies.push(boss);
            this.game.entities.push(boss);
            this.game.scene.add(boss.mesh);

            this.game.currentBoss = boss;
        } else {
            this.spawnWave();
        }
    }

    pauseRaid() {
        this.active = false;
        this.awaitingChoice = true;
        this.game.sound.play('build');
        if (this.game.riftGate) this.game.riftGate.addLabel("SIEGE HALTED [INTERACT]");
        this.game.hud.updateDebug("WAVE SEQUENCE COMPLETE.");
    }

    failRaid() {
        this.reset();
        this.game.hud.updateDebug("GATE CRITICAL FAILURE");
        this.game.screenShake(1.0, 10);
        this.game.enemies.forEach(e => e.takeDamage(9999));
        if (this.game.riftGate) {
            this.game.riftGate.health = 1000;
            this.game.riftGate.addLabel("GATE REBOOTING...");
        }
    }

    endRaid(victory) {
        // Calculate reward before reset
        const reward = 500 * this.raidLevel;
        this.reset();
        
        if (victory) {
            this.game.hud.updateDebug(`SIEGE ENDED. REWARD: ${reward} ESSENCE.`);
            MetaProgression.data.essence += reward;
            MetaProgression.save();
            if (this.game.riftGate) this.game.riftGate.addLabel("RIFT GATE [READY]");
        }
    }
}