import { useState, useEffect } from 'react';
import { getPlugins, loadPlugin } from '../api/oracle';
import type { PluginInfo } from '../api/oracle';

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ name: string; instance: WebAssembly.Instance; exports: string[] } | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [args, setArgs] = useState('');

  useEffect(() => {
    getPlugins().then(d => { setPlugins(d.plugins); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function loadWasm(name: string) {
    setOutput([`Loading ${name}.wasm...`]);
    try {
      const inst = await loadPlugin(name);
      const exports = Object.keys(inst.exports);
      setActive({ name, instance: inst, exports });
      setOutput(prev => [...prev, `✓ Loaded. Exports: ${exports.join(', ')}`]);
    } catch (e: any) {
      setOutput(prev => [...prev, `✗ Failed: ${e.message}`]);
    }
  }

  function callExport(fnName: string) {
    if (!active) return;
    const fn = active.instance.exports[fnName];
    if (typeof fn !== 'function') {
      setOutput(prev => [...prev, `${fnName} is not a function (${typeof fn})`]);
      return;
    }
    const parsed = args.trim() ? args.split(',').map(s => {
      const n = Number(s.trim());
      return isNaN(n) ? s.trim() : n;
    }) : [];
    try {
      const result = fn(...parsed);
      setOutput(prev => [...prev, `${fnName}(${parsed.join(', ')}) → ${result}`]);
    } catch (e: any) {
      setOutput(prev => [...prev, `${fnName}(${parsed.join(', ')}) ✗ ${e.message}`]);
    }
  }

  function readMemory() {
    if (!active) return;
    const mem = active.instance.exports.memory;
    if (!(mem instanceof WebAssembly.Memory)) {
      setOutput(prev => [...prev, 'No exported memory']);
      return;
    }
    const bytes = new Uint8Array(mem.buffer);
    // Find first null or read first 256 bytes
    let end = 0;
    while (end < 256 && bytes[end] !== 0) end++;
    const text = new TextDecoder().decode(bytes.slice(0, end));
    setOutput(prev => [...prev, `memory[0..${end}]: "${text}"`]);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0f]">
      <div className="max-w-[960px] mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">WASM Plugins</h1>
          <span className="text-sm font-mono text-white/40">{plugins.length} loaded</span>
        </div>

        {/* Plugin cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {loading && <div className="text-white/30 font-mono text-sm col-span-2">Loading...</div>}
          {plugins.map(p => (
            <button
              key={p.name}
              onClick={() => loadWasm(p.name)}
              className={`text-left px-5 py-4 rounded-xl border transition-all cursor-pointer ${
                active?.name === p.name
                  ? 'border-[#64b5f6]/40 bg-[#64b5f6]/10'
                  : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-base font-mono font-bold text-white">{p.name}</span>
                <span className="text-[10px] font-mono text-white/30 ml-auto">{formatSize(p.size)}</span>
              </div>
              <div className="text-xs font-mono text-white/35">{p.file}</div>
            </button>
          ))}
          {!loading && plugins.length === 0 && (
            <div className="text-white/20 font-mono text-sm col-span-2">
              No plugins found. Place .wasm files in ~/.oracle/plugins/
            </div>
          )}
        </div>

        {/* Active plugin console */}
        {active && (
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-white">{active.name}.wasm</span>
              <span className="text-xs font-mono text-white/30">
                {active.exports.filter(e => e !== 'memory').length} functions
              </span>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] flex-wrap">
              {active.exports.map(name => (
                <button
                  key={name}
                  onClick={() => name === 'memory' ? readMemory() : callExport(name)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-[#64b5f6]/30 text-[#64b5f6] bg-[#64b5f6]/10 hover:bg-[#64b5f6]/20 transition-all cursor-pointer"
                >
                  {name === 'memory' ? '🧠 read memory' : `${name}()`}
                </button>
              ))}
            </div>

            {/* Args input */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.06]">
              <span className="text-xs font-mono text-white/40">args:</span>
              <input
                type="text"
                value={args}
                onChange={e => setArgs(e.target.value)}
                placeholder="7, 8"
                className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-white placeholder:text-white/20 [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
                style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                inputMode="text"
              />
            </div>

            {/* Output console */}
            <div className="px-5 py-4 max-h-[400px] overflow-auto font-mono text-sm leading-relaxed">
              {output.map((line, i) => (
                <div key={i} className={`${
                  line.startsWith('✓') ? 'text-emerald-400'
                  : line.startsWith('✗') ? 'text-red-400'
                  : line.includes('→') ? 'text-[#64b5f6]'
                  : 'text-white/50'
                }`}>
                  {line}
                </div>
              ))}
              {output.length === 0 && (
                <span className="text-white/20">Click a function to call it</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
