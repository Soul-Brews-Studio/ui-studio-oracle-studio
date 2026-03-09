import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeed } from '../api/oracle';
import type { FeedEvent } from '../api/oracle';

const MAW_BASE = `http://${window.location.hostname}:3456`;

const ORACLE_COLORS: Record<string, string> = {
  neo: '#64b5f6',
  mother: '#ce93d8',
  hermes: '#ffb74d',
  pulse: '#4dd0e1',
  fireman: '#ef5350',
  volt: '#fdd835',
  nexus: '#81c784',
  dustboy: '#a1887f',
  arthur: '#ff8a65',
  odin: '#b39ddb',
  homekeeper: '#90a4ae',
  xiaoer: '#f48fb1',
};

const EVENT_ICONS: Record<string, string> = {
  UserPromptSubmit: '>_',
  PreToolUse: '...',
  PostToolUse: 'ok',
  Stop: '<<',
  SubagentStart: '++',
  SubagentStop: '--',
  SessionStart: 'ON',
  SessionEnd: 'OFF',
  Notification: '!!',
  TaskCompleted: 'TD',
  PostToolUseFailure: 'XX',
};

function getOracleColor(name: string): string {
  return ORACLE_COLORS[name] || '#888';
}

function relativeTime(ts: string): string {
  const now = new Date();
  // Parse as local time (feed.log timestamps are local)
  const then = new Date(ts.replace(' ', 'T'));
  const diffS = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diffS < 5) return 'now';
  if (diffS < 60) return `${diffS}s`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h`;
  return `${Math.floor(diffS / 86400)}d`;
}

function parseTs(ts: string): number {
  return new Date(ts.replace(' ', 'T')).getTime();
}

/** Shorten file paths and bash commands for display */
function shortenMsg(msg: string): string {
  // Shorten absolute paths: keep last 2 segments
  return msg.replace(/\/(?:home\/\w+\/)?(?:Code\/)?(?:github\.com\/)?[\w-]+\/[\w-]+\/([\w/.@-]+)/g, (_, rest) => {
    const parts = rest.split('/');
    return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : rest;
  }).replace(/cd\s+~\/Code\/github\.com\/[\w-]+\/[\w-]+\s*&&\s*/g, '');
}

/** Merge PostToolUse into PreToolUse as duration, drop noise, collapse repeats */
function pairEvents(events: FeedEvent[]): FeedEvent[] {
  const result: FeedEvent[] = [];
  const pendingPre = new Map<string, number>();

  // Events are newest-first, iterate reverse (oldest first) to pair
  const reversed = [...events].reverse();
  for (const ev of reversed) {
    const key = `${ev.session_id}:${ev.oracle}`;

    if (ev.event === 'PreToolUse') {
      result.push({ ...ev, message: shortenMsg(ev.message) });
      pendingPre.set(key, result.length - 1);
    } else if (ev.event === 'PostToolUse' || ev.event === 'PostToolUseFailure') {
      const preIdx = pendingPre.get(key);
      if (preIdx !== undefined) {
        const pre = result[preIdx];
        const durationMs = parseTs(ev.timestamp) - parseTs(pre.timestamp);
        if (durationMs > 0 && durationMs < 300_000) {
          const durLabel = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
          result[preIdx] = {
            ...pre,
            event: ev.event === 'PostToolUseFailure' ? 'ToolFailed' : 'ToolDone',
            session_id: pre.session_id + '|' + durLabel,
          };
        }
        pendingPre.delete(key);
      }
    } else {
      result.push({ ...ev, message: shortenMsg(ev.message) });
      pendingPre.delete(key);
    }
  }

  result.reverse();

  // Collapse consecutive same-tool events from same oracle (e.g. 8x Edit → "Edit x8")
  const collapsed: FeedEvent[] = [];
  for (let i = 0; i < result.length; i++) {
    const ev = result[i];
    const tool = ev.message.split(':')[0];
    // Count consecutive same oracle + same tool
    let count = 1;
    while (
      i + count < result.length &&
      result[i + count].oracle === ev.oracle &&
      result[i + count].message.split(':')[0] === tool &&
      (result[i + count].event === ev.event || result[i + count].event === 'ToolDone' || result[i + count].event === 'PreToolUse')
    ) {
      count++;
    }

    if (count >= 3) {
      // Collapse: show first, skip middle, show last
      collapsed.push(ev);
      const last = result[i + count - 1];
      if (count > 2) {
        collapsed.push({
          ...ev,
          event: 'Collapsed',
          message: `... ${count - 2} more ${tool} calls`,
          session_id: ev.session_id,
        });
      }
      if (count > 1) collapsed.push(last);
      i += count - 1;
    } else {
      collapsed.push(ev);
    }
  }

  return collapsed;
}

const MSG_TRUNCATE = 120;

function MessageCell({ text, className }: { text: string; className: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > MSG_TRUNCATE;

  if (!isLong) {
    return <span className={`text-sm font-mono leading-relaxed min-w-0 ${className}`}>{text}</span>;
  }

  return (
    <span
      className={`text-sm font-mono leading-relaxed min-w-0 cursor-pointer ${className}`}
      onClick={() => setExpanded(!expanded)}
    >
      {expanded ? text : text.slice(0, MSG_TRUNCATE) + '...'}
      <span className="text-[10px] text-white/30 ml-1.5">{expanded ? '[-]' : `[+${text.length - MSG_TRUNCATE}]`}</span>
    </span>
  );
}

interface TmuxWindow {
  oracle: string;
  target: string; // "session:window"
}

/** Hover popup — appears near mouse cursor */
function HoverPreview({ oracle, target, x, y, onPin }: {
  oracle: string; target: string; x: number; y: number; onPin: () => void;
}) {
  const [content, setContent] = useState('');
  const color = getOracleColor(oracle);
  const W = 440, H = 400;

  useEffect(() => {
    const load = () => fetch(`${MAW_BASE}/api/capture?target=${encodeURIComponent(target)}`)
      .then(r => r.json()).then(d => { if (d.content) setContent(d.content); }).catch(() => {});
    load();
    const iv = setInterval(load, 1500);
    return () => clearInterval(iv);
  }, [target]);

  // Smart position: prefer right of cursor, flip left if no space. Prefer below, flip above.
  const spaceRight = window.innerWidth - x;
  const left = spaceRight > W + 20 ? x + 16 : x - W - 16;
  const spaceBelow = window.innerHeight - y;
  const top = spaceBelow > H + 20 ? y - 40 : y - H + 40;

  return (
    <div
      className="fixed z-50 rounded-xl border overflow-hidden flex flex-col shadow-2xl"
      style={{ left: Math.max(8, left), top: Math.max(8, top), width: W, height: H, borderColor: color + '50', background: '#0c0c14' }}
      onClick={(e) => { e.stopPropagation(); onPin(); }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.08]">
        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: color }} />
        <span className="text-sm font-mono font-bold" style={{ color }}>{oracle}</span>
        <span className="text-[10px] font-mono text-white/25 ml-auto">click to expand</span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-[1.4] text-white/80 whitespace-pre-wrap">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: ansiToHtml(content) }} />
        ) : (
          <span className="text-white/30">...</span>
        )}
      </div>
    </div>
  );
}

/** Full terminal modal — pinned view with input */
function TerminalPreview({ oracle, target, onClose }: { oracle: string; target: string; onClose: () => void }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const color = getOracleColor(oracle);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCapture = useCallback(async () => {
    try {
      const res = await fetch(`${MAW_BASE}/api/capture?target=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    fetchCapture();
    intervalRef.current = setInterval(fetchCapture, 1000);
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchCapture]);

  async function sendCommand(text: string) {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`${MAW_BASE}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, text: text + '\n' }),
      });
      setInputText('');
      // Quick refresh to see result
      setTimeout(fetchCapture, 300);
    } catch {} finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[90vw] max-w-[800px] h-[80vh] rounded-xl border overflow-hidden flex flex-col shadow-2xl"
        style={{ borderColor: color + '40', background: '#0c0c14' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: color }} />
            <span className="text-base font-mono font-bold" style={{ color }}>{oracle}</span>
            <span className="text-xs font-mono text-white/30">{target}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-lg px-2 cursor-pointer bg-transparent border-none"
          >x</button>
        </div>

        {/* Terminal content */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-[1.4] text-white/90 whitespace-pre-wrap">
          {loading ? (
            <span className="text-white/30">Connecting to terminal...</span>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: ansiToHtml(content) }} />
          ) : (
            <span className="text-white/30">No output</span>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); sendCommand(inputText); }}
          className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.08]"
        >
          <span className="text-sm font-mono" style={{ color }}>{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={`Send to ${oracle}...`}
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-white placeholder:text-white/20 [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
            style={{ WebkitAppearance: 'none' } as React.CSSProperties}
            inputMode="text"
            enterKeyHint="send"
            autoFocus
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all disabled:opacity-20"
            style={{ borderColor: color + '40', color, background: color + '15' }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Convert basic ANSI escape codes to HTML spans */
function ansiToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\x1b\[1m/g, '<b>')
    .replace(/\x1b\[0m/g, '</b>')
    // 256-color: \x1b[38;2;R;G;Bm
    .replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, '<span style="color:rgb($1,$2,$3)">')
    // Basic colors
    .replace(/\x1b\[3(\d)m/g, (_, c) => {
      const colors = ['#000', '#e55', '#5e5', '#ee5', '#55e', '#e5e', '#5ee', '#eee'];
      return `<span style="color:${colors[parseInt(c)] || '#eee'}">`;
    })
    .replace(/\x1b\[39m/g, '</span>')
    // Strip remaining escapes
    .replace(/\x1b\[[0-9;]*m/g, '');
}

export function Pulse() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [activeOracles, setActiveOracles] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [filterOracle, setFilterOracle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [tmuxWindows, setTmuxWindows] = useState<TmuxWindow[]>([]);
  const [terminalTarget, setTerminalTarget] = useState<{ oracle: string; target: string } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ oracle: string; target: string; x: number; y: number } | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  async function loadFeed() {
    try {
      const data = await getFeed({
        limit: 200,
        oracle: filterOracle || undefined,
      });
      // Pair PreToolUse with PostToolUse to calculate duration, filter noise
      const paired = pairEvents(data.events);
      setEvents(paired);
      setActiveOracles(data.active_oracles);
      setTotal(data.total);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    // Load tmux windows
    fetch(`${MAW_BASE}/api/sessions`).then(r => r.json()).then((sessions: any[]) => {
      const windows: TmuxWindow[] = [];
      for (const s of sessions) {
        for (const w of s.windows) {
          const oracle = w.name.replace(/-oracle$/, '');
          windows.push({ oracle, target: `${s.name}:${w.name}` });
        }
      }
      setTmuxWindows(windows);
    }).catch(() => {});

    if (!paused) {
      intervalRef.current = setInterval(loadFeed, 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [filterOracle, paused]);

  // Unique oracles from events for filter
  const allOracles = [...new Set(events.map(e => e.oracle))].sort();

  function openTerminal(oracleName: string) {
    const win = tmuxWindows.find(w => w.oracle === oracleName);
    if (win) setTerminalTarget({ oracle: oracleName, target: win.target });
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0f]">
      {/* Active Oracles bar */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="max-w-[960px] mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-2xl font-bold text-white">Oracle Pulse</h1>
            <span className="text-sm font-mono text-white/50">{total} events</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPaused(!paused)}
                className={`px-4 py-1.5 rounded-md text-sm font-mono font-bold border transition-all ${
                  paused
                    ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                    : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                }`}
              >
                {paused ? 'PAUSED' : 'LIVE'}
              </button>
              {!paused && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          </div>

          {/* Active oracle pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-wider text-white/40 mr-1">Active:</span>
            {activeOracles.length === 0 && (
              <span className="text-sm text-white/30 font-mono">none</span>
            )}
            {activeOracles.map(name => (
              <button
                key={name}
                onClick={() => setFilterOracle(filterOracle === name ? null : name)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-mono font-medium transition-all cursor-pointer border ${
                  filterOracle === name
                    ? 'border-white/25 bg-white/10'
                    : 'border-transparent bg-white/[0.05] hover:bg-white/[0.1]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ background: getOracleColor(name) }}
                />
                <span style={{ color: getOracleColor(name) }}>{name}</span>
              </button>
            ))}

            {/* Inactive oracles from events */}
            {allOracles.filter(o => !activeOracles.includes(o)).map(name => (
              <button
                key={name}
                onClick={() => setFilterOracle(filterOracle === name ? null : name)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono transition-all cursor-pointer border ${
                  filterOracle === name
                    ? 'border-white/25 bg-white/10'
                    : 'border-transparent bg-white/[0.03] hover:bg-white/[0.07]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white/25" />
                <span className="text-white/40">{name}</span>
              </button>
            ))}

            {filterOracle && (
              <button
                onClick={() => setFilterOracle(null)}
                className="text-[10px] text-white/40 hover:text-white/60 ml-1 cursor-pointer"
              >
                clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Event stream */}
      <div className="max-w-[960px] mx-auto px-6 py-4">
        {loading && (
          <div className="text-center text-white/30 py-12 font-mono text-sm">Loading feed...</div>
        )}

        <div className="flex flex-col">
          {events.map((ev, i) => {
            const color = getOracleColor(ev.oracle);
            // Extract duration if paired
            const hasDuration = ev.session_id.includes('|');
            const duration = hasDuration ? ev.session_id.split('|')[1] : null;

            const isToolDone = ev.event === 'ToolDone';
            const isToolFailed = ev.event === 'ToolFailed';
            const isCollapsed = ev.event === 'Collapsed';
            const icon = isCollapsed ? '~~' : isToolDone ? 'ok' : isToolFailed ? 'XX' : (EVENT_ICONS[ev.event] || '??');
            const isHumanMsg = ev.event === 'UserPromptSubmit';
            const isStop = ev.event === 'Stop';
            const isError = isToolFailed || ev.event === 'PostToolUseFailure';
            const isSession = ev.event === 'SessionStart' || ev.event === 'SessionEnd';

            return (
              <div
                key={`${ev.timestamp}-${i}`}
                className={`flex items-start gap-3 py-2.5 px-4 rounded-lg transition-colors ${
                  isHumanMsg ? 'bg-blue-500/[0.06]' : 'hover:bg-white/[0.03]'
                } ${isSession ? 'border-l-2 border-emerald-500/30' : ''}`}
              >
                {/* Time */}
                <span className="text-xs font-mono text-white/35 w-[36px] shrink-0 pt-0.5 text-right tabular-nums">
                  {relativeTime(ev.timestamp)}
                </span>

                {/* Oracle dot + name (hover=preview, click=full terminal) */}
                <div
                  className="flex items-center gap-2 w-[90px] shrink-0 cursor-pointer hover:opacity-80"
                  onClick={() => { setHoverPreview(null); openTerminal(ev.oracle); }}
                  onMouseEnter={(e) => {
                    const win = tmuxWindows.find(w => w.oracle === ev.oracle);
                    if (!win) return;
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    hoverTimeout.current = setTimeout(() => {
                      setHoverPreview({ oracle: ev.oracle, target: win.target, x: e.clientX, y: e.clientY });
                    }, 300);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    hoverTimeout.current = setTimeout(() => setHoverPreview(null), 200);
                  }}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeOracles.includes(ev.oracle) ? 'animate-pulse' : ''}`}
                    style={{ background: color }}
                  />
                  <span className="text-sm font-mono font-medium truncate" style={{ color }}>
                    {ev.oracle}
                  </span>
                </div>

                {/* Event badge */}
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded w-[32px] text-center shrink-0 ${
                  isError ? 'bg-red-500/25 text-red-400'
                  : isHumanMsg ? 'bg-blue-500/25 text-blue-300'
                  : isStop ? 'bg-purple-500/25 text-purple-300'
                  : isSession ? 'bg-emerald-500/25 text-emerald-300'
                  : isToolDone ? 'bg-emerald-500/15 text-emerald-400'
                  : isCollapsed ? 'bg-white/[0.04] text-white/25'
                  : 'bg-white/[0.08] text-white/40'
                }`}>
                  {icon}
                </span>

                {/* Message (hover on AI responses to preview terminal) */}
                <div
                  className="min-w-0 flex-1"
                  onMouseEnter={isStop ? (e) => {
                    const win = tmuxWindows.find(w => w.oracle === ev.oracle);
                    if (!win) return;
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    hoverTimeout.current = setTimeout(() => {
                      setHoverPreview({ oracle: ev.oracle, target: win.target, x: e.clientX, y: e.clientY });
                    }, 300);
                  } : undefined}
                  onMouseLeave={isStop ? () => {
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    hoverTimeout.current = setTimeout(() => setHoverPreview(null), 200);
                  } : undefined}
                  onClick={isStop ? () => { setHoverPreview(null); openTerminal(ev.oracle); } : undefined}
                  style={isStop ? { cursor: 'pointer' } : undefined}
                >
                  <MessageCell
                    text={ev.message || ev.event}
                    className={
                      isCollapsed ? 'text-white/25 italic' : isHumanMsg ? 'text-blue-200' : isStop ? 'text-white/70 hover:text-white/90' : isError ? 'text-red-300' : 'text-white/45'
                    }
                  />
                </div>

                {/* Duration badge */}
                {duration && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    isToolFailed ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-white/40'
                  }`}>
                    {duration}
                  </span>
                )}

                {/* Project */}
                <span className="text-[10px] font-mono text-white/20 ml-auto shrink-0 hidden sm:block">
                  {ev.project}
                </span>
              </div>
            );
          })}
        </div>

        {events.length === 0 && !loading && (
          <div className="text-center text-white/20 py-12 font-mono text-sm">
            No activity yet. Oracles are sleeping.
          </div>
        )}
      </div>

      {/* Hover popup */}
      {hoverPreview && !terminalTarget && (
        <div
          onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current); }}
          onMouseLeave={() => setHoverPreview(null)}
        >
          <HoverPreview
            oracle={hoverPreview.oracle}
            target={hoverPreview.target}
            x={hoverPreview.x}
            y={hoverPreview.y}
            onPin={() => {
              setHoverPreview(null);
              setTerminalTarget({ oracle: hoverPreview.oracle, target: hoverPreview.target });
            }}
          />
        </div>
      )}

      {/* Terminal preview modal */}
      {terminalTarget && (
        <TerminalPreview
          oracle={terminalTarget.oracle}
          target={terminalTarget.target}
          onClose={() => setTerminalTarget(null)}
        />
      )}
    </div>
  );
}
