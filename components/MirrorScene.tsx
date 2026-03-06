"use client";

import { Canvas, useThree, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, MeshReflectorMaterial, Environment, useTexture, RoundedBox, useGLTF, Html } from "@react-three/drei";
import { Color } from "three";
import { useRef, useState, useMemo, useEffect } from "react";
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
  socketCorner?: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null; // Position der Steckdose
  onSocketCornerChange?: (corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center") => void;
  showTouchSensor?: boolean; // Touch-Sensor anzeigen
  touchSensorCorner?: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null; // Position des Touch-Sensors
  onTouchSensorCornerChange?: (corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center") => void;
  showSchminkspiegel?: boolean; // Schminkspiegel anzeigen
  schminkspiegelCorner?: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center" | null; // Position des Schminkspiegels
  onSchminkspiegelCornerChange?: (corner: "top-left" | "top-center" | "top-right" | "right-center" | "bottom-right" | "bottom-center" | "bottom-left" | "left-center") => void;
  showShelf?: boolean; // Glasregal anzeigen
  shelfWidthPercent?: number; // Breite des Regals in Prozent
  shelfLengthMm?: number; // sichtbare Breite der Glasablage in mm
  showHygieneMirror?: boolean; // Hygienespiegel anzeigen
  hygieneMirrorCorner?: "bottom-left" | "bottom-right"; // Position des Hygienespiegels
  cameraView?: "top" | "left" | "right" | "front"; // Kamera-Ansicht
  showDimensions?: boolean; // Розміри зеркала показувати
  lightingMode?: "none" | "sides" | "frame" | "top-sides"; // Schema der Leuchtstreifen
}

// Umrechnungsfaktor mm -> Meter in der Szene
const MM_TO_M = 0.001;

// Vorabladung der Modelle
useGLTF.preload("/images/analog_clock.glb");
useGLTF.preload("/images/glasablage.glb");
useGLTF.preload("/images/steckdose_krom.glb");

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

// Glasablage (Regal) als 3D-Modell vor dem Spiegel
// width/height in Metern (Spiegelmaße)
// Mittelpunkt der Ablage liegt 200 mm über der Unterkante des Spiegels.
// Die sichtbare Breite der Glasfläche wird über shelfLengthMm gesteuert und ist
// maximal so groß, dass links und rechts jeweils 80 mm Abstand bleiben.
function GlassShelf({
  width,
  height,
  shelfLengthMm,
}: {
  width: number;
  height: number;
  shelfLengthMm: number;
}) {
  const { scene } = useGLTF("/images/glasablage.glb");
  const shelfRef = useRef<THREE.Group>(null!);
  const [modelWidth, setModelWidth] = useState(1);

  // Ursprungsbreite des Modells ermitteln
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const w = box.max.x - box.min.x;
      if (Number.isFinite(w) && w > 0) {
        setModelWidth(w);
      }
    }
  }, [scene]);

  // Position relativ zum Spiegel:
  // - mittig in X
  // - 80 mm über der Unterkante des Spiegels
  // - leicht vor der Spiegeloberfläche in Z.
  const mountDepth = 0.06;
  const mirrorPlaneZ = mountDepth + 0.146;
  // Regal sehr nah an der Spiegeloberfläche
  const shelfZ = mirrorPlaneZ + 0.005;

  // Leichte Skalierung abhängig von Spiegelbreite
  // Sichtbare Regalbreite: mindestens 50 cm, höchstens Spiegelbreite minus 160 mm
  const minShelfWidth = Math.min(0.5, width);
  const maxShelfWidth = Math.max(width - 0.16, minShelfWidth); // 160 mm = 0.16 m
  const requestedWidth = Math.max(
    minShelfWidth,
    Math.min(shelfLengthMm * MM_TO_M, maxShelfWidth)
  );
  const scaleX = requestedWidth / modelWidth;
  const scaleY = 1;
  const scaleZ = 1;

  const bottomEdge = -height / 2;
  const shelfGap = 0.2; // 200 mm Abstand Unterkante Spiegel zum Mittelpunkt der Ablage
  const shelfY = bottomEdge + shelfGap;

  return (
    <group
      ref={shelfRef}
      position={[0, shelfY, shelfZ]}
      rotation={[0, 0, 0]}
      scale={[scaleX, scaleY, scaleZ]}
    >
      <primitive object={scene.clone()} />
    </group>
  );
}

// Steckdose als 3D-Modell auf dem Spiegel (анімація кришки через обертання нода)
function Socket({
  corner,
  width,
  height,
}: {
  corner:
    | "top-left"
    | "top-center"
    | "top-right"
    | "right-center"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left"
    | "left-center"
    | null;
  width: number;
  height: number;
}) {
  const { scene } = useGLTF("/images/steckdose_krom.glb");
  const socketRef = useRef<THREE.Group>(null!);
  const socketScene = useMemo(() => scene.clone(), [scene]);
  const lidRef = useRef<THREE.Object3D | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const targetAngleRef = useRef(0);

  const socketW = 0.18;
  const socketH = 0.08;
  const offset = 0.06;

  let x = 0;
  let y = 0;
  if (corner === "top-left") {
    x = -width / 2 + socketW / 2 + offset;
    y = height / 2 - socketH / 2 - offset;
  } else if (corner === "top-center") {
    x = 0;
    y = height / 2 - socketH / 2 - offset;
  } else if (corner === "top-right") {
    x = width / 2 - socketW / 2 - offset;
    y = height / 2 - socketH / 2 - offset;
  } else if (corner === "bottom-right") {
    x = width / 2 - socketW / 2 - offset;
    y = -height / 2 + socketH / 2 + offset;
  } else if (corner === "bottom-center") {
    x = 0;
    y = -height / 2 + socketH / 2 + offset;
  } else if (corner === "bottom-left") {
    x = -width / 2 + socketW / 2 + offset;
    y = -height / 2 + socketH / 2 + offset;
  } else if (corner === "left-center") {
    x = -width / 2 + socketW / 2 + offset;
    y = 0;
  } else if (corner === "right-center") {
    x = width / 2 - socketW / 2 - offset;
    y = 0;
  }

  const mountDepth = 0.06;
  const mirrorPlaneZ = mountDepth + 0.146;
  const socketZ = mirrorPlaneZ + 0.001;

  const baseWidth = 0.2;
  const baseHeight = 0.1;
  const scaleX = socketW / baseWidth;
  const scaleY = socketH / baseHeight;
  const scaleZ = (scaleX + scaleY) / 2;

  // знайти нод кришки за ім'ям з моделі
  useEffect(() => {
    const lidNode = (socketScene as any)?.getObjectByName?.(
      "Steckdose__Chrom_Deckel"
    );
    if (lidNode) {
      lidRef.current = lidNode as THREE.Object3D;
    } else {
      console.warn("Steckdose lid node not found");
    }
  }, [socketScene]);

  // плавна анімація відкривання/закривання кришки
  useFrame(() => {
    if (!lidRef.current) return;
    const current = lidRef.current.rotation.x;
    const target = targetAngleRef.current;
    if (Math.abs(current - target) < 0.001) return;
    lidRef.current.rotation.x = THREE.MathUtils.lerp(current, target, 0.2);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    // Відкриваємо кришку приблизно на 70° вперед
    targetAngleRef.current = nextOpen ? -Math.PI * 0.4 : 0;
  };

  return (
    <group
      ref={socketRef}
      position={[x, y, socketZ]}
      rotation={[0, 0, 0]}
      scale={[scaleX, scaleY, scaleZ]}
      onClick={handleClick}
    >
      <primitive object={socketScene} />
    </group>
  );
}

// Auswahlkreise für Steckdosenposition (analog zur Uhr)
function SocketPositionSelector({
  width,
  height,
  onSelect,
}: {
  width: number;
  height: number;
  onSelect: (
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center"
  ) => void;
}) {
  const circleRadius = 0.05;
  const arrowHeadSize = 0.025;
  const arrowTailLength = 0.035;
  const arrowTailWidth = 0.006;
  const distance = Math.min(width, height) * 0.25;

  const positions: Array<{
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center";
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

  const positionsWithRotation = positions.map((pos) => ({
    ...pos,
    rotation: Math.atan2(pos.y, pos.x) - Math.PI / 2,
  }));

  const mirrorZ = 0.06 + 0.129;
  const selectorZ = mirrorZ + 0.03; // etwas vor der Steckdose

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
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <mesh renderOrder={1000}>
            <circleGeometry args={[circleRadius, 32]} />
            <meshBasicMaterial
              color={new THREE.Color(0xf59e0b)}
              transparent={true}
              opacity={0.8}
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
          <group rotation={[0, 0, pos.rotation]} position={[0, 0, 0.002]}>
            <mesh position={[0, arrowHeadSize * 0.3, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([
                    0,
                    arrowHeadSize,
                    0,
                    arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
                    -arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
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

// Touch-Sensor als 3D-Modell auf dem Spiegel
function TouchSensor({
  corner,
  width,
  height,
}: {
  corner:
    | "top-left"
    | "top-center"
    | "top-right"
    | "right-center"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left"
    | "left-center"
    | null;
  width: number;
  height: number;
}) {
  const { scene } = useGLTF("/images/touch_sensor.glb");
  const touchSensorRef = useRef<THREE.Group>(null!);
  const touchSensorScene = useMemo(() => scene.clone(), [scene]);

  const sensorW = 0.18;
  const sensorH = 0.08;
  const offset = 0.06;

  let x = 0;
  let y = 0;
  if (corner === "top-left") {
    x = -width / 2 + sensorW / 2 + offset;
    y = height / 2 - sensorH / 2 - offset;
  } else if (corner === "top-center") {
    x = 0;
    y = height / 2 - sensorH / 2 - offset;
  } else if (corner === "top-right") {
    x = width / 2 - sensorW / 2 - offset;
    y = height / 2 - sensorH / 2 - offset;
  } else if (corner === "bottom-right") {
    x = width / 2 - sensorW / 2 - offset;
    y = -height / 2 + sensorH / 2 + offset;
  } else if (corner === "bottom-center") {
    x = 0;
    y = -height / 2 + sensorH / 2 + offset;
  } else if (corner === "bottom-left") {
    x = -width / 2 + sensorW / 2 + offset;
    y = -height / 2 + sensorH / 2 + offset;
  } else if (corner === "left-center") {
    x = -width / 2 + sensorW / 2 + offset;
    y = 0;
  } else if (corner === "right-center") {
    x = width / 2 - sensorW / 2 - offset;
    y = 0;
  }

  const mountDepth = 0.06;
  const mirrorPlaneZ = mountDepth + 0.146;
  const sensorZ = mirrorPlaneZ + 0.001;

  const baseWidth = 0.2;
  const baseHeight = 0.1;
  const scaleX = sensorW / baseWidth;
  const scaleY = sensorH / baseHeight;
  const scaleZ = (scaleX + scaleY) / 2;

  return (
    <group
      ref={touchSensorRef}
      position={[x, y, sensorZ]}
      rotation={[0, 0, 0]}
      scale={[scaleX, scaleY, scaleZ]}
    >
      <primitive object={touchSensorScene} />
    </group>
  );
}

// Auswahlkreise für Touch-Sensor-Position (analog zur Steckdose)
function TouchSensorPositionSelector({
  width,
  height,
  onSelect,
}: {
  width: number;
  height: number;
  onSelect: (
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center"
  ) => void;
}) {
  const circleRadius = 0.05;
  const arrowHeadSize = 0.025;
  const arrowTailLength = 0.035;
  const arrowTailWidth = 0.006;
  const distance = Math.min(width, height) * 0.25;

  const positions: Array<{
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center";
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

  const positionsWithRotation = positions.map((pos) => ({
    ...pos,
    rotation: Math.atan2(pos.y, pos.x) - Math.PI / 2,
  }));

  const mirrorZ = 0.06 + 0.129;
  const selectorZ = mirrorZ + 0.03; // etwas vor dem Touch-Sensor

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
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <mesh renderOrder={1000}>
            <circleGeometry args={[circleRadius, 32]} />
            <meshBasicMaterial
              color={new THREE.Color(0xf59e0b)}
              transparent={true}
              opacity={0.8}
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
          <group rotation={[0, 0, pos.rotation]} position={[0, 0, 0.002]}>
            <mesh position={[0, arrowHeadSize * 0.3, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([
                    0,
                    arrowHeadSize,
                    0,
                    arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
                    -arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
                  ])}
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

// Schminkspiegel als 3D-Modell auf dem Spiegel
function Schminkspiegel({
  corner,
  width,
  height,
}: {
  corner:
    | "top-left"
    | "top-center"
    | "top-right"
    | "right-center"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left"
    | "left-center"
    | null;
  width: number;
  height: number;
}) {
  const { scene } = useGLTF("/images/schminkspiegel_1.glb");
  const schminkspiegelRef = useRef<THREE.Group>(null!);
  const schminkspiegelScene = useMemo(() => scene.clone(), [scene]);

  // Розміри Schminkspiegel (менші)
  const mirrorW = 0.25;
  const mirrorH = 0.15;
  const offset = 0.06;

  // Замінюємо матеріали на дзеркальні з ефектом опуклої лупи
  useEffect(() => {
    schminkspiegelScene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Створюємо дзеркальний матеріал з опуклою лінзою (більша опуклість)
        const mirrorMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 1.0,
          roughness: 0.0, // Мінімальна шорсткість для максимального блиску
          clearcoat: 1.0,
          clearcoatRoughness: 0.0, // Ідеально гладкий покрив
          envMapIntensity: 4.5, // Високе відображення оточення
          transmission: 0.2, // Більша прозорість для ефекту опуклої лінзи
          thickness: 1.2, // Більша товщина для більшої опуклості
          ior: 1.9, // Вищий індекс заломлення для більшої опуклості
          emissive: 0x222222, // Легке підсвічування для кращої видимості
          emissiveIntensity: 0.3,
        });
        child.material = mirrorMaterial;
      }
    });
  }, [schminkspiegelScene]);

  let x = 0;
  let y = 0;
  if (corner === "top-left") {
    x = -width / 2 + mirrorW / 2 + offset;
    y = height / 2 - mirrorH / 2 - offset;
  } else if (corner === "top-center") {
    x = 0;
    y = height / 2 - mirrorH / 2 - offset;
  } else if (corner === "top-right") {
    x = width / 2 - mirrorW / 2 - offset;
    y = height / 2 - mirrorH / 2 - offset;
  } else if (corner === "bottom-right") {
    x = width / 2 - mirrorW / 2 - offset;
    y = -height / 2 + mirrorH / 2 + offset;
  } else if (corner === "bottom-center") {
    x = 0;
    y = -height / 2 + mirrorH / 2 + offset;
  } else if (corner === "bottom-left") {
    x = -width / 2 + mirrorW / 2 + offset;
    y = -height / 2 + mirrorH / 2 + offset;
  } else if (corner === "left-center") {
    x = -width / 2 + mirrorW / 2 + offset;
    y = 0;
  } else if (corner === "right-center") {
    x = width / 2 - mirrorW / 2 - offset;
    y = 0;
  }

  const mountDepth = 0.06;
  const mirrorPlaneZ = mountDepth + 0.146;
  const schminkspiegelZ = mirrorPlaneZ + 0.001; // Прикріплено до дзеркала

  const baseWidth = 0.2;
  const baseHeight = 0.1;
  const scaleX = mirrorW / baseWidth;
  const scaleY = mirrorH / baseHeight;
  const scaleZ = (scaleX + scaleY) / 2;

  return (
    <group
      ref={schminkspiegelRef}
      position={[x, y, schminkspiegelZ]}
      rotation={[0, Math.PI, 0]}
      scale={[scaleX, scaleY, scaleZ]}
    >
      <primitive object={schminkspiegelScene} />
    </group>
  );
}

// Auswahlkreise für Schminkspiegel-Position (analog zur Steckdose)
function SchminkspiegelPositionSelector({
  width,
  height,
  onSelect,
}: {
  width: number;
  height: number;
  onSelect: (
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center"
  ) => void;
}) {
  const circleRadius = 0.05;
  const arrowHeadSize = 0.025;
  const arrowTailLength = 0.035;
  const arrowTailWidth = 0.006;
  const distance = Math.min(width, height) * 0.25;

  const positions: Array<{
    corner:
      | "top-left"
      | "top-center"
      | "top-right"
      | "right-center"
      | "bottom-right"
      | "bottom-center"
      | "bottom-left"
      | "left-center";
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

  const positionsWithRotation = positions.map((pos) => ({
    ...pos,
    rotation: Math.atan2(pos.y, pos.x) - Math.PI / 2,
  }));

  const mirrorZ = 0.06 + 0.129;
  const selectorZ = mirrorZ + 0.08; // etwas vor dem Schminkspiegel

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
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <mesh renderOrder={1000}>
            <circleGeometry args={[circleRadius, 32]} />
            <meshBasicMaterial
              color={new THREE.Color(0xf59e0b)}
              transparent={true}
              opacity={0.8}
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
          <group rotation={[0, 0, pos.rotation]} position={[0, 0, 0.002]}>
            <mesh position={[0, arrowHeadSize * 0.3, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([
                    0,
                    arrowHeadSize,
                    0,
                    arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
                    -arrowHeadSize * 0.6,
                    -arrowHeadSize * 0.3,
                    0,
                  ])}
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
          {/* Orange Kreis rgba(245, 158, 11, 1) */}
          <mesh renderOrder={1000}>
            <circleGeometry args={[circleRadius, 32]} />
            <meshBasicMaterial 
              color={new THREE.Color(0xf59e0b)} // Farbe rgba(245, 158, 11, 1)
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

function MirrorDimensions({
  widthMm,
  heightMm
}: {
  widthMm: number;
  heightMm: number;
}) {
  const width = widthMm * MM_TO_M;
  const height = heightMm * MM_TO_M;
  const mountDepth = 0.06;
  const frameThickness = 0.035;
  
  // Розмір без рамки (зеркало без рамки)
  const mirrorWidth = width;
  const mirrorHeight = height;
  
  // Розміри монтажного блоку (менші за зеркало на frameThickness з кожного боку)
  const mountWidth = width - frameThickness * 2;
  const mountHeight = height - frameThickness * 2;
  
  // Відстань від краю монтажного блоку до мітки (50см = 0.5м)
  const labelOffsetFromMount = 0.5;
  // Відстань від краю монтажного блоку до лінії (20см = 0.2м)
  const lineOffsetFromMount = 0.2;
  
  // Позиції відносно центру сцени
  // Вирівнюємо відносно зеркала (не монтажного блоку)
  // Верхній край зеркала: mirrorHeight / 2
  // Лівий край зеркала: -mirrorWidth / 2
  const topLabelY = mirrorHeight / 2 + labelOffsetFromMount;
  const topLineY = mirrorHeight / 2 + lineOffsetFromMount;
  const leftLabelX = -mirrorWidth / 2 - labelOffsetFromMount;
  const leftLineX = -mirrorWidth / 2 - lineOffsetFromMount;
  
  // Debug: виводимо значення для перевірки
  console.log('MirrorDimensions:', {
    widthMm,
    heightMm,
    mountWidth,
    mountHeight,
    topLabelY,
    topLineY,
    leftLabelX,
    leftLineX,
    labelOffsetFromMount,
    lineOffsetFromMount
  });
  
  // Створюємо текстуру для пунктирної лінії (штрих 6см, проміжок 6см)
  const lineTexture = useMemo(() => {
    const dashLengthM = 0.06; // 6см в метрах
    const dashGapM = 0.06; // 6см проміжок в метрах
    const patternLengthM = dashLengthM + dashGapM;
    
    // Створюємо canvas з розміром, що відповідає паттерну
    // Використовуємо масштаб: 1 піксель = 0.001м (1мм)
    const pixelsPerMeter = 1000; // 1000 пікселів на метр
    const dashLengthPx = dashLengthM * pixelsPerMeter; // 60 пікселів для 6см
    const dashGapPx = dashGapM * pixelsPerMeter; // 60 пікселів для 6см
    const patternLengthPx = dashLengthPx + dashGapPx; // 120 пікселів
    
    const canvas = document.createElement('canvas');
    canvas.width = patternLengthPx;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    
    // Очищаємо canvas (прозорий фон)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Малюємо штрих
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(dashLengthPx, 2);
    ctx.stroke();
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // Налаштовуємо repeat так, щоб паттерн правильно повторювався
    // mirrorWidth в метрах, patternLengthM теж в метрах
    tex.repeat.set(mirrorWidth / patternLengthM, 1);
    return tex;
  }, [mirrorWidth]);
  
  const lineTextureVertical = useMemo(() => {
    const dashLengthM = 0.06; // 6см в метрах
    const dashGapM = 0.06; // 6см проміжок в метрах
    const patternLengthM = dashLengthM + dashGapM;
    
    // Створюємо canvas з розміром, що відповідає паттерну
    // Використовуємо масштаб: 1 піксель = 0.001м (1мм)
    const pixelsPerMeter = 1000; // 1000 пікселів на метр
    const dashLengthPx = dashLengthM * pixelsPerMeter; // 60 пікселів для 6см
    const dashGapPx = dashGapM * pixelsPerMeter; // 60 пікселів для 6см
    const patternLengthPx = dashLengthPx + dashGapPx; // 120 пікселів
    
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = patternLengthPx;
    const ctx = canvas.getContext('2d')!;
    
    // Очищаємо canvas (прозорий фон)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Малюємо штрих
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(2, dashLengthPx);
    ctx.stroke();
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // Налаштовуємо repeat так, щоб паттерн правильно повторювався
    // mirrorHeight в метрах, patternLengthM теж в метрах
    // Для вертикальної лінії, яка обертається, потрібно правильно налаштувати repeat
    const repeatValue = mirrorHeight / patternLengthM;
    tex.repeat.set(1, repeatValue);
    tex.flipY = false;
    tex.offset.set(0, 0);
    return tex;
  }, [mirrorHeight]);
  
  return (
    <group>
      {/* Верхня лінія - 15см від верхнього краю монтажного блоку */}
      <mesh position={[0, topLineY, -mountDepth + 0.21]}>
        <planeGeometry args={[mirrorWidth, 0.02]} />
        <meshBasicMaterial map={lineTexture} opacity={1} transparent={false} />
      </mesh>
      
      {/* Верхня мітка з розміром - 20см від верхнього краю монтажного блоку */}
      <Html
        position={[0, topLabelY, -mountDepth + 0.21]}
        center
        transform
        occlude={false}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(245, 158, 11, 1)',
          color: '#ffffff',
          padding: '4px 4px',
          borderRadius: '6px',
          fontSize: '6px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transform: 'translateX(-50%)'
        }}>
          {widthMm}mm
        </div>
      </Html>
      
      {/* Ліва лінія - 15см від лівого краю монтажного блоку */}
      <mesh position={[leftLineX, 0, -mountDepth + 0.21]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[mirrorHeight, 0.02]} />
        <meshBasicMaterial 
          map={lineTexture} 
          opacity={1} 
          transparent={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Ліва мітка з розміром - 20см від лівого краю монтажного блоку */}
      <Html
        position={[leftLabelX, 0, -mountDepth + 0.21]}
        center
        transform
        occlude={false}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(245, 158, 11, 1)',
          color: '#ffffff',
          padding: '4px 4px',
          borderRadius: '6px',
          fontSize: '6px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'center'
        }}>
          {heightMm}mm
        </div>
      </Html>
    </group>
  );
}

function MirrorObject({
  widthMm,
  heightMm,
  showroomLight,
  lightingMode = "none"
}: {
  widthMm: number;
  heightMm: number;
  showroomLight: boolean;
  lightingMode?: "none" | "sides" | "frame" | "top-sides";
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

  // Leuchtstreifen-Geometrie (Beleuchtung direkt auf dem Spiegel)
  const lightStrips: JSX.Element[] = [];
  if (lightingMode !== "none") {
    // Gemeinsame Parameter:
    const stripWidth = 0.03; // 30 mm
    const stripDepth = 0.002;
    const emissiveColor = new THREE.Color(0xf59e0b);
    // Spiegel-Ebene liegt bei mountDepth + 0.146 (siehe Spiegelmesh weiter unten).
    // Wir setzen die Leuchtstreifen minimal davor, damit sie "auf" dem Spiegel sitzen.
    const mirrorPlaneZ = mountDepth + 0.146;
    const stripZ = mirrorPlaneZ + 0.002;

    if (lightingMode === "top-sides") {
      // Variante laut Schema:
      // - Obere Leiste: 60 mm von links/rechts und 60 mm vom oberen Rand
      // - Vertikale Leisten: 40 mm von den Seiten, 60 mm vom unteren Rand,
      //   und 60 mm Abstand unterhalb der oberen Leiste.
      const topSideOffset = 0.06; // 60 mm
      const sideOffsetX = 0.04; // 40 mm
      const bottomOffset = 0.06; // 60 mm

      const topEdge = height / 2;
      const bottomEdge = -height / 2;

      // Obere Leiste
      const topStripLength = width - 2 * topSideOffset;
      const yTop = topEdge - topSideOffset - stripWidth / 2;
      lightStrips.push(
        <mesh key="top-strip" position={[0, yTop, stripZ]}>
          <boxGeometry args={[topStripLength, stripWidth, stripDepth]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={emissiveColor}
            emissiveIntensity={2.5}
          />
        </mesh>
      );

      // Vertikale Leisten
      const xLeft = -width / 2 + sideOffsetX + stripWidth / 2;
      const xRight = width / 2 - sideOffsetX - stripWidth / 2;

      const verticalTop = yTop - stripWidth / 2 - topSideOffset;
      const verticalBottom = bottomEdge + bottomOffset;
      const verticalHeight = verticalTop - verticalBottom;
      const verticalCenterY = (verticalTop + verticalBottom) / 2;

      [xLeft, xRight].forEach((x, idx) => {
        lightStrips.push(
          <mesh key={`vs-${idx}`} position={[x, verticalCenterY, stripZ]}>
            <boxGeometry args={[stripWidth, verticalHeight, stripDepth]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={emissiveColor}
              emissiveIntensity={2.5}
            />
          </mesh>
        );
      });
    } else {
      // Einfachere Varianten: feste 40 mm Abstand zu allen Kanten
      const edgeOffsetX = 0.04; // 40 mm von den Seiten
      const edgeOffsetYTop = 0.04; // 40 mm vom oberen Rand
      const edgeOffsetYBottom = 0.04; // 40 mm vom unteren Rand

      const addVerticalStrip = (x: number) => {
        const stripHeight = height - edgeOffsetYTop - edgeOffsetYBottom;
        lightStrips.push(
          <mesh key={`v-${x}`} position={[x, 0, stripZ]}>
            <boxGeometry args={[stripWidth, stripHeight, stripDepth]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={emissiveColor}
              emissiveIntensity={2.5}
            />
          </mesh>
        );
      };

      const addHorizontalStrip = (y: number) => {
        const stripLength = width - edgeOffsetX * 2;
        lightStrips.push(
          <mesh key={`h-${y}`} position={[0, y, stripZ]}>
            <boxGeometry args={[stripLength, stripWidth, stripDepth]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={emissiveColor}
              emissiveIntensity={2.5}
            />
          </mesh>
        );
      };

      // Seitenstreifen (links + rechts)
      if (lightingMode === "sides" || lightingMode === "frame") {
        const xLeft = -width / 2 + edgeOffsetX + stripWidth / 2;
        const xRight = width / 2 - edgeOffsetX - stripWidth / 2;
        addVerticalStrip(xLeft);
        addVerticalStrip(xRight);
      }

      // Obere Streifen je nach Schema
      if (lightingMode === "frame") {
        const yTop = height / 2 - edgeOffsetYTop - stripWidth / 2;
        addHorizontalStrip(yTop);
      }
    }
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

      {/* Leuchtstreifen auf der Spiegeloberfläche entsprechend dem gewählten Schema */}
      {lightStrips}

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

// Компонент для управління позицією камери
function CameraController({ view, controlsRef, showSocket, showTouchSensor, showSchminkspiegel }: { view?: "top" | "left" | "right" | "front"; controlsRef: React.MutableRefObject<any>; showSocket?: boolean; showTouchSensor?: boolean; showSchminkspiegel?: boolean }) {
  const { camera } = useThree();
  const prevShowSocketRef = useRef<boolean | undefined>(undefined);
  const prevShowTouchSensorRef = useRef<boolean | undefined>(undefined);
  const prevShowSchminkspiegelRef = useRef<boolean | undefined>(undefined);

  // Наближення/віддалення камери коли чекбокс розетки, тач-сенсора або шмінкшпігеля активний/неактивний
  useEffect(() => {
    const shouldZoom = showSocket || showTouchSensor || showSchminkspiegel;
    const prevShouldZoom = prevShowSocketRef.current || prevShowTouchSensorRef.current || prevShowSchminkspiegelRef.current;
    
    // Запускаємо анімацію тільки коли стан реально змінюється
    if (prevShouldZoom === shouldZoom) {
      return;
    }
    prevShowSocketRef.current = showSocket;
    prevShowTouchSensorRef.current = showTouchSensor;
    prevShowSchminkspiegelRef.current = showSchminkspiegel;

    // Якщо всі undefined, не робимо нічого
    if (showSocket === undefined && showTouchSensor === undefined && showSchminkspiegel === undefined) {
      return;
    }

    const target = new THREE.Vector3(0, 1.1, 0);
    const startPosition = new THREE.Vector3().copy(camera.position);
    
    let endPosition: THREE.Vector3;
    if (shouldZoom) {
      // Наближаємо камеру до зеркала (зменшуємо відстань до 2.5)
      const newDistance = 2.5;
      const direction = new THREE.Vector3().subVectors(startPosition, target).normalize();
      endPosition = new THREE.Vector3().addVectors(target, direction.multiplyScalar(newDistance));
    } else {
      // Віддаляємо камеру назад до початкової позиції (відстань 6.75)
      const defaultDistance = 6.75;
      const direction = new THREE.Vector3().subVectors(startPosition, target).normalize();
      // Якщо камера вже близько, використовуємо стандартний напрямок
      if (startPosition.distanceTo(target) < 4) {
        endPosition = new THREE.Vector3(defaultDistance, 1.1, 0);
      } else {
        endPosition = new THREE.Vector3().addVectors(target, direction.multiplyScalar(defaultDistance));
      }
    }
      
    const startTarget = controlsRef.current?.target ? new THREE.Vector3().copy(controlsRef.current.target) : target.clone();

    const wasEnabled = controlsRef.current?.enabled ?? true;
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    let progress = 0;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPosition, endPosition, easeProgress);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, target, easeProgress);
        controlsRef.current.update();
      } else {
        camera.lookAt(target);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        camera.position.copy(endPosition);
        if (controlsRef.current) {
          controlsRef.current.target.copy(target);
          controlsRef.current.update();
          // Повертаємо enabled одразу після завершення анімації
          controlsRef.current.enabled = wasEnabled;
        }
      }
    };

    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSocket, showTouchSensor, showSchminkspiegel]);

  useEffect(() => {
    if (!view) return;

    const target = new THREE.Vector3(0, 1.1, 0);
    let newPosition: [number, number, number];

    switch (view) {
      case "top":
        // Піднімаємо камеру майже вертикально вгору від початкової позиції
        // ТУТ ВПИСУЄТЬСЯ КУТ В ГРАДУСАХ (зараз 88° - майже вертикально вгору)
        const angleDegrees = 70;
        const angleRad = angleDegrees * (Math.PI / 180);
        // Початкова позиція: [6.75, 1.1, 0], target: [0, 1.1, 0]
        const distanceX = 6.75; // Відстань від target по X
        const initialY = 1.1; // Висота target
        const newY = initialY + distanceX * Math.tan(angleRad);
        newPosition = [6.75, newY, 0];
        break;
      case "left":
        // Повертаємо камеру на 54 градуси вліво від початкової позиції
        // Початкова позиція: [6.75, 1.1, 0], target: [0, 1.1, 0]
        // Відстань від target: 6.75
        const leftAngleDegrees = 70; // ТУТ ВПИСУЄТЬСЯ КУТ В ГРАДУСАХ
        const leftAngleRad = leftAngleDegrees * (Math.PI / 180);
        const distance = 6.75; // Відстань від target
        const leftX = distance * Math.cos(leftAngleRad);
        const leftZ = distance * Math.sin(leftAngleRad);
        newPosition = [leftX, 1.1, leftZ];
        break;
      case "right":
        // Повертаємо камеру на 70 градусів вправо від початкової позиції
        // Початкова позиція: [6.75, 1.1, 0], target: [0, 1.1, 0]
        // Відстань від target: 6.75
        const rightAngleDegrees = 70; // ТУТ ВПИСУЄТЬСЯ КУТ В ГРАДУСАХ
        const rightAngleRad = rightAngleDegrees * (Math.PI / 180);
        const rightDistance = 6.75; // Відстань від target
        const rightX = rightDistance * Math.cos(rightAngleRad);
        const rightZ = -rightDistance * Math.sin(rightAngleRad); // Мінус для обертання вправо
        newPosition = [rightX, 1.1, rightZ];
        break;
      case "front":
        // Повертаємо камеру до початкової позиції
        newPosition = [6.75, 1.1, 0];
        break;
      default:
        newPosition = [6.75, 1.1, 0];
    }

    // Плавна анімація переміщення камери
    const startPosition = new THREE.Vector3().copy(camera.position);
    const endPosition = new THREE.Vector3(...newPosition);
    const startTarget = controlsRef.current?.target ? new THREE.Vector3().copy(controlsRef.current.target) : target.clone();

    // Тимчасово вимикаємо OrbitControls під час анімації
    const wasEnabled = controlsRef.current?.enabled ?? true;
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    let progress = 0;
    const duration = 800; // мілісекунди
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Easing функція для плавності - ease-in-out для повільнішої середини
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPosition, endPosition, easeProgress);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, target, easeProgress);
        controlsRef.current.update();
      } else {
        camera.lookAt(target);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Фінальна позиція - встановлюємо точно
        camera.position.copy(endPosition);
        if (controlsRef.current) {
          controlsRef.current.target.copy(target);
          controlsRef.current.update();
          // Повертаємо enabled після невеликої затримки
          setTimeout(() => {
            if (controlsRef.current) {
              controlsRef.current.enabled = wasEnabled;
            }
          }, 100);
        }
      }
    };

    animate();
  }, [view, camera, controlsRef]);

  return null;
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
  onSocketCornerChange,
  showTouchSensor = false,
  touchSensorCorner = null,
  onTouchSensorCornerChange,
  showSchminkspiegel = false,
  schminkspiegelCorner = null,
  onSchminkspiegelCornerChange,
  showShelf = false,
  shelfWidthPercent = 80,
  shelfLengthMm,
  showHygieneMirror = false,
  hygieneMirrorCorner = "bottom-left",
  cameraView,
  showDimensions = false,
  lightingMode = "none"
}: MirrorSceneProps) {
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      shadows
      camera={{ position: [6.75, 1.1, 0], fov: 40 }}
      gl={{ toneMappingExposure: 3.5 }}
    >
      <color attach="background" args={["#ffffff"]} />

      <CameraController view={cameraView} controlsRef={controlsRef} showSocket={showSocket} showTouchSensor={showTouchSensor} showSchminkspiegel={showSchminkspiegel} />

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
        <MirrorObject
          widthMm={widthMm}
          heightMm={heightMm}
          showroomLight={showroomLight}
          lightingMode={lightingMode}
        />
        {showShelf && (
          <GlassShelf
            width={widthMm * MM_TO_M}
            height={heightMm * MM_TO_M}
            shelfLengthMm={
              shelfLengthMm ?? Math.max(Math.min(widthMm - 160, 1000), 500)
            }
          />
        )}
        {showSocket && (
          <>
            <Socket
              corner={socketCorner}
              width={widthMm * MM_TO_M}
              height={heightMm * MM_TO_M}
            />
            {socketCorner === null && onSocketCornerChange && (
              <SocketPositionSelector
                width={widthMm * MM_TO_M}
                height={heightMm * MM_TO_M}
                onSelect={onSocketCornerChange}
              />
            )}
          </>
        )}
        {showTouchSensor && (
          <>
            <TouchSensor
              corner={touchSensorCorner}
              width={widthMm * MM_TO_M}
              height={heightMm * MM_TO_M}
            />
            {touchSensorCorner === null && onTouchSensorCornerChange && (
              <TouchSensorPositionSelector
                width={widthMm * MM_TO_M}
                height={heightMm * MM_TO_M}
                onSelect={onTouchSensorCornerChange}
              />
            )}
          </>
        )}
        {showSchminkspiegel && (
          <>
            <Schminkspiegel
              corner={schminkspiegelCorner}
              width={widthMm * MM_TO_M}
              height={heightMm * MM_TO_M}
            />
            {schminkspiegelCorner === null && onSchminkspiegelCornerChange && (
              <SchminkspiegelPositionSelector
                width={widthMm * MM_TO_M}
                height={heightMm * MM_TO_M}
                onSelect={onSchminkspiegelCornerChange}
              />
            )}
          </>
        )}
        {showDimensions && (
          <MirrorDimensions widthMm={widthMm} heightMm={heightMm} />
        )}
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
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        zoomSpeed={0.7}
        rotateSpeed={0.7}
        maxPolarAngle={Math.PI / 1.1}
        target={[0, 1.1, 0]}
        minDistance={1}
        maxDistance={10}
      />
    </Canvas>
  );
}


