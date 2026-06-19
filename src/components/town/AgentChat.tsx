// Agent text-session window: a deep conversation History (session transcript) +
// a Live tab (current TUI screen, for driving menus). You can type a line straight
// into the pane (Enter submits), tap TUI nav keys, or one-click "nudge".
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FleetAgent } from '../../lib/fleet';
import { capturePane, fetchTranscript, sendToPane, sendKeyToPane, closePaneSession, fetchRoles, newAgent, type AgentPlan } from '../../lib/fleet';
import { costumeFor, ctxColor } from '../../lib/role-costume';
import { loadPresets, savePresets, PROMPT_MARK, type ChatPreset } from '../../lib/presets';
import { PresetManager } from './PresetManager';

const NAV_KEYS: Array<[string, string]> = [['↑', 'up'], ['↓', 'down'], ['←', 'left'], ['→', 'right']];
type Tab = 'history' | 'live';

// Turn bare URLs in the pane/transcript text into clickable links (new tab).
const URL_RE = /(https?:\/\/[^\s<>"'`)\]}]+)/g;
function linkify(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0, m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    let url = m[0], trail = '';
    const tm = url.match(/[.,;:!?)\]]+$/); // don't swallow trailing punctuation
    if (tm) { trail = tm[0]; url = url.slice(0, -trail.length); }
    out.push(<a key={i++} href={url} target="_blank" rel="noreferrer" style={{ color: '#7dd3fc', textDecoration: 'underline' }}>{url}</a>);
    if (trail) out.push(trail);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function AgentChat({ agent, onClose }: { agent: FleetAgent; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('live');
  const [text, setText] = useState('');
  // Persist the unsent draft per agent — survives closing/reopening the window.
  const draftKey = `town:draft:${agent.id}`;
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [presets, setPresets] = useState<ChatPreset[]>(loadPresets);
  const [managing, setManaging] = useState(false);
  const [plans, setPlans] = useState<AgentPlan[]>([]);
  const [switching, setSwitching] = useState(false);
  // A spawnable slug (its worktree/campaign) — switch only makes sense for these.
  const slug = agent.label && agent.label !== 'oracle' ? agent.label : '';

  useEffect(() => { fetchRoles().then((r) => setPlans(r.plans)).catch(() => {}); }, []);

  // Switch this agent to another Claude account: respawn role+slug on the new
  // account (maw reuses the worktree), then close the old pane. Ends this session.
  const switchPlan = async (planId: string) => {
    if (!slug || switching) return;
    setSwitching(true); setErr(null);
    try {
      await newAgent(agent.role, slug, planId);   // fresh session on the chosen account
      await closePaneSession(agent.paneId);        // retire the old pane
      onClose();
    } catch (e) { setErr((e as Error).message); setSwitching(false); }
  };
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const cos = costumeFor(agent.role);
  const body = useMemo<ReactNode>(() => (text ? linkify(text) : 'capturing session…'), [text]);

  // Live = current TUI screen (the pane has no scrollback); History = full transcript.
  const load = (signal?: AbortSignal) =>
    tab === 'live' ? capturePane(agent.paneId, signal) : fetchTranscript(agent.paneId, signal);

  useEffect(() => {
    let alive = true; const ac = new AbortController(); let t: ReturnType<typeof setTimeout>;
    const ms = tab === 'live' ? 1500 : 4000;
    const tick = async () => {
      try { const txt = await load(ac.signal); if (alive) { setText(txt); setErr(null); } }
      catch (e) { if (alive && (e as Error).name !== 'AbortError') setErr((e as Error).message); }
      finally { if (alive) t = setTimeout(tick, ms); }
    };
    setText(''); stick.current = true; tick();
    return () => { alive = false; ac.abort(); clearTimeout(t); };
  }, [agent.paneId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = preRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  useEffect(() => {
    try { if (input) localStorage.setItem(draftKey, input); else localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [input, draftKey]);

  // Esc closes the window. (To send Escape to the agent's TUI menu, use the esc nav button.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const refreshSoon = (ms: number) => setTimeout(async () => {
    try { setText(await load()); } catch { /* next poll */ }
  }, ms);

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    try {
      await sendToPane(agent.paneId, msg);
      setInput('');
      if (taRef.current) taRef.current.style.height = 'auto'; // collapse the grown textarea
      stick.current = true;
      refreshSoon(450);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  // Drive a stuck TUI menu: send one named key, then re-capture so the cursor moves.
  const tapKey = async (key: string) => {
    try {
      await sendKeyToPane(agent.paneId, key);
      stick.current = true;
      refreshSoon(250);
    } catch (e) { setErr((e as Error).message); }
  };

  // Drop a preset into the input box; "<prompt>" marks where the caret waits.
  const applyPreset = (tpl: string) => {
    const idx = tpl.indexOf(PROMPT_MARK);
    const value = idx >= 0 ? tpl.slice(0, idx) + tpl.slice(idx + PROMPT_MARK.length) : tpl;
    const caret = idx >= 0 ? idx : value.length;
    setInput(value);
    setTimeout(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }, 0);
  };

  // Close (kill) the agent's session — two-tap confirm since it's destructive.
  const closeSession = async () => {
    if (!confirmClose) { setConfirmClose(true); setTimeout(() => setConfirmClose(false), 4000); return; }
    try { await closePaneSession(agent.paneId); onClose(); }
    catch (e) { setErr((e as Error).message); setConfirmClose(false); }
  };

  const keyBtnStyle = { background: '#1a1a22', border: '1px solid rgba(255,255,255,0.12)', color: '#cdd2cd' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6" onClick={onClose}>
      <div
        className="flex flex-col w-[92vw] h-[88vh] rounded-xl border overflow-hidden shadow-2xl"
        style={{ background: '#0c0c12', borderColor: cos.color + '66' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <span style={{ fontSize: 16 }}>{cos.emoji}</span>
          <span className="font-semibold text-[13px]" style={{ color: cos.color }}>{cos.title}</span>
          {agent.label && agent.label !== 'oracle' && <span className="text-[11px] text-white/45 font-mono">·{agent.label}</span>}
          <span className="text-[10px] text-white/35 font-mono truncate">{agent.windowName}</span>
          <div className="inline-flex rounded border border-white/10 overflow-hidden text-[10px] ml-1">
            {(['history', 'live'] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className="px-1.5 py-0.5"
                style={{ background: tab === tb ? '#c084fc22' : 'transparent', color: tab === tb ? '#d9bbff' : '#888' }}
              >
                {tb === 'history' ? '💬 history' : '🖥 live'}
              </button>
            ))}
          </div>
          {agent.ctxPct != null && (
            <span className="text-[11px] ml-auto font-mono" style={{ color: ctxColor(agent.ctxPct) }}>ctx {agent.ctxPct}%</span>
          )}
          {slug && plans.length > 1 && (
            <select
              value=""
              disabled={switching}
              onChange={(e) => { if (e.target.value && confirm(`Switch ${agent.role}·${slug} to ${plans.find((p) => p.id === e.target.value)?.name}?\nThis ends the current session and respawns on that account.`)) switchPlan(e.target.value); }}
              className={`${agent.ctxPct == null ? 'ml-auto' : 'ml-1'} text-[10px] px-1 py-0.5 rounded`}
              style={{ background: '#a78bfa18', color: '#c4b5fd', border: '1px solid #a78bfa44' }}
              title="switch this agent to another Claude account (respawns)"
            >
              <option value="">{switching ? 'switching…' : `🔑 ${agent.plan || 'account'}`}</option>
              {plans.map((pl) => <option key={pl.id} value={pl.id}>→ {pl.name}</option>)}
            </select>
          )}
          <button
            onClick={closeSession}
            className={`${agent.ctxPct == null ? 'ml-auto' : 'ml-1'} text-[10px] px-1.5 py-0.5 rounded`}
            style={{ background: '#f8717122', color: '#f87171', border: '1px solid #f8717155' }}
            title="close (kill) this agent's session"
          >{confirmClose ? 'confirm ✓' : '✖ close session'}</button>
          <button onClick={onClose} className="ml-1 text-white/50 hover:text-white/90 text-sm" title="close window">✕</button>
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
          {body}
        </pre>

        <div className="flex items-center gap-1 px-2 pt-2 flex-wrap">
          {NAV_KEYS.map(([lbl, k]) => (
            <button key={k} onClick={() => tapKey(k)} className="w-7 h-7 rounded text-[13px] grid place-items-center" style={keyBtnStyle} title={`send ${k}`}>{lbl}</button>
          ))}
          <button onClick={() => tapKey('enter')} className="px-2 h-7 rounded text-[11px]" style={keyBtnStyle} title="send Enter">⏎ enter</button>
          <button onClick={() => tapKey('esc')} className="px-2 h-7 rounded text-[11px]" style={keyBtnStyle} title="send Escape">esc</button>
          <button onClick={() => tapKey('tab')} className="px-2 h-7 rounded text-[11px]" style={keyBtnStyle} title="send Tab">tab</button>
          <span className="text-[9px] text-white/30 ml-1">↳ TUI menu keys (no Enter appended)</span>
        </div>

        <div className="flex items-center gap-1 px-2 pt-1.5 flex-wrap">
          <span className="text-[10px] text-white/30 mr-0.5">⚡</span>
          {presets.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.text)} title={p.text}
              className="px-2 h-6 rounded text-[11px] max-w-[150px] truncate"
              style={{ background: '#ffffff0d', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1' }}
            >{p.name}</button>
          ))}
          <button onClick={() => setManaging(true)} title="add / edit / rename presets"
            className="px-2 h-6 rounded text-[11px]"
            style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.22)', color: '#94a3b8' }}
          >⚙ edit</button>
        </div>

        <div className="flex items-end gap-2 p-2 border-t border-white/10">
          <button
            onClick={() => send('nudge')}
            disabled={busy}
            className="px-2.5 py-1.5 rounded text-[12px] shrink-0 disabled:opacity-50"
            style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2455' }}
            title="send the word 'nudge' + Enter"
          >👉 nudge</button>
          <button
            onClick={() => send('Please save your last full response verbatim as a GitHub gist — run `gh gist create` (secret) — and reply with ONLY the gist URL. The live pane scrolled past it so I can’t read the long output here.')}
            disabled={busy}
            className="px-2.5 py-1.5 rounded text-[12px] shrink-0 disabled:opacity-50"
            style={{ background: '#818cf822', color: '#a5b4fc', border: '1px solid #818cf855' }}
            title="ask the agent to save its last long reply as a gh gist and return the link"
          >📋 gist</button>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={`message ${cos.title}…  ·  Shift+Enter = newline`}
            disabled={busy}
            rows={1}
            className="flex-1 rounded px-2.5 py-1.5 text-[12px] outline-none resize-none leading-snug"
            style={{ background: '#101018', border: '1px solid rgba(255,255,255,0.12)', color: '#e0e0e0', maxHeight: 140 }}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="px-3 py-1.5 rounded text-[12px] shrink-0 disabled:opacity-40"
            style={{ background: cos.color + '22', color: cos.color, border: `1px solid ${cos.color}55` }}
          >send ⏎</button>
        </div>
      </div>
      {managing && (
        <PresetManager
          presets={presets}
          onSave={(l) => { setPresets(l); savePresets(l); }}
          onClose={() => setManaging(false)}
        />
      )}
    </div>
  );
}
