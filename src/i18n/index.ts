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
        "mit neugier + koffein gemacht",
        "vytvořeno se zvědavostí + kofeinem"
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
        "Eine laufende, vereinfachte ASCII-Visualisierung des Sonnensystems und der Milchstraße",
        "Živá přibližná ASCII vizualizace sluneční soustavy a Mléčné dráhy"
    ],
    "An interactive ASCII visualization of the Solar System and the Milky Way galaxy introduces Kryštof Lískovec’s portfolio. Use the zoom controls to move between the Solar System and the Milky Way galaxy, and use the arrow keys to turn the current view. The portfolio content continues below with information about his DevOps and software development work, technical skills, blog posts, and contact details.": [
        "Eine interaktive ASCII-Visualisierung des Sonnensystems und der Milchstraße eröffnet das Portfolio von Kryštof Lískovec. Mit dem Zoom wechseln Sie zwischen Sonnensystem und Milchstraße; mit den Pfeiltasten drehen Sie die Ansicht. Weiter unten finden Sie Informationen zu seiner Arbeit in DevOps und Softwareentwicklung, seinen technischen Kenntnissen, Blogbeiträgen und Kontaktdaten.",
        "Portfolio Kryštofa Lískovce uvádí interaktivní ASCII vizualizace sluneční soustavy a Mléčné dráhy. Ovládáním přiblížení přecházejte mezi sluneční soustavou a Mléčnou dráhou, šipkami otáčejte pohled. Níže najdete informace o jeho práci v DevOps a vývoji softwaru, technických dovednostech, blogové příspěvky a kontaktní údaje."
    ],
    "Focus the Solar System and Milky Way galaxy animation with Tab. Press Enter to choose a planet, use the arrow keys to move between planets or Sol, and press Enter again to zoom in. In a focused planetary scene, use Tab or the arrow keys to choose a moon or station. Press Escape to zoom out and Space to return to camera controls.": [
        "Wählen Sie die Animation mit Tab aus. Drücken Sie Enter, um ein Objekt auszuwählen, wechseln Sie mit den Pfeiltasten zwischen Planeten und Sonne und drücken Sie erneut Enter zum Heranzoomen. In einer Planetenansicht wählen Sie mit Tab oder den Pfeiltasten einen Mond oder eine Station. Escape zoomt heraus; die Leertaste kehrt zur Kamerasteuerung zurück.",
        "Klávesou Tab přejděte na animaci. Enter zahájí výběr objektu, šipkami přecházejte mezi planetami a Sluncem a dalším stisknutím Enter se přibližte. V přiblížené scéně vybírejte měsíc nebo stanici klávesou Tab či šipkami. Escape oddálí pohled a mezerník vás vrátí k ovládání kamery."
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
        "telefon seitlich neigen",
        "nakloňte telefon do strany"
    ],
    "Cosmic zoom controls": [
        "Kosmische Zoomsteuerung",
        "Ovládání kosmického přiblížení"
    ],
    "Zoom between the Solar System and the Milky Way": [
        "Zwischen Sonnensystem und Milchstraße zoomen",
        "Přiblížení mezi sluneční soustavou a Mléčnou dráhou"
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
        "ich entwickle zuverlässige software und die systeme dahinter.",
        "vyvíjím spolehlivý software i systémy, na kterých běží."
    ],
    "hi there, i’m Kryštof Lískovec, a software developer from the Czech Republic working across devops, infrastructure, and generally software development. my story began in backend development and gradually expanded into devops.": [
        "hallo, ich bin Kryštof Lískovec, softwareentwickler aus Tschechien. ich arbeite an devops, infrastruktur und softwareentwicklung im allgemeinen. angefangen habe ich in der backend-entwicklung, später kam devops dazu.",
        "ahoj, jsem Kryštof Lískovec, vývojář softwaru z České republiky. věnuji se devops, infrastruktuře a vývoji softwaru obecně. začínal jsem s backendem a postupně se dostal i k devops."
    ],
    "these days my work sits between both. i still write code, while also working with containers, on-prem infrastructure, CI/CD, and deployments that should not wake anyone up at night. along the way, i’ve helped move older codebases towards safer, faster and more maintainable setups.": [
        "heute verbinde ich beides. ich schreibe weiterhin code und kümmere mich um container, on-prem-infrastruktur, CI/CD und deployments, die niemanden nachts wecken sollten. dabei habe ich auch ältere codebasen sicherer, schneller und wartbarer gemacht.",
        "dnes propojuji obě oblasti. pořád píšu kód, ale pracuji také s kontejnery, on-prem infrastrukturou, CI/CD a nasazováním, které by nemělo nikoho budit v noci. pomáhal jsem také posouvat starší projekty k bezpečnějšímu, rychlejšímu a lépe udržovatelnému řešení."
    ],
    "outside of work, i’m usually somewhere around Linux, my homelab, or open-source projects.": [
        "außerhalb der arbeit beschäftige ich mich meistens mit Linux, meinem homelab oder open-source-projekten.",
        "mimo práci mě obvykle najdete u Linuxu, domácího labu nebo open-source projektů."
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
        "Zufällige Abenteuer und Herausforderungen – meistens rund um Software und alles, womit ich mich gerade beschäftige.",
        "Náhodná dobrodružství a trápení – hlavně o softwaru a o tom, co právě zkoumám."
    ],
    "Random adventures and struggles from Kryštof Lískovec - mostly about software and whatever he's figuring out.": [
        "Abenteuer und Herausforderungen von Kryštof Lískovec – meistens rund um Software und alles, womit er sich gerade beschäftigt.",
        "Dobrodružství a trápení Kryštofa Lískovce – hlavně o softwaru a o tom, co právě zkoumá."
    ],
    "Random adventures and struggles - mostly about software, DevOps, and whatever I happen to be figuring out.": [
        "Abenteuer und Herausforderungen – meistens rund um Software, DevOps und alles, womit ich mich gerade beschäftige.",
        "Dobrodružství a trápení – hlavně o softwaru, DevOps a o tom, co právě zkoumám."
    ],
    "random adventures": [
        "zufällige abenteuer",
        "náhodná dobrodružství"
    ],
    "and struggles.": [
        "und herausforderungen.",
        "a trápení."
    ],
    "mostly about software and whatever i happen to be figuring out. sometimes with opinions included.": [
        "meistens über software und alles, womit ich mich gerade beschäftige. manchmal auch mit einer meinung dazu.",
        "hlavně o softwaru a o tom, co právě zkoumám. občas i s vlastním názorem."
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
        "Die angeforderte Seite wurde nicht gefunden.",
        "Požadovaná stránka nebyla nalezena."
    ],
    "404 - not found": [
        "404 - nicht gefunden",
        "404 - nenalezeno"
    ],
    "your lander drifted": [
        "dein lander ist",
        "váš modul odletěl"
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
