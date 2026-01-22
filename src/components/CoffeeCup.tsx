"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/three";

// Constant for drop count
const MAX_DROPS = 1000;
const GRAVITY = -25.0; // Stronger gravity for cup fall
const SCALE = 0.2;

function CupAndSpills() {
    const group = useRef<THREE.Group>(null);
    const liquidMesh = useRef<THREE.Mesh>(null);
    const dropsRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const { viewport, size } = useThree();

    // Home Position (Top Right)
    const homePos = useMemo(() => new THREE.Vector3(
        viewport.width / 2 - 1.2,
        viewport.height / 2 - 1.5,
        0
    ), [viewport]);

    // States
    const [isDragging, setIsDragging] = useState(false);
    const [isDocked, setIsDocked] = useState(true);

    // Physics Refs
    const cupVelocity = useRef(new THREE.Vector3(0, 0, 0));
    const cupPosition = useRef(homePos.clone());

    // Spring
    const [{ pos }, api] = useSpring(() => ({
        pos: [homePos.x, homePos.y, 0],
        config: { mass: 1, tension: 350, friction: 30 }
    }));

    // Update spring to home when viewport changes (resizing) if docked
    useEffect(() => {
        if (isDocked) {
            api.start({ pos: [homePos.x, homePos.y, 0], immediate: false });
            cupPosition.current.copy(homePos);
        }
    }, [homePos, isDocked, api]);

    const bind = useDrag(({ xy: [cx, cy], active, last }) => {
        // Map Mouse to World
        // cx is 0..windowWidth, cy is 0..windowHeight
        // viewport.width is world width at z=0

        // Convert to NDC (-1 to 1)
        const nX = (cx / size.width) * 2 - 1;
        const nY = -(cy / size.height) * 2 + 1;

        const wx = (nX * viewport.width) / 2;
        const wy = (nY * viewport.height) / 2;

        if (active) {
            setIsDragging(true);
            setIsDocked(false);
            // Direct control
            api.start({ pos: [wx, wy, 0], immediate: true });
            cupPosition.current.set(wx, wy, 0);
            cupVelocity.current.set(0, 0, 0);
        } else if (last) {
            setIsDragging(false);
            // Check docking
            const dist = cupPosition.current.distanceTo(homePos);
            if (dist < 2.5) { // Threshold
                setIsDocked(true);
                api.start({ pos: [homePos.x, homePos.y, 0] });
                cupPosition.current.copy(homePos);
            } else {
                setIsDocked(false);
                // Initiate fall - maybe give it a slight toss velocity?
                // For now, simple drop (0 velocity)
                cupVelocity.current.set(0, 0, 0);
            }
        }
    }, {
        // options
    });

    // Physics state for liquid slosh
    const lastPos = useRef(new THREE.Vector3(0, 0, 0));
    const liquidRotation = useRef(new THREE.Vector2(0, 0));
    const liquidAngularVelocity = useRef(new THREE.Vector2(0, 0));

    // Drops
    const drops = useMemo(() => {
        return new Array(MAX_DROPS).fill(0).map(() => ({
            position: new THREE.Vector3(0, -100, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            life: 0,
            active: false
        }));
    }, []);

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

    useFrame((state, delta) => {
        if (!group.current || !liquidMesh.current) return;

        // --- 0. Falling Physics ---
        if (!isDocked && !isDragging) {
            // Apply Gravity to cup
            cupVelocity.current.y += GRAVITY * delta;
            cupPosition.current.add(cupVelocity.current.clone().multiplyScalar(delta));

            // Update visual position via spring API (immediate for physics)
            api.set({ pos: [cupPosition.current.x, cupPosition.current.y, cupPosition.current.z] });

            // Clean up if far off screen
            if (cupPosition.current.y < -viewport.height) {
                // maybe reset or just leave it gone? 
                // "fall off the screen" implies gone. 
            }
        }

        // --- 1. Cup & Liquid Force Calculation ---
        // Read current world position from ref (synced via drag or physics)
        // Note: group.current.position might lag if driven by spring? 
        // We are setting spring immmediate in drag/physics, so cupPosition.current is ground truth
        const currentPos = cupPosition.current.clone();

        // We use actual group position for displacement for liquid?
        // Actually using our physics 'currentPos' is more stable than asking the mesh
        const displacement = currentPos.clone().sub(lastPos.current);
        lastPos.current.copy(currentPos);

        // Liquid Physics (Spring Simulation)
        const MOVEMENT_INFLUENCE = 4.0;
        const DAMPING = 0.94;
        const STIFFNESS = 0.08;
        const MAX_TILT = 0.7;

        const forceX = -displacement.y * MOVEMENT_INFLUENCE;
        const forceZ = displacement.x * MOVEMENT_INFLUENCE;

        const extensionX = liquidRotation.current.x;
        const extensionY = liquidRotation.current.y;

        const accelX = forceX - STIFFNESS * extensionX - (1 - DAMPING) * liquidAngularVelocity.current.x;
        const accelY = forceZ - STIFFNESS * extensionY - (1 - DAMPING) * liquidAngularVelocity.current.y;

        liquidAngularVelocity.current.x += accelX;
        liquidAngularVelocity.current.y += accelY;

        liquidRotation.current.x += liquidAngularVelocity.current.x;
        liquidRotation.current.y += liquidAngularVelocity.current.y;

        // Clamp slosh
        liquidRotation.current.x = THREE.MathUtils.clamp(liquidRotation.current.x, -MAX_TILT, MAX_TILT);
        liquidRotation.current.y = THREE.MathUtils.clamp(liquidRotation.current.y, -MAX_TILT, MAX_TILT);

        liquidMesh.current.rotation.x = liquidRotation.current.x - group.current.rotation.x;
        liquidMesh.current.rotation.z = liquidRotation.current.y - group.current.rotation.z;

        // Cup Tilt
        if (isDragging) {
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -displacement.x * 8, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, displacement.y * 8, 0.1);
        } else {
            // Allow free rotation if falling? or stabilize?
            // Let's stabilize to zero
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        }

        // --- 2. Spilling Logic ---
        const cupUp = new THREE.Vector3(0, 1, 0);
        cupUp.applyEuler(group.current.rotation);
        const tiltAngle = cupUp.angleTo(new THREE.Vector3(0, 1, 0));
        const SPILL_THRESHOLD = 0.5;

        if (tiltAngle > SPILL_THRESHOLD && dropsRef.current) {
            const worldDown = new THREE.Vector3(0, -1, 0);
            const localDown = worldDown.clone().applyQuaternion(group.current.quaternion.clone().invert());
            const rimDir = new THREE.Vector2(localDown.x, localDown.z).normalize();
            const localSpawnPos = new THREE.Vector3(rimDir.x * 0.9, 1.0, rimDir.y * 0.9);
            const worldSpawnPos = localSpawnPos.clone().applyMatrix4(group.current.matrixWorld);
            const flowDir = worldSpawnPos.clone().sub(currentPos).normalize();
            const spawnCount = Math.floor((tiltAngle - SPILL_THRESHOLD) * 5) + 1;

            let spawned = 0;
            for (let i = 0; i < MAX_DROPS && spawned < spawnCount; i++) {
                if (!drops[i].active) {
                    drops[i].active = true;
                    drops[i].life = 100;
                    drops[i].position.copy(worldSpawnPos);
                    drops[i].position.x += (Math.random() - 0.5) * 0.05;
                    drops[i].position.z += (Math.random() - 0.5) * 0.05;
                    drops[i].velocity.set(
                        flowDir.x * 0.2 + displacement.x * 10,
                        displacement.y * 10,
                        flowDir.z * 0.2
                    );
                    spawned++;
                }
            }
        }

        // Update Drops
        if (dropsRef.current) {
            // ... (Update logic same as before, just needs to be inside loop)
            // Optimization: Use same loop
            const dummyScale = new THREE.Vector3(0.05, 0.05, 0.05);
            for (let i = 0; i < MAX_DROPS; i++) {
                const d = drops[i];
                if (d.active) {
                    d.velocity.y += -18.0 * delta * 0.5; // Gravity for drops
                    d.position.add(d.velocity.clone().multiplyScalar(delta));

                    if (d.position.y < -10) {
                        d.active = false;
                        d.position.set(0, -100, 0);
                        dummy.position.copy(d.position);
                        dummy.updateMatrix();
                        dropsRef.current.setMatrixAt(i, dummy.matrix);
                    } else {
                        dummy.position.copy(d.position);
                        dummy.scale.copy(dummyScale);
                        dummy.updateMatrix();
                        dropsRef.current.setMatrixAt(i, dummy.matrix);
                    }
                } else {
                    // Should hide? 
                    // If we didn't update inactive ones in a frame, they stay where they were (hidden)
                    // But we need to setMatrixAt once for initialization or perform full update
                    // Since we fill array with Matrix, we assume initial state hidden.
                }
            }
            dropsRef.current.instanceMatrix.needsUpdate = true;
        }

        // --- 3. Steam Update ---
        if (steamRef.current) {
            const positions = steamRef.current.geometry.attributes.position.array as Float32Array;
            steamSystem.forEach((p, i) => {
                p.life -= 1;
                p.pos.add(p.velocity);
                p.pos.x -= displacement.x * 0.5;
                p.pos.y -= displacement.y * 0.5;
                if (p.life <= 0) {
                    p.life = p.maxLife;
                    p.pos.set((Math.random() - 0.5) * 0.4 * 0.2, 0, (Math.random() - 0.5) * 0.4 * 0.2);
                }
                positions[i * 3] = p.pos.x;
                positions[i * 3 + 1] = p.pos.y + 0.15;
                positions[i * 3 + 2] = p.pos.z;
            });
            steamRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    const plasticMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 0.95,
        opacity: 1,
        transparent: true,
        roughness: 0.1,
        metalness: 0,
        ior: 1.5,
        thickness: 0.1,
        side: THREE.DoubleSide
    });

    const coffeeMaterial = new THREE.MeshStandardMaterial({
        color: "#24130a",
        roughness: 0.2,
        metalness: 0.0,
        transparent: true,
        opacity: 0.95
    });

    const dropMaterial = new THREE.MeshStandardMaterial({
        color: "#24130a",
        roughness: 0.1,
        metalness: 0
    });

    return (
        <>
            {/* @ts-ignore */}
            <animated.group ref={group} position={pos} scale={SCALE} {...bind()} className="cursor-grab active:cursor-grabbing">
                <mesh material={plasticMaterial}>
                    <cylinderGeometry args={[0.9, 0.65, 2.0, 32, 1, false]} />
                </mesh>
                <mesh material={plasticMaterial} position={[0, 1.05, 0]}>
                    <cylinderGeometry args={[0.92, 0.92, 0.1, 32]} />
                </mesh>
                <group position={[0, -0.2, 0]}>
                    <mesh ref={liquidMesh} material={coffeeMaterial}>
                        <cylinderGeometry args={[0.82, 0.62, 1.6, 30]} />
                    </mesh>
                </group>
                <points ref={steamRef} position={[0, 1.2, 0]}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={steamSystem.length}
                            args={[new Float32Array(steamSystem.length * 3), 3]}
                        />
                    </bufferGeometry>
                    <pointsMaterial
                        transparent opacity={0.2} size={0.5} sizeAttenuation={true} color="#ffffff" depthWrite={false}
                    />
                </points>
            </animated.group>

            <instancedMesh ref={dropsRef} args={[undefined, undefined, MAX_DROPS]}>
                <sphereGeometry args={[1, 8, 8]} />
                <primitive object={dropMaterial} attach="material" />
            </instancedMesh>
        </>
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
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.7} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <Environment preset="city" />
                <CupAndSpills />
            </Canvas>
        </div>
    );
}
