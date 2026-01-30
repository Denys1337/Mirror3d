"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, MeshReflectorMaterial, Environment, useTexture, RoundedBox, useGLTF } from "@react-three/drei";
import { Color } from "three";
import { useRef, useState, useMemo } from "react";
import * as THREE from "three";

export interface MirrorSceneProps {
  widthMm: number;
  heightMm: number;
  showWall: boolean;
  showroomLight: boolean;
  hdrRotation?: number; // HDR-Rotation in Radianten (0 = Ausgangsposition)
  showClock?: boolean; // Uhr im Spiegel anzeigen
  clockCorner?: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null; // Position der Uhr (null = Mitte)
  onClockCornerChange?: (corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center") => void; // Callback für Positionsänderung der Uhr
  showSocket?: boolean; // Steckdose anzeigen
  socketCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; // Position der Steckdose
  showShelf?: boolean; // Glasregal anzeigen
  shelfWidthPercent?: number; // Breite des Regals in Prozent
  showHygieneMirror?: boolean; // Hygienespiegel anzeigen
  hygieneMirrorCorner?: "bottom-left" | "bottom-right"; // Position des Hygienespiegels
}

// Umrechnungsfaktor mm -> Meter in der Szene
const MM_TO_M = 0.001;

// Vorabladung der Modelle
useGLTF.preload("/images/analog_clock.glb");

// Uhr-Komponente zur Anzeige im Spiegel
function Clock({ 
  corner, 
  width, 
  height 
}: { 
  corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null;
  width: number;
  height: number;
}) {
  const clockSize = 0.1; // Vergrößerte Uhrgröße
  const offset = 0.1; // Abstand vom Spiegelrand
  
  // 3D-Modell der Uhr laden
  const { scene } = useGLTF("/images/analog_clock.glb");
  
  // Szene für Verwendung klonen
  const clockRef = useRef<THREE.Group>(null!);
  
  // Position je nach Ecke berechnen (wenn null - in der Mitte)
  let x = 0;
  let y = 0;
  
  if (corner === null) {
    // Spiegelmitte
    x = 0;
    y = 0;
  } else if (corner === "top-left") {
    x = -width / 2 + clockSize + offset;
    y = height / 2 - clockSize - offset;
  } else if (corner === "top-center") {
    x = 0;
    y = height / 2 - clockSize - offset;
  } else if (corner === "top-right") {
    x = width / 2 - clockSize - offset;
    y = height / 2 - clockSize - offset;
  } else if (corner === "right-center") {
    x = width / 2 - clockSize - offset;
    y = 0;
  } else if (corner === "bottom-right") {
    x = width / 2 - clockSize - offset;
    y = -height / 2 + clockSize + offset;
  } else if (corner === "bottom-center") {
    x = 0;
    y = -height / 2 + clockSize + offset;
  } else if (corner === "bottom-left") {
    x = -width / 2 + clockSize + offset;
    y = -height / 2 + clockSize + offset;
  } else if (corner === "left-center") {
    x = -width / 2 + clockSize + offset;
    y = 0;
  }
  
  // Spiegelposition: mountDepth + 0.146 = 0.06 + 0.146 = 0.206
  // Uhr über dem Spiegel platzieren (etwas davor)
  const mirrorZ = 0.06 + 0.129; // mountDepth + Spiegel-Offset
  const clockZ = mirrorZ + 0.02; // Uhr nach vorne verschieben
  
  // Modellmaßstab vergrößern
  const scale = clockSize * 15;
  
  return (
    <group ref={clockRef} position={[x, y, clockZ]} rotation={[0, 0, 0]} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
    </group>
  );
}

// Komponente zur Auswahl der Uhrposition (Kreise mit Pfeilen)
function ClockPositionSelector({
  width,
  height,
  onSelect
}: {
  width: number;
  height: number;
  onSelect: (corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center") => void;
}) {
  const circleRadius = 0.05; // Kreisradius (vergrößert)
  const arrowHeadSize = 0.025; // Pfeilspitzengröße (vergrößert für Sichtbarkeit innen)
  const arrowTailLength = 0.035; // Pfeilschaftlänge (vergrößert)
  const arrowTailWidth = 0.006; // Pfeilschaftbreite (vergrößert)
  const distance = Math.min(width, height) * 0.25; // Abstand vom Zentrum
  
  // Kreispositionen um das Zentrum (8 Positionen)
  // Pfeilrotation wird automatisch vom Zentrum zur Position berechnet
  const positions: Array<{
    corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center";
    x: number;
    y: number;
  }> = [
    { corner: "top-left", x: -distance * 0.7, y: distance * 0.7 },
    { corner: "top-center", x: 0, y: distance },
    { corner: "top-right", x: distance * 0.7, y: distance * 0.7 },
    { corner: "right-center", x: distance, y: 0 },
    { corner: "bottom-right", x: distance * 0.7, y: -distance * 0.7 },
    { corner: "bottom-center", x: 0, y: -distance },
    { corner: "bottom-left", x: -distance * 0.7, y: -distance * 0.7 },
    { corner: "left-center", x: -distance, y: 0 },
  ];
  
  // Rotation für jede Position hinzufügen (vom Zentrum zur Position)
  const positionsWithRotation = positions.map(pos => ({
    ...pos,
    rotation: Math.atan2(pos.y, pos.x) - Math.PI / 2 // -Math.PI/2 weil der Pfeil oben beginnt
  }));
  
  const mirrorZ = 0.06 + 0.129;
  const selectorZ = mirrorZ + 0.025; // Etwas vor der Uhr
  
  return (
    <group position={[0, 0, selectorZ]}>
      {positionsWithRotation.map((pos) => (
        <group
          key={pos.corner}
          position={[pos.x, pos.y, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(pos.corner);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          {/* Türkiser Kreis #369baa */}
          <mesh renderOrder={1000}>
            <circleGeometry args={[circleRadius, 32]} />
            <meshBasicMaterial 
              color={new THREE.Color(0x369baa)} // Farbe #369baa
              transparent={true}
              opacity={0.8}
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
          {/* Weißer Pfeil im Kreis */}
          <group rotation={[0, 0, pos.rotation]} position={[0, 0, 0.002]}>
            {/* Pfeilspitze (Dreieck) */}
            <mesh position={[0, arrowHeadSize * 0.3, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([
                    0, arrowHeadSize, 0,
                    arrowHeadSize * 0.6, -arrowHeadSize * 0.3, 0,
                    -arrowHeadSize * 0.6, -arrowHeadSize * 0.3, 0
                  ])}
                  itemSize={3}
                />
                <bufferAttribute
                  attach="attributes-normal"
                  count={3}
                  array={new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])}
                  itemSize={3}
                />
                <bufferAttribute
                  attach="index"
                  count={3}
                  array={new Uint16Array([0, 1, 2])}
                  itemSize={1}
                />
              </bufferGeometry>
              <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
            </mesh>
            {/* Pfeilschaft (Rechteck) - an der Basis der Spitze befestigt */}
            <mesh position={[0, -arrowHeadSize * 0.001 - arrowTailLength / 2, 0]}>
              <boxGeometry args={[arrowTailWidth, arrowTailLength, 0.001]} />
              <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function MirrorObject({
  widthMm,
  heightMm,
  showroomLight
}: {
  widthMm: number;
  heightMm: number;
  showroomLight: boolean;
}) {
  const width = widthMm * MM_TO_M;
  const height = heightMm * MM_TO_M;
  const frameThickness = 0.035;
  const mirrorDepth = 0.01;
  const mountDepth = 0.06;
  
  // Textur mit radialem Gradient für weiche Lichtstreuung erstellen
  const glowTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Radialen Gradient vom Zentrum erstellen
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2;
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Helles Weiß im Zentrum
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)'); // Helles Weiß
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)'); // Mittlere Helligkeit
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)'); // Schwaches Licht
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)'); // Sehr schwach
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Transparent an den Rändern
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  const frameColor = new Color("#f9fafb");
  const mountWidth = width - frameThickness * 2;
  const mountHeight = height - frameThickness * 2;
  const dashLength = 0.02;
  const dashGap = 0.020;
  const dashThickness = 0.02;
  const dashHeight = 0.006;

  // Generierung gestrichelter Linien entlang des Blockumfangs
  const dashes: JSX.Element[] = [];
  
  // Obere Seite
  const topDashes = Math.floor(mountWidth / (dashLength + dashGap));
  for (let i = 0; i < topDashes; i++) {
    const x = -mountWidth / 2 + (i + 0.5) * (dashLength + dashGap);
    dashes.push(
      <mesh
        key={`top-${i}`}
        position={[x, mountHeight / 2, mountDepth + dashHeight * 19]}
      >
        <boxGeometry args={[dashLength, dashThickness, dashHeight]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );
  }

  // Untere Seite
  for (let i = 0; i < topDashes; i++) {
    const x = -mountWidth / 2 + (i + 0.5) * (dashLength + dashGap);
    dashes.push(
      <mesh
        key={`bottom-${i}`}
        position={[x, -mountHeight / 2, mountDepth + dashHeight * 19]}
      >
        <boxGeometry args={[dashLength, dashThickness, dashHeight]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );
  }

  // Linke Seite
  const sideDashes = Math.floor(mountHeight / (dashLength + dashGap));
  for (let i = 0; i < sideDashes; i++) {
    const y = -mountHeight / 2 + (i + 0.5) * (dashLength + dashGap);
    dashes.push(
      <mesh
        key={`left-${i}`}
        position={[-mountWidth / 2, y, mountDepth + dashHeight * 19]}
      >
        <boxGeometry args={[dashThickness, dashLength, dashHeight]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );
  }

  // Rechte Seite
  for (let i = 0; i < sideDashes; i++) {
    const y = -mountHeight / 2 + (i + 0.5) * (dashLength + dashGap);
    dashes.push(
      <mesh
        key={`right-${i}`}
        position={[mountWidth / 2, y, mountDepth + dashHeight * 19]}
      >
        <boxGeometry args={[dashThickness, dashLength, dashHeight]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );
  }

  return (
    <group>
      {/* Montageblock, der den Spiegel an der Wand befestigt (nach vorne über die Wand hinaus verlängert) */}
      <mesh position={[0, 0, mountDepth * 2.84]}>
        <boxGeometry args={[mountWidth, mountHeight, mountDepth]} />
        <meshStandardMaterial color="#292626" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* Gestrichelte weiße Streifen entlang des Blockumfangs */}
      {dashes}

      {/* Spiegelebene mit hellem Raumreflex */}
      <mesh position={[0, 0, mountDepth + 0.146]}>
        <planeGeometry args={[width, height]} />
        <MeshReflectorMaterial
          mirror={1}
          mixBlur={0.2}
          mixStrength={8.0}
          resolution={1024}
          depthScale={0.35}
          minDepthThreshold={1}
          maxDepthThreshold={4.0}
          roughness={0.000001}
          metalness={0.0005}
          color="#ffffff"
          blur={[0, 0]}
        />
      </mesh>

      {/* Рамка навколо дзеркала */}
      <mesh position={[0, 0, mountDepth + mirrorDepth + 0.13]}>
        <boxGeometry args={[width + frameThickness, height + frameThickness, mirrorDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Підсвітка: реалістичне м'яке світло навколо дзеркала на стіні */}
      {showroomLight && (() => {
        const glowSize = Math.max(width, height) * 0.4; // Збільшений розмір ореолу
        
        return (
          <group>
            {/* Основний ореол світла - найближчий до дзеркала */}
            <mesh position={[0, 0, -mountDepth + 0.207]}>
              <planeGeometry args={[width + glowSize * 0.5, height + glowSize * 0.5]} />
              <meshStandardMaterial
                map={glowTexture}
                emissive="#ffffff"
                emissiveIntensity={7.0}
                transparent
                opacity={1}
                roughness={1}
              />
            </mesh>
            
            {/* Середній ореол - м'який перехід */}
            <mesh position={[0, 0, -mountDepth + 0.206]}>
              <planeGeometry args={[width + glowSize * 1.2, height + glowSize * 1.2]} />
              <meshStandardMaterial
                map={glowTexture}
                emissive="#ffffff"
                emissiveIntensity={4.0}
                transparent
                opacity={1}
                roughness={1}
              />
            </mesh>
            
            {/* Зовнішній ореол - дуже м'який розсіювання */}
            <mesh position={[0, 0, -mountDepth + 0.205]}>
              <planeGeometry args={[width + glowSize * 2.2, height + glowSize * 2.2]} />
              <meshStandardMaterial
                map={glowTexture}
                emissive="#ffffff"
                emissiveIntensity={2.5}
                transparent
                opacity={0.8}
                roughness={1}
              />
            </mesh>
          </group>
        );
      })()}
    </group>
  );
}

function Wall({ visible }: { visible: boolean }) {
  if (!visible) return null;

  const mountDepth = 0.06;
  
  // Створюємо темну текстуру обой процедурно (один раз через useMemo)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Створюємо ImageData для повного контролю над пікселями
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Базовий колір (темніший, майже чорний)
      const baseR = 20; // Темніший ніж #292626
      const baseG = 18;
      const baseB = 18;
      
      // Додаємо випадковий шум для зернистості
      const noise = (Math.random() - 0.5) * 6; // Невеликий шум
      
      data[i] = Math.max(0, Math.min(255, baseR + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, baseG + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, baseB + noise)); // B
      data[i + 3] = 255; // Alpha
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Додаємо додаткову текстуру для більшої реалістичності
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 2 + 0.5;
      ctx.fillRect(x, y, size, size);
    }
    
    // Створюємо текстуру з canvas
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2); // Повторюємо текстуру 2x2 рази
    tex.needsUpdate = true; // Оновлюємо текстуру
    return tex;
  }, []);

  return (
    <group position={[0, 1.0, -mountDepth]}>
      {/* Головна стіна за дзеркалом з темними обоями */}
      <mesh receiveShadow position={[0, 0, 0.1]}>
        <boxGeometry args={[6, 6, 0.2]} />
        <meshBasicMaterial 
          map={texture}
        />
      </mesh>

    </group>
  );
}

export default function MirrorScene({
  widthMm,
  heightMm,
  showWall,
  showroomLight,
  hdrRotation = Math.PI / 2, // Початкове обертання: права сторона спочатку
  showClock = false,
  clockCorner = null,
  onClockCornerChange,
  showSocket = false,
  socketCorner = "top-right",
  showShelf = false,
  shelfWidthPercent = 80,
  showHygieneMirror = false,
  hygieneMirrorCorner = "bottom-left"
}: MirrorSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [6.75, 1.1, 0], fov: 40 }}
      gl={{ toneMappingExposure: 3.5 }}
    >
      <color attach="background" args={["#ffffff"]} />

      {/* Освітлення тільки з потолка, щоб не було бліків в дзеркалі */}
      <ambientLight intensity={3.0} />
      {/* Світло тільки зверху (потолок) */}
      <hemisphereLight args={["#ffffff", "#000000", 4.0]} />
      {/* DirectionalLight тільки зверху вниз */}
      <directionalLight position={[0, 3, 0]} intensity={6.0} />
      <directionalLight position={[-1, 3, 0]} intensity={5.0} />
      <directionalLight position={[1, 3, 0]} intensity={5.0} />
      {/* PointLight тільки зверху (потолок) */}
      <pointLight position={[0, 3, 0]} intensity={8.0} distance={20} decay={1.0} />
      <pointLight position={[-1.5, 3, 0]} intensity={7.0} distance={18} decay={1.0} />
      <pointLight position={[1.5, 3, 0]} intensity={7.0} distance={18} decay={1.0} />
      <pointLight position={[0, 3, -1]} intensity={6.5} distance={18} decay={1.0} />
      <pointLight position={[0, 3, 1]} intensity={6.5} distance={18} decay={1.0} />

      {/* Підсвічування по периметру дзеркала реальними джерелами світла */}
      {showroomLight && (
        <group>
          {/* Верхній м'який прожектор */}
          <spotLight
            position={[0, 2.4, 0.6]}
            angle={Math.PI / 4}
            penumbra={0.9}
            intensity={2.4}
            castShadow
          />
          {/* Нижній слабший прожектор */}
          <spotLight
            position={[0, -0.1, 0.6]}
            angle={Math.PI / 4}
            penumbra={0.9}
            intensity={1.1}
            castShadow
          />
          {/* Бокові для заповнення світлом */}
          <spotLight
            position={[-1.4, 1.2, 0.8]}
            angle={Math.PI / 4}
            penumbra={0.9}
            intensity={1.4}
            castShadow
          />
          <spotLight
            position={[1.4, 1.2, 0.8]}
            angle={Math.PI / 4}
            penumbra={0.9}
            intensity={1.4}
            castShadow
          />
        </group>
      )}

      {/* HDR ванної для відображення в дзеркалі - можна обертати через hdrRotation */}
      <group rotation={[0, hdrRotation, 0]}>
        <Environment files="/images/modern_bathroom_4k.hdr" blur={0} />
      </group>

      <group 
        rotation={[0, Math.PI - Math.PI / 2, 0]} 
        position={[0, 0.9, 0]}
      >
        <Wall visible={showWall} />
        <MirrorObject widthMm={widthMm} heightMm={heightMm} showroomLight={showroomLight} />
        {/* Годинник в дзеркалі (відображається в центрі або вибраному куті) */}
        {showClock && (
          <>
            <Clock 
              corner={clockCorner || null} 
              width={widthMm * MM_TO_M} 
              height={heightMm * MM_TO_M} 
            />
            {/* Кружечки для вибору позиції (показуємо тільки якщо позиція не вибрана) */}
            {clockCorner === null && onClockCornerChange && (
              <ClockPositionSelector
                width={widthMm * MM_TO_M}
                height={heightMm * MM_TO_M}
                onSelect={onClockCornerChange}
              />
            )}
          </>
        )}
      </group>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        zoomSpeed={0.7}
        rotateSpeed={0.7}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 1.1, 0]}
        minDistance={1}
        maxDistance={10}
      />
    </Canvas>
  );
}


