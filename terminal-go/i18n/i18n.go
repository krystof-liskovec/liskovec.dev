package i18n

import (
	"strings"
	"sync"
)

// Language represents our locale identifier type
type Language string

const (
	EN Language = "en"
	CS Language = "cs"
)

var (
	currentLang = EN
	langMu      sync.RWMutex
)

// SetLanguage sets the active console language thread-safely
func SetLanguage(lang Language) {
	langMu.Lock()
	defer langMu.Unlock()
	currentLang = lang
}

// GetLanguage retrieves the active console language thread-safely
func GetLanguage() Language {
	langMu.RLock()
	defer langMu.RUnlock()
	return currentLang
}

// T returns the TranslationCatalog matching the currently active language
func T() *TranslationCatalog {
	langMu.RLock()
	lang := currentLang
	langMu.RUnlock()
	if lang == CS {
		return &csCatalog
	}
	return &enCatalog
}

// GetCommandDescription resolves command descriptions dynamically for help printouts via map lookup
func GetCommandDescription(name string) string {
	catalog := T()
	return catalog.CmdDescriptions[strings.ToLower(name)]
}

// TranslationCatalog maps all CLI console logs to structure schemas
type TranslationCatalog struct {
	// BIOS lines
	BiosTitle           string
	BiosCpu             string
	BiosRam             string
	BiosDivider         string
	BiosInitGraphics    string
	BiosGraphicsSuccess string
	BiosMountVFS        string
	BiosVFSSuccess      string
	BiosLaunchShell     string
	BiosSuccess         string

	// Command Help descriptions Map
	CmdDescriptions map[string]string

	// Help Command Outputs
	HelpTitle string
	HelpTip   string

	// Whoami Output
	WhoamiOutput string

	// CD Command Outputs
	CdUsage                string
	CdErrorNoSuchFileOrDir string
	CdErrorNotADirectory   string

	// LS Command Outputs
	LsErrorCannotAccess string

	// Cat Command Outputs
	CatErrorMissingFile     string
	CatErrorNoSuchFileOrDir string
	CatErrorIsDirectory     string

	// Sudo Command Outputs
	SudoUsage                     string
	SudoPasswordPromptWipe        string
	SudoWipeWarning               string
	SudoWipeParsing               string
	SudoWipeDelFile               string
	SudoWipeDelFolder             string
	SudoWipeSelfDestructPrevented string
	SudoWipeNiceTry               string
	SudoPasswordPromptReport      string
	SudoNotSudoers                string

	// Theme Command Outputs
	ThemeUsage     string
	ThemeAvailable string
	ThemeExample   string
	ThemeUnknown   string
	ThemeShifted   string

	// Weather Command Outputs
	WeatherTitle     string
	WeatherLocation  string
	WeatherSky       string
	WeatherTemp      string
	WeatherWind      string
	WeatherHumidity  string
	WeatherVibes     string
	WeatherForecast  string

	// Matrix Command Outputs
	MatrixActivated string

	// Contact Command Outputs
	ContactTitle           string
	ContactPlatform        string
	ContactInteractiveLink string
	ContactFooter          string

	// Projects Command Outputs
	ProjectsTitle              string
	ProjectsLiskovecDevSummary string
	ProjectsGopherShellSummary string
	ProjectsFooter             string

	// Skills Command Outputs
	SkillsTitle            string
	SkillsLanguagesHeader  string
	SkillsFrameworksHeader string
	SkillsInfraHeader      string
	SkillsFooter           string

	// VFS File Contents
	VfsWelcomeContent     string
	VfsAboutContent       string
	VfsSkillsContent      string
	VfsContactContent     string
	VfsLiskovecDevContent string
	VfsGopherShellContent string
	VfsEasterEggContent   string

	// Shell specific messages
	ShellCmdNotFound string
	ShellTypeHelp    string

	// Neofetch specific texts
	NeofetchWelcome string
}

// ----------------------------------------------------
// 1. ENGLISH LOCALE DICTIONARY (enCatalog)
// ----------------------------------------------------
var enCatalog = TranslationCatalog{
	// BIOS
	BiosTitle:           "LISKOVEC SYSTEMS GRAPHICAL BIOS v2.0.2",
	BiosCpu:             "CPU: Go WebAssembly Virtual Core Execution",
	BiosRam:             "RAM: 128MB Sandboxed RAM Page Allocation",
	BiosDivider:         "----------------------------------------",
	BiosInitGraphics:    "BOOT: Initializing Go graphics engine...",
	BiosGraphicsSuccess: "  [OK] HTML5 Canvas graphics context initialized",
	BiosMountVFS:        "BOOT: Mounting VFS filesystem schema...",
	BiosVFSSuccess:      "  [OK] VFS Mounted successfully",
	BiosLaunchShell:     "BOOT: Launching shell interface (gowasm-sh)...",
	BiosSuccess:         "SUCCESS: Graphical Kernel engaged.",

	// Command Help descriptions Map
	CmdDescriptions: map[string]string{
		"help":     "Lists all available commands",
		"neofetch": "Displays system stats and portfolio summary",
		"ls":       "Lists directory contents",
		"cd":       "Changes current virtual directory",
		"cat":      "Prints the content of a file",
		"skills":   "View technical expertise visual progress bars",
		"projects": "Examine personal and open-source project descriptions",
		"contact":  "Get clickable methods to reach me",
		"theme":    "Changes color theme (phosphor, amber, dracula, cyberpunk, matrix, one-dark, gruvbox, nord, tokyo-night, light, catppuccin-mocha, rose-pine, solarized-dark, monokai, viper)",
		"clear":    "Clears the terminal viewport",
		"whoami":   "Prints current user context",
		"history":  "Prints command input history",
		"weather":  "Generates a vintage weather readout",
		"matrix":   "Launches neon digital waterfall grid mode",
		"sudo":     "Attempts superuser command privileges",
		"lang":     "Changes console language (en, cs)",
		"echo":     "Prints the provided arguments to the terminal",
		"mkdir":    "Creates a new directory",
		"touch":    "Creates a new empty file",
		"rm":       "Removes a file or directory",
		"reset":    "Resets the terminal state and virtual filesystem",
		"sleep":    "Pauses the terminal for a specified number of seconds",
	},

	// Help Command Outputs
	HelpTitle: "Available Terminal Commands:",
	HelpTip:   "Tip: Try utilizing 'Tab' to trigger command or path autocompletions!",

	// Whoami Output
	WhoamiOutput: "guest@liskovec.dev",

	// CD Command Outputs
	CdUsage:                "Usage: cd <directory>",
	CdErrorNoSuchFileOrDir: ": No such file or directory (failed at '",
	CdErrorNotADirectory:   "cd: not a directory: ",

	// LS Command Outputs
	LsErrorCannotAccess: "ls: cannot access '",

	// Cat Command Outputs
	CatErrorMissingFile:     "cat: missing file operand",
	CatErrorNoSuchFileOrDir: "cat: ",
	CatErrorIsDirectory:     ": Is a directory",

	// Sudo Command Outputs
	SudoUsage:                     "usage: sudo [-u user] command",
	SudoPasswordPromptWipe:        "[sudo] password for guest: *******",
	SudoWipeWarning:               "⚠️  WARNING: RECURSIVE DELETE TRIGGERED ON ROOT DICT '/'  ⚠️",
	SudoWipeParsing:               "Parsing memory allocation... 100% block check...",
	SudoWipeDelFile:               "Deleting system file ",
	SudoWipeDelFolder:             "Deleting folder ",
	SudoWipeSelfDestructPrevented: "CRITICAL FAILURE: BRAIN NOT DETECTED. SELF-DESTRUCT PREVENTED. 😉",
	SudoWipeNiceTry:               "Actually, files are locked inside WASM sandboxing space. Nice try!",
	SudoPasswordPromptReport:      "[sudo] password for guest: ",
	SudoNotSudoers:                "guest is not in the sudoers file. This incident will be reported.",

	// Theme Command Outputs
	ThemeUsage:     "Usage: theme <name>",
	ThemeAvailable: "Available themes: phosphor, amber, dracula, cyberpunk, matrix, one-dark, gruvbox, nord, tokyo-night, light, catppuccin-mocha, rose-pine, solarized-dark, monokai",
	ThemeExample:   "Example: theme amber",
	ThemeUnknown:   "gowasm-sh: unknown styling theme: ",
	ThemeShifted:   "Console style shifted successfully to: ",

	// Weather Command Outputs
	WeatherTitle:    "⚡️ RETRO WEATHER FORECAST v0.4 ⚡️",
	WeatherLocation: "Location: WebAssembly Sandbox Cloud Cluster v4",
	WeatherSky:      "    \\   /      Clear Sky Skies",
	WeatherTemp:     "     .-.       Temp: 22°C (71.6°F)",
	WeatherWind:     "  ― (   ) ―    Wind: 5 km/h NW",
	WeatherHumidity: "     `-’       Humidity: 45%",
	WeatherVibes:    "    /   \\      Vibes: 100% Optimal for compiling",
	WeatherForecast: "Forecast: Sunny transitions, occasional showers of WebAssembly compiler flags.",

	// Matrix Command Outputs
	MatrixActivated: "Matrix mode engaged! Initializing streaming rain in 3... 2... 1...",

	// Contact Command Outputs
	ContactTitle:           "Connect with me directly:",
	ContactPlatform:        "Platform",
	ContactInteractiveLink: "Interactive Contact Link",
	ContactFooter:          "Clicking on any platform link above will prompt your browser to open it.",

	// Projects Command Outputs
	ProjectsTitle:              "Featured Deployments:",
	ProjectsLiskovecDevSummary: "Custom-made WebAssembly CLI environment executing an in-memory VFS.",
	ProjectsGopherShellSummary: "Terminal graphical dashboard connecting local docker hooks with real-time logs.",
	ProjectsFooter:             "Tip: You can click the links above to view repositories directly in a new tab!",

	// Skills Command Outputs
	SkillsTitle:            "Expertise & Technological Index:",
	SkillsLanguagesHeader:  "Core Languages:",
	SkillsFrameworksHeader: "Frameworks & Runtimes:",
	SkillsInfraHeader:      "Infrastructure / Ecosystem:",
	SkillsFooter:           "Type 'cd ..' or read skills.txt in VFS to see static records!",

	// VFS File Contents
	VfsWelcomeContent: `==================================================
Welcome to Krystof Liskovec's Developer Terminal!
==================================================

This terminal is a custom emulator written in Go and
compiled into WebAssembly to run entirely in your browser.

Commands at a glance:
- 'help'       : lists all available terminal commands
- 'neofetch'   : runs the graphic portfolio dashboard
- 'skills'     : displays interactive expertise bars
- 'projects'   : prints custom web development projects
- 'contact'    : opens clickable links to connect with me
- 'theme <n>'  : swaps active CRT console styling themes
- 'lang <l>'   : changes language (en / cs)
- 'ls' / 'cd'  : lists and navigates directories
- 'cat <file>' : reads contents of virtual files

Navigate using 'cd projects' or read the welcome message again using 'cat welcome.txt'!`,

	VfsAboutContent: `Hello! I'm Krystof Liskovec, a software engineer specializing in web application architecture, system utilities, and building highly optimized web interfaces.

I specialize in designing backend architectures in Go, writing type-safe applications in TypeScript, and utilizing frameworks like Astro and React for clean, fast frontend delivery.

This portfolio is an interactive playground demonstrating:
- In-memory Virtual Filesystem (VFS) traversal.
- Bidirectional JS-to-WebAssembly messaging protocols.
- Multi-theme CRT CRT scanlines, flicker, and phosphor glows.

Feel free to browse around!`,

	VfsSkillsContent: `Technical Skills Radar:

[Programming Languages]
- Go         [██████████████████░░] 90%
- TypeScript [████████████████░░░░] 80%
- SQL / Pg   [██████████████░░░░░░] 70%
- HTML / CSS [██████████████████░░] 90%
- Rust       [██████████░░░░░░░░░░] 50%

[Frameworks & Libraries]
- Astro      [██████████████████░░] 90%
- React      [████████████████░░░░] 80%
- Node.js    [██████████████░░░░░░] 70%

[Infrastructure & Tools]
- Git        [██████████████████░░] 90%
- Docker     [██████████████░░░░░░] 70%
- Linux/Bash [████████████████░░░░] 80%`,

	VfsContactContent: `How to Reach Me:

- Email:    krystof@liskovec.dev
- GitHub:   github.com/kristof-liskovec
- LinkedIn: linkedin.com/in/krystof-liskovec

(Tip: Run the specialized 'contact' CLI command to render clickable anchor tags directly in the console!)`,

	VfsLiskovecDevContent: `Project: liskovec.dev (This website)
Role: Creator / Architect
Stack: Astro, WebAssembly, Go, TailwindCSS/Vanilla CSS
Summary: A high-fidelity, interactive terminal dashboard running on Go WASM. Rather than relying on external libraries like xterm.js, this is a fully bespoke runtime including a custom command interpreter, an in-memory Virtual Filesystem, and high-performance HTML/CSS styling for smooth retro overlays.`,

	VfsGopherShellContent: `Project: GopherShell CLI
Role: Backend Lead
Stack: Go, Cobra, Termbox-go
Summary: A terminal-based graphical manager for local container deployments. Integrates Docker socket hooks directly with a terminal drawing grid, providing real-time log monitoring and shell execution in a retro TUI environment.`,

	VfsEasterEggContent: `AHA! You navigated into the secret directory! Here's a treat:

"There are 10 types of people in the world:
   those who understand binary, and those who don't."

Try running:
- 'sudo rm -rf /' (if you dare)
- 'weather' (to pull current vibes)
- 'matrix' (to trigger digital rain)
`,

	// Shell Diagnostics
	ShellCmdNotFound: "gowasm-sh: command not found: ",
	ShellTypeHelp:    "Type 'help' to see a list of available commands.",

	// Neofetch
	NeofetchWelcome: "Welcome to my portfolio! Browse the filesystem (try ls or cd) to explore details or view skills and projects commands directly.",
}

// ----------------------------------------------------
// 2. CZECH LOCALE DICTIONARY (csCatalog)
// ----------------------------------------------------
var csCatalog = TranslationCatalog{
	// BIOS
	BiosTitle:           "LISKOVEC SYSTEMS GRAFICKÝ BIOS v2.0.2",
	BiosCpu:             "CPU: Go WebAssembly Virtuální Jádro",
	BiosRam:             "RAM: 128MB Alokace Pískovištní Paměti",
	BiosDivider:         "----------------------------------------",
	BiosInitGraphics:    "BOOT: Inicializace grafického jádra Go...",
	BiosGraphicsSuccess: "  [OK] HTML5 Canvas kontext úspěšně inicializován",
	BiosMountVFS:        "BOOT: Připojování virtuálního systému souborů...",
	BiosVFSSuccess:      "  [OK] VFS disk připojen úspěšně",
	BiosLaunchShell:     "BOOT: Spouštění interpretu shellu (gowasm-sh)...",
	BiosSuccess:         "ÚSPĚCH: Grafické jádro bylo plně zapojeno.",

	// Command Help descriptions Map
	CmdDescriptions: map[string]string{
		"help":     "Zobrazí seznam všech dostupných příkazů",
		"neofetch": "Zobrazí systémové statistiky a přehled portfolia",
		"ls":       "Vypíše obsah aktuálního adresáře",
		"cd":       "Změní aktuální virtuální adresář",
		"cat":      "Zobrazí obsah vybraného souboru",
		"skills":   "Ukáže vizuální ukazatele technických dovedností",
		"projects": "Zobrazí přehled osobních a open-source projektů",
		"contact":  "Vypíše klikací odkazy pro rychlé spojení se mnou",
		"theme":    "Změní barevný styl konzole (phosphor, amber, dracula, cyberpunk, matrix, one-dark, gruvbox, nord, tokyo-night, light, catppuccin-mocha, rose-pine, solarized-dark, monokai, viper)",
		"clear":    "Vymaže celou obrazovku terminálu",
		"whoami":   "Vypíše aktuální kontext uživatele",
		"history":  "Zobrazí historii zadaných příkazů",
		"weather":  "Vykreslí retro předpověď počasí",
		"matrix":   "Spustí režim neonového digitálního vodopádu",
		"sudo":     "Pokusí se spustit příkaz s administrátorským oprávněním",
		"lang":     "Změní jazyk konzole (en, cs)",
		"echo":     "Vypíše zadané argumenty do terminálu",
		"mkdir":    "Vytvoří nový adresář",
		"touch":    "Vytvoří nový prázdný soubor",
		"rm":       "Smaže soubor nebo adresář",
		"reset":    "Resetuje stav terminálu a virtuální disk",
		"sleep":    "Pozastaví terminál na zadaný počet sekund",
	},

	// Help Command Outputs
	HelpTitle: "Dostupné příkazy terminálu:",
	HelpTip:   "Tip: K automatickému doplňování příkazů a cest můžete použít klávesu 'Tab'!",

	// Whoami Output
	WhoamiOutput: "host@liskovec.dev",

	// CD Command Outputs
	CdUsage:                "Použití: cd <adresář>",
	CdErrorNoSuchFileOrDir: ": Adresář neexistuje (chyba u '",
	CdErrorNotADirectory:   "cd: toto není adresář: ",

	// LS Command Outputs
	LsErrorCannotAccess: "ls: nelze přistoupit k '",

	// Cat Command Outputs
	CatErrorMissingFile:     "cat: chybí parametr souboru",
	CatErrorNoSuchFileOrDir: "cat: ",
	CatErrorIsDirectory:     ": Je to adresář",

	// Sudo Command Outputs
	SudoUsage:                     "použití: sudo [-u uživatel] příkaz",
	SudoPasswordPromptWipe:        "[sudo] heslo pro uživatele host: *******",
	SudoWipeWarning:               "⚠️  VAROVÁNÍ: SPUŠTĚNO REKURZIVNÍ MAZÁNÍ KOŘENOVÉHO ADRESÁŘE '/'  ⚠️",
	SudoWipeParsing:               "Analyzuji paměťové sektory... 100% kontrola bloků...",
	SudoWipeDelFile:               "Odstraňuji systémový soubor ",
	SudoWipeDelFolder:             "Odstraňuji adresář ",
	SudoWipeSelfDestructPrevented: "KRITICKÉ SELHÁNÍ: MOZEK NEBYL DETEKOVÁN. SEBEDESTRUKCI ZABRÁNĚNO. 😉",
	SudoWipeNiceTry:               "Soubory jsou ve skutečnosti bezpečně uzamčené v pískovišti WASM. Dobrý pokus!",
	SudoPasswordPromptReport:      "[sudo] heslo pro uživatele host: ",
	SudoNotSudoers:                "host není v souboru sudoers. Tento incident bude nahlášen.",

	// Theme Command Outputs
	ThemeUsage:     "Použití: theme <název>",
	ThemeAvailable: "Dostupné motivy: phosphor, amber, dracula, cyberpunk, matrix, one-dark, gruvbox, nord, tokyo-night, light, catppuccin-mocha, rose-pine, solarized-dark, monokai",
	ThemeExample:   "Příklad: theme amber",
	ThemeUnknown:   "gowasm-sh: neznámý motiv vzhledu: ",
	ThemeShifted:   "Barevný styl konzole úspěšně změněn na: ",

	// Weather Command Outputs
	WeatherTitle:    "⚡️ RETRO PŘEDPOVĚĎ POČASÍ v0.4 ⚡️",
	WeatherLocation: "Místo: WebAssembly cloudový cluster pískoviště v4",
	WeatherSky:      "    \\   /      Jasná obloha",
	WeatherTemp:     "     .-.       Teplota: 22°C (71.6°F)",
	WeatherWind:     "  ― (   ) ―    Vítr: 5 km/h SZ",
	WeatherHumidity: "     `-’       Vlhkost: 45%",
	WeatherVibes:    "    /   \\      Atmosféra: 100% optimální pro kompilování",
	WeatherForecast: "Předpověď: Slunečno, občasné přeháňky WebAssembly kompilátorových přepínačů.",

	// Matrix Command Outputs
	MatrixActivated: "Matrix režim aktivován! Spouštím kódový déšť za 3... 2... 1...",

	// Contact Command Outputs
	ContactTitle:           "Kontaktujte mě přímo:",
	ContactPlatform:        "Platforma",
	ContactInteractiveLink: "Interaktivní odkaz",
	ContactFooter:          "Kliknutím na kteroukoli platformu výše přimějete prohlížeč otevřít danou stránku.",

	// Projects Command Outputs
	ProjectsTitle:              "Vybrané projekty:",
	ProjectsLiskovecDevSummary: "Vlastní WebAssembly CLI prostředí poháněné virtuálním VFS souborovým systémem.",
	ProjectsGopherShellSummary: "Grafický terminálový správce kontejnerů napojený přímo na Docker API.",
	ProjectsFooter:             "Tip: Kliknutím na odkazy výše můžete otevřít repozitáře přímo v novém okně!",

	// Skills Command Outputs
	SkillsTitle:            "Přehled technických znalostí a dovedností:",
	SkillsLanguagesHeader:  "Programovací jazyky:",
	SkillsFrameworksHeader: "Frameworky & Rychloběhy:",
	SkillsInfraHeader:      "Infrastruktura a Ekosystém:",
	SkillsFooter:           "Zadejte 'cd ..' nebo si přečtěte soubor skills.txt k zobrazení statických záznamů!",

	// VFS File Contents
	VfsWelcomeContent: `==================================================
Vítejte v vývojářském terminálu Kryštofa Liskovce!
==================================================

Tento terminál je vlastní emulátor napsaný v jazyce Go a
zkompilovaný do WebAssembly, běžící plně ve vašem prohlížeči.

Základní příkazy:
- 'help'       : vypíše seznam všech dostupných příkazů
- 'neofetch'   : spustí grafický přehled vývojářského portfolia
- 'skills'     : zobrazí interaktivní grafy mých dovedností
- 'projects'   : vypíše přehled mých webových projektů
- 'contact'    : nabídne interaktivní odkazy pro spojení se mnou
- 'theme <n>'  : přepne barevné téma retro obrazovky
- 'lang <l>'   : přepne jazyk konzole (en / cs)
- 'ls' / 'cd'  : slouží k výpisu a navigaci v adresářích
- 'cat <soub>' : zobrazí obsah textových souborů

Prozkoumejte projekty zadáním 'cd projects' nebo si přečtěte tuto zprávu znovu pomocí 'cat welcome.txt'!`,

	VfsAboutContent: `Ahoj! Jsem Kryštof Liskovec, softwarový inženýr specializující se na architekturu webových aplikací, systémové nástroje a vývoj vysoce optimalizovaných rozhraní.

Zaměřuji se na návrh backendových architektur v Go, psaní typově bezpečných aplikací v TypeScriptu a využívání moderních technologií jako Astro a React pro rychlé doručování frontendu.

Toto portfolio slouží jako interaktivní ukázka:
- Práce s virtuálním souborovým systémem (VFS) přímo v paměti prohlížeče.
- Obousměrného přenosu zpráv a volání mezi JS a WebAssembly.
- CRT filtrů s retro scanlines, blikáním a simulací luminoforu.

Neváhejte se porozhlédnout!`,

	VfsSkillsContent: `Přehled technických dovedností:

[Programovací jazyky]
- Go         [██████████████████░░] 90%
- TypeScript [████████████████░░░░] 80%
- SQL / Pg   [██████████████░░░░░░] 70%
- HTML / CSS [██████████████████░░] 90%
- Rust       [██████████░░░░░░░░░░] 50%

[Frameworky a knihovny]
- Astro      [██████████████████░░] 90%
- React      [████████████████░░░░] 80%
- Node.js    [██████████████░░░░░░] 70%

[Infrastruktura a nástroje]
- Git        [██████████████████░░] 90%
- Docker     [██████████████░░░░░░] 70%
- Linux/Bash [████████████████░░░░] 80%`,

	VfsContactContent: `Jak mě kontaktovat:

- Email:    krystof@liskovec.dev
- GitHub:   github.com/kristof-liskovec
- LinkedIn: linkedin.com/in/krystof-liskovec

(Tip: Spusťte specializovaný příkaz 'contact' k vykreslení plně klikatelných odkazů přímo v canvas konzoli!)`,

	VfsLiskovecDevContent: `Projekt: liskovec.dev (Tento web)
Role: Tvůrce / Architekt
Technologie: Astro, WebAssembly, Go, TailwindCSS/Vanilla CSS
Shrnutí: Špičkový interaktivní terminálový portál běžící plně v Go WASM. Namísto použití knihoven jako xterm.js využívá toto řešení vlastní kompletní kreslicí a kompilované jádro včetně virtuálního disku v paměti a retro efektů.`,

	VfsGopherShellContent: `Projekt: GopherShell CLI
Role: Hlavní vývojář backendu
Technologie: Go, Cobra, Termbox-go
Shrnutí: Terminálový grafický manažer a monitor pro místní Docker kontejnery. Připojuje se přímo na Docker socket a nabízí real-time sledování logů a spouštění kontejnerových procesů v retro TUI mřížce.`,

	VfsEasterEggContent: `AHA! Podařilo se vám vstoupit do tajného adresáře! Tady je malá odměna:

"Na světě existuje 10 typů lidí:
   ty, kteří rozumí dvojkové soustavě, a ty, kteří ne."

Zkuste spustit:
- 'sudo rm -rf /' (jestli si troufáte)
- 'weather' (pro zjištění atmosféry)
- 'matrix' (pro spuštění digitálního deště)
`,

	// Shell Diagnostics
	ShellCmdNotFound: "gowasm-sh: příkaz nenalezen: ",
	ShellTypeHelp:    "Napište 'help' pro výpis dostupných příkazů.",

	// Neofetch
	NeofetchWelcome: "Vítejte v mém portfoliu! Procházejte souborový systém (zkuste příkazy ls nebo cd), nebo si přímo prohlédněte technické dovednosti (skills) a projekty (projects).",
}
