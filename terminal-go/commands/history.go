package commands

import (
	"context"
	"fmt"
	"strings"

	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("history", "Prints command input history", doHistory, AutocompleteNone)
}

func doHistory(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	// Try to read from the persistent history file
	historyNode, _, ok := vfs.ResolvePath(session.RootNode, session.RootNode, "/.history")
	if !ok || historyNode.IsDir {
		// Fallback to session history if file doesn't exist
		var output []types.Line
		for i, cmd := range session.History {
			output = append(output, normalLine(fmt.Sprintf("  %3d  %s", i+1, cmd)))
		}
		return output
	}

	lines := strings.Split(strings.TrimSpace(historyNode.Content), "\n")
	var output []types.Line
	for i, cmd := range lines {
		if cmd == "" {
			continue
		}
		output = append(output, normalLine(fmt.Sprintf("  %3d  %s", i+1, cmd)))
	}
	return output
}
