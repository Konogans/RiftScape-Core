class DialogueSystem {
    constructor(game) {
        this.game = game;
        this.overlay = document.getElementById('dialogue-overlay');
        this.nameEl = document.getElementById('npc-name');
        this.textEl = document.getElementById('npc-text');
        this.optionsEl = document.getElementById('dialogue-options');
        this.essenceEl = document.getElementById('player-essence');
        
        this.isOpen = false;
    }

    open(npc) {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this.game.input.clear(); // Prevent accidental clicks
        
        this.nameEl.textContent = npc.name;
        this.textEl.textContent = this.getGreeting(npc.role);
        
        this.updateShop(npc);
    }
    
    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        this.game.input.clear();
    }
    
	getGreeting(role) {
		const greetings = {
			smith: "The flesh is weak. Improve the hardware.",
			scribe: "Knowledge is power. Expand your mind.",
			'reset': "To begin again is to lose everything. Are you certain?" // NEW
		};
		return greetings[role] || "Greetings.";
	}

    updateShop(npc) {
        this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
        this.optionsEl.innerHTML = '';
        
        const allUpgrades = UpgradeRegistry.list();
        
        // DEBUG LOGS
        console.log(`[Shop] Opening shop for: ${npc.name} (Role: ${npc.role})`);
        console.log(`[Shop] Total upgrades found in registry: ${allUpgrades.length}`);


        let shopInventory = [];
        
        if (npc.role === 'smith') {
            shopInventory = allUpgrades.filter(u => 
                // Added 'dash_unlock'
                ['dash_unlock', 'vitality1', 'vitality2', 'reserves1', 'tech_armor', 'tech_speed', 'swiftness1'].includes(u.id)
            );
        } else if (npc.role === 'scribe') {
            shopInventory = allUpgrades.filter(u => 
                // Added 'slam_unlock'
                ['slam_unlock', 'magic_regen', 'magic_burst'].includes(u.id)
            );
        } else if (npc.role === 'reset') {
			
			// 1. REVERT TO WANDERER (If not currently Wanderer)
			if (MetaProgression.data.currentCharacter !== 'wanderer') {
				const btn = document.createElement('button');
				btn.className = 'dialogue-btn';
				btn.innerHTML = `
					<div class="header">DISCARD PERSONA</div>
					<div class="desc">Return to the form of the Wanderer.</div>
				`;
				
				btn.onclick = () => {
					if (MetaProgression.setCharacter('wanderer')) {
						this.textEl.textContent = "Identity dissolves. You are no one again.";
						
						if (window.HubState) {
							HubState.save(this.game.entities);
						}
						
						this.game.loadHub();
						this.close();
					}
				};
				this.optionsEl.appendChild(btn);
			}

			// 2. WIPE SAVE (The Danger Button)
			const wipeBtn = document.createElement('button');
			wipeBtn.className = 'dialogue-btn';
			wipeBtn.style.borderColor = '#ff4444';
			wipeBtn.style.color = '#ff8888'; 
			wipeBtn.innerHTML = `
				<div class="header">WIPE SAVE FILE <span class="cost">⚠️</span></div>
				<div class="desc">Permanently delete all progress.</div>
			`;
			wipeBtn.onclick = () => {
				if (confirm("FINAL WARNING: This will delete ALL Essence and Upgrades.")) {
					MetaProgression.reset(); 
					// 2. Wipe Base (Structures)
					if (window.HubState) HubState.clear();
					
					// 3. Wipe Raid State (Just in case)
					if (this.raidManager) this.raidManager.reset();
					this.close();
					this.game.loadHub(); 
					this.game.screenShake(0.5, 10);
				}
			};
			this.optionsEl.appendChild(wipeBtn);
			
			// 3. LEAVE
			const closeBtn = document.createElement('button');
			closeBtn.className = 'dialogue-btn close-btn';
			closeBtn.textContent = 'Nevermind';
			closeBtn.onclick = () => this.close();
			this.optionsEl.appendChild(closeBtn);
			
			return; // Stop here
		}
        
        console.log(`[Shop] Items matching role: ${shopInventory.length}`);
        
        if (shopInventory.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.textContent = "(No upgrades available for this role)";
            this.optionsEl.appendChild(msg);
        }
        
        shopInventory.forEach(upgrade => {
            const owned = MetaProgression.hasUpgrade(upgrade.id);
            const locked = upgrade.requires && !MetaProgression.hasUpgrade(upgrade.requires);
            
            // If we own it, skip rendering (cleaner menu)
            if (owned) {
                console.log(`[Shop] Hiding owned item: ${upgrade.name}`);
                return; 
            }
            
            const btn = document.createElement('button');
            btn.className = `dialogue-btn ${locked ? 'disabled' : ''}`;
			btn.innerHTML = `
                <div class="header">
                    <span class="name">${upgrade.name}</span>
                    <span class="cost">◆${upgrade.cost}</span>
                </div>
                <div class="desc">${upgrade.description}</div>
            `;
            
            if (!locked) {
                btn.onclick = () => {
                    if (MetaProgression.buyUpgrade(upgrade)) {
						
						this.game.sound.play('build'); // Cha-ching
						
						// FIX: Apply immediately
						if (this.game.player) {
							this.game.player.refreshStats();
						}
						
                        this.textEl.textContent = `Acquired: ${upgrade.name}. System integrated.`;
                        this.updateShop(npc); 
                        if (npc.role === 'smith') MetaProgression.data.techAffinity++;
                        if (npc.role === 'scribe') MetaProgression.data.magicAffinity++;
                        MetaProgression.save();
                    } else {
                        this.textEl.textContent = "Insufficient Essence.";
                        btn.style.borderColor = "red";
                        setTimeout(() => btn.style.borderColor = "", 500);
                    }
                };
            }
            
            this.optionsEl.appendChild(btn);
        });
		
		// 1. CHARACTER SWAP BUTTON (If applicable)
		// Garrick = Smith, Elara = Scribe
		const targetCharId = npc.role; // Convenient mapping!
		
		// Only show if this NPC corresponds to a playable class
		if (CharacterRegistry.characters[targetCharId]) {
			const charDef = CharacterRegistry.get(targetCharId);
			const isUnlocked = MetaProgression.data.unlockedCharacters.includes(targetCharId);
			const isCurrent = MetaProgression.data.currentCharacter === targetCharId;
			
			const btn = document.createElement('button');
			btn.className = 'dialogue-btn';
			
			if (isCurrent) {
				btn.innerHTML = `<div class="header">CURRENT FORM</div><div class="desc">You are currently the ${charDef.name}.</div>`;
				btn.className += ' disabled';
			} else if (isUnlocked) {
				btn.innerHTML = `<div class="header">MIMIC FORM</div><div class="desc">Switch to ${charDef.name}.</div>`;
				btn.onclick = () => {
					if (MetaProgression.setCharacter(targetCharId)) {
						this.textEl.textContent = `Sequence complete. You are now the ${charDef.name}.`;
						
						// We must snapshot the current structures before loadHub() wipes them.
						if (window.HubState) {
							HubState.save(this.game.entities);
						}
						
						// Reload Hub to respawn player with new stats/model
						this.game.loadHub();
						this.close();
					}
				};
			} else {
				btn.innerHTML = `<div class="header" style="color:#666">LOCKED FORM</div><div class="desc">Rescue this soul from the Rift.</div>`;
				btn.className += ' disabled';
			}
			
			this.optionsEl.appendChild(btn);
			
			// Divider
			const hr = document.createElement('div');
			hr.style.width = '100%'; hr.style.height = '1px'; hr.style.background = '#334455'; hr.style.margin = '5px 0';
			this.optionsEl.appendChild(hr);
		}
        
        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialogue-btn close-btn';
        closeBtn.textContent = 'Leave';
        closeBtn.onclick = () => this.close();
        this.optionsEl.appendChild(closeBtn);
    }
	
	openRiftMenu(gate) {
        this.open({ name: "RIFT GATE", role: "gate" }); // Hack: pass fake NPC object
        this.textEl.textContent = "The crystal hums with unstable energy.";
        
        // Option 1: Enter Rift
        const btnEnter = document.createElement('button');
        btnEnter.className = 'dialogue-btn';
        btnEnter.innerHTML = `<div class="header">ENTER THE RIFT</div><div class="desc">Begin a new run.</div>`;
        btnEnter.onclick = () => { this.game.enterRift(); this.close(); };
        this.optionsEl.appendChild(btnEnter);
        
        // Option 2: Start Siege
        const btnRaid = document.createElement('button');
        btnRaid.className = 'dialogue-btn';
        btnRaid.innerHTML = `<div class="header" style="color:#ff4444">START SIEGE PROTOCOL</div><div class="desc">Defend the gate against waves.</div>`;
        btnRaid.onclick = () => { 
            this.game.raidManager.startRaid(); 
            this.close(); 
        };
        this.optionsEl.appendChild(btnRaid);
        
        // Option 3: Cancel
        const btnClose = document.createElement('button');
        btnClose.className = 'dialogue-btn close-btn';
        btnClose.textContent = "Leave";
        btnClose.onclick = () => this.close();
        this.optionsEl.appendChild(btnClose);
    }
	
	openRaidPauseMenu() {
        this.open({ name: "SIEGE PROTOCOL", role: "gate" });
        const level = this.game.raidManager.raidLevel;
        const nextLevel = level + 1;
        const reward = 500 * level;
        
        this.textEl.innerHTML = `Wave sequence complete.<br>Threat Level: ${level}<br>Pending Reward: <span style="color:#ffcc44">${reward} Essence</span>`;
        
        // Option 1: CONTINUE (Risk it all)
        const btnCont = document.createElement('button');
        btnCont.className = 'dialogue-btn';
        btnCont.style.borderColor = '#ff4444';
        btnCont.innerHTML = `
            <div class="header" style="color:#ff4444">INCREASE THREAT [LVL ${nextLevel}]</div>
            <div class="desc">Enemies +25% Stats. Reward Increases.</div>
        `;
        btnCont.onclick = () => { 
            this.game.raidManager.continueRaid(); 
            this.close(); 
        };
        this.optionsEl.appendChild(btnCont);
        
        // Option 2: CASH OUT (Safe)
        const btnEnd = document.createElement('button');
        btnEnd.className = 'dialogue-btn';
        btnEnd.style.borderColor = '#44ff44';
        btnEnd.innerHTML = `
            <div class="header" style="color:#44ff44">END SIEGE</div>
            <div class="desc">Claim ${reward} Essence and stop.</div>
        `;
        btnEnd.onclick = () => { 
            this.game.raidManager.endRaid(true); // Victory
            this.close(); 
        };
        this.optionsEl.appendChild(btnEnd);
    }
}