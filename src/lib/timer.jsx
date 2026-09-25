import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api } from './api.js';

const TimerCtx = createContext(null);
const LS_KEY = 'studysync_timer_v1';
const NOTES_KEY = 'studysync_session_notes';

const DEFAULT_CONFIG = { focus: 25, short: 5, long: 15 };

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const config = { ...DEFAULT_CONFIG, ...(raw.config || {}) };
    const mode = raw.mode || 'focus';
    return {
      config,
      mode,
      round: raw.round || 1,
      running: !!raw.running,
      endsAt: raw.endsAt || null,
      pausedSecondsLeft: raw.pausedSecondsLeft ?? config[mode] * 60,
    };
  } catch {
    return {
      config: DEFAULT_CONFIG,
      mode: 'focus',
      round: 1,
      running: false,
      endsAt: null,
      pausedSecondsLeft: DEFAULT_CONFIG.focus * 60,
    };
  }
}

function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  } catch {}
}

export function TimerProvider({ children }) {
  const initial = useMemo(loadState, []);

  const [config, setConfig] = useState(initial.config);
  const [mode, setMode] = useState(initial.mode);
  const [round, setRound] = useState(initial.round);
  const [running, setRunning] = useState(initial.running);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [pausedSecondsLeft, setPausedSecondsLeft] = useState(initial.pausedSecondsLeft);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState(null);

  const total = config[mode] * 60;

  // Derived remaining. `tick` forces re-computation.
  const remaining = useMemo(() => {
    void tick;
    if (running && endsAt) {
      return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    }
    return pausedSecondsLeft;
  }, [running, endsAt, pausedSecondsLeft, tick]);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      config, mode, round, running,
      endsAt: running ? endsAt : null,
      pausedSecondsLeft: running ? null : pausedSecondsLeft,
    }));
  }, [config, mode, round, running, endsAt, pausedSecondsLeft]);

  // Tick while running — interval-based for smooth UI, but `remaining` is
  // always recomputed from Date.now() so background throttling can't drift.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [running]);

  // Catch-up refresh when the tab becomes visible again
  useEffect(() => {
    const onVis = () => setTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  const finishPhase = useCallback(async (completed) => {
    const elapsedMin = Math.round((total - remaining) / 60);
    const notes = localStorage.getItem(NOTES_KEY) || '';

    if (mode === 'focus' && elapsedMin >= 1) {
      try {
        await api('/sessions', { method: 'POST', body: { type: 'focus', durationMin: elapsedMin, notes } });
      } catch {}
    }

    if (completed) {
      const msg = mode === 'focus' ? 'Focus round done — take a break!' : 'Break over — back to it!';
      setToast({ message: msg, id: Date.now() });
      setTimeout(() => setToast(null), 4000);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('StudySync', { body: msg }); } catch {}
      }
      beep();
    }

    if (mode === 'focus') {
      const next = round % 4 === 0 ? 'long' : 'short';
      setMode(next);
      setPausedSecondsLeft(config[next] * 60);
    } else {
      setMode('focus');
      setRound((r) => r + 1);
      setPausedSecondsLeft(config.focus * 60);
    }
    setRunning(false);
    setEndsAt(null);
  }, [mode, round, total, remaining, config]);

  // Completion trigger
  useEffect(() => {
    if (running && remaining === 0) finishPhase(true);
  }, [running, remaining, finishPhase]);

  const start = useCallback(() => {
    if (running) return;
    const secs = pausedSecondsLeft > 0 ? pausedSecondsLeft : config[mode] * 60;
    setEndsAt(Date.now() + secs * 1000);
    setRunning(true);
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch {}
    }
  }, [running, pausedSecondsLeft, config, mode]);

  const pause = useCallback(() => {
    if (!running || !endsAt) return;
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    setPausedSecondsLeft(left);
    setRunning(false);
    setEndsAt(null);
  }, [running, endsAt]);

  const toggle = useCallback(() => {
    if (running) pause(); else start();
  }, [running, start, pause]);

  const reset = useCallback(() => {
    setRunning(false);
    setEndsAt(null);
    setPausedSecondsLeft(config[mode] * 60);
  }, [config, mode]);

  const skip = useCallback(() => {
    finishPhase(false);
  }, [finishPhase]);

  const selectMode = useCallback((m) => {
    setMode(m);
    setRunning(false);
    setEndsAt(null);
    setPausedSecondsLeft(config[m] * 60);
  }, [config]);

  const updateConfig = useCallback((partial) => {
    setConfig((c) => {
      const next = { ...c, ...partial };
      // If the user hasn't started the current phase, snap remaining to new duration
      setPausedSecondsLeft((cur) => {
        if (!running && cur === c[mode] * 60) return next[mode] * 60;
        return cur;
      });
      return next;
    });
  }, [running, mode]);

  const value = {
    config, updateConfig,
    mode, round, running,
    remaining, total,
    start, pause, toggle, reset, skip, selectMode,
    toast,
  };

  return <TimerCtx.Provider value={value}>{children}</TimerCtx.Provider>;
}

export const useTimer = () => useContext(TimerCtx);
