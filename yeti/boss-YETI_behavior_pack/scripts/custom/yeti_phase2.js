// File: scripts/custom/yeti_phase2.js
// Skill pha 2 (Yeti Trưởng Thành) - bộ skill v1.6 (xem yeti_skills.js)

import { createBoss } from './yeti_brain';
import * as S from './yeti_skills';

createBoss({
    id: 'ytaun:yeti_2',
    label: 'Yeti Phase 2 (yeti_2)',
    detectRange: 35,
    gcd: 40,
    openingDelay: 60,
    skills: [
        { name: 'crystalFist', tier: 2, cd: 180, when: c => c.d <= 6, cast: c => S.crystalFist(c.yeti, c.target, { damage: 13, radius: 4 }) },
        { name: 'fanSpikes', tier: 2, cd: 240, when: c => c.d <= 16, cast: c => S.fanSpikes(c.yeti, c.target, { damage: 8, length: 14 }) },
        { name: 'spinSlide', tier: 2, cd: 260, when: c => c.d > 5 && c.d <= 16, cast: c => S.spinSlide(c.yeti, c.target, { damage: 10, distance: 14 }) },
        { name: 'ceilingIcicles', tier: 1, cd: 420, first: 140, cast: c => S.ceilingIcicles(c.yeti, { damage: 8, waves: 3 }) },
        { name: 'quakeWaves', tier: 1, cd: 380, first: 100, when: c => c.d <= 14, cast: c => S.quakeWaves(c.yeti, c.target, { damage: 10, length: 14, rocks: 8 }) },
        { name: 'orbShield', tier: 2, cd: 360, when: c => c.d <= 10, cast: c => S.orbShield(c.yeti, { damage: 7, count: 6 }) },
        { name: 'deathFrost', tier: 1, cd: 520, first: 200, when: c => c.d <= 10, cast: c => S.deathFrost(c.yeti, { damage: 11, radius: 9 }) },
        { name: 'crystalMines', tier: 1, cd: 460, first: 240, cast: c => S.crystalMines(c.yeti, { damage: 11, count: 4 }) }
    ]
});
