// Translate display copy only: astronomy names remain stable simulation identifiers.
type Language = 'en' | 'de' | 'cs';
const copy: Record<string, readonly [string, string]> = {
    "near Mercury.": ["beim Merkur.", "poblíž Merkuru."],
    "near Venus.": ["bei der Venus.", "poblíž Venuše."],
    "near Earth.": ["bei der Erde.", "poblíž Země."],
    "near Mars.": ["beim Mars.", "poblíž Marsu."],
    "near Jupiter.": ["beim Jupiter.", "poblíž Jupiteru."],
    "near Saturn.": ["beim Saturn.", "poblíž Saturnu."],
    "near Uranus.": ["beim Uranus.", "poblíž Uranu."],
    "near Neptune.": ["beim Neptun.", "poblíž Neptunu."],
    "near Pluto.": ["beim Pluto.", "poblíž Pluta."],
    "near Sol.": ["bei der Sonne.", "poblíž Slunce."],
    "near Moon.": ["beim Mond.", "poblíž Měsíce."],
    "near Europa.": ["bei Europa.", "poblíž Europy."],
    "near Rhea.": ["bei Rhea.", "poblíž Rhey."],
    "near Titan.": ["beim Titan.", "poblíž Titanu."],
    "near Titania.": ["bei Titania.", "poblíž Titanie."],
    "near Oberon.": ["bei Oberon.", "poblíž Oberonu."],
    "near Triton.": ["bei Triton.", "poblíž Tritonu."],
    "near Charon.": ["bei Charon.", "poblíž Charonu."],
    "near Hydra.": ["bei Hydra.", "poblíž Hydry."],
    "Mercury": [
        "Merkur",
        "Merkur"
    ],
    "Venus": [
        "Venus",
        "Venuše"
    ],
    "Earth": [
        "Erde",
        "Země"
    ],
    "Mars": [
        "Mars",
        "Mars"
    ],
    "Jupiter": [
        "Jupiter",
        "Jupiter"
    ],
    "Saturn": [
        "Saturn",
        "Saturn"
    ],
    "Uranus": [
        "Uranus",
        "Uran"
    ],
    "Neptune": [
        "Neptun",
        "Neptun"
    ],
    "Pluto": [
        "Pluto",
        "Pluto"
    ],
    "Sol": [
        "Sonne",
        "Slunce"
    ],
    "Moon": [
        "Mond",
        "Měsíc"
    ],
    "Halley's Comet": [
        "Halleyscher Komet",
        "Halleyova kometa"
    ],
    "International Space Station": [
        "Internationale Raumstation",
        "Mezinárodní vesmírná stanice"
    ],
    "Crab Nebula": [
        "Krebsnebel",
        "Krabí mlhovina"
    ],
    "Cassiopeia A": [
        "Cassiopeia A",
        "Kasiopeja A"
    ],
    "terrestrial planet": [
        "gesteinsplanet",
        "terestrická planeta"
    ],
    "gas giant": [
        "gasriese",
        "plynný obr"
    ],
    "ice giant": [
        "eisriese",
        "ledový obr"
    ],
    "Kuiper Belt dwarf planet": [
        "zwergplanet im Kuipergürtel",
        "trpasličí planeta Kuiperova pásu"
    ],
    "smallest planet / 88-day year": [
        "kleinster planet / jahr: 88 tage",
        "nejmenší planeta / rok: 88 dní"
    ],
    "solar day: 176 Earth days": [
        "sonnentag: 176 erdtage",
        "sluneční den: 176 pozemských dní"
    ],
    "hottest / retrograde rotation": [
        "heißester planet / rückläufige rotation",
        "nejteplejší planeta / retrográdní rotace"
    ],
    "a day outlasts its year": [
        "ein tag dauert länger als ein jahr",
        "den trvá déle než rok"
    ],
    "liquid-water ocean / one moon": [
        "ozeane aus flüssigem wasser / ein mond",
        "oceány kapalné vody / jeden měsíc"
    ],
    "only known world with life": [
        "einzige bekannte welt mit leben",
        "jediný známý svět se životem"
    ],
    "iron-rich surface / two moons": [
        "eisenreiche oberfläche / zwei monde",
        "povrch bohatý na železo / dva měsíce"
    ],
    "hosts the largest known volcano": [
        "beherbergt den größten bekannten vulkan",
        "má největší známou sopku"
    ],
    "Great Red Spot / Galilean moons": [
        "Großer Roter Fleck / galileische monde",
        "Velká rudá skvrna / Galileovy měsíce"
    ],
    "storm active for centuries": [
        "sturm seit jahrhunderten aktiv",
        "bouře trvající staletí"
    ],
    "broad ring system / Titan": [
        "breites ringsystem / Titan",
        "rozsáhlá soustava prstenců / Titan"
    ],
    "less dense than water": [
        "geringere dichte als wasser",
        "nižší hustota než voda"
    ],
    "sideways rotation / faint rings": [
        "seitliche rotation / schwache ringe",
        "rotace na boku / slabé prstence"
    ],
    "orbits nearly on its side": [
        "umlauf fast auf der seite",
        "obíhá téměř na boku"
    ],
    "fastest planetary winds / Triton": [
        "schnellste planetare winde / Triton",
        "nejrychlejší planetární větry / Triton"
    ],
    "winds exceed 2,000 km/h": [
        "winde über 2.000 km/h",
        "vítr přesahuje 2 000 km/h"
    ],
    "Tombaugh Regio / five moons": [
        "Tombaugh Regio / fünf monde",
        "Tombaugh Regio / pět měsíců"
    ],
    "mutually locked with Charon": [
        "gegenseitig gebunden mit Charon",
        "vzájemně vázaná rotace s Charonem"
    ],
    "supermassive black hole": [
        "supermassereiches schwarzes loch",
        "supermasivní černá díra"
    ],
    "stellar black hole": [
        "stellares schwarzes loch",
        "hvězdná černá díra"
    ],
    "supernova remnant": [
        "supernova-überrest",
        "pozůstatek supernovy"
    ],
    "luminous blue variable": [
        "leuchtkräftiger blauer veränderlicher",
        "jasná modrá proměnná hvězda"
    ],
    "globular cluster": [
        "kugelsternhaufen",
        "kulová hvězdokupa"
    ],
    "young pulsar / wind nebula": [
        "junger pulsar / windnebel",
        "mladý pulsar / větrná mlhovina"
    ],
    "galactic centre": [
        "galaktisches zentrum",
        "galaktické centrum"
    ],
    "mass: ~4 million Suns": [
        "masse: ~4 millionen sonnen",
        "hmotnost: ~4 miliony Sluncí"
    ],
    "x-ray binary system": [
        "röntgendoppelstern",
        "rentgenová dvojhvězda"
    ],
    "helped confirm stellar black holes": [
        "half, stellare schwarze löcher zu bestätigen",
        "pomohla potvrdit hvězdné černé díry"
    ],
    "pulsar wind nebula": [
        "pulsarwindnebel",
        "pulsarová větrná mlhovina"
    ],
    "pulsar flashes 30 times/s": [
        "pulsar blitzt 30-mal/s",
        "pulsar bliká 30krát/s"
    ],
    "Homunculus Nebula": [
        "Homunkulusnebel",
        "mlhovina Homunkulus"
    ],
    "survived its 1840s eruption": [
        "überstand ihren ausbruch in den 1840ern",
        "přežila erupci ve 40. letech 19. století"
    ],
    "young expanding shell": [
        "junge expandierende hülle",
        "mladá rozpínající se obálka"
    ],
    "debris is still racing outward": [
        "trümmer rasen weiterhin nach außen",
        "trosky stále letí ven"
    ],
    "halo star cluster": [
        "sternhaufen im halo",
        "hvězdokupa v halu"
    ],
    "contains ~10 million stars": [
        "enthält ~10 millionen sterne",
        "obsahuje ~10 milionů hvězd"
    ],
    "~7 rotations/s / MSH 15-52": [
        "~7 umdrehungen/s / MSH 15-52",
        "~7 otáček/s / MSH 15-52"
    ],
    "neutron star is only ~20 km wide": [
        "neutronenstern nur ~20 km breit",
        "neutronová hvězda má průměr jen ~20 km"
    ],
    "moon of Mars": [
        "mond des Mars",
        "měsíc Marsu"
    ],
    "Galilean moon": [
        "galileischer mond",
        "Galileův měsíc"
    ],
    "moon of Saturn": [
        "mond des Saturn",
        "měsíc Saturnu"
    ],
    "moon of Uranus": [
        "mond des Uranus",
        "měsíc Uranu"
    ],
    "moon of Neptune": [
        "mond des Neptun",
        "měsíc Neptunu"
    ],
    "moon of Pluto": [
        "mond des Pluto",
        "měsíc Pluta"
    ],
    "periodic comet / 1P": [
        "periodischer komet / 1P",
        "periodická kometa / 1P"
    ],
    "q 0.586 AU / retrograde orbit": [
        "q 0,586 AE / rückläufige bahn",
        "q 0,586 AU / retrográdní dráha"
    ],
    "next perihelion: 2061": [
        "nächstes perihel: 2061",
        "příští přísluní: 2061"
    ],
    "retrograde orbit / ~75.3-year period": [
        "rückläufige bahn / periode ~75,3 jahre",
        "retrográdní dráha / perioda ~75,3 roku"
    ],
    "G-type main-sequence star": [
        "hauptreihenstern vom typ G",
        "hvězda hlavní posloupnosti typu G"
    ],
    "1.000 solar mass / system barycentre": [
        "1,000 sonnenmasse / baryzentrum des systems",
        "1,000 hmotnosti Slunce / barycentrum soustavy"
    ],
    "contains 99.8% of system mass": [
        "enthält 99,8 % der systemmasse",
        "obsahuje 99,8 % hmotnosti soustavy"
    ],
    "~4.6 billion years": [
        "~4,6 milliarden jahre",
        "~4,6 miliardy let"
    ],
    "natural satellite": [
        "natürlicher satellit",
        "přirozená družice"
    ],
    "orbital laboratory": [
        "orbitallabor",
        "orbitální laboratoř"
    ],
    "low Earth orbit / ~90 min period": [
        "niedrige erdumlaufbahn / periode ~90 min",
        "nízká oběžná dráha Země / perioda ~90 min"
    ],
    "mean distance": [
        "mittlere entfernung",
        "střední vzdálenost"
    ],
    "mean r": [
        "mittl. r",
        "střední r"
    ],
    "sidereal": [
        "siderisch",
        "siderická doba"
    ],
    "period": [
        "periode",
        "perioda"
    ],
    "hours": [
        "stunden",
        "hodin"
    ],
    "days": [
        "tage",
        "dní"
    ],
    "retrograde": [
        "rückläufig",
        "retrográdní"
    ],
    "lon": [
        "länge",
        "délka"
    ],
    "lat": [
        "breite",
        "šířka"
    ],
    "deg": [
        "grad",
        "stupňů"
    ],
    "dist": [
        "entf.",
        "vzdál."
    ],
    "mass": [
        "masse",
        "hmotnost"
    ],
    "age": [
        "alter",
        "stáří"
    ],
    "alt": [
        "höhe",
        "výška"
    ],
    "ly": [
        "Lj",
        "sv. let"
    ],
    "au": [
        "AE",
        "AU"
    ],
    "YOU ARE HERE": [
        "DU BIST HIER",
        "JSTE ZDE"
    ],
    "PITCH": [
        "NEIGUNG",
        "NÁKLON"
    ],
    "YAW": [
        "GIER",
        "OTOČENÍ"
    ],
    "ROLL": [
        "ROLL",
        "KLONĚNÍ"
    ],
    "GALACTIC EPOCH": [
        "GALAKTISCHE EPOCHE",
        "GALAKTICKÁ EPOCHA"
    ],
    "PRESENT": [
        "GEGENWART",
        "SOUČASNOST"
    ],
    "INTERSTELLAR": [
        "INTERSTELLAR",
        "MEZIHVĚZDNÝ PROSTOR"
    ],
    "MY": [
        "MIO. J",
        "MIL. LET"
    ],
    "GY": [
        "MRD. J",
        "MLD. LET"
    ],
    "TY": [
        "BIO. J",
        "BIL. LET"
    ],
    "in the Milky Way.": [
        "in der milchstraße.",
        "v Mléčné dráze."
    ],
    "on planet Earth.": [
        "auf der erde.",
        "na planetě Zemi."
    ],
    "at Sol.": [
        "bei der sonne.",
        "u Slunce."
    ],
    "aboard the ISS.": [
        "an bord der ISS.",
        "na palubě ISS."
    ],
    "near": [
        "nahe",
        "poblíž"
    ],
    "Exit fullscreen animation": [
        "Vollbildanimation schließen",
        "Ukončit animaci na celé obrazovce"
    ],
    "selected. Use arrow keys to choose a solar system object, then press Enter to zoom in.": [
        "ausgewählt. Wählen Sie mit den Pfeiltasten ein Objekt im Sonnensystem und drücken Sie Enter zum Heranzoomen.",
        "vybráno. Šipkami vyberte objekt sluneční soustavy a klávesou Enter se přibližte."
    ],
    "selected. Use Tab or arrow keys to choose a nearby object, then press Enter to zoom in.": [
        "ausgewählt. Wählen Sie mit Tab oder den Pfeiltasten ein nahes Objekt und drücken Sie Enter zum Heranzoomen.",
        "vybráno. Klávesou Tab nebo šipkami vyberte blízký objekt a klávesou Enter se přibližte."
    ],
    "realtime": [
        "echtzeit",
        "reálný čas"
    ],
    "one simulated hour per second": [
        "eine simulierte stunde pro sekunde",
        "jedna simulovaná hodina za sekundu"
    ],
    "twelve simulated hours per second": [
        "zwölf simulierte stunden pro sekunde",
        "dvanáct simulovaných hodin za sekundu"
    ],
    "seven simulated days per second": [
        "sieben simulierte tage pro sekunde",
        "sedm simulovaných dní za sekundu"
    ],
    "thirty simulated days per second": [
        "dreißig simulierte tage pro sekunde",
        "třicet simulovaných dní za sekundu"
    ],
    "one simulated Julian year per second": [
        "ein simuliertes julianisches jahr pro sekunde",
        "jeden simulovaný juliánský rok za sekundu"
    ],
    "one million simulated years per second": [
        "eine million simulierte jahre pro sekunde",
        "jeden milion simulovaných let za sekundu"
    ],
    "five million simulated years per second": [
        "fünf millionen simulierte jahre pro sekunde",
        "pět milionů simulovaných let za sekundu"
    ],
    "ten million simulated years per second": [
        "zehn millionen simulierte jahre pro sekunde",
        "deset milionů simulovaných let za sekundu"
    ],
    "realtime local rotation and satellite motion": [
        "echtzeit für lokale rotation und satellitenbewegung",
        "rotace a pohyb družic v reálném čase"
    ],
    "one simulated local hour per second": [
        "eine simulierte lokale stunde pro sekunde",
        "jedna simulovaná místní hodina za sekundu"
    ],
    "six simulated local hours per second": [
        "sechs simulierte lokale stunden pro sekunde",
        "šest simulovaných místních hodin za sekundu"
    ],
    "twelve simulated local hours per second": [
        "zwölf simulierte lokale stunden pro sekunde",
        "dvanáct simulovaných místních hodin za sekundu"
    ],
    "one simulated local day per second": [
        "ein simulierter lokaler tag pro sekunde",
        "jeden simulovaný místní den za sekundu"
    ],
    "Simulation speed:": [
        "Simulationsgeschwindigkeit:",
        "Rychlost simulace:"
    ],
    "1h/s": [
        "1h/s",
        "1h/s"
    ],
    "12h/s": [
        "12h/s",
        "12h/s"
    ],
    "7d/s": [
        "7T/s",
        "7d/s"
    ],
    "30d/s": [
        "30T/s",
        "30d/s"
    ],
    "1y/s": [
        "1J/s",
        "1r/s"
    ],
    "1My/s": [
        "1MJ/s",
        "1Mr/s"
    ],
    "5My/s": [
        "5MJ/s",
        "5Mr/s"
    ],
    "10My/s": [
        "10MJ/s",
        "10Mr/s"
    ],
    "1d/s": [
        "1T/s",
        "1d/s"
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
    "LOCAL SYSTEM": [
        "SONNENSYSTEM",
        "SLUNEČNÍ SOUSTAVA"
    ],
    "Switch between the Solar System and the Milky Way": [
        "Zwischen Sonnensystem und Milchstraße wechseln",
        "Přepnout mezi sluneční soustavou a Mléčnou dráhou"
    ],
    "UTC / BROWSER TIME": [
        "UTC / BROWSERZEIT",
        "UTC / ČAS PROHLÍŽEČE"
    ]
};
const displayCopy = new Map(Object.entries(copy).map(([source, targets]) => [source.toLowerCase(), targets]));
const displayPattern = new RegExp(
    '(?<![\\p{L}\\p{N}])(?:' + Object.keys(copy)
        .sort((a,b) => b.length - a.length)
        .map(source => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|') + ')(?![\\p{L}\\p{N}])|\\b\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?\\b|\\b\\d+\\.\\d+\\b',
    'giu',
);
const cache = new Map<string, string>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
let cachedLanguage: Language = 'en';

export function translateDisplay(text: string, language: Language): string {
    if (language === 'en') return text;
    if (cachedLanguage !== language) { cache.clear(); cachedLanguage = language; }
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    const index = language === 'de' ? 0 : 1;
    // A single pass prevents translating words inside an already translated phrase.
    const translated = text.replace(displayPattern, match => {
        const targets = displayCopy.get(match.toLowerCase());
        if (!targets) {
            const fractionDigits = match.split('.')[1]?.length ?? 0;
            const formatKey = `${language}:${fractionDigits}:${match.includes(',')}`;
            let formatter = numberFormatters.get(formatKey);
            if (!formatter) {
                formatter = new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'cs-CZ', {
                    minimumFractionDigits: fractionDigits,
                    maximumFractionDigits: fractionDigits,
                    useGrouping: match.includes(','),
                });
                numberFormatters.set(formatKey, formatter);
            }
            return formatter.format(Number(match.replaceAll(',', '')));
        }
        const result = targets[index];
        return match === match.toUpperCase() ? result.toUpperCase() : result;
    });
    if (cache.size >= 512) cache.clear();
    cache.set(text, translated);
    return translated;
}

export function localize(text: string): string {
    const lang = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
    return translateDisplay(text, lang === 'de' || lang === 'cs' ? lang : 'en');
}
