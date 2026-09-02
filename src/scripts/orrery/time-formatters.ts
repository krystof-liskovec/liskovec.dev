import { DEG } from './math';

export const signedDegrees = (radians: number) => {
    const degrees = ((((radians / DEG + 180) % 360) + 360) % 360) - 180;
    const sign = degrees >= 0 ? '+' : '−';
    return `${sign}${Math.abs(degrees).toFixed(1)}°`;
};

export const formatGalacticEpoch = (elapsedYears: number) => {
    const absoluteYears = Math.abs(elapsedYears);
    if (absoluteYears < 5_000) return 'PRESENT';
    const direction = elapsedYears < 0 ? '−' : '+';
    if (absoluteYears < 1_000_000_000) return `T${direction}${(absoluteYears / 1_000_000).toFixed(2)} MY`;
    if (absoluteYears < 1_000_000_000_000) return `T${direction}${(absoluteYears / 1_000_000_000).toFixed(2)} GY`;
    return `T${direction}${(absoluteYears / 1_000_000_000_000).toFixed(2)} TY`;
};

const padTimePart = (value: number) => String(value).padStart(2, '0');

export const formatLocalDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} / ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
};
