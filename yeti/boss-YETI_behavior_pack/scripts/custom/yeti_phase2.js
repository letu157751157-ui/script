// File: scripts/custom/yeti_phase2.js
// Skill pha 2 (Yeti Trưởng Thành) - bộ skill mới v1.5 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_2',
    label: 'Yeti Phase 2 (yeti_2)',
    detectRange: 35,
    gcd: 40,
    openingDelay: 60,
    skills: [
        { name: 'golemToss', tier: 2, cd: 120, when: c => c.d <= 4.5, cast: c => S.golemToss(c.yeti, c.target, { damage: 11, launch: 1.1 }) },
        { name: 'frostFangs', tier: 2, cd: 220, when: c => c.d <= 16, cast: c => S.frostFangs(c.yeti, c.target, { damage: 8, count: 10 }) },
        { name: 'galeBall', tier: 2, cd: 260, when: c => c.d > 5, cast: c => S.galeBall(c.yeti, c.target, { damage: 8, radius: 3.5, power: 2.5 }) },
        { name: 'icicleVolley', tier: 2, cd: 240, when: c => c.d > 7, cast: c => S.icicleVolley(c.yeti, c.target, { damage: 6, shots: 5 }) },
        { name: 'glacierDive', tier: 1, cd: 400, first: 120, when: c => c.d > 8 && c.d <= 22, cast: c => S.glacierDive(c.yeti, c.target, { damage: 14, radius: 5, height: 10 }) },
        { name: 'sonicHowl', tier: 1, cd: 420, first: 160, when: c => c.d <= 20, cast: c => S.sonicHowl(c.yeti, c.target, { damage: 14, range: 20 }) },
        { name: 'frostSkulls', tier: 2, cd: 360, when: c => c.d > 6, cast: c => S.frostSkulls(c.yeti, c.target, { damage: 8, count: 3 }) },
        { name: 'frostPool', tier: 2, cd: 400, when: c => c.d > 4, cast: c => S.frostPool(c.yeti, c.target, { damage: 3, radius: 3.5, seconds: 6 }) },
        { name: 'frostWisps', tier: 1, cd: 500, first: 200, cast: c => S.frostWisps(c.yeti, { damage: 6, count: 4 }) }
    ]
});
