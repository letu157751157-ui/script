// File: scripts/custom/yeti_phase1.js
// Skill pha 1 (Yeti) - bộ skill v1.6 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_1',
    label: 'Yeti Phase 1 (yeti_1)',
    detectRange: 25,
    gcd: 50,
    openingDelay: 20,
    skills: [
        { name: 'crystalFist', tier: 2, cd: 180, when: c => c.d <= 6, cast: c => S.crystalFist(c.yeti, c.target, { damage: 9, radius: 4 }) },
        { name: 'fanSpikes', tier: 2, cd: 240, when: c => c.d <= 16, cast: c => S.fanSpikes(c.yeti, c.target, { damage: 6, length: 14 }) },
        { name: 'spinSlide', tier: 2, cd: 260, when: c => c.d > 5 && c.d <= 16, cast: c => S.spinSlide(c.yeti, c.target, { damage: 7, distance: 14 }) },
        { name: 'ceilingIcicles', tier: 1, cd: 420, first: 140, cast: c => S.ceilingIcicles(c.yeti, { damage: 6, waves: 3 }) },
        { name: 'quakeWaves', tier: 1, cd: 380, first: 100, when: c => c.d <= 14, cast: c => S.quakeWaves(c.yeti, c.target, { damage: 7, length: 14, rocks: 7 }) }
    ]
});
