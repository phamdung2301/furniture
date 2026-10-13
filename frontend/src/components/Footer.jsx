/** Footer — §2.7 spec */
export default function Footer({ onToast }) {
  const soon = (e) => {
    e.preventDefault();
    onToast?.('Trang này sẽ có ở bản đầy đủ');
  };
  const cols = [
    {
      title: null,
      links: [],
    },
    {
      title: 'Hỗ trợ khách hàng',
      links: ['Hướng dẫn mua hàng', 'Chính sách vận chuyển', 'Đổi trả & bảo hành', 'Câu hỏi thường gặp'],
    },
    {
      title: 'Về chúng tôi',
      links: ['Giới thiệu', 'Hệ thống cửa hàng', 'Tuyển dụng', 'Liên hệ'],
    },
    {
      title: 'Liên hệ',
      links: [],
      custom: (
        <>
          <p>123 Nguyễn Trãi, Q.5, TP.HCM</p>
          <p>Hotline: 1900 6868 (8h–21h)</p>
          <p>hello@mocan.vn</p>
        </>
      ),
    },
  ];

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <div className="logo logo--light">
            <span className="logo__name">Mộc An</span>
            <span className="logo__tag">NỘI THẤT</span>
          </div>
          <p>Nội thất cho tổ ấm Việt — thiết kế hiện đại, giá xưởng.</p>
        </div>
        {cols.slice(1).map((col) => (
          <div key={col.title} className="site-footer__col">
            <h4>{col.title}</h4>
            {col.custom || (
              <ul>
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" onClick={soon}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="container site-footer__bottom">
        <span>© 2026 Nội Thất Mộc An</span>
        <span>Thanh toán: COD · Chuyển khoản · MoMo</span>
      </div>
    </footer>
  );
}
