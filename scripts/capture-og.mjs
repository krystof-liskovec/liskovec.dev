import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = process.env.OG_PREVIEW_URL ?? 'http://127.0.0.1:4321/og-preview/';
const outputPath = resolve(process.argv[2] ?? 'public/og-default-v2.png');
const driverPort = 9517;
const driver = spawn('chromedriver', [`--port=${driverPort}`, '--silent'], { stdio: 'ignore' });
let devServer;
const driverUrl = `http://127.0.0.1:${driverPort}`;

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const request = async (path, options = {}) => {
    const response = await fetch(`${driverUrl}${path}`, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`ChromeDriver returned ${response.status} for ${path}`);
    return response.json();
};

const waitForDriver = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            await request('/status');
            return;
        } catch {
            await wait(100);
        }
    }
    throw new Error('ChromeDriver did not become ready');
};

const waitForPreview = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(baseUrl);
            if (response.ok) return;
        } catch {
            // Start the local Astro server below when the caller did not start one.
        }
        await wait(100);
    }
    throw new Error(`The preview server did not become ready at ${baseUrl}`);
};

const waitForScene = async (sessionId) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const result = await request(`/session/${sessionId}/execute/sync`, {
            method: 'POST',
            body: JSON.stringify({
                script: `return document.fonts.status === 'loaded' &&
                    document.querySelector('#solar-system')?.classList.contains('is-canvas-ready') &&
                    document.querySelector('#solar-canvas')?.width > 0;`,
                args: [],
            }),
        });
        if (result.value === true) return;
        await wait(100);
    }
    throw new Error('The live orrery did not become ready');
};

try {
    try {
        const response = await fetch(baseUrl);
        if (!response.ok) throw new Error(`Preview returned ${response.status}`);
    } catch {
        devServer = spawn('./node_modules/.bin/astro', ['dev', '--host', '127.0.0.1', '--port', '4321'], {
            stdio: 'inherit',
        });
    }
    await waitForPreview();
    await waitForDriver();
    const session = await request('/session', {
        method: 'POST',
        body: JSON.stringify({
            capabilities: {
                alwaysMatch: {
                    browserName: 'chrome',
                    'goog:chromeOptions': {
                        args: [
                            '--headless=new',
                            '--no-sandbox',
                            '--disable-gpu',
                            '--disable-extensions',
                            '--force-device-scale-factor=2',
                            '--window-size=1200,860',
                        ],
                    },
                },
            },
        }),
    });
    const sessionId = session.value.sessionId;

    await request(`/session/${sessionId}/window/rect`, {
        method: 'POST',
        body: JSON.stringify({ width: 1200, height: 860 }),
    });
    await request(`/session/${sessionId}/url`, {
        method: 'POST',
        body: JSON.stringify({ url: baseUrl }),
    });
    await waitForScene(sessionId);
    await wait(1800);
    const screenshot = await request(`/session/${sessionId}/goog/cdp/execute`, {
        method: 'POST',
        body: JSON.stringify({
            cmd: 'Page.captureScreenshot',
            params: {
                format: 'png',
                fromSurface: true,
                captureBeyondViewport: true,
                clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
            },
        }),
    });
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(screenshot.value.data, 'base64'));
    await request(`/session/${sessionId}`, { method: 'DELETE' });
    console.log(`Captured ${outputPath}`);
} finally {
    driver.kill();
    devServer?.kill();
}
