package commands

import (
	"context"
	"strings"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("theme", "Changes color theme (phosphor, amber, dracula, cyberpunk, matrix, one-dark, gruvbox, nord, tokyo-night, light, catppuccin-mocha, rose-pine, solarized-dark, monokai, viper)", doTheme, AutocompleteTheme)
}

func doTheme(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	if len(args) == 0 {
		return []types.Line{
			{Segments: []types.Segment{bSeg(t.ThemeUsage, "text-primary")}},
			normalLine(t.ThemeAvailable),
			normalLine(t.ThemeExample),
		}
	}

	theme := strings.ToLower(args[0])
	validThemes := map[string]string{
		"phosphor":         "Classic Emerald Green",
		"amber":            "Radiation Orange",
		"dracula":          "Midnight Cyber-Purple",
		"cyberpunk":        "Neon Magenta & Cyan",
		"matrix":           "Digital Rain Wall",
		"one-dark":         "Atom Sleek One Dark",
		"gruvbox":          "Warm Retro-Modern Gruvbox",
		"nord":             "Arctic Frozen Nord",
		"tokyo-night":      "Neon Deep Tokyo Night",
		"light":            "Retro Paper Terminal",
		"catppuccin-mocha": "Catppuccin Pastel Mocha",
		"rose-pine":        "Rose Pine Minimalist",
		"solarized-dark":   "Solarized Precision Dark",
		"monokai":          "Vibrant Retro Monokai",
		"viper":            "Viper Dark Acid Green",
	}

	dispName, ok := validThemes[theme]
	if !ok {
		return []types.Line{
			{Segments: []types.Segment{
				cSeg(t.ThemeUnknown, "text-error"),
				bSeg(theme, "text-error"),
			}},
			normalLine(t.ThemeAvailable),
		}
	}

	session.ActiveTheme = theme
	result.Theme = theme

	// Save theme choice to a virtual file for persistence
	vfs.WriteFile(session.RootNode, session.RootNode, "/.theme", theme, false)
	vfs.SaveVFS(session.RootNode)

	return []types.Line{
		{Segments: []types.Segment{
			cSeg(t.ThemeShifted, "text-body"),
			bSeg(dispName, "text-success"),
		}},
	}
}
