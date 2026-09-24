// Thông số của Quỷ Kiếm Darkin. Sửa ở đây để cân bằng lại chiêu.
// Đơn vị: máu (20 = 10 tim), block, giây.

export const CONFIG = {
  // Chiêu có đánh trúng người chơi khác không (false = chỉ đánh mob)
  pvp: true,
  // Hút máu: hồi % sát thương gây ra (cả đánh thường lẫn chiêu)
  lifesteal: 0.15,

  // Nội tại — Tư Thế Tử Thần: đòn đánh thường kế tiếp gây nổ thêm % máu tối đa của mục tiêu và hồi máu
  passive: {
    cooldown: 8,
    maxHealthPct: 0.08,
    minBonus: 3,
    maxBonus: 12,
    healRatio: 1,
    sweetSpotReduction: 2, // Q trúng điểm ngọt giảm hồi chiêu nội tại (giây)
    delay: 0.5, // vết chém phát nổ sau khoảng này (tránh thời gian bất tử sau đòn đánh)
  },

  // Q — Quỷ Kiếm Darkin: chém 3 lần, trúng mép kiếm (điểm ngọt) thì x1.6 sát thương + hất tung + choáng
  Q: {
    cooldown: 7,
    recastWindow: 4,
    windup: 0.45,
    sweetMultiplier: 1.6,
    knockup: 0.8,
    stun: 0.6,
    casts: [
      { shape: "box", length: 6, width: 2.5, sweet: 1.5, damage: 6 }, // nhát chém dài
      { shape: "box", length: 5, width: 4.5, sweet: 1.5, damage: 7 }, // nhát chém ngang
      { shape: "circle", offset: 2.5, radius: 2.5, sweet: 1, damage: 9 }, // nện xuống đất
    ],
  },

  // E — Bước Nhảy Hắc Ám: lướt theo hướng nhìn
  E: {
    cooldown: 4,
    strength: 2.2,
    vertical: 0.15,
  },

  // W — Xiềng Xích Địa Ngục: trói mục tiêu, không chạy khỏi vòng kịp thì bị kéo về + choáng
  W: {
    cooldown: 12,
    range: 14,
    speed: 1.5, // block mỗi tick
    hitRadius: 1.2,
    damage: 4,
    slowAmplifier: 1,
    pullDelay: 1.5,
    escapeRadius: 3.5,
    pullPerBlock: 0.35,
    maxPull: 3,
    pullDamage: 5,
    stun: 0.75,
  },

  // R — Kẻ Diệt Thế: biến hình, hất văng + làm chậm xung quanh, tăng sát thương/hồi máu/tốc chạy
  R: {
    cooldown: 60,
    duration: 10,
    castTime: 0.5,
    radius: 6,
    castDamage: 4,
    knockback: 1.6,
    fearSlowAmplifier: 2,
    fearDuration: 2,
    damageMultiplier: 1.3, // áp dụng cho sát thương chiêu
    healMultiplier: 1.5,
    speedAmplifier: 1,
    strengthAmplifier: 0, // tăng sát thương đánh thường qua hiệu ứng Sức Mạnh
    passiveCooldownMultiplier: 0.5,
  },
};
