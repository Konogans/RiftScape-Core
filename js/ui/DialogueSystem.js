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
        
        // Get NPC definition from registry (fallback to npc object if not found)
        const npcDef = NPCRegistry.get(npc.role) || { name: npc.name, role: npc.role, greeting: "Greetings.", uiType: 'shop' };
        
        this.nameEl.textContent = npcDef.name || npc.name;
        this.textEl.textContent = npcDef.greeting || "Greetings.";
        
        // Route to appropriate UI based on NPC definition
        this.updateShop(npc, npcDef);
    }
    
    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        this.game.input.clear();
    }

    updateShop(npc, npcDef) {
        this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
        this.optionsEl.innerHTML = '';
        
        // Route to appropriate UI based on NPC definition
        if (npcDef.uiType === 'pedalboard') {
            this.updatePedalboard(npc);
            return;
        }
        
        if (npcDef.uiType === 'equipment') {
            this.updateEquipment(npc);
            return;
        }
        
        if (npcDef.uiType === 'trader') {
            this.updateTrader(npc);
            return;
        }
        
        if (npcDef.uiType === 'void') {
            this.updateVoid(npc, npcDef);
            return;
        }
        
        if (npcDef.uiType === 'reset') {
			
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
        
        // Get shop inventory from NPC definition
        const allUpgrades = UpgradeRegistry.list();
        const shopInventory = allUpgrades.filter(u => 
            npcDef.shopInventory && npcDef.shopInventory.includes(u.id)
        );
        
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
                        this.updateShop(npc, npcDef);
                        // Apply affinity bonus if NPC has one
                        if (npcDef.affinityType === 'tech') MetaProgression.data.techAffinity++;
                        if (npcDef.affinityType === 'magic') MetaProgression.data.magicAffinity++;
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
		// Only show if NPC explicitly has a characterId (not null/undefined)
		const targetCharId = npcDef.characterId;
		
		// Only show if this NPC corresponds to a playable class and characterId is explicitly set
		if (targetCharId && CharacterRegistry.get(targetCharId)) {
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
        // Open dialogue overlay but don't call updateShop (which adds a close button)
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this.game.input.clear();
        
        // Set name and text manually
        this.nameEl.textContent = "RIFT GATE";
        this.textEl.textContent = "The crystal hums with unstable energy.";
        
        // Clear options (in case updateShop was called)
        this.optionsEl.innerHTML = '';
        
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
        // Open dialogue overlay but don't call updateShop (which adds a close button)
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this.game.input.clear();
        
        // Set name and text manually
        this.nameEl.textContent = "SIEGE PROTOCOL";
        const level = this.game.raidManager.raidLevel;
        const nextLevel = level + 1;
        const reward = 500 * level;
        this.textEl.innerHTML = `Wave sequence complete.<br>Threat Level: ${level}<br>Pending Reward: <span style="color:#ffcc44">${reward} Essence</span>`;
        
        // Clear options (in case updateShop was called)
        this.optionsEl.innerHTML = '';
        
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
    
    updatePedalboard(npc) {
        // Clear existing content first to prevent duplication
        this.optionsEl.innerHTML = '';
        
        const charId = MetaProgression.data.currentCharacter;
        const charDef = CharacterRegistry.get(charId);
        const customLoadout = MetaProgression.data.customLoadouts && MetaProgression.data.customLoadouts[charId];
        const currentLoadout = customLoadout || charDef.loadout || {};
        
        const slots = [
            { id: 'primary', label: 'Primary Attack', required: true },
            { id: 'secondary', label: 'Secondary', required: false },
            { id: 'mobility', label: 'Mobility', required: true },
            { id: 'utility', label: 'Utility', required: false },
            { id: 'mastery', label: 'Mastery', required: false }
        ];
        
        // Get available abilities by type (filtered by restrictions)
        const equippedWeaponId = MetaProgression.data.equipment?.weapon || null;
        const getAbilitiesByType = (type) => {
            return EquipmentValidator.getValidAbilities(charId, equippedWeaponId, type);
        };
        
        slots.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'pedalboard-slot';
            slotDiv.innerHTML = `<div class="slot-label">${slot.label}</div>`;
            
            const currentAbilityId = currentLoadout[slot.id];
            const currentAbility = currentAbilityId ? AbilityRegistry.get(currentAbilityId) : null;
            
            // Current ability display
            const currentDiv = document.createElement('div');
            currentDiv.className = 'current-ability';
            if (currentAbility) {
                currentDiv.innerHTML = `
                    <div class="ability-name">${currentAbility.name}</div>
                    <div class="ability-desc">${currentAbility.description || ''}</div>
                `;
            } else {
                currentDiv.innerHTML = '<div class="ability-name" style="color:#666">Empty</div>';
            }
            slotDiv.appendChild(currentDiv);
            
            // Ability selection buttons
            const abilities = getAbilitiesByType(slot.id);
            if (abilities.length > 0) {
                const selectDiv = document.createElement('div');
                selectDiv.className = 'ability-select';
                
                abilities.forEach(ability => {
                    const btn = document.createElement('button');
                    btn.className = 'ability-btn';
                    if (currentAbilityId === ability.id) {
                        btn.classList.add('selected');
                    }
                    
                    // Check if ability is valid (may have become invalid due to weapon change)
                    const isValid = EquipmentValidator.canUseAbility(ability.id, charId, equippedWeaponId);
                    if (!isValid) {
                        btn.classList.add('disabled');
                        btn.title = `${ability.description || ''} (Requires ${ability.requiresWeaponType || 'specific'} weapon)`;
                    } else {
                        btn.title = ability.description || '';
                    }
                    
                    btn.textContent = ability.name;
                    btn.onclick = () => {
                        if (!isValid) return; // Don't allow selection of invalid abilities
                        // Save to custom loadout
                        if (!MetaProgression.data.customLoadouts) {
                            MetaProgression.data.customLoadouts = {};
                        }
                        if (!MetaProgression.data.customLoadouts[charId]) {
                            MetaProgression.data.customLoadouts[charId] = {};
                        }
                        MetaProgression.data.customLoadouts[charId][slot.id] = ability.id;
                        MetaProgression.save();
                        
                        // Refresh UI
                        this.updatePedalboard(npc);
                        
                        // Reload player loadout if in hub
                        if (this.game.player && this.game.inOutpost) {
                            this.game.player.initLoadout();
                        }
                    };
                    selectDiv.appendChild(btn);
                });
                
                // Clear button (always show to prevent layout shifts, but disable when empty)
                const clearBtn = document.createElement('button');
                clearBtn.className = 'ability-btn clear-btn';
                clearBtn.textContent = 'Clear';
                if (!currentAbilityId) {
                    clearBtn.disabled = true;
                } else {
                    clearBtn.onclick = () => {
                        if (MetaProgression.data.customLoadouts && MetaProgression.data.customLoadouts[charId]) {
                            delete MetaProgression.data.customLoadouts[charId][slot.id];
                            if (Object.keys(MetaProgression.data.customLoadouts[charId]).length === 0) {
                                delete MetaProgression.data.customLoadouts[charId];
                            }
                            MetaProgression.save();
                            this.updatePedalboard(npc);
                            if (this.game.player && this.game.inOutpost) {
                                this.game.player.initLoadout();
                            }
                        }
                    };
                }
                selectDiv.appendChild(clearBtn);
                
                slotDiv.appendChild(selectDiv);
            }
            
            this.optionsEl.appendChild(slotDiv);
        });
        
        // Reset to default button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'dialogue-btn';
        resetBtn.innerHTML = '<div class="header">Reset to Default</div><div class="desc">Restore character\'s default loadout.</div>';
        resetBtn.onclick = () => {
            if (MetaProgression.data.customLoadouts && MetaProgression.data.customLoadouts[charId]) {
                delete MetaProgression.data.customLoadouts[charId];
                MetaProgression.save();
                this.updatePedalboard(npc);
                if (this.game.player && this.game.inOutpost) {
                    this.game.player.initLoadout();
                }
            }
        };
        this.optionsEl.appendChild(resetBtn);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialogue-btn close-btn';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => this.close();
        this.optionsEl.appendChild(closeBtn);
    }
    
    updateEquipment(npc) {
        this.optionsEl.innerHTML = ''; // Clear to prevent duplication
        
        const charId = MetaProgression.data.currentCharacter;
        const equipment = MetaProgression.data.equipment || { weapon: null, trinkets: [null, null, null] };
        
        // WEAPON SLOT
        const weaponSection = document.createElement('div');
        weaponSection.className = 'pedalboard-section';
        weaponSection.innerHTML = `<div class="section-title">Weapon</div>`;
        
        const weaponSlotDiv = document.createElement('div');
        weaponSlotDiv.className = 'pedalboard-slot';
        weaponSlotDiv.innerHTML = `<div class="slot-label">Equipped Weapon</div>`;
        
        const currentWeaponId = equipment.weapon;
        const currentWeapon = currentWeaponId ? EquipmentRegistry.get(currentWeaponId) : null;
        
        const currentWeaponDiv = document.createElement('div');
        currentWeaponDiv.className = 'current-ability';
        if (currentWeapon) {
            const statsText = currentWeapon.stats ? Object.entries(currentWeapon.stats)
                .filter(([k, v]) => v !== 0)
                .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
                .join(', ') : '';
            currentWeaponDiv.innerHTML = `
                <div class="ability-name">${currentWeapon.name}</div>
                <div class="ability-desc">${currentWeapon.description || ''}</div>
                ${statsText ? `<div class="ability-desc" style="color:#88cc88; margin-top:4px;">${statsText}</div>` : ''}
            `;
        } else {
            currentWeaponDiv.innerHTML = '<div class="ability-name" style="color:#666">None</div>';
        }
        weaponSlotDiv.appendChild(currentWeaponDiv);
        
        // Weapon selection (only show inventory items + currently equipped)
        const weaponSelectDiv = document.createElement('div');
        weaponSelectDiv.className = 'ability-select';
        
        // Get weapons from inventory
        const inventory = MetaProgression.getInventoryItems();
        const inventoryWeapons = inventory
            .filter(item => item.type === 'equipment')
            .map(item => EquipmentRegistry.get(item.id))
            .filter(equip => equip && equip.type === 'weapon' && EquipmentValidator.canEquipWeapon(equip.id, charId));
        
        // Only show weapons that are in inventory OR currently equipped
        const allWeapons = [];
        const seenIds = new Set();
        
        // Add currently equipped weapon (if any) so it can be shown/cleared
        if (currentWeaponId) {
            const equippedWeapon = EquipmentRegistry.get(currentWeaponId);
            if (equippedWeapon && EquipmentValidator.canEquipWeapon(equippedWeapon.id, charId)) {
                const inInventory = MetaProgression.getInventoryCount('equipment', equippedWeapon.id);
                allWeapons.push({ ...equippedWeapon, fromInventory: inInventory > 0 });
                seenIds.add(equippedWeapon.id);
            }
        }
        
        // Add inventory weapons (that aren't already shown as equipped)
        inventoryWeapons.forEach(weapon => {
            if (!seenIds.has(weapon.id)) {
                allWeapons.push({ ...weapon, fromInventory: true });
                seenIds.add(weapon.id);
            }
        });
        
        // If no weapons available, show message
        if (allWeapons.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.textContent = "No weapons available. Find equipment by defeating enemies!";
            weaponSelectDiv.appendChild(msg);
        }
        
        allWeapons.forEach(weapon => {
            const btn = document.createElement('button');
            btn.className = 'ability-btn';
            if (currentWeaponId === weapon.id) {
                btn.classList.add('selected');
            }
            
            // Check if weapon is valid for character
            const isValid = EquipmentValidator.canEquipWeapon(weapon.id, charId);
            if (!isValid) {
                btn.classList.add('disabled');
                btn.title = `${weapon.description || ''} (Not allowed for this character)`;
            } else {
                btn.title = weapon.description || '';
            }
            
            btn.textContent = weapon.name;
            if (weapon.fromInventory) {
                const count = MetaProgression.getInventoryCount('equipment', weapon.id);
                btn.textContent += ` (x${count})`;
            }
            btn.onclick = () => {
                if (!isValid) return; // Don't allow selection of invalid weapons
                
                // Don't do anything if already equipped
                if (currentWeaponId === weapon.id) {
                    return;
                }
                
                // If from inventory, remove one from inventory when equipping
                // (But only if it's actually in inventory - equipped items without inventory count don't consume)
                if (weapon.fromInventory) {
                    const count = MetaProgression.getInventoryCount('equipment', weapon.id);
                    if (count > 0) {
                        MetaProgression.removeFromInventory('equipment', weapon.id, 1);
                    }
                }
                
                // If there was a previously equipped weapon, add it back to inventory
                if (currentWeaponId) {
                    MetaProgression.addToInventory('equipment', currentWeaponId, 1);
                }
                
                MetaProgression.equipWeapon(weapon.id);
                this.updateEquipment(npc);
                if (this.game.player && this.game.inOutpost) {
                    // Reload player to apply equipment changes
                    this.game.loadHub();
                }
            };
            weaponSelectDiv.appendChild(btn);
        });
        
        // Clear weapon button
        const clearWeaponBtn = document.createElement('button');
        clearWeaponBtn.className = 'ability-btn clear-btn';
        clearWeaponBtn.textContent = 'Clear';
        if (!currentWeaponId) {
            clearWeaponBtn.classList.add('disabled');
        } else {
            clearWeaponBtn.onclick = () => {
                MetaProgression.unequipWeapon();
                this.updateEquipment(npc);
                if (this.game.player && this.game.inOutpost) {
                    this.game.loadHub();
                }
            };
        }
        weaponSelectDiv.appendChild(clearWeaponBtn);
        weaponSlotDiv.appendChild(weaponSelectDiv);
        weaponSection.appendChild(weaponSlotDiv);
        this.optionsEl.appendChild(weaponSection);
        
        // TRINKET SLOTS
        const trinketSection = document.createElement('div');
        trinketSection.className = 'pedalboard-section';
        trinketSection.innerHTML = `<div class="section-title">Trinkets (3 Slots)</div>`;
        
        for (let i = 0; i < 3; i++) {
            const trinketSlotDiv = document.createElement('div');
            trinketSlotDiv.className = 'pedalboard-slot';
            trinketSlotDiv.innerHTML = `<div class="slot-label">Trinket Slot ${i + 1}</div>`;
            
            const currentTrinketId = equipment.trinkets[i];
            const currentTrinket = currentTrinketId ? EquipmentRegistry.get(currentTrinketId) : null;
            
            const currentTrinketDiv = document.createElement('div');
            currentTrinketDiv.className = 'current-ability';
            if (currentTrinket) {
                const statsText = currentTrinket.stats ? Object.entries(currentTrinket.stats)
                    .filter(([k, v]) => v !== 0)
                    .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
                    .join(', ') : '';
                currentTrinketDiv.innerHTML = `
                    <div class="ability-name">${currentTrinket.name}</div>
                    <div class="ability-desc">${currentTrinket.description || ''}</div>
                    ${statsText ? `<div class="ability-desc" style="color:#88cc88; margin-top:4px;">${statsText}</div>` : ''}
                `;
            } else {
                currentTrinketDiv.innerHTML = '<div class="ability-name" style="color:#666">Empty</div>';
            }
            trinketSlotDiv.appendChild(currentTrinketDiv);
            
            // Trinket selection (only show inventory items + currently equipped)
            const trinketSelectDiv = document.createElement('div');
            trinketSelectDiv.className = 'ability-select';
            
            // Get trinkets from inventory
            const inventoryTrinkets = inventory
                .filter(item => item.type === 'equipment')
                .map(item => EquipmentRegistry.get(item.id))
                .filter(equip => equip && equip.type === 'trinket');
            
            // Only show trinkets that are in inventory OR currently equipped
            const allTrinkets = [];
            const seenTrinketIds = new Set();
            
            // Add currently equipped trinket (if any) so it can be shown/cleared
            if (currentTrinketId) {
                const equippedTrinket = EquipmentRegistry.get(currentTrinketId);
                if (equippedTrinket) {
                    const inInventory = MetaProgression.getInventoryCount('equipment', equippedTrinket.id);
                    allTrinkets.push({ ...equippedTrinket, fromInventory: inInventory > 0 });
                    seenTrinketIds.add(equippedTrinket.id);
                }
            }
            
            // Add inventory trinkets (that aren't already shown as equipped)
            inventoryTrinkets.forEach(trinket => {
                if (!seenTrinketIds.has(trinket.id)) {
                    allTrinkets.push({ ...trinket, fromInventory: true });
                    seenTrinketIds.add(trinket.id);
                }
            });
            
            allTrinkets.forEach(trinket => {
                const btn = document.createElement('button');
                btn.className = 'ability-btn';
                if (currentTrinketId === trinket.id) {
                    btn.classList.add('selected');
                }
                btn.textContent = trinket.name;
                if (trinket.fromInventory) {
                    const count = MetaProgression.getInventoryCount('equipment', trinket.id);
                    btn.textContent += ` (x${count})`;
                }
                btn.title = trinket.description || '';
                btn.onclick = () => {
                    // Don't do anything if already equipped in this slot
                    if (currentTrinketId === trinket.id) {
                        return;
                    }
                    
                    // If from inventory, remove one from inventory when equipping
                    // (But only if it's actually in inventory - equipped items without inventory count don't consume)
                    if (trinket.fromInventory) {
                        const count = MetaProgression.getInventoryCount('equipment', trinket.id);
                        if (count > 0) {
                            MetaProgression.removeFromInventory('equipment', trinket.id, 1);
                        }
                    }
                    
                    // If there was a previously equipped trinket, add it back to inventory
                    if (currentTrinketId) {
                        MetaProgression.addToInventory('equipment', currentTrinketId, 1);
                    }
                    
                    MetaProgression.equipTrinket(trinket.id, i);
                    this.updateEquipment(npc);
                    if (this.game.player && this.game.inOutpost) {
                        this.game.player.refreshStats();
                    }
                };
                trinketSelectDiv.appendChild(btn);
            });
            
            // Clear trinket button
            const clearTrinketBtn = document.createElement('button');
            clearTrinketBtn.className = 'ability-btn clear-btn';
            clearTrinketBtn.textContent = 'Clear';
            if (!currentTrinketId) {
                clearTrinketBtn.classList.add('disabled');
            } else {
                clearTrinketBtn.onclick = () => {
                    MetaProgression.unequipTrinket(i);
                    this.updateEquipment(npc);
                    if (this.game.player && this.game.inOutpost) {
                        this.game.player.refreshStats();
                    }
                };
            }
            trinketSelectDiv.appendChild(clearTrinketBtn);
            trinketSlotDiv.appendChild(trinketSelectDiv);
            trinketSection.appendChild(trinketSlotDiv);
        }
        
        this.optionsEl.appendChild(trinketSection);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialogue-btn close-btn';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => this.close();
        this.optionsEl.appendChild(closeBtn);
    }
    
    updateTrader(npc) {
        this.optionsEl.innerHTML = ''; // Clear to prevent duplication
        
        this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
        
        const inventory = MetaProgression.getInventoryItems();
        const equipmentItems = inventory.filter(item => item.type === 'equipment');
        
        if (equipmentItems.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '20px';
            msg.textContent = "You have no items to sell. Defeat enemies to find rare equipment!";
            this.optionsEl.appendChild(msg);
        } else {
            // Group items by ID for display
            const groupedItems = {};
            equipmentItems.forEach(item => {
                if (!groupedItems[item.id]) {
                    groupedItems[item.id] = { id: item.id, count: 0 };
                }
                groupedItems[item.id].count += item.count;
            });
            
            // Create section header
            const header = document.createElement('div');
            header.className = 'pedalboard-section';
            header.innerHTML = `<div class="section-title">Your Inventory</div>`;
            this.optionsEl.appendChild(header);
            
            // Display each item
            Object.values(groupedItems).forEach(itemData => {
                const equipment = EquipmentRegistry.get(itemData.id);
                if (!equipment) return;
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'pedalboard-slot';
                
                const sellValue = equipment.type === 'weapon' ? 50 : 25;
                const totalValue = sellValue * itemData.count;
                
                itemDiv.innerHTML = `
                    <div class="slot-label">${equipment.name} ${itemData.count > 1 ? `(x${itemData.count})` : ''}</div>
                    <div class="current-ability">
                        <div class="ability-name">${equipment.name}</div>
                        <div class="ability-desc">${equipment.description || ''}</div>
                        <div class="ability-desc" style="color:#88cc88; margin-top:4px;">
                            Sell Value: ◆${sellValue} each (Total: ◆${totalValue})
                        </div>
                    </div>
                `;
                
                const actionDiv = document.createElement('div');
                actionDiv.className = 'ability-select';
                
                // Sell 1 button
                if (itemData.count > 0) {
                    const sell1Btn = document.createElement('button');
                    sell1Btn.className = 'ability-btn';
                    sell1Btn.textContent = `Sell 1 (◆${sellValue})`;
                    sell1Btn.onclick = () => {
                        const earned = MetaProgression.sellItem('equipment', itemData.id, 1);
                        if (earned > 0) {
                            this.game.sound.play('build');
                            this.textEl.textContent = `Sold ${equipment.name} for ◆${earned} essence.`;
                            // Update dialogue essence display
                            this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
                            // Update HUD if player exists
                            if (this.game.player && this.game.player.updateEssenceUI) {
                                this.game.player.updateEssenceUI();
                            }
                            this.updateTrader(npc);
                        }
                    };
                    actionDiv.appendChild(sell1Btn);
                }
                
                // Sell All button
                if (itemData.count > 1) {
                    const sellAllBtn = document.createElement('button');
                    sellAllBtn.className = 'ability-btn';
                    sellAllBtn.textContent = `Sell All (◆${totalValue})`;
                    sellAllBtn.onclick = () => {
                        const earned = MetaProgression.sellItem('equipment', itemData.id, itemData.count);
                        if (earned > 0) {
                            this.game.sound.play('build');
                            this.textEl.textContent = `Sold ${itemData.count}x ${equipment.name} for ◆${earned} essence.`;
                            // Update dialogue essence display
                            this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
                            // Update HUD if player exists
                            if (this.game.player && this.game.player.updateEssenceUI) {
                                this.game.player.updateEssenceUI();
                            }
                            this.updateTrader(npc);
                        }
                    };
                    actionDiv.appendChild(sellAllBtn);
                }
                
                itemDiv.appendChild(actionDiv);
                this.optionsEl.appendChild(itemDiv);
            });
        }
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialogue-btn close-btn';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => this.close();
        this.optionsEl.appendChild(closeBtn);
    }
    
    updateVoid(npc, npcDef) {
        this.optionsEl.innerHTML = '';
        this.essenceEl.textContent = `◆ ${MetaProgression.data.essence}`;
        
        // Get VoidBridge reference (should be on window after script loads)
        if (!window.VoidBridge) {
            console.error('[DialogueSystem] VoidBridge not available. Ensure VoidBridge.js is loaded.');
            return;
        }
        const VoidBridge = window.VoidBridge;
        
        // Load Void memory
        const voidMemory = VoidMemoryStore.load();
        
        // Configuration section
        const configSection = document.createElement('div');
        configSection.className = 'pedalboard-section';
        configSection.innerHTML = `<div class="section-title">Configuration</div>`;
        
        // Mode selector
        const modeDiv = document.createElement('div');
        modeDiv.style.marginBottom = '10px';
        const currentMode = (window.VoidBridge || VoidBridge)?.config?.mode || 'oracle';
        modeDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">Mode:</label>
            <select id="void-mode" style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace;">
                <option value="oracle" ${currentMode === 'oracle' ? 'selected' : ''}>Oracle (Constrained)</option>
                <option value="unbound" ${currentMode === 'unbound' ? 'selected' : ''}>Unbound (Experimental - Can Break Saves)</option>
            </select>
        `;
        const modeSelect = modeDiv.querySelector('#void-mode');
        const bridge = window.VoidBridge || VoidBridge;
        modeSelect.onchange = () => {
            bridge.config.mode = modeSelect.value;
            bridge.saveConfig();
        };
        configSection.appendChild(modeDiv);
        
        // Provider selector
        const providerDiv = document.createElement('div');
        providerDiv.style.marginBottom = '10px';
        const currentProvider = VoidBridge.config.provider || 'anthropic';
        providerDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">LLM Provider:</label>
            <select id="void-provider" style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace;">
                <option value="anthropic" ${currentProvider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI (GPT)</option>
                <option value="gemini" ${currentProvider === 'gemini' ? 'selected' : ''}>Google (Gemini)</option>
            </select>
        `;
        const providerSelect = providerDiv.querySelector('#void-provider');
        
        // Model selector (updates based on provider)
        const modelDiv = document.createElement('div');
        modelDiv.style.marginBottom = '10px';
        const currentModel = VoidBridge.config.model || 'claude-sonnet-4-20250514';
        
        const getModelsForProvider = (provider) => {
            switch(provider) {
                case 'anthropic':
                    return [
                        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
                        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
                        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
                    ];
                case 'openai':
                    return [
                        { value: 'gpt-4o', label: 'GPT-4o' },
                        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                        { value: 'gpt-4', label: 'GPT-4' },
                        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                    ];
                case 'gemini':
                    return [
                        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
                        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
                        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
                    ];
                default:
                    return [];
            }
        };
        
        const updateModelSelector = (provider) => {
            const models = getModelsForProvider(provider);
            const modelSelect = modelDiv.querySelector('#void-model');
            const customInput = modelDiv.querySelector('#void-model-custom');
            
            // Remove custom input if it exists
            if (customInput) {
                customInput.parentElement.remove();
            }
            
            // Update model options
            modelSelect.innerHTML = '';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.label;
                if (VoidBridge.config.model === model.value) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });
            
            // Add custom option
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = 'Custom (enter below)';
            const isCustom = !models.some(m => m.value === VoidBridge.config.model);
            if (isCustom) {
                customOption.selected = true;
                // Show custom input
                const customDiv = document.createElement('div');
                customDiv.style.marginTop = '5px';
                customDiv.innerHTML = `
                    <input type="text" id="void-model-custom" placeholder="Enter model name" 
                           value="${VoidBridge.config.model || ''}" 
                           style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:11px;">
                `;
                modelDiv.appendChild(customDiv);
                const input = customDiv.querySelector('#void-model-custom');
                input.onchange = () => {
                    VoidBridge.config.model = input.value;
                    VoidBridge.saveConfig();
                };
            }
            modelSelect.appendChild(customOption);
        };
        
        modelDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">Model:</label>
            <select id="void-model" style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace;">
            </select>
        `;
        
        // Initialize model selector
        updateModelSelector(currentProvider);
        
        // Handle provider change
        providerSelect.onchange = () => {
            VoidBridge.config.provider = providerSelect.value;
            // Set default model for provider if current model doesn't match
            const models = getModelsForProvider(providerSelect.value);
            if (!models.some(m => m.value === VoidBridge.config.model)) {
                VoidBridge.config.model = models[0].value;
            }
            VoidBridge.saveConfig();
            updateModelSelector(providerSelect.value);
        };
        
        // Handle model change
        const modelSelect = modelDiv.querySelector('#void-model');
        modelSelect.onchange = () => {
            if (modelSelect.value === 'custom') {
                // Show custom input
                const customInput = modelDiv.querySelector('#void-model-custom');
                if (!customInput) {
                    const customDiv = document.createElement('div');
                    customDiv.style.marginTop = '5px';
                    customDiv.innerHTML = `
                        <input type="text" id="void-model-custom" placeholder="Enter model name" 
                               value="${VoidBridge.config.model || ''}" 
                               style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:11px;">
                    `;
                    modelDiv.appendChild(customDiv);
                    const input = customDiv.querySelector('#void-model-custom');
                    input.onchange = () => {
                        VoidBridge.config.model = input.value;
                        VoidBridge.saveConfig();
                    };
                }
            } else {
                // Remove custom input if it exists
                const customInput = modelDiv.querySelector('#void-model-custom');
                if (customInput) {
                    customInput.parentElement.remove();
                }
                VoidBridge.config.model = modelSelect.value;
                VoidBridge.saveConfig();
            }
        };
        
        configSection.appendChild(providerDiv);
        configSection.appendChild(modelDiv);
        
        // API Endpoint
        const endpointDiv = document.createElement('div');
        endpointDiv.style.marginBottom = '10px';
        const currentEndpoint = VoidBridge.config.endpoint || '';
        endpointDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">API Endpoint:</label>
            <input type="text" id="void-endpoint" placeholder="https://your-proxy/v1/void" 
                   value="${currentEndpoint}" 
                   style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:11px;">
        `;
        const endpointInput = endpointDiv.querySelector('#void-endpoint');
        endpointInput.onchange = () => {
            VoidBridge.config.endpoint = endpointInput.value;
            VoidBridge.saveConfig();
        };
        configSection.appendChild(endpointDiv);
        
        // API Key
        const keyDiv = document.createElement('div');
        keyDiv.style.marginBottom = '10px';
        const currentApiKey = VoidBridge.config.apiKey || '';
        keyDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">API Key (stored locally):</label>
            <input type="password" id="void-apikey" placeholder="sk-..." 
                   value="${currentApiKey}" 
                   style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:11px;">
        `;
        const keyInput = keyDiv.querySelector('#void-apikey');
        keyInput.onchange = () => {
            VoidBridge.config.apiKey = keyInput.value;
            VoidBridge.saveConfig();
        };
        configSection.appendChild(keyDiv);
        
        // Max Tokens
        const tokensDiv = document.createElement('div');
        tokensDiv.style.marginBottom = '10px';
        const currentMaxTokens = VoidBridge.config.maxTokens || 8192;
        tokensDiv.innerHTML = `
            <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">Max Tokens (response length):</label>
            <input type="number" id="void-maxtokens" placeholder="8192" 
                   value="${currentMaxTokens}" 
                   min="512" max="32768" step="512"
                   style="width:100%; padding:5px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:11px;">
        `;
        const tokensInput = tokensDiv.querySelector('#void-maxtokens');
        tokensInput.onchange = () => {
            const value = parseInt(tokensInput.value, 10);
            if (!isNaN(value) && value >= 512 && value <= 32768) {
                VoidBridge.config.maxTokens = value;
                VoidBridge.saveConfig();
            } else {
                tokensInput.value = currentMaxTokens;
            }
        };
        configSection.appendChild(tokensDiv);
        
        // Reset Memory button
        const resetDiv = document.createElement('div');
        resetDiv.style.marginTop = '10px';
        resetDiv.style.paddingTop = '10px';
        resetDiv.style.borderTop = '1px solid #334455';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'dialogue-btn';
        resetBtn.style.width = '100%';
        resetBtn.style.background = '#442222';
        resetBtn.style.borderColor = '#884444';
        resetBtn.textContent = 'Reset Void Memory';
        resetBtn.onclick = () => {
            if (confirm('This will clear all conversation history and reset The Void\'s memory. The Void will forget everything. Continue?')) {
                VoidMemoryStore.reset();
                
                // Reload the Void dialogue to show cleared state
                this.updateVoid(npc, npcDef);
            }
        };
        resetDiv.appendChild(resetBtn);
        configSection.appendChild(resetDiv);
        
        this.optionsEl.appendChild(configSection);
        
        // Conversation history
        const chatSection = document.createElement('div');
        chatSection.className = 'pedalboard-section';
        chatSection.style.maxHeight = '300px';
        chatSection.style.overflowY = 'auto';
        chatSection.innerHTML = `<div class="section-title">Conversation</div>`;
        
        const chatLog = document.createElement('div');
        chatLog.id = 'void-chat-log';
        chatLog.style.minHeight = '150px';
        chatLog.style.maxHeight = '250px';
        chatLog.style.overflowY = 'auto';
        chatLog.style.padding = '10px';
        chatLog.style.background = 'rgba(0,0,0,0.3)';
        chatLog.style.border = '1px solid #334455';
        chatLog.style.borderRadius = '4px';
        chatLog.style.fontSize = '12px';
        chatLog.style.color = '#aaa';
        chatLog.style.lineHeight = '1.5';
        
        // Restore conversation history or show greeting
        if (voidMemory.conversationHistory && voidMemory.conversationHistory.length > 0) {
            // Restore saved conversation
            voidMemory.conversationHistory.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.style.marginBottom = '10px';
                if (msg.role === 'player') {
                    msgDiv.style.color = '#88ccff';
                    msgDiv.innerHTML = `<strong>You:</strong> ${msg.content}`;
                } else {
                    msgDiv.style.color = '#aa88ff';
                    msgDiv.style.whiteSpace = 'pre-wrap';
                    msgDiv.innerHTML = `<strong>The Void:</strong> ${msg.content}`;
                }
                chatLog.appendChild(msgDiv);
            });
            chatLog.scrollTop = chatLog.scrollHeight;
        } else if (voidMemory.conversationCount === 0) {
            // First contact - show greeting
            const greetingMsg = `<div style="color:#aa88ff; margin-bottom:10px;"><strong>The Void:</strong> ${npcDef.greeting}</div>`;
            chatLog.innerHTML = greetingMsg;
            // Save greeting to history
            VoidMemoryStore.addMessage('void', npcDef.greeting);
        }
        
        chatSection.appendChild(chatLog);
        this.optionsEl.appendChild(chatSection);
        
        // Input section
        const inputSection = document.createElement('div');
        inputSection.className = 'pedalboard-section';
        inputSection.style.borderTop = 'none';
        inputSection.style.paddingTop = '0';
        
        const inputDiv = document.createElement('div');
        inputDiv.style.marginBottom = '10px';
        inputDiv.innerHTML = `
            <textarea id="void-input" placeholder="Speak to The Void..." 
                      style="width:100%; min-height:60px; padding:8px; background:#223344; border:1px solid #557799; color:#fff; font-family:'Courier New', monospace; font-size:12px; resize:vertical;"></textarea>
        `;
        const inputField = inputDiv.querySelector('#void-input');
        inputSection.appendChild(inputDiv);
        
        // Action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ability-select';
        actionsDiv.style.marginTop = '10px';
        
        const sendBtn = document.createElement('button');
        sendBtn.className = 'ability-btn';
        sendBtn.textContent = 'Ask The Void';
        sendBtn.style.flex = '1';
        
        // Rate limit status display
        const rateLimitStatus = document.createElement('div');
        rateLimitStatus.id = 'void-rate-limit-status';
        rateLimitStatus.style.display = 'none';
        rateLimitStatus.style.color = '#ffaa66';
        rateLimitStatus.style.fontSize = '12px';
        rateLimitStatus.style.marginTop = '5px';
        rateLimitStatus.style.textAlign = 'center';
        rateLimitStatus.style.fontStyle = 'italic';
        
        // Update rate limit UI
        const updateRateLimitUI = () => {
            if (VoidBridge.isRateLimited()) {
                const remaining = VoidBridge.getRateLimitRemaining();
                rateLimitStatus.textContent = `Rate limited. Please wait ${remaining} seconds...`;
                rateLimitStatus.style.display = 'block';
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.5';
                sendBtn.style.cursor = 'not-allowed';
            } else {
                rateLimitStatus.style.display = 'none';
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
                sendBtn.style.cursor = 'pointer';
            }
        };
        
        // Check rate limit on load and update periodically
        updateRateLimitUI();
        const rateLimitCheckInterval = setInterval(updateRateLimitUI, 1000);
        
        // Clean up interval when dialogue closes
        const originalClose = this.close.bind(this);
        this.close = () => {
            clearInterval(rateLimitCheckInterval);
            originalClose();
        };
        
        // Store reference to chat log and input for async updates
        // Helper function to show/hide thinking indicator
        const showThinking = () => {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.id = 'void-thinking';
            thinkingDiv.style.color = '#aa88ff';
            thinkingDiv.style.marginBottom = '10px';
            thinkingDiv.style.fontStyle = 'italic';
            thinkingDiv.style.opacity = '0.7';
            thinkingDiv.innerHTML = '<strong>The Void:</strong> <span class="thinking-dots">...</span>';
            chatLog.appendChild(thinkingDiv);
            chatLog.scrollTop = chatLog.scrollHeight;
            
            // Animate dots
            const dots = thinkingDiv.querySelector('.thinking-dots');
            let dotCount = 0;
            const dotInterval = setInterval(() => {
                dotCount = (dotCount + 1) % 4;
                dots.textContent = '.'.repeat(dotCount);
            }, 500);
            
            return () => {
                clearInterval(dotInterval);
                if (thinkingDiv.parentNode) {
                    thinkingDiv.parentNode.removeChild(thinkingDiv);
                }
            };
        };
        
        // Helper function to handle code execution with chained retries
        // maxErrorRetries: limit for error retries (to prevent infinite error loops)
        // maxProbeChain: limit for successful probe chains (much higher, allows exploration)
        const handleCodeExecution = async (code, retryCount = 0, errorRetryCount = 0, maxErrorRetries = 3, maxProbeChain = 50) => {
            // Check probe chain limit (for successful executions)
            if (retryCount >= maxProbeChain) {
                const maxChainMsg = document.createElement('div');
                maxChainMsg.style.color = '#ffaa66';
                maxChainMsg.style.marginBottom = '10px';
                maxChainMsg.style.fontStyle = 'italic';
                maxChainMsg.textContent = `[Probe chain limit reached (${maxProbeChain}). The Void's exploration is complete.]`;
                chatLog.appendChild(maxChainMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                return;
            }
            
            // Show code in chat (only on first execution)
            if (retryCount === 0) {
                const codeMsg = document.createElement('div');
                codeMsg.style.marginBottom = '10px';
                codeMsg.innerHTML = `
                    <div style="color:#ffaa88; margin-bottom:5px;"><strong>Code to execute${retryCount > 0 ? ` (retry ${retryCount})` : ''}:</strong></div>
                    <pre style="background:#112233; padding:8px; border:1px solid #334455; border-radius:4px; overflow-x:auto; font-size:10px; color:#88ff88;">${code}</pre>
                `;
                chatLog.appendChild(codeMsg);
            } else {
                const retryCodeMsg = document.createElement('div');
                retryCodeMsg.style.marginBottom = '10px';
                retryCodeMsg.innerHTML = `
                    <div style="color:#ffaa88; margin-bottom:5px;"><strong>Retry code (attempt ${retryCount + 1}):</strong></div>
                    <pre style="background:#112233; padding:8px; border:1px solid #334455; border-radius:4px; overflow-x:auto; font-size:10px; color:#88ff88;">${code}</pre>
                `;
                chatLog.appendChild(retryCodeMsg);
            }
            
            // Execute code
            const execResult = VoidSystem.executeCode(code);
            
            // Show console logs if any
            if (execResult.logs && execResult.logs.length > 0) {
                const logsDiv = document.createElement('div');
                logsDiv.style.marginBottom = '10px';
                logsDiv.style.padding = '8px';
                logsDiv.style.background = '#112233';
                logsDiv.style.border = '1px solid #334455';
                logsDiv.style.borderRadius = '4px';
                logsDiv.style.fontSize = '10px';
                logsDiv.style.fontFamily = 'monospace';
                
                const logsTitle = document.createElement('div');
                logsTitle.style.color = '#88aaff';
                logsTitle.style.marginBottom = '5px';
                logsTitle.textContent = retryCount === 0 ? 'Console output:' : `Retry ${retryCount} console output:`;
                logsDiv.appendChild(logsTitle);
                
                execResult.logs.forEach(log => {
                    const logLine = document.createElement('div');
                    logLine.style.color = log.type === 'error' ? '#ff6666' : 
                                         log.type === 'warn' ? '#ffaa66' : '#88ff88';
                    logLine.style.marginBottom = '2px';
                    logLine.textContent = `[${log.type}] ${log.args.join(' ')}`;
                    logsDiv.appendChild(logLine);
                });
                
                chatLog.appendChild(logsDiv);
                chatLog.scrollTop = chatLog.scrollHeight;
            }
            
            // Show execution result
            const execMsg = document.createElement('div');
            execMsg.style.marginBottom = '10px';
            execMsg.style.fontStyle = 'italic';
            if (execResult.ok) {
                execMsg.style.color = '#88ff88';
                execMsg.textContent = retryCount === 0 ? '[Code executed]' : `[Retry ${retryCount} code executed]`;
            } else {
                execMsg.style.color = '#ff6666';
                execMsg.textContent = retryCount === 0 ? `[Code error] ${execResult.error}` : `[Retry ${retryCount} code error] ${execResult.error}`;
            }
            chatLog.appendChild(execMsg);
            chatLog.scrollTop = chatLog.scrollHeight;
            
            // Always send feedback back to Void to allow chaining (whether success or error)
            // This allows the Void to probe, see results, and send more code
            const hideThinking = showThinking();
            
            // Track error retries separately from successful probe chains
            const newErrorRetryCount = !execResult.ok ? errorRetryCount + 1 : 0;
            
            // Check error retry limit (only for consecutive errors)
            if (!execResult.ok && newErrorRetryCount >= maxErrorRetries) {
                hideThinking();
                const maxErrorMsg = document.createElement('div');
                maxErrorMsg.style.color = '#ff6666';
                maxErrorMsg.style.marginBottom = '10px';
                maxErrorMsg.style.fontStyle = 'italic';
                maxErrorMsg.textContent = `[Max error retries reached (${maxErrorRetries}). The Void cannot fix this code.]`;
                chatLog.appendChild(maxErrorMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                return;
            }
            
            const feedbackPayload = {
                gameState: VoidBridge.buildGameState(this.game),
                voidMemory: VoidMemoryStore.load(),
                mode: VoidBridge.config.mode,
                playerMessage: !execResult.ok
                    ? `The previous code you returned threw an error (error retry ${newErrorRetryCount}/${maxErrorRetries}). Please fix it and return a new JSON object.`
                    : `The previous code executed successfully (probe ${retryCount + 1}). Here are the console logs. You may send more code to continue probing or exploring, or omit the "code" field to end the chain.`,
                lastError: execResult.error || null,
                lastCode: code,
                lastLogs: execResult.logs || null
            };
            
            const feedbackResponse = await VoidBridge.sendRequest(feedbackPayload);
            hideThinking();
            
            // Check for parse errors in feedback response
            if (feedbackResponse && feedbackResponse._parseError) {
                // Send parse error back to Void for correction (same as initial requests)
                const parseErrorMsg = document.createElement('div');
                parseErrorMsg.style.color = '#ff6666';
                parseErrorMsg.style.marginBottom = '10px';
                parseErrorMsg.style.fontStyle = 'italic';
                parseErrorMsg.textContent = `[JSON Parse Error in feedback] ${feedbackResponse._parseErrorMessage}`;
                chatLog.appendChild(parseErrorMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                
                // Send correction request back to Void
                const hideThinking2 = showThinking();
                const parseErrorPayload = {
                    gameState: VoidBridge.buildGameState(this.game),
                    voidMemory: VoidMemoryStore.load(),
                    mode: VoidBridge.config.mode,
                    playerMessage: `Your previous response was not valid JSON. The parser error was: "${feedbackResponse._parseErrorMessage}". ${feedbackResponse._rawContentLength ? `Response length: ${feedbackResponse._rawContentLength} chars. ` : ''}Please return ONLY a valid JSON object with no extra text, markdown, or prose. If your response is being truncated, make it shorter.`,
                    lastError: `JSON Parse Error: ${feedbackResponse._parseErrorMessage}`,
                    lastCode: code,
                    lastLogs: execResult.logs || null,
                    lastRawContent: feedbackResponse._rawContent
                };
                
                const parseErrorResponse = await VoidBridge.sendRequest(parseErrorPayload);
                hideThinking2();
                
                if (parseErrorResponse && !parseErrorResponse._parseError && parseErrorResponse.response) {
                    const retryMsg = document.createElement('div');
                    retryMsg.style.color = '#aa88ff';
                    retryMsg.style.marginBottom = '10px';
                    retryMsg.style.whiteSpace = 'pre-wrap';
                    retryMsg.innerHTML = `<strong>The Void (corrected):</strong> ${parseErrorResponse.response}`;
                    chatLog.appendChild(retryMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    VoidMemoryStore.addMessage('void', parseErrorResponse.response);
                    
                    // Use corrected response and continue
                    const correctedResponse = parseErrorResponse;
                    // Extract JSON if needed and continue with chain
                    if (correctedResponse.code) {
                        await handleCodeExecution(
                            correctedResponse.code,
                            retryCount + 1,
                            newErrorRetryCount,
                            maxErrorRetries,
                            maxProbeChain
                        );
                    }
                } else {
                    // Even the retry failed
                    const failMsg = document.createElement('div');
                    failMsg.style.color = '#ff6666';
                    failMsg.style.marginBottom = '10px';
                    failMsg.style.fontStyle = 'italic';
                    failMsg.textContent = '[Failed to correct JSON parse error. Chain ended.]';
                    chatLog.appendChild(failMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                }
                return;
            }
            
            // Extract JSON from response field if needed (do this BEFORE checking for code)
            if (feedbackResponse && feedbackResponse.response && typeof feedbackResponse.response === 'string') {
                let trimmed = feedbackResponse.response.trim();
                
                // Strip markdown code blocks if present
                if (trimmed.startsWith('```')) {
                    trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, '');
                    trimmed = trimmed.replace(/\n?```\s*$/, '');
                    trimmed = trimmed.trim();
                }
                
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        const parsedResponse = JSON.parse(trimmed);
                        if (parsedResponse.response || parsedResponse.code || parsedResponse.action) {
                            if (parsedResponse.response && typeof parsedResponse.response === 'string') {
                                feedbackResponse.response = parsedResponse.response;
                            }
                            if (parsedResponse.code && !feedbackResponse.code) feedbackResponse.code = parsedResponse.code;
                            if (parsedResponse.action && !feedbackResponse.action) feedbackResponse.action = parsedResponse.action;
                            if (parsedResponse.narration && !feedbackResponse.narration) feedbackResponse.narration = parsedResponse.narration;
                            if (parsedResponse.memoryUpdates && !feedbackResponse.memoryUpdates) feedbackResponse.memoryUpdates = parsedResponse.memoryUpdates;
                        }
                    } catch (e) {
                        try {
                            const unescaped = trimmed.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '\t');
                            const parsedResponse = JSON.parse(unescaped);
                            if (parsedResponse.response || parsedResponse.code || parsedResponse.action) {
                                if (parsedResponse.response && typeof parsedResponse.response === 'string') {
                                    feedbackResponse.response = parsedResponse.response;
                                }
                                if (parsedResponse.code && !feedbackResponse.code) feedbackResponse.code = parsedResponse.code;
                                if (parsedResponse.action && !feedbackResponse.action) feedbackResponse.action = parsedResponse.action;
                                if (parsedResponse.narration && !feedbackResponse.narration) feedbackResponse.narration = parsedResponse.narration;
                                if (parsedResponse.memoryUpdates && !feedbackResponse.memoryUpdates) feedbackResponse.memoryUpdates = parsedResponse.memoryUpdates;
                            }
                        } catch (e2) {
                            // Not JSON, use as-is
                        }
                    }
                }
            }
            
            if (feedbackResponse && feedbackResponse.response) {
                const feedbackMsg = document.createElement('div');
                feedbackMsg.style.color = '#aa88ff';
                feedbackMsg.style.marginBottom = '10px';
                feedbackMsg.style.whiteSpace = 'pre-wrap';
                const attemptLabel = retryCount === 0 ? '' : ` (probe ${retryCount + 1})`;
                feedbackMsg.innerHTML = `<strong>The Void${attemptLabel}:</strong> ${feedbackResponse.response}`;
                chatLog.appendChild(feedbackMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                
                // Save to conversation history
                VoidMemoryStore.addMessage('void', feedbackResponse.response);
            }
            
            // If Void provides more code, continue the chain
            if (feedbackResponse && feedbackResponse.code) {
                // Recursively continue with new code
                // Reset error retry count on success, increment on error
                await handleCodeExecution(
                    feedbackResponse.code, 
                    retryCount + 1, 
                    newErrorRetryCount,
                    maxErrorRetries,
                    maxProbeChain
                );
            } else {
                // Void didn't provide code - chain ends (either success or Void decided to stop)
                if (execResult.ok) {
                    const chainEndMsg = document.createElement('div');
                    chainEndMsg.style.color = '#88ff88';
                    chainEndMsg.style.marginBottom = '10px';
                    chainEndMsg.style.fontStyle = 'italic';
                    chainEndMsg.textContent = '[Code execution chain completed. The Void has finished its exploration.]';
                    chatLog.appendChild(chainEndMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                } else {
                    const chainEndMsg = document.createElement('div');
                    chainEndMsg.style.color = '#ffaa66';
                    chainEndMsg.style.marginBottom = '10px';
                    chainEndMsg.style.fontStyle = 'italic';
                    chainEndMsg.textContent = '[The Void did not provide a code fix. Chain ended.]';
                    chatLog.appendChild(chainEndMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                }
            }
        };
        
        const self = this;
        sendBtn.onclick = async () => {
            // Check rate limit before sending
            if (VoidBridge.isRateLimited()) {
                const remaining = VoidBridge.getRateLimitRemaining();
                const rateLimitMsg = document.createElement('div');
                rateLimitMsg.style.color = '#ffaa66';
                rateLimitMsg.style.marginBottom = '10px';
                rateLimitMsg.style.fontStyle = 'italic';
                rateLimitMsg.textContent = `Rate limited. Please wait ${remaining} seconds before trying again.`;
                chatLog.appendChild(rateLimitMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                return;
            }
            
            const message = inputField.value.trim();
            if (!message) return;
            
            // Add player message to chat
            const playerMsg = document.createElement('div');
            playerMsg.style.color = '#88ccff';
            playerMsg.style.marginBottom = '10px';
            playerMsg.innerHTML = `<strong>You:</strong> ${message}`;
            chatLog.appendChild(playerMsg);
            chatLog.scrollTop = chatLog.scrollHeight;
            
            // Save to conversation history
            VoidMemoryStore.addMessage('player', message);
            
            // Clear input
            inputField.value = '';
            sendBtn.disabled = true;
            sendBtn.textContent = 'Asking...';
            
            // Show thinking indicator
            const hideThinking = showThinking();
            
            // Build payload
            const gameState = VoidBridge.buildGameState(this.game);
            const payload = {
                gameState,
                voidMemory,
                mode: VoidBridge.config.mode,
                playerMessage: message
            };
            
            // Send request
            let response = await VoidBridge.sendRequest(payload);
            
            // Hide thinking indicator
            hideThinking();
            
            // Update rate limit UI after response
            updateRateLimitUI();
            
            sendBtn.disabled = false;
            sendBtn.textContent = 'Ask The Void';
            
            // Check for rate limit in response
            if (response && response._rateLimit) {
                const rateLimitMsg = document.createElement('div');
                rateLimitMsg.style.color = '#ffaa66';
                rateLimitMsg.style.marginBottom = '10px';
                rateLimitMsg.style.fontStyle = 'italic';
                rateLimitMsg.textContent = response.response || `Rate limited. Please wait ${response._retryAfter || 60} seconds.`;
                chatLog.appendChild(rateLimitMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                VoidMemoryStore.addMessage('void', response.response || 'Rate limited.');
                return;
            }
            
            if (!response) {
                const errorMsg = document.createElement('div');
                errorMsg.style.color = '#ff6666';
                errorMsg.style.marginBottom = '10px';
                errorMsg.innerHTML = `<strong>The Void:</strong> The connection falters. Configure your API endpoint and key.`;
                chatLog.appendChild(errorMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                return;
            }
            
            // Check for JSON parse errors and send feedback to Void
            if (response._parseError) {
                const parseErrorMsg = document.createElement('div');
                parseErrorMsg.style.color = '#ff6666';
                parseErrorMsg.style.marginBottom = '10px';
                parseErrorMsg.style.fontStyle = 'italic';
                parseErrorMsg.textContent = `[JSON Parse Error] ${response._parseErrorMessage}`;
                chatLog.appendChild(parseErrorMsg);
                
                // Show raw content that failed to parse
                if (response._rawContent) {
                    const rawContentDiv = document.createElement('div');
                    rawContentDiv.style.marginBottom = '10px';
                    rawContentDiv.style.padding = '8px';
                    rawContentDiv.style.background = '#112233';
                    rawContentDiv.style.border = '1px solid #ff6666';
                    rawContentDiv.style.borderRadius = '4px';
                    rawContentDiv.style.fontSize = '10px';
                    rawContentDiv.style.fontFamily = 'monospace';
                    rawContentDiv.style.color = '#ffaaaa';
                    rawContentDiv.style.maxHeight = '200px';
                    rawContentDiv.style.overflow = 'auto';
                    rawContentDiv.textContent = response._rawContent.substring(0, 1000);
                    chatLog.appendChild(rawContentDiv);
                }
                
                chatLog.scrollTop = chatLog.scrollHeight;
                
                // Send parse error back to Void for correction
                const hideThinking2 = showThinking();
                
                const parseErrorPayload = {
                    gameState: VoidBridge.buildGameState(this.game),
                    voidMemory: VoidMemoryStore.load(),
                    mode: VoidBridge.config.mode,
                    playerMessage: `Your previous response was not valid JSON. The parser error was: "${response._parseErrorMessage}". ${response._rawContentLength ? `Response length: ${response._rawContentLength} chars. ` : ''}Please return ONLY a valid JSON object with no extra text, markdown, or prose. If your response is being truncated, make it shorter.`,
                    lastError: `JSON Parse Error: ${response._parseErrorMessage}`,
                    lastCode: null,
                    lastRawContent: response._rawContent
                };
                
                const parseErrorResponse = await VoidBridge.sendRequest(parseErrorPayload);
                hideThinking2();
                
                if (parseErrorResponse && !parseErrorResponse._parseError && parseErrorResponse.response) {
                    const retryMsg = document.createElement('div');
                    retryMsg.style.color = '#aa88ff';
                    retryMsg.style.marginBottom = '10px';
                    retryMsg.style.whiteSpace = 'pre-wrap';
                    retryMsg.innerHTML = `<strong>The Void (corrected):</strong> ${parseErrorResponse.response}`;
                    chatLog.appendChild(retryMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    
                    // Save to conversation history
                    VoidMemoryStore.addMessage('void', parseErrorResponse.response);
                    
                    // Process the corrected response normally
                    response = parseErrorResponse;
                } else {
                    // Even the retry failed, just show error and stop
                    return;
                }
            }
            
            // Extract JSON from response field if needed (do this BEFORE checking for code/action)
            if (response.response && typeof response.response === 'string') {
                let trimmed = response.response.trim();
                
                // Strip markdown code blocks if present
                if (trimmed.startsWith('```')) {
                    trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, '');
                    trimmed = trimmed.replace(/\n?```\s*$/, '');
                    trimmed = trimmed.trim();
                }
                
                // Check if it looks like JSON (starts with { or [)
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        const parsedResponse = JSON.parse(trimmed);
                        // If it parses to an object with response/code/action fields, extract them
                        if (parsedResponse.response || parsedResponse.code || parsedResponse.action) {
                            // Merge parsed fields into response object
                            if (parsedResponse.response && typeof parsedResponse.response === 'string') {
                                response.response = parsedResponse.response;
                            }
                            if (parsedResponse.code && !response.code) {
                                response.code = parsedResponse.code;
                            }
                            if (parsedResponse.action && !response.action) {
                                response.action = parsedResponse.action;
                            }
                            if (parsedResponse.narration && !response.narration) {
                                response.narration = parsedResponse.narration;
                            }
                            if (parsedResponse.memoryUpdates && !response.memoryUpdates) {
                                response.memoryUpdates = parsedResponse.memoryUpdates;
                            }
                        }
                    } catch (e) {
                        // Not valid JSON, might be escaped - try unescaping common patterns
                        try {
                            const unescaped = trimmed
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\')
                                .replace(/\\t/g, '\t');
                            const parsedResponse = JSON.parse(unescaped);
                            if (parsedResponse.response || parsedResponse.code || parsedResponse.action) {
                                if (parsedResponse.response && typeof parsedResponse.response === 'string') {
                                    response.response = parsedResponse.response;
                                }
                                if (parsedResponse.code && !response.code) response.code = parsedResponse.code;
                                if (parsedResponse.action && !response.action) response.action = parsedResponse.action;
                                if (parsedResponse.narration && !response.narration) response.narration = parsedResponse.narration;
                                if (parsedResponse.memoryUpdates && !response.memoryUpdates) response.memoryUpdates = parsedResponse.memoryUpdates;
                            }
                        } catch (e2) {
                            // Still not JSON, use as-is
                        }
                    }
                }
            }
            
            // Add Void response to chat
            if (response.response) {
                const voidMsg = document.createElement('div');
                voidMsg.style.color = '#aa88ff';
                voidMsg.style.marginBottom = '10px';
                voidMsg.style.whiteSpace = 'pre-wrap';
                voidMsg.innerHTML = `<strong>The Void:</strong> ${response.response}`;
                chatLog.appendChild(voidMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
                
                // Save to conversation history
                VoidMemoryStore.addMessage('void', response.response);
            }
            
            // Apply action (Oracle mode)
            if (response.action && VoidBridge.config.mode === 'oracle') {
                VoidSystem.applyAction(this.game, response.action);
                
                // Show narration if present
                if (response.action.narration) {
                    const narrMsg = document.createElement('div');
                    narrMsg.style.color = '#ffaa88';
                    narrMsg.style.fontStyle = 'italic';
                    narrMsg.style.marginBottom = '10px';
                    narrMsg.textContent = response.action.narration;
                    chatLog.appendChild(narrMsg);
                    chatLog.scrollTop = chatLog.scrollHeight;
                }
            }
            
            // Handle code execution (Unbound mode) - NO CONFIRMATION
            if (response.code && VoidBridge.config.mode === 'unbound') {
                // Use the helper function for chained retries
                // maxErrorRetries: 3 (prevent infinite error loops)
                // maxProbeChain: 50 (allow extensive exploration)
                await handleCodeExecution(response.code, 0, 0, 3, 50);
            }
            
            // Show narration if present (separate from action narration)
            if (response.narration) {
                const narrMsg = document.createElement('div');
                narrMsg.style.color = '#ffaa88';
                narrMsg.style.fontStyle = 'italic';
                narrMsg.style.marginBottom = '10px';
                narrMsg.textContent = response.narration;
                chatLog.appendChild(narrMsg);
                chatLog.scrollTop = chatLog.scrollHeight;
            }
            
            // Update memory
            if (response.memoryUpdates) {
                VoidMemoryStore.applyPatch(response.memoryUpdates);
            }
            
            // Update conversation count
            voidMemory.conversationCount = (voidMemory.conversationCount || 0) + 1;
            VoidMemoryStore.save();
        };
        
        // Allow Enter to send (Shift+Enter for new line) and prevent game input from seeing keys
        inputField.onkeydown = (e) => {
            // Prevent global game Input from treating keys (like 'E') as interaction while typing
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        };
        
        actionsDiv.appendChild(sendBtn);
        actionsDiv.appendChild(rateLimitStatus);
        inputSection.appendChild(actionsDiv);
        this.optionsEl.appendChild(inputSection);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialogue-btn close-btn';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => this.close();
        this.optionsEl.appendChild(closeBtn);
    }
}