import prisma from '../config/prisma.js';



export const createUserNotification = async (input: {
  userId: number;
  title: string;
  message: string;
}) => {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
      },
    });
  } catch (error) {
    // Notifications are best-effort and must not undo a booking/payment action.
    console.error('Could not create notification:', error);
  }
};
