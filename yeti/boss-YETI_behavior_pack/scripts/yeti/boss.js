// File: scripts/yeti/boss.js
// "Bộ não" Yeti Boss v2.0 - thay cho yeti_phase1/2/3.js + yeti_boss_skill.js + yeti_spike_charge.js cũ.
//
// Cách hoạt động:
// - Quét Yeti quanh người chơi (mọi dimension) mỗi 10 tick, suy nghĩ mỗi 2 tick.
// - Mỗi lần chỉ thi triển 1 chiêu (khoá "bận" theo độ dài chiêu) + nghỉ ngắn giữa 2 chiêu,
//   nên chiêu không còn chồng chéo loạn xạ như bản cũ (bản cũ có thể tung 4-5 chiêu cùng 1 tick).
// - Chọn chiêu theo khoảng cách tới mục tiêu, % máu, hồi chiêu và trọng số (tránh lặp lại chiêu vừa dùng).
// - Chiêu "ưu tiên" (hồi máu, giáp băng, Absolute Zero) được dùng ngay khi đủ điều kiện.
// - Chuyển pha: Yeti mới trồi lên + gầm (bất tử 3 giây), hiện tiêu đề cho người chơi xung quanh.
// - Dưới 35% máu: NỔI GIẬN (ra chiêu nhanh hơn, hồi chiêu ngắn hơn, lửa băng xanh quanh người).
// - Giữ nguyên các nội tại của bản cũ: giáp (giảm % sát thương từ người chơi), sát khí lạnh,
//   tự hồi máu khi không bị đánh, hồi 15% máu khi hạ gục người chơi, hiệu ứng khi đánh thường trúng.

import { world, system, EntityDamageCause, EntityInitializationCause } from "@minecraft/server";
import * as fx from "./fx";
import * as S from "./skills";

// ---------------------------------------------------------------- cấu hình từng pha

// kit: danh sách chiêu. cd = hồi chiêu (tick), min/max = khoảng cách tới mục tiêu (block),
// hp = chỉ dùng khi máu dưới tỉ lệ này, weight = trọng số khi chọn ngẫu nhiên,
// priority = dùng ngay khi đủ điều kiện (bỏ qua trọng số).
const PHASES = {
    "ytaun:yeti_1": {
        tier: 1,
        label: "§b§lYETI",
        range: 28,
        gcd: [34, 56],
        damage: 1.0,           // hệ số sát thương mọi chiêu (tăng/giảm để chỉnh độ khó)
        armor: 0.25,           // giảm 25% sát thương nhận từ người chơi
        handUp: 4.5, mouthUp: 5.0, mouthForward: 2.3,
        chill: { radius: 3, amplifier: 0 },
        onHit: { slowness: [1, 60] },
        kit: [
            { id: "frost_orb", fn: S.frostOrb, cd: 150, min: 6, max: 28, weight: 3 },
            { id: "leap_slam", fn: S.leapSlam, cd: 240, min: 8, max: 22, weight: 3 },
            { id: "frost_roar", fn: S.frostRoar, cd: 260, min: 0, max: 9, weight: 2 },
            { id: "freeze_ground", fn: S.freezeGround, cd: 280, min: 0, max: 6, weight: 2 },
            { id: "ice_spikes", fn: S.iceSpikes, cd: 240, min: 4, max: 16, weight: 3 },
            { id: "glacial_charge", fn: S.glacialCharge, cd: 260, min: 6, max: 16, weight: 3 },
            { id: "summon", fn: S.summonMinions, cd: 900, min: 0, max: 28, weight: 2, hp: 0.6 },
            { id: "ice_regen", fn: S.iceRegen, cd: 900, min: 0, max: 28, hp: 0.4, priority: true },
        ],
    },
    "ytaun:yeti_2": {
        tier: 2,
        label: "§3§lYETI TRƯỞNG THÀNH",
        subtitle: "§fPha 2 - Bão tuyết nổi lên!",
        range: 35,
        gcd: [28, 46],
        damage: 1.0,
        armor: 0.30,
        handUp: 4.8, mouthUp: 5.25, mouthForward: 2.45,
        chill: { radius: 4, amplifier: 0 },
        onHit: { slowness: [2, 70], weakness: [0, 60] },
        kit: [
            { id: "frost_orb", fn: S.frostOrb, cd: 150, min: 7, max: 30, weight: 3 },
            { id: "leap_slam", fn: S.leapSlam, cd: 220, min: 8, max: 22, weight: 2 },
            { id: "frost_roar", fn: S.frostRoar, cd: 260, min: 0, max: 9, weight: 2 },
            { id: "ice_spikes", fn: S.iceSpikes, cd: 240, min: 4, max: 16, weight: 2 },
            { id: "glacial_charge", fn: S.glacialCharge, cd: 240, min: 6, max: 16, weight: 3 },
            { id: "glacier_rift", fn: S.glacierRift, cd: 240, min: 6, max: 20, weight: 3 },
            { id: "glacial_wave", fn: S.glacialWave, cd: 300, min: 0, max: 14, weight: 3 },
            { id: "earthquake", fn: S.earthquake, cd: 360, min: 0, max: 10, weight: 2 },
            { id: "blizzard", fn: S.blizzard, cd: 520, min: 0, max: 22, weight: 2 },
            { id: "polar_vortex", fn: S.polarVortex, cd: 600, min: 4, max: 13, weight: 2, hp: 0.7 },
            { id: "elite_army", fn: S.eliteArmy, cd: 1100, min: 0, max: 35, weight: 2, hp: 0.6 },
            { id: "ice_regen", fn: S.iceRegen, cd: 1400, min: 0, max: 35, hp: 0.3, priority: true },
            { id: "absolute_zero", fn: S.absoluteZero, cd: 2400, min: 0, max: 20, hp: 0.25, priority: true },
        ],
    },
    "ytaun:yeti_3": {
        tier: 3,
        label: "§9§lYETI CỔ ĐẠI",
        subtitle: "§fPha 3 - Sức mạnh băng hà tối thượng!",
        range: 40,
        gcd: [22, 38],
        damage: 1.0,
        armor: 0.35,
        handUp: 4.8, mouthUp: 5.25, mouthForward: 2.45,
        chill: { radius: 5, amplifier: 1 },
        onHit: { slowness: [3, 80], weakness: [1, 70], mining_fatigue: [1, 60] },
        kit: [
            { id: "frost_orb", fn: S.frostOrb, cd: 160, min: 8, max: 30, weight: 2 },
            { id: "leap_slam", fn: S.leapSlam, cd: 220, min: 8, max: 22, weight: 2 },
            { id: "ice_spikes", fn: S.iceSpikes, cd: 240, min: 4, max: 16, weight: 2 },
            { id: "glacial_charge", fn: S.glacialCharge, cd: 240, min: 6, max: 16, weight: 2 },
            { id: "glacier_rift", fn: S.glacierRift, cd: 260, min: 6, max: 20, weight: 2 },
            { id: "glacial_wave", fn: S.glacialWave, cd: 320, min: 0, max: 16, weight: 2 },
            { id: "earthquake", fn: S.earthquake, cd: 380, min: 0, max: 11, weight: 1 },
            { id: "blizzard", fn: S.blizzard, cd: 560, min: 0, max: 24, weight: 2 },
            { id: "polar_vortex", fn: S.polarVortex, cd: 640, min: 4, max: 14, weight: 1 },
            { id: "ice_chains", fn: S.iceChains, cd: 280, min: 6, max: 16, weight: 3 },
            { id: "crystal_barrage", fn: S.crystalBarrage, cd: 320, min: 8, max: 26, weight: 3 },
            { id: "frost_nova", fn: S.frostNova, cd: 300, min: 0, max: 6, weight: 3 },
            { id: "frost_breath", fn: S.frostBreath, cd: 280, min: 3, max: 12, weight: 3 },
            { id: "frost_roar", fn: S.frostRoar, cd: 320, min: 0, max: 9, weight: 1 },
            { id: "elite_army", fn: S.eliteArmy, cd: 1200, min: 0, max: 40, weight: 2, hp: 0.7 },
            { id: "frost_armor", fn: S.frostArmor, cd: 900, min: 0, max: 40, hp: 0.6, priority: true },
            { id: "ice_regen", fn: S.iceRegen, cd: 2000, min: 0, max: 40, hp: 0.3, priority: true },
            { id: "absolute_zero", fn: S.absoluteZero, cd: 1800, min: 0, max: 22, hp: 0.3, priority: true },
        ],
    },
    // Dạng hấp hối: nửa người vùi trong băng, không di chuyển, máu thấp, tung chiêu liên tục
    "ytaun:yeti_death": {
        tier: 3,
        lastStand: true,
        label: "§4§lYETI HẤP HỐI",
        subtitle: "§fHạ gục nó để kết thúc trận chiến!",
        range: 24,
        gcd: [18, 30],
        damage: 1.0,
        armor: 0.35,
        handUp: 1.5, mouthUp: 0.4, mouthForward: 1.6,
        chill: { radius: 6, amplifier: 1 },
        onHit: { slowness: [4, 100], weakness: [2, 80], mining_fatigue: [2, 70], nausea: [0, 60] },
        kit: [
            { id: "pound", fn: S.lastStandPound, cd: 60, min: 0, max: 7, weight: 3 },
            { id: "nova", fn: S.lastStandNova, cd: 160, min: 0, max: 8, weight: 2 },
            { id: "blizzard", fn: S.lastStandBlizzard, cd: 200, min: 0, max: 24, weight: 2 },
            { id: "frost_orb", fn: S.frostOrb, cd: 90, min: 5, max: 24, weight: 3 },
        ],
    },
};

const ENRAGE_AT = 0.35;           // dưới 35% máu -> nổi giận
const KILL_HEAL_PERCENT = 0.15;   // hồi 15% máu tối đa khi hạ gục người chơi
const REGEN_DELAY = 120;          // 6 giây không bị đánh -> tự hồi máu
const REGEN_PERCENT = 0.02;       // 2% máu tối đa mỗi giây
const INTRO_TICKS = 60;           // chuyển pha: bất tử 3 giây trong lúc trồi lên + gầm

const bosses = new Map();         // id -> entity
const states = new Map();         // id -> trạng thái bộ não

function stateOf(boss) {
    let st = states.get(boss.id);
    if (!st) {
        const now = system.currentTick;
        st = { cds: {}, busyUntil: now, nextCast: now + 40, introUntil: 0, lastHurt: 0, lastPassive: 0,
               engaged: false, enraged: false, last: undefined, regen: undefined, armor: undefined };
        states.set(boss.id, st);
    }
    return st;
}

function forget(id) {
    bosses.delete(id);
    states.delete(id);
}

function healthOf(boss) {
    try {
        const h = boss.getComponent("minecraft:health");
        if (!h) return undefined;
        const max = h.effectiveMax > 0 ? h.effectiveMax : h.defaultValue;
        return { component: h, current: h.currentValue, max, ratio: max > 0 ? h.currentValue / max : 1 };
    } catch (_) {
        return undefined;
    }
}

function makeCtx(boss, target, cfg, st, skill) {
    return {
        boss, target, cfg, state: st, skill,
        tier: cfg.tier,
        power: cfg.damage,
        lock(ticks) {
            const now = system.currentTick;
            st.busyUntil = Math.max(st.busyUntil, now + ticks);
            st.nextCast = Math.max(st.nextCast, st.busyUntil + cfg.gcd[0]);
        },
    };
}

// ---------------------------------------------------------------- tìm Yeti + mục tiêu

/** Quét Yeti quanh từng người chơi (luôn ở chunk đã load, chạy được ở mọi dimension). */
function refreshBosses() {
    for (const player of world.getAllPlayers()) {
        let nearby = [];
        try { nearby = player.dimension.getEntities({ location: player.location, maxDistance: 64, families: ["ice"] }); } catch (_) {}
        for (const e of nearby) if (PHASES[e.typeId]) bosses.set(e.id, e);
    }
}

function pickTarget(boss, cfg) {
    const list = S.victims(boss.dimension, boss.location, cfg.range);
    if (list.length === 0) return undefined;
    list.sort((a, b) => fx.dist2D(a.location, boss.location) - fx.dist2D(b.location, boss.location));
    // nhiều người chơi: thỉnh thoảng nhắm người khác để không ai được "núp" sau đồng đội
    if (list.length > 1 && Math.random() < 0.25) return list[1 + Math.floor(Math.random() * (list.length - 1))];
    return list[0];
}

function chooseSkill(cfg, st, distance, hpRatio, now) {
    const ready = cfg.kit.filter(k =>
        now >= (st.cds[k.id] ?? 0) && distance >= k.min && distance <= k.max && (k.hp === undefined || hpRatio < k.hp));
    const urgent = ready.filter(k => k.priority);
    if (urgent.length) return urgent[Math.floor(Math.random() * urgent.length)];
    const pool = ready.filter(k => !k.priority);
    let total = 0;
    const weights = pool.map(k => {
        const w = (k.weight ?? 1) * (k.id === st.last ? 0.25 : 1);
        total += w;
        return w;
    });
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return pool[i];
    }
    return undefined;
}

// ---------------------------------------------------------------- vòng lặp suy nghĩ

function think(boss, now) {
    const cfg = PHASES[boss.typeId];
    const st = stateOf(boss);
    if (now - st.lastPassive >= 20) {
        st.lastPassive = now;
        passives(boss, cfg, st, now);
    }
    if (now < st.busyUntil || now < st.nextCast) return;

    const target = pickTarget(boss, cfg);
    if (!target) return;
    const hp = healthOf(boss);
    const ratio = hp ? hp.ratio : 1;

    if (!st.engaged) {
        st.engaged = true;
        if (!cfg.lastStand) return awaken(boss, cfg, st, target, now);
    }
    if (!st.enraged && !cfg.lastStand && ratio < ENRAGE_AT) {
        st.enraged = true;
        return enrage(boss, cfg, st, target, now);
    }

    const distance = fx.dist2D(boss.location, target.location);
    const skill = chooseSkill(cfg, st, distance, ratio, now);
    if (!skill) return;
    const ctx = makeCtx(boss, target, cfg, st, skill.id);
    let lock = 0;
    try { lock = skill.fn(ctx) ?? 0; } catch (e) { console.warn(`[Yeti] ${skill.id} lỗi:`, e); }
    if (lock <= 0) {
        st.cds[skill.id] = now + 100; // không thi triển được (ví dụ đã đủ lính) -> thử chiêu khác
        return;
    }
    const speed = st.enraged ? 0.75 : 1;
    st.cds[skill.id] = now + Math.round(skill.cd * speed);
    st.last = skill.id;
    st.busyUntil = Math.max(st.busyUntil, now + lock);
    const [a, b] = cfg.gcd;
    st.nextCast = st.busyUntil + Math.round((a + Math.random() * (b - a)) * (st.enraged ? 0.7 : 1));
}

/** Lần đầu thấy người chơi: gầm vang báo hiệu trận đấu bắt đầu. */
function awaken(boss, cfg, st, target, now) {
    fx.title(boss.dimension, boss.location, 40, cfg.label, "§fChúa tể băng giá đã thức tỉnh!");
    const ctx = makeCtx(boss, target, { ...cfg, tier: 1 }, st, "awaken");
    const lock = S.frostRoar(ctx);
    st.busyUntil = now + lock;
    st.nextCast = st.busyUntil + 20;
}

function enrage(boss, cfg, st, target, now) {
    const dim = boss.dimension;
    fx.title(dim, boss.location, 40, "§c§lYETI NỔI GIẬN!", "§fTốc độ ra chiêu tăng mạnh");
    fx.emit(dim, "yeti:light_beam", fx.add(boss.location, { x: 0, y: 4, z: 0 }), { radius: 10 });
    fx.ring(dim, boss.location, 3, 10, "yeti:ice_pillar", 0.1);
    const ctx = makeCtx(boss, target, cfg, st, "enrage");
    const lock = S.frostRoar(ctx);
    st.busyUntil = now + lock;
    st.nextCast = st.busyUntil + 10;
}

system.runInterval(() => {
    const now = system.currentTick;
    if (now % 10 === 0) refreshBosses();
    for (const [id, boss] of bosses) {
        if (!boss.isValid) {
            forget(id);
            continue;
        }
        try { think(boss, now); } catch (e) { console.warn("[Yeti] think:", e); }
    }
}, 2);

// ---------------------------------------------------------------- nội tại (mỗi giây)

function passives(boss, cfg, st, now) {
    const dim = boss.dimension;
    // Nội tại 1 - Sát Khí Lạnh: người chơi đứng gần bị làm chậm liên tục
    for (const p of S.victims(dim, boss.location, cfg.chill.radius)) {
        try { p.addEffect("slowness", 40, { amplifier: cfg.chill.amplifier, showParticles: false }); } catch (_) {}
        fx.emit(dim, "yeti:snowflake", fx.add(p.location, { x: 0, y: 1.2, z: 0 }));
    }
    // Nội tại 2 - Hồi Phục Băng Giá: 6 giây không trúng đòn thì tự hồi 2% máu/giây
    if (now - st.lastHurt >= REGEN_DELAY && !st.regen) {
        const hp = healthOf(boss);
        if (hp && hp.current < hp.max) {
            try { hp.component.setCurrentValue(Math.min(hp.max, hp.current + hp.max * REGEN_PERCENT)); } catch (_) {}
            fx.emit(dim, "yeti:heal", fx.add(boss.location, { x: 0, y: 0.3, z: 0 }));
        }
    }
}

// ---------------------------------------------------------------- chuyển pha / kết thúc

const PHASE_ORDER = ["ytaun:yeti_2", "ytaun:yeti_3", "ytaun:yeti_death"];

/** Yeti pha mới được summon (từ on:death của pha trước): trồi lên + gầm, bất tử trong lúc đó. */
function phaseIntro(boss) {
    const cfg = PHASES[boss.typeId];
    const st = stateOf(boss);
    const now = system.currentTick;
    st.introUntil = now + INTRO_TICKS;
    st.busyUntil = now + INTRO_TICKS;
    st.nextCast = now + INTRO_TICKS + 10;
    st.engaged = true;
    bosses.set(boss.id, boss);
    const dim = boss.dimension;
    const loc = boss.location;

    system.runTimeout(() => {
        if (!boss.isValid) return;
        S.playAnim(boss, cfg.lastStand ? "death_pound" : "phase_rise", 0.3);
        try { boss.addEffect("slowness", INTRO_TICKS, { amplifier: 8, showParticles: false }); } catch (_) {}
    }, 2);
    fx.title(dim, loc, 48, cfg.label, cfg.subtitle);
    fx.flash(dim, loc, 24, 0.1);
    fx.emit(dim, "yeti:light_beam", fx.add(loc, { x: 0, y: 6, z: 0 }), { radius: 16 });
    fx.emit(dim, "yeti:rune_circle", { x: loc.x, y: loc.y + 0.06, z: loc.z }, { radius: 5, life: 3 });
    fx.iceImpact(dim, loc, 5);
    fx.sound(dim, "mob.enderdragon.growl", loc, 2, 0.6);
    fx.sound(dim, "beacon.power", loc, 2, 0.6);
    fx.repeat(5, 6, () => {
        if (!boss.isValid) return;
        fx.ring(dim, boss.location, 3.5, 8, "yeti:ice_pillar", 0.1);
        fx.emit(dim, "yeti:charge_gather", fx.add(boss.location, { x: 0, y: cfg.handUp, z: 0 }));
    });
    // cú gầm trồi dậy (khớp mốc 1.5 giây của animation.yeti.phase_rise)
    system.runTimeout(() => {
        if (!boss.isValid) return;
        const c = boss.location;
        fx.sound(dim, "mob.ravager.roar", c, 3, 0.6);
        fx.shake(dim, c, 32, 0.8, 1.2);
        for (const r of [5, 9, 13]) fx.emit(dim, "yeti:frost_ring", { x: c.x, y: c.y + 0.1, z: c.z }, { radius: r });
        fx.ring(dim, c, 6, 12, "yeti:frost_mist", 1);
        for (const p of S.victims(dim, c, 7)) {
            try { p.applyKnockback({ x: fx.dirXZ(c, p.location).x * 2, z: fx.dirXZ(c, p.location).z * 2 }, 0.5); } catch (_) {}
        }
    }, cfg.lastStand ? 14 : 30);
}

/** Yeti hấp hối bị hạ: băng vỡ tung, tiêu đề chiến thắng, lính băng tan biến. */
function finale(dim, loc) {
    fx.title(dim, loc, 64, "§b§l❄ CHIẾN THẮNG ❄", "§fYeti đã bị đánh bại!");
    fx.flash(dim, loc, 32, 0.3);
    fx.shake(dim, loc, 32, 0.6, 1.0);
    fx.iceImpact(dim, loc, 8);
    for (let i = 0; i < 4; i++) {
        fx.emit(dim, "yeti:ice_shard", fx.add(loc, { x: 0, y: 1 + i, z: 0 }));
        fx.emit(dim, "yeti:light_beam", fx.add(loc, { x: Math.cos(i * 1.57) * 3, y: 5, z: Math.sin(i * 1.57) * 3 }), { radius: 12 });
    }
    fx.sound(dim, "random.glass", loc, 3, 0.5);
    fx.sound(dim, "mob.irongolem.death", loc, 2, 0.5);
    for (const p of fx.playersNear(dim, loc, 64)) fx.sound(dim, "random.levelup", p.location, 1, 0.8);
    let minions = [];
    try { minions = dim.getEntities({ location: loc, maxDistance: 48, tags: [S.MINION_TAG] }); } catch (_) {}
    minions.forEach((m, i) => {
        system.runTimeout(() => {
            if (!m.isValid) return;
            fx.emit(dim, "yeti:ice_shard", fx.add(m.location, { x: 0, y: 1, z: 0 }));
            fx.emit(dim, "yeti:frost_mist", fx.add(m.location, { x: 0, y: 1, z: 0 }));
            try { m.kill(); } catch (_) {}
        }, 10 + i * 3);
    });
}

// ---------------------------------------------------------------- sự kiện

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    try {
        // chỉ khi pha mới vừa được summon/đẻ trứng, không phải khi chunk load lại
        if (cause === EntityInitializationCause.Loaded) return;
        if (!entity?.isValid || !PHASE_ORDER.includes(entity.typeId)) return;
        phaseIntro(entity);
    } catch (e) {
        console.warn("[Yeti] phaseIntro:", e);
    }
});

const attackerOf = (source) => {
    const e = source?.damagingEntity;
    return e?.typeId === "minecraft:player" ? e : undefined;
};

// Giáp + bất tử khi chuyển pha: giảm thẳng sát thương trước khi trúng (không làm nhảy thanh máu)
const hasBeforeHurt = !!world.beforeEvents?.entityHurt;
if (hasBeforeHurt) {
    world.beforeEvents.entityHurt.subscribe((event) => {
        const cfg = PHASES[event.hurtEntity.typeId];
        if (!cfg) return;
        const st = states.get(event.hurtEntity.id);
        if (st && system.currentTick < st.introUntil) {
            event.cancel = true;
            return;
        }
        if (!attackerOf(event.damageSource)) return;
        event.damage = event.damage * (1 - cfg.armor) * (st?.armor ? 0.5 : 1);
    });
}

world.afterEvents.entityHurt.subscribe((event) => {
    const boss = event.hurtEntity;
    const cfg = PHASES[boss?.typeId];
    if (!cfg) return;
    const st = stateOf(boss);
    st.lastHurt = system.currentTick;
    bosses.set(boss.id, boss);
    const attacker = attackerOf(event.damageSource);
    if (!attacker || event.damage <= 0) return;

    // Bản không có beforeEvents.entityHurt: giáp mô phỏng bằng cách hồi lại % sát thương (như bản cũ)
    if (!hasBeforeHurt) {
        const hp = healthOf(boss);
        if (hp) try { hp.component.setCurrentValue(Math.min(hp.max, hp.current + event.damage * cfg.armor)); } catch (_) {}
    }

    const ctx = makeCtx(boss, attacker, cfg, st, "counter");
    // Phá vỏ băng khi Yeti đang hồi máu
    if (st.regen) {
        st.regen.damage += event.damage;
        if (st.regen.damage >= st.regen.threshold) S.breakRegenShell(ctx);
    }
    // Giáp Băng: phản sát thương cận chiến + đếm đòn để phá giáp
    if (st.armor && event.damageSource.cause === EntityDamageCause.entityAttack) {
        const armor = st.armor;
        armor.hits++;
        system.run(() => {
            if (!attacker.isValid || !boss.isValid) return;
            try { attacker.applyDamage(Math.max(1, event.damage * 0.25), { cause: EntityDamageCause.thorns, damagingEntity: boss }); } catch (_) {}
            try { attacker.addEffect("slowness", 40, { amplifier: 1 }); } catch (_) {}
            fx.emit(attacker.dimension, "yeti:ice_shard", fx.add(attacker.location, { x: 0, y: 1, z: 0 }));
            try { attacker.onScreenDisplay.setActionBar(`§b❄ Giáp Băng: §e${Math.min(armor.hits, armor.maxHits)}§f/${armor.maxHits}`); } catch (_) {}
        });
        if (armor.hits >= armor.maxHits) S.breakArmor(ctx);
    }
});

// Đánh thường (cận chiến vanilla) trúng người chơi: hiệu ứng theo pha + mảnh băng
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    try {
        const cfg = PHASES[damagingEntity?.typeId];
        if (!cfg || hitEntity?.typeId !== "minecraft:player") return;
        for (const [effect, [amplifier, duration]] of Object.entries(cfg.onHit)) {
            hitEntity.addEffect(effect, duration, { amplifier, showParticles: true });
        }
        fx.hitFx(hitEntity.dimension, hitEntity.location);
    } catch (_) {}
});

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
        const cfg = PHASES[deadEntity?.typeId];
        if (cfg) {
            const dim = deadEntity.dimension, loc = deadEntity.location;
            forget(deadEntity.id);
            fx.iceImpact(dim, loc, 4);
            fx.sound(dim, "random.glass", loc, 2, 0.6);
            if (cfg.lastStand) finale(dim, loc);
            return;
        }
        // Người chơi bị Yeti (đòn đánh hoặc chiêu) hạ gục -> Yeti hồi 15% máu tối đa
        if (deadEntity?.typeId !== "minecraft:player") return;
        const killer = damageSource?.damagingEntity;
        if (!killer?.isValid || !PHASES[killer.typeId]) return;
        const hp = healthOf(killer);
        if (!hp) return;
        hp.component.setCurrentValue(Math.min(hp.max, hp.current + hp.max * KILL_HEAL_PERCENT));
        fx.emit(killer.dimension, "yeti:heal", killer.location);
        fx.ring(killer.dimension, killer.location, 1.8, 10, "yeti:sparkle", 2);
        fx.sound(killer.dimension, "random.levelup", killer.location, 1, 1.2);
        world.sendMessage(`§b❄ ${PHASES[killer.typeId].label} §rđã hạ gục một người chơi và hồi phục §a${Math.round(KILL_HEAL_PERCENT * 100)}% §rmáu tối đa!`);
    } catch (e) {
        console.warn("[Yeti] entityDie:", e);
    }
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => forget(removedEntityId));

system.run(() => {
    try { world.sendMessage("§b§l[Yeti Boss v2.0] §rĐã tải bộ kỹ năng nâng cấp!"); } catch (_) {}
});

console.warn("[Yeti Boss] v2.0 loaded!");
