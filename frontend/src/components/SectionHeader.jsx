/** Tiêu đề khối + link "Xem tất cả" — §0.4 spec.
 *  Prop extra (optional): node hiển thị cạnh tiêu đề (vd chip countdown flash sale §6). */
export default function SectionHeader({ title, moreText = 'Xem tất cả', onMore, extra }) {
  return (
    <div className="section-head">
      <div className="section-head__left">
        <h2>{title}</h2>
        {extra}
      </div>
      {onMore && (
        <button className="btn btn-text" onClick={onMore}>
          {moreText} →
        </button>
      )}
    </div>
  );
}
