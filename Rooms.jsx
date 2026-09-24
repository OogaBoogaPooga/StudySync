import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, LogIn } from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Label } from '@/components/ui/input.jsx';

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function Rooms() {
  const { user } = useApp();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState(user?.name || '');

  const go = (c) => { sessionStorage.setItem('studysync_room_name', name || 'Anonymous'); nav(`/rooms/${c.toUpperCase()}`); };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg"><Users /></div><h1 className="mt-3 text-2xl font-bold">Group Study Lobby</h1><p className="text-sm text-muted-foreground">Chat, draw on a shared whiteboard and run quick polls — no video, no fuss.</p></div>
      <Card>
        <CardHeader><CardTitle>Your display name</CardTitle></CardHeader>
        <CardContent><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Display name" /></CardContent>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Create a room</CardTitle><CardDescription>Share the code with friends.</CardDescription></CardHeader><CardContent><Button variant="gradient" className="w-full" onClick={() => go(randomCode())}><Plus className="h-4 w-4" />New room</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Join a room</CardTitle><CardDescription>Enter a 6-character code.</CardDescription></CardHeader>
          <CardContent><form onSubmit={(e) => { e.preventDefault(); if (code.trim()) go(code.trim()); }} className="flex gap-2"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={12} aria-label="Room code" className="uppercase tracking-widest" /><Button type="submit" variant="outline" aria-label="Join"><LogIn className="h-4 w-4" /></Button></form></CardContent></Card>
      </div>
    </div>
  );
}
