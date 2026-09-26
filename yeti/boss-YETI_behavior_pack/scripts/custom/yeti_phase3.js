// File: scripts/custom/yeti_phase3.js
// Skills cho Yeti Phase 3 (ytaun:yeti_3) - Yeti Cổ Đại
//
// v1.3 (nâng cấp skill):
// - Mọi chiêu có animation riêng + particle băng mới + vòng cảnh báo trước đòn nặng
// - Crystal Barrage -> Mưa Tảng Băng (ném liên tiếp 6 tảng băng vào người chơi)
// - Ice Chains: trói 5 giây rồi GIẬT mục tiêu về phía Yeti (trước: trói 10 giây)
// - MỚI: Ngục Băng (nhốt mục tiêu trong cột băng nếu không kịp chạy khỏi vòng đỏ)
// - MỚI: Hơi Thở Băng Giá, Vuốt Băng Kép
// - MỚI: Cuồng Nộ - khi còn dưới 35% máu (1 lần): tăng tốc + sức mạnh, mọi chiêu hồi nhanh hơn 25%
// Giữ nguyên: identifier "ytaun:yeti_3", máu 500, Giáp Băng phản 30% sát thương, các ngưỡng máu gốc

import { world, system } from '@minecraft/server';
import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';
import { castIceSpike, castChargeAttack } from './yeti_spike_charge';
import { FX, fx, effect } from './yeti_fx';

const ID = 'ytaun:yeti_3';
const armorActive = new Map();  // entity.id -> Giáp Băng đang bật
const prisonActive = new Map(); // player.id -> đang bị nhốt trong Ngục Băng

const SPIKE_CHARGE_CONFIG = {
    laneCount: 4,
    spikeDamage: 6,
    windupTicks: 16,
    dashTicks: 14,
    meleeDamage: 20,
    knockbackStrength: 2.0,
    slownessAmplifier: 4,
    freezeDurationTicks: 160,
    animIceSpike: 'animation.ytaun_yeti_1_default.ice_spike',
    animAttack2: 'animation.ytaun_yeti_1_default.attack_2',
    animAttackHit: 'animation.ytaun_yeti_1.attack'
};

createBoss({
    id: ID,
    label: 'Yeti Phase 3 (yeti_3)',
    detectRange: 40,
    gcd: 30,
    openingDelay: 60,
    cooldownScale: st => (st.data.enraged ? 0.75 : 1),
    onTick: (yeti, st, tick) => {
        // hào quang băng quanh Yeti khi đang Cuồng Nộ
        if (st.data.enraged && tick % 20 === 0) fx(yeti.dimension, FX.aura, yeti.location, { radius: 2 });
    },
    skills: [
        // ---- Khẩn cấp theo máu ----
        {
            name: 'enrage', tier: 0, cd: 1e9, when: c => c.hp < 0.35 && !c.st.data.enraged,
            cast: c => { c.st.data.enraged = true; S.enrage(c.yeti, { speed: 1, strength: 1, name: '§3§lYeti Cổ Đại' }); }
        },
        {
            name: 'absoluteZero', tier: 0, cd: 1320, when: c => c.hp < 0.15,
            cast: c => S.absoluteZero(c.yeti, { durationTicks: 400, every: 4, radius: 30, damage: 20, damageEveryN: 8, slow: [50, 6], weak: [50, 4] })
        },
        {
            name: 'iceRegen', tier: 0, cd: 7800, when: c => c.hp < 0.3,
            cast: c => {
                const low = c.hp < 0.25;
                S.iceRegen(c.yeti, {
                    durationTicks: low ? 140 : 120, heal: low ? 15 : 8, healEvery: 8,
                    pushRadius: low ? 8 : 7, pushPower: low ? 2.5 : 2, pushVertical: 0.6,
                    damage: low ? 12 : 8, damageEvery: 15, resistance: low ? 3 : undefined
                });
            }
        },
        {
            name: 'frostArmor', tier: 0, cd: 930, when: c => c.hp < 0.5 && !armorActive.has(c.yeti.id),
            cast: c => S.frostArmor(c.yeti, { durationTicks: 200, resistance: 2 }, armorActive)
        },
        // ---- Chiêu đặc trưng ----
        {
            name: 'eliteArmy', tier: 1, cd: 3300, first: 600,
            cast: c => S.summonMinions(c.yeti, {
                points: [
                    { x: 7, z: 0, d: 0 }, { x: -7, z: 0, d: 12 }, { x: 0, z: 7, d: 24 }, { x: 0, z: -7, d: 36 },
                    { x: 5, z: 5, d: 48 }, { x: -5, z: -5, d: 60 }, { x: 5, z: -5, d: 72 }, { x: -5, z: 5, d: 84 },
                    { x: 10, z: 0, d: 96 }, { x: -10, z: 0, d: 108 }, { x: 0, z: 10, d: 120 }, { x: 0, z: -10, d: 132 }
                ],
                types: ['ytaun:yeti_boss_pet', 'minecraft:wither_skeleton', 'minecraft:husk', 'minecraft:stray'],
                effects: [['speed', 2], ['strength', 2], ['resistance', 1]],
                portalTicks: 20
            })
        },
        {
            name: 'earthquake', tier: 1, cd: 450, first: 200,
            cast: c => S.earthquake(c.yeti, { height: 6, rings: 10, ringStep: 3.5, ringDelay: 5, damage: 13, slow: [80, 3], knock: [2, 0.4] })
        },
        {
            name: 'crushingLeap', tier: 1, cd: 290, when: c => c.d > 15,
            cast: c => S.crushingLeap(c.yeti, c.target, { height: 12, radius: 10, maxDamage: 32, falloff: 3, minDamage: 10, knock: [4, 1] })
        },
        {
            name: 'iceSpike', tier: 1, cd: 425, first: 60,
            cast: c => castIceSpike(c.yeti, c.target, SPIKE_CHARGE_CONFIG)
        },
        {
            name: 'chargeAttack', tier: 1, cd: 320, first: 120, when: c => c.d >= 4,
            cast: c => castChargeAttack(c.yeti, c.target, SPIKE_CHARGE_CONFIG, (hit, finalTarget) => {
                if (!hit && finalTarget && c.yeti.isValid) {
                    c.st.cd.iceSpike = c.tick + 425;
                    castIceSpike(c.yeti, finalTarget, SPIKE_CHARGE_CONFIG);
                }
            })
        },
        {
            name: 'icePrison', tier: 1, cd: 500, first: 160, when: c => c.d > 4 && c.d <= 18 && !prisonActive.has(c.target.id),
            cast: c => S.icePrison(c.yeti, c.target, { delay: 12, durationTicks: 60, damage: 12, radius: 1.8 }, prisonActive)
        },
        // ---- Chiêu thường theo khoảng cách ----
        {
            name: 'frostBreath', tier: 2, cd: 380, when: c => c.d <= 11,
            cast: c => S.frostBreath(c.yeti, c.target, { range: 11, halfAngle: 30, damage: 4, hitEvery: 6, slow: [50, 3], freezeHits: 4, freezeTicks: 50 })
        },
        {
            name: 'frostClaws', tier: 2, cd: 100, when: c => c.d <= 6,
            cast: c => S.frostClaws(c.yeti, c.target, { range: 5.5, halfAngle: 65, damage: 13, slow: [60, 3], knock: [1.6, 0.4] })
        },
        {
            name: 'icicleRain', tier: 2, cd: 600, when: c => c.d > 16,
            cast: c => S.icicleRain(c.yeti, c.target, { waves: 10, perWave: 7, interval: 10, area: 26, radius: 2.2, damage: 14, slow: [100, 4] })
        },
        {
            name: 'boulderBarrage', tier: 2, cd: 432, when: c => c.d > 12,
            cast: c => S.boulderBarrage(c.yeti, { count: 6, interval: 14, area: 30, damage: 12, radius: 3, flightTicks: 12, slow: [60, 2], arc: 5 })
        },
        {
            name: 'glacierRift', tier: 2, cd: 380, when: c => c.d > 12,
            cast: c => S.glacierRift(c.yeti, c.target, { steps: 10, spacing: 2.5, stepDelay: 4, radius: 2.5, damage: 18, launch: 1.4 })
        },
        {
            name: 'iceChains', tier: 2, cd: 410, when: c => c.d > 8,
            cast: c => S.iceChains(c.yeti, c.target, { bindTicks: 100, slow: 6, weak: 3, damage: 6, damageEvery: 20, pullDamage: 10, pullPower: 2.5, range: 30 })
        },
        {
            name: 'polarVortex', tier: 2, cd: 3300, when: c => c.d > 8,
            cast: c => S.polarVortex(c.yeti, { durationTicks: 240, radius: 18, pull: 1, damage: 10, damageEvery: 16, slow: [50, 5] })
        },
        {
            name: 'glacialWave', tier: 2, cd: 365, when: c => c.d <= 10,
            cast: c => S.glacialWave(c.yeti, { rings: 12, ringStep: 2.2, ringDelay: 7, damage: 15, knock: [2.5, 0.7] })
        },
        {
            name: 'frostNova', tier: 2, cd: 1200, when: c => c.d <= 8,
            cast: c => S.frostNova(c.yeti, { from: 2, to: 16, step: 2, ringDelay: 10, damage: 16, knock: [3, 0.8] })
        },
        {
            name: 'frostRoar', tier: 2, cd: 410, when: c => c.d <= 6,
            cast: c => S.frostRoar(c.yeti, { rings: 9, ringStep: 2.5, ringDelay: 7, damage: r => Math.max(20 - Math.floor(r / 22 * 8), 10), slow: [160, 4], knock: [0.8, 0.4] })
        }
    ],
    onDeath: dead => { armorActive.delete(dead.id); }
});

// Giáp Băng: phản 30% sát thương người chơi gây ra cho Yeti
world.afterEvents.entityHurt.subscribe(e => {
    const yeti = e.hurtEntity;
    if (!yeti || yeti.typeId !== ID || !armorActive.has(yeti.id)) return;
    const attacker = e.damageSource?.damagingEntity;
    if (!attacker || attacker.typeId !== 'minecraft:player') return;
    const reflect = e.damage * 0.3;
    system.runTimeout(() => {
        try {
            attacker.applyDamage(reflect);
            effect(attacker, 'slowness', 60, 1);
            fx(attacker.dimension, FX.shards, attacker.location, { radius: 0.6 });
        } catch (_) {}
    }, 1);
});
