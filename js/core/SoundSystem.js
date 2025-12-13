class SoundSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.3; // Safety limiter (save your ears)
        this.master.connect(this.ctx.destination);

        // Separate music channel for independent volume control
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.5;
        this.musicGain.connect(this.master);

        // Music state
        this.musicBuffers = {};  // Loaded audio buffers
        this.currentMusic = null;  // Current playing source
        this.currentMusicId = null;

        // Generate White Noise Buffer (for explosions/impacts)
        this.noiseBuffer = this.createNoiseBuffer();

        console.log("SoundSystem: Online (Procedural + Music)");
    }

    // --- MUSIC SYSTEM ---

    async loadMusic(id, path) {
        if (this.musicBuffers[id]) return; // Already loaded

        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.musicBuffers[id] = audioBuffer;
            console.log(`[SoundSystem] Loaded music: ${id}`);
        } catch (e) {
            console.warn(`[SoundSystem] Failed to load music ${id}:`, e);
        }
    }

    playMusic(id, loop = true) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Stop current music if playing
        this.stopMusic();

        const buffer = this.musicBuffers[id];
        if (!buffer) {
            console.warn(`[SoundSystem] Music not loaded: ${id}`);
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.connect(this.musicGain);
        source.start(0);

        this.currentMusic = source;
        this.currentMusicId = id;
        console.log(`[SoundSystem] Playing music: ${id}`);
    }

    stopMusic(fadeTime = 0.5) {
        if (!this.currentMusic) return;

        const t = this.ctx.currentTime;

        // Fade out
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
        this.musicGain.gain.linearRampToValueAtTime(0, t + fadeTime);

        // Stop after fade
        const source = this.currentMusic;
        setTimeout(() => {
            try { source.stop(); } catch (e) { /* Already stopped */ }
        }, fadeTime * 1000);

        this.currentMusic = null;
        this.currentMusicId = null;

        // Restore music gain for next track
        setTimeout(() => {
            this.musicGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        }, fadeTime * 1000 + 50);
    }

    setMusicVolume(vol) {
        this.musicGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }

    // --- PROCEDURAL SFX (unchanged) ---
    
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }
    
    // The Universal "Play" Function
    play(id) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const t = this.ctx.currentTime;

        // --- PRESETS ---
        
        if (id === 'shotgun') {
            // Heavy Noise Burst
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const gain = this.ctx.createGain();
            
            // Low Pass Filter (Muffles the hiss into a "Thud")
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, t);
            filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            
            gain.gain.setValueAtTime(1.0, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            
            src.start(t);
            src.stop(t + 0.3);
            
        } else if (id === 'laser' || id === 'bolt') {
            // Retro Square Wave "Pew"
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            
            osc.connect(gain);
            gain.connect(this.master);
            
            // Pitch Drop
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
            
            // Volume Envelope
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            osc.start(t);
            osc.stop(t + 0.15);
            
        } else if (id === 'swipe') {
            // Filtered Noise Swoosh
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(400, t);
            filter.frequency.linearRampToValueAtTime(1200, t + 0.1);
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
            
            src.start(t);
            src.stop(t + 0.15);
            
        } else if (id === 'hit') {
            // Short crunchy noise
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const gain = this.ctx.createGain();
            
            src.connect(gain);
            gain.connect(this.master);
            
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            
            src.start(t);
            src.stop(t + 0.1);
            
        } else if (id === 'build') {
            // Rising Sine "Chime"
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            
            osc.connect(gain);
            gain.connect(this.master);
            
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.exponentialRampToValueAtTime(880, t + 0.2);
            
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.2);
            
            osc.start(t);
            osc.stop(t + 0.2);
            
        } else if (id === 'error') {
            // Low Buzz
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(this.master);
            
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.linearRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        }else if (id === 'turret') {
            // Muffled Bang (Mech style)
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const gain = this.ctx.createGain();
            
            // Low pass for "Muffle"
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            
            gain.gain.setValueAtTime(0.4, t); // Quieter than shotgun
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            src.start(t);
            src.stop(t + 0.15);
        }
    }
}