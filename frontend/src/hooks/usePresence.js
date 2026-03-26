// Subscribes to presence:update events for a document room.
// Returns array of { userId, userName, color, cursor } for all active users.

import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export function usePresence(documentId) {
  const socket = useSocket();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!socket || !documentId) return;

    const onPresence = ({ users: activeUsers }) => {
      setUsers(activeUsers || []);
    };

    socket.on('presence:update', onPresence);
    return () => socket.off('presence:update', onPresence);
  }, [socket, documentId]);

  return users;
}
