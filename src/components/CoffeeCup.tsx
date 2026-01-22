"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/three";

function Cup() {
    const group = useRef<THREE.Group>(null);
    const liquidMesh = useRef<THREE.Mesh>(null);
    const { viewport } = useThree();

    // Drag interaction state
    const [isDragging, setIsDragging] = useState(false);

    // Use springs for smooth movement
    const [{ pos }, api] = useSpring(() => ({
        pos: [0, 0, 0],
        config: { mass: 1, tension: 350, friction: 40 }
    }));

    const bind = useDrag(({ offset: [x, y], active, down }) => {
        setIsDragging(active);
        // Convert drag pixels to viewport units? 
        // The offset from useDrag is in pixels. We need to map to viewport.
        // Actually, useDrag gives us delta or movement. 
        // Let's use 'offset' which accumulates movement.

        // Simplification: map pixel movement to viewport units approx
        // Viewport width at z=0 is viewport.width
        const aspect = viewport.width / window.innerWidth;

        // Apply new position
        api.start({ pos: [x * aspect, -y * aspect, 0] });
        // Let's just follow mouse exactly when dragging?
    });

    // Physics state
    const lastPos = useRef(new THREE.Vector3(0, 0, 0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const velocity = useRef(new THREE.Vector3(0, 0, 0));

    // Liquid physics state (simulating a pendulum/spring)
    const liquidRotation = useRef(new THREE.Vector2(0, 0));
    const liquidAngularVelocity = useRef(new THREE.Vector2(0, 0));

    // Steam particles
    const steamSystem = useMemo(() => {
        const particles = [];
        for (let i = 0; i < 20; i++) {
            particles.push({
                pos: new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
                velocity: new THREE.Vector3(0, Math.random() * 0.01 + 0.005, 0),
                life: Math.random() * 100,
                maxLife: 100 + Math.random() * 50
            });
        }
        return particles;
    }, []);

    const steamRef = useRef<THREE.Points>(null);

    useFrame(() => {
        if (!group.current || !liquidMesh.current) return;

        // Get current position from the spring-animated group
        const currentPos = group.current.position.clone();

        // Calculate velocity for liquid physics based on actual movement
        const displacement = currentPos.clone().sub(lastPos.current);

        // Update last pos
        lastPos.current.copy(currentPos);

        // 2. Liquid Physics (Spring Simulation)
        const MOVEMENT_INFLUENCE = 3.5; // Increased sensitivity for small scale
        const DAMPING = 0.94;
        const STIFFNESS = 0.08;
        const MAX_TILT = 0.5;

        const forceX = -displacement.y * MOVEMENT_INFLUENCE;
        const forceZ = displacement.x * MOVEMENT_INFLUENCE;

        const extensionX = liquidRotation.current.x;
        const extensionY = liquidRotation.current.y;

        // Acceleration
        const accelX = forceX - STIFFNESS * extensionX - (1 - DAMPING) * liquidAngularVelocity.current.x;
        const accelY = forceZ - STIFFNESS * extensionY - (1 - DAMPING) * liquidAngularVelocity.current.y;

        // Integration
        liquidAngularVelocity.current.x += accelX;
        liquidAngularVelocity.current.y += accelY;

        liquidRotation.current.x += liquidAngularVelocity.current.x;
        liquidRotation.current.y += liquidAngularVelocity.current.y;

        // Clamp
        liquidRotation.current.x = THREE.MathUtils.clamp(liquidRotation.current.x, -MAX_TILT, MAX_TILT);
        liquidRotation.current.y = THREE.MathUtils.clamp(liquidRotation.current.y, -MAX_TILT, MAX_TILT);

        // Apply rotation
        // For a transparent cup, we want the liquid surface to try to stay horizontal world-wise.
        // Liquid mesh is child of Group. Group rotates.
        // Liquid rotation relative to Group = -Group Rotation + Slosh.

        // Convert slosh (liquidRotation) to be relative to world up.
        // Then apply inverse of group rotation.

        // Simplification: 
        // liquidMesh.rotation.x = (liquidRotation.current.x) - group.current.rotation.x;
        // liquidMesh.rotation.z = (liquidRotation.current.y) - group.current.rotation.z;
        // But we need to account for base geometry rotation [-Math.PI/2, 0, 0] of the cylinder? 
        // Wait, we changed geometry to be a vertical cylinder `cylinderGeometry args={[0.82, 0.62, 1.6, 30]}`.
        // So base rotation should be 0.

        liquidMesh.current.rotation.x = liquidRotation.current.x - group.current.rotation.x;
        liquidMesh.current.rotation.z = liquidRotation.current.y - group.current.rotation.z;

        // Tilt cup slightly when dragging
        // Only if dragging? Or always based on velocity?
        if (isDragging) {
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -displacement.x * 5, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, displacement.y * 5, 0.1);
        } else {
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        }

        // 3. Steam Update
        if (steamRef.current) {
            const positions = steamRef.current.geometry.attributes.position.array as Float32Array;

            steamSystem.forEach((p, i) => {
                p.life -= 1;
                p.pos.add(p.velocity);

                p.pos.x -= displacement.x * 0.5;
                p.pos.y -= displacement.y * 0.5;

                if (p.life <= 0) {
                    p.life = p.maxLife;
                    p.pos.set((Math.random() - 0.5) * 0.4 * 0.2, 0, (Math.random() - 0.5) * 0.4 * 0.2); // Scaled down emission area
                }

                positions[i * 3] = p.pos.x;
                positions[i * 3 + 1] = p.pos.y + 0.15; // Scaled down start height
                positions[i * 3 + 2] = p.pos.z;
            });

            steamRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    // Materials
    const plasticMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.3,
        transmission: 0.95,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0
    });

    const coffeeMaterial = new THREE.MeshStandardMaterial({
        color: "#301b0e",
        roughness: 0.4,
        metalness: 0.0,
        transparent: true,
        opacity: 0.95
    });

    // Scales
    const SCALE = 0.2; // 5x smaller

    return (
        // @ts-ignore
        <animated.group ref={group} position={pos} scale={SCALE} {...bind()} className="cursor-grab active:cursor-grabbing">
            {/* Cup Body - Venti Shape (Taller, tapered) */}
            {/* TopRadius=0.8, BottomRadius=0.6, Height=1.2 -> Scaled down locally or via group */}
            {/* Venti is approx 20oz. Taller and more tapered. */}
            {/* Top 3.5 inch, Bottom 2.4 inch, Height 6.6 inch */}
            <mesh material={plasticMaterial} position={[0, 0, 0]}>
                <cylinderGeometry args={[0.9, 0.65, 2.0, 32]} />
            </mesh>

            {/* No Handle for Venti cup usually */}

            {/* Liquid */}
            {/* Liquid geometric center needs to be offset so it sits at the bottom */}
            {/* Cup height 2.0. Bottom is at -1.0. */}
            {/* Liquid height 1.6. Half is 0.8. */}
            {/* So liquid center should be at -1.0 + 0.8 = -0.2. */}

            <group position={[0, -0.2, 0]}>
                <mesh ref={liquidMesh} material={coffeeMaterial}>
                    <cylinderGeometry args={[0.82, 0.62, 1.6, 30]} />
                </mesh>
            </group>

            {/* Steam */}
            <points ref={steamRef} position={[0, 1.2, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={steamSystem.length}
                        args={[new Float32Array(steamSystem.length * 3), 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    transparent
                    opacity={0.2}
                    size={0.5} // Scaled relative to group? No, points size is in pixels unless attenuation. 
                    // If size attenuation is on (default), it's in world units.
                    // World units 0.5 is huge if cup is 0.2.
                    sizeAttenuation={true}
                    color="#ffffff"
                    depthWrite={false}
                />
            </points>

            {/* Lid? Venti cups usually have lids. */}
            <mesh material={plasticMaterial} position={[0, 1.05, 0]}>
                <cylinderGeometry args={[0.92, 0.92, 0.1, 32]} />
            </mesh>

        </animated.group>
    );
}

export default function CoffeeCup() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none">
            <Canvas
                className="pointer-events-auto"
                camera={{ position: [0, 0, 5], fov: 45 }}
                eventSource={typeof document !== 'undefined' ? document.body : undefined}
                shadows
            >
                <ambientLight intensity={0.7} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <Environment preset="city" />
                <Cup />
                {/* Contact shadow needs to follow the cup? It's static at 0,-2. 
            If cup moves, shadow should move.
            We can put shadow in the cup group? No, shadow should be on 'floor'.
            But we don't have a floor. 
            Let's remove shadow for floating UI element feel or drag shadow with it.
            For now, remove static shadow as it looks weird if cup moves away.
         */}
            </Canvas>
        </div>
    );
}
