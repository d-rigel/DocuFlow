// Two responsibilities:
//   1. Attach Socket.IO to the Strapi HTTP server (real-time collab)
//   2. Register a catch-all Koa route that serves the React SPA

import { Server, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import type { Core } from '@strapi/strapi';

interface ActiveUser {
  userId:   number;
  userName: string;
  color:    string;
  cursor:   object | null;
}

// { [documentId]: { [socketId]: ActiveUser } }
const rooms: Record<string, Record<string, ActiveUser>> = {};

// Debounce map for DB saves: { [documentId]: NodeJS.Timeout }
const savePending: Record<string, ReturnType<typeof setTimeout>> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randomColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function leaveDocument(
  socket: Socket,
  documentId: string,
  io: Server
): void {
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

// ---------------------------------------------------------------------------
// Strapi lifecycle hooks
// ---------------------------------------------------------------------------
export default {
  /**
   * register() — runs before Strapi loads.
   * Adds a Koa catch-all that returns the React SPA index.html for every
   * non-API, non-admin path so client-side React Router works.
   */
  register({ strapi }: { strapi: Core.Strapi }): void {
    const router = strapi.server.router as any;

    router.get('/((?!api|admin|uploads).*)', async (ctx: any, next: () => Promise<void>) => {
      const indexPath = path.join(process.cwd(), 'public/app/index.html');

      if (fs.existsSync(indexPath)) {
        ctx.type = 'html';
        ctx.body = fs.createReadStream(indexPath);
      } else {
        // In development the React app is served by Vite; pass through.
        await next();
      }
    });
  },

  /**
   * bootstrap() — runs after Strapi and the HTTP server are ready.
   * Attaches Socket.IO to the existing httpServer.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }): Promise<void> {
    const io = new Server((strapi.server as any).httpServer, {
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:1337',
          // Add your production domain here
        ],
        methods:     ['GET', 'POST'],
        credentials: true,
      },
    });

    // -----------------------------------------------------------------------
    // Auth middleware — verify JWT before allowing socket connections
    // -----------------------------------------------------------------------
    io.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const token: string | undefined =
          (socket.handshake.auth as any).token ||
          (socket.handshake.query as any).token;

        if (!token) return next(new Error('Authentication required'));

        // Strapi v5: JWT service accessed via strapi.plugin()
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const decoded = await (jwtService as any).verify(token);

        // users-permissions users are not managed by the Document Service.
        // Use strapi.db.query() for a direct DB lookup.
        const user = await strapi.db!
          .query('plugin::users-permissions.user')
          .findOne({
            where:  { id: decoded.id },
            select: ['id', 'username', 'email'],
          });

        if (!user) return next(new Error('User not found'));

        (socket as any).user = user;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    // -----------------------------------------------------------------------
    // Connection handler
    // -----------------------------------------------------------------------
    io.on('connection', (socket: Socket) => {
      const user      = (socket as any).user as { id: number; username: string };
      const userColor = randomColor();

      strapi.log.info(`[Socket] Connected: ${user.username} (${socket.id})`);

      // ── join-document ────────────────────────────────────────────────────
      socket.on('join-document', ({ documentId }: { documentId: string }) => {
        const roomKey = `doc:${documentId}`;
        socket.join(roomKey);

        if (!rooms[documentId]) rooms[documentId] = {};
        rooms[documentId][socket.id] = {
          userId:   user.id,
          userName: user.username,
          color:    userColor,
          cursor:   null,
        };

        io.to(roomKey).emit('presence:update', {
          users: Object.values(rooms[documentId]),
        });

        strapi.log.debug(`[Socket] ${user.username} joined doc ${documentId}`);
      });

      // ── doc:change ───────────────────────────────────────────────────────
      socket.on(
        'doc:change',
        ({ documentId, delta, version }: { documentId: string; delta: object; version: number }) => {
          const roomKey = `doc:${documentId}`;

          // Broadcast to everyone else in the room
          socket.to(roomKey).emit('doc:change', {
            delta,
            userId:   user.id,
            userName: user.username,
            version,
          });

          // Debounced DB touch (1 s of inactivity)
          if (savePending[documentId]) clearTimeout(savePending[documentId]);
          savePending[documentId] = setTimeout(async () => {
            try {
              await (strapi.documents as any)(
                'api::document.document'
              ).update({
                documentId,
                data: { lastSavedAt: new Date() },
              });
            } catch (e: any) {
              strapi.log.error('[Socket] DB save error:', e.message);
            }
          }, 1000);
        }
      );

      // ── doc:save ─────────────────────────────────────────────────────────
      socket.on(
        'doc:save',
        async ({
          documentId,
          content,
          whiteboardJson,
        }: {
          documentId: string;
          content: object;
          whiteboardJson?: object;
        }) => {
          try {
            const updateData: Record<string, any> = {
              content:     JSON.stringify(content),
              lastSavedAt: new Date(),
            };
            if (whiteboardJson !== undefined) {
              updateData.whiteboardJson = JSON.stringify(whiteboardJson);
            }
            await (strapi.documents as any)(
              'api::document.document'
            ).update({
              documentId,
              data: updateData,
            });
            socket.emit('doc:saved', { documentId, savedAt: new Date() });
          } catch (e: any) {
            strapi.log.error('[Socket] doc:save error:', e.message);
            socket.emit('doc:save-error', { message: e.message });
          }
        }
      );

      // ── whiteboard:draw ──────────────────────────────────────────────────
      socket.on(
        'whiteboard:draw',
        ({ documentId, fabricJson }: { documentId: string; fabricJson: object }) => {
          socket
            .to(`doc:${documentId}`)
            .emit('whiteboard:draw', { fabricJson, userId: user.id });
        }
      );

      // ── whiteboard:clear ─────────────────────────────────────────────────
      socket.on('whiteboard:clear', ({ documentId }: { documentId: string }) => {
        socket.to(`doc:${documentId}`).emit('whiteboard:clear');
      });

      // ── presence:cursor ──────────────────────────────────────────────────
      socket.on(
        'presence:cursor',
        ({ documentId, cursor }: { documentId: string; cursor: object }) => {
          if (rooms[documentId]?.[socket.id]) {
            rooms[documentId][socket.id].cursor = cursor;
          }
          socket.to(`doc:${documentId}`).emit('presence:cursor', {
            userId:   user.id,
            userName: user.username,
            color:    userColor,
            cursor,
          });
        }
      );

      // ── leave-document ───────────────────────────────────────────────────
      socket.on('leave-document', ({ documentId }: { documentId: string }) => {
        leaveDocument(socket, documentId, io);
      });

      // ── disconnect ───────────────────────────────────────────────────────
      socket.on('disconnect', () => {
        Object.keys(rooms).forEach((docId) => {
          if (rooms[docId]?.[socket.id]) {
            leaveDocument(socket, docId, io);
          }
        });
        strapi.log.info(`[Socket] Disconnected: ${user.username}`);
      });
    });

    // Expose io on strapi instance (controllers can emit if needed)
    (strapi as any).io = io;
  },
};

