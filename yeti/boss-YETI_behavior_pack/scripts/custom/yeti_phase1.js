// File: scripts/custom/yeti_phase1.js
// Skill pha 1 (Yeti) - bộ skill v1.7 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_1',
    label: 'Yeti Phase 1 (yeti_1)',
    detectRange: 25,
    gcd: 30,
    openingDelay: 20,
    skills: [
        { name: 'frostLeap', tier: 1, cd: 140, first: 40, when: c => c.d > 7, cast: c => S.frostLeap(c.yeti, c.target, { damage: 10, radius: 5 }) },
        { name: 'maulCombo', tier: 2, cd: 120, when: c => c.d <= 4.5, cast: c => S.maulCombo(c.yeti, c.target, { damage: 7 }) },
        { name: 'groundPound', tier: 2, cd: 160, when: c => c.d <= 6, cast: c => S.groundPound(c.yeti, c.target, { damage: 9, radius: 4 }) },
        { name: 'boulderThrow', tier: 2, cd: 180, when: c => c.d > 5 && c.d <= 22, cast: c => S.boulderThrow(c.yeti, c.target, { damage: 9, radius: 3 }) },
        { name: 'bodyCharge', tier: 2, cd: 220, first: 80, when: c => c.d > 4 && c.d <= 14, cast: c => S.bodyCharge(c.yeti, c.target, { damage: 10, distance: 14 }) },
        { name: 'fanSpikes', tier: 1, cd: 300, first: 120, when: c => c.d <= 16, cast: c => S.fanSpikes(c.yeti, c.target, { damage: 6, length: 14 }) }
    ]
});
