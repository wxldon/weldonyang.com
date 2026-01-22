"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/three";

// Constant for drop count
const MAX_DROPS = 1000;
const GRAVITY = -18.0; // Slightly higher gravity for feel
const SCALE = 0.2; // 5x smaller

function CupAndSpills() {
    const group = useRef<THREE.Group>(null);
    const liquidMesh = useRef<THREE.Mesh>(null);
    const dropsRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const { viewport } = useThree();

    // Drag interaction state
    const [isDragging, setIsDragging] = useState(false);

    // Use springs for smooth movement
    const [{ pos }, api] = useSpring(() => ({
        pos: [0, 0, 0],
        config: { mass: 1, tension: 350, friction: 40 }
    }));

    const bind = useDrag(({ offset: [x, y], active }) => {
        setIsDragging(active);
        const aspect = viewport.width / window.innerWidth;
        api.start({ pos: [x * aspect, -y * aspect, 0] });
    }, {
        // No offset config
    });

    // Physics state for liquid slosh
    const lastPos = useRef(new THREE.Vector3(0, 0, 0));
    const liquidRotation = useRef(new THREE.Vector2(0, 0));
    const liquidAngularVelocity = useRef(new THREE.Vector2(0, 0));

    // Particle System State
    // We need a stable array to track life/velocity of drops
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

        // --- 1. Cup & Liquid Physics ---

        // Get current position (updates from spring are applied by react-spring to the group)
        // Note: group.current.position is animated by spring? 
        // Wait, useSpring applies to the `animated.group`.
        // We can read the values from the spring or just read the object position.

        // Calculate velocity for liquid physics
        // We need world position of the cup group to calculate velocity?
        // The group's position is local to its parent (Scene).
        const currentPos = group.current.position.clone();
        const displacement = currentPos.clone().sub(lastPos.current);
        lastPos.current.copy(currentPos);

        // Liquid Physics (Spring Simulation)
        const MOVEMENT_INFLUENCE = 4.0;
        const DAMPING = 0.94;
        const STIFFNESS = 0.08;
        const MAX_TILT = 0.7;

        // Moving Right (+x) -> Force tilts liquid Left (+z rot). 
        // Moving Up (+y) -> Force tilts liquid Down (+x rot).
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

        // Apply rotation stabilization + slosh
        // Relative to cup: -CupRot + Slosh
        liquidMesh.current.rotation.x = liquidRotation.current.x - group.current.rotation.x;
        liquidMesh.current.rotation.z = liquidRotation.current.y - group.current.rotation.z;

        // Cup Tilt based on drag
        if (isDragging) {
            // More tilt = more spill fun
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -displacement.x * 8, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, displacement.y * 8, 0.1);
        } else {
            group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        }

        // --- 2. Spilling Logic ---

        // Determine Spill
        // We spill if the cup is tilted significantly.
        // Calculate total tilt angle from up vector.
        const cupUp = new THREE.Vector3(0, 1, 0);
        // Apply cup rotation to up vector
        cupUp.applyEuler(group.current.rotation);
        // Angle between cup up and world up (0,1,0)
        const tiltAngle = cupUp.angleTo(new THREE.Vector3(0, 1, 0));

        const SPILL_THRESHOLD = 0.5; // ~30 degrees start spilling

        if (tiltAngle > SPILL_THRESHOLD && dropsRef.current) {
            // Spawn drops
            // We need the lowest point on the rim in world space.
            // Rim is circle radius ~0.9 (scaled 0.2 -> 0.18) at Y ~1.0 (scaled -> 0.2).

            // Find direction of tilt in XZ plane
            // The liquid "low point" is roughly opposite to the Up-vector projected on XZ.
            // Or simpler: The direction the cup is tilting TOWARDS.

            // Let's use the Down vector of the cup projected on local rim?
            // Actually, just find the vertex on the rim that has the lowest World Y.

            // Rim center in local
            // Finding lowest point:
            // The cup 'Down' vector (0, -1, 0) in world space is what we want? No, that's bottom.
            // We want the point on the rim circle.
            // Vector pointing to lowest rim point:
            // Project World Down vector onto the plane defined by Cup Up?
            // Let's rely on simple trig:
            // If cup is rotated Z by -45deg (tilted right), lowest point is at x=+r.

            // Local Down Vector projected to rim plane:
            // Transform World Down (0,-1,0) into Local Space.
            const worldDown = new THREE.Vector3(0, -1, 0);
            const localDown = worldDown.clone().applyQuaternion(group.current.quaternion.clone().invert());

            // Project to XZ plane (rim plane)
            const rimDir = new THREE.Vector2(localDown.x, localDown.z).normalize();

            // Rim radius approx 0.9 (top)
            const localSpawnPos = new THREE.Vector3(rimDir.x * 0.9, 1.0, rimDir.y * 0.9); // Top of cup is Y=1.0 local at scale 1 (before group scale) -> cylinder height 2.0 (center 0) -> top is +1.0

            // Convert to World
            const worldSpawnPos = localSpawnPos.clone().applyMatrix4(group.current.matrixWorld);

            // Velocity: Cup Velocity + outward flow
            // Flow direction: World Down projected effectively?
            // Initial velocity mostly down + some outward from cup center?
            const flowDir = worldSpawnPos.clone().sub(currentPos).normalize(); // Outward from center

            // Spawn rate: higher tilt = more drops
            const spawnCount = Math.floor((tiltAngle - SPILL_THRESHOLD) * 5) + 1;

            let spawned = 0;
            for (let i = 0; i < MAX_DROPS && spawned < spawnCount; i++) {
                if (!drops[i].active) {
                    drops[i].active = true;
                    drops[i].life = 100;
                    drops[i].position.copy(worldSpawnPos);
                    // Random variation
                    drops[i].position.x += (Math.random() - 0.5) * 0.05;
                    drops[i].position.z += (Math.random() - 0.5) * 0.05;

                    // Velocity
                    drops[i].velocity.set(
                        flowDir.x * 0.2 + displacement.x * 10, // Inherit drag velocity
                        displacement.y * 10,
                        flowDir.z * 0.2
                    );
                    spawned++;
                }
            }
        }

        // Update Drops Physics
        if (dropsRef.current) {
            let activeCount = 0;
            for (let i = 0; i < MAX_DROPS; i++) {
                const d = drops[i];
                if (d.active) {
                    // Gravity
                    d.velocity.y += GRAVITY * delta * 0.5; // Scale gravity
                    d.position.add(d.velocity.clone().multiplyScalar(delta));

                    // Kill if off screen
                    if (d.position.y < -5) {
                        d.active = false;
                    } else {
                        // Update Matrix
                        dummy.position.copy(d.position);
                        // Scale drop
                        dummy.scale.set(0.05, 0.05, 0.05);
                        dummy.updateMatrix();
                        dropsRef.current.setMatrixAt(i, dummy.matrix);
                        activeCount++;
                    }
                } else {
                    // Hide inactive
                    dummy.position.set(0, -1000, 0);
                    dummy.updateMatrix();
                    dropsRef.current.setMatrixAt(i, dummy.matrix);
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

    // Materials
    const plasticMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 0.95, // High transmission for glass/plastic
        opacity: 1,
        transparent: true,
        roughness: 0.1,
        metalness: 0,
        ior: 1.5, // Plastic IOR
        thickness: 0.1, // Volume rendering for transmission
        side: THREE.DoubleSide
    });

    const coffeeMaterial = new THREE.MeshStandardMaterial({
        color: "#24130a", // Darker rich coffee
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
            {/* Cup Group */}
            {/* @ts-ignore */}
            <animated.group ref={group} position={pos} scale={SCALE} {...bind()} className="cursor-grab active:cursor-grabbing">

                {/* Cup Body - Venti Shape */}
                <mesh material={plasticMaterial} position={[0, 0, 0]}>
                    {/* Open cylinder? No, default is closed. Open ended cylinder requires openEnded=true */}
                    {/* But we need a bottom. So Cylinder is fine. Side=DoubleSide handles visibility inside. */}
                    <cylinderGeometry args={[0.9, 0.65, 2.0, 32, 1, false]} />
                </mesh>

                {/* Lid */}
                <mesh material={plasticMaterial} position={[0, 1.05, 0]}>
                    <cylinderGeometry args={[0.92, 0.92, 0.1, 32]} />
                </mesh>

                {/* Liquid */}
                <group position={[0, -0.2, 0]}>
                    <mesh ref={liquidMesh} material={coffeeMaterial}>
                        {/* Slightly smaller radius to fight z-fighting if same size, but with thickness it's fine. */}
                        {/* Radius 0.82 ensures it's inside 0.9/0.65 cylinder appropriately? */}
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
                        size={0.5}
                        sizeAttenuation={true}
                        color="#ffffff"
                        depthWrite={false}
                    />
                </points>
            </animated.group>

            {/* Spilled Drops (World Space) */}
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
