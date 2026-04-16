import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackSide,
  BoxGeometry,
  EquirectangularReflectionMapping,
  Mesh,
  MeshStandardMaterial,
  Spherical,
  SphereGeometry,
  type Group,
  type Material,
  type PerspectiveCamera,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { PreviewGeometry } from '../Viewer';
import {
  DEFAULT_CAMERA_POSITION,
  ENV_MAP_URL,
  PREVIEW_TARGET_SIZE,
  TOTEM_MODEL_URL,
  collectMaterials,
  createUvPlaneGeometry,
  disposeMaterials,
  ensureTangents,
  normalizePreviewModel,
} from './geometry-utils';

interface ViewerSceneProps {
  previewGeometry: PreviewGeometry;
  nodeMaterial?: MeshPhysicalNodeMaterial;
  backgroundMaterial?: MeshPhysicalNodeMaterial;
  enableControls: boolean;
  idleAutoRotate: boolean;
  onCameraReady: (camera: PerspectiveCamera | null) => void;
  onControlsReady: (controls: OrbitControlsImpl | null) => void;
  onPreviewGeometryErrorChange: (message?: string) => void;
  onPreviewGeometryFallback: (geometry: PreviewGeometry) => void;
}

const AUTO_SWAY_AMPLITUDE = Math.PI / 4;
const AUTO_SWAY_SPEED = 0.4;

function TotemMesh({
  visible,
  material,
  fallbackMaterial,
  onPreviewGeometryErrorChange,
  onPreviewGeometryFallback,
}: {
  visible: boolean;
  material?: MeshPhysicalNodeMaterial;
  fallbackMaterial: MeshStandardMaterial;
  onPreviewGeometryErrorChange: (message?: string) => void;
  onPreviewGeometryFallback: (geometry: PreviewGeometry) => void;
}) {
  const [root, setRoot] = useState<Group | null>(null);
  const [materialMeshes, setMaterialMeshes] = useState<Mesh[]>([]);
  const originalMaterialsRef = useRef<Set<Material>>(new Set());
  const originalMaterialsDisposedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync(TOTEM_MODEL_URL);
        if (cancelled) {
          return;
        }

        const totemRoot = gltf.scene;
        normalizePreviewModel(totemRoot, PREVIEW_TARGET_SIZE);

        const allMeshes: Mesh[] = [];
        totemRoot.traverse((entry) => {
          const maybeMesh = entry as Mesh & { isMesh?: boolean };
          if (maybeMesh.isMesh === true) {
            allMeshes.push(maybeMesh);
          }
        });

        const totemGeometries = new Set(allMeshes.map((mesh) => mesh.geometry).filter(Boolean));
        for (const geometry of totemGeometries) {
          void (await ensureTangents(geometry));
        }

        const namedMeshes = allMeshes.filter(
          (mesh) => mesh.name === 'Calibration_Mesh' || mesh.name === 'Preview_Mesh',
        );
        const resolvedMeshes = namedMeshes.length > 0 ? namedMeshes : allMeshes;
        const originalMaterials = new Set<Material>();
        for (const mesh of resolvedMeshes) {
          for (const entry of collectMaterials(mesh)) {
            originalMaterials.add(entry);
          }
        }

        originalMaterialsRef.current = originalMaterials;
        originalMaterialsDisposedRef.current = false;
        setMaterialMeshes(resolvedMeshes);
        setRoot(totemRoot);
        onPreviewGeometryErrorChange(undefined);
      } catch {
        onPreviewGeometryErrorChange('Could not load ShaderBall totem model; falling back to primitive previews.');
        onPreviewGeometryFallback('sphere');
      }
    };

    void loadModel();

    return () => {
      cancelled = true;
    };
  }, [onPreviewGeometryErrorChange, onPreviewGeometryFallback]);

  useEffect(() => {
    if (materialMeshes.length === 0) {
      return;
    }

    const resolvedMaterial = material ?? fallbackMaterial;
    for (const mesh of materialMeshes) {
      mesh.material = resolvedMaterial;
    }

    if (!originalMaterialsDisposedRef.current) {
      for (const originalMaterial of originalMaterialsRef.current) {
        if (originalMaterial !== resolvedMaterial) {
          originalMaterial.dispose();
        }
      }
      originalMaterialsRef.current.clear();
      originalMaterialsDisposedRef.current = true;
    }
  }, [fallbackMaterial, material, materialMeshes]);

  useEffect(() => {
    return () => {
      if (!originalMaterialsDisposedRef.current) {
        disposeMaterials(originalMaterialsRef.current);
        originalMaterialsRef.current.clear();
      }
      if (root) {
        root.traverse((entry) => {
          const maybeMesh = entry as Mesh & { isMesh?: boolean };
          if (maybeMesh.isMesh === true) {
            maybeMesh.geometry.dispose();
          }
        });
      }
    };
  }, [root]);

  if (!root) {
    return null;
  }

  return <primitive object={root} visible={visible} dispose={null} />;
}

export function ViewerScene({
  previewGeometry,
  nodeMaterial,
  backgroundMaterial,
  enableControls,
  idleAutoRotate,
  onCameraReady,
  onControlsReady,
  onPreviewGeometryErrorChange,
  onPreviewGeometryFallback,
}: ViewerSceneProps) {
  const { camera, scene } = useThree();
  const [controls, setControls] = useState<OrbitControlsImpl | null>(null);
  const isInteractingRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const autoSphericalRef = useRef(new Spherical());
  const autoOffsetRef = useRef(new Vector3());

  const sphereGeometry = useMemo(() => new SphereGeometry(0.9, 96, 96), []);
  const cubeGeometry = useMemo(() => new BoxGeometry(1.45, 1.45, 1.45), []);
  const planeGeometry = useMemo(() => createUvPlaneGeometry(PREVIEW_TARGET_SIZE), []);
  const backgroundSphereGeometry = useMemo(() => new SphereGeometry(20, 64, 64), []);
  const defaultMaterial = useMemo(
    () => new MeshStandardMaterial({ color: 0xc5d4db, metalness: 0, roughness: 0.5 }),
    [],
  );
  const defaultBackgroundMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x999999,
        roughness: 1,
        metalness: 0,
        side: BackSide,
      }),
    [],
  );
  useEffect(() => {
    void ensureTangents(sphereGeometry);
    void ensureTangents(cubeGeometry);
    void ensureTangents(planeGeometry);
  }, [cubeGeometry, planeGeometry, sphereGeometry]);

  useEffect(() => {
    return () => {
      sphereGeometry.dispose();
      cubeGeometry.dispose();
      planeGeometry.dispose();
      backgroundSphereGeometry.dispose();
      defaultMaterial.dispose();
      defaultBackgroundMaterial.dispose();
    };
  }, [
    backgroundSphereGeometry,
    cubeGeometry,
    defaultBackgroundMaterial,
    defaultMaterial,
    planeGeometry,
    sphereGeometry,
  ]);

  useEffect(() => {
    if (backgroundMaterial) {
      backgroundMaterial.side = BackSide;
    }
  }, [backgroundMaterial]);

  useEffect(() => {
    let cancelled = false;
    let texture: Awaited<ReturnType<HDRLoader['loadAsync']>> | undefined;

    const loadEnvironment = async () => {
      try {
        const nextTexture = await new HDRLoader().loadAsync(ENV_MAP_URL);
        if (cancelled) {
          nextTexture.dispose();
          return;
        }
        nextTexture.mapping = EquirectangularReflectionMapping;
        texture = nextTexture;
        scene.environment = nextTexture;
      } catch (error) {
        console.warn('Failed to load viewer environment map', error);
      }
    };

    void loadEnvironment();

    return () => {
      cancelled = true;
      if (scene.environment === texture) {
        scene.environment = null;
      }
      texture?.dispose();
    };
  }, [scene]);

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    perspectiveCamera.position.set(DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.y, DEFAULT_CAMERA_POSITION.z);
    perspectiveCamera.lookAt(0, 0, 0);
    onCameraReady(perspectiveCamera);
    return () => {
      onCameraReady(null);
    };
  }, [camera, onCameraReady]);

  const setControlsRef = useCallback(
    (controls: OrbitControlsImpl | null) => {
      setControls(controls);
      onControlsReady(controls);
    },
    [onControlsReady],
  );

  useEffect(() => {
    if (!enableControls) {
      onControlsReady(null);
    }
  }, [enableControls, onControlsReady]);

  useEffect(() => {
    if (!controls) {
      return;
    }

    const markInteractionStart = () => {
      isInteractingRef.current = true;
      hasUserInteractedRef.current = true;
    };

    const markInteractionEnd = () => {
      isInteractingRef.current = false;
      hasUserInteractedRef.current = true;
    };

    const domElement = controls.domElement;
    controls.addEventListener('start', markInteractionStart);
    controls.addEventListener('end', markInteractionEnd);
    domElement.addEventListener('wheel', markInteractionEnd, { passive: true });

    return () => {
      controls.removeEventListener('start', markInteractionStart);
      controls.removeEventListener('end', markInteractionEnd);
      domElement.removeEventListener('wheel', markInteractionEnd);
    };
  }, [controls]);

  useFrame(({ clock }) => {
    if (!enableControls || !idleAutoRotate || !controls || isInteractingRef.current || hasUserInteractedRef.current) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const phase = elapsed;
    const targetAzimuth = AUTO_SWAY_AMPLITUDE * Math.sin(phase * AUTO_SWAY_SPEED);
    const offset = autoOffsetRef.current;
    const spherical = autoSphericalRef.current;
    offset.copy(controls.object.position).sub(controls.target);
    spherical.setFromVector3(offset);
    const nextAzimuth = spherical.theta + (targetAzimuth - spherical.theta) * 0.06;
    if (Math.abs(nextAzimuth - spherical.theta) < 0.0001) {
      return;
    }

    spherical.theta = nextAzimuth;
    offset.setFromSpherical(spherical);
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
  });

  const activeMaterial = nodeMaterial ?? defaultMaterial;

  return (
    <>
      <directionalLight intensity={1.1} position={[2, 3, 4]} />
      <mesh geometry={sphereGeometry} material={activeMaterial} visible={previewGeometry === 'sphere'} />
      <mesh geometry={cubeGeometry} material={activeMaterial} visible={previewGeometry === 'cube'} />
      <mesh geometry={planeGeometry} material={activeMaterial} visible={previewGeometry === 'plane'} />
      <TotemMesh
        fallbackMaterial={defaultMaterial}
        material={nodeMaterial}
        onPreviewGeometryErrorChange={onPreviewGeometryErrorChange}
        onPreviewGeometryFallback={onPreviewGeometryFallback}
        visible={previewGeometry === 'totem'}
      />
      <mesh geometry={backgroundSphereGeometry} material={backgroundMaterial ?? defaultBackgroundMaterial} visible />
      {enableControls ? <OrbitControls ref={setControlsRef} enableDamping enablePan={false} /> : null}
    </>
  );
}
