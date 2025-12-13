const ACTIVE_MODS = [
    //'mods/animation_state_sync.js',
];

function injectMods() {
    // 1. Check if the Game and ModManager are ready
    if (!window.game || !window.game.modManager) {
        // Not ready? Wait 100ms and try again
        // console.log("[ModList] Waiting for Engine...");
        setTimeout(injectMods, 100);
        return;
    }

    // 2. Engine is Ready - Inject!
    console.log("[ModList] Engine Detected. Injecting Mods...");
    
    ACTIVE_MODS.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => console.log(`[ModList] Loaded: ${src}`);
        script.onerror = () => console.error(`[ModList] Failed to load: ${src}`);
        document.body.appendChild(script);
    });
}

// Start the polling loop
injectMods();