import type { Vec3 } from './types';

type Segment = {
    from: Vec3;
    to: Vec3;
    color: string;
    glyph?: string;
    alpha?: number;
};

type Module = {
    point: Vec3;
    label: string;
    color: string;
};

type RenderIssOptions = {
    centerX: number;
    centerY: number;
    scale: number;
    reveal: number;
    longitude: number;
    latitude: number;
    compact: boolean;
};

const segments: Segment[] = [];
const modules: Module[] = [
    { point: { x: 0, y: 0.35, z: -8.2 }, label: '<SOYUZ>', color: '#bdae93' },
    { point: { x: 0, y: 0.95, z: -5.6 }, label: '[ZARYA]', color: '#8ec07c' },
    { point: { x: 0, y: 0.35, z: -2.8 }, label: '[UNITY]', color: '#8ec07c' },
    { point: { x: 0, y: 0.75, z: 0 }, label: '[O]', color: '#fabd2f' },
    { point: { x: 0, y: 0.3, z: 3 }, label: '[DESTINY]', color: '#8ec07c' },
    { point: { x: 0, y: 1, z: 5.8 }, label: '[KIBO]', color: '#8ec07c' },
    { point: { x: 0, y: 0.3, z: 8.4 }, label: '<DRAGON>', color: '#bdae93' },
    { point: { x: 0, y: 2, z: 0.25 }, label: '(CUPOLA)', color: '#b8bb26' },
];

const addSegment = (from: Vec3, to: Vec3, color: string, glyph?: string, alpha?: number) => {
    segments.push({ from, to, color, glyph, alpha });
};

// Integrated truss structure and its repeated cross-bracing.
addSegment({ x: -10, y: -0.28, z: 0 }, { x: 10, y: -0.28, z: 0 }, '#fabd2f', '=');
addSegment({ x: -10, y: 0.28, z: 0 }, { x: 10, y: 0.28, z: 0 }, '#fabd2f', '=');
for (let x = -10; x <= 10; x += 1) {
    addSegment({ x, y: -0.38, z: 0 }, { x, y: 0.38, z: 0 }, '#d79921', '|', 0.8);
}

// Four paired solar-array wings, represented as gridded planes.
for (const x of [-8.2, -5.4, 5.4, 8.2]) {
    for (const side of [-1, 1]) {
        const innerY = side * 1.05;
        const outerY = side * 4.7;
        const left = x - 0.72;
        const right = x + 0.72;
        addSegment({ x: left, y: innerY, z: 0 }, { x: left, y: outerY, z: 0 }, '#d79921', '|');
        addSegment({ x: right, y: innerY, z: 0 }, { x: right, y: outerY, z: 0 }, '#d79921', '|');
        addSegment({ x: left, y: outerY, z: 0 }, { x: right, y: outerY, z: 0 }, '#d79921', '=');
        for (let panel = 0; panel <= 5; panel++) {
            const y = innerY + ((outerY - innerY) * panel) / 5;
            addSegment({ x: left, y, z: 0 }, { x: right, y, z: 0 }, '#d79921', '#', 0.86);
        }
    }
}

// Pressurised module spine, radiators, and docking branches extend in depth.
addSegment({ x: 0, y: 0.65, z: -8.5 }, { x: 0, y: 0.65, z: 8.7 }, '#8ec07c', '-');
addSegment({ x: 0, y: 0.65, z: 0 }, { x: 0, y: 2, z: 0.25 }, '#b8bb26', '|');
for (const x of [-2.8, 2.8]) {
    addSegment({ x: x - 0.8, y: 0.65, z: -1.6 }, { x: x + 0.8, y: 0.65, z: -1.6 }, '#bdae93', '=');
    addSegment({ x: x - 0.8, y: 0.65, z: 1.6 }, { x: x + 0.8, y: 0.65, z: 1.6 }, '#bdae93', '=');
    addSegment({ x, y: 0.65, z: -1.6 }, { x, y: 0.65, z: 1.6 }, '#928374', '|');
}

type ProjectedPoint = Vec3 & { scale: number };
type ProjectedSegment = Segment & { from: ProjectedPoint; to: ProjectedPoint; depth: number };
type ProjectedModule = Module & ProjectedPoint;

const projectedSegments: ProjectedSegment[] = segments.map((segment) => ({
    ...segment,
    from: { x: 0, y: 0, z: 0, scale: 1 },
    to: { x: 0, y: 0, z: 0, scale: 1 },
    depth: 0,
}));
const projectedModules: ProjectedModule[] = modules.map((module) => ({
    ...module,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
}));

export function drawFocusedIss(context: CanvasRenderingContext2D, options: RenderIssOptions) {
    const { centerX, centerY, scale, reveal, longitude, latitude, compact } = options;
    const unit = (compact ? 9.5 : 18) * scale;
    const yaw = -0.58 + longitude;
    const pitch = 0.26 + latitude;
    const cameraDistance = 30;
    const yawCosine = Math.cos(yaw);
    const yawSine = Math.sin(yaw);
    const pitchCosine = Math.cos(pitch);
    const pitchSine = Math.sin(pitch);

    const project = (point: Vec3, target: ProjectedPoint) => {
        const yawedX = point.x * yawCosine + point.z * yawSine;
        const yawedZ = -point.x * yawSine + point.z * yawCosine;
        const pitchedY = point.y * pitchCosine - yawedZ * pitchSine;
        const pitchedZ = point.y * pitchSine + yawedZ * pitchCosine;
        const perspective = cameraDistance / (cameraDistance - pitchedZ);
        target.x = centerX + yawedX * unit * perspective;
        target.y = centerY + pitchedY * unit * perspective;
        target.z = pitchedZ;
        target.scale = perspective;
        return target;
    };

    for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        const projectedSegment = projectedSegments[index];
        projectedSegment.color = segment.color;
        projectedSegment.glyph = segment.glyph;
        projectedSegment.alpha = segment.alpha;
        project(segment.from, projectedSegment.from);
        project(segment.to, projectedSegment.to);
        projectedSegment.depth = (projectedSegment.from.z + projectedSegment.to.z) / 2;
    }
    projectedSegments.sort((first, second) => first.depth - second.depth);

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const segment of projectedSegments) {
        const dx = segment.to.x - segment.from.x;
        const dy = segment.to.y - segment.from.y;
        const distance = Math.hypot(dx, dy);
        const fontSize = Math.max(4.5, ((compact ? 6 : 8) * scale * (segment.from.scale + segment.to.scale)) / 2);
        const steps = Math.max(1, Math.ceil(distance / (fontSize * 0.58)));
        const slope = Math.abs(dy / (dx || 0.001));
        const glyph = segment.glyph ?? (slope > 1.8 ? '|' : slope > 0.45 ? (dx * dy > 0 ? '\\' : '/') : '-');
        context.font = `bold ${fontSize}px "DM Mono", monospace`;
        context.fillStyle = segment.color;
        context.globalAlpha = reveal * (segment.alpha ?? 1) * (0.58 + Math.min(1, segment.from.scale) * 0.38);
        for (let step = 0; step <= steps; step++) {
            const progress = step / steps;
            context.fillText(glyph, segment.from.x + dx * progress, segment.from.y + dy * progress);
        }
    }

    for (let index = 0; index < modules.length; index++) {
        const module = modules[index];
        const projectedModule = projectedModules[index];
        projectedModule.label = module.label;
        projectedModule.color = module.color;
        project(module.point, projectedModule);
    }
    projectedModules.sort((first, second) => first.z - second.z);
    for (const module of projectedModules) {
        const fontSize = Math.max(5, (compact ? 6.2 : 8.5) * scale * module.scale);
        context.font = `bold ${fontSize}px "DM Mono", monospace`;
        context.strokeStyle = '#1d2021';
        context.lineWidth = Math.max(1.5, fontSize * 0.18);
        context.fillStyle = module.color;
        context.globalAlpha = reveal * (0.62 + Math.min(1, module.scale) * 0.38);
        context.strokeText(module.label, module.x, module.y);
        context.fillText(module.label, module.x, module.y);
    }
    context.restore();
}
