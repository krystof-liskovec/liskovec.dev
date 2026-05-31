package commands

import (
	"context"
	"strconv"
	"time"

	"liskovec.dev/terminal/types"
)

func init() {
	Register("sleep", "Pauses the terminal for a specified number of seconds", doSleep, AutocompleteNone)
}

func doSleep(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{normalLine("sleep: missing operand")}
	}

	seconds, err := strconv.Atoi(args[0])
	if err != nil {
		return []types.Line{normalLine("sleep: invalid time interval '" + args[0] + "'")}
	}

	result.IsBlocking = true

	select {
	case <-time.After(time.Duration(seconds) * time.Second):
	case <-ctx.Done():
	}

	return []types.Line{}
}
