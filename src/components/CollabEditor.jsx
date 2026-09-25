import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Link2 } from 'lucide-react';
import { createCollabProvider, colorForUser } from '@/lib/yjsProvider.js';
import { useApp } from '@/lib/store.jsx';

function Toolbar({ editor, collaborators, extra }) {
  if (!editor) return null;
  const btn = (label, onClick, isActive, Icon) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-2 transition-colors ${isActive ? 'bg-primary/15 text-primary' : 'hover:bg-accent'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
      {btn('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), Bold)}
      {btn('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), Italic)}
      {btn('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), UnderlineIcon)}
      {btn('Heading', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), Heading2)}
      {btn('Bullet list', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), List)}
      {btn('Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), ListOrdered)}
      {btn('Insert link', () => {
        const url = prompt('Link URL (https://…)');
        if (url && /^https?:\/\//.test(url)) editor.chain().focus().setLink({ href: url }).run();
      }, editor.isActive('link'), Link2)}

      <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        {collaborators.length > 1 && (
          <span className="flex items-center gap-1.5" title={collaborators.map(c => c.name).join(', ')}>
            <span className="flex -space-x-1.5">
              {collaborators.slice(0, 5).map((c) => (
                <span key={c.clientId} className="h-4 w-4 rounded-full ring-2 ring-card" style={{ backgroundColor: c.color }} />
              ))}
            </span>
            <span>{collaborators.length} editing</span>
          </span>
        )}
        {extra}
      </span>
    </div>
  );
}

function EditorInner({ provider, initialContent, onContentChange, extraToolbar, user }) {
  const [collaborators, setCollaborators] = useState([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false, heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Placeholder.configure({ placeholder: 'Start typing your notes…' }),
      Collaboration.configure({ document: provider.doc, field: 'default' }),
      CollaborationCursor.configure({
        provider: provider.provider,
        user: { name: user?.name || 'Someone', color: colorForUser(user) },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[360px] rounded-md border bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring',
      },
    },
    onUpdate: ({ editor }) => { onContentChange?.(editor.getHTML()); },
  }, [provider]);

  // Seed Yjs doc if we're the designated first client and it's empty
  useEffect(() => {
    if (!editor || !provider) return;
    if (!provider.shouldSeed()) return;
    const xml = provider.doc.getXmlFragment('default');
    if (xml.length === 0 && initialContent) {
      editor.commands.setContent(initialContent);
    }
    provider.markSeeded();
  }, [editor, provider, initialContent]);

  // Track collaborators from awareness
  useEffect(() => {
    if (!provider) return;
    const update = () => {
      const list = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (state.user) list.push({ clientId, name: state.user.name, color: state.user.color });
      });
      setCollaborators(list);
    };
    provider.awareness.on('change', update);
    update();
    return () => provider.awareness.off('change', update);
  }, [provider]);

  if (!editor) return <div className="min-h-[360px] animate-pulse rounded-md border bg-muted/30" />;

  return (
    <div className="space-y-2">
      <Toolbar editor={editor} collaborators={collaborators} extra={extraToolbar} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default function CollabEditor({ setId, initialContent, onContentChange, extraToolbar }) {
  const { user } = useApp();
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!setId) return;
    const p = createCollabProvider(setId, user);
    setProvider(p);
    return () => { p.destroy(); setProvider(null); };
  }, [setId, user?.id]);

  if (!provider) return <div className="min-h-[360px] animate-pulse rounded-md border bg-muted/30" />;
  return <EditorInner provider={provider} initialContent={initialContent} onContentChange={onContentChange} extraToolbar={extraToolbar} user={user} />;
}
