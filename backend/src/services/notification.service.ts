import prisma from '../config/prisma.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';



export const createUserNotification = async (input: {
  userId: number;
  title: string;
  message: string;
}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
      },
    });
    emitUserNotification(input.userId, notification);
  } catch (error) {
    // Notifications are best-effort and must not undo a booking/payment action.
    console.error('Could not create notification:', error);
  }
};
