package commands

import (
	"context"
	"fmt"
	"sort"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("help", "Lists all available commands", getHelp, AutocompleteNone)
}

func getHelp(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	lines := []types.Line{
		{Segments: []types.Segment{bSeg(t.HelpTitle, "text-highlight")}},
		normalLine(""),
	}

	// Fetch keys from map and sort alphabetically
	var keys []string
	for k := range Registry {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		cmd := Registry[k]
		desc := i18n.GetCommandDescription(cmd.Name)
		if desc == "" {
			desc = cmd.Description
		}
		lines = append(lines, types.Line{
			Segments: []types.Segment{
				bSeg(fmt.Sprintf("  %-15s", cmd.Name), "text-primary"),
				cSeg(" - ", "text-muted"),
				cSeg(desc, "text-body"),
			},
		})
	}
	lines = append(lines, normalLine(""))
	lines = append(lines, normalLine(t.HelpTip))
	return lines
}
