
class Game {
    constructor() {
        this.entities = [];
        this.clock = new THREE.Clock();
        this.debug = document.getElementById('debug');
        
        this.runTime = 0; this.kills = 0; this.isGameOver = false; this.inOutpost = true; this.runAffinity = null;
        this.currentBiome = 'rift_wastes'; this.zoneKills = 0; this.zoneTime = 0; this.zonesCleared = 0; this.portal = null; this.portalSpawned = false;
        
        this.screenShakeTimer = 0; this.screenShakeIntensity = 0; this.particles = [];
        
        this.pendingBiome = null;
        
        MetaProgression.load();
        
        this.initUI();
        this.initRenderer();
        this.initScene();
        this.initCamera();
        this.initLights();
        
        // Raycaster for Mouse Aiming
        this.raycaster = new THREE.Raycaster();
        this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        // FORCE WORLD MANAGER
        if (typeof WorldManager === 'function') {
            this.world = new WorldManager(this);
        } else if (window.WorldManager) {
             this.world = new window.WorldManager(this);
        } else {
            console.error("WorldManager is missing!");
        }
        
        this.input = new Input();
        
        this.showOutpost();
        window.addEventListener('resize', () => this.onResize());
        this.loop();
    }
    
    // NEW: Get 3D position of mouse on ground level
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
        this.statTimeEl = document.getElementById('stat-time');
        this.statKillsEl = document.getElementById('stat-kills');
        this.statEssenceEl = document.getElementById('stat-essence');
        this.gameOverEl = document.getElementById('game-over');
        this.finalTimeEl = document.getElementById('final-time');
        this.finalKillsEl = document.getElementById('final-kills');
        this.essenceEarnedEl = document.getElementById('essence-earned');
        
        document.getElementById('restart-btn').addEventListener('click', () => this.quickRestart());
        document.getElementById('outpost-btn').addEventListener('click', () => this.showOutpost());
        document.getElementById('enter-rift-btn').addEventListener('click', () => this.enterRift());
        document.getElementById('reset-progress-btn').addEventListener('click', () => { if(confirm('Reset?')) { MetaProgression.reset(); this.showOutpost(); }});
        
        this.dashBarFill = document.getElementById('dash-bar-fill');
        this.dashLabel = document.getElementById('dash-label');
        this.dashBar = document.getElementById('dash-bar');
        this.slamBarFill = document.getElementById('slam-bar-fill');
        this.slamLabel = document.getElementById('slam-label');
        this.slamBar = document.getElementById('slam-bar');
        this.outpostEl = document.getElementById('outpost');
        this.upgradesGridEl = document.getElementById('upgrades-grid');
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x1a1a2e);
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
        for (let i = 0; i < 3; i++) this.spawnEnemy('default');
    }
    
    spawnEnemy(forceType = null) {
        if (this.enemies.length >= this.maxEnemies) return;
        
        let x, z, attempts = 0;
        let valid = false;
        
        while (!valid && attempts < 10) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 5;
            x = this.player.mesh.position.x + Math.cos(angle) * dist;
            z = this.player.mesh.position.z + Math.sin(angle) * dist;
            
            if (this.world) {
                if (!this.world.checkCollision(x, z, 0.6)) {
                    valid = true;
                }
            } else {
                valid = true; 
            }
            attempts++;
        }
        
        if (!valid) return;
        
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
        this.kills++; this.zoneKills++; this.statKillsEl.textContent = this.kills;
        this.checkPortal();
    }
    
    checkPortal() {
        const t = BiomeRegistry.get(this.currentBiome).portalThreshold;
        if (!this.portal && !this.portalSpawned && (this.zoneKills >= t.kills || this.zoneTime >= t.time)) {
             let px, pz, attempts = 0;
             do { 
                 const angle = Math.random() * Math.PI * 2;
                 const dist = 6 + Math.random() * 4;
                 px = this.player.mesh.position.x + Math.cos(angle) * dist;
                 pz = this.player.mesh.position.z + Math.sin(angle) * dist;
                 attempts++; 
             } while (attempts < 20 && this.world && this.world.checkCollision(px, pz, 1.5));
             
             this.portal = new Portal(this, px, pz, BiomeRegistry.getRandomBiome(this.currentBiome));
             this.entities.push(this.portal); this.scene.add(this.portal.mesh); this.portalSpawned = true;
        }
    }
    
    transitionToBiome(biomeId) {
        this.pendingBiome = biomeId;
    }

    executeBiomeTransition(biomeId) {
        this.cleanupEntities();
        this.currentBiome = biomeId; this.zonesCleared++; this.zoneKills = 0; this.zoneTime = 0; this.portalSpawned = false;
        const biome = BiomeRegistry.get(biomeId);
        this.scene.fog.color.setHex(biome.fogColor); this.scene.fog.density = biome.fogDensity;
        this.ambientLight.color.setHex(biome.ambientColor);
        this.scene.background.setHex(biome.fogColor);
        
        if (this.world) this.world.clear();
        
        this.player.mesh.position.set(0, 0.5, 0);
        this.entities.push(this.player); this.scene.add(this.player.mesh);
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

    cleanupEntities() {
        if(this.enemies) [...this.enemies].forEach(e => this.safeRemove(e, this.enemies));
        if(this.projectiles) [...this.projectiles].forEach(p => this.safeRemove(p, this.projectiles));
        if(this.pickups) [...this.pickups].forEach(p => this.safeRemove(p, this.pickups));
        if(this.portal) { this.safeRemove(this.portal, null); this.portal = null; }
        
        if(this.player) { 
            this.scene.remove(this.player.mesh); 
            if(this.player.dashTrail) this.scene.remove(this.player.dashTrail); 
            if(this.player.slamRing) this.scene.remove(this.player.slamRing); 
        }
        
        this.particles.forEach(p => { 
            this.scene.remove(p.mesh); 
            p.mesh.geometry.dispose(); 
            p.mesh.material.dispose(); 
        });
        this.particles = []; 
        this.entities = [];
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
    
    showOutpost() {
        this.inOutpost = true; this.gameOverEl.classList.remove('visible'); this.outpostEl.classList.remove('hidden');
        document.getElementById('total-runs').textContent = MetaProgression.data.runs;
        document.getElementById('best-time').textContent = this.formatTime(MetaProgression.data.bestTime);
        document.getElementById('best-kills').textContent = MetaProgression.data.bestKills;
        document.getElementById('current-essence').textContent = MetaProgression.data.essence;
        document.getElementById('magic-affinity').textContent = MetaProgression.data.magicAffinity;
        document.getElementById('tech-affinity').textContent = MetaProgression.data.techAffinity;
        this.upgradesGridEl.innerHTML = '';
        UpgradeRegistry.list().forEach(u => {
            const owned = MetaProgression.hasUpgrade(u.id);
            const locked = u.requires && !MetaProgression.hasUpgrade(u.requires);
            const card = document.createElement('div');
            card.className = `upgrade-card ${owned?'owned':''} ${locked?'locked':''}`;
            const tag = u.affinity !== 'neutral' ? `<span class="affinity-tag ${u.affinity}">${u.affinity}</span>` : '';
            card.innerHTML = `<div class="name">${u.name}${tag}</div><div class="desc">${u.description}</div><div class="cost">${owned ? 'Owned' : '◆ '+u.cost}</div>`;
            if(!owned && !locked) card.onclick = () => { if(MetaProgression.buyUpgrade(u)) this.showOutpost(); };
            this.upgradesGridEl.appendChild(card);
        });
    }
    
    enterRift() {
        this.inOutpost = false; this.outpostEl.classList.add('hidden');
        this.runAffinity = MetaProgression.data.runs % 2 === 0 ? 'magic' : 'tech';
        this.cleanupEntities();
        this.runTime = 0; this.kills = 0; this.runEssence = 0; this.isGameOver = false;
        this.spawnTimer = 0; this.spawnInterval = 3000; this.currentBiome = 'rift_wastes';
        this.zoneKills = 0; this.zoneTime = 0; this.zonesCleared = 0; this.portalSpawned = false;
        this.statTimeEl.textContent = '0:00'; this.statKillsEl.textContent = '0'; this.statEssenceEl.textContent = '0';
        
        const biome = BiomeRegistry.get('rift_wastes');
        this.scene.fog.color.setHex(biome.fogColor); this.scene.fog.density = biome.fogDensity;
        this.ambientLight.color.setHex(biome.ambientColor); 
        this.scene.background.setHex(biome.fogColor);
        
        // Clear world
        if (this.world) this.world.clear();
        
        this.initPlayer();
        this.clock.getDelta();
    }
    
    quickRestart() { this.gameOverEl.classList.remove('visible'); this.enterRift(); }
    
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
    
    formatTime(s) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
    onResize() { this.camera.aspect = window.innerWidth/window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
    
    loop() {
        requestAnimationFrame(() => this.loop());
        const dt = this.clock.getDelta(); const elapsed = this.clock.getElapsedTime();
        
        if (window.ModelLoader) ModelLoader.update(dt);
        
        if (this.pendingBiome) {
            this.executeBiomeTransition(this.pendingBiome);
            this.pendingBiome = null;
            return;
        }
        
        if (this.world && this.player && !this.player.dead) {
            this.world.update(this.player.mesh.position.x, this.player.mesh.position.z);
        }

        if (this.inOutpost || !this.player) { this.renderer.render(this.scene, this.camera); return; }
        
        [...this.entities].forEach(e => { if(e.update) e.update(dt, elapsed); });
        
        for(let i=this.enemies.length-1; i>=0; i--) if(this.enemies[i].shouldRemove) this.safeRemove(this.enemies[i], this.enemies);
        for(let i=this.projectiles.length-1; i>=0; i--) if(this.projectiles[i].shouldRemove) this.safeRemove(this.projectiles[i], this.projectiles);
        for(let i=this.pickups.length-1; i>=0; i--) if(this.pickups[i].shouldRemove) this.safeRemove(this.pickups[i], this.pickups);
        if(this.portal && this.portal.shouldRemove) { this.safeRemove(this.portal, null); this.portal = null; }
        
        if(!this.player.dead && !this.isGameOver) {
            this.runTime += dt; this.zoneTime += dt; this.statTimeEl.textContent = this.formatTime(this.runTime);
            this.checkPortal();
            const biome = BiomeRegistry.get(this.currentBiome);
            this.spawnTimer += dt * 1000 * biome.spawnRateMultiplier;
            if(this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0; this.spawnEnemy();
                this.spawnInterval = Math.max(800, this.spawnInterval - 30);
                this.maxEnemies = Math.min(15, 10 + Math.floor(this.runTime / 30));
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
        
        const dashR = this.player.getAbilityCooldownRatio('dash');
        this.dashBarFill.style.width = ((1-dashR)*100)+'%';
        this.dashBar.className = dashR>0 ? 'cooldown' : '';
        this.dashLabel.textContent = dashR>0 ? 'DASH' : 'DASH READY';
        this.dashLabel.className = dashR>0 ? '' : 'ready';
        
        const slamR = this.player.getAbilityCooldownRatio('slam');
        this.slamBarFill.style.width = ((1-slamR)*100)+'%';
        this.slamBar.className = slamR>0 ? 'cooldown' : '';
        this.slamLabel.textContent = slamR>0 ? 'SLAM' : 'SLAM READY';
        this.slamLabel.className = slamR>0 ? '' : 'ready';

        const buffList = Object.keys(this.player.buffs).map(b => `${b}:${this.player.buffs[b].remaining.toFixed(1)}s`).join(' ');
        this.debug.textContent = `RiftScape Infinite v1.6\n${BiomeRegistry.get(this.currentBiome).name}\nEntities: ${this.entities.length}\nFPS: ${(1/dt).toFixed(0)} ${buffList}`;
        
        this.renderer.render(this.scene, this.camera);
    }
}
