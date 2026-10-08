#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import sharp from 'sharp';

const DEFAULTS = {
    width: 120,
    fontSize: 14,
    bold: false,
    theme: 'gruvbox',
    chars: 'standard',
    brightness: 0,
    contrast: 35,
    dither: true,
    invert: false,
    forceThemeBackground: false,
};

const FINE_CHARACTERS =
    " .'" +
    String.fromCharCode(96) +
    '^",:;Il!i~+_-?][}{1)(|' +
    String.fromCharCode(92) +
    '/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
const CHARACTER_SETS = {
    // Ordered from least ink to most ink.
    fine: FINE_CHARACTERS,
    standard: ' .:-=+*#%@',
    bold: ' .,:;irsXA253hMHGS#9B&@',
};

const THEMES = {
    original: { background: '#1d2021', dark: '#665c54', mid: '#d79921', light: '#fabd2f' },
    gruvbox: { background: '#1d2021', dark: '#665c54', mid: '#d79921', light: '#fabd2f' },
    monochrome: { background: '#101010', dark: '#707070', mid: '#c8c8c8', light: '#ffffff' },
    amber: { background: '#17100a', dark: '#6f3d16', mid: '#d66b1f', light: '#ffd38a' },
};

const GRUVBOX_COLOURS = [
    '#1d2021',
    '#3c3836',
    '#504945',
    '#665c54',
    '#7c6f64',
    '#928374',
    '#a89984',
    '#bdae93',
    '#d5c4a1',
    '#ebdbb2',
    '#fbf1c7',
    '#cc241d',
    '#fb4934',
    '#d65d0e',
    '#fe8019',
    '#d79921',
    '#fabd2f',
    '#98971a',
    '#b8bb26',
    '#689d6a',
    '#8ec07c',
    '#458588',
    '#83a598',
    '#b16286',
    '#d3869b',
];

const TEXT_EXTENSIONS = new Set(['.txt', '.asc', '.ascii']);
const RASTER_FORMATS = {
    '.png': 'png',
    '.jpg': 'jpeg',
    '.jpeg': 'jpeg',
    '.webp': 'webp',
    '.bmp': 'bmp',
};

const usage =
    [
        'Usage:',
        '  npm run ascii -- <image> [options]',
        '',
        'Examples:',
        '  npm run ascii -- photo.jpg --output photo-ascii.txt',
        '  npm run ascii -- photo.jpg --width 160 --output photo-ascii.png',
        '  npm run ascii -- portrait.jpg --theme amber --output portrait-ascii.svg',
        '',
        'The output format is inferred from the --output extension. Without --output,',
        'plain ASCII is written to stdout.',
        '',
        'Options:',
        '  -o, --output <file>       Write output; format comes from the extension',
        '  --width <columns>         Output width in characters (40–240, default: 120)',
        '  --font-size <pixels>      SVG/raster glyph size (10–22, default: 14)',
        '  --bold                    Use bold output glyphs (default: regular)',
        '  --chars <set>             Character ramp: fine, standard, or bold (default: standard)',
        '  --theme <theme>           Palette: gruvbox, original, monochrome, or amber (default: gruvbox)',
        '  --brightness <-100..100>  Adjust brightness before mapping characters',
        '  --contrast <0..100>       Increase tonal separation (default: 35)',
        '  --dither / --no-dither    Use Floyd–Steinberg dithering (default: on)',
        '  --invert                  Invert source colours, character contrast, and background fill',
        '  --force-theme-background  Use the selected theme background instead of the source background',
        '  --ansi                    Use true-colour ANSI output when printing to a terminal',
        '  -h, --help                Show this help',
    ].join('\n') + '\n';

function fail(message) {
    console.error('ascii-art: ' + message);
    console.error('Run with --help for usage.');
    process.exit(1);
}

function parseNumber(value, name, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        fail(name + ' must be a number between ' + min + ' and ' + max + '.');
    }
    return parsed;
}

function parseArgs(argv) {
    if (argv.includes('-h') || argv.includes('--help')) {
        console.log(usage);
        process.exit(0);
    }

    const options = { ...DEFAULTS };
    const positional = [];
    let ansi = false;
    let output;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        const next = argv[index + 1];
        if (argument === '-o' || argument === '--output') {
            output = next;
            index += 1;
        } else if (argument === '--width') {
            options.width = parseNumber(next, 'width', 40, 240);
            index += 1;
        } else if (argument === '--font-size') {
            options.fontSize = parseNumber(next, 'font size', 10, 22);
            index += 1;
        } else if (argument === '--bold') {
            options.bold = true;
        } else if (argument === '--brightness') {
            options.brightness = parseNumber(next, 'brightness', -100, 100);
            index += 1;
        } else if (argument === '--contrast') {
            options.contrast = parseNumber(next, 'contrast', 0, 100);
            index += 1;
        } else if (argument === '--chars') {
            options.chars = next;
            index += 1;
        } else if (argument === '--theme') {
            options.theme = next;
            index += 1;
        } else if (argument === '--dither') {
            options.dither = true;
        } else if (argument === '--no-dither') {
            options.dither = false;
        } else if (argument === '--invert') {
            options.invert = true;
        } else if (argument === '--force-theme-background') {
            options.forceThemeBackground = true;
        } else if (argument === '--ansi') {
            ansi = true;
        } else if (argument.startsWith('-')) {
            fail('unknown option ' + argument);
        } else {
            positional.push(argument);
        }
    }

    if (positional.length !== 1) fail('provide exactly one input image.');
    if (!CHARACTER_SETS[options.chars]) fail('unknown character set “' + options.chars + '”.');
    if (!THEMES[options.theme]) fail('unknown theme “' + options.theme + '”.');
    return { ...options, input: positional[0], output, ansi };
}

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
    return {
        r: Number.parseInt(hex.slice(1, 3), 16),
        g: Number.parseInt(hex.slice(3, 5), 16),
        b: Number.parseInt(hex.slice(5, 7), 16),
    };
}

function interpolateRgb(first, second, amount) {
    return {
        r: Math.round(first.r + (second.r - first.r) * amount),
        g: Math.round(first.g + (second.g - first.g) * amount),
        b: Math.round(first.b + (second.b - first.b) * amount),
    };
}

function rgbToAnsi(colour) {
    return String.fromCharCode(27) + '[38;2;' + colour.r + ';' + colour.g + ';' + colour.b + 'm';
}

function rgbToHex(colour) {
    return '#' + [colour.r, colour.g, colour.b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function invertColour(colour) {
    return { r: 255 - colour.r, g: 255 - colour.g, b: 255 - colour.b };
}

function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function getRows(width, imageWidth, imageHeight) {
    // Terminal glyphs are taller than they are wide, so compensate for that
    // when calculating the grid and keep circles close to circular.
    return Math.max(8, Math.round(((width * imageHeight) / imageWidth) * 0.5));
}

function distributeDither(values, width, height, characterCount) {
    const levels = characterCount - 1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            const oldValue = values[index];
            const quantized = Math.round(oldValue * levels) / levels;
            const error = oldValue - quantized;
            values[index] = quantized;
            if (x + 1 < width) values[index + 1] += (error * 7) / 16;
            if (y + 1 < height) {
                if (x > 0) values[index + width - 1] += (error * 3) / 16;
                values[index + width] += (error * 5) / 16;
                if (x + 1 < width) values[index + width + 1] += error / 16;
            }
        }
    }
}

function createPalette(themeName) {
    const theme = THEMES[themeName];
    return {
        background: hexToRgb(theme.background),
        dark: hexToRgb(theme.dark),
        mid: hexToRgb(theme.mid),
        light: hexToRgb(theme.light),
    };
}

function paletteColor(palette, brightness) {
    if (brightness < 0.5) return interpolateRgb(palette.dark, palette.mid, brightness * 2);
    return interpolateRgb(palette.mid, palette.light, (brightness - 0.5) * 2);
}

function closestGruvboxColour(colour) {
    let closest = hexToRgb(GRUVBOX_COLOURS[0]);
    let shortestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of GRUVBOX_COLOURS) {
        const target = hexToRgb(candidate);
        const redDistance = colour.r - target.r;
        const greenDistance = colour.g - target.g;
        const blueDistance = colour.b - target.b;
        const distance = redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance;
        if (distance < shortestDistance) {
            shortestDistance = distance;
            closest = target;
        }
    }
    return closest;
}

function colourDistance(first, second) {
    const redDistance = first.r - second.r;
    const greenDistance = first.g - second.g;
    const blueDistance = first.b - second.b;
    return Math.sqrt(redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance);
}

function detectBackground(raw, width, height) {
    const edgeColours = [];
    const addPixel = (x, y) => {
        const sourceIndex = (y * width + x) * 4;
        if (raw[sourceIndex + 3] < 250) return;
        edgeColours.push({
            r: raw[sourceIndex],
            g: raw[sourceIndex + 1],
            b: raw[sourceIndex + 2],
        });
    };

    for (let x = 0; x < width; x += 1) {
        addPixel(x, 0);
        addPixel(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
        addPixel(0, y);
        addPixel(width - 1, y);
    }
    const expectedEdgePixels = height > 1 ? width * 2 + (height - 2) * 2 : width;
    if (edgeColours.length !== expectedEdgePixels) return null;

    const average = edgeColours.reduce(
        (total, colour) => ({ r: total.r + colour.r, g: total.g + colour.g, b: total.b + colour.b }),
        { r: 0, g: 0, b: 0 },
    );
    average.r /= edgeColours.length;
    average.g /= edgeColours.length;
    average.b /= edgeColours.length;
    const matchingColours = edgeColours.filter((colour) => colourDistance(colour, average) <= 32);
    if (matchingColours.length / edgeColours.length < 0.85) return null;

    const background = matchingColours.reduce(
        (total, colour) => ({ r: total.r + colour.r, g: total.g + colour.g, b: total.b + colour.b }),
        { r: 0, g: 0, b: 0 },
    );
    return {
        r: Math.round(background.r / matchingColours.length),
        g: Math.round(background.g / matchingColours.length),
        b: Math.round(background.b / matchingColours.length),
    };
}

function findConnectedBackground(raw, width, height, backgroundColour) {
    const candidates = new Uint8Array(width * height);
    const connected = new Uint8Array(width * height);
    const stack = [];

    for (let index = 0; index < candidates.length; index += 1) {
        const sourceIndex = index * 4;
        const colour = {
            r: raw[sourceIndex],
            g: raw[sourceIndex + 1],
            b: raw[sourceIndex + 2],
        };
        if (raw[sourceIndex + 3] >= 250 && colourDistance(colour, backgroundColour) <= 40) {
            candidates[index] = 1;
        }
    }

    const addEdge = (index) => {
        if (candidates[index] && !connected[index]) {
            connected[index] = 1;
            stack.push(index);
        }
    };
    for (let x = 0; x < width; x += 1) {
        addEdge(x);
        addEdge((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
        addEdge(y * width);
        addEdge(y * width + width - 1);
    }

    while (stack.length > 0) {
        const index = stack.pop();
        const x = index % width;
        const y = Math.floor(index / width);
        if (x > 0) addEdge(index - 1);
        if (x + 1 < width) addEdge(index + 1);
        if (y > 0) addEdge(index - width);
        if (y + 1 < height) addEdge(index + width);
    }
    return connected;
}

function hasTransparency(raw) {
    for (let index = 3; index < raw.length; index += 4) {
        if (raw[index] < 255) return true;
    }
    return false;
}

function renderAscii(raw, options, imageWidth, imageHeight) {
    const width = options.width;
    const height = getRows(width, imageWidth, imageHeight);
    const characters = CHARACTER_SETS[options.chars];
    const values = new Float32Array(width * height);
    const colours = new Array(width * height);
    const opacities = new Array(width * height);
    const backgroundColour = options.transparent ? null : detectBackground(raw, width, height);
    const backgroundCells = backgroundColour
        ? findConnectedBackground(raw, width, height, backgroundColour)
        : new Uint8Array(width * height);
    const contrast = 1 + options.contrast / 100;
    const background = hexToRgb(THEMES[options.theme].background);
    const maximumColourDistance = Math.sqrt(3 * 255 * 255);

    for (let index = 0; index < values.length; index += 1) {
        const sourceIndex = index * 4;
        const alpha = raw[sourceIndex + 3] / 255;
        const sourceColour = {
            r: raw[sourceIndex],
            g: raw[sourceIndex + 1],
            b: raw[sourceIndex + 2],
        };
        const red = raw[sourceIndex] * alpha + background.r * (1 - alpha);
        const green = raw[sourceIndex + 1] * alpha + background.g * (1 - alpha);
        const blue = raw[sourceIndex + 2] * alpha + background.b * (1 - alpha);
        // With a detected flat background, density should describe contrast
        // from that background. Absolute brightness makes a black subject on
        // a light image background turn into spaces and effectively vanish.
        const foregroundContrast = backgroundColour
            ? clamp((colourDistance(sourceColour, backgroundColour) / maximumColourDistance) * 1.6)
            : (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        const adjusted = clamp((foregroundContrast - 0.5) * contrast + 0.5 + options.brightness / 100);
        values[index] = options.invert && !backgroundColour ? 1 - adjusted : adjusted;
        colours[index] = { r: Math.round(red), g: Math.round(green), b: Math.round(blue) };
        opacities[index] = alpha;
        if (backgroundCells[index]) {
            values[index] = 0;
        }
    }

    if (options.dither) distributeDither(values, width, height, characters.length);

    const lines = [];
    const cells = [];
    for (let y = 0; y < height; y += 1) {
        const line = [];
        const row = [];
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            const brightness = clamp(values[index]);
            const character = backgroundCells[index]
                ? ' '
                : characters[Math.round(brightness * (characters.length - 1))];
            line.push(character);
            row.push({ character, brightness, colour: colours[index], opacity: opacities[index] });
        }
        lines.push(line.join(''));
        cells.push(row);
    }
    return { width, height, lines, cells, backgroundColour };
}

function getCellColour(cell, options, palette) {
    const sourceColour = options.invert ? invertColour(cell.colour) : cell.colour;
    if (options.theme === 'original') return sourceColour;
    if (options.theme === 'gruvbox') return closestGruvboxColour(sourceColour);
    const sourceBrightness = options.invert ? 1 - cell.brightness : cell.brightness;
    const colour = paletteColor(palette, sourceBrightness);
    return options.invert ? invertColour(colour) : colour;
}

function ansiLines(result, options, palette) {
    return result.cells
        .map((row) => {
            const reset = String.fromCharCode(27) + '[0m';
            return (
                row.map((cell) => rgbToAnsi(getCellColour(cell, options, palette)) + cell.character).join('') + reset
            );
        })
        .join('\n');
}

function createSvg(result, options, palette) {
    // Keep the cell grid fixed so font-size can enlarge glyphs within the same ASCII layout.
    const cellSize = 14;
    const fontSize = options.fontSize;
    const fontWeight = options.bold ? 700 : 400;
    const lineHeight = 1.08;
    const cellWidth = cellSize * 0.602;
    const width = Math.ceil(result.width * cellWidth);
    const height = Math.ceil(result.height * cellSize * lineHeight + cellSize * 0.4);
    const rows = result.cells
        .map((row, rowIndex) => {
            let x = 0;
            const tspans = row
                .map((cell) => {
                    const opacity =
                        options.transparent && cell.opacity < 1
                            ? ' fill-opacity="' + cell.opacity.toFixed(3) + '"'
                            : '';
                    const tspan =
                        '<tspan x="' +
                        x.toFixed(2) +
                        '" fill="' +
                        rgbToHex(getCellColour(cell, options, palette)) +
                        '"' +
                        opacity +
                        '>' +
                        escapeXml(cell.character) +
                        '</tspan>';
                    x += cellWidth;
                    return tspan;
                })
                .join('');
            return '<text y="' + ((rowIndex + 1) * cellSize * lineHeight).toFixed(2) + '">' + tspans + '</text>';
        })
        .join('');
    const outputBackground =
        result.backgroundColour && !options.forceThemeBackground
            ? options.theme === 'original'
                ? result.backgroundColour
                : options.theme === 'gruvbox'
                  ? closestGruvboxColour(result.backgroundColour)
                  : hexToRgb(THEMES[options.theme].background)
            : hexToRgb(THEMES[options.theme].background);
    const renderedBackground = options.invert ? invertColour(outputBackground) : outputBackground;
    const background = options.transparent
        ? ''
        : '  <rect width="100%" height="100%" fill="' + rgbToHex(renderedBackground) + '"/>\n';
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        height +
        '" viewBox="0 0 ' +
        width +
        ' ' +
        height +
        '" xml:space="preserve">\n' +
        background +
        '  <g font-family="DejaVu Sans Mono,monospace" font-size="' +
        fontSize +
        'px" font-weight="' +
        fontWeight +
        '">' +
        rows +
        '</g>\n' +
        '</svg>\n'
    );
}

function outputFormat(output) {
    const match = output.toLowerCase().match(/(\.[^./\\]+)$/);
    const extension = match ? match[1] : '';
    if (TEXT_EXTENSIONS.has(extension)) return { kind: 'text', label: extension.slice(1).toUpperCase() };
    if (extension === '.svg') return { kind: 'svg', label: 'SVG' };
    if (RASTER_FORMATS[extension]) {
        return { kind: 'raster', label: extension.slice(1).toUpperCase(), format: RASTER_FORMATS[extension] };
    }
    const supported = [...TEXT_EXTENSIONS, '.svg', ...Object.keys(RASTER_FORMATS)].join(', ');
    fail('unsupported output extension “' + (extension || '(none)') + '”; use one of ' + supported);
}

async function writeOutput(result, options, output, palette) {
    const format = outputFormat(output);
    const separator = Math.max(output.lastIndexOf('/'), output.lastIndexOf('\\'));
    const directory = separator >= 0 ? output.slice(0, separator) : '';
    if (directory) await mkdir(directory, { recursive: true });

    if (format.kind === 'text') {
        await writeFile(output, result.lines.join('\n') + '\n');
    } else if (format.kind === 'svg') {
        await writeFile(output, createSvg(result, options, palette));
    } else {
        await sharp(Buffer.from(createSvg(result, options, palette)))
            .toFormat(format.format)
            .toFile(output);
    }
    return format.label;
}

function printSummary(result, options, sourceMetadata) {
    console.error(
        'ascii-art: ' +
            sourceMetadata.width +
            '×' +
            sourceMetadata.height +
            ' → ' +
            result.width +
            '×' +
            result.height +
            ' characters · ' +
            options.chars +
            ' ramp · ' +
            (options.dither ? 'dithered' : 'undithered'),
    );
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const source = await readFile(options.input).catch(() => null);
    if (!source) fail('could not read “' + options.input + '”.');

    try {
        const image = sharp(source).rotate();
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) fail('could not determine the image dimensions.');
        const isRotated = [5, 6, 7, 8].includes(metadata.orientation ?? 0);
        const imageWidth = isRotated ? metadata.height : metadata.width;
        const imageHeight = isRotated ? metadata.width : metadata.height;
        const rows = getRows(options.width, imageWidth, imageHeight);
        const { data } = await image
            .resize({ width: options.width, height: rows, fit: 'fill', kernel: sharp.kernel.lanczos3 })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        options.transparent = Boolean(metadata.hasAlpha && hasTransparency(data));
        const result = renderAscii(data, options, imageWidth, imageHeight);
        const palette = createPalette(options.theme);

        if (options.output) {
            const label = await writeOutput(result, options, options.output, palette);
            printSummary(result, options, { ...metadata, width: imageWidth, height: imageHeight });
            console.error('ascii-art: wrote ' + label + ' to ' + options.output);
        } else if (options.ansi && process.stdout.isTTY) {
            process.stdout.write(ansiLines(result, options, palette) + '\n');
            printSummary(result, options, { ...metadata, width: imageWidth, height: imageHeight });
        } else {
            process.stdout.write(result.lines.join('\n') + '\n');
            printSummary(result, options, { ...metadata, width: imageWidth, height: imageHeight });
        }
    } catch (error) {
        fail(error instanceof Error ? error.message : 'could not decode the image.');
    }
}

main();
