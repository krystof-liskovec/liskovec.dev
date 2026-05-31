package commands

import (
	"context"

	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("touch", "Creates a new empty file", doTouch, AutocompletePath)
}

func doTouch(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{normalLine("touch: missing file operand")}
	}

	name := args[0]
	if _, ok := session.CurrentNode.Children[name]; ok {
		// In a real system touch updates the timestamp, but here we just do nothing if it exists
		return []types.Line{}
	}

	session.CurrentNode.Children[name] = vfs.NewFile(name, "", session.CurrentNode)
	
	vfs.SaveVFS(session.RootNode)

	return []types.Line{}
}
