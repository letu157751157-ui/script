// File: scripts/custom/yeti_phase1.js
// Skills cho Yeti Phase 1 (ytaun:yeti_1) - Giai đoạn đầu (dễ hơn)
//
// v1.4: làm lại hình ảnh toàn bộ chiêu (animation theo khớp model đã sửa, particle mới nhiều lớp),
// Gai Băng là particle (bỏ mob gai băng), chiêu đánh cả mob mà boss đang nhắm. Cơ chế giữ như v1.3.

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

const SPIKE_CHARGE_CONFIG = {
    laneCount: 3,
    spikeDamage: 4,
    spikeStep: 3,
    meleeDamage: 15,
    knockbackStrength: 1.6,
    slownessAmplifier: 3,
    freezeDurationTicks: 120
};

createBoss({
    id: 'ytaun:yeti_1',
    label: 'Yeti Phase 1 (yeti_1)',
    detectRange: 25,
    gcd: 50,
    skills: [
        // ---- Khẩn cấp theo máu ----
        {
            name: 'iceRegen', tier: 0, cd: 600, when: c => c.hp < 0.4,
            cast: c => S.iceRegen(c.yeti, { durationTicks: 100, heal: 4, healEvery: 10, pushRadius: 3, pushPower: 0.5, pushVertical: 0.2, damage: 0, damageEvery: 20 })
        },
        {
            name: 'summonMinions', tier: 0, cd: 750, when: c => c.hp < 0.5,
            cast: c => S.summonMinions(c.yeti, {
                points: [{ x: 4, z: 0, d: 0 }, { x: -4, z: 0, d: 15 }, { x: 0, z: 4, d: 30 }, { x: 0, z: -4, d: 45 }],
                types: ['minecraft:stray', 'minecraft:zombie', 'minecraft:skeleton'],
                effects: [['speed', 0], ['strength', 0]],
                portalTicks: 30
            })
        },
        // ---- Chiêu đặc trưng ----
        {
            name: 'iceSpike', tier: 1, cd: 360, first: 100,
            cast: c => S.castIceSpike(c.yeti, c.target, SPIKE_CHARGE_CONFIG)
        },
        {
            name: 'chargeAttack', tier: 1, cd: 380, first: 160, when: c => c.d >= 4,
            cast: c => S.castChargeAttack(c.yeti, c.target, SPIKE_CHARGE_CONFIG, (hit, finalTarget) => {
                // lao trượt -> tung Gai Băng ngay lập tức
                if (!hit && finalTarget && c.yeti.isValid) {
                    c.st.cd.iceSpike = c.tick + 360;
                    S.castIceSpike(c.yeti, finalTarget, SPIKE_CHARGE_CONFIG);
                }
            })
        },
        // ---- Chiêu thường theo khoảng cách ----
        {
            name: 'frostClaws', tier: 2, cd: 140, when: c => c.d <= 5,
            cast: c => S.frostClaws(c.yeti, c.target, { range: 4.5, halfAngle: 60, damage: 7, slow: [40, 1], knock: [1.0, 0.3] })
        },
        {
            name: 'boulderToss', tier: 2, cd: 320, when: c => c.d > 10,
            cast: c => S.boulderToss(c.yeti, c.target, { damage: 6, radius: 2.5, flightTicks: 14, slow: [60, 1], arc: 4 })
        },
        {
            name: 'crushingLeap', tier: 2, cd: 380, when: c => c.d > 8 && c.d <= 16,
            cast: c => S.crushingLeap(c.yeti, c.target, { height: 5, radius: 4, maxDamage: 8, falloff: 1.5, minDamage: 3, knock: [1.5, 0.4] })
        },
        {
            name: 'frostRoar', tier: 2, cd: 300, when: c => c.d <= 8,
            cast: c => S.frostRoar(c.yeti, { rings: 4, ringStep: 3, ringDelay: 10, slow: [80, 1], fatigue: [80, 0] })
        },
        {
            name: 'frostField', tier: 2, cd: 440, when: c => c.d <= 6,
            cast: c => S.frostField(c.yeti, { radius: 5, durationTicks: 400, damage: 1, slow: [30, 1] })
        }
    ]
});
