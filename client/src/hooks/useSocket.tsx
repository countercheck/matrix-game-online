import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : window.location.origin;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);
  const listenersRef = useRef(new Set<() => void>());

  // Subscribe function for useSyncExternalStore
  const subscribe = (listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  };

  const notify = () => {
    listenersRef.current.forEach((l) => l());
  };

  const getSocketSnapshot = () => socketRef.current;
  const getConnectedSnapshot = () => connectedRef.current;

  // Extract userId from token to avoid reconnecting on token refresh
  const getUserIdFromToken = (token: string | null): string | null => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        connectedRef.current = false;
        notify();
      }
      return;
    }

    // Check if we already have a socket with the same user
    const currentUserId = getUserIdFromToken(token);
    const existingSocket = socketRef.current;

    let existingUserId: string | null = null;
    if (
      existingSocket &&
      typeof (existingSocket as Socket & { auth?: unknown }).auth === 'object'
    ) {
      const existingAuth = (existingSocket as Socket & { auth?: { token?: unknown } }).auth;
      const existingToken =
        existingAuth && typeof existingAuth.token === 'string' ? existingAuth.token : null;
      if (existingToken) {
        existingUserId = getUserIdFromToken(existingToken);
      }
    }

    // Reuse existing socket only if it belongs to the same user
    if (existingSocket && currentUserId && existingUserId === currentUserId) {
      existingSocket.auth = { token };
      return; // Keep existing connection for same user, refresh token
    }

    // If there is an existing socket for a different (or unknown) user, disconnect it
    if (existingSocket) {
      existingSocket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
      notify();
    }
    // Create new socket connection
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      connectedRef.current = true;
      notify();
    });
    newSocket.on('disconnect', () => {
      connectedRef.current = false;
      notify();
    });

    socketRef.current = newSocket;
    notify();

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
      notify();
    };
  }, [token]);

  const socket = useSyncExternalStore(subscribe, getSocketSnapshot, () => null);
  const isConnected = useSyncExternalStore(subscribe, getConnectedSnapshot, () => false);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
