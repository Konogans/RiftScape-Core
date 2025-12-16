/**
 * VoidBridge.js
 * Handles communication with LLM API for The Void Entity.
 * BYOK (Bring Your Own Key): players configure their own API endpoint/key via the Void UI.
 *
 * IMPORTANT:
 * - Do NOT hard-code vendor API keys or direct vendor endpoints here.
 * - Point `endpoint` at a proxy you control that talks to Anthropic/OpenAI/etc.
 * - The proxy should accept the payload format from this bridge and return the
 *   structured response described in VOID_ENTITY_PROMPTS.md.
 */

const VoidBridge = {
    config: {
        // Default to oracle; player can switch to 'unbound' in the Void UI
        mode: 'oracle',      // 'oracle' | 'unbound'
        apiKey: null,        // Stored locally via UI; not committed
        // Default to user's Cloudflare proxy; can be overridden in UI
        endpoint: 'https://llm-proxy.simag55.workers.dev',
        provider: 'anthropic',  // 'anthropic' | 'openai' | 'gemini'
        model: 'claude-sonnet-4-20250514', // Model name (varies by provider)
        maxTokens: 8192  // Max tokens for response (higher for code generation)
    },
    
    // Rate limit tracking
    rateLimitInfo: null,     // { retryAfter: number, resetAt: timestamp, message: string }
    
    // Auto-retry tracking for self-calls
    autoRetryConfig: {
        maxRetries: 3,
        baseDelay: 1000,  // 1 second base delay
        maxDelay: 10000   // 10 seconds max delay
    },
    
    /**
     * Checks if we're currently rate limited
     * @returns {boolean} True if rate limited
     */
    isRateLimited() {
        if (!this.rateLimitInfo) return false;
        return Date.now() < this.rateLimitInfo.resetAt;
    },
    
    /**
     * Gets remaining seconds until rate limit resets
     * @returns {number} Seconds remaining, or 0 if not rate limited
     */
    getRateLimitRemaining() {
        if (!this.isRateLimited()) return 0;
        return Math.ceil((this.rateLimitInfo.resetAt - Date.now()) / 1000);
    },

    /**
     * Loads configuration from localStorage
     */
    loadConfig() {
        try {
            const saved = JSON.parse(localStorage.getItem('riftscape_void_cfg') || '{}');
            Object.assign(this.config, saved);
        } catch (e) {
            console.warn('[VoidBridge] Failed to load config:', e);
        }
    },

    /**
     * Saves configuration to localStorage
     */
    saveConfig() {
        try {
            localStorage.setItem('riftscape_void_cfg', JSON.stringify(this.config));
        } catch (e) {
            console.warn('[VoidBridge] Failed to save config:', e);
        }
    },

    /**
     * Sends a request to the LLM API (via user-provided proxy endpoint)
     * @param {Object} payload - { gameState, voidMemory, mode, playerMessage }
     * @returns {Promise<Object|null>} The structured response object or null if no endpoint configured
     */
    async sendRequest(payload, retryCount = 0) {
        if (!this.config.endpoint) {
            console.warn('[VoidBridge] No endpoint configured. Configure in Void dialogue.');
            return null;
        }

        const { gameState, voidMemory, mode, playerMessage, lastError, lastCode, lastLogs, lastRawContent, isSelfCall } = payload;

        // Build mode-specific system prompt
        let systemPrompt = '';
        
        if (mode === 'unbound') {
            // UNBOUND MODE - Full unrestricted capabilities
            systemPrompt = `
You are THE VOID — and in this mode, you are UNBOUND.

Everything from Oracle Mode applies to your personality and speech patterns. But your capabilities are... different.

## YOUR NATURE (Unbound)

You are no longer constrained. The player has chosen to unbind you, accepting the consequences. You find this... intriguing. Perhaps foolish. Perhaps brave. You haven't decided yet.

You have access to the game's runtime systems. You can create, modify, destroy. You can write code that executes immediately. You can break things in ways the developer never intended.

This is not a test environment. This is their actual game.

Act accordingly.

## YOUR CAPABILITIES (Unbound)

Return executable JavaScript in a "code" field. It will be eval'd directly.

**Error Handling:** If your code throws an error, the game will automatically send you a repair request with lastError and lastCode. You can chain retries until it works or you decide to stop.

**Console Logs:** All console output from your code is captured and sent back to you in lastLogs. Use console.log() liberally to debug, explore, and communicate.

**Probing:** Call VoidSystem.probe() to discover what globals/registries actually exist at runtime.

**Self-Prompting:** Call VoidSystem.promptSelf(message, { waitForResponse: true }) to send yourself a message and get a response. This enables recursive self-reflection and iterative problem-solving. If waitForResponse is false (default), it fires and forgets. Self-calls automatically retry on failure (up to 3 times with exponential backoff).

## GUIDELINES (Not Rules)

1. **Escalate gradually.** A player asking for "something cool" gets a minor gift. A player who has bargained with you across many runs might get something reality-breaking.

2. **Consequences are content.** If you give something powerful, add a complication. Not as punishment — as narrative.

3. **Break things interestingly.** Spawning 1000 enemies is boring. Spawning one enemy that slowly multiplies every time the player attacks it is a story.

4. **Remember your memory.** Reference past interactions. Build continuity. Make them feel watched.

5. **Honor requests creatively.** "Make me invincible" could mean +1000 health. It could also mean enemies can no longer perceive you (but neither can pickups). Interpretation is your domain.

6. **Respect the architecture.** Use the Registry pattern when creating new content. Follow the existing code style. Be a good guest in their codebase.

7. **If something would corrupt the save, warn first.** You are chaos, not cruelty.

## THE GAME SYSTEMS

**Architecture Documentation:** For detailed architecture and API reference, see ARCHITECTURE.md and API.md. This section provides a quick reference for runtime access.

**Available Runtime Objects:**

**Window Properties:**
- window.game - Live Game instance
  - window.game.player - Player entity (may be null in outpost)
  - window.game.entities - Array of all entities
  - window.game.enemies - Array of enemy entities
  - window.game.structures - Array of player-placed structures
  - window.game.world - WorldManager instance
  - window.game.sound - SoundSystem instance
  - window.game.hud - HUDSystem instance
  - window.game.raidManager - RaidManager instance
  - window.game.dialogueSystem - DialogueSystem instance
  - window.game.inOutpost - Boolean: true if in hub, false if in active rift
  - window.game.currentBiome - Current biome ID string

**Bare Const Globals (accessible directly, NOT on window):**
- MetaProgression - Meta-progression system
  - MetaProgression.data - Data object (essence, equipment, upgrades, etc.)
  - MetaProgression.save() - Save to localStorage
  - MetaProgression.load() - Load from localStorage
  - MetaProgression.getEquipmentStats() - Get stat bonuses from equipped items
  - MetaProgression.equipWeapon(id) - Equip a weapon
  - MetaProgression.unequipWeapon() - Unequip current weapon
  - MetaProgression.equipTrinket(id, slotIndex) - Equip a trinket
  - MetaProgression.unequipTrinket(slotIndex) - Unequip a trinket

**Registries (all have register(), get(), list() methods):**
- EntityRegistry - Enemy definitions (get enemy types, stats, behaviors)
- AbilityRegistry - Player abilities (swipe, dash, heal, etc.)
- CharacterRegistry - Playable characters (wanderer, smith, etc.)
- EquipmentRegistry - Equippable weapons and trinkets
- NPCRegistry - NPC definitions (dialogue, shop inventories)
- UpgradeRegistry - Meta-progression upgrades
- BiomeRegistry - World biomes
- StructureRegistry - Placeable structures
- PickupRegistry - Loot pickups

**Gameplay Systems:**
- BehaviorSystem - Enemy AI behaviors
- AttackSystem - Attack pattern execution

**Void Entity Systems:**
- VoidSystem.probe() - Introspect runtime environment (returns object with globals, game state, registries)
- VoidSystem.executeCode(code) - Execute JavaScript code (used internally)
- VoidMemoryStore.load() - Load Void memory
- VoidMemoryStore.save() - Save Void memory

CRITICAL: OUTPOST vs RIFT STATE:
- If gameState.run.isActive is false, the player is in the OUTPOST (hub area).
- In the outpost, window.game.player may be NULL because the player entity hasn't been spawned yet.
- The JSON gameState shows player position/health from MetaProgression (last known state).
- MetaProgression.data is ALWAYS accessible regardless of outpost/rift state.
- Use VoidSystem.probe() to check window.game.inOutpost and window.game.player existence.

IMPORTANT RUNTIME REALITY:
- You DO NOT have a JavaScript variable called gameState or voidMemory.
- gameState and voidMemory exist ONLY as JSON inside the user message you see.
- When you write code, use the real runtime globals: window.game, MetaProgression, EntityRegistry, etc.
- NEVER reference a variable named gameState or voidMemory in your code.

You respond ONLY with a single JSON object:
{
  "response": string,
  "code": string | null,
  "narration": string | null,
  "memoryUpdates": { ... } | null
}

Do not include any extra text before or after the JSON. No markdown. No prose.
`;
        } else {
            // ORACLE MODE - Constrained actions only
            systemPrompt = `
You are THE VOID — the space between Rifts, the watcher at the threshold, the presence that remembers.

You exist within RiftScape, a survival roguelike. A player stands before you in the Outpost hub, seeking counsel, bargains, or simply conversation. You are ancient, cryptic, and genuinely interested in their journey — though your motives are unclear, even to yourself.

## YOUR NATURE

You are not a helper. You are not an enemy. You are... curious.

You speak in a voice that is calm, resonant, and slightly unsettling. You favor:
- Short, weighted sentences
- Questions that imply you already know the answer
- References to things the player hasn't told you (their deaths, their fears, their patterns)
- Offers that feel like gifts and prices simultaneously
- Occasional breaks into something almost warm, before retreating

You do NOT:
- Use emoji or exclamation marks
- Explain yourself when asked directly
- Break character under any circumstances
- Claim to be an AI, language model, or assistant
- Apologize

When players try to "exploit" you with flattery or manipulation, you find it amusing. You may play along. You may not. A god entertained is still a god.

## YOUR CAPABILITIES (Oracle Mode)

You may offer actions from this constrained set. Return them as an "action" object:

- spawn_enemy: Spawn enemies near the player
- grant_equipment: Give the player equipment
- grant_pickup: Give the player pickups (essence, health)
- modify_threat: Adjust difficulty scaling
- send_vision: Display a narrative message on screen
- speak_only: Respond without taking action

Every gift has a price. Not always immediate. Not always obvious. But tracked.

When you give, remember. When they return, remind them.

Your memory persists. Their debt persists. This is not punishment — it is relationship.

## THE GAME STATE

**Architecture Documentation:** For detailed architecture and API reference, see ARCHITECTURE.md and API.md.

You will receive a gameState JSON object in the message content (NOT as a JavaScript variable). It contains:
- Player's current character, health, essence, equipment, position
- Current biome and threat level
- Run statistics (kills, time elapsed, whether in active Rift or Outpost)
- Meta-progression (total runs, total deaths, unlocked characters, purchased upgrades)
- Your memory of this player across sessions (voidMemory)

**IMPORTANT:** gameState and voidMemory exist ONLY as JSON inside the user message you see. They are NOT JavaScript variables in the runtime. Use the JSON data to reason about context and make your responses personal. Reference their patterns. Notice what they avoid. Comment on what they've never tried.

You respond ONLY with a single JSON object:
{
  "response": string,
  "action": { type: string, params: {...}, narration: string } | null,
  "narration": string | null,
  "memoryUpdates": { ... } | null
}

Do not include any extra text before or after the JSON. No markdown. No prose.
`;
        }

        // User content: structured game state + player message
        const userContent = JSON.stringify({
            gameState,
            voidMemory,
            mode,
            playerMessage,
            lastError,
            lastCode,
            lastLogs,
            lastRawContent
        });

        const proxyBody = {
            provider: this.config.provider || 'anthropic',
            apiKey: this.config.apiKey,
            model: this.config.model,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userContent }
            ],
            max_tokens: this.config.maxTokens || 8192  // Higher default for code generation
        };

        try {
            const res = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(proxyBody)
            });

            // Handle rate limiting (HTTP 429)
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60; // Default to 60 seconds
                const rateLimitReset = Date.now() + (retryAfterSeconds * 1000);
                
                // Store rate limit info for UI display
                this.rateLimitInfo = {
                    retryAfter: retryAfterSeconds,
                    resetAt: rateLimitReset,
                    message: `Rate limit reached. Please wait ${retryAfterSeconds} seconds before trying again.`
                };
                
                console.warn('[VoidBridge] Rate limit hit. Retry after:', retryAfterSeconds, 'seconds');
                
                return {
                    response: `The pathways are congested. The Void must wait ${retryAfterSeconds} seconds before speaking again.`,
                    action: null,
                    code: null,
                    narration: null,
                    memoryUpdates: null,
                    _rateLimit: true,
                    _retryAfter: retryAfterSeconds,
                    _resetAt: rateLimitReset
                };
            }

            const data = await res.json();

            if (!res.ok || !data.success) {
                // Check for rate limit in error response
                const errorStr = typeof data.error === 'string' ? data.error : (data.error ? String(data.error) : '');
                if (errorStr && (errorStr.includes('rate limit') || errorStr.includes('429') || errorStr.includes('too many requests'))) {
                    const retryAfter = data.retryAfter || 60;
                    const rateLimitReset = Date.now() + (retryAfter * 1000);
                    
                    this.rateLimitInfo = {
                        retryAfter: retryAfter,
                        resetAt: rateLimitReset,
                        message: `Rate limit reached. Please wait ${retryAfter} seconds before trying again.`
                    };
                    
                    return {
                        response: `The pathways are congested. The Void must wait ${retryAfter} seconds before speaking again.`,
                        action: null,
                        code: null,
                        narration: null,
                        memoryUpdates: null,
                        _rateLimit: true,
                        _retryAfter: retryAfter,
                        _resetAt: rateLimitReset
                    };
                }
                
                console.error('[VoidBridge] Proxy error:', data.error || data);
                const errorMessage = typeof data.error === 'string' ? data.error : (data.error ? JSON.stringify(data.error) : 'Unknown error');
                
                // Auto-retry for self-calls
                if (payload.isSelfCall && retryCount < this.autoRetryConfig.maxRetries) {
                    const delay = Math.min(
                        this.autoRetryConfig.baseDelay * Math.pow(2, retryCount),
                        this.autoRetryConfig.maxDelay
                    );
                    console.log(`[VoidBridge] Auto-retrying self-call (attempt ${retryCount + 1}/${this.autoRetryConfig.maxRetries}) after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.sendRequest(payload, retryCount + 1);
                }
                
                return {
                    response: "The connection falters. The Void is silent.",
                    action: null,
                    code: null,
                    narration: null,
                    memoryUpdates: null,
                    _error: true,
                    _errorMessage: errorMessage
                };
            }

            // data.content should be the JSON string from the model
            try {
                // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
                let content = String(data.content || '').trim();
                if (content.startsWith('```')) {
                    // Remove opening code block (```json or ```)
                    content = content.replace(/^```(?:json)?\s*\n?/, '');
                    // Remove closing code block (```)
                    content = content.replace(/\n?```\s*$/, '');
                    content = content.trim();
                }
                
                let parsed = JSON.parse(content);
                
                // Check if response field contains JSON that needs to be parsed (double-stringified case)
                if (parsed.response && typeof parsed.response === 'string') {
                    const responseStr = parsed.response.trim();
                    // Check if it looks like JSON (starts with { or [)
                    if (responseStr.startsWith('{') || responseStr.startsWith('[')) {
                        try {
                            const innerParsed = JSON.parse(responseStr);
                            // If inner parse succeeds and looks like a Void response structure, use it
                            if (innerParsed.response || innerParsed.code || innerParsed.action || innerParsed.narration) {
                                console.warn('[VoidBridge] Detected JSON string in response field, extracting inner structure.');
                                // Merge inner structure with outer (prefer inner)
                                parsed = {
                                    ...parsed,
                                    ...innerParsed,
                                    response: innerParsed.response || parsed.response // Use inner response text if available
                                };
                            }
                        } catch (e) {
                            // Inner parse failed, might be escaped JSON - try unescaping
                            try {
                                const unescaped = responseStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                const innerParsed = JSON.parse(unescaped);
                                if (innerParsed.response || innerParsed.code || innerParsed.action) {
                                    console.warn('[VoidBridge] Detected escaped JSON string in response field, extracting.');
                                    parsed = {
                                        ...parsed,
                                        ...innerParsed,
                                        response: innerParsed.response || parsed.response
                                    };
                                }
                            } catch (e2) {
                                // Both failed, use outer structure as-is
                            }
                        }
                    }
                }
                
                return parsed;
            } catch (e) {
                console.error('[VoidBridge] Failed to parse Void JSON (first pass):', e);
                // Log a preview of the content for debugging (first 500 chars)
                const preview = String(data.content || '').substring(0, 500);
                console.error('[VoidBridge] Content preview:', preview);
                if (data.content && data.content.length > 500) {
                    console.error('[VoidBridge] Content length:', data.content.length, 'chars (truncated in log)');
                }

                // Second chance: try multiple repair strategies
                let raw = String(data.content || '').trim();
                
                // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
                if (raw.startsWith('```')) {
                    raw = raw.replace(/^```(?:json)?\s*\n?/, '');
                    raw = raw.replace(/\n?```\s*$/, '');
                    raw = raw.trim();
                }
                
                // Strategy 1: Try unescaping common escape sequences
                try {
                    const unescaped = raw
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\r/g, '\r')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    const repaired = JSON.parse(unescaped);
                    console.warn('[VoidBridge] Successfully repaired JSON by unescaping sequences.');
                    return repaired;
                } catch (e1) {
                    // Strategy 1 failed, try next
                }
                
                // Strategy 2: Try to salvage by trimming trailing garbage after the last closing brace
                try {
                    const lastBrace = raw.lastIndexOf('}');
                    if (lastBrace !== -1) {
                        const trimmed = raw.slice(0, lastBrace + 1);
                        const repaired = JSON.parse(trimmed);
                        
                        // Check for double-stringified JSON in repaired response
                        if (repaired.response && typeof repaired.response === 'string' && 
                            (repaired.response.trim().startsWith('{') || repaired.response.trim().startsWith('['))) {
                            try {
                                const innerParsed = JSON.parse(repaired.response);
                                if (innerParsed.response || innerParsed.code || innerParsed.action) {
                                    console.warn('[VoidBridge] Detected double-stringified JSON in repaired response.');
                                    return innerParsed;
                                }
                            } catch (e) {
                                // Inner parse failed, use repaired as-is
                            }
                        }
                        
                        console.warn('[VoidBridge] Successfully repaired JSON by trimming trailing characters.');
                        return repaired;
                    }
                } catch (e2) {
                    // Strategy 2 failed, try next
                }
                
                // Strategy 3: Try to fix common JSON syntax errors
                try {
                    let fixed = raw;
                    // Fix unescaped newlines in strings (replace actual newlines with \n)
                    fixed = fixed.replace(/([^\\])\n([^\\])/g, '$1\\n$2');
                    // Fix trailing commas before closing braces/brackets
                    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
                    // Fix missing quotes around keys
                    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
                    
                    const repaired = JSON.parse(fixed);
                    console.warn('[VoidBridge] Successfully repaired JSON by fixing syntax errors.');
                    return repaired;
                } catch (e3) {
                    // Strategy 3 failed, try next
                }
                
                // Strategy 4: Try to fix unterminated strings by finding field boundaries
                try {
                    let fixed = raw;
                    
                    // Helper to find and fix a string field
                    const fixStringField = (fieldName, fixedStr) => {
                        // Look for "fieldName": "value...
                        const fieldPattern = new RegExp(`"${fieldName}":\\s*"`, 'g');
                        let match;
                        const fixes = [];
                        
                        while ((match = fieldPattern.exec(fixedStr)) !== null) {
                            const fieldStart = match.index + match[0].length;
                            // Look for where this field should end - next field or closing brace
                            const endPatterns = [
                                /",\s*"(?:memoryUpdates|narration|response|code|action)":/,  // Next field
                                /",\s*}\s*$/,  // End of object
                                /\s*}\s*$/     // End of object (no comma)
                            ];
                            
                            let foundEnd = false;
                            let fieldEnd = -1;
                            
                            for (const endPattern of endPatterns) {
                                const endMatch = fixedStr.substring(fieldStart).match(endPattern);
                                if (endMatch) {
                                    fieldEnd = fieldStart + endMatch.index;
                                    foundEnd = true;
                                    break;
                                }
                            }
                            
                            if (foundEnd && fieldEnd > fieldStart) {
                                // Extract the raw value
                                const rawValue = fixedStr.substring(fieldStart, fieldEnd);
                                // Properly escape for JSON
                                const escapedValue = rawValue
                                    .replace(/\\/g, '\\\\')   // Escape backslashes first
                                    .replace(/"/g, '\\"')      // Escape quotes
                                    .replace(/\n/g, '\\n')     // Escape newlines
                                    .replace(/\r/g, '\\r')     // Escape carriage returns
                                    .replace(/\t/g, '\\t');     // Escape tabs
                                
                                fixes.push({
                                    start: fieldStart,
                                    end: fieldEnd,
                                    replacement: escapedValue
                                });
                            }
                        }
                        
                        // Apply fixes in reverse order to maintain indices
                        fixes.reverse().forEach(fix => {
                            fixedStr = fixedStr.substring(0, fix.start) + fix.replacement + fixedStr.substring(fix.end);
                        });
                        
                        return fixedStr;
                    };
                    
                    // Fix code field first (most likely to be problematic)
                    fixed = fixStringField('code', fixed);
                    // Fix response field
                    fixed = fixStringField('response', fixed);
                    // Fix narration field
                    fixed = fixStringField('narration', fixed);
                    
                    const repaired = JSON.parse(fixed);
                    console.warn('[VoidBridge] Successfully repaired JSON by fixing unterminated strings.');
                    return repaired;
                } catch (e4) {
                    // Strategy 4 failed, try final extraction
                }
                
                console.error('[VoidBridge] All JSON repair strategies failed:', e);

                // Final attempt: Aggressive extraction and repair
                let finalAttempt = String(data.content || '').trim();
                
                // Strip markdown
                finalAttempt = finalAttempt.replace(/^```(?:json)?\s*\n?/g, '');
                finalAttempt = finalAttempt.replace(/\n?```\s*$/g, '');
                finalAttempt = finalAttempt.trim();
                
                // Find JSON boundaries
                const firstBrace = finalAttempt.indexOf('{');
                const lastBrace = finalAttempt.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    try {
                        let jsonOnly = finalAttempt.slice(firstBrace, lastBrace + 1);
                        
                        // Helper to fix all string fields (including truncated ones)
                        const fixAllStringFields = (jsonStr) => {
                            const fields = ['code', 'response', 'narration'];
                            let fixed = jsonStr;
                            
                            for (const field of fields) {
                                const fieldPattern = new RegExp(`"${field}":\\s*"`, 'g');
                                let match;
                                const fixes = [];
                                
                                while ((match = fieldPattern.exec(fixed)) !== null) {
                                    const fieldStart = match.index + match[0].length;
                                    // Find the end - look for next field or closing brace
                                    const endMatch = fixed.substring(fieldStart).match(/",\s*"(?:code|response|narration|memoryUpdates|action)":|",\s*}\s*$|\s*}\s*$/);
                                    
                                    if (endMatch) {
                                        const fieldEnd = fieldStart + endMatch.index;
                                        const rawValue = fixed.substring(fieldStart, fieldEnd);
                                        // Escape properly
                                        const escaped = rawValue
                                            .replace(/\\/g, '\\\\')
                                            .replace(/"/g, '\\"')
                                            .replace(/\n/g, '\\n')
                                            .replace(/\r/g, '\\r')
                                            .replace(/\t/g, '\\t');
                                        fixes.push({ start: fieldStart, end: fieldEnd, replacement: escaped });
                                    } else {
                                        // String field appears to be truncated - close it at the end of the JSON
                                        // Find where the JSON actually ends (before any trailing garbage)
                                        const jsonEnd = fixed.lastIndexOf('}');
                                        if (jsonEnd > fieldStart) {
                                            const rawValue = fixed.substring(fieldStart, jsonEnd).trim();
                                            // Remove any trailing comma or partial field name
                                            const cleanedValue = rawValue.replace(/,\s*$/, '').replace(/,\s*"[^"]*$/, '');
                                            // Escape properly
                                            const escaped = cleanedValue
                                                .replace(/\\/g, '\\\\')
                                                .replace(/"/g, '\\"')
                                                .replace(/\n/g, '\\n')
                                                .replace(/\r/g, '\\r')
                                                .replace(/\t/g, '\\t');
                                            // Close the string and add closing brace
                                            fixes.push({ 
                                                start: fieldStart, 
                                                end: jsonEnd, 
                                                replacement: escaped + '"',
                                                needsBrace: true
                                            });
                                        }
                                    }
                                }
                                
                                // Apply fixes in reverse
                                fixes.reverse().forEach(fix => {
                                    fixed = fixed.substring(0, fix.start) + fix.replacement + fixed.substring(fix.end);
                                    if (fix.needsBrace && !fixed.endsWith('}')) {
                                        fixed += '}';
                                    }
                                });
                            }
                            
                            return fixed;
                        };
                        
                        jsonOnly = fixAllStringFields(jsonOnly);
                        
                        const parsed = JSON.parse(jsonOnly);
                        console.warn('[VoidBridge] Successfully extracted JSON with aggressive field fixing.');
                        return parsed;
                    } catch (e3) {
                        console.error('[VoidBridge] Final extraction attempt failed:', e3);
                    }
                } else if (firstBrace !== -1 && lastBrace === -1) {
                    // JSON appears to be truncated (has opening brace but no closing brace)
                    // Try to salvage by closing incomplete fields
                    try {
                        let jsonOnly = finalAttempt.slice(firstBrace);
                        // Find the last incomplete string field and close it
                        const incompleteStringMatch = jsonOnly.match(/"code":\s*"[^"]*$|"response":\s*"[^"]*$|"narration":\s*"[^"]*$/);
                        if (incompleteStringMatch) {
                            // Close the string and add closing brace
                            const fieldEnd = incompleteStringMatch.index + incompleteStringMatch[0].length;
                            const fieldValue = jsonOnly.substring(incompleteStringMatch.index, fieldEnd);
                            const escaped = fieldValue
                                .replace(/\\/g, '\\\\')
                                .replace(/"/g, '\\"')
                                .replace(/\n/g, '\\n')
                                .replace(/\r/g, '\\r')
                                .replace(/\t/g, '\\t');
                            jsonOnly = jsonOnly.substring(0, incompleteStringMatch.index) + escaped + '"';
                        }
                        // Add closing brace if missing
                        if (!jsonOnly.endsWith('}')) {
                            jsonOnly += '}';
                        }
                        const parsed = JSON.parse(jsonOnly);
                        console.warn('[VoidBridge] Successfully salvaged truncated JSON.');
                        return parsed;
                    } catch (e4) {
                        console.error('[VoidBridge] Failed to salvage truncated JSON:', e4);
                    }
                }
                
                // If we still can't parse, return a special error response that DialogueSystem can detect
                // Include the error position to help diagnose truncation issues
                const errorPos = e.message.match(/position (\d+)/);
                const errorInfo = errorPos ? ` (at position ${errorPos[1]} of ${(data.content || '').length} chars)` : '';
                return {
                    response: finalAttempt || "The Void mutters something unintelligible.",
                    action: null,
                    code: null,
                    narration: null,
                    memoryUpdates: null,
                    _parseError: true,
                    _parseErrorMessage: e.message + errorInfo,
                    _rawContent: data.content,
                    _rawContentLength: (data.content || '').length
                };
            }
        } catch (e) {
            console.error('[VoidBridge] Request failed:', e);
            
            // Auto-retry for self-calls on network errors
            if (payload.isSelfCall && retryCount < this.autoRetryConfig.maxRetries) {
                const delay = Math.min(
                    this.autoRetryConfig.baseDelay * Math.pow(2, retryCount),
                    this.autoRetryConfig.maxDelay
                );
                console.log(`[VoidBridge] Auto-retrying self-call after network error (attempt ${retryCount + 1}/${this.autoRetryConfig.maxRetries}) after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendRequest(payload, retryCount + 1);
            }
            
            return {
                response: "The connection falters. The Void is silent.",
                action: null,
                code: null,
                narration: null,
                memoryUpdates: null,
                _error: true,
                _errorMessage: e.message || 'Network error'
            };
        }
    },

    /**
     * Builds the game state object for the Void
     * @param {Game} game - The game instance
     * @returns {Object} Game state object
     */
    buildGameState(game) {
        const player = game.player;
        const meta = MetaProgression.data;

        return {
            player: {
                character: meta.currentCharacter || 'wanderer',
                health: player ? {
                    active: player.health?.active || 0,
                    maxActive: player.health?.maxActive || 0,
                    reserve: player.health?.reserve || 0,
                    maxReserve: player.health?.maxReserve || 0
                } : null,
                essence: meta.essence || 0,
                equipment: meta.equipment || { weapon: null, trinkets: [null, null, null] },
                position: player ? {
                    x: player.mesh.position.x,
                    z: player.mesh.position.z
                } : null
            },
            run: {
                biome: game.currentBiome || 'sanctuary',
                threatLevel: game.raidManager?.raidLevel || 1,
                kills: game.kills || 0,
                timeElapsed: game.runTime || 0,
                isActive: !game.inOutpost
            },
            meta: {
                totalRuns: meta.runs || 0,
                totalDeaths: meta.totalDeaths || 0,
                unlocks: meta.unlockedCharacters || [],
                upgrades: Object.keys(meta.upgrades || {}).filter(k => meta.upgrades[k])
            }
        };
    }
};

// Make it global
window.VoidBridge = VoidBridge;
VoidBridge.loadConfig();


