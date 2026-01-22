"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useState, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/three";

function CupModel({ position, bind, scale = 1 }: { position: any, bind: any, scale?: number }) {
    const group = useRef<THREE.Group>(null);

    // Cup Material (Simple White Ceramic)
    const cupMaterial = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.2,
        metalness: 0.1,
    });

    const coffeeMaterial = new THREE.MeshStandardMaterial({
        color: "#3b2616",
        roughness: 0.3,
    });

    return (
        // @ts-ignore
        <animated.group ref={group} position={position} scale={scale} {...bind()} className="cursor-grab active:cursor-grabbing">
            {/* Cup Body */}
            <mesh material={cupMaterial} position={[0, 0, 0]}>
                <cylinderGeometry args={[0.8, 0.6, 1.2, 32]} />
            </mesh>

            {/* Handle */}
            <mesh material={cupMaterial} position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.3, 0.08, 16, 32]} />
            </mesh>

            {/* Liquid */}
            <mesh material={coffeeMaterial} position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.7, 32]} />
            </mesh>
        </animated.group>
    );
}

function CupScene() {
    const { viewport, size } = useThree();

    // Calculate Home Position (Top Right)
    // Viewport width/height are the dimensions of the 3D scene at z=0
    // We want some padding.
    const homePos = useMemo(() => new THREE.Vector3(
        viewport.width / 2 - 1.5, // 1.5 units from right
        viewport.height / 2 - 1.5, // 1.5 units from top
        0
    ), [viewport]);

    // Physics/State
    const [isDocked, setIsDocked] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const velocity = useRef(new THREE.Vector3(0, 0, 0));
    const positionRef = useRef(homePos.clone());

    // Spring for smooth movement
    const [{ pos }, api] = useSpring(() => ({
        pos: [homePos.x, homePos.y, 0],
        config: { mass: 1, tension: 280, friction: 60 }
    }));

    // Reset to home if docked and viewport changes (resize)
    useEffect(() => {
        if (isDocked) {
            api.start({ pos: [homePos.x, homePos.y, 0] });
            positionRef.current.copy(homePos);
        }
    }, [homePos, isDocked, api]);

    const bind = useDrag(({ xy: [cx, cy], active, last }) => {
        // Convert screen pixels to 3D world coordinates
        const nX = (cx / size.width) * 2 - 1;
        const nY = -(cy / size.height) * 2 + 1;
        const wx = (nX * viewport.width) / 2;
        const wy = (nY * viewport.height) / 2;

        if (active) {
            setIsDragging(true);
            setIsDocked(false);
            api.start({ pos: [wx, wy, 0], immediate: true });
            positionRef.current.set(wx, wy, 0);
            velocity.current.set(0, 0, 0);
        } else if (last) {
            setIsDragging(false);
            // Check docking distance
            const dist = positionRef.current.distanceTo(homePos);
            // Docking threshold
            if (dist < 2.5) {
                setIsDocked(true);
                api.start({ pos: [homePos.x, homePos.y, 0] });
            } else {
                setIsDocked(false);
                velocity.current.set(0, 0, 0); // Drop straight down, or keep momentum? 
                // Zero velocity simple drop
            }
        }
    }, {
        // drag options
    });

    useFrame((state, delta) => {
        // Gravity Logic
        if (!isDocked && !isDragging) {
            velocity.current.y += -25.0 * delta; // Gravity
            positionRef.current.add(velocity.current.clone().multiplyScalar(delta));

            // Sync spring to physics position
            api.set({ pos: [positionRef.current.x, positionRef.current.y, positionRef.current.z] });
        }

        // Simple tilt effect based on velocity if falling
        // Not requested, but nice to have. Skipping for "simple".
    });

    return (
        <CupModel position={pos} bind={bind} scale={0.5} />
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
                <ambientLight intensity={0.8} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <Environment preset="city" />

                <CupScene />

            </Canvas>
        </div>
    );
}
