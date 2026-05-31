package commands

import (
	"context"
	"fmt"
	"time"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("neofetch", "Displays system stats and portfolio summary", getNeofetch, AutocompleteNone)
}

func getNeofetch(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	uptimeSeconds := int(time.Since(session.StartTime).Seconds())
	uptimeStr := fmt.Sprintf("%ds", uptimeSeconds)
	if uptimeSeconds >= 60 {
		uptimeStr = fmt.Sprintf("%dm %ds", uptimeSeconds/60, uptimeSeconds%60)
	}

	// Stylized ASCII Monitor / Computer
	ascii := []string{
		"   _____________________  ",
		"  |  _________________  | ",
		"  | |                 | | ",
		"  | |   Liskovec.dev  | | ",
		"  | |    OS v1.0.0    | | ",
		"  | |                 | | ",
		"  | |_________________| | ",
		"  |_____________________| ",
		"    /                 \\   ",
		"   /___________________\\  ",
	}

	stats := []struct {
		Label string
		Value string
	}{
		{"OS", "LiskovecOS v1.0.0 (Go/WASM Kernel)"},
		{"Host", "krystof.liskovec.dev"},
		{"Kernel", "WebAssembly/Go-1.26.3"},
		{"Uptime", uptimeStr},
		{"Shell", "gowasm-sh v1.1 (Cobra-less)"},
		{"DE/WM", "HTML5 / Astro Canvas Viewport"},
		{"Console", "Bespoke WebAssembly Graphic OS"},
		{"Active Theme", session.ActiveTheme},
		{"CPU", "WASM Virtual Single-Core"},
		{"Memory", "Virtual Sandbox Ram Buffer (128MB)"},
	}

	var lines []types.Line
	lines = append(lines, normalLine(""))

	t := i18n.T()

	// Join ASCII computer logo on left and Stats on right
	for i := 0; i < len(ascii); i++ {
		var segs []types.Segment
		// Add ASCII line
		segs = append(segs, bSeg(ascii[i], "text-accent"))
		segs = append(segs, cSeg("   ", ""))

		// Add corresponding stat line
		if i == 0 {
			segs = append(segs, bSeg(t.WhoamiOutput, "text-highlight"))
		} else if i == 1 {
			segs = append(segs, cSeg("------------------", "text-muted"))
		} else if i-2 < len(stats) {
			stat := stats[i-2]
			segs = append(segs, bSeg(fmt.Sprintf("%-12s: ", stat.Label), "text-primary"))
			segs = append(segs, cSeg(stat.Value, "text-body"))
		}

		lines = append(lines, types.Line{Segments: segs})
	}

	lines = append(lines, normalLine(""))
	lines = append(lines, normalLine(t.NeofetchWelcome))
	lines = append(lines, normalLine(""))

	return lines
}
