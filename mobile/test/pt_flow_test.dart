import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cafe_fit_mobile/screens/pt_journey_screen.dart';
import 'package:cafe_fit_mobile/services/auth_service.dart';

class _PtAuth extends AuthService {
  _PtAuth() {
    currentMember = const Member(
      name: 'Lan',
      email: 'lan@example.com',
      role: 'MEMBER',
    );
    accessToken = 'test-token';
  }

  int? requestedTrainerId;
  DateTime? createdBookingDate;
  int? createdSubscriptionId;

  @override
  Future<List<PtBooking>> getMyPtBookings() async => const [];

  @override
  Future<List<MemberSubscription>> getMySubscriptions() async => [
    const MemberSubscription(
      id: '23',
      status: 'ACTIVE',
      startDate: null,
      endDate: null,
      remainingSessions: 10,
      coachId: 2,
      coachName: 'Ho Dang Quang',
      package: FitnessPackage(
        id: 7,
        name: 'PT 10 buổi',
        type: 'PT',
        price: 1000000,
        durationDays: 30,
      ),
    ),
  ];

  @override
  Future<List<PtTimeSlot>> getPtTrainerSlots({
    required int trainerId,
    required DateTime date,
  }) async {
    requestedTrainerId = trainerId;
    return const [
      PtTimeSlot(
        startTime: '08:00',
        endTime: '09:00',
        status: 'AVAILABLE',
        isAvailable: true,
      ),
    ];
  }

  @override
  Future<void> createPtBooking({
    required int ptSubscriptionId,
    required DateTime bookingDate,
  }) async {
    createdSubscriptionId = ptSubscriptionId;
    createdBookingDate = bookingDate;
  }
}

void main() {
  testWidgets('PT tab opens coach slots and books the gym-local hour', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final auth = _PtAuth();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PtJourneyScreen(
            auth: auth,
            onBrowsePackages: () async {},
            onLoginRequired: () async => true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xem ca trống & đặt buổi'));
    await tester.pumpAndSettle();
    expect(auth.requestedTrainerId, 2);

    await tester.tap(find.text('08:00 – 09:00'));
    await tester.pump();
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '08:00 – 09:00'))
          .selected,
      isTrue,
    );
    await tester.ensureVisible(find.text('Xác nhận đặt lịch'));
    await tester.tap(find.text('Xác nhận đặt lịch'));
    await tester.pumpAndSettle();
    expect(find.text('Xác nhận đặt lịch'), findsWidgets);
    await tester.tap(find.text('Đặt lịch'));
    await tester.pumpAndSettle();

    expect(auth.createdSubscriptionId, 23);
    final bookingTime = auth.createdBookingDate!;
    expect(bookingTime.hour, 1); // 08:00 in Vietnam is 01:00 UTC.
    expect(bookingTime.minute, 0);
  });
}
