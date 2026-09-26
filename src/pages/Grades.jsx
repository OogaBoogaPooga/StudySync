function ICDialog({ open, onClose, ic, onConnected, onDisconnected }) {
  const { toast } = useApp();
  const [mode, setMode] = useState('url'); // 'url' | 'district'
  const [form, setForm] = useState({ portalUrl: '', district: '', state: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setWarning('');
    setMode('url');
    setForm({
      portalUrl: ic.portalUrl || '',
      district: '',
      state: '',
      username: ic.username || '',
      password: '',
    });
  }, [open, ic]);

  const connect = async () => {
    setError('');
    setWarning('');
    setBusy(true);
    try {
      const url = mode === 'url' ? form.portalUrl : undefined;
      const payload = mode === 'url'
        ? { portalUrl: url, username: form.username, password: form.password }
        : { district: form.district, state: form.state.toUpperCase(), username: form.username, password: form.password };

      const res = await saveICCredentials(payload);
      // saveICCredentials may return { verified, warning }
      if (res && res.warning) {
        setWarning(`Saved, but login check failed: ${res.warning}`);
        toast('Saved — but couldn\'t verify login');
      } else {
        toast('Infinite Campus connected');
      }
      await onConnected();
      if (!res?.warning) onClose();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Infinite Campus? Your credentials will be wiped.')) return;
    setBusy(true);
    try {
      await disconnectIC();
      toast('Disconnected');
      await onDisconnected();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const canSubmit = form.username && form.password && (
    mode === 'url' ? !!form.portalUrl : (form.district && form.state.length === 2)
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Connect Infinite Campus"
        description={ic.connected
          ? 'Already connected. Re-enter credentials to update, or disconnect.'
          : 'Link your IC account to sync grades automatically.'}
        className="max-w-lg"
      >
        <div className="space-y-4">
          {!ic.connected && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 rounded-full bg-muted p-1 text-xs" role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === 'url'}
                  onClick={() => setMode('url')}
                  className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${mode === 'url' ? 'bg-card shadow' : 'text-muted-foreground'}`}
                >
                  Paste my URL
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'district'}
                  onClick={() => setMode('district')}
                  className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${mode === 'district' ? 'bg-card shadow' : 'text-muted-foreground'}`}
                >
                  Find my district
                </button>
              </div>

              {mode === 'url' ? (
                <div className="space-y-2">
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-medium text-foreground">How to find your URL (30 seconds):</p>
                    <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                      <li>Open <span className="font-medium text-foreground">Infinite Campus</span> in another tab and log in</li>
                      <li>Once you see your grades, <span className="font-medium text-foreground">click the address bar</span> at the top</li>
                      <li>Copy the whole URL (<span className="font-mono">Ctrl/Cmd + C</span>)</li>
                      <li>Paste it below</li>
                    </ol>
                  </div>
                  <Label htmlFor="ic-url">Portal URL</Label>
                  <Input
                    id="ic-url"
                    placeholder="https://yourschool.infinitecampus.org/campus/..."
                    value={form.portalUrl}
                    onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Enter the district name you type into the IC login page. We'll try to find the portal automatically.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="ic-district">District name</Label>
                    <Input
                      id="ic-district"
                      placeholder="e.g. Jamestown 1"
                      value={form.district}
                      onChange={(e) => setForm({ ...form, district: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ic-state">State (2 letters)</Label>
                    <Input
                      id="ic-state"
                      placeholder="ND"
                      maxLength={2}
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="ic-user">Infinite Campus username</Label>
            <Input
              id="ic-user"
              autoComplete="off"
              placeholder="e.g. 4221190397"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ic-pass">Infinite Campus password</Label>
            <Input
              id="ic-pass"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {warning && <p className="text-xs text-amber-500">{warning}</p>}

          <p className="text-[11px] text-muted-foreground">
            Your password is encrypted with AES-256-GCM before it's stored. The key lives only on the server and never touches the database.
          </p>

          <div className="flex gap-2">
            <Button onClick={connect} disabled={busy || !canSubmit} variant="gradient" className="flex-1">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Connecting…</> : ic.connected ? 'Update' : 'Connect'}
            </Button>
            {ic.connected && (
              <Button variant="ghost" onClick={disconnect} disabled={busy} className="text-destructive hover:bg-destructive/10">
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
