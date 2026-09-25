import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Canvas, PencilBrush, util } from 'fabric';
import { Send, Eraser, ArrowLeft, Copy, BarChart3, X, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';

const COLORS = ['#1e1b4b', '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ffffff'];
const BOARD_H_KEY = 'studysync_board_height';
const BOARD_MIN_H = 280;
const BOARD_MAX_H = 1400;

export default function Room() {
  const { code } = useParams();
  const { toast } = useApp();
  const name = sessionStorage.getItem('studysync_room_name') || 'Anonymous';

  const socketRef = useRef(null);
  const canvasElRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const chatEndRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [poll, setPoll] = useState(null);
  const [pollForm, setPollForm] = useState(null);
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(3);

  /* ---------- Fabric canvas + socket wiring ---------- */
  useEffect(() => {
    const canvas = new Canvas(canvasElRef.current, { isDrawingMode: true, backgroundColor: '#f8fafc' });
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
    canvasRef.current = canvas;

    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const addObjects = async (objs) => {
      const enlivened = await util.enlivenObjects(objs);
      enlivened.forEach((o) => { o.selectable = false; o.evented = false; canvas.add(o); });
      canvas.renderAll();
    };

    socket.on('connect', () => socket.emit('room:join', { code, name }));
    socket.on('room:state', (s) => {
      setUsers(s.users);
      setMessages(s.messages);
      setPoll(s.poll);
      canvas.clear();
      canvas.backgroundColor = '#f8fafc';
      if (s.canvas.length) addObjects(s.canvas);
    });
    socket.on('room:users', setUsers);
    socket.on('chat:message', (m) => setMessages((list) => [...list, m]));
    socket.on('draw:path', (obj) => addObjects([obj]));
    socket.on('draw:clear', () => { canvas.clear(); canvas.backgroundColor = '#f8fafc'; canvas.renderAll(); });
    socket.on('poll:update', setPoll);
    socket.on('room:error', (msg) => toast(msg, 'error'));

    canvas.on('path:created', (e) => { e.path.selectable = false; e.path.evented = false; socket.emit('draw:path', e.path.toObject()); });

    return () => { socket.disconnect(); canvas.dispose(); };
  }, [code]);

  /* ---------- Whiteboard resize: apply saved height, sync canvas, persist ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let savedH = null;
    try {
      const s = JSON.parse(localStorage.getItem(BOARD_H_KEY) || 'null');
      if (s && Number.isFinite(s.h)) savedH = Math.min(BOARD_MAX_H, Math.max(BOARD_MIN_H, s.h));
    } catch {}

    const initialH = savedH ?? Math.max(320, Math.round((el.clientWidth || 600) * 0.6));
    el.style.height = initialH + 'px';

    let raf;
    let lastSavedH = null;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        const canvas = canvasRef.current;
        if (canvas && w > 0 && h > 0) {
          canvas.setDimensions({ width: w, height: h });
          canvas.renderAll();
        }
        if (h > 0 && h !== lastSavedH) {
          lastSavedH = h;
          try { localStorage.setItem(BOARD_H_KEY, JSON.stringify({ h })); } catch {}
        }
      });
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [code]);

  useEffect(() => {
    if (canvasRef.current?.freeDrawingBrush) {
      canvasRef.current.freeDrawingBrush.color = color;
      canvasRef.current.freeDrawingBrush.width = width;
    }
  }, [color, width]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = (e) => { e.preventDefault(); if (!text.trim()) return; socketRef.current.emit('chat:message', text); setText(''); };
  const copyCode = () => navigator.clipboard.writeText(`${location.origin}/rooms/${code}`).then(() => toast('Invite link copied'));
  const createPoll = (e) => { e.preventDefault(); socketRef.current.emit('poll:create', { question: pollForm.question, options: pollForm.options.split('\n').map((s) => s.trim()).filter(Boolean) }); setPollForm(null); };

  const resetBoardSize = () => {
    const el = wrapRef.current;
    if (!el) return;
    const defaultH = Math.max(320, Math.round((el.clientWidth || 600) * 0.6));
    el.style.height = defaultH + 'px';
    try { localStorage.removeItem(BOARD_H_KEY); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/rooms" className="rounded-md p-1 hover:bg-accent" aria-label="Back to lobby"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-2xl font-bold">Room <span className="gradient-text tracking-widest">{code}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{users.length} online</span>
          <Button variant="outline" size="sm" onClick={copyCode}><Copy className="h-4 w-4" />Invite</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>Shared whiteboard</CardTitle>
            <div className="flex items-center gap-2 flex-wrap" role="toolbar" aria-label="Drawing tools">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={`h-6 w-6 rounded-full border ${color === c ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="range"
                min={1}
                max={20}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                aria-label="Brush size"
                className="w-20 accent-indigo-500"
              />
              <Button variant="ghost" size="sm" onClick={resetBoardSize} aria-label="Reset board size" title="Reset board size">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => socketRef.current.emit('draw:clear')}>
                <Eraser className="h-4 w-4" />Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div
                ref={wrapRef}
                className="overflow-hidden rounded-lg border shadow-inner touch-none bg-slate-50"
                style={{
                  resize: 'vertical',
                  minHeight: BOARD_MIN_H + 'px',
                  maxHeight: BOARD_MAX_H + 'px',
                }}
              >
                <canvas ref={canvasElRef} aria-label="Shared drawing canvas" />
              </div>
              {/* Visual affordance for the browser's native resize handle */}
              <div className="pointer-events-none absolute bottom-1 right-1 text-muted-foreground/70" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M13 1 L1 13 M13 6 L6 13 M13 11 L11 13" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Drag the bottom-right corner of the board to resize it. Size is remembered for next time.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="flex flex-col h-[420px]">
            <CardHeader className="pb-2">
              <CardTitle>Chat</CardTitle>
              <p className="text-xs text-muted-foreground truncate">{users.join(', ')}</p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2 text-sm" aria-live="polite">
              {messages.map((m, i) => m.system ? (
                <p key={i} className="text-center text-xs text-muted-foreground">{m.text}</p>
              ) : (
                <div key={i} className={`max-w-[85%] rounded-lg px-3 py-1.5 ${m.name === name ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="text-[10px] opacity-70">{m.name} · {format(m.at, 'h:mm a')}</p>
                  <p>{m.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </CardContent>
            <form onSubmit={send} className="flex gap-2 p-3 border-t">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" maxLength={500} aria-label="Chat message" />
              <Button type="submit" size="icon" aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Quick poll</CardTitle>
              {poll ? (
                <Button variant="ghost" size="sm" onClick={() => socketRef.current.emit('poll:close')} aria-label="Close poll"><X className="h-4 w-4" /></Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPollForm({ question: '', options: '' })}>New</Button>
              )}
            </CardHeader>
            <CardContent>
              {poll ? (
                <div className="space-y-2">
                  <p className="font-medium text-sm">{poll.question}</p>
                  {poll.options.map((o, i) => {
                    const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
                    return (
                      <button key={i} onClick={() => socketRef.current.emit('poll:vote', i)} className="relative w-full overflow-hidden rounded-md border p-2 text-left text-sm hover:bg-accent">
                        <span className="absolute inset-y-0 left-0 bg-primary/15 transition-all" style={{ width: `${pct}%` }} />
                        <span className="relative flex justify-between">
                          <span>{o}</span>
                          <span className="text-xs text-muted-foreground">{poll.counts[i]} · {pct}%</span>
                        </span>
                      </button>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">{poll.total} vote{poll.total === 1 ? '' : 's'} · tap again to change yours</p>
                </div>
              ) : pollForm ? (
                <form onSubmit={createPoll} className="space-y-2">
                  <Input required placeholder="Question" value={pollForm.question} onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })} aria-label="Poll question" />
                  <textarea required rows={3} placeholder={'One option per line'} value={pollForm.options} onChange={(e) => setPollForm({ ...pollForm, options: e.target.value })} aria-label="Poll options" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="gradient">Start poll</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPollForm(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">No active poll. Decide what to study next.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
