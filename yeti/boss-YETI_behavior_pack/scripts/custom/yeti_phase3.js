// File: scripts/custom/yeti_phase3.js
// Skill pha 3 (Yeti Cổ Đại) - bộ skill v1.7 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_3',
    label: 'Yeti Phase 3 (yeti_3)',
    detectRange: 40,
    gcd: 22,
    openingDelay: 40,
    cooldownScale: st => (st.data.enraged ? 0.75 : 1),
    skills: [
        { name: 'enrage', tier: 0, cd: 1e9, when: c => c.hp < 0.35 && !c.st.data.enraged, cast: c => { c.st.data.enraged = true; S.enrage(c.yeti, { speed: 1, strength: 1, name: '§3§lYeti Cổ Đại' }); } },
        { name: 'frostLeap', tier: 1, cd: 100, first: 40, when: c => c.d > 7, cast: c => S.frostLeap(c.yeti, c.target, { damage: 18, radius: 5 }) },
        { name: 'maulCombo', tier: 2, cd: 120, when: c => c.d <= 4.5, cast: c => S.maulCombo(c.yeti, c.target, { damage: 13 }) },
        { name: 'groundPound', tier: 2, cd: 160, when: c => c.d <= 6, cast: c => S.groundPound(c.yeti, c.target, { damage: 16, radius: 4 }) },
        { name: 'boulderThrow', tier: 2, cd: 180, when: c => c.d > 5 && c.d <= 22, cast: c => S.boulderThrow(c.yeti, c.target, { damage: 16, radius: 3 }) },
        { name: 'bodyCharge', tier: 2, cd: 220, first: 80, when: c => c.d > 4 && c.d <= 14, cast: c => S.bodyCharge(c.yeti, c.target, { damage: 18, distance: 14 }) },
        { name: 'fanSpikes', tier: 1, cd: 300, first: 120, when: c => c.d <= 16, cast: c => S.fanSpikes(c.yeti, c.target, { damage: 11, length: 14 }) },
        { name: 'frostBreath', tier: 1, cd: 360, first: 160, when: c => c.d <= 12, cast: c => S.frostBreath(c.yeti, c.target, { damage: 9, range: 12 }) },
        { name: 'quakeWaves', tier: 1, cd: 400, first: 240, when: c => c.d <= 14, cast: c => S.quakeWaves(c.yeti, c.target, { damage: 13, length: 14, rocks: 7 }) },
        { name: 'ceilingIcicles', tier: 1, cd: 440, first: 200, cast: c => S.ceilingIcicles(c.yeti, { damage: 11, waves: 3 }) },
        { name: 'avalanche', tier: 1, cd: 700, first: 400, cast: c => S.avalanche(c.yeti, c.target, { damage: 14, lanes: 5, length: 30 }) }
    ]
});
