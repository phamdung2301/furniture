/**
 * Logic tìm kiếm dùng chung — F-003 / FR-004 / US-003.
 * Mirror cho backend (SearchService.java). Mọi so khớp đều chạy trên
 * chuỗi đã chuẩn hoá không dấu (normalizeVi).
 */

/** Bỏ dấu tiếng Việt: "Bàn trà gỗ sồi" -> "ban tra go soi" */
export function normalizeVi(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/** Khoảng cách Levenshtein — dùng cho gợi ý "Ý bạn là...?" */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Chấm điểm liên quan (§3.2 spec) trên chuỗi đã chuẩn hoá.
 * Thứ tự ưu tiên: tên chứa nguyên cụm (+100) > tên danh mục (+60) >
 * tên chứa đủ các từ (+40) > mô tả (+20) > tên chứa một phần (+10/từ).
 * Trả 0 nếu không liên quan.
 */
export function scoreRelevance(product, qNorm, categoryNameNorm) {
  const q = (qNorm || '').trim();
  if (!q) return 0;
  const nameN = normalizeVi(product.name);
  const descN = normalizeVi(product.description || '');
  const catN = categoryNameNorm || '';
  const words = q.split(/\s+/).filter(Boolean);

  if (nameN.includes(q)) return 100;
  if (catN && catN.includes(q)) return 60;
  if (words.length > 1 && words.every((w) => nameN.includes(w))) return 40;
  if (descN.includes(q)) return 20;
  const hit = words.filter((w) => nameN.includes(w)).length;
  return hit > 0 ? 10 * hit : 0;
}

/**
 * Xếp hạng sản phẩm theo từ khoá.
 * Trả [{ product, score }] đã sort: điểm giảm dần, hoà điểm → soldCount giảm dần.
 * getCategoryName(product) -> tên danh mục (đã có thể là chuỗi thô).
 */
export function rankProducts(products, q, getCategoryName) {
  const qNorm = normalizeVi(q).trim();
  if (!qNorm) return [];
  return (products || [])
    .filter((p) => p.active !== false)
    .map((p) => ({
      product: p,
      score: scoreRelevance(p, qNorm, normalizeVi(getCategoryName ? getCategoryName(p) : '')),
    }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (b.product.soldCount || 0) - (a.product.soldCount || 0)
    );
}

/**
 * Từ điển gợi ý chính tả: các từ (đã chuẩn hoá) trong tên SP,
 * tên danh mục và từ khoá phổ biến.
 */
export function buildDictionary(products, categories, popularKeywords) {
  const set = new Set();
  const addWords = (s) =>
    normalizeVi(s)
      .split(/\s+/)
      .forEach((w) => {
        if (w.length >= 2) set.add(w);
      });
  (products || []).forEach((p) => addWords(p.name));
  (categories || []).forEach((c) => addWords(c.name));
  (popularKeywords || []).forEach(addWords);
  return [...set];
}

/**
 * Gợi ý "Ý bạn là...?": sửa từng từ trong q với khoảng cách Levenshtein ≤ 2.
 * Trả về query đã sửa (dạng không dấu — tìm kiếm chuẩn hoá nên vẫn đúng),
 * hoặc null nếu không có gì gần đúng.
 */
export function suggestCorrection(q, dictionary) {
  const words = normalizeVi(q).trim().split(/\s+/).filter(Boolean);
  if (!words.length || !dictionary || !dictionary.length) return null;
  let changed = false;
  const fixed = words.map((w) => {
    if (dictionary.includes(w)) return w;
    let best = null;
    let bestD = Infinity;
    for (const d of dictionary) {
      if (Math.abs(d.length - w.length) > 2) continue;
      const dist = levenshtein(w, d);
      if (dist < bestD) {
        bestD = dist;
        best = d;
        if (bestD === 1) break;
      }
    }
    if (best && bestD <= 2 && bestD < w.length) {
      changed = true;
      return best;
    }
    return w;
  });
  return changed ? fixed.join(' ') : null;
}

/**
 * Tách tên sản phẩm thành các đoạn [{ text, hit }] để highlight từ khoá.
 * Khớp không phân biệt dấu/hoa-thường, highlight từng từ khớp.
 */
export function highlightParts(name, q) {
  const words = normalizeVi(q).trim().split(/\s+/).filter((w) => w.length > 0);
  if (!words.length || !name) return [{ text: name || '', hit: false }];

  // Dựng chuỗi chuẩn hoá + map từng ký tự về index gốc
  let norm = '';
  const map = [];
  for (let i = 0; i < name.length; i++) {
    const base = normalizeVi(name[i]) || name[i].toLowerCase();
    for (const c of base) {
      norm += c;
      map.push(i);
    }
  }

  const hits = [];
  for (const w of words) {
    let from = 0;
    for (;;) {
      const idx = norm.indexOf(w, from);
      if (idx === -1) break;
      hits.push([map[idx], map[idx + w.length - 1] + 1]);
      from = idx + 1;
    }
  }
  if (!hits.length) return [{ text: name, hit: false }];

  hits.sort((a, b) => a[0] - b[0]);
  const merged = [hits[0]];
  for (let i = 1; i < hits.length; i++) {
    const last = merged[merged.length - 1];
    if (hits[i][0] <= last[1]) last[1] = Math.max(last[1], hits[i][1]);
    else merged.push(hits[i]);
  }

  const parts = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) parts.push({ text: name.slice(pos, s), hit: false });
    parts.push({ text: name.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < name.length) parts.push({ text: name.slice(pos), hit: false });
  return parts;
}

/** Từ khoá tìm kiếm phổ biến (§2.4 spec — phase sau admin cấu hình được). */
export const POPULAR_SEARCHES = [
  'sofa',
  'bàn ăn',
  'giường ngủ',
  'tủ quần áo',
  'kệ tivi',
  'bàn làm việc',
  'ghế ăn',
  'đèn trang trí',
];
