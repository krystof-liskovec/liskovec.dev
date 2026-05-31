package commands

import (
	"context"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("whoami", "Prints current user context", doWhoami, AutocompleteNone)
}

func doWhoami(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	return []types.Line{
		normalLine(i18n.T().WhoamiOutput),
	}
}
