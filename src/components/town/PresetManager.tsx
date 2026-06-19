// Manage chat presets — add / rename / edit / delete. Saved to localStorage by
// the parent. A preset's text can contain "<prompt>" to mark where the cursor
// should land when the preset is dropped into the chat box.
import { useState } from 'react';
import { type ChatPreset, newId, PROMPT_MARK } from '../../lib/presets';

export function PresetManager({ presets, onSave, onClose }: {
  presets: ChatPreset[]; onSave: (list: ChatPreset[]) => void; onClose: () => void;
}) {
  const [list, setList] = useState<ChatPreset[]>(presets);
  const upd = (i: number, f: 'name' | 'text', v: string) => setList(list.map((p, j) => (j === i ? { ...p, [f]: v } : p)));
  const add = () => setList([...list, { id: newId(), name: 'New preset', text: PROMPT_MARK }]);
  const del = (i: number) => setList(list.filter((_, j) => j !== i));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="w-[min(560px,94vw)] max-h-[86vh] overflow-auto rounded-xl border border-white/15 bg-[#0c0c12] p-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[14px] text-white/90">⚡ Chat presets</span>
          <button onClick={onClose} className="text-white/50 hover:text-white/90 text-sm">✕</button>
        </div>
        <p className="text-[11px] text-white/45 mb-3">
          Put <code className="text-sky-300">{PROMPT_MARK}</code> where the cursor should wait for you to keep typing.
        </p>
        <div className="flex flex-col gap-3">
          {list.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-white/10 p-2">
              <div className="flex items-center gap-2 mb-1">
                <input value={p.name} onChange={(e) => upd(i, 'name', e.target.value)} placeholder="button name"
                  className="flex-1 rounded px-2 py-1 text-[12px] bg-[#101018] border border-white/10 text-white/90 outline-none" />
                <button onClick={() => del(i)} className="text-[11px] px-2 py-1 rounded"
                  style={{ background: '#f8717118', color: '#fca5a5' }}>delete</button>
              </div>
              <textarea value={p.text} onChange={(e) => upd(i, 'text', e.target.value)} rows={2}
                placeholder={`message…  use ${PROMPT_MARK} for the cursor spot`}
                className="w-full rounded px-2 py-1 text-[12px] bg-[#101018] border border-white/10 text-white/85 outline-none resize-y" />
            </div>
          ))}
          {!list.length && <p className="text-[12px] text-white/40 py-4 text-center">no presets — add one below</p>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={add} className="px-2.5 py-1 rounded text-[12px]"
            style={{ background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8055' }}>+ add preset</button>
          <button onClick={() => { onSave(list); onClose(); }} className="ml-auto px-3 py-1 rounded text-[12px]"
            style={{ background: '#818cf822', color: '#a5b4fc', border: '1px solid #818cf855' }}>save</button>
        </div>
      </div>
    </div>
  );
}
