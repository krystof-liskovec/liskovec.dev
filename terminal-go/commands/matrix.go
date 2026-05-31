package commands

import (
	"context"
	"syscall/js"

	"liskovec.dev/terminal/types"
)

func init() {
	Register("matrix", "Launches neon digital waterfall grid mode", doMatrix, AutocompleteNone)
}

func doMatrix(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	oldTheme := session.ActiveTheme
	session.MatrixMode = true
	session.ActiveTheme = "matrix"
	result.Theme = "matrix"
	result.IsBlocking = true
	result.UseAlternateBuffer = true

	// Handle cleanup when the command is interrupted.
	go func() {
		<-ctx.Done()
		session.MatrixMode = false
		session.ActiveTheme = oldTheme
		js.Global().Call("applyTheme", oldTheme)
	}()

	return []types.Line{}
}
