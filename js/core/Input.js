
class Input {
    constructor() {
        this.keys = {};
        this.keysPressed = {};
        this.keysReleased = {};
        
        this.mouse = { x: 0, y: 0, buttons: {} };
        this.mouseButtonsPressed = {}; // Track clicks for one frame
        
        this.setupListeners();
    }
    
    setupListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) { this.keysPressed[e.code] = true; }
            this.keys[e.code] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keysReleased[e.code] = true;
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mousedown', (e) => {
            this.mouse.buttons[e.button] = true;
            this.mouseButtonsPressed[e.button] = true;
        });
        
        window.addEventListener('mouseup', (e) => {
            this.mouse.buttons[e.button] = false;
        });
        
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    isHeld(code) { return !!this.keys[code]; }
    
    isMouseHeld(button) { return !!this.mouse.buttons[button]; }
    
    wasPressed(code) {
        if (this.keysPressed[code]) { this.keysPressed[code] = false; return true; }
        return false;
    }
    
    wasMousePressed(button) {
        if (this.mouseButtonsPressed[button]) { this.mouseButtonsPressed[button] = false; return true; }
        return false;
    }
    
    wasReleased(code) {
        if (this.keysReleased[code]) { this.keysReleased[code] = false; return true; }
        return false;
    }
    
    getMovementVector() {
        let x = 0;
        let z = 0;
        if (this.isHeld('KeyW') || this.isHeld('ArrowUp')) z -= 1;
        if (this.isHeld('KeyS') || this.isHeld('ArrowDown')) z += 1;
        if (this.isHeld('KeyA') || this.isHeld('ArrowLeft')) x -= 1;
        if (this.isHeld('KeyD') || this.isHeld('ArrowRight')) x += 1;
        const length = Math.sqrt(x * x + z * z);
        if (length > 0) { x /= length; z /= length; }
        return { x, z };
    }
}
