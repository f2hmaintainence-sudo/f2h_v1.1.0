'use client';

/**
 * useOrderSocket
 * Establishes a WebSocket connection authenticated via one-time ticket.
 * Listens for:
 *   - `order_status_update`  → individual delivery status changed
 *   - `zone_assignment_changed` → rider assigned/unassigned from a zone
 *
 * Usage:
 *   const { connected } = useOrderSocket({
 *     onStatusUpdate: ({ scheduleId, status }) => { ... },
 *     onZoneChange:   ({ zoneId, newRiderUserId, prevRiderUserIds }) => { ... },
 *   })
 *
 * For backward-compat a bare callback still works:
 *   const { connected } = useOrderSocket(callback)
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '@/services/api.client';

export interface OrderStatusUpdate {
  scheduleId: number;
  status: string;
  updatedBy: string;
  timestamp: string;
}

export interface ZoneAssignmentChange {
  zoneId: string | null;
  newRiderUserId: string | null;
  prevRiderUserIds: string[];
  timestamp: string;
}

type StatusCallback = (update: OrderStatusUpdate) => void;
type ZoneCallback   = (update: ZoneAssignmentChange) => void;

interface Callbacks {
  onStatusUpdate?: StatusCallback;
  onZoneChange?:   ZoneCallback;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined'
    ? window.location.origin.replace(/^http/, 'ws')
    : 'wss://f2hfresh.com');

// Accept either a bare status callback (backward-compat) or a callbacks object
export function useOrderSocket(
  callbacksOrFn: StatusCallback | Callbacks,
) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const cbRef = useRef<Callbacks>({});

  // Normalise to { onStatusUpdate, onZoneChange }
  useEffect(() => {
    if (typeof callbacksOrFn === 'function') {
      cbRef.current = { onStatusUpdate: callbacksOrFn };
    } else {
      cbRef.current = callbacksOrFn;
    }
  }, [callbacksOrFn]);

  useEffect(() => {
    let cancelled = false;
    let currentSocket: Socket | null = null;

    async function connect() {
      if (cancelled) return;

      try {
        const resp = await api.get<{ ticket: string }>('/auth/ws-ticket');
        if (cancelled || !resp.data?.ticket) return;

        const ticket = resp.data.ticket;

        // Tear down any previous socket before creating a new one
        if (currentSocket) {
          currentSocket.removeAllListeners();
          currentSocket.disconnect();
          currentSocket = null;
        }

        const socket = io(WS_BASE, {
          path: '/socket.io',
          transports: ['websocket'],
          auth: { ticket },
          // Disable built-in auto-reconnect — we handle it manually so we can
          // fetch a fresh one-time ticket each time.
          reconnection: false,
        });

        currentSocket = socket;
        socketRef.current = socket;

        socket.on('connect', () => {
          if (!cancelled) setConnected(true);
        });

        socket.on('disconnect', () => {
          if (!cancelled) {
            setConnected(false);
            // Re-connect with a fresh ticket after a short delay
            setTimeout(() => connect(), 3000);
          }
        });

        socket.on('connect_error', () => {
          if (!cancelled) {
            setConnected(false);
            // Retry with a fresh ticket
            setTimeout(() => connect(), 5000);
          }
        });

        socket.on('order_status_update', (data: OrderStatusUpdate) => {
          cbRef.current.onStatusUpdate?.(data);
        });

        socket.on('zone_assignment_changed', (data: ZoneAssignmentChange) => {
          cbRef.current.onZoneChange?.(data);
        });
      } catch {
        // silent — retry after delay
        if (!cancelled) setTimeout(() => connect(), 5000);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (currentSocket) {
        currentSocket.removeAllListeners();
        currentSocket.disconnect();
        currentSocket = null;
      }
      socketRef.current = null;
      setConnected(false);
    };
  }, []); // connect once on mount, then self-manages reconnects

  return { connected };
}

