import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

class Member {
  const Member({
    required this.name,
    required this.email,
    this.id,
    this.phone,
    this.balance,
    this.role = 'MEMBER',
  });

  final String name;
  final String email;
  final String? id;
  final String? phone;
  final String? balance;
  // Nullable so a Member instance kept alive across Flutter hot reloads, from
  // before this field existed, safely falls back to a member account.
  final String? role;

  String get effectiveRole => role ?? 'MEMBER';

  factory Member.fromJson(Map<String, dynamic> json) => Member(
    name: json['fullName']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
    id: json['id']?.toString(),
    phone: json['phone']?.toString(),
    balance: json['balance']?.toString(),
    role: json['role']?.toString() ?? 'MEMBER',
  );
}

class AuthApiException implements Exception {
  const AuthApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class CheckInQr {
  const CheckInQr({required this.token, required this.imageData});

  final String token;
  final String imageData;
}

class CheckInHistoryRecord {
  const CheckInHistoryRecord({
    required this.id,
    required this.checkInTime,
    required this.method,
    required this.status,
    this.rejectReason,
    this.packageName,
  });

  final String id;
  final DateTime? checkInTime;
  final String method;
  final String status;
  final String? rejectReason;
  final String? packageName;

  factory CheckInHistoryRecord.fromJson(Map<String, dynamic> json) {
    final membershipValue = json['membership'];
    final Map? membership = membershipValue is Map ? membershipValue : null;
    final packageValue = membership?['package'];
    final Map? package = packageValue is Map ? packageValue : null;
    return CheckInHistoryRecord(
      id: json['id']?.toString() ?? '',
      checkInTime: DateTime.tryParse(
        json['checkInTime']?.toString() ?? '',
      )?.toLocal(),
      method: json['method']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      rejectReason: json['rejectReason']?.toString(),
      packageName: package?['name']?.toString(),
    );
  }
}

class CheckInHistoryPage {
  const CheckInHistoryPage({
    required this.records,
    required this.page,
    required this.totalPages,
    required this.total,
  });

  final List<CheckInHistoryRecord> records;
  final int page;
  final int totalPages;
  final int total;
}

class MemberNotification {
  const MemberNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;

  factory MemberNotification.fromJson(Map<String, dynamic> json) =>
      MemberNotification(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Thông báo Aura',
        message: json['message']?.toString() ?? '',
        isRead: json['isRead'] == true,
        createdAt: DateTime.tryParse(
          json['createdAt']?.toString() ?? '',
        )?.toLocal(),
      );
}

class MemberNotificationPage {
  const MemberNotificationPage({
    required this.notifications,
    required this.unreadCount,
    required this.page,
    required this.totalPages,
  });

  final List<MemberNotification> notifications;
  final int unreadCount;
  final int page;
  final int totalPages;
}

class FitnessPackage {
  const FitnessPackage({
    required this.id,
    required this.name,
    required this.type,
    required this.price,
    required this.durationDays,
    this.description,
    this.trialPtSessions = 0,
    this.totalPtSessions,
  });

  final int id;
  final String name;
  final String type;
  final double price;
  final int durationDays;
  final String? description;
  final int trialPtSessions;
  final int? totalPtSessions;

  factory FitnessPackage.fromJson(Map<String, dynamic> json) => FitnessPackage(
    id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
    name: json['name']?.toString() ?? 'Gói tập Aura',
    type: json['type']?.toString() ?? 'MEMBERSHIP',
    price: double.tryParse(json['price']?.toString() ?? '') ?? 0,
    durationDays: int.tryParse(json['durationDays']?.toString() ?? '') ?? 0,
    description: json['description']?.toString(),
    trialPtSessions:
        int.tryParse(json['trialPtSessions']?.toString() ?? '') ?? 0,
    totalPtSessions: int.tryParse(json['totalPtSessions']?.toString() ?? ''),
  );
}

class FitnessCoach {
  const FitnessCoach({
    required this.id,
    required this.name,
    this.avatar,
    this.specialization,
    this.bio,
    this.rating,
  });

  final int id;
  final String name;
  final String? avatar;
  final String? specialization;
  final String? bio;
  final double? rating;

  factory FitnessCoach.fromJson(Map<String, dynamic> json) => FitnessCoach(
    id: int.tryParse(json['userId']?.toString() ?? '') ?? 0,
    name: json['fullName']?.toString() ?? 'Huấn luyện viên Aura',
    avatar: json['avatar']?.toString(),
    specialization: json['specialization']?.toString(),
    bio: json['bio']?.toString(),
    rating: double.tryParse(json['rating']?.toString() ?? ''),
  );
}

class MemberSubscription {
  const MemberSubscription({
    required this.id,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.package,
    this.remainingSessions,
    this.coachId,
    this.coachName,
  });

  final String id;
  final String status;
  final DateTime? startDate;
  final DateTime? endDate;
  final int? remainingSessions;
  final int? coachId;
  final String? coachName;
  final FitnessPackage? package;

  factory MemberSubscription.fromJson(Map<String, dynamic> json) {
    final packageValue = json['package'];
    final Map? packageJson = packageValue is Map ? packageValue : null;
    final coachValue = json['coach'];
    final Map? coachJson = coachValue is Map ? coachValue : null;
    return MemberSubscription(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      startDate: DateTime.tryParse(
        json['startDate']?.toString() ?? '',
      )?.toLocal(),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? '')?.toLocal(),
      remainingSessions: int.tryParse(
        json['remainingSessions']?.toString() ?? '',
      ),
      coachId: int.tryParse(json['coachId']?.toString() ?? ''),
      coachName: coachJson?['fullName']?.toString(),
      package: packageJson == null
          ? null
          : FitnessPackage.fromJson(
              packageJson.map((key, value) => MapEntry('$key', value)),
            ),
    );
  }
}

class PtTimeSlot {
  const PtTimeSlot({
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.isAvailable,
  });

  final String startTime;
  final String endTime;
  final String status;
  final bool isAvailable;

  factory PtTimeSlot.fromJson(Map<String, dynamic> json) => PtTimeSlot(
    startTime: json['startTime']?.toString() ?? '',
    endTime: json['endTime']?.toString() ?? '',
    status: json['status']?.toString() ?? 'UNAVAILABLE',
    isAvailable: json['isAvailable'] == true,
  );
}

class PtBooking {
  const PtBooking({
    required this.id,
    required this.status,
    required this.startTime,
    required this.endTime,
    this.coachId,
    this.coachName,
    this.memberName,
    this.membershipId,
    this.packageName,
    this.remainingSessions,
    this.absenceReportedAt,
    this.isMakeup = false,
  });

  final int id;
  final String status;
  final DateTime? startTime;
  final DateTime? endTime;
  final int? coachId;
  final String? coachName;
  final String? memberName;
  final int? membershipId;
  final String? packageName;
  final int? remainingSessions;
  final DateTime? absenceReportedAt;
  final bool isMakeup;

  factory PtBooking.fromJson(Map<String, dynamic> json) {
    final coach = json['coach'] is Map ? json['coach'] as Map : null;
    final member = json['member'] is Map ? json['member'] as Map : null;
    final membership = json['membership'] is Map
        ? json['membership'] as Map
        : null;
    final package = membership?['package'] is Map
        ? membership!['package'] as Map
        : null;
    return PtBooking(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      status: json['status']?.toString() ?? 'UPCOMING',
      startTime: DateTime.tryParse(
        json['startTime']?.toString() ?? '',
      )?.toLocal(),
      endTime: DateTime.tryParse(json['endTime']?.toString() ?? '')?.toLocal(),
      coachId: int.tryParse(json['coachId']?.toString() ?? ''),
      coachName: coach?['fullName']?.toString(),
      memberName: member?['fullName']?.toString(),
      membershipId: int.tryParse(json['membershipId']?.toString() ?? ''),
      packageName: package?['name']?.toString(),
      remainingSessions: int.tryParse(
        membership?['remainingSessions']?.toString() ?? '',
      ),
      absenceReportedAt: DateTime.tryParse(
        json['absenceReportedAt']?.toString() ?? '',
      )?.toLocal(),
      isMakeup: json['isMakeup'] == true,
    );
  }
}

class PtSessionQr {
  const PtSessionQr({required this.token});
  final String token;
}

class PtChatMessage {
  const PtChatMessage({
    required this.id,
    required this.bookingId,
    required this.senderId,
    required this.content,
    required this.createdAt,
  });

  final int id;
  final int bookingId;
  final int senderId;
  final String content;
  final DateTime? createdAt;

  factory PtChatMessage.fromJson(Map<String, dynamic> json) => PtChatMessage(
    id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
    bookingId: int.tryParse(json['bookingId']?.toString() ?? '') ?? 0,
    senderId: int.tryParse(json['senderId']?.toString() ?? '') ?? 0,
    content: json['content']?.toString() ?? '',
    createdAt: DateTime.tryParse(
      json['createdAt']?.toString() ?? '',
    )?.toLocal(),
  );
}

class PtChatPage {
  const PtChatPage({
    required this.messages,
    required this.hasMore,
    required this.canSend,
  });

  final List<PtChatMessage> messages;
  final bool hasMore;
  final bool canSend;
}

class PayOsCheckout {
  const PayOsCheckout({
    required this.orderCode,
    required this.checkoutUrl,
    required this.qrCode,
  });

  final String orderCode;
  final String checkoutUrl;
  final String qrCode;
}

class PayOsPaymentStatus {
  const PayOsPaymentStatus({required this.status, required this.isPaid});

  final String status;
  final bool isPaid;
}

class AuthService {
  AuthService({String? baseUrl}) : _baseUrl = baseUrl ?? _defaultBaseUrl;

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static String get _defaultBaseUrl {
    if (_configuredBaseUrl.isNotEmpty) return _configuredBaseUrl;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:5000/api';
      case TargetPlatform.iOS:
      case TargetPlatform.linux:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.fuchsia:
        return 'http://localhost:5000/api';
    }
  }

  final String _baseUrl;
  String get socketBaseUrl => Uri.parse(_baseUrl).origin;
  Member? currentMember;
  String? accessToken;
  String? refreshToken;

  Future<Member> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    await _post('/auth/register', {
      'email': normalizedEmail,
      'password': password,
      'fullName': name.trim(),
      'phone': phone?.trim() ?? '',
    });

    // The register endpoint creates the account but does not issue tokens.
    try {
      return await login(email: normalizedEmail, password: password);
    } on AuthApiException {
      throw const AuthApiException(
        'Đăng ký thành công nhưng chưa đăng nhập được. Vui lòng đăng nhập lại.',
      );
    }
  }

  Future<Member> login({
    required String email,
    required String password,
  }) async {
    final response = await _post('/auth/login', {
      'email': email.trim().toLowerCase(),
      'password': password,
    });
    return _acceptLoginResponse(response);
  }

  Future<Member> loginWithGoogle({required String idToken}) async {
    final response = await _post('/auth/google', {'idToken': idToken});
    return _acceptLoginResponse(response);
  }

  Future<CheckInQr> generateCheckInQr() async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Vui lòng đăng nhập để tạo mã QR điểm danh.',
      );
    }
    final response = await _get('/checkin/generate-qr', bearerToken: token);
    final data = _asMap(response['data']);
    final qrToken = data?['token']?.toString();
    final imageData = data?['qrCodeImage']?.toString();
    if (qrToken == null ||
        qrToken.isEmpty ||
        imageData == null ||
        imageData.isEmpty) {
      throw const AuthApiException('Máy chủ chưa trả về mã QR hợp lệ.');
    }
    return CheckInQr(token: qrToken, imageData: imageData);
  }

  Future<CheckInHistoryPage> getCheckInHistory({
    int page = 1,
    int limit = 10,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ xem lá»‹ch sá»­ Ä‘iá»ƒm danh.',
      );
    }
    final response = await _get(
      '/checkin/history?page=$page&limit=$limit',
      bearerToken: token,
    );
    final rows = response['data'];
    final pagination = _asMap(response['pagination']);
    return CheckInHistoryPage(
      records: rows is List
          ? rows
                .whereType<Map>()
                .map(
                  (row) => CheckInHistoryRecord.fromJson(
                    row.map((key, value) => MapEntry('$key', value)),
                  ),
                )
                .toList()
          : const [],
      page: int.tryParse(pagination?['page']?.toString() ?? '') ?? page,
      totalPages:
          int.tryParse(pagination?['totalPages']?.toString() ?? '') ?? 1,
      total: int.tryParse(pagination?['total']?.toString() ?? '') ?? 0,
    );
  }

  Future<MemberNotificationPage> getMyNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để xem thông báo.');
    }
    final response = await _get(
      '/notifications?page=$page&limit=$limit',
      bearerToken: token,
    );
    final rows = response['data'];
    final pagination = _asMap(response['pagination']);
    return MemberNotificationPage(
      notifications: rows is List
          ? rows
                .whereType<Map>()
                .map(
                  (row) => MemberNotification.fromJson(
                    row.map((key, value) => MapEntry('$key', value)),
                  ),
                )
                .toList()
          : const [],
      unreadCount: int.tryParse(response['unreadCount']?.toString() ?? '') ?? 0,
      page: int.tryParse(pagination?['page']?.toString() ?? '') ?? page,
      totalPages:
          int.tryParse(pagination?['totalPages']?.toString() ?? '') ?? 1,
    );
  }

  Future<int> getUnreadNotificationCount() async {
    final token = accessToken;
    if (token == null || token.isEmpty) return 0;
    final response = await _get(
      '/notifications/unread-count',
      bearerToken: token,
    );
    final data = _asMap(response['data']);
    return int.tryParse(data?['unreadCount']?.toString() ?? '') ?? 0;
  }

  Future<void> markNotificationRead(String id) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để cập nhật thông báo.');
    }
    await _request(
      'PATCH',
      '/notifications/$id/read',
      null,
      bearerToken: token,
    );
  }

  Future<void> markAllNotificationsRead() async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để cập nhật thông báo.');
    }
    await _request(
      'PATCH',
      '/notifications/read-all',
      null,
      bearerToken: token,
    );
  }

  Future<List<FitnessPackage>> getFitnessPackages({String? type}) async {
    final query = type == null ? '' : '?type=$type';
    final response = await _get('/packages$query');
    final rows = response['data'];
    if (rows is! List) {
      throw const AuthApiException('Máy chủ chưa trả về danh sách gói tập.');
    }
    return rows
        .whereType<Map>()
        .map(
          (row) => FitnessPackage.fromJson(
            row.map((key, value) => MapEntry('$key', value)),
          ),
        )
        .where((package) => package.id > 0)
        .toList();
  }

  Future<List<FitnessCoach>> getAvailablePtCoaches() async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Vui lòng đăng nhập để xem huấn luyện viên.',
      );
    }
    final response = await _get('/pt/trainers', bearerToken: token);
    final rows = response['data'];
    if (rows is! List) {
      throw const AuthApiException(
        'Máy chủ chưa trả về danh sách huấn luyện viên.',
      );
    }
    return rows
        .whereType<Map>()
        .map(
          (row) => FitnessCoach.fromJson(
            row.map((key, value) => MapEntry('$key', value)),
          ),
        )
        .where((coach) => coach.id > 0)
        .toList();
  }

  Future<PayOsCheckout> createPtPayOsCheckout({
    required int ptPackageId,
    required int trainerId,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để mua gói PT.');
    }
    final response = await _post('/pt/buy', {
      'ptPackageId': ptPackageId,
      'trainerId': trainerId,
    }, bearerToken: token);
    final data = _asMap(response['data']) ?? response;
    final orderCode = data['orderCode']?.toString();
    final checkoutUrl = data['checkoutUrl']?.toString();
    final qrCode = data['qrCode']?.toString();
    if (orderCode == null ||
        orderCode.isEmpty ||
        checkoutUrl == null ||
        checkoutUrl.isEmpty ||
        qrCode == null ||
        qrCode.isEmpty) {
      throw const AuthApiException(
        'Máy chủ chưa trả về thông tin thanh toán gói PT.',
      );
    }
    return PayOsCheckout(
      orderCode: orderCode,
      checkoutUrl: checkoutUrl,
      qrCode: qrCode,
    );
  }

  Future<List<PtTimeSlot>> getPtTrainerSlots({
    required int trainerId,
    required DateTime date,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để xem lịch PT.');
    }
    final dateText =
        '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
    final response = await _get(
      '/pt/trainers/$trainerId/slots?date=$dateText',
      bearerToken: token,
    );
    final rows = response['slots'];
    if (rows is! List) {
      throw const AuthApiException('Máy chủ chưa trả về danh sách giờ tập.');
    }
    return rows
        .whereType<Map>()
        .map(
          (row) => PtTimeSlot.fromJson(
            row.map((key, value) => MapEntry('$key', value)),
          ),
        )
        .toList();
  }

  Future<void> createPtBooking({
    required int ptSubscriptionId,
    required DateTime bookingDate,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để đặt lịch PT.');
    }
    await _post('/pt/booking', {
      'ptSubscriptionId': ptSubscriptionId,
      'bookingDate': bookingDate.toUtc().toIso8601String(),
    }, bearerToken: token);
  }

  Future<List<PtBooking>> getMyPtBookings() async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để xem lịch PT.');
    }
    final response = await _get('/pt/my-bookings', bearerToken: token);
    final rows = response['data'];
    if (rows is! List) {
      throw const AuthApiException('Máy chủ chưa trả về lịch tập PT.');
    }
    return rows
        .whereType<Map>()
        .map(
          (row) => PtBooking.fromJson(
            row.map((key, value) => MapEntry('$key', value)),
          ),
        )
        .toList();
  }

  Future<PtChatPage> getPtChatMessages(
    int bookingId, {
    int? beforeId,
    int? afterId,
  }) async {
    final query = beforeId != null
        ? '?beforeId=$beforeId'
        : afterId != null
        ? '?afterId=$afterId'
        : '';
    final response = await _get(
      '/pt/booking/$bookingId/messages$query',
      bearerToken: _ptAccessToken,
    );
    final rows = response['data'];
    return PtChatPage(
      messages: rows is List
          ? rows
                .whereType<Map>()
                .map(
                  (row) => PtChatMessage.fromJson(
                    row.map((key, value) => MapEntry('$key', value)),
                  ),
                )
                .where((message) => message.id > 0)
                .toList()
          : const [],
      hasMore: response['hasMore'] == true,
      canSend: response['canSend'] == true,
    );
  }

  Future<PtChatMessage> sendPtChatMessage(int bookingId, String content) async {
    final response = await _post('/pt/booking/$bookingId/messages', {
      'content': content.trim(),
    }, bearerToken: _ptAccessToken);
    final data = _asMap(response['data']);
    if (data == null) {
      throw const AuthApiException('Máy chủ chưa trả về tin nhắn vừa gửi.');
    }
    return PtChatMessage.fromJson(data);
  }

  Future<PtSessionQr> generatePtSessionQr(int bookingId) async {
    final response = await _post(
      '/pt/booking/$bookingId/generate-session-qr',
      {},
      bearerToken: _ptAccessToken,
    );
    final data = _asMap(response['data']);
    final token = data?['token']?.toString();
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Máy chủ chưa trả về mã QR buổi tập.');
    }
    return PtSessionQr(token: token);
  }

  Future<void> startPtSession(String qrToken) async {
    await _post('/pt/booking/start-session', {
      'qrToken': qrToken,
    }, bearerToken: _ptAccessToken);
  }

  Future<void> completePtSession(int bookingId) async {
    await _post(
      '/pt/booking/$bookingId/complete-session',
      {},
      bearerToken: _ptAccessToken,
    );
  }

  Future<void> reviewPtBooking({
    required int bookingId,
    required bool accept,
  }) async {
    await _request('PATCH', '/pt/booking/$bookingId/status', {
      'status': accept ? 'CONFIRMED' : 'REJECTED',
    }, bearerToken: _ptAccessToken);
  }

  Future<String> markPtAbsent(int bookingId, String reason) async {
    final response = await _post('/pt/booking/$bookingId/mark-absent', {
      'reason': reason.trim(),
    }, bearerToken: _ptAccessToken);
    return response['message']?.toString() ?? 'Đã ghi nhận báo vắng.';
  }

  Future<void> schedulePtMakeup({
    required int originalBookingId,
    required DateTime newBookingDate,
  }) async {
    await _post('/pt/booking/schedule-makeup', {
      'originalBookingId': originalBookingId,
      'newBookingDate': newBookingDate.toUtc().toIso8601String(),
    }, bearerToken: _ptAccessToken);
  }

  String get _ptAccessToken {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để sử dụng lịch PT.');
    }
    return token;
  }

  Future<List<MemberSubscription>> getMySubscriptions() async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ xem cÃ¡c gÃ³i táº­p cá»§a báº¡n.',
      );
    }
    final response = await _get(
      '/subscriptions/my-subscriptions',
      bearerToken: token,
    );
    final rows = response['data'];
    if (rows is! List) {
      throw const AuthApiException('Máy chủ chưa trả về danh sách gói tập.');
    }
    return rows
        .whereType<Map>()
        .map(
          (row) => MemberSubscription.fromJson(
            row.map((key, value) => MapEntry('$key', value)),
          ),
        )
        .toList();
  }

  Future<PayOsCheckout> createPayOsCheckout({required int packageId}) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thanh toÃ¡n gÃ³i táº­p.',
      );
    }
    final response = await _post('/payments/checkout', {
      'packageId': packageId,
    }, bearerToken: token);
    final data = _asMap(response['data']) ?? response;
    final orderCode = data['orderCode']?.toString();
    final checkoutUrl = data['checkoutUrl']?.toString();
    final qrCode = data['qrCode']?.toString();
    if (orderCode == null ||
        orderCode.isEmpty ||
        checkoutUrl == null ||
        checkoutUrl.isEmpty ||
        qrCode == null ||
        qrCode.isEmpty) {
      throw const AuthApiException(
        'Cá»•ng thanh toÃ¡n chÆ°a tráº£ vá» Ä‘áº§y Ä‘á»§ thÃ´ng tin Ä‘Æ¡n hÃ ng.',
      );
    }
    return PayOsCheckout(
      orderCode: orderCode,
      checkoutUrl: checkoutUrl,
      qrCode: qrCode,
    );
  }

  Future<PayOsCheckout> renewSubscription({
    required String subscriptionId,
    required int packageId,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException('Vui lòng đăng nhập để gia hạn gói tập.');
    }
    final parsedSubscriptionId = int.tryParse(subscriptionId);
    if (parsedSubscriptionId == null || parsedSubscriptionId <= 0) {
      throw const AuthApiException('Không tìm thấy mã gói tập cần gia hạn.');
    }

    final response = await _post('/subscriptions/renew', {
      'subscriptionId': parsedSubscriptionId,
      'packageId': packageId,
    }, bearerToken: token);
    final data = _asMap(response['data']) ?? response;
    final orderCode = data['orderCode']?.toString();
    final checkoutUrl = data['checkoutUrl']?.toString();
    final qrCode = data['qrCode']?.toString();
    if (orderCode == null ||
        orderCode.isEmpty ||
        checkoutUrl == null ||
        checkoutUrl.isEmpty ||
        qrCode == null ||
        qrCode.isEmpty) {
      throw const AuthApiException(
        'Máy chủ chưa trả về đủ thông tin thanh toán gia hạn.',
      );
    }
    return PayOsCheckout(
      orderCode: orderCode,
      checkoutUrl: checkoutUrl,
      qrCode: qrCode,
    );
  }

  Future<PayOsPaymentStatus> checkPayOsPaymentStatus({
    required String orderCode,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.',
      );
    }
    final response = await _get(
      '/payments/check-status/$orderCode',
      bearerToken: token,
    );
    final status = response['status']?.toString() ?? 'PENDING';
    return PayOsPaymentStatus(
      status: status,
      isPaid: status.toUpperCase() == 'PAID',
    );
  }

  Member _acceptLoginResponse(Map<String, dynamic> response) {
    final data = _asMap(response['data']) ?? <String, dynamic>{};
    final user = _asMap(data['user']);
    final token = data['accessToken']?.toString();
    if (user == null || token == null || token.isEmpty) {
      throw const AuthApiException(
        'Máy chủ trả về dữ liệu đăng nhập không hợp lệ.',
      );
    }

    final member = Member.fromJson(user);
    currentMember = member;
    accessToken = token;
    refreshToken = data['refreshToken']?.toString();
    return member;
  }

  Future<String> requestPasswordReset({required String email}) async {
    final response = await _post('/auth/forgot-password', {
      'email': email.trim().toLowerCase(),
    });
    final data = _asMap(response['data']);
    final resetToken = data?['resetToken']?.toString();
    if (resetToken == null || resetToken.isEmpty) {
      throw const AuthApiException('Máy chủ chưa trả về mã đặt lại mật khẩu.');
    }
    return resetToken;
  }

  Future<void> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    await _post('/auth/reset-password', {
      'resetToken': resetToken.trim(),
      'newPassword': newPassword,
    });
  }

  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw const AuthApiException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }
    await _post('/auth/change-password', {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    }, bearerToken: token);
  }

  void logout() {
    currentMember = null;
    accessToken = null;
    refreshToken = null;
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, Object?> body, {
    String? bearerToken,
  }) => _request('POST', path, body, bearerToken: bearerToken);

  Future<Map<String, dynamic>> _get(String path, {String? bearerToken}) =>
      _request('GET', path, null, bearerToken: bearerToken);

  Future<Map<String, dynamic>> _request(
    String method,
    String path,
    Map<String, Object?>? body, {
    String? bearerToken,
  }) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final base = _baseUrl.replaceFirst(RegExp(r'/+$'), '');
      final request = await client
          .openUrl(method, Uri.parse('$base$path'))
          .timeout(const Duration(seconds: 12));
      if (body != null) request.headers.contentType = ContentType.json;
      if (bearerToken != null) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer $bearerToken',
        );
      }
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(
        const Duration(seconds: 15),
      );
      final responseText = await utf8.decoder.bind(response).join();
      final payload = responseText.isEmpty
          ? <String, dynamic>{}
          : _asMap(jsonDecode(responseText)) ?? <String, dynamic>{};

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthApiException(_messageFor(response.statusCode, payload));
      }
      return payload;
    } on AuthApiException {
      rethrow;
    } on SocketException {
      throw AuthApiException(
        'Không kết nối được máy chủ tại $_baseUrl. Hãy bật backend hoặc kiểm tra API_BASE_URL.',
      );
    } on TimeoutException {
      throw const AuthApiException(
        'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
      );
    } on FormatException {
      throw const AuthApiException('Máy chủ trả về dữ liệu không hợp lệ.');
    } on HttpException {
      throw const AuthApiException('Không thể gửi yêu cầu đến máy chủ.');
    } finally {
      client.close(force: true);
    }
  }

  String _messageFor(int status, Map<String, dynamic> payload) {
    final message = payload['message']?.toString().toLowerCase() ?? '';
    if (message.contains('active membership') ||
        message.contains('gói tập hội viên') ||
        message.contains('chưa có membership')) {
      return 'Bạn cần có gói hội viên còn hiệu lực trước khi mua gói PT.';
    }
    if (message.contains('bạn đã có gói tập này') ||
        message.contains('already have this package')) {
      return 'Bạn đã có gói tập này. Hãy làm mới danh sách rồi chọn Gia hạn gói.';
    }
    if (message.contains('chỉ có thể gia hạn đúng gói tập') ||
        message.contains('can only renew the membership package')) {
      return 'Chỉ có thể gia hạn đúng gói tập đang gắn với membership này.';
    }
    if (message.contains('incorrect old password')) {
      return 'Mật khẩu hiện tại chưa chính xác.';
    }
    if (message.contains('new password must be at least 6 characters')) {
      return 'Mật khẩu mới cần ít nhất 6 ký tự.';
    }
    if (message.contains('missing required fields')) {
      return 'Vui lòng nhập đầy đủ thông tin.';
    }
    if (message.contains('access denied. no token') ||
        message.contains('invalid or expired token')) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (message.contains('user with this email does not exist')) {
      return 'Không tìm thấy tài khoản với email này.';
    }
    if (message.contains('invalid or expired reset token')) {
      return 'Mã đặt lại không hợp lệ hoặc đã hết hạn.';
    }
    if (message.contains('invalid input data')) {
      return 'Mã đặt lại hoặc mật khẩu mới chưa hợp lệ.';
    }
    if (message.contains('email already exists')) {
      return 'Email này đã được đăng ký.';
    }
    if (message.contains('invalid email or password')) {
      return 'Email hoặc mật khẩu chưa chính xác.';
    }
    if (message.contains('invalid google token')) {
      return 'Google ID token is invalid. Please try signing in again.';
    }
    if (message.isNotEmpty &&
        (status == 400 || status == 403 || status == 404 || status == 409)) {
      return payload['message']?.toString() ?? '';
    }
    if (message.contains('account is suspended')) {
      return 'Tài khoản hiện đang bị tạm khóa.';
    }
    if (status == 400) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';
    if (status == 401) return 'Email hoặc mật khẩu chưa chính xác.';
    if (status >= 500) return 'Máy chủ đang bận. Vui lòng thử lại sau.';
    return 'Không thể xác thực tài khoản. Vui lòng thử lại.';
  }

  static Map<String, dynamic>? _asMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.map((key, value) => MapEntry('$key', value));
    return null;
  }
}
