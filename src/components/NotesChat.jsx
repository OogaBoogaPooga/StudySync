import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { api, chatWithNotes } from '@/lib/api.js';

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
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await chatWithNotes(text, setId || null);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message || 'Chat failed.'}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:opacity-90"
          aria-label="Open notes chat"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="hidden sm:inline">Ask my notes</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex h-[560px] max-h-[calc(100vh-6rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">Ask my notes</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b px-3 py-2">
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              aria-label="Choose study set"
            >
              <option value="">All my sets</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <p className="text-muted-foreground">
                Ask me anything in your study sets. Try: "Explain the Albany Plan of Union."
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground whitespace-pre-wrap'
                    : 'mr-auto max-w-[90%] rounded-lg bg-accent px-3 py-2 whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="text-muted-foreground italic">Thinking…</div>}
          </div>

          <div className="flex items-center gap-2 border-t px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Chat input"
            />
            <button
              onClick={send}
              disabled={busy}
              className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
