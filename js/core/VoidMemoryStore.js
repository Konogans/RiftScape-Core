/**
 * VoidMemoryStore.js
 * Manages persistent memory for The Void Entity across sessions.
 */

const VoidMemoryStore = {
    key: 'riftscape_void_memory',
    data: null,

    /**
     * Loads memory from localStorage
     * @returns {Object} The memory object
     */
    load() {
        if (this.data) return this.data;
        
        try {
            const saved = localStorage.getItem(this.key);
            if (saved) {
                this.data = JSON.parse(saved);
                // Validate and fix structure to prevent corruption issues
                this.normalizeMemory();
            } else {
                // Initialize new memory
                this.data = {
                    playerId: this.generatePlayerId(),
                    firstContact: new Date().toISOString(),
                    conversationCount: 0,
                    runsWitnessed: 0,
                    deathsWitnessed: 0,
                    giftsGiven: [],
                    debtsOwed: 0,
                    debtsCollected: 0,
                    playerPatterns: [],
                    notableEvents: [],
                    trustLevel: 0,
                    voidsPersonality: {},
                    codeExecuted: [],
                    errorsThrown: [],
                    conversationHistory: [] // Array of { role: 'player'|'void', content: string, timestamp: string }
                };
                this.save();
            }
        } catch (e) {
            console.warn('[VoidMemoryStore] Failed to load memory:', e);
            this.data = this.getDefaultMemory();
        }
        
        return this.data;
    },

    /**
     * Saves memory to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[VoidMemoryStore] Failed to save memory:', e);
        }
    },

    /**
     * Applies a partial update to memory
     * @param {Object} patch - Partial memory object to merge
     */
    applyPatch(patch) {
        if (!patch) return;
        
        const mem = this.load();
        Object.assign(mem, patch);
        this.save();
    },

    /**
     * Generates a unique player ID based on browser fingerprint
     * @returns {string} Player ID
     */
    generatePlayerId() {
        // Simple hash of user agent + screen resolution
        const str = navigator.userAgent + screen.width + screen.height;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return 'player_' + Math.abs(hash).toString(16);
    },

    /**
     * Normalizes memory structure to ensure all required fields exist and are correct types
     */
    normalizeMemory() {
        if (!this.data) return;
        
        const defaults = this.getDefaultMemory();
        
        // Ensure all required fields exist
        Object.keys(defaults).forEach(key => {
            if (!(key in this.data)) {
                this.data[key] = defaults[key];
            }
        });
        
        // Ensure array fields are actually arrays
        const arrayFields = ['giftsGiven', 'playerPatterns', 'notableEvents', 'codeExecuted', 'errorsThrown', 'conversationHistory'];
        arrayFields.forEach(field => {
            if (!Array.isArray(this.data[field])) {
                console.warn(`[VoidMemoryStore] ${field} was not an array, resetting to []`);
                this.data[field] = [];
            }
        });
        
        // Ensure number fields are numbers
        const numberFields = ['conversationCount', 'runsWitnessed', 'deathsWitnessed', 'debtsOwed', 'debtsCollected', 'trustLevel'];
        numberFields.forEach(field => {
            if (typeof this.data[field] !== 'number') {
                console.warn(`[VoidMemoryStore] ${field} was not a number, resetting to 0`);
                this.data[field] = 0;
            }
        });
        
        // Ensure object fields are objects
        if (typeof this.data.voidsPersonality !== 'object' || this.data.voidsPersonality === null) {
            this.data.voidsPersonality = {};
        }
    },

    /**
     * Returns default memory structure
     * @returns {Object} Default memory
     */
    getDefaultMemory() {
        return {
            playerId: this.generatePlayerId(),
            firstContact: new Date().toISOString(),
            conversationCount: 0,
            runsWitnessed: 0,
            deathsWitnessed: 0,
            giftsGiven: [],
            debtsOwed: 0,
            debtsCollected: 0,
            playerPatterns: [],
            notableEvents: [],
            trustLevel: 0,
            voidsPersonality: {},
            codeExecuted: [],
            errorsThrown: [],
            conversationHistory: []
        };
    },

    /**
     * Adds a message to conversation history
     * @param {string} role - 'player' or 'void'
     * @param {string} content - Message content
     */
    addMessage(role, content) {
        const mem = this.load();
        if (!mem.conversationHistory) {
            mem.conversationHistory = [];
        }
        mem.conversationHistory.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        // Keep only last 100 messages to prevent storage bloat
        if (mem.conversationHistory.length > 100) {
            mem.conversationHistory = mem.conversationHistory.slice(-100);
        }
        this.save();
    },

    /**
     * Clears conversation history
     */
    clearHistory() {
        const mem = this.load();
        mem.conversationHistory = [];
        this.save();
    },

    /**
     * Resets all Void memory to default state
     */
    reset() {
        this.data = null; // Clear cached data
        this.data = this.getDefaultMemory();
        this.save();
    }
};

// Make it global
window.VoidMemoryStore = VoidMemoryStore;

