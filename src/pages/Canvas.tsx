import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as THREE from 'three';

const PLUGINS = ['cube', 'galaxy', 'torus', 'graph3d', 'solar', 'wave', 'map3d'] as const;
type PluginName = typeof PLUGINS[number];

type PluginInstance = { tick?: () => void; dispose?: () => void };
type PluginModule = {
  default: {
    name: string;
    mount: (ctx: {
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      THREE: typeof THREE;
    }) => PluginInstance;
  };
};

export function Canvas() {
  const [params, setParams] = useSearchParams();
  const pluginName = (params.get('plugin') ?? 'cube') as PluginName;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 3;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const light = new THREE.PointLight(0xffffff, 50, 100);
    light.position.set(3, 3, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404060, 1));

    const setSize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    let instance: PluginInstance = {};
    let raf = 0;
    let disposed = false;

    (async () => {
      try {
        const mod: PluginModule = await import(/* @vite-ignore */ `/plugins/${pluginName}.mjs`);
        instance = mod.default.mount({ scene, camera, renderer, THREE });
        setLabel(`plugin: ${mod.default.name}`);
      } catch (err) {
        console.error('plugin load failed:', err);
        setLabel(`error loading '${pluginName}'`);
      }
      const tick = () => {
        if (disposed) return;
        instance.tick?.();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      instance.dispose?.();
      renderer.dispose();
    };
  }, [pluginName]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Canvas</h1>
      <p className="text-text-muted mb-4 text-sm">
        Three.js host for visual plugins. Swap plugin with{' '}
        <code className="text-accent">?plugin=&lt;name&gt;</code>. Each plugin is an ESM module that exports <code className="text-accent">mount()</code>.
      </p>

      <div className="flex gap-2 mb-4 text-sm flex-wrap">
        {PLUGINS.map((name) => (
          <button
            key={name}
            onClick={() => setParams({ plugin: name })}
            className={`px-3 py-1 rounded transition-colors ${
              name === pluginName
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'bg-bg-card hover:bg-bg-card/70 text-text-secondary'
            }`}
          >
            {name}
          </button>
        ))}
        <span className="ml-auto text-text-muted self-center">{label}</span>
      </div>

      <div
        ref={wrapRef}
        className="w-full h-[70vh] bg-black rounded-lg overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
