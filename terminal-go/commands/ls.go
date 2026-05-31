package commands

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("ls", "Lists directory contents (supports -l, -a)", doLs, AutocompletePath)
}

func doLs(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	opts := ParseOptions(args)
	showHidden := opts.Has('a') || opts.HasLong("all")
	longFormat := opts.Has('l') || opts.HasLong("long")
	positionalArgs := opts.Args

	target := session.CurrentNode
	if len(positionalArgs) > 0 {
		resolved, pathPart, ok := vfs.ResolvePath(session.CurrentNode, session.RootNode, positionalArgs[0])
		if !ok {
			t := i18n.T()
			return []types.Line{
				{Segments: []types.Segment{
					cSeg(t.LsErrorCannotAccess, "text-error"),
					cSeg(positionalArgs[0], "text-error"),
					cSeg(t.CdErrorNoSuchFileOrDir, "text-error"),
					cSeg(pathPart, "text-error"),
					cSeg("')", "text-error"),
				}},
			}
		}
		if !resolved.IsDir {
			// Even for a single file, -l should show details
			if longFormat {
				return []types.Line{formatLongLine(resolved)}
			}
			return []types.Line{
				{Segments: []types.Segment{cSeg(resolved.Name, "text-body")}},
			}
		}
		target = resolved
	}

	if len(target.Children) == 0 {
		return []types.Line{}
	}

	// Get and sort keys
	var keys []string
	for k := range target.Children {
		if !showHidden && strings.HasPrefix(k, ".") {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	if longFormat {
		var lines []types.Line
		for _, k := range keys {
			child := target.Children[k]
			lines = append(lines, formatLongLine(child))
		}
		return lines
	}

	var segs []types.Segment
	for _, k := range keys {
		child := target.Children[k]
		name := child.Name
		if child.IsDir {
			segs = append(segs, bSeg(name+"/", "text-primary"))
		} else {
			segs = append(segs, cSeg(name, "text-body"))
		}
		segs = append(segs, cSeg("   ", ""))
	}

	return []types.Line{{Segments: segs}}
}

func formatLongLine(node *types.VNode) types.Line {
	typeChar := "-"
	color := "text-body"
	name := node.Name
	if node.IsDir {
		typeChar = "d"
		color = "text-primary"
		name += "/"
	}

	size := len(node.Content)
	// Permissions are mocked as r-xr-xr-x for simplicity
	perms := "r-xr-xr-x"
	if !node.IsDir {
		perms = "rw-r--r--"
	}

	return types.Line{
		Segments: []types.Segment{
			cSeg(fmt.Sprintf("%s%s ", typeChar, perms), "text-muted"),
			cSeg("guest  guest  ", "text-muted"),
			bSeg(fmt.Sprintf("%8d ", size), "text-accent"),
			bSeg(name, color),
		},
	}
}
