package commands

import (
	"context"
	"strings"

	"liskovec.dev/terminal/types"
)

func init() {
	Register("echo", "Prints the provided arguments to the terminal", doEcho, AutocompleteNone)
}

func doEcho(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	return []types.Line{normalLine(strings.Join(args, " "))}
}
