package commands

import (
	"context"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("cd", "Changes current virtual directory", doCd, AutocompleteDir)
}

func doCd(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	targetPath := "/"
	if len(args) > 0 {
		targetPath = args[0]
	}

	resolved, pathPart, ok := vfs.ResolvePath(session.CurrentNode, session.RootNode, targetPath)
	if !ok {
		t := i18n.T()
		return []types.Line{
			{Segments: []types.Segment{
				cSeg("cd: ", "text-error"),
				cSeg(args[0], "text-error"),
				cSeg(t.CdErrorNoSuchFileOrDir, "text-error"),
				cSeg(pathPart, "text-error"),
				cSeg("')", "text-error"),
			}},
		}
	}

	if !resolved.IsDir {
		t := i18n.T()
		return []types.Line{
			{Segments: []types.Segment{
				cSeg(t.CdErrorNotADirectory, "text-error"),
				cSeg(resolved.Name, "text-error"),
			}},
		}
	}

	session.CurrentNode = resolved
	result.CurrentDir = resolved.Path()
	return []types.Line{}
}
