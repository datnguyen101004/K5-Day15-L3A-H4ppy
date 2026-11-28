/* Nhân vật, nhãn loại thẻ, chân dung chibi SVG (không ảnh ngoài) */

export const TYPE_LABELS = { concept: "Khái niệm", rule: "Quy tắc", example: "Ví dụ", mistake: "Lỗi thường gặp" };
export const TYPE_COLORS = { concept: "#7CC4FF", rule: "#FFD45C", example: "#9EE09E", mistake: "#FF8A8A" };

/* id thí sinh (contract) -> tạo hình cảnh 3D (look) */
export const LOOK_OF = { player: "player", minh: "nhanh", vy: "canthan", hai: "haycai", an: "mommang" };
export const CONTESTANT_COLORS = { player: "#FFFFFF", minh: "#FFD45C", vy: "#7CC4FF", hai: "#FF8A8A", an: "#9EE09E" };
export const OPPONENT_STRENGTHS = {
  minh: "Trả lời nhanh, ngắn gọn",
  vy: "Bám sát tài liệu, dẫn số slide",
  hai: "Giỏi phát hiện lỗi, phản biện sắc",
  an: "Giỏi đưa ví dụ áp dụng",
};

export const KIND_LABELS = { recall: "Nhớ kiến thức", apply: "Áp dụng", rebuttal: "Phản biện" };
export const DIMENSION_LABELS = { correctness: "Đúng nội dung", application: "Áp dụng tốt", rebuttal: "Phản biện sắc" };

const EYE_COLORS = { player: "#9B7ED9", nhanh: "#E8A13A", canthan: "#4A90D9", haycai: "#D95F5F", mommang: "#6FBF73", teacher: "#8A6A4F" };

export function faceChipSVG(lookId) {
  const skin = "#FFDFC4", ink = "#3B2F4A", blush = "#FFB7C9";
  const eye = EYE_COLORS[lookId] || "#9B7ED9";
  const eyeOpen = `
    <ellipse cx="24" cy="37" rx="5.4" ry="6.8" fill="#fff" stroke="${ink}" stroke-width="2"/>
    <circle cx="24.6" cy="38.6" r="3" fill="${eye}"/><circle cx="25" cy="39" r="1.4" fill="${ink}"/><circle cx="22.8" cy="35.8" r="1.2" fill="#fff"/>
    <ellipse cx="40" cy="37" rx="5.4" ry="6.8" fill="#fff" stroke="${ink}" stroke-width="2"/>
    <circle cx="40.6" cy="38.6" r="3" fill="${eye}"/><circle cx="41" cy="39" r="1.4" fill="${ink}"/><circle cx="38.8" cy="35.8" r="1.2" fill="#fff"/>`;
  const eyeSleepy = `
    <path d="M20 37 Q24 33.5 28 37" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M36 37 Q40 33.5 44 37" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="24" cy="40" r="2.4" fill="${eye}"/><circle cx="40" cy="40" r="2.4" fill="${eye}"/>`;
  const mouths = {
    smile: `<path d="M27 48 Q32 52.5 37 48" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    grit: `<path d="M27 49 L37 46" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  let hair = "", eyes = eyeOpen, mouth = mouths.smile;
  if (lookId === "nhanh") {
    hair = `<path d="M10 32 Q8 10 32 9 Q56 10 54 32 L48 22 L44 29 L38 20 L32 28 L26 20 L20 29 L16 22 Z" fill="#F2C14E" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 33 Q12 14 32 12.5 Q52 14 51 33 Q46 22 32 21 Q18 22 13 33 Z" fill="#F2C14E" stroke="${ink}" stroke-width="2.2"/>`;
  } else if (lookId === "canthan") {
    hair = `<path d="M10 38 Q9 12 32 11 Q55 12 54 38 L47 38 Q49 24 42 21 Q32 17 22 21 Q15 24 17 38 Z" fill="#6B4A3A" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="24" cy="37" r="7" fill="none" stroke="${ink}" stroke-width="2.2"/><circle cx="40" cy="37" r="7" fill="none" stroke="${ink}" stroke-width="2.2"/><path d="M31 37 h2" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    eyes = eyeOpen.replaceAll('rx="5.4" ry="6.8"', 'rx="4.6" ry="5.8"');
  } else if (lookId === "haycai") {
    hair = `<path d="M11 34 L15 15 L21 26 L27 13 L32 24 L37 13 L43 26 L49 15 L53 34 Q52 12 32 10.5 Q12 12 11 34 Z" fill="#4A3A5C" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><path d="M52 22 Q60 30 56 42" fill="none" stroke="#4A3A5C" stroke-width="5" stroke-linecap="round"/><circle cx="56" cy="44" r="4.5" fill="#4A3A5C" stroke="${ink}" stroke-width="2"/>`;
    mouth = mouths.grit;
  } else if (lookId === "mommang") {
    hair = `<g fill="#C98A5A" stroke="${ink}" stroke-width="2"><circle cx="20" cy="18" r="7"/><circle cx="32" cy="14" r="8"/><circle cx="44" cy="18" r="7"/><circle cx="15" cy="27" r="6"/><circle cx="49" cy="27" r="6"/></g>`;
    eyes = eyeSleepy;
  } else if (lookId === "player") {
    hair = `<path d="M11 34 Q10 12 32 11 Q54 12 53 34 Q48 20 32 19 Q16 20 11 34 Z" fill="#FFFFFF" stroke="${ink}" stroke-width="2.2"/><g fill="#FFB7C9" stroke="${ink}" stroke-width="1.4"><ellipse cx="20" cy="18" rx="3.4" ry="2" transform="rotate(-30 20 18)"/><ellipse cx="25" cy="15" rx="3.4" ry="2" transform="rotate(10 25 15)"/><ellipse cx="17" cy="23" rx="3.2" ry="1.9" transform="rotate(-70 17 23)"/></g><circle cx="21.5" cy="19" r="2" fill="#F78FB0" stroke="${ink}" stroke-width="1.2"/>`;
  } else { // teacher — Cô Linh
    hair = `<path d="M10 36 Q9 12 32 11 Q55 12 54 36 Q48 20 32 19 Q16 20 10 36 Z" fill="#8A6A4F" stroke="${ink}" stroke-width="2.2"/><circle cx="32" cy="12" r="6" fill="#8A6A4F" stroke="${ink}" stroke-width="2"/><path d="M38 14 Q44 22 42 32" fill="none" stroke="#8A6A4F" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="37" r="6.4" fill="none" stroke="${ink}" stroke-width="2"/><circle cx="40" cy="37" r="6.4" fill="none" stroke="${ink}" stroke-width="2"/><path d="M30.4 37 h3.2" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="36" r="21" fill="${skin}" stroke="${ink}" stroke-width="2.4"/>${hair}${eyes}<ellipse cx="17.5" cy="44" rx="3.4" ry="2" fill="${blush}"/><ellipse cx="46.5" cy="44" rx="3.4" ry="2" fill="${blush}"/>${mouth}</svg>`;
}

export function medalSVG(rank) {
  const cols = { 1: ["#FFD45C", "#E8A93C"], 2: ["#E4E9F2", "#B9C2D4"], 3: ["#EBBE8A", "#C98F58"] };
  const [c1, c2] = cols[rank] || ["#E4E9F2", "#B9C2D4"];
  return `<svg class="medal" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M13 22 L8 38 L16 34 L20 39 L24 34 L32 38 L27 22 Z" fill="${c2}" stroke="#3B2F4A" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="20" cy="16" r="12" fill="${c1}" stroke="#3B2F4A" stroke-width="2.5"/>
    <path d="M20 9 l2.1 4.6 5 .6 -3.7 3.4 1 4.9 -4.4 -2.5 -4.4 2.5 1 -4.9 -3.7 -3.4 5 -.6 Z" fill="#FFFDF6" stroke="#3B2F4A" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
}
