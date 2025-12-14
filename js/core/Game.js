
class Game {
    constructor() {
		this.modManager = new ModManager(this); // Init System
		this.setupDragAndDrop(); // 2. Setup Drag & Drop
		
		this.raidManager = new RaidManager(this);
		this.dialogueSystem = new DialogueSystem(this);
        this.entities = [];
		this.structures = [];
		this.floatingTexts = [];
		this.sound = new SoundSystem();
        // Preload music tracks
        this.sound.loadMusic('boss', 'sounds/tracks/00 - KERNEL PANIC AT THE GATES OF DAWN.mp3');
        this.clock = new THREE.Clock();
        this.debug = document.getElementById('debug');
        
        this.runTime = 0; this.kills = 0; this.isGameOver = false; this.inOutpost = true; this.runAffinity = null;
        this.currentBiome = 'rift_wastes';
        
        this.screenShakeTimer = 0; this.screenShakeIntensity = 0; this.particles = [];
        this.pendingBiome = null;
        
        // Compass State
        this.compassTargetIndex = 0;
        
        MetaProgression.load();
        
        if (window.WorldState) WorldState.generate();
        
        this.initUI();
        this.hud = new HUDSystem(this);
        this.initRenderer();
        this.initScene();
        this.initCamera();
        this.initLights();
        this.raycaster = new THREE.Raycaster();
        this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        if (typeof WorldManager === 'function') {
            this.world = new WorldManager(this);
        } else if (window.WorldManager) {
             this.world = new window.WorldManager(this);
        }
        
        this.input = new Input();
        
        this.loadHub();
        window.addEventListener('resize', () => this.onResize());
		
		this.modManager.trigger('gameStart', this); // Let mods know we are liv
		
        this.loop();
		
    }
    
    getMouseWorldPosition() {
        const mouse = new THREE.Vector2();
        mouse.x = (this.input.mouse.x / window.innerWidth) * 2 - 1;
        mouse.y = -(this.input.mouse.y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(mouse, this.camera);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.mousePlane, target);
        return target;
    }
    
    initUI() {
        // Menu screens (kept as HTML)
        this.gameOverEl = document.getElementById('game-over');
        this.finalTimeEl = document.getElementById('final-time');
        this.finalKillsEl = document.getElementById('final-kills');
        this.essenceEarnedEl = document.getElementById('essence-earned');
        this.outpostEl = document.getElementById('outpost');
        this.upgradesGridEl = document.getElementById('upgrades-grid');
        
        // Menu button handlers
        document.getElementById('outpost-btn').addEventListener('click', () => this.loadHub());
        document.getElementById('enter-rift-btn').addEventListener('click', () => this.enterRift());
        
        // Debug element removed - now in HUD
        this.debug = { textContent: '' }; // Stub for backwards compat
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
			antialias: false, // PSX didn't have AA
			powerPreference: "high-performance"
		});

		// PSX Resolution (roughly)
		// We render at 320x224, then CSS stretches it to 1080p/4K
		this.internalWidth = 800;
		this.internalHeight = 600;

		this.renderer.setSize(this.internalWidth, this.internalHeight, false); // false = don't resize canvas style
		this.renderer.setPixelRatio(1); // Force 1:1 pixel ratio
		this.renderer.setClearColor(0x1a1a2e);

		// Darken the page background to match
		document.body.appendChild(this.renderer.domElement);
    }
    
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a15);
        this.scene.fog = new THREE.FogExp2(0x0a0a15, 0.03);
    }
    
    initCamera() {
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 8); this.camera.lookAt(0, 0, 0);
    }
    
    initLights() {
        this.ambientLight = new THREE.AmbientLight(0x404060, 0.5); this.scene.add(this.ambientLight);
        const directional = new THREE.DirectionalLight(0xffffff, 1); directional.position.set(5, 10, 5); directional.castShadow = true; this.scene.add(directional);
        const accent = new THREE.PointLight(0x6644ff, 0.5, 20); accent.position.set(-5, 3, -5); this.scene.add(accent);
    }
    
    initPlayer() {
        this.player = new Player(this);
        this.entities.push(this.player);
        this.scene.add(this.player.mesh);
        this.enemies = []; this.projectiles = []; this.pickups = [];
        this.spawnTimer = 0; this.spawnInterval = 3000; this.maxEnemies = 10; this.runEssence = 0;
    }
    
    spawnEnemy(forceType = null) {
if (this.enemies.length >= this.maxEnemies) return;
        
        let x, z, attempts = 0;
        let valid = false;
        
        while (!valid && attempts < 50) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 8;
            x = this.player.mesh.position.x + Math.cos(angle) * dist;
            z = this.player.mesh.position.z + Math.sin(angle) * dist;
            
            if (this.world) {
                // Check if position is clear (0.4 radius for enemies)
                if (!this.world.checkCollision(x, z, 0.4)) {
                    valid = true;
                }
            } else {
                valid = true; 
            }
            attempts++;
        }
        
        if (!valid) {
            // DEBUG LOG: If this prints, the Grid is clogged.
            console.warn("Spawn failed: No valid space found after 50 attempts.");
            return; 
        }
        
        let type = forceType;
        if (!type) {
            const weights = BiomeRegistry.get(this.currentBiome).enemyWeights;
            const roll = Math.random(); let cumulative = 0;
            for (const [t, w] of Object.entries(weights)) {
                cumulative += w;
                if (roll < cumulative) { type = t; break; }
            }
        }
        const enemy = new Enemy(this, x, z, type || 'default');
        this.enemies.push(enemy); this.entities.push(enemy); this.scene.add(enemy.mesh);
    }
    
    spawnPickup(x, z, type, value) {
        const pickup = new Pickup(this, x, z, type, value);
        this.pickups.push(pickup); this.entities.push(pickup); this.scene.add(pickup.mesh);
    }
    
    addKill() {
        this.kills++; 
        this.hud.updateStats(this.formatTime(this.runTime), this.kills, this.runEssence);
    }
    
    transitionToBiome(biomeId) {
        this.pendingBiome = biomeId;
    }

    executeBiomeTransition(targetNodeId) {
		if (targetNodeId === 'NEW_RUN') {
            this.enterRift();
            return;
        }
		
        if (!window.WorldState) return;
        
        WorldState.currentNodeId = targetNodeId;
        const node = WorldState.getCurrentNode();
        
        console.log(`Transitioning to ${node.name} (${node.biomeId})`);
        
        this.currentBiome = node.biomeId;
        this.cleanupEntities(); // This pushes player to entities list
        
        const biome = BiomeRegistry.get(this.currentBiome);
        this.scene.fog.color.setHex(biome.fogColor); this.scene.fog.density = biome.fogDensity;
        this.ambientLight.color.setHex(biome.ambientColor);
        this.scene.background.setHex(biome.fogColor);
        
        if (this.world) this.world.clear();
        
        this.player.mesh.position.set(0, 0.5, 0);
        // FIX: Removed duplicate player push
        // this.entities.push(this.player); 
        
        if(this.player.dashTrail) this.scene.add(this.player.dashTrail);
        if(this.player.slamRing) this.scene.add(this.player.slamRing);
        
        this.enemies = []; this.projectiles = []; this.pickups = [];
        for (let i = 0; i < 3; i++) this.spawnEnemy();
    }
    
    safeRemove(entity, list) {
        if (!entity) return;
        if (entity.mesh) {
            this.scene.remove(entity.mesh);
            if (entity.dispose) entity.dispose();
        }
        if (list) {
            const idx = list.indexOf(entity);
            if (idx > -1) list.splice(idx, 1);
        }
        const entIdx = this.entities.indexOf(entity);
        if (entIdx > -1) this.entities.splice(entIdx, 1);
    }

	cleanupEntities(forceClearPlayer = false) {
		[...this.entities].forEach(e => {
			// FIX: If forceClearPlayer is true, delete EVERYONE.
			if (!forceClearPlayer && e === this.player) return;
			this.safeRemove(e, null);
		});

		this.enemies = [];
		this.projectiles = [];
		this.pickups = [];
		this.particles.forEach(p => { 
			this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); 
		});
		this.particles = [];

		this.entities = [];
		this.structures = [];
		// Only keep player in the list if we didn't force clear
		if (!forceClearPlayer && this.player) this.entities.push(this.player);
	}
    
    triggerGameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.finalTimeEl.textContent = this.formatTime(this.runTime);
        this.finalKillsEl.textContent = this.kills;
        const earned = MetaProgression.endRun(this.runTime, this.kills, this.runAffinity, this.runEssence);
        this.essenceEarnedEl.textContent = earned;
        this.gameOverEl.classList.add('visible');
    }
    
	loadHub() {
		this.gameOverEl.classList.remove('visible');
		
        this.inOutpost = true; // Flag for logic checks
        this.currentBiome = 'sanctuary';
		
		if (window.WorldState) {
            WorldState.currentNodeId = 'outpost_0'; 
        }
		
		if (this.raidManager) this.raidManager.reset();
		this.hud.updateStats('--:--', '-', MetaProgression.data.essence);
        this.hud.setVisible(true); // Show banked essence
		
        this.cleanupEntities(true);
		
        
        // 1. Reset Environment
        const biome = BiomeRegistry.get('sanctuary');
        this.scene.fog.color.setHex(biome.fogColor); 
        this.scene.fog.density = biome.fogDensity;
        this.ambientLight.color.setHex(biome.ambientColor); 
        this.scene.background.setHex(biome.fogColor);
        
        if (this.world) this.world.clear();
		
		HubState.load(this);
        
        // 2. Spawn Player
        this.initPlayer();
        this.player.mesh.position.set(0, 0.5, 3.0);
        
		// 3. Spawn NPCs (CONDITIONALLY)
		const unlocked = MetaProgression.data.unlockedCharacters;

		// Blacksmith (Garrick) - Requires 'smith' unlock
		if (unlocked.includes('smith')) {
			const smith = new NPC(this, 5, 5, "Garrick", "smith", 0x884444);
			this.entities.push(smith); this.scene.add(smith.mesh);
		}
		
		// Scribe (Elara) - Requires 'scribe' unlock
		if (unlocked.includes('scribe')) {
			const scribe = new NPC(this, -5, 5, "Elara", "scribe", 0x444488);
			this.entities.push(scribe); this.scene.add(scribe.mesh);
		}
		
		// Architect (Kael) - Requires 'builder' unlock
        if (unlocked.includes('builder')) {
            // Position him opposite the Forgotten (0, 8)
            const builder = new NPC(this, 0, 8, "Kael", "builder", 0xffaa00);
            this.entities.push(builder); this.scene.add(builder.mesh);
        }
		
		// Pedalboard Customizer (Always available)
		const pedalboardNPC = new NPC(this, 8, 0, "The Tinkerer", "pedalboard", 0xaa88ff);
		this.entities.push(pedalboardNPC); this.scene.add(pedalboardNPC.mesh);
		
		// The Forgotten (Always there)
		const resetNPC = new NPC(this, 0, -8, "The Forgotten", "reset", 0x333333);
		this.entities.push(resetNPC); this.scene.add(resetNPC.mesh);
		
        // 4. Create a "Rift Gate" (Portal to start run)
        // Instead of a button, we now have a physical object to walk into
        /*const riftGate = new Portal(this, 0, 10, 'NEW_RUN', 'ENTER THE RIFT');
        this.entities.push(riftGate); this.scene.add(riftGate.mesh);*/
		this.riftGate = new RiftGate(this, 0, 0); // Center of hub
        this.entities.push(this.riftGate); 
        this.scene.add(this.riftGate.mesh);
    }
    
    enterRift() {
		// 1. SAVE THE HUB
        if (this.currentBiome === 'sanctuary') {
            HubState.save(this.entities);
        }
		
        this.inOutpost = false; this.outpostEl.classList.add('hidden');
        this.runAffinity = MetaProgression.data.runs % 2 === 0 ? 'magic' : 'tech';
        
		if (window.WorldState) {
            WorldState.generate(); 
            WorldState.currentNodeId = 'outpost_0';
            const node = WorldState.getCurrentNode();
            this.currentBiome = node.biomeId;
        } else {
            this.currentBiome = 'rift_wastes';
        }
        
        // FIX: Force nuke the old player and entities
        this.cleanupEntities(true);
        
        // FIX: Reset Game Over state explicitly
        this.isGameOver = false;
        
        // FIX: Hard reset the World Grid
        if (this.world) {
            this.world.clear();
            // Double-tap the grid just to be sure
            if (this.world.spatialGrid) this.world.spatialGrid.clear();
        }
        
        this.initPlayer(); // This resets maxEnemies to 10 and spawnTimer to 0
        this.runTime = 0; 
        this.kills = 0; 
        this.runEssence = 0;
        
        // Update HUD
        this.hud.updateStats('0:00', 0, 0);
        this.hud.setVisible(true);
        
        // Visuals
        const biome = BiomeRegistry.get(this.currentBiome);
        this.scene.fog.color.setHex(biome.fogColor); 
        this.scene.fog.density = biome.fogDensity;
        this.ambientLight.color.setHex(biome.ambientColor); 
        this.scene.background.setHex(biome.fogColor);
        
        this.clock.getDelta();
        
        console.log("--- RIFT ENTERED (Grid Cleared) ---");
    }
    
    screenShake(d, i) { this.screenShakeTimer = d; this.screenShakeIntensity = i; }
    
    spawnParticleBurst(x, z, color, count=8) {
        for(let i=0; i<count; i++) {
            const angle = Math.random()*6.28; const speed = 3+Math.random()*4;
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), new THREE.MeshBasicMaterial({color, transparent:true}));
            m.position.set(x, 0.5, z); this.scene.add(m);
            this.particles.push({mesh:m, x, y:0.5, z, vx:Math.cos(angle)*speed, vy:2+Math.random()*3, vz:Math.sin(angle)*speed, life:0.5, maxLife:0.5});
        }
    }
    
    updateParticles(dt) {
        for(let i=this.particles.length-1; i>=0; i--) {
            const p = this.particles[i]; p.vy -= 15*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
            p.mesh.position.set(p.x, Math.max(0.05, p.y), p.z);
            p.life -= dt; p.mesh.material.opacity = p.life/p.maxLife;
            if(p.life<=0) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); this.particles.splice(i,1); }
        }
    }
    
    updateCompass() {
        if (!this.player || !this.world || !window.WorldManager) return;
        
        let targets = [];

        // FIX: Context-sensitive targets
        if (this.currentBiome === 'sanctuary') {
            // Hub Targets
            targets = [{ x: 0, z: 0, name: "RIFT GATE" }];
            
            const unlocked = MetaProgression.data.unlockedCharacters;
            
            if (unlocked.includes('smith')) targets.push({ x: 5, z: 5, name: "Garrick (Smith)" });
            if (unlocked.includes('scribe')) targets.push({ x: -5, z: 5, name: "Elara (Scribe)" });
			if (unlocked.includes('builder')) targets.push({ x: 0, z: 8, name: "Kael (Architect)" });
			targets.push({ x: 8, z: 0, name: "The Tinkerer" }); // Always available
            
            // Optional: Point to reset NPC if you want
            // targets.push({ x: 0, z: -8, name: "The Forgotten" });
        } else {
            // 1. Realm Portals
            const portals = this.world.getRealmPortals();
            targets = [...portals];
            
            // 2. FIX: ADD CAGES (Rescue Signals)
            // Scan active entities for Cages. 
            // We use 'e.constructor.name' to be safe, or 'instanceof Cage' if global.
            const cages = this.entities.filter(e => e.constructor.name === 'Cage' && !e.dead);
            
            cages.forEach(c => {
                targets.push({
                    x: c.mesh.position.x,
                    z: c.mesh.position.z,
                    name: `SOS: ${c.def.name.toUpperCase()}` // e.g. "SOS: IRONCLAD"
                });
            });

            // 3. Return Point
            targets.push({ x: 0, z: 0, name: "Outpost (Return)" });
        }
        
        if (this.input.wasPressed('KeyC')) {
            this.compassTargetIndex = (this.compassTargetIndex + 1) % targets.length;
        }
        
        if (this.compassTargetIndex >= targets.length) this.compassTargetIndex = 0;
        
        const target = targets[this.compassTargetIndex];
        const px = this.player.mesh.position.x;
        const pz = this.player.mesh.position.z;
        
        const dx = target.x - px;
        const dz = target.z - pz;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const angle = Math.atan2(dz, dx) * (180 / Math.PI);
        
        const isReturn = target.name === "Outpost (Center)" || target.name === "Outpost (Return)";
        this.hud.updateCompass(angle, target.name, dist, isReturn);
    }
    
    formatTime(s) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
	onResize() { 
		// We don't change internal resolution on resize, only the aspect ratio
		this.camera.aspect = window.innerWidth / window.innerHeight; 
		this.camera.updateProjectionMatrix(); 
		// Renderer size stays constant 320x224
	}
	
	spawnFloatingText(x, z, text, color) {
		this.floatingTexts.push(new FloatingText(this, x, z, text, color));
	}
    
    loop() {
        requestAnimationFrame(() => this.loop());
		
        const dt = this.clock.getDelta(); const elapsed = this.clock.getElapsedTime();
		if (this.modManager) this.modManager.trigger('update', dt); // Allow mods to run logic every frame
		
		if (this.raidManager) this.raidManager.update(dt);
		
		if (this.currentBoss && !this.currentBoss.dead) {
            this.hud.updateBoss(true, this.currentBoss.def.name, this.currentBoss.health.active, this.currentBoss.health.maxActive);
        } else {
            this.hud.updateBoss(false);
            this.currentBoss = null;
        }
        
        if (window.ModelLoader) ModelLoader.update(dt);
        
        if (this.pendingBiome) {
            this.executeBiomeTransition(this.pendingBiome);
            this.pendingBiome = null;
            return;
        }
		
		if (this.world && this.player && !this.player.dead) {
			this.world.update(this.player.mesh.position.x, this.player.mesh.position.z);
			this.updateCompass();
			
			// NEW: Update Pathfinding every 200ms (5fps)
			// This keeps it cheap but responsive enough
			const now = Date.now();
			if (now - this.world.lastFlowUpdate > 200) {
				this.world.updateFlowField(this.player.mesh.position.x, this.player.mesh.position.z);
				this.world.lastFlowUpdate = now;
			}
		}
        
        [...this.entities].forEach(e => { if(e && e.update) e.update(dt, elapsed); });
        
        for(let i=this.enemies.length-1; i>=0; i--) if(this.enemies[i].shouldRemove) this.safeRemove(this.enemies[i], this.enemies);
        for(let i=this.projectiles.length-1; i>=0; i--) if(this.projectiles[i].shouldRemove) this.safeRemove(this.projectiles[i], this.projectiles);
        for(let i=this.pickups.length-1; i>=0; i--) if(this.pickups[i].shouldRemove) this.safeRemove(this.pickups[i], this.pickups);
        if(this.portal && this.portal.shouldRemove) { this.safeRemove(this.portal, null); this.portal = null; }
        
		if(!this.player.dead && !this.isGameOver) {
            this.runTime += dt; 
            
            // FIX: Context-sensitive HUD updates
            if (this.currentBiome === 'sanctuary') {
                // In Hub: Show "Banked" Essence
                this.hud.updateStats('--:--', '-', MetaProgression.data.essence);
            } else {
                // In Rift: Show "Run" Essence (Score)
                this.hud.updateStats(this.formatTime(this.runTime), this.kills, this.runEssence);
                
                // Spawn Logic (Only in Rift)
                const biome = BiomeRegistry.get(this.currentBiome);
                if (biome.spawnRateMultiplier > 0) {
                     this.spawnTimer += dt * 1000 * biome.spawnRateMultiplier;
                     if(this.spawnTimer >= this.spawnInterval) {
                         this.spawnTimer = 0; this.spawnEnemy();
						 this.spawnInterval = Math.max(800, this.spawnInterval - 30);
						 this.maxEnemies = Math.min(50, 10 + Math.floor(this.runTime / 30));
                     }
                }
            }
        }
        
        this.updateParticles(dt);
        this.camera.position.set(this.player.mesh.position.x, 12, this.player.mesh.position.z + 8);
        this.camera.lookAt(this.player.mesh.position);
        
        if(this.screenShakeTimer > 0) {
            this.screenShakeTimer -= dt;
            const amt = this.screenShakeIntensity * (this.screenShakeTimer / 0.3);
            this.camera.position.x += (Math.random()-0.5)*amt*0.1;
            this.camera.position.y += (Math.random()-0.5)*amt*0.05;
        }
		
		this.floatingTexts = this.floatingTexts.filter(t => t.update(dt));

        const buffList = Object.keys(this.player.buffs).map(b => `${b}:${this.player.buffs[b].remaining.toFixed(1)}s`).join(' ');
        
        let nodeInfo = "";
        if (window.WorldState) {
            const node = WorldState.getCurrentNode();
            const pX = this.player.mesh.position.x;
            const pZ = this.player.mesh.position.z;
            const dist = Math.sqrt(pX*pX + pZ*pZ).toFixed(0);
            nodeInfo = ` | ${node.name} [Depth: ${dist}m] Lvl:${node.level}`;
        }
        
        this.hud.updateDebug(`RiftScape v3.1 CANVAS HUD\n${BiomeRegistry.get(this.currentBiome).name}\nEntities: ${this.entities.length}\nFPS: ${(1/dt).toFixed(0)} ${buffList} ${nodeInfo}`);
        
        this.renderer.render(this.scene, this.camera);
        if (this.hud) this.hud.render(this.renderer);
		
		this.input.clear();
    }
	
	setupDragAndDrop() {
        const dropZone = document.body;

        // 1. Visual Feedback during Drag
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            if (this.currentBiome === 'sanctuary') {
                dropZone.style.boxShadow = "inset 0 0 50px #00ff00"; // Green glow
                dropZone.style.cursor = "copy";
            } else {
                dropZone.style.boxShadow = "inset 0 0 50px #ff0000"; // Red glow (Deny)
                dropZone.style.cursor = "not-allowed";
            }
        });

        dropZone.addEventListener('dragleave', (e) => {
            dropZone.style.boxShadow = "none";
            dropZone.style.cursor = "default";
        });

        // 2. The Drop Logic
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.boxShadow = "none";

            // RULE: Only mod in the Outpost (Sanctuary)
            if (this.currentBiome !== 'sanctuary') {
                this.hud.updateDebug("SECURITY PROTOCOL: MODDING DISABLED IN RIFT");
                this.sound.play('error');
                return;
            }

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleModFile(files[0]);
            }
        });
    }

    handleModFile(file) {
        if (!file.name.endsWith('.js')) {
            this.hud.updateDebug("INVALID FORMAT. REQUIRE .JS");
            this.sound.play('error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const code = e.target.result;
            
            // PUNK ROCK INJECTION: Create a script tag with the content
            // This executes immediately in the global scope.
            try {
                const script = document.createElement('script');
                script.textContent = code;
                document.body.appendChild(script);
                
                // Note: The script itself should call game.modManager.register()
                // If it doesn't, it still runs, just silently.
            } catch (err) {
                console.error("Mod Execution Error:", err);
                this.hud.updateDebug("MOD EXECUTION FAILURE");
                this.sound.play('error');
            }
        };
        reader.readAsText(file);
    }
}
