package commands

import (
	"context"
	"strings"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("cat", "Prints the content of a file", doCat, AutocompletePath)
}

func doCat(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{{Segments: []types.Segment{cSeg(i18n.T().CatErrorMissingFile, "text-error")}}}
	}

	resolved, pathPart, ok := vfs.ResolvePath(session.CurrentNode, session.RootNode, args[0])
	if !ok {
		t := i18n.T()
		return []types.Line{
			{Segments: []types.Segment{
				cSeg(t.CatErrorNoSuchFileOrDir, "text-error"),
				cSeg(args[0], "text-error"),
				cSeg(t.CdErrorNoSuchFileOrDir, "text-error"),
				cSeg(pathPart, "text-error"),
				cSeg("')", "text-error"),
			}},
		}
	}

	if resolved.IsDir {
		t := i18n.T()
		return []types.Line{
			{Segments: []types.Segment{
				cSeg(t.CatErrorNoSuchFileOrDir, "text-error"),
				cSeg(resolved.Name, "text-error"),
				cSeg(t.CatErrorIsDirectory, "text-error"),
			}},
		}
	}

	// Split file content into lines
	contentLines := strings.Split(resolved.Content, "\n")
	var output []types.Line
	for _, l := range contentLines {
		output = append(output, normalLine(l))
	}
	return output
}
