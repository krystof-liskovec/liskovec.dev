package commands

import (
	"context"

	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("mkdir", "Creates a new directory", doMkdir, AutocompleteDir)
}

func doMkdir(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{normalLine("mkdir: missing operand")}
	}

	name := args[0]
	if _, ok := session.CurrentNode.Children[name]; ok {
		return []types.Line{normalLine("mkdir: cannot create directory '" + name + "': File exists")}
	}

	session.CurrentNode.Children[name] = vfs.NewDir(name, session.CurrentNode)
	
	// Trigger persistence save if we had it
	vfs.SaveVFS(session.RootNode)

	return []types.Line{}
}
