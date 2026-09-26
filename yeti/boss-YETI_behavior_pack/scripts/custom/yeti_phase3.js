// File: scripts/custom/yeti_phase3.js
// Skill pha 3 (Yeti Cổ Đại) - bộ skill v1.6 (xem yeti_skills.js)

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
        { name: 'crystalFist', tier: 2, cd: 180, when: c => c.d <= 6, cast: c => S.crystalFist(c.yeti, c.target, { damage: 16, radius: 4 }) },
        { name: 'fanSpikes', tier: 2, cd: 240, when: c => c.d <= 16, cast: c => S.fanSpikes(c.yeti, c.target, { damage: 11, length: 15 }) },
        { name: 'spinSlide', tier: 2, cd: 260, when: c => c.d > 5 && c.d <= 16, cast: c => S.spinSlide(c.yeti, c.target, { damage: 13, distance: 14 }) },
        { name: 'ceilingIcicles', tier: 1, cd: 420, first: 140, cast: c => S.ceilingIcicles(c.yeti, { damage: 11, waves: 3 }) },
        { name: 'quakeWaves', tier: 1, cd: 380, first: 100, when: c => c.d <= 14, cast: c => S.quakeWaves(c.yeti, c.target, { damage: 13, length: 14, rocks: 9 }) },
        { name: 'orbShield', tier: 2, cd: 360, when: c => c.d <= 10, cast: c => S.orbShield(c.yeti, { damage: 9, count: 8 }) },
        { name: 'deathFrost', tier: 1, cd: 520, first: 200, when: c => c.d <= 10, cast: c => S.deathFrost(c.yeti, { damage: 14, radius: 9 }) },
        { name: 'crystalMines', tier: 1, cd: 460, first: 240, cast: c => S.crystalMines(c.yeti, { damage: 14, count: 6 }) },
        { name: 'blizzardDance', tier: 1, cd: 420, first: 160, when: c => c.d <= 14, cast: c => S.blizzardDance(c.yeti, c.target, { damage: 10 }) },
        { name: 'sweepBeam', tier: 1, cd: 520, first: 300, when: c => c.d <= 20, cast: c => S.sweepBeam(c.yeti, c.target, { damage: 7, range: 20 }) },
        { name: 'avalanche', tier: 1, cd: 700, first: 400, cast: c => S.avalanche(c.yeti, c.target, { damage: 14, lanes: 5, length: 30 }) }
    ]
});
