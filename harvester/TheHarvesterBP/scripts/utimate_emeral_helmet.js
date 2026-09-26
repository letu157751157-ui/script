// Ultimate Emerald Helmet - Thiên Thần Aura với Weakness Effect
// Minecraft Bedrock Edition 1.21.130

PlayerEvents.tick(event => {
    const { player, level } = event;
    
    // Kiểm tra player có đeo ultimate emerald helmet không
    const helmet = player.getHeadArmorItem();
    if (!helmet || helmet.id !== 'kubejs:ultimate_emerald_helmet') return;
    
    // Chỉ chạy mỗi 2 tick để tối ưu
    if (player.age % 2 !== 0) return;
    
    const pos = player.position;
    const headY = pos.y + 1.8; // Điều chỉnh chiều cao cho Bedrock
    
    // === VÒNG THIÊN THẦN TRÊN ĐẦU ===
    const time = player.age * 0.03;
    const radius = 0.8;
    const points = 24;
    
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2 + time;
        const x = pos.x + Math.cos(angle) * radius;
        const z = pos.z + Math.sin(angle) * radius;
        
        // Particles cho Bedrock
        level.spawnParticles('minecraft:end_rod', true, x, headY, z, 0, 0.02, 0, 1, 0);
        level.spawnParticles('minecraft:bleach', true, x, headY, z, 0, 0, 0, 1, 0);
    }
    
    // Vòng tròn thứ 2
    const radius2 = 0.5;
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 - time * 1.5;
        const x = pos.x + Math.cos(angle) * radius2;
        const z = pos.z + Math.sin(angle) * radius2;
        
        level.spawnParticles('minecraft:enchanting_table_particle', true, x, headY + 0.1, z, 0, 0, 0, 1, 0);
    }
    
    // === HẠT NƯỚC RƠI SIÊU CHẬM ===
    if (player.age % 10 === 0) {
        const randomX = pos.x + (Math.random() - 0.5) * 1.5;
        const randomZ = pos.z + (Math.random() - 0.5) * 1.5;
        
        level.spawnParticles('minecraft:water_drip_particle', true, 
            randomX, headY + 0.3, randomZ, 
            0, -0.02, 0,
            3, 0);
        
        level.spawnParticles('minecraft:falling_dust_scaffolding_particle', true,
            randomX, headY + 0.3, randomZ,
            0, -0.01, 0,
            1, 0);
    }
    
    // Sparkle particles
    if (player.age % 5 === 0) {
        const sparkleX = pos.x + (Math.random() - 0.5) * 1.2;
        const sparkleZ = pos.z + (Math.random() - 0.5) * 1.2;
        level.spawnParticles('minecraft:sparkler_emitter', true,
            sparkleX, headY, sparkleZ,
            0, 0, 0, 1, 0);
    }
    
    // === GÂY WEAKNESS ===
    if (player.age % 60 === 0) {
        const range = 5.0;
        
        // Weakness cho player
        player.potionEffects.add('weakness', 80, 0, false, false);
        
        // Tìm entities xung quanh
        const entities = level.getEntitiesWithin(AABB.of(
            pos.x - range, pos.y - range, pos.z - range,
            pos.x + range, pos.y + range, pos.z + range
        ));
        
        entities.forEach(entity => {
            if (entity.isLiving() && entity !== player) {
                entity.potionEffects.add('weakness', 80, 0, false, false);
                
                if (player.age % 20 === 0) {
                    level.spawnParticles('minecraft:villager_angry', true,
                        entity.x, entity.y + 1.5, entity.z,
                        0.3, 0.5, 0.3, 5, 0);
                }
            }
        });
    }
    
    // Particles môi trường
    if (player.age % 3 === 0) {
        const ambientX = pos.x + (Math.random() - 0.5) * 2;
        const ambientY = pos.y + Math.random() * 2;
        const ambientZ = pos.z + (Math.random() - 0.5) * 2;
        
        level.spawnParticles('minecraft:soul_particle', true,
            ambientX, ambientY, ambientZ,
            0, 0.01, 0, 1, 0);
    }
});