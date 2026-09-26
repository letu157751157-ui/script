// File: scripts/custom/yeti_phase2.js
// Skills cho Yeti Phase 2 (ytaun:yeti_2) - Yeti Trưởng Thành
//
// v1.3 (nâng cấp skill):
// - Mọi chiêu có animation riêng + particle băng mới + vòng cảnh báo trước đòn nặng
// - Blizzard Rain -> Mưa Băng Nhọn (băng nhọn rơi đúng vào vòng đỏ, nhắm cả người chơi)
// - Frost Spike -> Rãnh Băng (vết nứt chạy tới mục tiêu, cột băng hất tung, mỗi người chỉ trúng 1 lần)
// - Ice Ball -> Ném Tảng Băng
// - Cú Nhảy Nghiền Băng: trước đây có code nhưng chưa bao giờ được dùng, nay đã dùng
// - MỚI: Hơi Thở Băng Giá (phun băng hình nón, trúng 4 lần liên tiếp thì bị đóng băng)
// - MỚI: Vuốt Băng Kép
// - Sửa: Elite Army / Earthquake trước đây được tung cùng lúc với chiêu khác và tung ngay khi
//   vừa gặp người chơi; nay có hồi chiêu chung + chờ lần đầu
// Giữ nguyên: identifier "ytaun:yeti_2", máu 500, các ngưỡng máu và hồi chiêu gốc

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';
import { castIceSpike, castChargeAttack } from './yeti_spike_charge';

const SPIKE_CHARGE_CONFIG = {
    laneCount: 3,
    spikeDamage: 5,
    windupTicks: 20,
    dashTicks: 14,
    meleeDamage: 18,
    knockbackStrength: 1.8,
    slownessAmplifier: 3,
    freezeDurationTicks: 140,
    animIceSpike: 'animation.ytaun_yeti_1_default.ice_spike',
    animAttack2: 'animation.ytaun_yeti_1_default.attack_2',
    animAttackHit: 'animation.ytaun_yeti_1.attack'
};

createBoss({
    id: 'ytaun:yeti_2',
    label: 'Yeti Phase 2 (yeti_2)',
    detectRange: 35,
    gcd: 40,
    openingDelay: 60, // chờ animation xuất hiện pha mới
    skills: [
        // ---- Khẩn cấp theo máu ----
        {
            name: 'absoluteZero', tier: 0, cd: 7500, when: c => c.hp < 0.2,
            cast: c => S.absoluteZero(c.yeti, { durationTicks: 400, every: 5, radius: 25, damage: 15, damageEveryN: 10, slow: [40, 5], weak: [40, 3] })
        },
        {
            name: 'iceRegen', tier: 0, cd: 3300, when: c => c.hp < 0.3,
            cast: c => S.iceRegen(c.yeti, { durationTicks: 120, heal: 10, healEvery: 10, pushRadius: 7, pushPower: 2, pushVertical: 0.5, damage: 8, damageEvery: 20, resistance: 2 })
        },
        {
            name: 'summonMinions', tier: 0, cd: 1050, when: c => c.hp < 0.5,
            cast: c => S.summonMinions(c.yeti, {
                points: [{ x: 5, z: 0, d: 0 }, { x: -5, z: 0, d: 10 }, { x: 0, z: 5, d: 20 }, { x: 0, z: -5, d: 30 }, { x: 4, z: 4, d: 40 }, { x: -4, z: -4, d: 50 }],
                types: ['minecraft:stray', 'minecraft:zombie', 'minecraft:skeleton'],
                effects: [['speed', 1], ['strength', 1]],
                portalTicks: 25
            })
        },
        {
            name: 'polarVortex', tier: 0, cd: 900, when: c => c.hp < 0.6,
            cast: c => S.polarVortex(c.yeti, { durationTicks: 200, radius: 15, pull: 0.8, damage: 8, damageEvery: 20, slow: [40, 4] })
        },
        // ---- Chiêu đặc trưng ----
        {
            name: 'eliteArmy', tier: 1, cd: 6750, first: 600,
            cast: c => S.summonMinions(c.yeti, {
                points: [{ x: 7, z: 0, d: 0 }, { x: -7, z: 0, d: 12 }, { x: 0, z: 7, d: 24 }, { x: 0, z: -7, d: 36 }, { x: 5, z: 5, d: 48 }, { x: -5, z: -5, d: 60 }, { x: 5, z: -5, d: 72 }, { x: -5, z: 5, d: 84 }],
                types: ['ytaun:yeti_boss_pet', 'minecraft:wither_skeleton', 'minecraft:husk'],
                effects: [['speed', 2], ['strength', 2], ['resistance', 1]],
                portalTicks: 20
            })
        },
        {
            name: 'earthquake', tier: 1, cd: 410, first: 200,
            cast: c => S.earthquake(c.yeti, { height: 6, rings: 8, ringStep: 3, ringDelay: 6, damage: 10, slow: [60, 2], knock: [1.5, 0.3] })
        },
        {
            name: 'iceSpike', tier: 1, cd: 485, first: 80,
            cast: c => castIceSpike(c.yeti, c.target, SPIKE_CHARGE_CONFIG)
        },
        {
            name: 'chargeAttack', tier: 1, cd: 350, first: 140, when: c => c.d >= 4,
            cast: c => castChargeAttack(c.yeti, c.target, SPIKE_CHARGE_CONFIG, (hit, finalTarget) => {
                if (!hit && finalTarget && c.yeti.isValid) {
                    c.st.cd.iceSpike = c.tick + 485;
                    castIceSpike(c.yeti, finalTarget, SPIKE_CHARGE_CONFIG);
                }
            })
        },
        // ---- Chiêu thường theo khoảng cách ----
        {
            name: 'frostBreath', tier: 2, cd: 420, when: c => c.d <= 10,
            cast: c => S.frostBreath(c.yeti, c.target, { range: 10, halfAngle: 28, damage: 3, hitEvery: 6, slow: [40, 2], freezeHits: 4, freezeTicks: 40 })
        },
        {
            name: 'frostClaws', tier: 2, cd: 120, when: c => c.d <= 5.5,
            cast: c => S.frostClaws(c.yeti, c.target, { range: 5, halfAngle: 60, damage: 10, slow: [50, 2], knock: [1.3, 0.35] })
        },
        {
            name: 'icicleRain', tier: 2, cd: 470, when: c => c.d > 14,
            cast: c => S.icicleRain(c.yeti, c.target, { waves: 8, perWave: 5, interval: 12, area: 22, radius: 2, damage: 10, slow: [80, 3] })
        },
        {
            name: 'glacierRift', tier: 2, cd: 335, when: c => c.d > 12,
            cast: c => S.glacierRift(c.yeti, c.target, { steps: 8, spacing: 2.5, stepDelay: 4, radius: 2.2, damage: 14, launch: 1.2 })
        },
        {
            name: 'boulderToss', tier: 2, cd: 275, when: c => c.d > 10,
            cast: c => S.boulderToss(c.yeti, c.target, { damage: 12, radius: 3, flightTicks: 12, slow: [100, 2], arc: 5 })
        },
        {
            name: 'crushingLeap', tier: 2, cd: 350, when: c => c.d > 10 && c.d <= 18,
            cast: c => S.crushingLeap(c.yeti, c.target, { height: 9, radius: 6, maxDamage: 18, falloff: 2.5, minDamage: 6, knock: [2.5, 0.6] })
        },
        {
            name: 'glacialWave', tier: 2, cd: 440, when: c => c.d <= 10,
            cast: c => S.glacialWave(c.yeti, { rings: 10, ringStep: 2, ringDelay: 8, damage: 12, knock: [2, 0.6] })
        },
        {
            name: 'frostRoar', tier: 2, cd: 380, when: c => c.d <= 8,
            cast: c => S.frostRoar(c.yeti, { rings: 7, ringStep: 2.5, ringDelay: 8, damage: r => Math.max(15 - Math.floor(r / 18 * 6), 8), slow: [140, 3], knock: [0.6, 0.3] })
        }
    ]
});
