
class AnimationController {
    constructor(mesh, animations, stateMap) {
        this.mesh = mesh;
        this.stateMap = stateMap;
        this.currentState = null;
        this.currentAction = null;
        const { mixer, actions } = ModelLoader.createMixer(mesh, animations);
        this.mixer = mixer;
        this.actions = actions;
    }
    
    play(stateName, options = {}) {
        const { fadeIn = 0.2, loop = true, onFinish = null } = options;
        const clipName = this.stateMap[stateName];
        if (!clipName || !this.actions[clipName]) return;
        
        // Skip if already playing this state
        if (this.currentState === stateName && this.currentAction?.isRunning()) return;
        
        const nextAction = this.actions[clipName];
        nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        nextAction.clampWhenFinished = !loop;
        
        if (this.currentAction && this.currentAction !== nextAction) {
            nextAction.reset();
            nextAction.setEffectiveWeight(1);
            nextAction.crossFadeFrom(this.currentAction, fadeIn, true);
        }
        
        nextAction.play();
        
        if (!loop && onFinish) {
            const onFinished = (e) => {
                if (e.action === nextAction) {
                    this.mixer.removeEventListener('finished', onFinished);
                    onFinish();
                }
            };
            this.mixer.addEventListener('finished', onFinished);
        }
        
        this.currentState = stateName;
        this.currentAction = nextAction;
    }
    
    stop() {
        if (this.currentAction) this.currentAction.stop();
        this.currentState = null;
        this.currentAction = null;
    }
    
    dispose() {
        this.stop();
        ModelLoader.removeMixer(this.mixer);
    }
}

const ModelLoader = {
    cache: {},
    pending: {},
    mixers: [],
    
    load(path) {
        if (this.cache[path]) return Promise.resolve(this.cloneCached(path));
        if (this.pending[path]) return this.pending[path].then(() => this.cloneCached(path));
        
        const loader = new THREE.GLTFLoader();
        this.pending[path] = new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => {
                    this.cache[path] = { scene: gltf.scene, animations: gltf.animations };
                    delete this.pending[path];
                    resolve(this.cloneCached(path));
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load model: ${path}`, error);
                    delete this.pending[path];
                    reject(error);
                }
            );
        });
        return this.pending[path];
    },
    
    cloneCached(path) {
        const cached = this.cache[path];
        if (!cached) return null;
        return {
            scene: cached.scene.clone(),
            animations: cached.animations
        };
    },
    
    createMixer(mesh, animations) {
        const mixer = new THREE.AnimationMixer(mesh);
        const actions = {};
        for (const clip of animations) {
            actions[clip.name] = mixer.clipAction(clip);
        }
        this.mixers.push(mixer);
        return { mixer, actions };
    },
    
    removeMixer(mixer) {
        const idx = this.mixers.indexOf(mixer);
        if (idx >= 0) this.mixers.splice(idx, 1);
        mixer.stopAllAction();
    },
    
    update(deltaTime) {
        for (const mixer of this.mixers) mixer.update(deltaTime);
    }
};
