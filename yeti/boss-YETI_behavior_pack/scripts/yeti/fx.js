// File: scripts/yeti/fx.js
// Hiệu ứng dùng chung cho Yeti Boss: particle băng (yeti:*), âm thanh, rung màn hình, vòng cảnh báo...
//
// Mọi hàm đều bọc try/catch: chiêu tầm xa có thể chạm tới chunk chưa load
// (LocationInUnloadedChunkError) và không được làm dừng cả chiêu giữa chừng.

import { system, MolangVariableMap } from "@minecraft/server";

export const TICKS = 20;

// ---------------------------------------------------------------- vector nhỏ gọn

export function add(a, b, s = 1) {
    return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

export function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Hướng ngang (đã chuẩn hoá) từ a tới b. */
export function dirXZ(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    return len < 1e-4 ? { x: 0, y: 0, z: 1 } : { x: dx / len, y: 0, z: dz / len };
}

export function normalize(v) {
    const len = Math.hypot(v.x, v.y, v.z);
    return len < 1e-6 ? { x: 0, y: 0, z: 1 } : { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Xoay vector ngang một góc (độ) quanh trục Y. */
export function rotateY(v, degrees) {
    const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}

/** Góc (độ) để particle nằm trên mặt đất quay mũi tên theo hướng dir. */
export function yawOf(dir) {
    return Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ---------------------------------------------------------------- particle

/**
 * Phát 1 particle, kèm biến Molang (không bắt buộc):
 * radius, life (giây), yaw (độ), speed, dir {x,y,z}.
 */
export function emit(dimension, id, loc, vars) {
    try {
        if (!vars) {
            dimension.spawnParticle(id, loc);
            return;
        }
        const molang = new MolangVariableMap();
        if (vars.radius !== undefined) molang.setFloat("variable.radius", vars.radius);
        if (vars.life !== undefined) molang.setFloat("variable.life", vars.life);
        if (vars.yaw !== undefined) molang.setFloat("variable.yaw", vars.yaw);
        if (vars.speed !== undefined) molang.setFloat("variable.speed", vars.speed);
        if (vars.dir) {
            molang.setFloat("variable.dir_x", vars.dir.x);
            molang.setFloat("variable.dir_y", vars.dir.y);
            molang.setFloat("variable.dir_z", vars.dir.z);
        }
        dimension.spawnParticle(id, loc, molang);
    } catch (_) {}
}

/** Rải particle đều trên một vòng tròn nằm ngang. */
export function ring(dimension, center, radius, count, id, yOffset = 0.1, vars) {
    for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count;
        emit(dimension, id, { x: center.x + Math.cos(a) * radius, y: center.y + yOffset, z: center.z + Math.sin(a) * radius }, vars);
    }
}

/** Mặt đất ngay dưới (x, z), tìm trong khoảng y+3 xuống y-9. Không thấy thì giữ nguyên y. */
export function groundAt(dimension, loc) {
    try {
        const hit = dimension.getBlockFromRay(
            { x: loc.x, y: loc.y + 3, z: loc.z }, { x: 0, y: -1, z: 0 },
            { maxDistance: 12, includeLiquidBlocks: true, includePassableBlocks: false });
        if (hit) return { x: loc.x, y: hit.block.location.y + 1, z: loc.z };
    } catch (_) {}
    return { x: loc.x, y: loc.y, z: loc.z };
}

/**
 * Có khối cứng chắn trên đoạn đường từ `from` theo `dir` dài `distance` không (đạn băng, cú lao).
 * Bỏ qua cỏ, hoa, đuốc... (khối đi xuyên qua được) và chất lỏng.
 */
export function blocked(dimension, from, dir, distance) {
    try {
        return !!dimension.getBlockFromRay(from, normalize(dir),
            { maxDistance: distance, includeLiquidBlocks: false, includePassableBlocks: false });
    } catch (_) {
        return false;
    }
}

// ---------------------------------------------------------------- âm thanh, màn hình

export function sound(dimension, id, loc, volume = 1, pitch = 1) {
    try { dimension.playSound(id, loc, { volume, pitch }); } catch (_) {}
}

export function playersNear(dimension, loc, radius) {
    try {
        return dimension.getEntities({ location: loc, maxDistance: radius, type: "minecraft:player" });
    } catch (_) {
        return [];
    }
}

export function shake(dimension, loc, radius, intensity, seconds) {
    for (const p of playersNear(dimension, loc, radius)) {
        try { p.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`); } catch (_) {}
    }
}

export function title(dimension, loc, radius, text, subtitle) {
    for (const p of playersNear(dimension, loc, radius)) {
        try {
            p.onScreenDisplay.setTitle(text, { subtitle, fadeInDuration: 6, stayDuration: 40, fadeOutDuration: 14 });
        } catch (_) {}
    }
}

export function actionbar(dimension, loc, radius, text) {
    for (const p of playersNear(dimension, loc, radius)) {
        try { p.onScreenDisplay.setActionBar(text); } catch (_) {}
    }
}

/** Loé màn hình trắng xanh (Absolute Zero, chuyển pha). */
export function flash(dimension, loc, radius, hold = 0.2) {
    for (const p of playersNear(dimension, loc, radius)) {
        try {
            p.camera.fade({
                fadeColor: { red: 0.78, green: 0.92, blue: 1 },
                fadeTime: { fadeInTime: 0.08, holdTime: hold, fadeOutTime: 0.9 },
            });
        } catch (_) {}
    }
}

// ---------------------------------------------------------------- cảnh báo (telegraph)

/**
 * Vòng đỏ trên mặt đất: viền nhấp nháy mỗi lúc một nhanh + mảng đỏ lan từ tâm ra,
 * chạm viền đúng lúc đòn đánh rơi xuống (sau `ticks` tick).
 */
export function warnCircle(dimension, loc, radius, ticks) {
    const ground = { x: loc.x, y: loc.y + 0.06, z: loc.z };
    const life = Math.max(0.1, ticks / TICKS);
    emit(dimension, "yeti:warning_circle", ground, { radius, life });
    emit(dimension, "yeti:warning_fill", { x: ground.x, y: ground.y + 0.01, z: ground.z }, { radius, life });
}

/**
 * Hàng ô cảnh báo đỏ trên đất chỉ đường lao / đường gai: các ô sáng lần lượt từ Yeti
 * về phía mục tiêu (trong 40% đầu thời gian), rồi cùng tắt đúng lúc đòn đánh tới.
 */
export function warnLine(dimension, from, dir, length, ticks, step = 1.6, sideOffset = 0) {
    const perp = { x: -dir.z, y: 0, z: dir.x };
    const sweep = Math.floor(ticks * 0.4);
    for (let d = 1; d <= length; d += step) {
        const delay = Math.floor(sweep * (d / length));
        const g = groundAt(dimension, add(add(from, dir, d), perp, sideOffset));
        const fire = () => warnTile(dimension, g, ticks - delay, yawOf(dir));
        if (delay > 0) system.runTimeout(fire, delay);
        else fire();
    }
}

export function warnTile(dimension, loc, ticks, yaw = 0) {
    emit(dimension, "yeti:warning_tile", { x: loc.x, y: loc.y + 0.06, z: loc.z }, { yaw, life: Math.max(0.1, ticks / TICKS) });
}

// ---------------------------------------------------------------- tổ hợp hiệu ứng

/** Nổ băng: loé sáng + sóng băng + mảnh băng + tuyết + sương (size ~ bán kính vụ nổ). */
export function iceImpact(dimension, loc, size = 2, crack = true) {
    const ground = { x: loc.x, y: loc.y + 0.08, z: loc.z };
    emit(dimension, "yeti:ice_burst", { x: loc.x, y: loc.y + 0.8, z: loc.z });
    emit(dimension, "yeti:frost_ring", ground, { radius: size });
    emit(dimension, "yeti:ice_shard", { x: loc.x, y: loc.y + 0.6, z: loc.z });
    emit(dimension, "yeti:snow_dust", ground);
    emit(dimension, "yeti:frost_mist", { x: loc.x, y: loc.y + 0.5, z: loc.z });
    if (crack) emit(dimension, "yeti:ice_crack", { x: loc.x, y: loc.y + 0.04, z: loc.z }, { radius: Math.max(1.2, size * 0.8) });
    if (size >= 4) {
        emit(dimension, "yeti:ice_shard", { x: loc.x, y: loc.y + 1, z: loc.z });
        ring(dimension, loc, size * 0.6, 6, "yeti:ice_pillar", 0.1);
    }
}

/** Hiệu ứng trúng đòn trên người chơi. */
export function hitFx(dimension, loc) {
    const chest = { x: loc.x, y: loc.y + 1, z: loc.z };
    emit(dimension, "yeti:hit_spark", chest);
    emit(dimension, "yeti:ice_shard", chest);
    emit(dimension, "yeti:frost_mist", chest);
}

/** Lặp fn(i) mỗi `every` tick, `count` lần; trả về hàm huỷ. */
export function repeat(count, every, fn, delay = 0) {
    let i = 0;
    let handle;
    const start = () => {
        handle = system.runInterval(() => {
            try { fn(i); } catch (e) { console.warn("[Yeti FX]", e); }
            if (++i >= count) system.clearRun(handle);
        }, every);
    };
    let delayHandle;
    if (delay > 0) delayHandle = system.runTimeout(start, delay);
    else start();
    return () => {
        if (delayHandle !== undefined) system.clearRun(delayHandle);
        if (handle !== undefined) system.clearRun(handle);
    };
}
