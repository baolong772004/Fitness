import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, FileText, Newspaper, Sparkles } from 'lucide-react';

export type ArticleCategory = 'news' | 'spotlight' | 'policy';
export type EditorialRoute = ArticleCategory | `article:${string}`;

type Article = {
  slug: string;
  category: ArticleCategory;
  title: string;
  excerpt: string;
  readTime: string;
  intro: string;
    sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
};

const categoryInfo: Record<ArticleCategory, { title: string; eyebrow: string; description: string; icon: React.ReactNode }> = {
  news: {
    title: 'Tin tức AURA', eyebrow: 'CẬP NHẬT TỪ AURA',
    description: 'Thông tin mới về lịch tập, hoạt động và trải nghiệm tại câu lạc bộ.', icon: <Newspaper size={18} />
  },
  spotlight: {
    title: 'Đừng bỏ lỡ', eyebrow: 'BẮT ĐẦU TẬP TỐT HƠN',
    description: 'Cẩm nang ngắn giúp bạn chuẩn bị và tận dụng tốt mỗi buổi tập.', icon: <Sparkles size={18} />
  },
  policy: {
    title: 'Tài liệu & chính sách', eyebrow: 'THÔNG TIN HỘI VIÊN',
    description: 'Nắm rõ cách sử dụng gói tập, đặt lớp và tham gia buổi PT.', icon: <FileText size={18} />
  }
};

const articles: Article[] = [
  {
    slug: 'lich-lop-nhom-va-dat-cho', category: 'news',
    title: 'Lớp học nhóm tại AURA: xem lịch và giữ chỗ ngay trên web',
    excerpt: 'Tìm lớp phù hợp, kiểm tra số chỗ còn lại và theo dõi trạng thái đăng ký trong một nơi.',
    readTime: '3 phút đọc',
    intro: 'Lớp học nhóm giúp bạn có lịch tập rõ ràng và thêm động lực khi tập cùng mọi người. Bạn có thể xem các ca đang mở trên trang chủ sau khi đăng nhập.',
    sections: [
      { heading: 'Cách tìm một ca phù hợp', paragraphs: ['Mở mục Lịch lớp nhóm, chọn ngày muốn tập rồi xem giờ học, huấn luyện viên, phòng tập và số chỗ còn lại. Thông tin được tải từ lịch lớp của câu lạc bộ.'] },
      { heading: 'Đặt chỗ và theo dõi đăng ký', paragraphs: ['Chọn Đặt chỗ tham gia để đăng ký. Khi thành công, trạng thái đăng ký sẽ xuất hiện trên ca học. Nếu ca đã bắt đầu hoặc hết chỗ, hệ thống sẽ khóa đăng ký.'] },
      { heading: 'Đến lớp đúng giờ', paragraphs: ['Hãy đến phòng tập trước giờ bắt đầu để chuẩn bị. Khi vào lớp, mở nút Quét QR điểm danh trên ứng dụng và quét mã do Coach hiển thị.'] }
    ]
  },
  {
    slug: 'cap-nhat-trai-nghiem-diem-danh', category: 'news',
    title: 'Điểm danh QR cho lớp nhóm: nhanh gọn ngay tại phòng tập',
    excerpt: 'Mã QR theo từng ca giúp xác nhận đúng lớp và đúng người đã đăng ký.',
    readTime: '2 phút đọc',
    intro: 'AURA sử dụng mã QR riêng cho ca lớp nhóm để việc điểm danh diễn ra ngay tại phòng tập. Hội viên cần đăng ký ca trước và dùng tài khoản của mình để quét.',
    sections: [
      { heading: 'Quy trình tại lớp', paragraphs: ['Coach mở mã QR của ca trên trang quản lý Workclass. Hội viên đăng nhập ứng dụng, vào lịch lớp đã đặt và chọn Quét QR điểm danh.'] },
      { heading: 'Mã QR có thời hạn', paragraphs: ['Mã được làm mới định kỳ và chỉ mở trong khoảng thời gian cho phép của ca học. Nếu mã hết hạn, hãy quét mã mới đang hiển thị trên màn hình Coach.'] }
    ]
  },
  {
    slug: 'chuan-bi-buoi-tap-dau-tien', category: 'spotlight',
    title: '5 điều nên chuẩn bị trước buổi tập đầu tiên',
    excerpt: 'Một chút chuẩn bị giúp bạn bắt đầu an toàn, thoải mái và đúng mục tiêu.',
    readTime: '4 phút đọc',
    intro: 'Buổi tập đầu tiên không cần quá sức. Hãy tập trung làm quen không gian, thiết bị và nhịp độ phù hợp với thể trạng của bạn.',
    sections: [
      { heading: 'Trước khi đến phòng tập', bullets: ['Chọn trang phục vận động và giày phù hợp.', 'Uống đủ nước, ăn nhẹ nếu cần và đến sớm vài phút.', 'Chuẩn bị thông tin tài khoản hội viên để check-in.'] },
      { heading: 'Trong buổi tập', paragraphs: ['Bắt đầu bằng khởi động nhẹ. Nếu chưa quen thiết bị, hãy hỏi nhân viên hoặc Coach để được hướng dẫn cách sử dụng an toàn. Tăng mức tạ và cường độ từ từ.'] },
      { heading: 'Sau buổi tập', paragraphs: ['Thả lỏng cơ thể, uống nước và ghi lại cảm nhận. Nếu bạn có mục tiêu cụ thể, hãy trao đổi với đội ngũ AURA để được gợi ý lộ trình phù hợp.'] }
    ]
  },
  {
    slug: 'dat-lop-nhom-va-check-in', category: 'spotlight',
    title: 'Đặt lớp nhóm và check-in QR: hướng dẫn nhanh',
    excerpt: 'Từ lúc chọn ca học đến khi vào lớp, các bước đều có thể theo dõi trên tài khoản.',
    readTime: '3 phút đọc',
    intro: 'Bạn có thể chủ động chọn ca phù hợp và xem lại trạng thái đăng ký của mình trong mục lịch lớp nhóm.',
    sections: [
      { heading: 'Đặt chỗ', bullets: ['Đăng nhập tài khoản hội viên.', 'Chọn ngày và ca còn chỗ.', 'Kiểm tra trạng thái Đã đặt trong lịch của bạn.'] },
      { heading: 'Check-in tại phòng tập', paragraphs: ['Trong khoảng 15 phút trước giờ bắt đầu đến khi ca kết thúc, mở ca đã đặt và bấm Quét QR điểm danh. Hướng camera vào mã đang được Coach hiển thị.'] },
      { heading: 'Nếu không quét được', paragraphs: ['Kiểm tra quyền truy cập camera của ứng dụng, kết nối mạng và đảm bảo bạn đang quét mã của đúng ca. Bạn cũng có thể nhờ Coach kiểm tra trạng thái đăng ký.'] }
    ]
  },
  {
    slug: 'chinh-sach-goi-membership', category: 'policy',
    title: 'Chính sách gói Membership và lượt vào phòng tập',
    excerpt: 'Membership được sử dụng theo thời hạn hiệu lực của gói, không trừ lượt theo số lần vào tập.',
    readTime: '3 phút đọc',
    intro: 'Gói Membership cấp quyền sử dụng khu tập theo thời hạn ghi trên gói. Trong thời hạn còn hiệu lực, hội viên có thể check-in nhiều lần; mỗi lần vào tập không làm giảm số buổi.',
    sections: [
      { heading: 'Thời hạn sử dụng', paragraphs: ['Ngày bắt đầu và ngày kết thúc được xác định theo thông tin gói và giao dịch của hội viên. Gói cần ở trạng thái hoạt động và còn trong thời hạn để check-in.'] },
      { heading: 'Check-in phòng tập', paragraphs: ['Khi check-in, hệ thống kiểm tra gói Membership còn hiệu lực. Việc check-in xác nhận lượt vào phòng tập và không trừ buổi như gói PT.'] },
      { heading: 'Membership và dịch vụ khác', paragraphs: ['Đăng ký lớp nhóm và đặt lịch huấn luyện cá nhân có quy trình riêng. Hãy xem điều kiện hiển thị trên từng ca lớp hoặc gói dịch vụ trước khi đặt.'] }
    ]
  },
  {
    slug: 'chinh-sach-lop-hoc-nhom', category: 'policy',
    title: 'Chính sách đăng ký và điểm danh lớp học nhóm',
    excerpt: 'Quy định về giữ chỗ, thời gian check-in QR và trạng thái đăng ký lớp.',
    readTime: '3 phút đọc',
    intro: 'Lịch lớp nhóm có số chỗ giới hạn. Việc đăng ký trước giúp AURA sắp xếp phòng tập và huấn luyện viên cho từng ca.',
    sections: [
      { heading: 'Đăng ký và giữ chỗ', paragraphs: ['Hội viên cần đăng nhập để đặt ca còn chỗ. Một ca chỉ được tính là đã đăng ký khi hệ thống xác nhận thành công. Nếu lớp đã bắt đầu hoặc hết chỗ, không thể đặt thêm.'] },
      { heading: 'Điểm danh', paragraphs: ['QR điểm danh chỉ mở từ 15 phút trước giờ bắt đầu đến khi ca kết thúc. Hội viên cần quét mã do Coach hiển thị bằng tài khoản đã đặt ca. Mỗi đăng ký chỉ check-in một lần.'] },
      { heading: 'Hủy đăng ký', paragraphs: ['Thời hạn hủy được hiển thị trong ứng dụng theo ca đã đặt. Nếu cần đổi kế hoạch, hãy kiểm tra nút Hủy đăng ký và thực hiện trước thời hạn được thông báo.'] }
    ]
  },
  {
    slug: 'chinh-sach-buoi-huan-luyen-pt', category: 'policy',
    title: 'Chính sách buổi huấn luyện cá nhân (PT)',
    excerpt: 'Cách ghi nhận buổi tập, vắng mặt và điều chỉnh khi hệ thống nhận nhầm.',
    readTime: '4 phút đọc',
    intro: 'Lịch PT được đặt theo từng khung giờ và sử dụng lượt trong gói PT. Hội viên nên kiểm tra lịch hẹn và có mặt đúng giờ để Coach ghi nhận buổi tập chính xác.',
    sections: [
      { heading: 'Ghi nhận buổi tập', paragraphs: ['Buổi PT hoàn thành được ghi nhận vào gói PT theo trạng thái buổi tập trên hệ thống. Gói Membership vào phòng tập không thay thế gói PT và không bị trừ lượt khi check-in gym.'] },
      { heading: 'Trường hợp vắng mặt', paragraphs: ['Nếu không check-in, hệ thống có thể tự ghi nhận vắng sau khi buổi tập kết thúc và qua thời gian chờ xử lý. Với gói PT còn lượt, lượt có thể được trừ theo trạng thái vắng.'] },
      { heading: 'Yêu cầu kiểm tra hoặc điều chỉnh', paragraphs: ['Nếu bạn đã tham gia nhưng bị ghi nhận vắng, hoặc có lý do cần xem xét, hãy liên hệ quầy lễ tân. Nhân viên có thể kiểm tra lịch sử và điều chỉnh theo kết quả xác minh.'] }
    ]
  }
];

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--aura-border)', background: 'var(--bg-panel)', color: 'var(--text-primary)',
  boxShadow: '0 8px 24px rgba(54, 25, 12, 0.06)',
};

export const GuestArticlesSection: React.FC<{ onNavigate: (route: EditorialRoute) => void }> = ({ onNavigate }) => (
  <section id="articles" style={{ padding: '64px clamp(20px, 5vw, 56px)', background: 'var(--bg-app)' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ maxWidth: 650, marginBottom: 34 }}>
        <div style={{ color: 'var(--color-primary)', fontSize: 11, fontWeight: 900, letterSpacing: '0.16em', marginBottom: 8 }}>AURA JOURNAL</div>
        <h2 style={{ margin: 0, fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 900, color: 'var(--text-primary)' }}>Thông tin hữu ích cho hành trình tập luyện</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, margin: '10px 0 0' }}>Tin mới, cẩm nang tập luyện và chính sách hội viên được tổng hợp tại đây.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 18 }}>
        {(Object.keys(categoryInfo) as ArticleCategory[]).map(category => {
          const info = categoryInfo[category];
          const entries = articles.filter(article => article.category === category);
          return <div key={category} style={{ ...cardStyle, padding: 22, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', color: 'var(--color-primary)' }}>
                {info.icon}<h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 850 }}>{info.title}</h3>
              </div>
              <button onClick={() => onNavigate(category)} style={{ border: 0, background: 'transparent', color: 'var(--color-primary)', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>Xem tất cả <ArrowUpRight size={14} style={{ verticalAlign: 'middle' }} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 14px' }}>{info.description}</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {entries.map(article => <button key={article.slug} onClick={() => onNavigate(`article:${article.slug}`)} style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '14px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span><strong style={{ display: 'block', fontSize: 14, lineHeight: 1.4 }}>{article.title}</strong><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>{article.excerpt}</span></span>
                <ArrowRight size={17} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              </button>)}
            </div>
          </div>;
        })}
      </div>
    </div>
  </section>
);

export const GuestArticlePage: React.FC<{ route: EditorialRoute; onNavigate: (route: EditorialRoute | null) => void }> = ({ route, onNavigate }) => {
  const isArticle = route.startsWith('article:');
  const article = isArticle ? articles.find(item => item.slug === route.slice('article:'.length)) : undefined;
  const category = (article?.category ?? (route as ArticleCategory)) in categoryInfo
    ? (article?.category ?? route as ArticleCategory)
    : 'news';
  const info = categoryInfo[category];
  const list = article ? [article] : articles.filter(item => item.category === category);

  return <main style={{ position: 'fixed', inset: 0, zIndex: 10000, overflowY: 'auto', padding: '0 20px 72px', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
    <header style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-panel)', borderBottom: '1px solid var(--aura-border)', margin: '0 -20px 24px', padding: '10px 20px' }}>
      <div style={{ maxWidth: 900, minHeight: 50, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <button onClick={() => onNavigate(null)} aria-label="Về trang chủ AURA" style={{ display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <span style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontWeight: 950 }}>A</span>
          <span><strong style={{ display: 'block', fontSize: 13 }}>AURA FITNESS</strong><small style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>GYM & FITNESS CLUB</small></span>
        </button>
        <button onClick={() => onNavigate(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--aura-border)', borderRadius: 10, background: 'var(--bg-app)', color: 'var(--text-primary)', padding: '9px 12px', fontWeight: 800, cursor: 'pointer' }}><ArrowLeft size={15} />Về trang chủ</button>
      </div>
    </header>
    <div style={{ maxWidth: 900, margin: '0 auto', paddingTop: 8 }}>
      <button onClick={() => onNavigate(article ? article.category : null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: 'var(--color-primary)', fontWeight: 800, cursor: 'pointer', padding: '8px 0 20px' }}><ArrowLeft size={17} />{article ? `Quay lại ${info.title}` : 'Quay lại trang chủ'}</button>
      {article ? <article>
        <div style={{ ...cardStyle, borderRadius: 20, padding: 'clamp(22px, 5vw, 48px)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-primary)', fontSize: 11, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}><BookOpen size={16} />{info.title}</div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.16, margin: '18px 0 14px', fontWeight: 950 }}>{article.title}</h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text-muted)', margin: '0 0 22px' }}>{article.intro}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--aura-border)', borderBottom: '1px solid var(--aura-border)', padding: '13px 0', color: 'var(--text-muted)', fontSize: 12 }}><CalendarDays size={15} />Cẩm nang AURA <span aria-hidden="true">·</span> {article.readTime}</div>
          <div style={{ display: 'grid', gap: 22, marginTop: 26 }}>
            {article.sections.map(section => <section key={section.heading}>
              <h2 style={{ fontSize: 20, margin: '0 0 8px', fontWeight: 900 }}>{section.heading}</h2>
              {section.paragraphs?.map((paragraph, index) => <p key={index} style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-muted)', margin: '0 0 8px' }}>{paragraph}</p>)}
              {section.bullets && <ul style={{ margin: '8px 0 0', paddingLeft: 22, color: 'var(--text-muted)', lineHeight: 1.8 }}>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
            </section>)}
          </div>
          {article.category === 'policy' && <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', borderTop: '1px solid var(--aura-border)', paddingTop: 16, marginTop: 28 }}>Thông tin trên trang này tóm tắt cách hệ thống AURA đang vận hành. Điều khoản cụ thể của gói và lịch hẹn được hiển thị trong tài khoản hội viên; nếu có khác biệt, vui lòng liên hệ quầy lễ tân để được kiểm tra.</p>}
        </div>
      </article> : <>
        <div style={{ ...cardStyle, borderRadius: 20, padding: 'clamp(22px, 4vw, 36px)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-primary)', fontSize: 11, fontWeight: 900, letterSpacing: '0.15em' }}>{info.icon}{info.eyebrow}</div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 42px)', margin: '12px 0 8px', fontWeight: 950 }}>{info.title}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>{info.description}</p>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {list.map(item => <button key={item.slug} onClick={() => onNavigate(`article:${item.slug}`)} style={{ ...cardStyle, borderRadius: 16, padding: '22px 24px', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ color: 'var(--color-primary)', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 8 }}>{info.title.toUpperCase()} <span style={{ margin: '0 7px' }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 650, letterSpacing: 0 }}><CalendarDays size={12} />{item.readTime}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center' }}><span><strong style={{ display: 'block', fontSize: 19, lineHeight: 1.4 }}>{item.title}</strong><span style={{ display: 'block', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 5 }}>{item.excerpt}</span></span><ArrowRight size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} /></div>
          </button>)}
        </div>
      </>}
    </div>
  </main>;
};
