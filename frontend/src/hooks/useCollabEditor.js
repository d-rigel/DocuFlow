// Wires a Quill editor instance to Socket.IO so that:
//  - Local changes are emitted to the server
//  - Remote changes are applied without creating echo loops
//  - Content is auto-saved every 5 seconds and on unmount

import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAuthStore } from '../store/authStore';
import { documentsAPI } from '../services/api';

const SAVE_INTERVAL_MS = 5000;

export function useCollabEditor(quillRef, documentId) {
  const socket        = useSocket();
  const user          = useAuthStore((s) => s.user);
  const isRemoteRef   = useRef(false);   // guard against echo
  const saveTimerRef  = useRef(null);

  // ------------------------------------------------------------------
  // Save helper — persists full Quill content via REST (not socket)
  // ------------------------------------------------------------------
  const saveContent = useCallback(async () => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill || !documentId) return;
    try {
      await documentsAPI.update(documentId, {
        content: JSON.stringify(quill.getContents()),
        lastSavedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[Editor] Auto-save failed:', e.message);
    }
  }, [quillRef, documentId]);

  // ------------------------------------------------------------------
  // Join document room on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !documentId) return;

    socket.emit('join-document', { documentId });

    return () => {
      saveContent();                          // save on leave
      socket.emit('leave-document', { documentId });
    };
  }, [socket, documentId, saveContent]);

  // ------------------------------------------------------------------
  // Receive remote deltas and apply to Quill
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onRemoteChange = ({ delta }) => {
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      isRemoteRef.current = true;
      quill.updateContents(delta, 'api');     // 'api' source = no re-emit
      isRemoteRef.current = false;
    };

    socket.on('doc:change', onRemoteChange);
    return () => socket.off('doc:change', onRemoteChange);
  }, [socket, quillRef]);

  // ------------------------------------------------------------------
  // Send local deltas to server
  // ------------------------------------------------------------------
  const handleChange = useCallback(
    (_value, delta, source) => {
      if (source !== 'user' || isRemoteRef.current) return;
      if (!socket || !documentId) return;

      socket.emit('doc:change', { documentId, delta });

      // Debounce DB save
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveContent, SAVE_INTERVAL_MS);
    },
    [socket, documentId, saveContent]
  );

  // ------------------------------------------------------------------
  // Emit cursor position for presence
  // ------------------------------------------------------------------
  const handleSelectionChange = useCallback(
    (range) => {
      if (!socket || !documentId || !range) return;
      socket.emit('presence:cursor', {
        documentId,
        cursor: range,
        name: user?.username,
      });
    },
    [socket, documentId, user]
  );

  // ------------------------------------------------------------------
  // Cleanup on unmount
  // ------------------------------------------------------------------
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { handleChange, handleSelectionChange };
}
