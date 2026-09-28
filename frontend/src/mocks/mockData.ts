import { User, Member, Coach, PackagePlan, BookingSession, CheckInRecord, Invoice, SupportTicket, AuditLog, NutritionTarget } from '../types';

const STORAGE_KEY_PREFIX = 'aura_fitness_db_';

export const INITIAL_COACHES: Coach[] = [
  {
    id: 'coach-1',
    code: 'HLV-01',
    name: 'Trần Tuấn Hùng',
    phone: '0912 345 678',
    email: 'tuanhung@aurafitness.vn',
    avatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&auto=format&fit=crop&q=80',
    rank: 'master',
    specialties: ['Thể hình chuyên nghiệp (Hypertrophy)', 'Cải thiện sức mạnh (Powerlifting)', 'Dinh dưỡng VĐV'],
    hourlyRateVND: 650000, // Master rate
    commissionPercent: 65,
    rating: 4.95,
    reviewCount: 142,
    bio: '10 năm kinh nghiệm thi đấu Thể hình Quốc gia. Chứng chỉ Quốc tế NASM CPT & Precision Nutrition Level 1.',
    certifications: ['NASM-CPT', 'Precision Nutrition L1', 'First Aid / CPR'],
    workingHours: {
      shift: 'Ca sáng & Chiều',
      start: '07:00',
      end: '18:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6]
    },
    isAcceptingBookings: true,
    activeTraineeCount: 12
  },
  {
    id: 'coach-2',
    code: 'HLV-02',
    name: 'Nguyễn Lan Anh',
    phone: '0988 765 432',
    email: 'lananh@aurafitness.vn',
    avatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
    rank: 'senior',
    specialties: ['Yoga Trị Liệu Cột Sống', 'Pilates Mat & Reformer', 'Giảm cân nữ'],
    hourlyRateVND: 400000, // Senior rate
    commissionPercent: 55,
    rating: 4.9,
    reviewCount: 98,
    bio: 'Bậc thầy Yoga RYT-500 Quốc tế. Chuyên gia phục hồi thoái hóa đốt sống cổ và thắt lưng cho dân văn phòng.',
    certifications: ['Yoga Alliance RYT-500', 'Stott Pilates Certified'],
    workingHours: {
      shift: 'Ca sáng',
      start: '06:00',
      end: '15:00',
      daysOfWeek: [1, 2, 3, 4, 5]
    },
    isAcceptingBookings: true,
    activeTraineeCount: 9
  },
  {
    id: 'coach-3',
    code: 'HLV-03',
    name: 'Võ Quang Dũng',
    phone: '0903 112 233',
    email: 'quangdung@aurafitness.vn',
    avatar: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&auto=format&fit=crop&q=80',
    rank: 'senior',
    specialties: ['Kickboxing', 'HIIT Giảm Mỡ Cấp Tốc', 'Cross-training'],
    hourlyRateVND: 400000,
    commissionPercent: 50,
    rating: 4.88,
    reviewCount: 76,
    bio: 'Kiện tướng Kickboxing trẻ. Phong cách huấn luyện bùng nổ, kỷ luật thép, cam kết hiệu quả giảm mỡ trong 8 tuần.',
    certifications: ['WAKO Kickboxing Coach', 'ACE Certified Personal Trainer'],
    workingHours: {
      shift: 'Ca chiều & Tối',
      start: '13:00',
      end: '21:00',
      daysOfWeek: [2, 3, 4, 5, 6, 7]
    },
    isAcceptingBookings: true,
    activeTraineeCount: 8
  },
  {
    id: 'coach-4',
    code: 'HLV-04',
    name: 'Lê Minh Khang',
    phone: '0977 445 566',
    email: 'minhkhang@aurafitness.vn',
    avatar: 'https://images.unsplash.com/photo-1549476464-37392f717541?w=400&auto=format&fit=crop&q=80',
    rank: 'junior',
    specialties: ['Calisthenics Cơ Bản', 'Tăng cân tăng cơ người gầy', 'Mobility & Stretching'],
    hourlyRateVND: 250000, // Junior rate
    commissionPercent: 40,
    rating: 4.75,
    reviewCount: 35,
    bio: 'Nhiệt huyết, kiên trì, truyền cảm hứng tập luyện cho người mới bắt đầu (Beginners).',
    certifications: ['VFR Bodybuilding Coach L2'],
    workingHours: {
      shift: 'Toàn thời gian',
      start: '09:00',
      end: '18:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6]
    },
    isAcceptingBookings: true,
    activeTraineeCount: 5
  }
];

export const INITIAL_PACKAGES: PackagePlan[] = [
  {
    id: 'pkg-standard-1m',
    name: 'Gói Standard Gym 01 Tháng',
    type: 'standard_gym',
    durationMonths: 1,
    priceVND: 650000,
    unlimitedGymAccess: true,
    ptSessionsIncluded: 0,
    description: 'Vào tập tự do không giới hạn số lượt tại tất cả các khu vực tập máy và cardio.',
    features: [
      'Ra vào phòng tập 24/7 không giới hạn lượt',
      'Miễn phí tủ đồ thông minh & khăn tập sạch',
      'Miễn phí phòng xông hơi Sauna & Jacuzzi',
      'Đo chỉ số InBody miễn phí 01 lần/tháng'
    ]
  },
  {
    id: 'pkg-hybrid-gold',
    name: 'Gói VIP Hybrid Gold (Gym + 8 Buổi PT)',
    type: 'hybrid_pt',
    durationMonths: 1,
    priceVND: 2850000,
    unlimitedGymAccess: true,
    ptSessionsIncluded: 8,
    isPopular: true,
    description: 'Mô hình kết hợp hoàn hảo: Tự do vào phòng tập cả tháng + 8 buổi 1-kèm-1 với HLV cá nhân.',
    features: [
      'Vào phòng tập KHÔNG GIỚI HẠN trong 30 ngày',
      '8 Buổi tập 1-kèm-1 cùng Huấn luyện viên chuyên nghiệp',
      'Thiết kế giáo án riêng biệt theo thể trạng',
      'Tư vấn kế hoạch dinh dưỡng Macros cá nhân hóa',
      'Quyền đổi Huấn luyện viên linh hoạt bất kỳ lúc nào'
    ]
  },
  {
    id: 'pkg-hybrid-diamond',
    name: 'Gói VIP Hybrid Diamond (Gym + 16 Buổi PT)',
    type: 'hybrid_pt',
    durationMonths: 2,
    priceVND: 5200000,
    unlimitedGymAccess: true,
    ptSessionsIncluded: 16,
    description: 'Gói bứt phá vóc dáng dành cho mục tiêu giảm mỡ / tăng cơ chuyên sâu trong 60 ngày.',
    features: [
      'Vào phòng tập KHÔNG GIỚI HẠN trong 60 ngày',
      '16 Buổi tập 1-kèm-1 chuyên sâu cùng Senior/Master HLV',
      'Bảo lưu tối đa 14 ngày nếu bận công tác',
      'Theo dõi chỉ số InBody hàng tuần kèm biểu đồ 3D',
      'Tặng 01 bộ bình nước và túi thể thao AURA độc quyền'
    ]
  },
  {
    id: 'pkg-special-yoga',
    name: 'Khóa Chuyên Biệt: Yoga Trị Liệu Cột Sống (12 Buổi)',
    type: 'specialized_course',
    durationMonths: 1.5,
    priceVND: 3500000,
    unlimitedGymAccess: true,
    ptSessionsIncluded: 0,
    description: 'Khóa học chuyên sâu phục hồi cổ vai gáy và cột sống thắt lưng cho dân văn phòng.',
    features: [
      'Lớp giới hạn tối đa 8 học viên để chỉnh sửa tư thế chi tiết',
      'Giáo trình trị liệu độc quyền cùng Master Yoga Lan Anh',
      'Được tặng thảm tập định tuyến cao cấp',
      'Bao gồm quyền sử dụng phòng Gym và Xông hơi'
    ],
    courseDetails: {
      totalSessions: 12,
      coachId: 'coach-2',
      coachName: 'Nguyễn Lan Anh',
      startDate: '2026-10-05',
      endDate: '2026-11-15',
      maxStudents: 8,
      enrolledStudents: 6,
      scheduleDescription: 'Thứ 2 - 4 - 6 từ 08:30 đến 09:45',
      locationRoom: 'Phòng Studio Lotus 2'
    }
  },
  {
    id: 'pkg-special-boxing',
    name: 'Khóa Chuyên Biệt: Boxing Bootcamp Giảm Mỡ (16 Buổi)',
    type: 'specialized_course',
    durationMonths: 2,
    priceVND: 4200000,
    unlimitedGymAccess: true,
    ptSessionsIncluded: 0,
    description: 'Chiến dịch đốt mỡ đỉnh cao 800 calo/buổi với kỹ thuật đánh bao cát và đấm đối kháng an toàn.',
    features: [
      'Giới hạn 10 học viên / lớp, trang bị găng tay chuyên dụng',
      'HLV Kiện tướng Võ Quang Dũng trực tiếp giảng dạy',
      'Cam kết giảm từ 3 - 6kg mỡ thừa sau lộ trình'
    ],
    courseDetails: {
      totalSessions: 16,
      coachId: 'coach-3',
      coachName: 'Võ Quang Dũng',
      startDate: '2026-10-10',
      endDate: '2026-12-05',
      maxStudents: 10,
      enrolledStudents: 7,
      scheduleDescription: 'Thứ 3 - 5 - 7 từ 18:30 đến 19:45',
      locationRoom: 'Khu Sàn Đấu Ring 1'
    }
  }
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    code: 'MEM-1001',
    name: 'Nguyễn Văn An',
    phone: '0901 234 567',
    email: 'vanan@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    cccd: '001200012345',
    gender: 'male',
    birthYear: 1995,
    emergencyContact: {
      name: 'Nguyễn Thị Dung',
      phone: '0909 999 888',
      relationship: 'Mẹ'
    },
    status: 'active',
    activePackageId: 'pkg-hybrid-gold',
    packageName: 'Gói VIP Hybrid Gold (Gym + 8 Buổi PT)',
    packageType: 'hybrid_pt',
    packageStartDate: '2026-09-10',
    packageEndDate: '2026-10-10',
    daysRemaining: 12,
    ptSessionsTotal: 8,
    ptSessionsRemaining: 5,
    assignedCoachId: 'coach-1',
    assignedCoachName: 'Trần Tuấn Hùng',
    fitnessGoals: ['Tăng cơ vai và ngực', 'Cải thiện sức bền'],
    totalCheckIns: 18,
    lastCheckIn: '2026-09-28 07:45',
    inBodyHistory: [
      { id: 'ib-1', date: '2026-09-10', weightKg: 72.5, muscleMassKg: 32.8, bodyFatPercent: 19.5, bmi: 23.4, visceralFatLevel: 6 },
      { id: 'ib-2', date: '2026-09-24', weightKg: 71.8, muscleMassKg: 33.2, bodyFatPercent: 18.2, bmi: 23.1, visceralFatLevel: 5 }
    ]
  },
  {
    id: 'mem-2',
    code: 'MEM-1002',
    name: 'Trần Thị Mai',
    phone: '0918 888 777',
    email: 'maitran@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    cccd: '079198004567',
    gender: 'female',
    birthYear: 1998,
    emergencyContact: {
      name: 'Trần Văn Minh',
      phone: '0918 111 222',
      relationship: 'Anh trai'
    },
    status: 'expiring_soon', // Gói sắp hết hạn để test tính năng gia hạn & cảnh báo
    activePackageId: 'pkg-standard-1m',
    packageName: 'Gói Standard Gym 01 Tháng',
    packageType: 'standard_gym',
    packageStartDate: '2026-09-01',
    packageEndDate: '2026-09-30',
    daysRemaining: 2,
    ptSessionsTotal: 0,
    ptSessionsRemaining: 0,
    totalCheckIns: 24,
    lastCheckIn: '2026-09-27 17:30',
    fitnessGoals: ['Duy trì vóc dáng', 'Giảm mỡ eo'],
    inBodyHistory: [
      { id: 'ib-3', date: '2026-09-01', weightKg: 54.0, muscleMassKg: 21.0, bodyFatPercent: 25.0, bmi: 20.8, visceralFatLevel: 4 }
    ]
  },
  {
    id: 'mem-3',
    code: 'MEM-1003',
    name: 'Lê Hoàng Nam',
    phone: '0933 555 444',
    email: 'hoangnam@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    cccd: '001192003344',
    gender: 'male',
    birthYear: 1992,
    emergencyContact: {
      name: 'Lê Thị Thu',
      phone: '0933 000 111',
      relationship: 'Vợ'
    },
    status: 'expired', // ĐÃ HẾT HẠN - Dùng để test luồng từ chối Check-in (Luồng 3)
    activePackageId: 'pkg-standard-1m',
    packageName: 'Gói Standard Gym 01 Tháng (Hết Hạn)',
    packageType: 'standard_gym',
    packageStartDate: '2026-08-01',
    packageEndDate: '2026-09-01',
    daysRemaining: 0,
    ptSessionsTotal: 0,
    ptSessionsRemaining: 0,
    totalCheckIns: 12,
    lastCheckIn: '2026-08-30 18:00',
    notes: 'Khách hàng có lịch sử tập đều, cần tư vấn gói VIP Diamond đợt tới.',
    inBodyHistory: []
  },
  {
    id: 'mem-4',
    code: 'MEM-1004',
    name: 'Phạm Thanh Hương',
    phone: '0982 333 444',
    email: 'huongpham@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    cccd: '036195007890',
    gender: 'female',
    birthYear: 1990,
    emergencyContact: {
      name: 'Vũ Đức Thịnh',
      phone: '0982 777 888',
      relationship: 'Chồng'
    },
    status: 'active',
    activePackageId: 'pkg-special-yoga',
    packageName: 'Khóa Chuyên Biệt: Yoga Trị Liệu Cột Sống (12 Buổi)',
    packageType: 'specialized_course',
    packageStartDate: '2026-09-15',
    packageEndDate: '2026-10-30',
    daysRemaining: 32,
    ptSessionsTotal: 12,
    ptSessionsRemaining: 9,
    assignedCoachId: 'coach-2',
    assignedCoachName: 'Nguyễn Lan Anh',
    healthConditions: ['Thoát vị đĩa đệm nhẹ L4-L5', 'Mỏi vai gáy'],
    fitnessGoals: ['Phục hồi chức năng cột sống', 'Tăng độ dẻo dai'],
    totalCheckIns: 7,
    lastCheckIn: '2026-09-28 08:15',
    inBodyHistory: [
      { id: 'ib-4', date: '2026-09-15', weightKg: 58.2, muscleMassKg: 22.4, bodyFatPercent: 27.2, bmi: 22.5, visceralFatLevel: 5 }
    ]
  },
  {
    id: 'mem-5',
    code: 'MEM-1005',
    name: 'Đặng Quốc Bảo',
    phone: '0979 123 789',
    email: 'quocbao@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    cccd: '040199009988',
    gender: 'male',
    birthYear: 1999,
    emergencyContact: {
      name: 'Đặng Văn Tiến',
      phone: '0979 000 999',
      relationship: 'Bố'
    },
    status: 'active',
    activePackageId: 'pkg-special-boxing',
    packageName: 'Khóa Chuyên Biệt: Boxing Bootcamp (16 Buổi)',
    packageType: 'specialized_course',
    packageStartDate: '2026-09-18',
    packageEndDate: '2026-11-18',
    daysRemaining: 51,
    ptSessionsTotal: 16,
    ptSessionsRemaining: 13,
    assignedCoachId: 'coach-3',
    assignedCoachName: 'Võ Quang Dũng',
    fitnessGoals: ['Tăng phản xạ', 'Đốt mỡ siết cân'],
    totalCheckIns: 9,
    lastCheckIn: '2026-09-27 19:10',
    inBodyHistory: []
  }
];

export const INITIAL_BOOKINGS: BookingSession[] = [
  {
    id: 'book-1',
    memberId: 'mem-1',
    memberName: 'Nguyễn Văn An',
    memberPhone: '0901 234 567',
    memberAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    coachId: 'coach-1',
    coachName: 'Trần Tuấn Hùng',
    coachAvatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&auto=format&fit=crop&q=80',
    type: 'pt_individual',
    title: 'PT 1-on-1: Ngực & Tay sau cường độ cao',
    room: 'Phòng Tạ Tầng 1 - Khu Functional',
    date: '2026-09-28',
    startTime: '16:00',
    endTime: '17:00',
    status: 'scheduled',
    pricePaidVND: 650000
  },
  {
    id: 'book-2',
    memberId: 'mem-4',
    memberName: 'Phạm Thanh Hương',
    memberPhone: '0982 333 444',
    memberAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    coachId: 'coach-2',
    coachName: 'Nguyễn Lan Anh',
    coachAvatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
    type: 'specialized_course',
    title: 'Yoga Trị Liệu: Mở Khớp Háng & Giảm Áp Lực L4-L5',
    room: 'Phòng Studio Lotus 2',
    date: '2026-09-28',
    startTime: '08:30',
    endTime: '09:45',
    status: 'completed',
    workoutLog: {
      completedExercises: [
        { exerciseName: 'Tư thế Mèo - Bò (Cat-Cow)', sets: 3, reps: 15, weightKg: 0, notes: 'Thở đều theo nhịp' },
        { exerciseName: 'Tư thế Cây Cầu (Bridge Pose)', sets: 4, reps: 12, weightKg: 0, notes: 'Kích hoạt cơ mông' },
        { exerciseName: 'Tư thế Em Bé Giãn Lưng', sets: 3, reps: 1, weightKg: 0, notes: 'Giữ 45 giây mỗi lần' }
      ],
      intensityRating: 3,
      coachFeedback: 'Học viên thực hiện tư thế rất chuẩn, vùng thắt lưng thả lỏng tốt hơn buổi trước.',
      homeworkNote: 'Tập bài thở bụng sâu 10 phút trước khi đi ngủ.'
    }
  },
  {
    id: 'book-3',
    memberId: 'mem-5',
    memberName: 'Đặng Quốc Bảo',
    memberPhone: '0979 123 789',
    memberAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    coachId: 'coach-3',
    coachName: 'Võ Quang Dũng',
    coachAvatar: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&auto=format&fit=crop&q=80',
    type: 'specialized_course',
    title: 'Boxing Bootcamp: Di chuyển né đòn & Đòn Đấm Số 1-2',
    room: 'Khu Sàn Đấu Ring 1',
    date: '2026-09-28',
    startTime: '18:30',
    endTime: '19:45',
    status: 'scheduled'
  }
];

export const INITIAL_CHECKINS: CheckInRecord[] = [
  {
    id: 'chk-1',
    memberId: 'mem-4',
    memberCode: 'MEM-1004',
    memberName: 'Phạm Thanh Hương',
    memberAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    packageName: 'Khóa Yoga Trị Liệu Cột Sống',
    timestamp: '2026-09-28T08:15:20',
    status: 'approved',
    staffName: 'Thu Ngân (Lễ tân)'
  },
  {
    id: 'chk-2',
    memberId: 'mem-1',
    memberCode: 'MEM-1001',
    memberName: 'Nguyễn Văn An',
    memberAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    packageName: 'Gói VIP Hybrid Gold (Gym + 8 Buổi PT)',
    timestamp: '2026-09-28T07:45:10',
    status: 'approved',
    staffName: 'Cổng QR Tự Động Barrier 1'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    code: 'INV-2026-0891',
    memberId: 'mem-1',
    memberName: 'Nguyễn Văn An',
    memberPhone: '0901 234 567',
    items: [
      { name: 'Gói VIP Hybrid Gold (Gym + 8 Buổi PT)', quantity: 1, unitPriceVND: 2850000, amountVND: 2850000 }
    ],
    subtotalVND: 2850000,
    discountVND: 0,
    totalVND: 2850000,
    paymentMethod: 'vietqr',
    status: 'paid',
    staffName: 'Thu Ngân (Lễ tân)',
    createdAt: '2026-09-10T09:30:00'
  },
  {
    id: 'inv-2',
    code: 'INV-2026-0892',
    memberId: 'mem-4',
    memberName: 'Phạm Thanh Hương',
    memberPhone: '0982 333 444',
    items: [
      { name: 'Khóa Chuyên Biệt Yoga Trị Liệu 12 Buổi', quantity: 1, unitPriceVND: 3500000, amountVND: 3500000 }
    ],
    subtotalVND: 3500000,
    discountVND: 200000,
    totalVND: 3300000,
    paymentMethod: 'momo',
    status: 'paid',
    staffName: 'Thu Ngân (Lễ tân)',
    createdAt: '2026-09-15T10:15:00'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-09-28T08:00:00',
    actorName: 'Hoàng Quản Lý',
    actorRole: 'admin',
    action: 'Cập nhật giá Coach',
    target: 'HLV Trần Tuấn Hùng',
    details: 'Điều chỉnh đơn giá buổi lẻ từ 600,000đ lên 650,000đ theo thăng hạng Master'
  },
  {
    id: 'log-2',
    timestamp: '2026-09-27T16:20:00',
    actorName: 'Thu Ngân (Lễ tân)',
    actorRole: 'receptionist',
    action: 'Đăng ký Hội viên mới',
    target: 'Đặng Quốc Bảo (MEM-1005)',
    details: 'Bán gói Boxing Bootcamp 16 buổi - Thanh toán Chuyển khoản VietQR'
  }
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 't-1',
    ticketCode: 'TCK-1001',
    memberId: 'mem-1',
    memberName: 'Nguyễn Văn An',
    memberPhone: '0901 234 567',
    category: 'lost_found',
    title: 'Quên bình nước shaker inox tại phòng tạ tầng 1',
    description: 'Hội viên báo quên bình shaker sau ca tập ngực chiều qua lúc 17:30 tại giá tạ tay tầng 1.',
    status: 'in_progress',
    priority: 'low',
    createdAt: '2026-09-28T09:10:00',
    createdBy: 'Thu Ngân (Lễ tân)',
    adminResponse: 'Đã tìm thấy bình nước tại phòng thay đồ nam tủ 18. Yêu cầu Lễ tân liên hệ anh An đến quầy nhận lại.',
    actionRequiredBy: 'receptionist',
    respondedAt: '2026-09-28T10:15:00'
  },
  {
    id: 't-2',
    ticketCode: 'TCK-1002',
    memberId: 'mem-2',
    memberName: 'Trần Thị Mai',
    memberPhone: '0918 888 777',
    category: 'freeze_request',
    title: 'Yêu cầu bảo lưu thẻ 10 ngày do đi công tác',
    description: 'Học viên Mai nộp đơn xin tạm hoãn thẻ từ ngày 01/10 đến 10/10/2026 kèm vé máy bay công tác.',
    status: 'open',
    priority: 'medium',
    createdAt: '2026-09-28T10:00:00',
    createdBy: 'Thu Ngân (Lễ tân)'
  },
  {
    id: 't-3',
    ticketCode: 'TCK-1003',
    memberId: 'mem-4',
    memberName: 'Phạm Thị Lan',
    memberPhone: '0977 123 456',
    category: 'equipment',
    title: 'Máy chạy bộ Treadmill-03 báo lỗi cảm biến nhịp tim E-04',
    description: 'Khách đang chạy tốc độ 10km/h thì máy giật nhẹ và hiện mã lỗi E-04, đã tạm dán biển bảo trì.',
    status: 'in_progress',
    priority: 'high',
    createdAt: '2026-09-28T08:30:00',
    createdBy: 'Thu Ngân (Lễ tân)',
    adminResponse: 'Đã gọi kỹ thuật viên Technogym hẹn đến bảo dưỡng lúc 14:00 hôm nay. Lễ tân duy trì biển tạm ngưng sử dụng.',
    actionRequiredBy: 'technician',
    respondedAt: '2026-09-28T09:00:00'
  },
  {
    id: 't-4',
    ticketCode: 'TCK-1004',
    memberId: 'mem-3',
    memberName: 'Lê Hoàng Nam',
    memberPhone: '0933 555 444',
    category: 'coach_feedback',
    title: 'Góp ý về phòng tập quá lạnh vào đầu ca sáng 06:00',
    description: 'Hội viên phản ánh điều hòa khu vực Yoga bật 20 độ quá lạnh lúc sáng sớm.',
    status: 'resolved',
    priority: 'low',
    createdAt: '2026-09-27T07:15:00',
    createdBy: 'Thu Ngân (Lễ tân)',
    adminResponse: 'Đã chỉ đạo nhân viên mở cửa ca sáng cài đặt nhiệt độ chuẩn 25 độ C cho phòng Yoga.',
    actionRequiredBy: 'receptionist',
    respondedAt: '2026-09-27T08:00:00',
    resolvedAt: '2026-09-27T08:30:00',
    resolvedBy: 'Hoàng Quản Lý'
  }
];

// Helper database manager with localStorage
export class MockDatabase {
  private static getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }

  // Members
  static getMembers(): Member[] {
    return this.getItem('members', INITIAL_MEMBERS);
  }

  static saveMembers(members: Member[]): void {
    this.setItem('members', members);
  }

  static addMember(member: Member): void {
    const list = this.getMembers();
    list.unshift(member);
    this.saveMembers(list);
  }

  static updateMember(updated: Member): void {
    const list = this.getMembers().map(m => m.id === updated.id ? updated : m);
    this.saveMembers(list);
  }

  // Coaches
  static getCoaches(): Coach[] {
    return this.getItem('coaches', INITIAL_COACHES);
  }

  static saveCoaches(coaches: Coach[]): void {
    this.setItem('coaches', coaches);
  }

  static updateCoach(updated: Coach): void {
    const list = this.getCoaches().map(c => c.id === updated.id ? updated : c);
    this.saveCoaches(list);
  }

  // Packages
  static getPackages(): PackagePlan[] {
    return this.getItem('packages', INITIAL_PACKAGES);
  }

  static savePackages(pkgs: PackagePlan[]): void {
    this.setItem('packages', pkgs);
  }

  static addPackage(pkg: PackagePlan): void {
    const list = this.getPackages();
    list.push(pkg);
    this.savePackages(list);
  }

  // Bookings
  static getBookings(): BookingSession[] {
    return this.getItem('bookings', INITIAL_BOOKINGS);
  }

  static saveBookings(bookings: BookingSession[]): void {
    this.setItem('bookings', bookings);
  }

  static addBooking(booking: BookingSession): void {
    const list = this.getBookings();
    list.unshift(booking);
    this.saveBookings(list);
  }

  static updateBooking(updated: BookingSession): void {
    const list = this.getBookings().map(b => b.id === updated.id ? updated : b);
    this.saveBookings(list);
  }

  // CheckIns
  static getCheckIns(): CheckInRecord[] {
    return this.getItem('checkins', INITIAL_CHECKINS);
  }

  static recordCheckIn(record: CheckInRecord): void {
    const list = this.getCheckIns();
    list.unshift(record);
    this.setItem('checkins', list);
  }

  // Invoices
  static getInvoices(): Invoice[] {
    return this.getItem('invoices', INITIAL_INVOICES);
  }

  static addInvoice(invoice: Invoice): void {
    const list = this.getInvoices();
    list.unshift(invoice);
    this.setItem('invoices', list);
  }

  // Audit Logs
  static getAuditLogs(): AuditLog[] {
    return this.getItem('audit_logs', INITIAL_AUDIT_LOGS);
  }

  static logAction(actorName: string, actorRole: any, action: string, target: string, details: string): void {
    const logs = this.getAuditLogs();
    logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actorName,
      actorRole,
      action,
      target,
      details
    });
    this.setItem('audit_logs', logs.slice(0, 100));
  }

  // Support Tickets (Báo cáo sự cố / Hỗ trợ)
  static getTickets(): SupportTicket[] {
    return this.getItem('tickets', INITIAL_TICKETS);
  }

  static saveTickets(tickets: SupportTicket[]): void {
    this.setItem('tickets', tickets);
  }

  static addTicket(ticket: SupportTicket): void {
    const list = this.getTickets();
    list.unshift(ticket);
    this.saveTickets(list);
  }

  static updateTicket(updated: SupportTicket): void {
    const list = this.getTickets().map(t => t.id === updated.id ? updated : t);
    this.saveTickets(list);
  }

  // Reset to default
  static resetAll(): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'members');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'coaches');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'packages');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'bookings');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'checkins');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'invoices');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'tickets');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'audit_logs');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'session_user');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'system_settings');
  }

  // Session & Auth
  static getCurrentSession(): User | null {
    return this.getItem<User | null>('session_user', null);
  }

  static saveCurrentSession(user: User): void {
    this.setItem('session_user', user);
  }

  static clearSession(): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'session_user');
  }

  // System Settings
  static getSettings(): SystemSettings {
    return this.getItem('system_settings', DEFAULT_SYSTEM_SETTINGS);
  }

  static saveSettings(settings: SystemSettings): void {
    this.setItem('system_settings', settings);
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'receptionist' | 'coach' | 'guest';
  avatar: string;
  password: string;
  mockOtp: string;
  title: string;
  description: string;
}

export interface SystemSettings {
  centerName: string;
  hotline: string;
  address: string;
  operatingHours: string;
  makeupNoticeHours: number;
  soundEffectsEnabled: boolean;
  notificationsEnabled: boolean;
  twoFactorEnabled: boolean;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  centerName: 'AURA FITNESS CENTER',
  hotline: '1900 6868 - 024 8888 9999',
  address: 'Số 108 Phố Thể Thao, Quận Cầu Giấy, Hà Nội',
  operatingHours: '05:30 - 22:30 (Thứ 2 - Chủ Nhật)',
  makeupNoticeHours: 4,
  soundEffectsEnabled: true,
  notificationsEnabled: true,
  twoFactorEnabled: false
};

export const TEST_USERS: AuthUser[] = [
  {
    id: 'user-admin',
    name: 'Hoàng Quản Lý',
    email: 'admin@aurafitness.vn',
    phone: '0900 111 222',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
    password: 'admin123',
    mockOtp: '888999',
    title: 'Center Manager (Tổng Quản Lý)',
    description: 'Toàn quyền BI Analytics, cấu hình giá từng Coach, quản lý hội viên 360°'
  },
  {
    id: 'user-receptionist',
    name: 'Thu Ngân (Lễ Tân)',
    email: 'reception@aurafitness.vn',
    phone: '0900 333 444',
    role: 'receptionist',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
    password: 'staff123',
    mockOtp: '888999',
    title: 'Nhân Viên Lễ Tân',
    description: 'Cổng Check-in QR, POS bán gói tại quầy, xuất hóa đơn VietQR/MoMo/Tiền mặt'
  },
  {
    id: 'user-coach-1',
    name: 'Trần Tuấn Hùng',
    email: 'tuanhung@aurafitness.vn',
    phone: '0912 345 678',
    role: 'coach',
    avatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&auto=format&fit=crop&q=80',
    password: 'coach123',
    mockOtp: '888999',
    title: 'Master Coach Thể Hình',
    description: 'Lịch dạy, điểm danh buổi tập & trừ Quota PT, xử lý học bù, gợi ý giáo án AI'
  },
  {
    id: 'user-coach-2',
    name: 'Nguyễn Lan Anh',
    email: 'lananh@aurafitness.vn',
    phone: '0988 765 432',
    role: 'coach',
    avatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
    password: 'coach123',
    mockOtp: '888999',
    title: 'Senior Yoga Specialist',
    description: 'Chuyên gia Yoga trị liệu cột sống, thiết lập kế hoạch dinh dưỡng Macros'
  }
];
