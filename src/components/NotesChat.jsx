import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { api, chatWithNotes } from '@/lib/api.js';

const SUGGESTIONS = [
  'What should I study?',
  'Summarize this set',
  'Quiz me on the key terms',
];

export default function NotesChat() {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState([]);
  const [setId, setSetId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open || sets.length) return;
    api('/sets')
      .then((data) => setSets(Array.isArray(data) ? data : data.sets || []))
      .catch(() => {});
  }, [open, sets.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, busy]);

  async function sendText(raw) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await chatWithNotes(text, setId || null);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  const send = () => sendText(input);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5"
          aria-label="Open notes chat"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="hidden sm:inline">Ask my notes</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex h-[600px] max-h-[calc(100vh-6rem)] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">Ask my notes</div>
                <div className="text-[11px] text-muted-foreground">Grounded in your study sets</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scope selector */}
          <div className="border-b border-border/60 px-3 py-2">
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground/90 outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              aria-label="Choose study set"
            >
              <option value="">All my sets</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
            {messages.length === 0 && !busy && (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </span>
                <p className="text-sm font-medium">Ask anything in your notes.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  I'll answer using only your study sets, with citations.
                </p>
                <div className="mt-5 flex flex-col gap-1.5 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendText(s)}
                      className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground shadow-sm'
                        : 'max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border/60 bg-background px-3.5 py-2 text-sm leading-relaxed text-foreground'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-background px-3.5 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border/60 bg-card/80 px-3 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background pl-3.5 pr-1 py-1 transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask a question…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Chat input"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
