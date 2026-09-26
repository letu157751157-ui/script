// File: scripts/custom/yeti_phase3.js
// Skill pha 3 (Yeti Cổ Đại) - bộ skill mới v1.5 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_3',
    label: 'Yeti Phase 3 (yeti_3)',
    detectRange: 40,
    gcd: 30,
    openingDelay: 60,
    cooldownScale: st => (st.data.enraged ? 0.75 : 1),
    skills: [
        { name: 'enrage', tier: 0, cd: 1e9, when: c => c.hp < 0.35 && !c.st.data.enraged, cast: c => { c.st.data.enraged = true; S.enrage(c.yeti, { speed: 1, strength: 1, name: '§3§lYeti Cổ Đại' }); } },
        { name: 'golemToss', tier: 2, cd: 120, when: c => c.d <= 4.5, cast: c => S.golemToss(c.yeti, c.target, { damage: 14, launch: 1.2 }) },
        { name: 'frostFangs', tier: 2, cd: 220, when: c => c.d <= 16, cast: c => S.frostFangs(c.yeti, c.target, { damage: 11, count: 11 }) },
        { name: 'galeBall', tier: 2, cd: 260, when: c => c.d > 5, cast: c => S.galeBall(c.yeti, c.target, { damage: 11, radius: 3.5, power: 2.5 }) },
        { name: 'icicleVolley', tier: 2, cd: 240, when: c => c.d > 7, cast: c => S.icicleVolley(c.yeti, c.target, { damage: 7, shots: 5 }) },
        { name: 'glacierDive', tier: 1, cd: 400, first: 120, when: c => c.d > 8 && c.d <= 22, cast: c => S.glacierDive(c.yeti, c.target, { damage: 18, radius: 5, height: 11 }) },
        { name: 'sonicHowl', tier: 1, cd: 420, first: 160, when: c => c.d <= 20, cast: c => S.sonicHowl(c.yeti, c.target, { damage: 18, range: 20 }) },
        { name: 'frostSkulls', tier: 2, cd: 360, when: c => c.d > 6, cast: c => S.frostSkulls(c.yeti, c.target, { damage: 11, count: 3 }) },
        { name: 'frostPool', tier: 2, cd: 400, when: c => c.d > 4, cast: c => S.frostPool(c.yeti, c.target, { damage: 4, radius: 3.5, seconds: 6 }) },
        { name: 'frostWisps', tier: 1, cd: 500, first: 200, cast: c => S.frostWisps(c.yeti, { damage: 7, count: 6 }) },
        { name: 'guardianBeam', tier: 1, cd: 460, first: 240, when: c => c.d <= 24, cast: c => S.guardianBeam(c.yeti, c.target, { damage: 16, range: 26 }) },
        { name: 'whiteout', tier: 1, cd: 600, first: 300, when: c => c.d <= 14, cast: c => S.whiteout(c.yeti, { damage: 4, radius: 14 }) },
        { name: 'avalanche', tier: 1, cd: 700, first: 400, cast: c => S.avalanche(c.yeti, c.target, { damage: 14, lanes: 5, length: 30 }) }
    ]
});
