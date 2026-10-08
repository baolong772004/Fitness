import 'package:socket_io_client/socket_io_client.dart' as io;

import 'auth_service.dart';

class PtChatLiveService {
  PtChatLiveService(this.auth);

  final AuthService auth;
  io.Socket? _socket;
  int? _bookingId;

  void connect({
    required int bookingId,
    required void Function(PtChatMessage) onMessage,
    required void Function() onConnected,
    required void Function() onDisconnected,
    required void Function() onClosed,
    required void Function(String) onError,
  }) {
    dispose();
    final token = auth.accessToken;
    if (token == null || token.isEmpty) {
      onError('Vui lòng đăng nhập để nhắn tin với PT.');
      return;
    }
    _bookingId = bookingId;
    final socket = io.io(
      auth.socketBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) {
      if (!identical(_socket, socket)) return;
      socket.emitWithAck(
        'booking:join',
        bookingId,
        ack: (dynamic result) {
          if (!identical(_socket, socket)) return;
          if (result is Map && result['ok'] == true) {
            onConnected();
          } else {
            onError(
              result is Map
                  ? result['error']?.toString() ??
                        'Không thể mở cuộc trò chuyện.'
                  : 'Không thể mở cuộc trò chuyện.',
            );
          }
        },
      );
    });
    socket.on('message:new', (dynamic payload) {
      if (!identical(_socket, socket)) return;
      if (payload is! Map) return;
      final message = PtChatMessage.fromJson(
        payload.map((key, value) => MapEntry('$key', value)),
      );
      if (message.id > 0 && message.bookingId == bookingId) onMessage(message);
    });
    socket.on('booking:chat-closed', (dynamic payload) {
      if (!identical(_socket, socket) || payload is! Map) return;
      if (int.tryParse(payload['bookingId']?.toString() ?? '') == bookingId) {
        onClosed();
      }
    });
    socket.onDisconnect((_) {
      if (identical(_socket, socket)) onDisconnected();
    });
    socket.onConnectError(
      (dynamic error) {
        if (identical(_socket, socket)) {
          onError('Mất kết nối thời gian thực. Kéo xuống để tải lại tin nhắn.');
        }
      },
    );
    socket.connect();
  }

  void dispose() {
    final socket = _socket;
    _socket = null;
    final bookingId = _bookingId;
    _bookingId = null;
    if (socket != null) {
      if (bookingId != null) socket.emit('booking:leave', bookingId);
      socket.dispose();
    }
  }
}
