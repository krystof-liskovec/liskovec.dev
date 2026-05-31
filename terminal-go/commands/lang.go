package commands

import (
	"context"
	"strings"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

func init() {
	Register("lang", "Changes console language (en, cs)", doLang, AutocompleteNone)
}

func doLang(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{
			{Segments: []types.Segment{bSeg("Usage: lang [en|cs]", "text-primary")}},
			normalLine("Available: en (English), cs (Čeština)"),
		}
	}

	langVal := strings.ToLower(args[0])
	var newLang i18n.Language
	var dispName string

	switch langVal {
	case "en":
		newLang = i18n.EN
		dispName = "English (en)"
	case "cs":
		newLang = i18n.CS
		dispName = "Čeština (cs)"
	default:
		return []types.Line{
			{Segments: []types.Segment{cSeg("lang: unknown locale: ", "text-error"), bSeg(args[0], "text-error")}},
			normalLine("Available: en, cs"),
		}
	}

	// 1. Set language state
	i18n.SetLanguage(newLang)

	// 2. Rebuild VFS in the new language to translate all files in-memory
	currentPath := session.CurrentNode.Path()
	newRoot := vfs.InitVFS()
	session.RootNode = newRoot

	// 3. Preserve user's current directory path in the newly rebuilt VFS
	resolved, _, ok := vfs.ResolvePath(newRoot, newRoot, currentPath)
	if ok && resolved != nil {
		session.CurrentNode = resolved
	} else {
		session.CurrentNode = newRoot
	}

	result.CurrentDir = session.CurrentNode.Path()

	// 4. Resolve translated output success message
	var shiftedMsg string
	if newLang == i18n.CS {
		shiftedMsg = "Jazyk konzole úspěšně změněn na: "
	} else {
		shiftedMsg = "Console language shifted successfully to: "
	}

	return []types.Line{
		{Segments: []types.Segment{
			cSeg(shiftedMsg, "text-body"),
			bSeg(dispName, "text-success"),
		}},
	}
}
