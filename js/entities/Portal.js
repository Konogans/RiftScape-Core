class Portal {
    constructor(game, x, z, targetNodeId, targetName, level = 1) {
        this.game = game;
        this.targetNodeId = targetNodeId;
        this.targetName = targetName;
        this.dead = false;
		this.level = level;
        
        this.initMesh(x, z);
    }
    
    initMesh(x, z) {
        // 1. Geometry & Shader (Same as before)
        const geometry = new THREE.PlaneGeometry(3, 3);
        
        this.uniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x8844ff) }
        };
        
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float uTime;
            uniform vec3 uColor;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv - 0.5;
                float dist = length(uv);
                float angle = atan(uv.y, uv.x);
                float spiral = sin(dist * 20.0 - uTime * 3.0 + angle * 5.0);
                float ring = smoothstep(0.4, 0.45, dist) - smoothstep(0.45, 0.5, dist);
                float glow = 0.05 / dist;
                float alpha = step(dist, 0.5);
                float pattern = spiral * dist * 2.0 + glow;
                gl_FragColor = vec4(uColor * (pattern + 1.0), alpha * pattern);
            }
        `;
        
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, 1.5, z);
        
        // --- FIXED ORIENTATION ---
        // Instead of updating every frame, we look at the world center ONCE.
        // This makes the portal static, facing the spawn point.
        this.mesh.lookAt(0, 1.5, 0); 
        
        this.addLabel();
    }
    
	addLabel() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // FIX: Increased width from 256 to 512 to prevent clipping
        canvas.width = 512; 
        canvas.height = 64;
        
        ctx.font = "bold 24px Courier New";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        
        // Center is now 256
		const labelText = this.targetNodeId === 'NEW_RUN' 
            ? this.targetName 
            : `${this.targetName} [LVL ${this.level}]`;
        ctx.fillText(labelText, 256, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 1.0;
        
        // FIX: Scale X to 8 to match the 512:64 aspect ratio (8:1)
        // This keeps the text looking normal, not squished
        sprite.scale.set(8, 1, 1);
        
        this.mesh.add(sprite);
    }
    
	update(deltaTime, elapsed) {
        if (this.dead) return;
        
        // Update shader time
        this.uniforms.uTime.value = elapsed;
        
        const playerPos = this.game.player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        
        if (dist < 1.5) {
            this.enter();
        }
    }
    
    enter() {
        if (this.dead) return;
        this.dead = true;
        console.log(`Traveling to ${this.targetName}...`);
        this.game.executeBiomeTransition(this.targetNodeId);
    }
    
    dispose() {
        if(this.mesh.geometry) this.mesh.geometry.dispose();
        if(this.material) this.material.dispose();
    }
}