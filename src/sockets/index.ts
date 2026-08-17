import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { corsOriginDelegate } from '../config/env';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initSocketIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: corsOriginDelegate,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyAccessToken(token as string);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info('Socket connected', { userId: user?.userId, socketId: socket.id });

    socket.join(`user:${user.userId}`);

    if (user.role === 'admin' || user.role === 'support_agent') {
      socket.join('staff');
    }

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: user?.userId, socketId: socket.id });
    });
  });

  return io;
};

export const getSocketIO = (): Server | null => io;
