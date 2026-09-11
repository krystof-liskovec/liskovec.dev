import {
    GALACTIC_BAR_BETA,
    GALACTIC_BAR_HALF_LENGTH_KPC,
    GALACTIC_SCENE_UNITS_PER_KPC,
    LOCAL_GALACTIC_ARM,
    MAJOR_GALACTIC_ARMS,
    galacticArmPoint,
} from './galaxy-model';

const TEXTURE_SIZE = 1024;
const TEXTURE_EXTENT = 1.5;
let glowTexture: HTMLCanvasElement | null = null;
let armGlowTexture: HTMLCanvasElement | null = null;

// Illustrative integrated starlight in the scene's muted Gruvbox palette.
// Use the same fitted arm geometry as the glyphs, including the finite Local
// Arm. This is an artistic light distribution, not a measured brightness map.
const createGlowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const unit = TEXTURE_SIZE / (TEXTURE_EXTENT * 2);
    context.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    context.scale(unit, unit);

    const disk = context.createRadialGradient(0, 0, 0, 0, 0, 1.25);
    disk.addColorStop(0, 'rgba(235, 219, 178, 0.026)');
    disk.addColorStop(0.35, 'rgba(213, 196, 161, 0.013)');
    disk.addColorStop(0.7, 'rgba(168, 153, 132, 0.005)');
    disk.addColorStop(1, 'rgba(168, 153, 132, 0)');
    context.fillStyle = disk;
    context.fillRect(-1.25, -1.25, 2.5, 2.5);

    const arms = [...MAJOR_GALACTIC_ARMS, LOCAL_GALACTIC_ARM];
    for (const arm of arms) {
        const steps = arm.name === 'Local' ? 24 : 180;
        let previous = galacticArmPoint(arm, arm.betaMin);
        for (let step = 1; step <= steps; step++) {
            const beta = arm.betaMin + (arm.betaMax - arm.betaMin) * (step / steps);
            const point = galacticArmPoint(arm, beta);
            const radius = Math.hypot(point.x, point.y);
            const spread = 0.065 + Math.min(1, radius) * 0.055;
            // Scale by sample spacing to avoid over-lighting tightly wound
            // inner arms, and taper both ends so no bright caps appear.
            const spacing = Math.hypot(point.x - previous.x, point.y - previous.y);
            const taper = Math.min(1, step / 6, (steps - step) / 6);
            const alpha = Math.min(0.029, (spacing / spread) * 0.06) * taper;
            const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, spread);
            glow.addColorStop(0, `rgba(235, 219, 178, ${alpha})`);
            glow.addColorStop(0.45, `rgba(213, 196, 161, ${alpha * 0.38})`);
            glow.addColorStop(1, 'rgba(213, 196, 161, 0)');
            context.fillStyle = glow;
            context.fillRect(point.x - spread, point.y - spread, spread * 2, spread * 2);
            previous = point;
        }
    }

    context.save();
    context.rotate(Math.PI / 2 - GALACTIC_BAR_BETA);
    context.scale(GALACTIC_BAR_HALF_LENGTH_KPC * GALACTIC_SCENE_UNITS_PER_KPC * 1.5, 0.19);
    const bar = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    bar.addColorStop(0, 'rgba(235, 219, 178, 0.09)');
    bar.addColorStop(0.32, 'rgba(213, 196, 161, 0.055)');
    bar.addColorStop(0.7, 'rgba(168, 153, 132, 0.018)');
    bar.addColorStop(1, 'rgba(168, 153, 132, 0)');
    context.fillStyle = bar;
    context.fillRect(-1, -1, 2, 2);
    context.restore();

    const bulge = context.createRadialGradient(0, 0, 0, 0, 0, 0.25);
    bulge.addColorStop(0, 'rgba(235, 219, 178, 0.085)');
    bulge.addColorStop(0.35, 'rgba(213, 196, 161, 0.035)');
    bulge.addColorStop(1, 'rgba(213, 196, 161, 0)');
    context.fillStyle = bulge;
    context.fillRect(-0.25, -0.25, 0.5, 0.5);
    return canvas;
};

const createArmGlowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const unit = TEXTURE_SIZE / (TEXTURE_EXTENT * 2);
    context.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    context.scale(unit, unit);

    const arms = [...MAJOR_GALACTIC_ARMS, LOCAL_GALACTIC_ARM];
    for (const arm of arms) {
        const steps = arm.name === 'Local' ? 24 : 180;
        let previous = galacticArmPoint(arm, arm.betaMin);
        for (let step = 1; step <= steps; step++) {
            const beta = arm.betaMin + (arm.betaMax - arm.betaMin) * (step / steps);
            const point = galacticArmPoint(arm, beta);
            const radius = Math.hypot(point.x, point.y);
            const spread = 0.065 + Math.min(1, radius) * 0.055;
            const spacing = Math.hypot(point.x - previous.x, point.y - previous.y);
            const taper = Math.min(1, step / 6, (steps - step) / 6);
            const alpha = Math.min(0.018, (spacing / spread) * 0.04) * taper;
            const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, spread);
            glow.addColorStop(0, `rgba(235, 219, 178, ${alpha})`);
            glow.addColorStop(0.45, `rgba(213, 196, 161, ${alpha * 0.38})`);
            glow.addColorStop(1, 'rgba(213, 196, 161, 0)');
            context.fillStyle = glow;
            context.fillRect(point.x - spread, point.y - spread, spread * 2, spread * 2);
            previous = point;
        }
    }
    return canvas;
};

export function drawGalaxyGlow(
    context: CanvasRenderingContext2D,
    options: {
        coreX: number;
        coreY: number;
        radius: number;
        verticalProjection: number;
        rotation: number;
        alpha: number;
    },
) {
    if (options.alpha <= 0.001) return;
    glowTexture ??= createGlowTexture();
    if (!glowTexture) return;
    context.save();
    context.globalAlpha = options.alpha * 0.34;
    context.imageSmoothingEnabled = true;
    context.translate(options.coreX, options.coreY);
    context.scale(options.radius, options.radius * options.verticalProjection);
    context.rotate(options.rotation);
    context.drawImage(glowTexture, -TEXTURE_EXTENT, -TEXTURE_EXTENT, TEXTURE_EXTENT * 2, TEXTURE_EXTENT * 2);
    context.restore();
}

export function drawGalaxyCoreGlow(
    context: CanvasRenderingContext2D,
    options: {
        coreX: number;
        coreY: number;
        radius: number;
        alpha: number;
    },
) {
    if (options.alpha <= 0.001) return;
    context.save();
    context.globalAlpha = options.alpha * 0.38;
    context.imageSmoothingEnabled = true;
    context.translate(options.coreX, options.coreY);
    // This is an ambient background wash beneath the disk, not another piece
    // of the rotating galaxy. Keep it circular and screen-fixed like the Sun's
    // diffuse glow so camera turns cannot drag or tilt the broad light.
    context.scale(options.radius * 1.44, options.radius * 1.44);
    const core = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    core.addColorStop(0, 'rgba(235, 219, 178, 0.18)');
    core.addColorStop(0.2, 'rgba(215, 153, 33, 0.1)');
    core.addColorStop(0.45, 'rgba(213, 196, 161, 0.04)');
    core.addColorStop(0.7, 'rgba(213, 196, 161, 0.018)');
    core.addColorStop(1, 'rgba(213, 196, 161, 0)');
    context.fillStyle = core;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
}

export function drawGalaxyArmsGlow(
    context: CanvasRenderingContext2D,
    options: {
        coreX: number;
        coreY: number;
        radius: number;
        verticalProjection: number;
        rotation: number;
        alpha: number;
    },
) {
    if (options.alpha <= 0.001) return;
    armGlowTexture ??= createArmGlowTexture();
    if (!armGlowTexture) return;
    context.save();
    context.globalAlpha = options.alpha * 0.22;
    context.imageSmoothingEnabled = true;
    context.translate(options.coreX, options.coreY);
    context.scale(options.radius, options.radius * options.verticalProjection);
    context.rotate(options.rotation);
    context.drawImage(armGlowTexture, -TEXTURE_EXTENT, -TEXTURE_EXTENT, TEXTURE_EXTENT * 2, TEXTURE_EXTENT * 2);
    context.restore();
}
