/**
 * EquipmentValidator.js
 * Validates equipment and ability compatibility based on weapon types and character restrictions.
 */

const EquipmentValidator = {
    /**
     * Checks if an ability can be used with the current weapon and character.
     * @param {string} abilityId - Ability ID
     * @param {string} characterId - Character ID
     * @param {string|null} equippedWeaponId - Equipped weapon ID (null if no weapon)
     * @returns {boolean} - True if ability is valid
     */
    canUseAbility(abilityId, characterId, equippedWeaponId) {
        const ability = AbilityRegistry.get(abilityId);
        if (!ability) return false;
        
        const charDef = CharacterRegistry.get(characterId);
        if (!charDef) return false;
        
        // 1. Check character ability restrictions
        if (charDef.allowedAbilities !== null && !charDef.allowedAbilities.includes(abilityId)) {
            return false;
        }
        
        // 2. Check weapon type requirement
        if (ability.requiresWeaponType) {
            if (!equippedWeaponId) return false; // Need a weapon
            
            const weapon = EquipmentRegistry.get(equippedWeaponId);
            if (!weapon || weapon.weaponType !== ability.requiresWeaponType) {
                return false; // Weapon type doesn't match
            }
        }
        
        return true;
    },
    
    /**
     * Checks if a weapon can be equipped by a character.
     * @param {string} weaponId - Weapon ID
     * @param {string} characterId - Character ID
     * @returns {boolean} - True if weapon is valid
     */
    canEquipWeapon(weaponId, characterId) {
        const weapon = EquipmentRegistry.get(weaponId);
        if (!weapon || weapon.type !== 'weapon') return false;
        
        const charDef = CharacterRegistry.get(characterId);
        if (!charDef) return false;
        
        // Check character weapon type restrictions
        if (charDef.allowedWeaponTypes && !charDef.allowedWeaponTypes.includes(weapon.weaponType)) {
            return false;
        }
        
        return true;
    },
    
    /**
     * Gets all valid abilities for a character and weapon combination.
     * @param {string} characterId - Character ID
     * @param {string|null} equippedWeaponId - Equipped weapon ID (null if no weapon)
     * @param {string} slotType - Ability slot type ('primary', 'secondary', etc.)
     * @returns {Array<Object>} - Array of valid ability definitions
     */
    getValidAbilities(characterId, equippedWeaponId, slotType) {
        const charDef = CharacterRegistry.get(characterId);
        if (!charDef) return [];
        
        // Get all abilities of the requested slot type
        const allAbilities = AbilityRegistry.list().filter(a => a.type === slotType);
        
        // Filter by restrictions
        return allAbilities.filter(ability => {
            // Check character ability restrictions
            if (charDef.allowedAbilities !== null && !charDef.allowedAbilities.includes(ability.id)) {
                return false;
            }
            
            // Check weapon type requirement
            if (ability.requiresWeaponType) {
                if (!equippedWeaponId) return false; // Need a weapon
                
                const weapon = EquipmentRegistry.get(equippedWeaponId);
                if (!weapon || weapon.weaponType !== ability.requiresWeaponType) {
                    return false; // Weapon type doesn't match
                }
            }
            
            return true;
        });
    },
    
    /**
     * Gets all valid weapons for a character.
     * @param {string} characterId - Character ID
     * @returns {Array<Object>} - Array of valid weapon definitions
     */
    getValidWeapons(characterId) {
        const charDef = CharacterRegistry.get(characterId);
        if (!charDef) return [];
        
        const allWeapons = EquipmentRegistry.getByType('weapon');
        
        // Filter by character weapon type restrictions
        if (!charDef.allowedWeaponTypes) {
            return allWeapons; // No restrictions
        }
        
        return allWeapons.filter(weapon => {
            return charDef.allowedWeaponTypes.includes(weapon.weaponType);
        });
    }
};

