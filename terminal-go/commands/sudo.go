package commands

import (
	"context"
	"strings"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("sudo", "Attempts superuser command privileges", doSudo, AutocompleteNone)
}

func doSudo(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	if len(args) == 0 {
		return []types.Line{
			normalLine(t.SudoUsage),
		}
	}

	cmd := strings.ToLower(args[0])
	if cmd == "rm" && len(args) > 1 && args[1] == "-rf" {
		return []types.Line{
			{Segments: []types.Segment{bSeg(t.SudoPasswordPromptWipe, "text-muted")}},
			normalLine(""),
			{Segments: []types.Segment{bSeg(t.SudoWipeWarning, "text-error")}},
			{Segments: []types.Segment{cSeg(t.SudoWipeParsing, "text-error")}},
			normalLine(t.SudoWipeDelFile + "/welcome.txt... OK"),
			normalLine(t.SudoWipeDelFile + "/about.txt... OK"),
			normalLine(t.SudoWipeDelFile + "/skills.txt... OK"),
			normalLine(t.SudoWipeDelFolder + "/projects... OK"),
			normalLine(t.SudoWipeDelFolder + "/secrets... OK"),
			normalLine(""),
			{Segments: []types.Segment{bSeg(t.SudoWipeSelfDestructPrevented, "text-success")}},
			normalLine(t.SudoWipeNiceTry),
		}
	}

	return []types.Line{
		{Segments: []types.Segment{bSeg(t.SudoPasswordPromptReport, "text-muted")}},
		{Segments: []types.Segment{cSeg(t.SudoNotSudoers, "text-error")}},
	}
}
