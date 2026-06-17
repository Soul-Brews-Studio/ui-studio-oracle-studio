// Agent text-session window: live-captures the agent's tmux pane and lets you
// type a line straight into it (Enter submits), plus a one-click "nudge" button.
import { useEffect, useRef, useState } from 'react';
import type { FleetAgent } from '../../lib/fleet';
import { capturePane, sendToPane } from '../../lib/fleet';
import { costumeFor, ctxColor } from '../../lib/role-costume';

export function AgentChat({ agent, onClose }: { agent: FleetAgent; onClose: () => void }) {
  const [text, setText] = useState('');
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  const cos = costumeFor(agent.role);

  useEffect(() => {
    let alive = true; const ac = new AbortController(); let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { const txt = await capturePane(agent.paneId, ac.signal); if (alive) { setText(txt); setErr(null); } }
      catch (e) { if (alive && (e as Error).name !== 'AbortError') setErr((e as Error).message); }
      finally { if (alive) t = setTimeout(tick, 1500); }
    };
    tick();
    return () => { alive = false; ac.abort(); clearTimeout(t); };
  }, [agent.paneId]);

  useEffect(() => {
    const el = preRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    try {
      await sendToPane(agent.paneId, msg);
      setInput('');
      stick.current = true;
      setTimeout(async () => { try { setText(await capturePane(agent.paneId)); } catch { /* next poll */ } }, 450);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex flex-col w-full max-w-3xl h-[80vh] rounded-xl border overflow-hidden shadow-2xl"
        style={{ background: '#0c0c12', borderColor: cos.color + '66' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <span style={{ fontSize: 16 }}>{cos.emoji}</span>
          <span className="font-semibold text-[13px]" style={{ color: cos.color }}>{cos.title}</span>
          {agent.label && agent.label !== 'oracle' && <span className="text-[11px] text-white/45 font-mono">·{agent.label}</span>}
          <span className="text-[10px] text-white/35 font-mono truncate">{agent.windowName}</span>
          {agent.ctxPct != null && (
            <span className="text-[11px] ml-auto font-mono" style={{ color: ctxColor(agent.ctxPct) }}>ctx {agent.ctxPct}%</span>
          )}
          <button onClick={onClose} className="ml-2 text-white/50 hover:text-white/90 text-sm">✕</button>
        </header>

        {err && <div className="px-3 py-1 text-[11px] text-red-300 bg-red-500/10">⚠ {err}</div>}

        <pre
          ref={preRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="flex-1 overflow-auto m-0 px-3 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words"
          style={{ background: '#08080c', color: '#cdd2cd', fontFamily: 'ui-monospace,Menlo,monospace' }}
        >
          {text || 'capturing session…'}
        </pre>

        <div className="flex items-center gap-2 p-2 border-t border-white/10">
          <button
            onClick={() => send('nudge')}
            disabled={busy}
            className="px-2.5 py-1.5 rounded text-[12px] shrink-0 disabled:opacity-50"
            style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2455' }}
            title="send the word 'nudge' + Enter"
          >👉 nudge</button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={`message ${cos.title}…`}
            disabled={busy}
            className="flex-1 rounded px-2.5 py-1.5 text-[12px] outline-none"
            style={{ background: '#101018', border: '1px solid rgba(255,255,255,0.12)', color: '#e0e0e0' }}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="px-3 py-1.5 rounded text-[12px] shrink-0 disabled:opacity-40"
            style={{ background: cos.color + '22', color: cos.color, border: `1px solid ${cos.color}55` }}
          >send ⏎</button>
        </div>
      </div>
    </div>
  );
}
