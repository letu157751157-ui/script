// File: scripts/custom/yeti_phase1.js
// Skill pha 1 (Yeti) - bộ skill mới v1.5 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_1',
    label: 'Yeti Phase 1 (yeti_1)',
    detectRange: 25,
    gcd: 50,
    openingDelay: 20,
    skills: [
        { name: 'golemToss', tier: 2, cd: 120, when: c => c.d <= 4.5, cast: c => S.golemToss(c.yeti, c.target, { damage: 8, launch: 1.0 }) },
        { name: 'frostFangs', tier: 2, cd: 220, when: c => c.d <= 16, cast: c => S.frostFangs(c.yeti, c.target, { damage: 6, count: 10 }) },
        { name: 'galeBall', tier: 2, cd: 260, when: c => c.d > 5, cast: c => S.galeBall(c.yeti, c.target, { damage: 6, radius: 3.5, power: 2.5 }) },
        { name: 'icicleVolley', tier: 2, cd: 240, when: c => c.d > 7, cast: c => S.icicleVolley(c.yeti, c.target, { damage: 4, shots: 3 }) },
        { name: 'glacierDive', tier: 1, cd: 400, first: 120, when: c => c.d > 8 && c.d <= 22, cast: c => S.glacierDive(c.yeti, c.target, { damage: 10, radius: 5, height: 9 }) }
    ]
});
