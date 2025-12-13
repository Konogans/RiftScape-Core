/**
 * HUDSystem.js
 * Canvas-based HUD rendering using Three.js orthographic overlay.
 */

class HUDSystem {
    constructor(game) {
        this.game = game;
        this.width = game.internalWidth || 800;
        this.height = game.internalHeight || 600;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(
            0, this.width,
            this.height, 0,
            -100, 100
        );
        
        this.elements = {};
        this.dirty = {};
        this.cache = {};
        
        this.initElements();
    }
    
    initElements() {
        // Health Bars
        this.createBar('healthMax', 20, this.height - 60, 180, 16, 0x224466);
        this.createBar('healthActive', 20, this.height - 60, 180, 16, 0x44aaff);
        this.createBar('healthReserve', 20, this.height - 40, 180, 6, 0x666688);
        
        // Action Bar (Windup)
        this.createBar('actionBar', 20, this.height - 90, 180, 5, 0xffaa44);
        this.createText('actionLabel', 20, this.height - 98, 'Ready', 10, '#888888');
		
		// Raid Bar & Timer
		this.createBar('raidGateHealth', this.width / 2 - 100, 80, 200, 12, 0x00ffff); // Cyan Bar
        this.createText('raidTimer', this.width / 2, 95, '', 14, '#ff4444', 'center'); // Red Timer
        
        // GENERIC ABILITY SLOTS (Shift, RMB, Q, F)
        // Positioned in a row next to health
        const startX = 210;
        const gap = 40;
        
        this.createAbilityIcon('slot_mobility', startX, this.height - 60, 32, 'SHFT', 0x4488ff);
        this.createAbilityIcon('slot_secondary', startX + gap, this.height - 60, 32, 'RMB', 0xffaa44);
        this.createAbilityIcon('slot_utility', startX + gap*2, this.height - 60, 32, 'Q', 0x44ffaa);
        this.createAbilityIcon('slot_mastery', startX + gap*3, this.height - 60, 32, 'F', 0xff44aa);
        
        // Compass & Stats (Keep existing)
        this.createText('compassArrow', this.width / 2, 25, '➤', 28, '#aa44ff', 'center');
        this.createText('compassLabel', this.width / 2, 55, 'Finding Portal...', 12, '#aa44ff', 'center');
        this.createText('compassDist', this.width / 2, 72, '0m', 10, '#ffffff', 'center');
        
        this.createText('statTime', this.width - 20, 25, '0:00', 14, '#ffffff', 'right');
        this.createText('statKills', this.width - 20, 45, '0', 14, '#ffffff', 'right');
        this.createText('statEssence', this.width - 20, 65, '◆ 0', 14, '#ffcc44', 'right');
        
        this.createText('debug', 10, 15, '', 10, '#00ff00', 'left', true);
		
		// BOSS BAR (Top Center, Huge)
        this.createBar('bossHealth', this.width/2 - 150, 40, 300, 20, 0xff0000); // Red
        this.createText('bossName', this.width/2, 43, '', 14, '#ffffff', 'center');
        
        // Hide initially
        this.setBar('bossHealth', 0); // Hack to hide for now, or use visible flag if we added it
        if(this.elements.bossHealth) this.elements.bossHealth.sprite.visible = false;
        if(this.elements.bossName) this.elements.bossName.sprite.visible = false;
    }

    // NEW: Allow Player.js to rename the buttons
    setAbilityLabel(id, text) {
        const el = this.elements[id];
        if (!el || el.label === text) return;
        el.label = text; // Update internal state
        this.dirty[id] = true; // Force redraw
    }
    
    createBar(id, x, y, width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        sprite.position.set(x + width/2, y + height/2, 0);
        sprite.scale.set(width, height, 1);
        
        this.scene.add(sprite);
        this.elements[id] = { 
            type: 'bar', 
            sprite, canvas, texture, 
            x, y, width, height, 
            color, value: 1, bgColor: 0x111111
        };
        this.dirty[id] = true;
    }
    
    createText(id, x, y, text, size, color, align = 'left', multiline = false) {
        const canvas = document.createElement('canvas');
        canvas.width = multiline ? 400 : 256;
        canvas.height = multiline ? 80 : 32;
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        let posX = x;
        if (align === 'center') posX = x;
        else if (align === 'right') posX = x - canvas.width/2;
        else posX = x + canvas.width/2;
        
        sprite.position.set(posX, y, 0);
        sprite.scale.set(canvas.width, canvas.height, 1);
        
        this.scene.add(sprite);
        this.elements[id] = { 
            type: 'text', 
            sprite, canvas, texture, 
            x, y, text, size, color, align, multiline
        };
        this.dirty[id] = true;
    }
    
    createAbilityIcon(id, x, y, size, label, color) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size + 12; // Extra space for label
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        sprite.position.set(x + size/2, y + (size + 12)/2, 0);
        sprite.scale.set(size, size + 12, 1);
        
        this.scene.add(sprite);
        this.elements[id] = { 
            type: 'icon', 
            sprite, canvas, texture,
            x, y, size, label, color,
            ready: true, cooldownRatio: 0
        };
        this.dirty[id] = true;
    }
    
    // === UPDATE METHODS ===
    
    setBar(id, value, maxValue = 1) {
        const ratio = Math.max(0, Math.min(1, value / maxValue));
        const el = this.elements[id];
        if (!el || el.value === ratio) return;
        el.value = ratio;
        this.dirty[id] = true;
    }
    
    setBarColor(id, color) {
        const el = this.elements[id];
        if (!el || el.color === color) return;
        el.color = color;
        this.dirty[id] = true;
    }
    
    setText(id, text) {
        const el = this.elements[id];
        if (!el || el.text === text) return;
        el.text = text;
        this.dirty[id] = true;
    }
    
    setTextColor(id, color) {
        const el = this.elements[id];
        if (!el || el.color === color) return;
        el.color = color;
        this.dirty[id] = true;
    }
    
	// Add 'affordable' parameter (default true)
    setAbilityIcon(id, ready, cooldownRatio = 0, affordable = true) {
        const el = this.elements[id];
        if (!el) return;
        
        // Update state
        if (el.ready === ready && el.cooldownRatio === cooldownRatio && el.affordable === affordable) return;
        el.ready = ready;
        el.cooldownRatio = cooldownRatio;
        el.affordable = affordable; // Store this
        this.dirty[id] = true;
    }
    
    setCompassRotation(angleDegrees) {
        const cacheKey = 'compassAngle';
        if (this.cache[cacheKey] === angleDegrees) return;
        this.cache[cacheKey] = angleDegrees;
        this.dirty['compassArrow'] = true;
    }
    
    // === RENDER ===
    
    redraw() {
        for (const [id, isDirty] of Object.entries(this.dirty)) {
            if (!isDirty) continue;
            
            const el = this.elements[id];
            if (!el) continue;
            
            const ctx = el.canvas.getContext('2d');
            ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
            
            if (el.type === 'bar') {
                this.drawBar(ctx, el);
            } else if (el.type === 'text') {
                if (id === 'compassArrow') {
                    this.drawCompassArrow(ctx, el);
                } else {
                    this.drawText(ctx, el);
                }
            } else if (el.type === 'icon') {
                this.drawAbilityIcon(ctx, el);
            }
            
            el.texture.needsUpdate = true;
            this.dirty[id] = false;
        }
    }
    
    drawBar(ctx, el) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, el.width, el.height);
        
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, el.width, el.height);
        
        const fillWidth = el.width * el.value;
        ctx.fillStyle = '#' + el.color.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, fillWidth, el.height);
    }
    
    drawText(ctx, el) {
        ctx.font = `bold ${el.size}px "Courier New", monospace`;
        ctx.fillStyle = el.color;
        ctx.textBaseline = 'top';
        
        if (el.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(el.text, el.canvas.width / 2, 0);
        } else if (el.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(el.text, el.canvas.width, 0);
        } else {
            ctx.textAlign = 'left';
            if (el.multiline) {
                const lines = el.text.split('\n');
                lines.forEach((line, i) => {
                    ctx.fillText(line, 0, i * (el.size + 2));
                });
            } else {
                ctx.fillText(el.text, 0, 0);
            }
        }
    }
    
    drawCompassArrow(ctx, el) {
        const cx = el.canvas.width / 2;
        const cy = el.canvas.height / 2;
        const angle = (this.cache['compassAngle'] || 0) * Math.PI / 180;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        
        ctx.font = `bold ${el.size}px Arial`;
        ctx.fillStyle = el.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('➤', 0, 0);
        
        ctx.restore();
    }
    
    drawAbilityIcon(ctx, el) {
const size = el.size;
        
        // Background
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, size, size);
        
        // Border Color Logic
        let borderColor = '#333333';
        if (el.ready) {
            borderColor = el.affordable !== false ? '#' + el.color.toString(16).padStart(6, '0') : '#ff0000'; 
        }
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        
        // ... [Cooldown overlay code same as before] ...
        if (!el.ready && el.cooldownRatio > 0) {
            const fillHeight = size * el.cooldownRatio;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, size - fillHeight, size, fillHeight);
        }

        // Ready Glow / Cost Warning
        if (el.ready) {
            if (el.affordable !== false) {
                // Normal Glow
                ctx.fillStyle = '#' + el.color.toString(16).padStart(6, '0');
                ctx.globalAlpha = 0.3;
                ctx.fillRect(2, 2, size - 4, size - 4);
                ctx.globalAlpha = 1.0;
            } else {
                // Not Affordable (Red X or Dim)
                ctx.fillStyle = '#ff0000';
                ctx.globalAlpha = 0.2;
                ctx.fillRect(2, 2, size - 4, size - 4);
                ctx.globalAlpha = 1.0;
            }
        }
        
        // Label below
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.fillStyle = el.ready ? '#ffffff' : '#666666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(el.label, size / 2, size + 2);
    }
    
    render(renderer) {
        this.redraw();
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(this.scene, this.camera);
        renderer.autoClear = true;
    }
    
    // === CONVENIENCE METHODS ===
    
    updateHealth(pool) {
        this.setBar('healthActive', pool.active, pool.maxActive);
        this.setBar('healthMax', pool.currentMax, pool.maxActive);
        this.setBar('healthReserve', pool.reserve, pool.maxReserve);
    }
    
    updateAction(action) {
        this.setBar('actionBar', action.getTotalProgress());
        const colors = { idle: 0x888888, windup: 0xff6644, action: 0xffff44, cooldown: 0x44ff66 };
        this.setBarColor('actionBar', colors[action.status] || 0xffaa44);
        const labels = { idle: 'Ready', windup: 'Charging...', action: 'STRIKE!', cooldown: 'Recovering' };
        this.setText('actionLabel', labels[action.status] || 'Ready');
    }
    
    updateDash(ratio, ready) {
        this.setAbilityIcon('dashIcon', ready, ratio);
    }
    
    updateSlam(ratio, ready) {
        this.setAbilityIcon('slamIcon', ready, ratio);
    }
    
    updateCompass(angle, label, dist, isReturn = false) {
        this.setCompassRotation(angle);
        this.setText('compassLabel', label);
        this.setText('compassDist', `${Math.round(dist)}m`);
        const color = isReturn ? '#ffffff' : '#aa44ff';
        this.setTextColor('compassLabel', color);
    }
    
    updateStats(time, kills, essence) {
        this.setText('statTime', time);
        this.setText('statKills', String(kills));
        this.setText('statEssence', `◆ ${essence}`);
    }
    
    updateDebug(text) {
        this.setText('debug', text);
    }
    
    setVisible(visible) {
        this.scene.visible = visible;
    }
	
	updateRaid(active, gateHealth, maxHealth, wave, timeRemaining, enemiesLeft = 0, isFinalWave = false) {
        if (!active) {
            this.setBar('raidGateHealth', 0);
            this.setText('raidTimer', '');
            if (this.elements['raidGateHealth']) this.elements['raidGateHealth'].sprite.visible = false;
            return;
        }

        // Show Bar
        if (this.elements['raidGateHealth']) this.elements['raidGateHealth'].sprite.visible = true;
        this.setBar('raidGateHealth', gateHealth, maxHealth);
        
        // Format Timer & Status
        const timeStr = timeRemaining.toFixed(1);
        let text = "";
        
        if (timeRemaining > 0 && enemiesLeft === 0) {
            // Spawning Soon
            text = `NEXT WAVE: ${timeStr}s`;
            if (isFinalWave) text += " [FINALE]";
        } else {
            // Combat Active
            text = `WAVE ${wave}`;
            if (isFinalWave) text += " [FINAL]";
            text += ` | HOSTILES: ${enemiesLeft}`;
        }
        
        // Color coding
        const color = isFinalWave ? '#ff4444' : '#ffffff';
        this.setTextColor('raidTimer', color);
        this.setText('raidTimer', text);
    }
	
	updateBoss(active, name, hp, maxHp) {
        if (!this.elements.bossHealth) return;
        
        const bar = this.elements.bossHealth.sprite;
        const txt = this.elements.bossName.sprite;
        
        bar.visible = active;
        txt.visible = active;
        
        if (active) {
            this.setBar('bossHealth', hp, maxHp);
            this.setText('bossName', name.toUpperCase());
        }
    }
}

window.HUDSystem = HUDSystem;
