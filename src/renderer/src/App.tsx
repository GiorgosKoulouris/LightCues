import { useCallback, useEffect, useRef, useState } from 'react';
import { FallbackPanel } from './panel/FallbackPanel';
import { ProfileLibraryView } from './profiles/ProfileLibraryView';
import { ShowView } from './show/ShowView';
import { VenuePatchView } from './venue/VenuePatchView';

const VIEWS = { show: 'Show', venue: 'Venue Patch', profiles: 'Profile Library' } as const;

export function App() {
  const [status, setStatus] = useState('Waiting for engine…');
  const [view, setView] = useState<keyof typeof VIEWS>('venue');
  const nextId = useRef(1);
  const sentAt = useRef(new Map<number, number>());

  const ping = useCallback(() => {
    const id = nextId.current++;
    sentAt.current.set(id, performance.now());
    window.engine.send({ type: 'ping', id });
  }, []);

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'pong') return;
      const start = sentAt.current.get(event.id);
      if (start === undefined) return;
      sentAt.current.delete(event.id);
      const roundTrip = Math.round(performance.now() - start);
      const uptime = Math.round(event.uptimeMs / 1000);
      setStatus(`Engine replied in ${roundTrip} ms (up ${uptime} s)`);
    });
    ping();
    return unsubscribe;
  }, [ping]);

  return (
    <main>
      <h1>LightCues</h1>
      <p>{status}</p>
      <FallbackPanel />
      <button type="button" onClick={ping}>
        Ping engine
      </button>
      <nav>
        {Object.entries(VIEWS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key as keyof typeof VIEWS)}
          >
            {label}
          </button>
        ))}
      </nav>
      {/* All stay mounted, so the Show and Venue Patch still guard the window close. */}
      <div hidden={view !== 'show'}>
        <ShowView />
      </div>
      <div hidden={view !== 'venue'}>
        <VenuePatchView />
      </div>
      <div hidden={view !== 'profiles'}>
        <ProfileLibraryView />
      </div>
    </main>
  );
}
