// Returns the live socket instance, reconnecting if needed.

import { useEffect, useState } from 'react';
import { connectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    setSocket(s);

    s.on('connect', () => setSocket(s));
    return () => {
      s.off('connect');
    };
  }, [token]);

  return socket;
}
