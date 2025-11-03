'use client';

import { DailyShortResponse } from '@/lib/getDailyShort';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  fallback: DailyShortResponse;
};

type ClientState = DailyShortResponse & {
  resolvedAt: number;
};

function buildEmbedUrl(id: string) {
  const params = new URLSearchParams({
    rel: '0',
    autoplay: '0',
    mute: '1',
    playsinline: '1',
    modestbranding: '1'
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return 'Ready now';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function safeNavigatorShare(payload: ShareData) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return Promise.reject(new Error('Share API unavailable'));
  }
  return navigator.share(payload);
}

export default function DailyShortClient({ fallback }: Props) {
  const [state, setState] = useState<ClientState>({
    ...fallback,
    resolvedAt: Date.now()
  });
  const [remainingMs, setRemainingMs] = useState(() => fallback.msUntilRelease);
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>(
    'idle'
  );
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/daily?tz=${encodeURIComponent(tz)}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`Failed to refresh daily short (${response.status})`);
      }
      const payload: DailyShortResponse = await response.json();
      setState({
        ...payload,
        resolvedAt: Date.now()
      });
      setRemainingMs(payload.msUntilRelease);
    } catch (error) {
      console.error('Unable to refresh daily short', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const nextRelease = state.isUnlocked
      ? new Date(state.nextReleaseTimeUtc).getTime()
      : new Date(state.releaseTimeUtc).getTime();

    setRemainingMs(Math.max(0, nextRelease - Date.now()));

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, nextRelease - now);
      setRemainingMs(delta);
      if (delta === 0) {
        clearInterval(interval);
        refetch();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [refetch, state.isUnlocked, state.nextReleaseTimeUtc, state.releaseTimeUtc]);

  const scheduleNotification = useCallback(
    (payload: ClientState) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (typeof window === 'undefined') return;
      if (notificationStatus !== 'granted') return;

      const targetTime = payload.isUnlocked
        ? new Date(payload.nextReleaseTimeUtc).getTime()
        : new Date(payload.releaseTimeUtc).getTime();
      const delay = Math.max(0, targetTime - Date.now());
      if (delay === 0) {
        new Notification('Your WhisperDrop is ready', {
          body: payload.short.title,
          tag: payload.cycleKey
        });
        return;
      }
      timeoutRef.current = setTimeout(() => {
        new Notification('Your WhisperDrop is ready', {
          body: payload.short.title,
          tag: payload.cycleKey
        });
      }, delay);
    },
    [notificationStatus]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
        scheduleNotification(state);
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scheduleNotification, state]);

  useEffect(() => {
    scheduleNotification(state);
  }, [scheduleNotification, state]);

  const handleNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationStatus('error');
      setNotificationMessage('Notifications are not supported on this device.');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationStatus('granted');
      scheduleNotification(state);
      setNotificationMessage('Daily reminder armed for the next drop.');
      return;
    }

    if (Notification.permission === 'denied') {
      setNotificationStatus('denied');
      setNotificationMessage('Notifications are blocked in your browser settings.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationStatus('granted');
        scheduleNotification(state);
        setNotificationMessage('Daily reminder armed for the next drop.');
      } else {
        setNotificationStatus(permission === 'denied' ? 'denied' : 'idle');
        setNotificationMessage('Daily reminders require notification permission.');
      }
    } catch (error) {
      console.error('Notification permission error', error);
      setNotificationStatus('error');
      setNotificationMessage('Something went wrong while enabling reminders.');
    }
  }, [scheduleNotification, state]);

  const handleShare = useCallback(async () => {
    try {
      await safeNavigatorShare({
        title: 'WhisperDrop — Daily ASMR Short',
        text: `Today\'s drop: ${state.short.title} · ${state.short.vibe}`,
        url: window.location.href
      });
    } catch (error) {
      const copyPayload = `${state.short.title} — https://www.youtube.com/shorts/${state.short.id}`;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(copyPayload);
          setNotificationMessage('Link copied — share the calm with a friend.');
        } catch (clipboardError) {
          console.error('Clipboard error', clipboardError);
          setNotificationMessage('Could not copy — long press or right-click to share.');
        }
      } else {
        setNotificationMessage('Sharing not supported here — copy the link manually.');
      }
    }
  }, [state.short.id, state.short.title, state.short.vibe]);

  const accent = useMemo(() => {
    const palette = [
      'from-glow to-soft',
      'from-[#5b8ccf] to-[#1f2240]',
      'from-[#6f9aaa] to-[#1f3d4a]',
      'from-[#9f7aea] to-[#221b44]',
      'from-[#6ac1b8] to-[#122c2a]'
    ];
    const seed = state.short.id.charCodeAt(0) + state.short.id.charCodeAt(state.short.id.length - 1);
    return palette[seed % palette.length];
  }, [state.short.id]);

  return (
    <section className="flex flex-col gap-8">
      <article className="grid gap-6 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)] lg:items-start">
        <div className="overflow-hidden rounded-3xl border border-soft/20 bg-midnight/60 shadow-lg shadow-glow/10 backdrop-blur">
          <div className={clsx('h-2 w-full bg-gradient-to-r', accent)} />
          <div className="relative aspect-[9/16] bg-black/60">
            {state.isUnlocked ? (
              <iframe
                title={state.short.title}
                src={buildEmbedUrl(state.short.id)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                <div className="text-sm uppercase tracking-[0.3em] text-soft/70">Locked until 1pm</div>
                <div className="text-3xl font-semibold text-whisper/90">{state.short.title}</div>
                <p className="max-w-xs text-sm text-soft/70">
                  Your short is steeping. Come back when the clock gently hits 1:00 PM to experience
                  today&apos;s ASMR drop.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-soft/70">Today&apos;s drop</p>
            <h1 className="text-4xl font-semibold text-whisper">{state.short.title}</h1>
            <p className="text-soft/80">{state.short.vibe}</p>
            <p className="text-sm text-soft/60">Curated by {state.short.channel}</p>
            <div className="flex flex-wrap gap-2">
              {state.short.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-soft/30 px-3 py-1 text-xs uppercase tracking-wide text-soft/75"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleNotifications}
              className={clsx(
                'rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                notificationStatus === 'granted'
                  ? 'border-glow/70 bg-glow/10 text-whisper hover:bg-glow/20'
                  : 'border-soft/40 bg-white/5 text-whisper hover:border-glow/60 hover:bg-glow/10'
              )}
            >
              {notificationStatus === 'granted' ? 'Remind me daily' : 'Arm daily reminder'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="rounded-2xl border border-soft/30 px-4 py-3 text-sm font-semibold text-soft/80 transition hover:border-glow/50 hover:text-whisper"
            >
              Share this vibe
            </button>
          </div>
          <div className="rounded-2xl border border-soft/20 bg-white/5 p-4 text-sm text-soft/70">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.32em] text-soft/60">
              <span>Countdown</span>
              <span>{state.timeZone}</span>
            </div>
            <p className="pt-3 text-3xl font-medium text-whisper">{formatRemaining(remainingMs)}</p>
            <p className="pt-2 text-xs text-soft/60">
              {state.isUnlocked
                ? 'Next drop lands at 1:00 PM tomorrow.'
                : 'Today’s drop unlocks at 1:00 PM sharp — keep the tab open or arm reminders.'}
            </p>
            <div className="pt-4 text-xs text-soft/50">
              Cycle key: <span className="font-mono">{state.cycleKey}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-soft/60">
            <button
              type="button"
              onClick={refetch}
              disabled={loading}
              className="rounded-full border border-soft/20 px-3 py-1 font-semibold uppercase tracking-[0.2em] text-soft/70 transition hover:border-glow/40 hover:text-whisper disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Refreshing…' : 'Sync now'}
            </button>
            <span>
              WhisperDrop crafts a new short every 24h. Drops are deterministic, so everyone shares the
              same moment each day.
            </span>
          </div>
          {notificationMessage && (
            <div className="rounded-xl border border-glow/30 bg-glow/10 px-4 py-3 text-xs text-whisper/90">
              {notificationMessage}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
