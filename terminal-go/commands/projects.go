package commands

import (
	"context"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("projects", "Examine personal and open-source project descriptions", getProjects, AutocompleteNone)
}

func getProjects(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	
	activeLabel := " - Personal Portfolio Dashboard [ACTIVE]"
	openSourceLabel := " - Terminal Docker Monitor [OPEN SOURCE]"
	if i18n.GetLanguage() == i18n.CS {
		activeLabel = " - Osobní portfolio [AKTIVNÍ]"
		openSourceLabel = " - Terminálový monitor Dockeru [OPEN SOURCE]"
	}

	return []types.Line{
		{Segments: []types.Segment{bSeg(t.ProjectsTitle, "text-highlight")}},
		normalLine(""),
		{Segments: []types.Segment{
			bSeg("1. liskovec.dev", "text-primary"),
			cSeg(activeLabel, "text-success"),
		}},
		{Segments: []types.Segment{cSeg("   Stack: Astro, WebAssembly, Go", "text-muted")}},
		{Segments: []types.Segment{cSeg("   Summary: " + t.ProjectsLiskovecDevSummary, "text-body")}},
		{Segments: []types.Segment{
			cSeg("   URL:   ", "text-body"),
			lSeg("https://github.com/kristof-liskovec/liskovec.dev", "https://github.com/kristof-liskovec/liskovec.dev", "link-text"),
		}},
		normalLine(""),
		{Segments: []types.Segment{
			bSeg("2. GopherShell CLI", "text-primary"),
			cSeg(openSourceLabel, "text-accent"),
		}},
		{Segments: []types.Segment{cSeg("   Stack: Go, Cobra, Docker-SDK", "text-muted")}},
		{Segments: []types.Segment{cSeg("   Summary: " + t.ProjectsGopherShellSummary, "text-body")}},
		{Segments: []types.Segment{
			cSeg("   Code:  ", "text-body"),
			lSeg("github.com/kristof-liskovec/gophershell", "https://github.com", "link-text"),
		}},
		normalLine(""),
		normalLine(t.ProjectsFooter),
	}
}
