/** Badge góc card — §0.4 spec. type: new | bestseller | sale */
export default function Badge({ type, label }) {
  return <span className={`badge badge-${type}`}>{label}</span>;
}
