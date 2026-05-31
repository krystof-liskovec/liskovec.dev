package commands

import (
	"context"

	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("reset", "Resets the terminal state and virtual filesystem", doReset, AutocompleteNone)
}

func doReset(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	vfs.ClearVFS()
	
	// Re-initialize session VFS
	newRoot := vfs.InitVFS()
	session.RootNode = newRoot
	session.CurrentNode = newRoot
	session.MatrixMode = false
	session.ActiveTheme = "viper"
	
	return []types.Line{
		normalLine("System state has been reset to factory defaults."),
		normalLine("Virtual filesystem has been re-initialized."),
	}
}
