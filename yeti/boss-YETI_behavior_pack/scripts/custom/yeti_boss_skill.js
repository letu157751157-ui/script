import { world, system } from '@minecraft/server';
import { ANIM, FX, fx, playAnim, shatter, telegraph, groundAt, recentSkillAttacker } from './yeti_fx';
import { phaseIntro } from './yeti_skills';

// === YETI BOSS - SKILL THEO PHA (yeti_1 → yeti_2 → yeti_3 → yeti_death) ===
// Pha sau kế thừa toàn bộ chiêu của pha trước, cooldown ngắn hơn + hiệu ứng mạnh hơn,
// và có thêm 1 chiêu mới riêng.
// Kích hoạt: (1) tự động theo chu kỳ thời gian  (2) khi Yeti đánh trúng người chơi
// Ngoài ra: hồi máu khi hạ gục người chơi, và 2 nội tại đặc biệt luôn hoạt động.
//
// FIX: tìm Yeti quanh từng người chơi (giống frozen_sword_skill.js) thay vì quét
// toàn bộ dimension theo type - cách cũ có thể không trả kết quả trên một số server.
//
// v1.3: particle băng mới cho các chiêu của yeti_death và nội tại, animation giật mình
// (animation.ytaun_yeti_death.pulse) khi yeti_death tung chiêu, màn xuất hiện hoành tráng
// khi mỗi pha mới được triệu hồi, và tính cả chiêu (không chỉ đòn đánh thường) cho nội tại
// "hồi máu khi hạ gục người chơi".

const KILL_HEAL_PERCENT = 0.15; // hồi 15% máu tối đa khi giết được người chơi
const SEARCH_RADIUS = 32;       // bán kính tìm Yeti quanh người chơi

// -------------------- GIÁP (giảm % sát thương nhận từ người chơi) --------------------
// Bedrock không có stat "giáp" cho mob thường, nên mô phỏng bằng cách hồi lại ngay
// đúng % sát thương vừa nhận trong afterEvents.entityHurt (né được combat log âm/không rõ nguồn).
// Tăng dần theo độ nguy hiểm của từng pha, trong khoảng cân bằng 25-35%.
const ARMOR_CONFIG = {
    'ytaun:yeti_1':     0.25, // 25%
    'ytaun:yeti_2':     0.30, // 30%
    'ytaun:yeti_3':     0.35, // 35%
    'ytaun:yeti_death': 0.35  // 35%
};

// -------------------- CẤU HÌNH THEO PHA (chiêu chủ động + on-hit) --------------------
const PHASE_CONFIG = {
    'ytaun:yeti_1': {
        label: '§7Yeti',
        periodicCooldownMs: 8000,
        periodic: [], // yeti_1 giờ dùng yeti_phase1.js (đầy đủ skill + Gai Băng / Lao Đánh)
        onHit: { slowness: { amplifier: 1, duration: 60 } }
    },
    'ytaun:yeti_2': {
        label: '§bYeti Trưởng Thành',
        periodicCooldownMs: 7000,
        periodic: [], // yeti_2 giờ dùng yeti_phase2.js (đầy đủ skill + Gai Băng / Lao Đánh)
        onHit: {
            slowness: { amplifier: 2, duration: 70 },
            weakness: { amplifier: 0, duration: 60 }
        }
    },
    'ytaun:yeti_3': {
        label: '§3Yeti Cổ Đại',
        periodicCooldownMs: 6000,
        periodic: [], // yeti_3 giờ dùng yeti_phase3.js (đầy đủ skill + Gai Băng / Lao Đánh)
        onHit: {
            slowness: { amplifier: 3, duration: 80 },
            weakness: { amplifier: 1, duration: 70 },
            mining_fatigue: { amplifier: 1, duration: 60 }
        }
    },
    'ytaun:yeti_death': {
        label: '§4§lYeti',
        periodicCooldownMs: 4500,
        periodic: ['ice_stomp', 'frost_nova', 'blizzard_fury'],
        onHit: {
            slowness: { amplifier: 4, duration: 100 },
            weakness: { amplifier: 2, duration: 80 },
            mining_fatigue: { amplifier: 2, duration: 70 },
            nausea: { amplifier: 0, duration: 60 }
        }
    }
};

// -------------------- CẤU HÌNH NỘI TẠI (passive, luôn hoạt động, không cooldown) --------------------

// Nội tại 1 - "Sát Khí Lạnh": người chơi đứng gần Yeti bị làm chậm liên tục, không cần bị đánh trúng
const CHILL_AURA_CONFIG = {
    'ytaun:yeti_1':     { radius: 4, amplifier: 0 }, // v1.3: 3 -> 4 (gộp "Frost Aura" riêng của yeti_phase1.js cũ)
    'ytaun:yeti_2':     { radius: 4, amplifier: 0 },
    'ytaun:yeti_3':     { radius: 5, amplifier: 1 },
    'ytaun:yeti_death': { radius: 6, amplifier: 1 }
};

// Nội tại 2 - "Hồi Phục Băng Giá": tự hồi máu dần nếu không trúng đòn trong REGEN_DELAY_MS
const REGEN_DELAY_MS = 6000;   // 6 giây không bị đánh trúng thì bắt đầu hồi
const REGEN_PERCENT  = 0.02;   // hồi 2% máu tối đa mỗi nhịp nội tại (mỗi giây)

const lastPeriodicCast = new Map(); // entity.id → timestamp lần dùng chiêu chu kỳ gần nhất
const lastDamagedAt    = new Map(); // entity.id → timestamp lần cuối Yeti bị đánh trúng

// -------------------- TIỆN ÍCH --------------------

function ringParticle(dimension, center, radius, count, particleId, yOffset = 0.1) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        try {
            dimension.spawnParticle(particleId, {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + yOffset,
                z: center.z + Math.sin(angle) * radius
            });
        } catch (_) {}
    }
}

function getNearbyPlayers(yeti, radius) {
    try {
        return yeti.dimension.getEntities({
            location: yeti.location,
            maxDistance: radius,
            type: 'minecraft:player'
        });
    } catch (_) {
        return [];
    }
}

function applyKnockback(yeti, target, strength = 1.2) {
    try {
        const dx = target.location.x - yeti.location.x;
        const dz = target.location.z - yeti.location.z;
        const dist = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
        // FIX: applyKnockback() chỉ nhận 2 tham số (vector lực {x,z} + lực dọc),
        // không phải 4 tham số như trước.
        target.applyKnockback({ x: (dx / dist) * strength, z: (dz / dist) * strength }, 0.4);
    } catch (_) {}
}

// Quét Yeti quanh TẤT CẢ người chơi đang online (giống cách frozen_sword_skill.js
// đang dùng world.getAllPlayers() + dimension.getEntities({location, maxDistance})).
// Cách này chắc chắn hoạt động vì player luôn ở chunk đã load, khác với quét cả
// dimension theo "type" có thể trả về rỗng trên một số phiên bản/server.
function findActiveYetis() {
    const found = new Map(); // entity.id → entity (khử trùng lặp nếu nhiều người chơi cùng thấy 1 Yeti)

    for (const player of world.getAllPlayers()) {
        let nearby;
        try {
            nearby = player.dimension.getEntities({
                location: player.location,
                maxDistance: SEARCH_RADIUS
            });
        } catch (_) {
            continue;
        }

        for (const entity of nearby) {
            if (!entity || !PHASE_CONFIG[entity.typeId]) continue;
            found.set(entity.id, entity);
        }
    }

    return found;
}

// -------------------- CHIÊU CHU KỲ --------------------

// Ice Stomp: đập đất, đóng băng + đẩy lùi người chơi quanh Yeti
function castIceStomp(yeti) {
    try {
        const loc = yeti.location;
        playAnim(yeti, ANIM.deathPulse, 0.2);
        shatter(yeti.dimension, loc, 3);
        fx(yeti.dimension, FX.shockwave, groundAt(yeti.dimension, loc), { radius: 4.5 });
        ringParticle(yeti.dimension, loc, 2.0, 12, 'minecraft:snowflake_particle');
        yeti.dimension.playSound('ambient.weather.thunder', loc, { pitch: 1.4, volume: 1.0 });

        for (const player of getNearbyPlayers(yeti, 4.5)) {
            player.addEffect('slowness', 60, { amplifier: 2, showParticles: true });
            applyKnockback(yeti, player, 1.0);
            try { player.runCommand('camerashake add @s 0.4 0.3 positional'); } catch (_) {}
        }
    } catch (e) {
        console.warn('[Yeti Boss] IceStomp error:', e);
    }
}

// Frost Nova: xung băng lan tỏa, gây mining_fatigue + damage nhẹ
function castFrostNova(yeti) {
    try {
        const loc = yeti.location;
        playAnim(yeti, ANIM.deathPulse, 0.2);
        fx(yeti.dimension, FX.beam, loc);
        telegraph(yeti.dimension, loc, 6, 0.6, true);
        for (let r = 2; r <= 6; r += 2) {
            system.runTimeout(() => {
                try {
                    fx(yeti.dimension, FX.shockwave, groundAt(yeti.dimension, loc), { radius: r });
                    ringParticle(yeti.dimension, loc, r, 4 + r, 'minecraft:snowflake_particle', 0.6);
                } catch (_) {}
            }, r * 2);
        }
        yeti.dimension.playSound('ambient.weather.thunder', loc, { pitch: 1.6, volume: 0.8 });

        for (const player of getNearbyPlayers(yeti, 6)) {
            player.addEffect('mining_fatigue', 100, { amplifier: 1, showParticles: false });
            try { player.applyDamage(3); } catch (_) {}
        }
    } catch (e) {
        console.warn('[Yeti Boss] FrostNova error:', e);
    }
}

// Blizzard Fury: bão tuyết diện rộng, gây mù tuyết + làm chậm mạnh + sát thương liên tục
function castBlizzardFury(yeti) {
    try {
        const loc = yeti.location;
        yeti.dimension.playSound('ambient.weather.thunder', loc, { pitch: 0.9, volume: 1.5 });
        playAnim(yeti, ANIM.deathPulse, 0.2);
        telegraph(yeti.dimension, loc, 7, 2.2, false);
        fx(yeti.dimension, FX.swirl, loc, { radius: 6 });
        fx(yeti.dimension, FX.snow, loc, { radius: 3 });

        let tick = 0;
        const blizzardTimer = system.runInterval(() => {
            tick++;
            try {
                if (!yeti.isValid) { system.clearRun(blizzardTimer); return; }
                fx(yeti.dimension, FX.swirl, yeti.location, { radius: 3 + tick });
                ringParticle(yeti.dimension, yeti.location, 6, 16, 'minecraft:snowflake_particle', 1.0);
                for (const player of getNearbyPlayers(yeti, 7)) {
                    player.addEffect('slowness', 40, { amplifier: 3, showParticles: true });
                    player.addEffect('blindness', 30, { amplifier: 0, showParticles: false });
                    try { player.applyDamage(2); } catch (_) {}
                    try { player.runCommand('camerashake add @s 0.3 0.4 positional'); } catch (_) {}
                }
            } catch (_) {}
            if (tick >= 4) system.clearRun(blizzardTimer);
        }, 10);
    } catch (e) {
        console.warn('[Yeti Boss] BlizzardFury error:', e);
    }
}

const SKILLS = {
    ice_stomp: castIceStomp,
    frost_nova: castFrostNova,
    blizzard_fury: castBlizzardFury
};

// -------------------- HỒI MÁU KHI GIẾT NGƯỜI CHƠI --------------------

function getMaxHealth(healthComponent) {
    const max = healthComponent.effectiveMax;
    if (typeof max === 'number' && Number.isFinite(max) && max > 0) return max;
    const fallback = healthComponent.defaultValue;
    if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) return fallback;
    return 20; // fallback an toàn cuối cùng
}

function healOnKill(yeti) {
    try {
        const health = yeti.getComponent('minecraft:health');
        if (!health) return;

        const maxHealth = getMaxHealth(health);
        const healAmount = maxHealth * KILL_HEAL_PERCENT;
        const newValue = Math.min(maxHealth, health.currentValue + healAmount);

        if (!Number.isFinite(newValue)) return;
        health.setCurrentValue(newValue);

        fx(yeti.dimension, FX.heal, yeti.location, { radius: 2 });
        fx(yeti.dimension, FX.beam, yeti.location);
        yeti.dimension.playSound('random.levelup', yeti.location, { pitch: 1.2, volume: 1.0 });

        const config = PHASE_CONFIG[yeti.typeId];
        if (config) {
            world.sendMessage(`§b❄ ${config.label} §rđã hạ gục một người chơi và hồi phục §a${Math.round(KILL_HEAL_PERCENT * 100)}% §rmáu tối đa!`);
        }
    } catch (e) {
        console.warn('[Yeti Boss] healOnKill error:', e);
    }
}

// -------------------- NỘI TẠI 1: SÁT KHÍ LẠNH (chill aura quanh Yeti) --------------------

function tickChillAura(yetis) {
    for (const yeti of yetis) {
        try {
            if (!yeti.isValid) continue;
            const cfg = CHILL_AURA_CONFIG[yeti.typeId];
            if (!cfg) continue;

            const players = getNearbyPlayers(yeti, cfg.radius + 8);
            if (players.length === 0) continue;
            // vòng hạt băng bay lên ở rìa vùng Sát Khí Lạnh (chỉ hiện khi có người chơi ở gần)
            fx(yeti.dimension, FX.aura, yeti.location, { radius: cfg.radius });
            for (const player of getNearbyPlayers(yeti, cfg.radius)) {
                player.addEffect('slowness', 40, { amplifier: cfg.amplifier, showParticles: false });
            }
        } catch (e) {
            console.warn('[Yeti Boss] ChillAura error:', e);
        }
    }
}

// -------------------- NỘI TẠI 2: HỒI PHỤC BĂNG GIÁ (tự hồi máu khi không bị đánh) --------------------

function tickFrostRegen(yetis) {
    const now = Date.now();
    for (const yeti of yetis) {
        try {
            if (!yeti.isValid) continue;

            const lastHit = lastDamagedAt.get(yeti.id) ?? 0;
            if (now - lastHit < REGEN_DELAY_MS) continue;

            const health = yeti.getComponent('minecraft:health');
            if (!health) continue;

            const max = getMaxHealth(health);
            if (health.currentValue >= max) continue;

            const newValue = Math.min(max, health.currentValue + max * REGEN_PERCENT);
            if (!Number.isFinite(newValue)) continue;

            health.setCurrentValue(newValue);
            fx(yeti.dimension, FX.heal, yeti.location, { radius: 1.2 });
        } catch (e) {
            console.warn('[Yeti Boss] FrostRegen error:', e);
        }
    }
}

// -------------------- VÒNG LẶP CHÍNH (chiêu chủ động + nội tại) --------------------

system.runInterval(() => {
    const yetiMap = findActiveYetis();
    if (yetiMap.size === 0) return;

    const yetis = [...yetiMap.values()];
    const now = Date.now();

    // Chiêu chủ động theo chu kỳ
    for (const yeti of yetis) {
        const config = PHASE_CONFIG[yeti.typeId];
        if (!config) continue;

        const last = lastPeriodicCast.get(yeti.id) ?? 0;
        if (now - last < config.periodicCooldownMs) continue;

        const skillName = config.periodic[Math.floor(Math.random() * config.periodic.length)];
        const castFn = SKILLS[skillName];
        if (castFn) {
            castFn(yeti);
            lastPeriodicCast.set(yeti.id, now);
        }
    }

    // Nội tại - luôn chạy song song, không cooldown riêng
    tickChillAura(yetis);
    tickFrostRegen(yetis);
}, 20); // mỗi giây (20 tick)

// -------------------- CHIÊU KHI ĐÁNH TRÚNG NGƯỜI CHƠI --------------------

world.afterEvents.entityHitEntity.subscribe(event => {
    try {
        const attacker = event.damagingEntity;
        const target = event.hitEntity;
        if (!attacker || !target) return;
        if (target.typeId !== 'minecraft:player') return;

        const config = PHASE_CONFIG[attacker.typeId];
        if (!config) return;

        for (const [effectName, opts] of Object.entries(config.onHit)) {
            target.addEffect(effectName, opts.duration, { amplifier: opts.amplifier, showParticles: true });
        }

        fx(target.dimension, FX.shards, target.location, { radius: 0.6 });
        fx(target.dimension, 'minecraft:snowflake_particle', target.location);
        // (Đã bỏ thông báo actionbar theo yêu cầu)
    } catch (e) {
        console.warn('[Yeti Boss] onHit error:', e);
    }
});

// -------------------- THEO DÕI THỜI ĐIỂM YETI BỊ ĐÁNH TRÚNG (phục vụ nội tại Hồi Phục Băng Giá) --------------------

world.afterEvents.entityHurt.subscribe(event => {
    const entity = event.hurtEntity;
    if (!entity || !PHASE_CONFIG[entity.typeId]) return;

    lastDamagedAt.set(entity.id, Date.now());

    // ---- Giáp: hồi lại % sát thương vừa nhận từ người chơi ----
    try {
        const armorPercent = ARMOR_CONFIG[entity.typeId];
        const attacker = event.damageSource?.damagingEntity;
        if (armorPercent && event.damage > 0 && attacker?.typeId === 'minecraft:player') {
            const health = entity.getComponent('minecraft:health');
            if (health) {
                const maxHealth = getMaxHealth(health);
                const reduceAmount = event.damage * armorPercent;
                const newValue = Math.min(maxHealth, health.currentValue + reduceAmount);
                if (Number.isFinite(newValue)) health.setCurrentValue(newValue);
            }
        }
    } catch (e) {
        console.warn('[Yeti Boss] armor reduce error:', e);
    }
});

// -------------------- DỌN DẸP KHI YETI CHẾT + HỒI MÁU KHI GIẾT ĐƯỢC NGƯỜI CHƠI --------------------

world.afterEvents.entityDie.subscribe(event => {
    const { deadEntity, damageSource } = event;

    // Yeti chết → dọn dẹp dữ liệu theo dõi
    if (deadEntity && PHASE_CONFIG[deadEntity.typeId]) {
        lastPeriodicCast.delete(deadEntity.id);
        lastDamagedAt.delete(deadEntity.id);
    }

    // Người chơi chết dưới tay Yeti (đòn đánh thường HOẶC chiêu) → Yeti hồi 15% máu tối đa
    if (deadEntity && deadEntity.typeId === 'minecraft:player') {
        let killer = damageSource?.damagingEntity;
        if (!killer || !PHASE_CONFIG[killer.typeId]) killer = recentSkillAttacker(deadEntity);
        if (killer && killer.isValid && PHASE_CONFIG[killer.typeId]) {
            healOnKill(killer);
        }
    }
});

// -------------------- MÀN XUẤT HIỆN KHI TRIỆU HỒI / CHUYỂN PHA (v1.3) --------------------

const PHASE_INTRO = {
    'ytaun:yeti_1': { title: '§b§lYETI', subtitle: '§7Chúa tể núi tuyết đã thức giấc' },
    'ytaun:yeti_2': { title: '§3§lYETI TRƯỞNG THÀNH', subtitle: '§7Pha 2 - Băng giá dữ dội hơn' },
    'ytaun:yeti_3': { title: '§9§lYETI CỔ ĐẠI', subtitle: '§7Pha 3 - Cơn thịnh nộ của băng hà' }
};

world.afterEvents.entitySpawn.subscribe(event => {
    const entity = event.entity;
    if (!entity || String(event.cause) === 'Loaded') return;
    try {
        const info = PHASE_INTRO[entity.typeId];
        if (info) {
            phaseIntro(entity, info);
        } else if (entity.typeId === 'ytaun:yeti_death') {
            system.runTimeout(() => {
                try {
                    if (!entity.isValid) return;
                    playAnim(entity, ANIM.deathPulse, 0.2);
                    fx(entity.dimension, FX.beam, entity.location);
                    shatter(entity.dimension, entity.location, 3);
                    for (const p of getNearbyPlayers(entity, 64)) {
                        p.onScreenDisplay.setTitle('§4§lYETI', { subtitle: '§7Nó vẫn chưa chết hẳn...', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
                    }
                } catch (_) {}
            }, 2);
        }
    } catch (e) {
        console.warn('[Yeti Boss] intro error:', e);
    }
});

// -------------------- THÔNG BÁO KHI SCRIPT TẢI THÀNH CÔNG --------------------

system.run(() => {
    try {
        world.sendMessage('§b§l[Yeti Boss] §rScript kỹ năng đã tải thành công!');
    } catch (_) {}
});

console.warn('[Yeti Boss] Skills loaded!');
