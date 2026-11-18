import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, tokenStorage } from './api/client';

export interface PayosStatusEvent {
  orderCode: string;
  status: string;
  paid: boolean;
  message?: string;
  data?: any;
}

export function getSocketBaseUrl(): string {
  return API_BASE_URL.replace(/\/api\/?$/, '');
}

export function createAuthorizedSocket(): Socket | null {
  const token = tokenStorage.getAccessToken();
  if (!token) return null;
  return io(getSocketBaseUrl(), {
    auth: { token },
    transports: ['websocket', 'polling']
  });
}

/**
 * Subscribe to real-time PayOS order status updates over Socket.IO.
 * Returns an unsubscribe cleanup function.
 */
export function subscribePayosOrder(
  orderCode: string | number,
  onStatus: (payload: PayosStatusEvent) => void
): () => void {
  const orderText = String(orderCode).trim();
  if (!/^\d+$/.test(orderText)) return () => {};

  const socket = createAuthorizedSocket();
  if (!socket) return () => {};

  const handleConnect = () => {
    socket.emit('payos:join', orderText);
  };
  const handleStatus = (payload: PayosStatusEvent) => {
    if (String(payload?.orderCode || '') !== orderText) return;
    onStatus(payload);
  };

  socket.on('connect', handleConnect);
  socket.on('payos:status', handleStatus);
  if (socket.connected) {
    handleConnect();
  }

  return () => {
    socket.off('connect', handleConnect);
    socket.off('payos:status', handleStatus);
    socket.emit('payos:leave', orderText);
    socket.disconnect();
  };
}
