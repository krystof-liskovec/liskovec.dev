package commands

import (
	"context"

	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("rm", "Removes a file or directory", doRm, AutocompletePath)
}

func doRm(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{normalLine("rm: missing operand")}
	}

	name := args[0]
	if _, ok := session.CurrentNode.Children[name]; !ok {
		return []types.Line{normalLine("rm: cannot remove '" + name + "': No such file or directory")}
	}

	delete(session.CurrentNode.Children, name)
	
	vfs.SaveVFS(session.RootNode)

	return []types.Line{}
}
