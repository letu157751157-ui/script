// File: scripts/custom/yeti_brain.js
// "Bộ não" chọn chiêu dùng chung cho 3 pha Yeti.
//
// Mỗi pha khai báo danh sách chiêu: { name, cd (tick), tier, when(ctx), cast(ctx), first? }
//   tier 0 = chiêu khẩn cấp theo máu (ưu tiên theo thứ tự khai báo)
//   tier 1 = chiêu lớn / đặc trưng (chọn ngẫu nhiên trong các chiêu đã hồi)
//   tier 2 = chiêu thường theo khoảng cách (chọn ngẫu nhiên)
//   first = số tick phải chờ trước lần dùng đầu tiên (tránh xả hết chiêu ngay khi vừa gặp)
// Giữa 2 chiêu luôn có hồi chiêu chung (gcd), và không dùng chiêu khi đang thi triển chiêu khác.

import { world, system } from '@minecraft/server';
import { DIMENSIONS, isBusy, nearestPlayer, dist2D, clearEntity, shatter, sound, fx, FX } from './yeti_fx';

function healthPercent(entity) {
    try {
        const h = entity.getComponent('minecraft:health');
        const max = h.effectiveMax ?? h.defaultValue;
        return max > 0 ? h.currentValue / max : 1;
    } catch (_) {
        return 1;
    }
}

export function createBoss(cfg) {
    const states = new Map(); // entity.id -> { cd: {name: tick}, nextCast, ... }

    function stateOf(yeti) {
        let st = states.get(yeti.id);
        if (!st) {
            const now = system.currentTick;
            st = { cd: {}, nextCast: now + (cfg.openingDelay ?? 20), data: {} };
            for (const s of cfg.skills) st.cd[s.name] = now + (s.first ?? 0);
            states.set(yeti.id, st);
        }
        return st;
    }

    function think(yeti) {
        if (!yeti.isValid) return;
        const st = stateOf(yeti);
        const tick = system.currentTick;
        if (cfg.onTick) {
            try { cfg.onTick(yeti, st, tick); } catch (e) { console.warn(`[${cfg.label}] onTick`, e); }
        }
        if (isBusy(yeti) || tick < st.nextCast) return;
        const target = nearestPlayer(yeti, cfg.detectRange);
        if (!target) return;

        const ctx = { yeti, target, d: dist2D(yeti.location, target.location), hp: healthPercent(yeti), tick, st };
        const scale = cfg.cooldownScale ? cfg.cooldownScale(st) : 1;
        for (const tier of [0, 1, 2]) {
            const ready = cfg.skills.filter(s => s.tier === tier && tick >= st.cd[s.name] && (!s.when || s.when(ctx)));
            if (ready.length === 0) continue;
            const skill = tier === 0 ? ready[0] : ready[Math.floor(Math.random() * ready.length)];
            st.cd[skill.name] = tick + Math.round(skill.cd * scale);
            st.nextCast = tick + Math.round(cfg.gcd * scale);
            try { skill.cast(ctx); } catch (e) { console.warn(`[${cfg.label}] ${skill.name}`, e); }
            return;
        }
    }

    system.runInterval(() => {
        for (const id of DIMENSIONS) {
            let list = [];
            try { list = world.getDimension(id).getEntities({ type: cfg.id }); } catch (_) {}
            for (const yeti of list) think(yeti);
        }
    }, 2);

    world.afterEvents.entityDie.subscribe(e => {
        const dead = e.deadEntity;
        if (!dead || dead.typeId !== cfg.id) return;
        states.delete(dead.id);
        clearEntity(dead.id);
        try {
            if (cfg.onDeath) cfg.onDeath(dead);
            shatter(dead.dimension, dead.location, 4);
            fx(dead.dimension, FX.beam, dead.location);
            sound(dead.dimension, 'random.glass', dead.location, 3, 0.5);
            sound(dead.dimension, 'random.explode', dead.location, 2, 0.8);
        } catch (_) {}
    });

    console.warn(`${cfg.label} loaded!`);
    return { states };
}
