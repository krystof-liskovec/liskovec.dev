export const locales = ['en', 'de', 'cs'] as const;
export type Locale = (typeof locales)[number];
export const localizedLocales = ['de', 'cs'] as const;
export const localeNames: Record<Locale, string> = { en: 'English', de: 'Deutsch', cs: 'Čeština' };
export const dateLocales: Record<Locale, string> = { en: 'en-GB', de: 'de-DE', cs: 'cs-CZ' };
export const ogLocales: Record<Locale, string> = { en: 'en_US', de: 'de_DE', cs: 'cs_CZ' };

export function getLocale(pathname: string): Locale {
    const prefix = pathname.split('/')[1];
    return prefix === 'de' || prefix === 'cs' ? prefix : 'en';
}

export function stripLocale(pathname: string): string {
    return pathname.replace(/^\/(de|cs)(?=\/|$)/, '') || '/';
}

export function localizedPath(pathname: string, locale: Locale): string {
    const path = stripLocale(pathname);
    return locale === 'en' ? path : `/${locale}${path.startsWith('/') ? path : '/' + path}`;
}

// English is the source language. Keep technical identifiers and brand names unchanged.
const translations: Record<string, readonly [string, string]> = {
    "Kryštof Lískovec | DevOps & Software Developer": [
        "Kryštof Lískovec | DevOps & Softwareentwickler",
        "Kryštof Lískovec | DevOps a vývojář softwaru"
    ],
    "Kryštof Lískovec is a software developer working across DevOps, reliable systems, internal tools, and useful software.": [
        "Kryštof Lískovec entwickelt Software und arbeitet an DevOps, zuverlässigen Systemen und praktischen internen Werkzeugen.",
        "Kryštof Lískovec je vývojář softwaru zaměřený na DevOps, spolehlivé systémy a užitečné interní nástroje."
    ],
    "Software developer working across DevOps, reliable systems, services, internal tools, and deployment automation.": [
        "Softwareentwickler mit Fokus auf DevOps, zuverlässige Systeme, Dienste, interne Werkzeuge und automatisierte Deployments.",
        "Vývojář softwaru se zaměřením na DevOps, spolehlivé systémy, služby, interní nástroje a automatizaci nasazování."
    ],
    "Software developer from the Czech Republic working across DevOps, reliable systems, services, internal tools, and deployment automation.": [
        "Softwareentwickler aus Tschechien mit Fokus auf DevOps, zuverlässige Systeme, Dienste, interne Werkzeuge und automatisierte Deployments.",
        "Vývojář softwaru z České republiky se zaměřením na DevOps, spolehlivé systémy, služby, interní nástroje a automatizaci nasazování."
    ],
    "Software Developer": [
        "Softwareentwickler",
        "Vývojář softwaru"
    ],
    "Czech Republic": [
        "Tschechien",
        "Česká republika"
    ],
    "Software development": [
        "Softwareentwicklung",
        "Vývoj softwaru"
    ],
    "Containers": [
        "Container",
        "Kontejnery"
    ],
    "Infrastructure automation": [
        "Infrastrukturautomatisierung",
        "Automatizace infrastruktury"
    ],
    "A Gruvbox-inspired ASCII solar system orrery beside the name Kryštof Lískovec": [
        "Ein ASCII-Modell des Sonnensystems im Gruvbox-Stil neben dem Namen Kryštof Lískovec",
        "ASCII model sluneční soustavy ve stylu Gruvbox vedle jména Kryštof Lískovec"
    ],
    "Kryštof Liskovec’s blog": [
        "Blog von Kryštof Lískovec",
        "Blog Kryštofa Lískovce"
    ],
    "Kryštof Lískovec home": [
        "Kryštof Lískovec – Startseite",
        "Kryštof Lískovec – úvodní stránka"
    ],
    "devops · software developer": [
        "devops · softwareentwickler",
        "devops · vývojář softwaru"
    ],
    "Primary navigation": [
        "Hauptnavigation",
        "Hlavní navigace"
    ],
    "Language": [
        "Sprache",
        "Jazyk"
    ],
    "about": [
        "über mich",
        "o mně"
    ],
    "contact": [
        "kontakt",
        "kontakt"
    ],
    "blog": [
        "blog",
        "blog"
    ],
    "made with curiosity + caffeine": [
        "mit neugier + koffein gebaut",
        "postaveno ze zvědavosti + kofeinu"
    ],
    "somewhere": [
        "irgendwo",
        "někde"
    ],
    "in the solar system.": [
        "im sonnensystem.",
        "ve sluneční soustavě."
    ],
    "A live, approximate ASCII visualization of the Solar System and the Milky Way galaxy": [
        "Eine animierte ASCII-Ansicht von Sonnensystem und Milchstraße mit ungefähren Positionen",
        "Animovaný ASCII pohled na sluneční soustavu a Mléčnou dráhu s přibližnými polohami"
    ],
    "An interactive ASCII visualization of the Solar System and the Milky Way galaxy introduces Kryštof Lískovec’s portfolio. Use the zoom controls to move between the Solar System and the Milky Way galaxy, and use the arrow keys to turn the current view. The portfolio content continues below with information about his DevOps and software development work, technical skills, blog posts, and contact details.": [
        "Mein Portfolio beginnt mit einer interaktiven ASCII-Ansicht von Sonnensystem und Milchstraße. Mit dem Zoom wechselst du zwischen beiden; mit den Pfeiltasten drehst du die Ansicht. Darunter geht es um meine Arbeit in DevOps und Softwareentwicklung, meine Kenntnisse, Blogbeiträge und Kontaktmöglichkeiten.",
        "Portfolio Kryštofa Lískovce začíná interaktivním ASCII pohledem na sluneční soustavu a Mléčnou dráhu. Přiblížením mezi nimi přepínáte, šipkami otáčíte pohled. Níže píšu o své práci v DevOps a vývoji softwaru, o tom, co umím, a najdete tu i blog a kontakt."
    ],
    "Focus the Solar System and Milky Way galaxy animation with Tab. Press Enter to choose a planet, use the arrow keys to move between planets or Sol, and press Enter again to zoom in. In a focused planetary scene, use Tab or the arrow keys to choose a moon or station. Press Escape to zoom out and Space to return to camera controls.": [
        "Mit Tab gelangst du zur Animation. Drücke Enter, um ein Objekt auszuwählen, wechsle mit den Pfeiltasten zwischen den Planeten und der Sonne und drücke erneut Enter zum Heranzoomen. In der Planetenansicht wählst du mit Tab oder den Pfeiltasten einen Mond oder eine Station. Mit Escape zoomst du heraus, mit der Leertaste steuerst du wieder die Kamera.",
        "Na animaci přejdete klávesou Tab. Stiskněte Enter, šipkami vyberte planetu nebo Slunce a dalším stisknutím Enter se přibližte. U planety můžete klávesou Tab nebo šipkami vybrat měsíc či stanici. Escape pohled oddálí a mezerník vrátí ovládání kamery."
    ],
    "Interactive ASCII Solar System and Milky Way galaxy with live approximate planetary positions": [
        "Interaktives ASCII-Sonnensystem und Milchstraße mit laufend berechneten, ungefähren Planetenpositionen",
        "Interaktivní ASCII sluneční soustava a Mléčná dráha s průběžně počítanými přibližnými polohami planet"
    ],
    "[ ← return ]": [
        "[ ← zurück ]",
        "[ ← zpět ]"
    ],
    "Open fullscreen animation": [
        "Animation im Vollbild öffnen",
        "Otevřít animaci na celou obrazovku"
    ],
    "tilt phone sideways": [
        "handy quer halten",
        "otočte telefon na šířku"
    ],
    "Cosmic zoom controls": [
        "Zoom für Sonnensystem und Milchstraße",
        "Ovládání přiblížení sluneční soustavy a Mléčné dráhy"
    ],
    "Zoom between the Solar System and the Milky Way": [
        "Zwischen Sonnensystem und Milchstraße zoomen",
        "Přecházet mezi sluneční soustavou a Mléčnou dráhou"
    ],
    "MILKY WAY": [
        "MILCHSTRASSE",
        "MLÉČNÁ DRÁHA"
    ],
    "SOL": [
        "SONNE",
        "SLUNCE"
    ],
    "0%, local system": [
        "0 %, sonnensystem",
        "0 %, sluneční soustava"
    ],
    "LOCAL SYSTEM": [
        "SONNENSYSTEM",
        "SLUNEČNÍ SOUSTAVA"
    ],
    "Simulation speed": [
        "Simulationsgeschwindigkeit",
        "Rychlost simulace"
    ],
    "Switch between the Solar System and the Milky Way": [
        "Zwischen Sonnensystem und Milchstraße wechseln",
        "Přepnout mezi sluneční soustavou a Mléčnou dráhou"
    ],
    "GALAXY": [
        "GALAXIE",
        "GALAXIE"
    ],
    "UTC / BROWSER TIME": [
        "UTC / BROWSERZEIT",
        "UTC / ČAS PROHLÍŽEČE"
    ],
    "↓ scroll to learn more": [
        "↓ mehr erfahren",
        "↓ zjistěte víc"
    ],
    "01 / about me": [
        "01 / über mich",
        "01 / o mně"
    ],
    "i build reliable software and the systems it runs on.": [
        "ich baue zuverlässige software und die systeme, auf denen sie läuft.",
        "vyvíjím spolehlivý software i systémy, na kterých běží."
    ],
    "hi there, i’m Kryštof Lískovec, a software developer from the Czech Republic. i started in backend development. devops and infrastructure came later.": [
        "hey, ich bin Kryštof Lískovec, softwareentwickler aus Tschechien. angefangen habe ich im backend, später kamen devops und infrastruktur dazu.",
        "ahoj, jsem Kryštof Lískovec, vývojář z Česka. začínal jsem u backendu, k devops a infrastruktuře jsem se dostal až později."
    ],
    "these days my work sits between both. i still write code, while also working with containers, on-prem infrastructure, CI/CD, and deployments that should not wake anyone up at night. along the way, i’ve helped move older codebases towards safer, faster and more maintainable setups.": [
        "heute mache ich beides: ich schreibe code und kümmere mich um container, eigene server, CI/CD und deployments, die nachts niemanden wecken. nebenbei habe ich ältere projekte sicherer, schneller und leichter wartbar gemacht.",
        "dnes dělám obojí. pořád píšu kód, ale starám se i o kontejnery, vlastní servery, CI/CD a nasazení, kvůli kterým nemusí nikdo v noci vstávat. pomáhal jsem také upravit starší projekty tak, aby byly bezpečnější, rychlejší a snáz se udržovaly."
    ],
    "outside of work, i’m usually somewhere around Linux, my homelab, or open-source projects.": [
        "auch nach feierabend lande ich meistens bei Linux, meinem homelab oder open-source-projekten.",
        "i po práci mě často najdete u Linuxu, domácího labu nebo open-source projektů."
    ],
    "cv": [
        "lebenslauf",
        "životopis"
    ],
    "02 / toolbox": [
        "02 / werkzeugkasten",
        "02 / nástroje"
    ],
    "operations": [
        "betrieb",
        "provoz"
    ],
    "data": [
        "daten",
        "data"
    ],
    "backend": [
        "backend",
        "backend"
    ],
    "frontend": [
        "frontend",
        "frontend"
    ],
    "03 / contact": [
        "03 / kontakt",
        "03 / kontakt"
    ],
    "email": [
        "e-mail",
        "e-mail"
    ],
    "04 / featured posts": [
        "04 / ausgewählte beiträge",
        "04 / vybrané příspěvky"
    ],
    "[ visit the blog → ]": [
        "[ zum blog → ]",
        "[ navštívit blog → ]"
    ],
    "Nothing here yet.": [
        "Hier gibt es noch nichts.",
        "Zatím tu nic není."
    ],
    "Random adventures and struggles - mostly about software and whatever I am figuring out.": [
        "Kleine Abenteuer und Stolpersteine – meist mit Software und Dingen, an denen ich gerade tüftle.",
        "Malá dobrodružství a občasné záseky – většinou se softwarem a věcmi, kterým zrovna přicházím na kloub."
    ],
    "Random adventures and struggles from Kryštof Lískovec - mostly about software and whatever he's figuring out.": [
        "Kleine Abenteuer und Stolpersteine von Kryštof Lískovec – meist mit Software und Dingen, an denen er gerade tüftelt.",
        "Malá dobrodružství a občasné záseky Kryštofa Lískovce – většinou se softwarem a věcmi, kterým zrovna přichází na kloub."
    ],
    "Random adventures and struggles - mostly about software, DevOps, and whatever I happen to be figuring out.": [
        "Kleine Abenteuer und Stolpersteine – meist mit Software, DevOps und Dingen, an denen ich gerade tüftle.",
        "Malá dobrodružství a občasné záseky – většinou se softwarem, DevOps a věcmi, kterým zrovna přicházím na kloub."
    ],
    "random adventures": [
        "kleine abenteuer",
        "malá dobrodružství"
    ],
    "and struggles.": [
        "und stolpersteine.",
        "a občasné záseky."
    ],
    "mostly about software and whatever i happen to be figuring out. sometimes with opinions included.": [
        "meistens über software und dinge, an denen ich gerade tüftle. ab und zu mit einer meinung dazu.",
        "hlavně o softwaru a věcech, kterým zrovna přicházím na kloub. občas přidám i svůj názor."
    ],
    "all posts": [
        "alle beiträge",
        "všechny příspěvky"
    ],
    "[ subscribe via rss → ]": [
        "[ per rss abonnieren → ]",
        "[ odebírat přes rss → ]"
    ],
    "[ ← ALL POSTS ]": [
        "[ ← ALLE BEITRÄGE ]",
        "[ ← VŠECHNY PŘÍSPĚVKY ]"
    ],
    "updated": [
        "aktualisiert",
        "aktualizováno"
    ],
    "404 | Not Found | Kryštof Lískovec": [
        "404 | Nicht gefunden | Kryštof Lískovec",
        "404 | Nenalezeno | Kryštof Lískovec"
    ],
    "The requested page could not be found.": [
        "Diese Seite gibt es leider nicht.",
        "Tuhle stránku se nepodařilo najít."
    ],
    "404 - not found": [
        "404 - nicht gefunden",
        "404 - nenalezeno"
    ],
    "your lander drifted": [
        "dein lander ist",
        "tvůj modul odletěl"
    ],
    "somewhere else…": [
        "woanders gelandet…",
        "někam jinam…"
    ],
    "404 navigation": [
        "404-Navigation",
        "Navigace stránky 404"
    ],
    "[ return home → ]": [
        "[ zur startseite → ]",
        "[ zpět na úvod → ]"
    ]
};

export function translate(locale: Locale, text: string): string {
    if (locale === 'en') return text;
    return translations[text]?.[locale === 'de' ? 0 : 1] ?? text;
}

export function getTranslator(locale: Locale) {
    return (text: string) => translate(locale, text);
}
