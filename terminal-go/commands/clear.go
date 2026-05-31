package commands

import (
	"context"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("clear", "Clears the terminal viewport", doClear, AutocompleteNone)
}

func doClear(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	result.Clear = true
	return nil
}
