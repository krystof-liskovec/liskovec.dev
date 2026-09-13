import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const layout = await readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
const detection = [...layout.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((script) => script.includes('navigator.languages'));
assert.ok(detection, 'The language detector runs inline before the page renders.');
const header = await readFile(new URL('../src/components/SiteHeader.astro', import.meta.url), 'utf8');
const switcher = ts.transpileModule(header.match(/<script>([\s\S]*?)<\/script>/)[1], {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function storage(saved, blocked = false) {
    return {
        getItem(key) {
            assert.equal(key, 'liskovec-language');
            if (blocked) throw new Error('Storage blocked');
            return saved;
        },
        setItem(key, value) {
            assert.equal(key, 'liskovec-language');
            if (blocked) throw new Error('Storage blocked');
            saved = value;
        },
    };
}

function visit({ url = '/', languages = ['en-US'], language = languages[0], saved = null, blocked = false } = {}) {
    let current = new URL(url, 'https://liskovec.dev');
    let redirected;
    const localStorage = storage(saved, blocked);
    const location = {
        get pathname() {
            return current.pathname;
        },
        get href() {
            return current.href;
        },
        replace(url) {
            redirected = url;
        },
    };
    runInNewContext(detection, {
        URL,
        location,
        navigator: { languages, language },
        localStorage,
        history: {
            state: null,
            replaceState(_state, _title, url) {
                current = new URL(url, current);
            },
        },
    });
    return { redirected, current: current.href, saved: blocked ? null : localStorage.getItem('liskovec-language') };
}

for (const [languages, expected] of [
    [['de-DE'], '/de/'],
    [['de-AT'], '/de/'],
    [['cs-CZ'], '/cs/'],
    [['fr-FR', 'cs-CZ', 'en'], '/cs/'],
    [['fr', 'en-GB', 'de'], undefined],
    [['fr', 'es'], undefined],
    [['en-US'], undefined],
    [[], undefined],
]) {
    test(`browser preferences: ${languages.join(', ') || 'none'}`, () => {
        assert.equal(visit({ languages }).redirected, expected ? 'https://liskovec.dev' + expected : undefined);
    });
}
test('navigator.language is used when the preference list is empty', () => {
    assert.equal(visit({ languages: [], language: 'CS-cz' }).redirected, 'https://liskovec.dev/cs/');
});
test('saved manual choices take precedence, including English', () => {
    assert.equal(visit({ languages: ['de'], saved: 'en' }).redirected, undefined);
    assert.equal(visit({ languages: ['de'], saved: 'cs' }).redirected, 'https://liskovec.dev/cs/');
    assert.equal(visit({ languages: ['cs'], saved: 'invalid' }).redirected, 'https://liskovec.dev/cs/');
});
test('automatic redirects preserve search parameters and section anchors', () => {
    assert.equal(
        visit({ url: '/?ref=portfolio#contact', languages: ['de'] }).redirected,
        'https://liskovec.dev/de/?ref=portfolio#contact',
    );
});
test('direct localized and blog URLs are not negotiated', () => {
    for (const url of ['/de/', '/cs/', '/de/blog/', '/blog/', '/blog/hello-world/', '/404', '/og-preview/']) {
        assert.equal(visit({ url, saved: 'cs', languages: ['de'] }).redirected, undefined, url);
    }
});
test('blocked storage still allows browser detection', () => {
    assert.equal(visit({ languages: ['cs-CZ'], blocked: true }).redirected, 'https://liskovec.dev/cs/');
});
test('an explicit English choice works without storage and cannot loop', () => {
    const result = visit({ url: '/?lang=en&ref=cv#about', languages: ['de'], blocked: true });
    assert.equal(result.redirected, undefined);
    assert.equal(result.current, 'https://liskovec.dev/?lang=en&ref=cv#about');
});
test('a URL choice overrides old preferences and is cleaned up when it can be saved', () => {
    const result = visit({ url: '/?lang=en&ref=cv#about', languages: ['de'], saved: 'cs' });
    assert.equal(result.redirected, undefined);
    assert.equal(result.saved, 'en');
    assert.equal(result.current, 'https://liskovec.dev/?ref=cv#about');
});
test('an unsupported URL choice is ignored', () => {
    assert.equal(visit({ url: '/?lang=fr', languages: ['de'] }).redirected, 'https://liskovec.dev/de/?lang=fr');
});

function choose(language, { blocked = false, path = '/', event = 'click', preserveHash = true } = {}) {
    const localStorage = storage(null, blocked);
    const listeners = new Map();
    const link = {
        href: 'https://liskovec.dev' + path,
        dataset: { language },
        hasAttribute: () => preserveHash,
        addEventListener: (name, callback) => listeners.set(name, callback),
    };
    runInNewContext(switcher, {
        URL,
        localStorage,
        location: { hash: '#contact' },
        document: { querySelector: () => null, addEventListener() {}, querySelectorAll: () => [link] },
    });
    listeners.get(event)({ button: 1 });
    return { href: link.href, saved: blocked ? null : localStorage.getItem('liskovec-language') };
}
test('manual switching remembers every language and preserves the section', () => {
    for (const language of ['en', 'de', 'cs']) {
        const path = language === 'en' ? '/' : `/${language}/`;
        const result = choose(language, { path });
        assert.equal(result.saved, language);
        assert.equal(result.href, 'https://liskovec.dev' + path + '#contact');
    }
});
test('middle-click switching also remembers the language', () => {
    assert.equal(choose('cs', { path: '/cs/', event: 'auxclick' }).saved, 'cs');
});
test('switching to English without storage uses the explicit fallback', () => {
    const result = choose('en', { blocked: true });
    assert.equal(result.href, 'https://liskovec.dev/?lang=en#contact');
    assert.equal(visit({ url: result.href, blocked: true, languages: ['cs'] }).redirected, undefined);
});
test('missing-translation links do not carry unrelated article anchors', () => {
    assert.equal(choose('cs', { path: '/cs/blog/', preserveHash: false }).href, 'https://liskovec.dev/cs/blog/');
});
