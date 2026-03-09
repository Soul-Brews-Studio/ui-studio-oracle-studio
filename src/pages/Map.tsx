import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { getMap, getMap3d, getStats, getOracles, search } from '../api/oracle';
import type { MapDocument, Stats, OracleProject } from '../api/oracle';

const TYPE_COLORS: Record<string, string> = {
  principle: '#60a5fa',
  learning: '#a78bfa',
  retro: '#fbbf24',
  unknown: '#666666',
};

const TYPE_COLORS_NUM: Record<string, number> = {
  principle: 0x60a5fa,
  learning: 0xa78bfa,
  retro: 0xfbbf24,
  unknown: 0x666666,
};

// Globe colors — unique tint per engine
const GLOBE_COLORS: Record<string, number> = {
  'bge-m3': 0x6a5acd,   // slate indigo (original)
  'nomic': 0x2dd4bf,     // teal
  'qwen3': 0xfb923c,     // orange
};

// Triangle positions for 3 globes
const GLOBE_POSITIONS: THREE.Vector3[] = [
  new THREE.Vector3(0, 12, 0),       // top center
  new THREE.Vector3(-18, -8, 0),     // bottom left
  new THREE.Vector3(18, -8, 0),      // bottom right
];

// Damped spring tween
function cdsTween(state: { x: number; v: number }, target: number, speed: number, dt: number) {
  const n1 = state.v - (state.x - target) * (speed * speed * dt);
  const n2 = 1 + speed * dt;
  const nv = n1 / (n2 * n2);
  return { x: state.x + nv * dt, v: nv };
}

function xxhash(seed: number, data: number): number {
  let h = ((seed + 374761393) >>> 0);
  h = ((h + (data * 3266489917 >>> 0)) >>> 0);
  h = ((((h << 17) | (h >>> 15)) * 668265263) >>> 0);
  h ^= h >>> 15;
  h = ((h * 2246822519) >>> 0);
  h ^= h >>> 13;
  h = ((h * 3266489917) >>> 0);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise1D(p: number, seed: number): number {
  const i = Math.floor(p);
  const f = p - i;
  const u = f * f * (3 - 2 * f);
  const g0 = xxhash(seed, i) * 2 - 1;
  const g1 = xxhash(seed, i + 1) * 2 - 1;
  return g0 * (1 - u) + g1 * u;
}

function fractalNoise(p: number, octaves: number, seed: number): number {
  let f = 0, w = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    f += w * noise1D(p, seed + i);
    max += w;
    p *= 2;
    w *= 0.5;
  }
  return f / max;
}

function ageScale(createdAt: string | null): number {
  if (!createdAt) return 0.7;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 7) return 1.3;
  if (ageDays < 30) return 1.0;
  return 0.7;
}

interface GlobeData {
  key: string;
  model: string;
  count: number;
  documents: MapDocument[];
  center: THREE.Vector3;
}

export function Map() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [globes, setGlobes] = useState<GlobeData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oracleProjects, setOracleProjects] = useState<OracleProject[]>([]);
  const [totalOracles, setTotalOracles] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIds, setMatchIds] = useState<Set<string>>(new Set());
  const [hoveredDoc, setHoveredDoc] = useState<MapDocument | null>(null);
  const [searching, setSearching] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['principle', 'learning', 'retro']));

  const visibleTypesRef = useRef<Set<string>>(new Set(['principle', 'learning', 'retro']));
  const matchIdsRef = useRef<Set<string>>(new Set());
  const hoveredDocRef = useRef<MapDocument | null>(null);
  const animRef = useRef<number>(0);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mouseNDC = useRef(new THREE.Vector2(10, 10));
  const labelsRef = useRef<HTMLDivElement>(null);

  // Camera orbit state
  const camAngleX = useRef({ x: 0, v: 0 });
  const camAngleY = useRef({ x: 0.3, v: 0 });
  const camDist = useRef({ x: 55, v: 0 });
  const targetAngleX = useRef(0);
  const targetAngleY = useRef(0.3);
  const targetDist = useRef(55);
  const camTarget = useRef(new THREE.Vector3(0, 0, 0));
  const targetCenter = useRef(new THREE.Vector3(0, 0, 0));
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => { matchIdsRef.current = matchIds; }, [matchIds]);
  useEffect(() => { hoveredDocRef.current = hoveredDoc; }, [hoveredDoc]);
  useEffect(() => { visibleTypesRef.current = visibleTypes; }, [visibleTypes]);

  // Load data — fetch all models in parallel
  useEffect(() => {
    Promise.all([
      getStats().catch(() => null),
      getOracles().catch(() => ({ projects: [], total_projects: 0, identities: [], total_identities: 0 })),
    ]).then(async ([statsData, oraclesData]) => {
      setStats(statsData);
      setOracleProjects(oraclesData.projects);
      setTotalOracles(oraclesData.total_projects);

      // Get enabled models from stats
      const models = statsData?.vectors?.filter(v => v.enabled) || [];
      if (models.length === 0) {
        // Fallback: load default map
        const mapData = await getMap().catch(() => ({ documents: [], total: 0 }));
        setGlobes([{
          key: 'default',
          model: 'FTS5',
          count: mapData.total,
          documents: mapData.documents,
          center: new THREE.Vector3(0, 0, 0),
        }]);
        setLoading(false);
        return;
      }

      // Fetch map3d for each model in parallel
      const results = await Promise.all(
        models.map(async (m, i) => {
          try {
            const data = await getMap3d(m.key);
            return {
              key: m.key,
              model: m.model,
              count: m.count,
              documents: data.documents,
              center: GLOBE_POSITIONS[i % GLOBE_POSITIONS.length].clone(),
            };
          } catch {
            return {
              key: m.key,
              model: m.model,
              count: m.count,
              documents: [] as MapDocument[],
              center: GLOBE_POSITIONS[i % GLOBE_POSITIONS.length].clone(),
            };
          }
        })
      );

      setGlobes(results.filter(r => r.documents.length > 0));
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  // Three.js scene setup — multi-globe
  useEffect(() => {
    const container = containerRef.current;
    if (!container || globes.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 2000);
    camera.position.z = 55;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8,   // strength
      0.4,   // radius
      0.2,   // threshold
    );
    composer.addPass(bloomPass);

    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 5, 5);
    scene.add(directional);

    // Star field
    const starCount = 4000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let si = 0; si < starCount; si++) {
      starPositions[si * 3] = (Math.random() - 0.5) * 800;
      starPositions[si * 3 + 1] = (Math.random() - 0.5) * 800;
      starPositions[si * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Shared geometry
    const nodeGeometry = new THREE.SphereGeometry(0.05, 10, 10);
    const meshes: THREE.Mesh[] = [];
    const globeMeshes: THREE.LineSegments[] = [];
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Create globes and their document clouds
    globes.forEach((globe) => {
      const globeColor = GLOBE_COLORS[globe.key] || 0x6a5acd;
      const globeRadius = 8;
      const globeGeometry = new THREE.SphereGeometry(globeRadius, 32, 24);
      const globeWireframe = new THREE.WireframeGeometry(globeGeometry);
      const globeMaterial = new THREE.LineBasicMaterial({
        color: globeColor,
        opacity: 0.08,
        transparent: true,
      });
      const globeMesh = new THREE.LineSegments(globeWireframe, globeMaterial);
      globeMesh.position.copy(globe.center);
      scene.add(globeMesh);
      globeMeshes.push(globeMesh);

      // Connection lines between globes (subtle)
      if (globes.length > 1) {
        globes.forEach((other) => {
          if (other.key <= globe.key) return; // avoid duplicates
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            globe.center, other.center,
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x333355,
            opacity: 0.15,
            transparent: true,
          });
          scene.add(new THREE.Line(lineGeo, lineMat));
        });
      }

      // Nodes for this globe
      globe.documents.forEach((doc, i) => {
        const color = TYPE_COLORS_NUM[doc.type] || TYPE_COLORS_NUM.unknown;
        const baseScale = ageScale(doc.created_at);
        const material = new THREE.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.2,
          emissive: color,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 1.0,
        });

        const mesh = new THREE.Mesh(nodeGeometry, material);
        const z = doc.z != null ? doc.z : (xxhash(7, i) - 0.5) * 2;
        const basePos = new THREE.Vector3(
          globe.center.x + doc.x * 8,
          globe.center.y + doc.y * 8,
          globe.center.z + z * 5,
        );
        mesh.position.copy(basePos);
        mesh.userData = { doc, basePos, baseScale, globeKey: globe.key };
        scene.add(mesh);
        meshes.push(mesh);
      });
    });
    meshesRef.current = meshes;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(10, 10);

    function onMouseDown(e: MouseEvent) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
    }

    function onMouseUp(e: MouseEvent) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const wasDrag = Math.abs(dx) > 3 || Math.abs(dy) > 3;

      if (!wasDrag) {
        const rect = container!.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
          const doc = intersects[0].object.userData.doc as MapDocument;
          navigate(`/doc/${encodeURIComponent(doc.id)}`);
        }
      }
      isDragging.current = false;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouseNDC.current.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouseNDC.current.y = -((e.clientY - rect.top) / height) * 2 + 1;

      if (isDragging.current) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        targetAngleX.current = camAngleX.current.x + dx * 0.005;
        targetAngleY.current = Math.max(-1.2, Math.min(1.2, camAngleY.current.x - dy * 0.005));
        return;
      }

      mouse.x = mouseNDC.current.x;
      mouse.y = mouseNDC.current.y;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const doc = intersects[0].object.userData.doc as MapDocument;
        setHoveredDoc(doc);
        container!.style.cursor = 'pointer';
      } else {
        setHoveredDoc(null);
        container!.style.cursor = isDragging.current ? 'grabbing' : 'grab';
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.08 : 0.92;
      targetDist.current = Math.max(3, Math.min(500, targetDist.current * delta));
    }

    function onMouseLeave() {
      isDragging.current = false;
      setHoveredDoc(null);
      mouseNDC.current.set(10, 10);
    }

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mouseleave', onMouseLeave);

    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Proximity label pool
    const LABEL_POOL_SIZE = 8;
    const labelPool: HTMLDivElement[] = [];
    const labelsContainer = labelsRef.current;
    if (labelsContainer) {
      for (let i = 0; i < LABEL_POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'proximity-label';
        el.style.display = 'none';
        labelsContainer.appendChild(el);
        labelPool.push(el);
      }
    }

    // Globe label overlays (HTML)
    const globeLabelEls: HTMLDivElement[] = [];
    if (labelsContainer) {
      globes.forEach((globe) => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;font-size:11px;font-family:monospace;color:rgba(255,255,255,0.5);pointer-events:none;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;';
        el.textContent = `${globe.key} · ${globe.documents.length.toLocaleString()}`;
        labelsContainer.appendChild(el);
        globeLabelEls.push(el);
      });
    }

    // FPS counter
    let fpsFrames = 0;
    let fpsLastTime = performance.now();
    const fpsEl = document.createElement('div');
    fpsEl.className = 'proximity-label';
    fpsEl.style.cssText = 'position:absolute;top:8px;right:8px;font-size:11px;font-mono;color:#888;z-index:10;';
    container.appendChild(fpsEl);

    // Animation loop
    let time = 0;
    const dt = 1 / 60;
    const tempVec = new THREE.Vector3();
    const aspectRatio = width / height;

    function animate() {
      time += 0.016;

      fpsFrames++;
      const now = performance.now();
      if (now - fpsLastTime >= 1000) {
        fpsEl.textContent = `${fpsFrames} fps`;
        fpsFrames = 0;
        fpsLastTime = now;
      }

      if (!isDragging.current && !prefersReduced) {
        targetAngleX.current += 0.0003;
      }

      camAngleX.current = cdsTween(camAngleX.current, targetAngleX.current, 3, dt);
      camAngleY.current = cdsTween(camAngleY.current, targetAngleY.current, 3, dt);
      camDist.current = cdsTween(camDist.current, targetDist.current, 4, dt);

      const dist = camDist.current.x;

      // Scale bloom by distance
      const bloomScale = Math.max(0.1, Math.min(1.0, 18 / dist));
      bloomPass.strength = 0.8 * bloomScale;

      camera.position.x = Math.sin(camAngleX.current.x) * Math.cos(camAngleY.current.x) * dist;
      camera.position.y = Math.sin(camAngleY.current.x) * dist;
      camera.position.z = Math.cos(camAngleX.current.x) * Math.cos(camAngleY.current.x) * dist;

      camTarget.current.lerp(targetCenter.current, 0.05);
      const ct = camTarget.current;
      camera.position.x += ct.x;
      camera.position.y += ct.y;
      camera.position.z += ct.z;
      camera.lookAt(ct.x, ct.y, ct.z);

      // Rotate each globe
      globeMeshes.forEach((gm, gi) => {
        gm.rotation.y = time * 0.02 + gi * 0.7;
        gm.rotation.x = time * 0.005 + gi * 0.3;
      });

      // Update globe labels position
      globes.forEach((globe, gi) => {
        if (gi < globeLabelEls.length) {
          tempVec.copy(globe.center);
          tempVec.y -= 10.5; // below globe
          tempVec.project(camera);
          if (tempVec.z < 1) {
            const px = (tempVec.x + 1) * 0.5 * width;
            const py = (1 - (tempVec.y + 1) * 0.5) * height;
            globeLabelEls[gi].style.left = `${px}px`;
            globeLabelEls[gi].style.top = `${py}px`;
            globeLabelEls[gi].style.transform = 'translate(-50%, 0)';
            globeLabelEls[gi].style.display = '';
          } else {
            globeLabelEls[gi].style.display = 'none';
          }
        }
      });

      // Update nodes
      const matches = matchIdsRef.current;
      const hasSearch = matches.size > 0;
      const hovered = hoveredDocRef.current;
      const visTypes = visibleTypesRef.current;
      const mx = mouseNDC.current.x;
      const my = mouseNDC.current.y;

      const nearby: { screenDist: number; ndcX: number; ndcY: number; doc: MapDocument; color: string }[] = [];

      meshes.forEach((mesh, i) => {
        const doc = mesh.userData.doc as MapDocument;
        const basePos = mesh.userData.basePos as THREE.Vector3;
        const baseScale = mesh.userData.baseScale as number;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isHidden = !visTypes.has(doc.type);
        const isMatched = hasSearch && (matches.has(doc.id) || (doc.chunk_ids?.some(cid => matches.has(cid)) ?? false));
        const isFaded = hasSearch && !isMatched;

        mesh.visible = !isHidden;
        if (isHidden) return;

        if (!prefersReduced) {
          const t = time * 0.15;
          const dx = fractalNoise(t + i * 0.17, 2, 42) * 0.12;
          const dy = fractalNoise(t + i * 0.23, 2, 97) * 0.12;
          const dz = fractalNoise(t + i * 0.31, 2, 163) * 0.06;
          mesh.position.set(basePos.x + dx, basePos.y + dy, basePos.z + dz);
        }

        tempVec.copy(mesh.position).project(camera);
        const screenDist = Math.sqrt(
          Math.pow((tempVec.x - mx) * aspectRatio, 2) +
          Math.pow(tempVec.y - my, 2)
        );
        const magnifyRadius = 0.5;
        const magnifyFactor = screenDist < magnifyRadius
          ? 1 + 0.6 * Math.pow(1 - screenDist / magnifyRadius, 2)
          : 1;

        let scale = baseScale * magnifyFactor;
        if (isMatched) scale *= 1.4;
        mesh.scale.setScalar(scale);

        const baseGlow = isFaded ? 0.1 : 0.5;
        mat.emissiveIntensity = baseGlow + (magnifyFactor - 1) * 0.6;
        if (isMatched) mat.emissiveIntensity = 1.0;
        if (hovered?.id === doc.id) mat.emissiveIntensity = 1.2;

        mat.opacity = isFaded ? 0.05 : 1.0;

        if (!isFaded && screenDist < 0.5 && tempVec.z < 1) {
          nearby.push({
            screenDist,
            ndcX: tempVec.x,
            ndcY: tempVec.y,
            doc,
            color: TYPE_COLORS[doc.type] || TYPE_COLORS.unknown,
          });
        }
      });

      nearby.sort((a, b) => a.screenDist - b.screenDist);
      for (let li = 0; li < labelPool.length; li++) {
        const el = labelPool[li];
        if (li < nearby.length) {
          const n = nearby[li];
          const px = (n.ndcX + 1) * 0.5 * width;
          const py = (1 - (n.ndcY + 1) * 0.5) * height;
          const opacity = Math.max(0.3, 1 - n.screenDist / 0.5);
          el.textContent = extractTitle(n.doc.source_file);
          el.style.left = `${px + 10}px`;
          el.style.top = `${py - 8}px`;
          el.style.opacity = String(opacity);
          el.style.color = n.color;
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      }

      composer.render();
      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      fpsEl.remove();
      labelPool.forEach(el => el.remove());
      globeLabelEls.forEach(el => el.remove());
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);

      meshes.forEach((mesh) => {
        (mesh.material as THREE.Material).dispose();
        scene.remove(mesh);
      });
      nodeGeometry.dispose();
      // Dispose globe geometries
      scene.traverse((obj) => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) (obj as any).material.dispose();
      });
      composer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [globes, navigate]);

  // Search
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setMatchIds(new Set());
      return;
    }
    setSearching(true);
    try {
      const data = await search(searchQuery, 'all', 50, 'hybrid');
      setMatchIds(new Set(data.results.map(r => r.id)));
    } finally {
      setSearching(false);
    }
  }

  // Fly to a specific globe
  function flyToGlobe(index: number) {
    if (index < globes.length) {
      const center = globes[index].center;
      targetCenter.current.set(center.x, center.y, center.z);
      targetDist.current = 18;
    }
  }

  // Total documents across all globes
  const totalDocs = globes.reduce((sum, g) => sum + g.documents.length, 0);

  // Type counts across all globes
  const typeCounts = globes.reduce((acc, g) => {
    g.documents.forEach(d => { acc[d.type] = (acc[d.type] || 0) + 1; });
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3">
        <div className="text-lg text-text-primary">Loading knowledge map...</div>
        <div className="text-[13px] text-text-muted">Fetching embeddings from all engines...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3">
        <div className="text-base text-[#ef4444]">Failed to load map: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        <form onSubmit={handleSearch} className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search to highlight region..."
            className="w-[300px] px-4 py-2.5 rounded-[10px] text-sm text-text-primary border border-white/[0.08] outline-none backdrop-blur-xl transition-colors duration-200 focus:border-accent placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
            style={{ background: 'rgba(10, 10, 20, 0.7)', WebkitAppearance: 'none' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setMatchIds(new Set()); }}
              className="px-3.5 py-2 rounded-[10px] text-xs text-text-secondary cursor-pointer border border-white/[0.08] backdrop-blur-xl transition-all duration-200 hover:border-accent hover:text-accent"
              style={{ background: 'rgba(10, 10, 20, 0.7)' }}
            >
              Clear
            </button>
          )}
          {searching && <span className="w-2 h-2 rounded-full bg-accent animate-search-pulse" />}
        </form>

        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ background: '#05050a' }} />
        <div ref={labelsRef} className="absolute inset-0 pointer-events-none z-[5] overflow-hidden" />

        {totalDocs === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] gap-3" style={{ background: 'rgba(5, 5, 10, 0.9)' }}>
            <div className="text-[22px] font-bold text-text-primary">No Embeddings Yet</div>
            <div className="text-sm text-text-muted text-center leading-relaxed">
              The 3D map requires vector embeddings from LanceDB.<br />
              Run a vector index to populate the map.
            </div>
          </div>
        )}

        {hoveredDoc && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-[10px] px-5 py-3 z-20 pointer-events-none backdrop-blur-xl border border-white/[0.08] text-center"
            style={{ background: 'rgba(10, 10, 20, 0.75)' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: TYPE_COLORS[hoveredDoc.type] }}>
              {hoveredDoc.type}
            </div>
            <div className="text-sm text-text-primary font-medium">{extractTitle(hoveredDoc.source_file)}</div>
            {hoveredDoc.concepts.length > 0 && (
              <div className="text-[11px] text-text-muted mt-1">
                {hoveredDoc.concepts.slice(0, 4).join(', ')}
              </div>
            )}
          </div>
        )}

        <div
          className="absolute bottom-4 left-4 flex gap-1 rounded-[10px] px-2 py-1.5 text-[11px] text-text-secondary backdrop-blur-xl border border-white/[0.08]"
          style={{ background: 'rgba(10, 10, 20, 0.7)' }}
        >
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => {
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => setVisibleTypes(prev => {
                  const next = new Set(prev);
                  if (next.has(type)) next.delete(type);
                  else next.add(type);
                  return next;
                })}
                className={`flex items-center gap-[5px] px-2 py-1 rounded-md cursor-pointer border-none transition-all duration-150 ${active ? 'opacity-100' : 'opacity-30'}`}
                style={{ background: active ? `${color}15` : 'transparent' }}
              >
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
                {type}
              </button>
            );
          })}
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <button
            onClick={() => { targetDist.current = Math.max(3, targetDist.current * 0.75); }}
            className="w-9 h-9 rounded-[10px] text-text-primary text-lg font-medium cursor-pointer flex items-center justify-center backdrop-blur-xl border border-white/[0.08] transition-all duration-200 hover:border-accent hover:text-accent"
            style={{ background: 'rgba(10, 10, 20, 0.7)' }}
          >+</button>
          <button
            onClick={() => { targetDist.current = Math.min(500, targetDist.current * 1.35); }}
            className="w-9 h-9 rounded-[10px] text-text-primary text-lg font-medium cursor-pointer flex items-center justify-center backdrop-blur-xl border border-white/[0.08] transition-all duration-200 hover:border-accent hover:text-accent"
            style={{ background: 'rgba(10, 10, 20, 0.7)' }}
          >-</button>
          <button
            onClick={() => {
              targetAngleX.current = 0;
              targetAngleY.current = 0.3;
              targetDist.current = 55;
              targetCenter.current.set(0, 0, 0);
            }}
            className="w-9 h-9 rounded-[10px] text-text-primary text-lg font-medium cursor-pointer flex items-center justify-center backdrop-blur-xl border border-white/[0.08] transition-all duration-200 hover:border-accent hover:text-accent"
            style={{ background: 'rgba(10, 10, 20, 0.7)' }}
            title="Reset view (all globes)"
          >R</button>
          <button
            onClick={() => {
              const meshes = meshesRef.current;
              let cx = 0, cy = 0, cz = 0, count = 0;
              meshes.forEach(m => {
                if (m.visible) { cx += m.position.x; cy += m.position.y; cz += m.position.z; count++; }
              });
              if (count > 0) {
                targetCenter.current.set(cx / count, cy / count, cz / count);
                targetDist.current = 6;
              }
            }}
            className="w-9 h-9 rounded-[10px] text-text-primary text-lg font-medium cursor-pointer flex items-center justify-center backdrop-blur-xl border border-white/[0.08] transition-all duration-200 hover:border-accent hover:text-accent"
            style={{ background: 'rgba(10, 10, 20, 0.7)' }}
            title="Center on visible dots"
          >C</button>
        </div>
      </div>

      <div className="w-[260px] bg-bg-card border-l border-border p-6 flex flex-col overflow-hidden">
        <h2 className="text-xl font-bold text-text-primary mb-1">Knowledge Map</h2>
        <span className="text-[11px] font-mono text-text-muted mb-4 block">{globes.length} engine{globes.length !== 1 ? 's' : ''} loaded</span>
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
          {stats?.total && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-text-primary tabular-nums">{stats.total.toLocaleString()}</span>
              <span className="text-xs text-text-muted">Total Indexed</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-text-primary tabular-nums">{totalDocs.toLocaleString()}</span>
            <span className="text-xs text-text-muted">Documents Mapped</span>
          </div>
          {Object.entries(typeCounts).map(([type, count]) => {
            const chunks = stats?.by_type?.[type];
            return (
              <div key={type} className="flex flex-col gap-0.5">
                <span className="text-xl font-bold tabular-nums" style={{ color: TYPE_COLORS[type] }}>{count.toLocaleString()}</span>
                <span className="text-xs text-text-muted capitalize">
                  {type}s{chunks && chunks !== count ? ` (${chunks.toLocaleString()} chunks)` : ''}
                </span>
              </div>
            );
          })}
          {globes.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wide text-text-muted">Embedding Globes</span>
                <span className="text-[9px] font-mono text-text-muted">LanceDB</span>
              </div>
              {globes.map((globe, gi) => {
                const globeColor = `#${(GLOBE_COLORS[globe.key] || 0x6a5acd).toString(16).padStart(6, '0')}`;
                return (
                  <button
                    key={globe.key}
                    onClick={() => flyToGlobe(gi)}
                    className="flex flex-col gap-0.5 p-2 rounded-lg border border-border bg-white/[0.02] hover:border-border-hover cursor-pointer text-left transition-all duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: globeColor }} />
                        <span className="text-sm font-semibold text-text-primary">{globe.key}</span>
                      </div>
                      <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-success/20 text-success">
                        {globe.documents.length.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted font-mono ml-[18px]">{globe.model}</span>
                  </button>
                );
              })}
            </>
          )}
          {totalOracles > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <span className="text-xs font-mono uppercase tracking-wide text-text-muted">Oracle Universe</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xl font-bold text-accent tabular-nums">{totalOracles}</span>
                <span className="text-xs text-text-muted">Repos Indexed</span>
              </div>
              <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
                {oracleProjects.map(p => {
                  const name = p.project.split('/').pop() || p.project;
                  const org = p.project.split('/').slice(-2, -1)[0] || '';
                  const age = Date.now() - p.last_indexed;
                  const ageLabel = age < 3600_000 ? '<1h' : age < 86400_000 ? `${Math.floor(age / 3600_000)}h` : `${Math.floor(age / 86400_000)}d`;
                  return (
                    <div key={p.project} className="flex items-center justify-between py-0.5 gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-text-primary truncate" title={p.project}>{name}</span>
                        <span className="text-[9px] text-text-muted truncate">{org}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-text-muted tabular-nums">{p.docs}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${age < 86400_000 ? 'bg-success' : age < 604800_000 ? 'bg-warning' : 'bg-text-muted'}`} title={ageLabel + ' ago'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {matchIds.size > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xl font-bold tabular-nums" style={{ color: '#4ade80' }}>{matchIds.size}</span>
                <span className="text-xs text-text-muted capitalize">Search Matches</span>
              </div>
            </>
          )}
        </div>
        <div className="text-[11px] text-text-muted mt-6 leading-relaxed">
          Drag to orbit. Scroll to zoom. Click globe in sidebar to fly.
        </div>
      </div>
    </div>
  );
}

function extractTitle(sourceFile: string): string {
  const parts = sourceFile.split('/');
  const filename = parts[parts.length - 1] || sourceFile;
  return filename.replace(/\.md$/, '').replace(/_/g, ' ');
}
