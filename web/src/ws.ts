import { useEffect, useRef } from 'react';

interface EventUpdated {
  type: 'event-updated';
  data: {
    eventId: string;
    remainingByTicketType: Record<string, number>;
  };
}

export function useEventStream(onMessage: (msg: EventUpdated) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const wsPort = import.meta.env.VITE_WS_PORT ?? '3001';
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${wsPort}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as EventUpdated;
        if (msg.type === 'event-updated') handlerRef.current(msg);
      } catch {
        // ignore malformed
      }
    };
    return () => ws.close();
  }, []);
}
