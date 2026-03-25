// backend/src/index.js
// Two responsibilities:
//   1. Attach Socket.IO to the Strapi HTTP server (real-time collab)
//   2. Register a catch-all Koa route that serves the React SPA

'use strict';

const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// In-memory store for active document rooms
// { [documentId]: { [socketId]: { userId, userName, color, cursor } } }
// ---------------------------------------------------------------------------
const rooms = {};

// Debounce map: { [documentId]: timeoutId }
// We batch DB saves so rapid typing doesn't hammer the database.
const savePending = {};

module.exports = {
  /**
   * register() runs before Strapi is fully loaded.
   * Use it to add a Koa route that serves the React index.html for every
   * non-API, non-admin path so client-side React Router works correctly.
   */
  register({ strapi }) {
    const router = strapi.server.router;

    // Serve React SPA for all non-API routes (must be added BEFORE Strapi's
    // own routes are mounted, so we use a wildcard at the end).
    router.get('/((?!api|admin|uploads).*)', async (ctx, next) => {
      const indexPath = path.join(
        __dirname,
        '../../public/app/index.html'
      );

      if (fs.existsSync(indexPath)) {
        ctx.type = 'html';
        ctx.body = fs.createReadStream(indexPath);
      } else {
        // In development the React app is served by Vite, not Strapi.
        // Just pass through to Strapi's own 404 handler.
        await next();
      }
    });
  },

  /**
   * bootstrap() runs after Strapi is loaded and the HTTP server is listening.
   * This is the right place to attach Socket.IO to the existing httpServer.
   */
  async bootstrap({ strapi }) {
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:1337',
          // Add your production domain here
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // ------------------------------------------------------------------
    // Auth middleware — validate JWT before allowing socket connections
    // ------------------------------------------------------------------
    io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.query.token;

        if (!token) return next(new Error('Authentication required'));

        // Verify with Strapi's JWT service
        const decoded = await strapi.plugins[
          'users-permissions'
        ].services.jwt.verify(token);

        const user = await strapi.entityService.findOne(
          'plugin::users-permissions.user',
          decoded.id,
          { fields: ['id', 'username', 'email'] }
        );

        if (!user) return next(new Error('User not found'));

        socket.user = user;
        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });

    // ------------------------------------------------------------------
    // Connection handler
    // ------------------------------------------------------------------
    io.on('connection', (socket) => {
      const { user } = socket;
      const userColor = randomColor();

      strapi.log.info(`[Socket] User connected: ${user.username} (${socket.id})`);

      // ----------------------------------------------------------------
      // join-document
      // Client joins a document room to receive/send real-time events
      // ----------------------------------------------------------------
      socket.on('join-document', async ({ documentId }) => {
        const roomKey = `doc:${documentId}`;
        socket.join(roomKey);

        // Track presence
        if (!rooms[documentId]) rooms[documentId] = {};
        rooms[documentId][socket.id] = {
          userId: user.id,
          userName: user.username,
          color: userColor,
          cursor: null,
        };

        // Broadcast updated presence list to all in room
        io.to(roomKey).emit('presence:update', {
          users: Object.values(rooms[documentId]),
        });

        strapi.log.debug(`[Socket] ${user.username} joined doc ${documentId}`);
      });

      // ----------------------------------------------------------------
      // doc:change
      // Quill delta from one client, broadcast to others in room
      // ----------------------------------------------------------------
      socket.on('doc:change', async ({ documentId, delta, version }) => {
        const roomKey = `doc:${documentId}`;

        // Broadcast to every other client in the room
        socket.to(roomKey).emit('doc:change', {
          delta,
          userId: user.id,
          userName: user.username,
          version,
        });

        // Debounced DB save (waits 1 second of inactivity before writing)
        if (savePending[documentId]) clearTimeout(savePending[documentId]);
        savePending[documentId] = setTimeout(async () => {
          try {
            // Fetch current content, apply delta, save
            // NOTE: For production, use full OT (e.g. ShareDB or Yjs).
            // Here we store the full Quill content as JSON sent by client.
            await strapi.entityService.update(
              'api::document.document',
              documentId,
              { data: { lastSavedAt: new Date() } }
            );
          } catch (e) {
            strapi.log.error('[Socket] DB save error:', e.message);
          }
        }, 1000);
      });

      // ----------------------------------------------------------------
      // doc:save
      // Client sends full Quill content to persist
      // ----------------------------------------------------------------
      socket.on('doc:save', async ({ documentId, content, whiteboardJson }) => {
        try {
          const updateData = {
            content: JSON.stringify(content),
            lastSavedAt: new Date(),
          };
          if (whiteboardJson !== undefined) {
            updateData.whiteboardJson = JSON.stringify(whiteboardJson);
          }
          await strapi.entityService.update(
            'api::document.document',
            documentId,
            { data: updateData }
          );
          socket.emit('doc:saved', { documentId, savedAt: new Date() });
        } catch (e) {
          strapi.log.error('[Socket] doc:save error:', e.message);
          socket.emit('doc:save-error', { message: e.message });
        }
      });

      // ----------------------------------------------------------------
      // whiteboard:draw
      // Fabric.js canvas JSON from one client, broadcast to others
      // ----------------------------------------------------------------
      socket.on('whiteboard:draw', ({ documentId, fabricJson }) => {
        const roomKey = `doc:${documentId}`;
        socket.to(roomKey).emit('whiteboard:draw', {
          fabricJson,
          userId: user.id,
        });
      });

      // ----------------------------------------------------------------
      // whiteboard:clear
      // ----------------------------------------------------------------
      socket.on('whiteboard:clear', ({ documentId }) => {
        const roomKey = `doc:${documentId}`;
        socket.to(roomKey).emit('whiteboard:clear');
      });

      // ----------------------------------------------------------------
      // presence:cursor
      // Cursor position from client, broadcast to others
      // ----------------------------------------------------------------
      socket.on('presence:cursor', ({ documentId, cursor }) => {
        const roomKey = `doc:${documentId}`;
        if (rooms[documentId]?.[socket.id]) {
          rooms[documentId][socket.id].cursor = cursor;
        }
        socket.to(roomKey).emit('presence:cursor', {
          userId: user.id,
          userName: user.username,
          color: userColor,
          cursor,
        });
      });

      // ----------------------------------------------------------------
      // leave-document
      // ----------------------------------------------------------------
      socket.on('leave-document', ({ documentId }) => {
        leaveDocument(socket, documentId, io);
      });

      // ----------------------------------------------------------------
      // disconnect
      // ----------------------------------------------------------------
      socket.on('disconnect', () => {
        // Remove from all rooms
        Object.keys(rooms).forEach((docId) => {
          if (rooms[docId]?.[socket.id]) {
            leaveDocument(socket, docId, io);
          }
        });
        strapi.log.info(`[Socket] User disconnected: ${user.username}`);
      });
    });

    // Expose io on strapi so controllers can emit if needed
    strapi.io = io;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function leaveDocument(socket, documentId, io) {
  const roomKey = `doc:${documentId}`;
  socket.leave(roomKey);

  if (rooms[documentId]) {
    delete rooms[documentId][socket.id];
    if (Object.keys(rooms[documentId]).length === 0) {
      delete rooms[documentId];
    } else {
      io.to(roomKey).emit('presence:update', {
        users: Object.values(rooms[documentId]),
      });
    }
  }
}

function randomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}


