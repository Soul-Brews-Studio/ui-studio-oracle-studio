// Floor-texture picker for a town zone: pick a swatch → the zone's floor changes.
import { TEXTURES } from '../../lib/textures';

export function TexturePicker({ zoneLabel, current, onPick, onClose }: {
  zoneLabel: string; current: string; onPick: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rounded-xl border border-white/15 bg-[#0c0c12] p-4 w-[min(420px,92vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-white/90 font-semibold">🎨 Floor — <span className="text-white/55">{zoneLabel}</span></span>
          <button onClick={onClose} className="text-white/50 hover:text-white/90 text-sm">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TEXTURES.map((t) => (
            <button key={t.id} onClick={() => { onPick(t.id); onClose(); }}
              className="rounded-lg overflow-hidden border" style={{ borderColor: current === t.id ? '#7dd3fc' : 'rgba(255,255,255,0.12)' }}>
              <div style={{
                height: 50, imageRendering: 'pixelated',
                ...(t.url
                  ? { backgroundImage: `url(${t.url})`, backgroundSize: `${Math.min(t.size || 64, 64)}px`, backgroundRepeat: 'repeat' }
                  : { background: 'repeating-linear-gradient(45deg,#2a2f25,#2a2f25 6px,#20242c 6px,#20242c 12px)' }),
              }} />
              <div className="py-1 text-center text-[11px]"
                style={{ background: '#15151c', color: current === t.id ? '#7dd3fc' : 'rgba(255,255,255,0.75)' }}>{t.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
