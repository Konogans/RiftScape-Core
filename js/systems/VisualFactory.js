/**
 * VisualFactory.js
 * Creates Three.js visuals from EntityRegistry definitions.
 * Centralizes visual creation logic out of entity classes.
 */

const VisualFactory = {
    /**
     * Create a mesh for an entity based on its definition
     */
    createEnemyMesh(def, x, z) {
        const scale = def.scale || 1.0;
        const visual = def.visual || {};
        
        // Geometry selection
        let geometry;
        switch (visual.shape) {
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.4 * scale, 12, 12);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.8 * scale, 8);
                break;
            default: // 'cube' or undefined
                geometry = new THREE.BoxGeometry(0.5 * scale, 0.8 * scale, 0.5 * scale);
        }
        
        // Material
        const material = PSXify(new THREE.MeshStandardMaterial({
            color: visual.color || def.color || 0xff4444,
            roughness: visual.roughness || 0.5,
            metalness: visual.metalness || 0.4,
            emissive: visual.emissive || def.emissive || 0x441111,
            emissiveIntensity: visual.emissiveIntensity || 0.3
        }));
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.4 * scale, z);
        mesh.castShadow = true;
        
        // Add eyes if defined
        if (visual.eyes !== false) {
            this.addEyes(mesh, scale, visual);
        }
        
        return { mesh, material, baseY: 0.4 * scale };
    },
    
    addEyes(mesh, scale, visual = {}) {
        const eyeSize = visual.eyeSize || 0.06;
        const eyeGeom = new THREE.SphereGeometry(eyeSize * scale, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ 
            color: visual.eyeColor || 0xffffff 
        });
        
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.12 * scale, 0.15 * scale, -0.25 * scale);
        mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.12 * scale, 0.15 * scale, -0.25 * scale);
        mesh.add(rightEye);
    },
    
    /**
     * Create a pickup mesh
     */
    createPickupMesh(def, x, z) {
        const scale = def.scale || 0.15;
        let geometry;
        
        switch (def.shape) {
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(scale);
                break;
            case 'tetrahedron':
                geometry = new THREE.TetrahedronGeometry(scale);
                break;
            default:
                geometry = new THREE.SphereGeometry(scale, 8, 8);
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.emissive,
            emissiveIntensity: def.emissiveIntensity || 0.5,
            roughness: 0.3,
            metalness: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.3, z);
        
        return { mesh, material, baseY: 0.3 };
    }
};

window.VisualFactory = VisualFactory;
