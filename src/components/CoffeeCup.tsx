"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function Cup() {
    const group = useRef<THREE.Group>(null);
    const liquidMesh = useRef<THREE.Mesh>(null);
    const { viewport } = useThree();

    // Physics state
    const lastPos = useRef(new THREE.Vector3(0, 0, 0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const velocity = useRef(new THREE.Vector3(0, 0, 0));

    // Liquid physics state (simulating a pendulum/spring)
    // we use x for x-axis rotation (tilt up/down)
    // we use y for z-axis rotation (tilt left/right)
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

    useFrame((state) => {
        if (!group.current || !liquidMesh.current) return;

        // 1. Move cup to mouse (Smooth follow)
        // Convert mouse (normalized -1 to 1) to viewport coords
        const x = (state.mouse.x * viewport.width) / 2;
        const y = (state.mouse.y * viewport.height) / 2;

        // We keep z at 0 for the cup movement plane
        const targetPos = new THREE.Vector3(x, y, 0);

        // Lerp cup position for smoothness (and to create velocity/acceleration delta)
        group.current.position.lerp(targetPos, 0.1);

        // Calculate velocity for liquid physics
        const currentPos = group.current.position.clone();
        const displacement = currentPos.clone().sub(lastPos.current);

        // Update last pos
        lastPos.current.copy(currentPos);

        // 2. Liquid Physics (Spring Simulation)
        // Inertia pushes liquid opposite to acceleration.

        const MOVEMENT_INFLUENCE = 2.5;
        const DAMPING = 0.92;
        const STIFFNESS = 0.05;
        const MAX_TILT = 0.6; // Radians

        // Moving Right (Positive X) -> Liquid tilts Left (Positive Z rotation) -> mapped to y in our Vector2
        // Moving Up (Positive Y) -> Liquid tilts Down (Positive X rotation) -> mapped to x in our Vector2

        const forceX = -displacement.y * MOVEMENT_INFLUENCE; // Tilt around X axis
        const forceZ = displacement.x * MOVEMENT_INFLUENCE;  // Tilt around Z axis

        // Spring forces
        const extensionX = liquidRotation.current.x;
        const extensionY = liquidRotation.current.y; // 'y' stores z-rotation

        // Acceleration = Force - Stiffness * Extension - Damping * Velocity
        const accelX = forceX - STIFFNESS * extensionX - (1 - DAMPING) * liquidAngularVelocity.current.x;
        const accelY = forceZ - STIFFNESS * extensionY - (1 - DAMPING) * liquidAngularVelocity.current.y;

        // Euler integration
        liquidAngularVelocity.current.x += accelX;
        liquidAngularVelocity.current.y += accelY;

        liquidRotation.current.x += liquidAngularVelocity.current.x;
        // 'y' component tracks z-rotation
        liquidRotation.current.y += liquidAngularVelocity.current.y;

        // Clamp tilt
        liquidRotation.current.x = THREE.MathUtils.clamp(liquidRotation.current.x, -MAX_TILT, MAX_TILT);
        liquidRotation.current.y = THREE.MathUtils.clamp(liquidRotation.current.y, -MAX_TILT, MAX_TILT);

        // Apply rotation to liquid mesh
        liquidMesh.current.rotation.x = liquidRotation.current.x;
        liquidMesh.current.rotation.z = liquidRotation.current.y;

        // Subtle cup tilt in direction of movement
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -displacement.x * 2, 0.1);
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, displacement.y * 2, 0.1);

        // 3. Steam Update
        if (steamRef.current) {
            const positions = steamRef.current.geometry.attributes.position.array as Float32Array;

            steamSystem.forEach((p, i) => {
                p.life -= 1;
                p.pos.add(p.velocity);

                // Wind effect from cup movement
                p.pos.x -= displacement.x * 0.5;
                p.pos.y -= displacement.y * 0.5;

                // Reset dead particles
                if (p.life <= 0) {
                    p.life = p.maxLife;
                    p.pos.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
                }

                positions[i * 3] = p.pos.x;
                positions[i * 3 + 1] = p.pos.y + 0.5;
                positions[i * 3 + 2] = p.pos.z;
            });

            steamRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    // Cup Geometry
    const cupMaterial = new THREE.MeshStandardMaterial({
        color: "#f0f0f0",
        roughness: 0.15,
        metalness: 0.1
    });

    const coffeeMaterial = new THREE.MeshStandardMaterial({
        color: "#3b2616",
        roughness: 0.2,
        metalness: 0.0
    });

    return (
        <group ref={group}>
            {/* Cup Body */}
            <mesh material={cupMaterial} position={[0, 0, 0]}>
                <cylinderGeometry args={[0.8, 0.6, 1.2, 32]} />
            </mesh>

            {/* Handle */}
            <mesh material={cupMaterial} position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.3, 0.08, 16, 32]} />
            </mesh>

            {/* Liquid */}
            <group position={[0, 0.4, 0]}>
                <mesh ref={liquidMesh} material={coffeeMaterial} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.72, 0.72, 0.05, 32]} />
                </mesh>
            </group>

            {/* Steam */}
            <points ref={steamRef} position={[0, 0.5, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={steamSystem.length}
                        args={[new Float32Array(steamSystem.length * 3), 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    transparent
                    opacity={0.3}
                    size={0.15}
                    color="#ffffff"
                    depthWrite={false}
                />
            </points>
        </group>
    );
}

export default function CoffeeCup() {
    return (
        <div className="absolute inset-0 z-20 pointer-events-none">
            <Canvas
                className="pointer-events-none"
                camera={{ position: [0, 0, 5], fov: 45 }}
                eventSource={typeof document !== 'undefined' ? document.body : undefined}
                shadows
            >
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <Environment preset="city" />
                <Cup />
                <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={10} blur={2} far={4} />
            </Canvas>
        </div>
    );
}
