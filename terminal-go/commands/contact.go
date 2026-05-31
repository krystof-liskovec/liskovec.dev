package commands

import (
	"context"
	"fmt"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("contact", "Get clickable methods to reach me", getContact, AutocompleteNone)
}

func getContact(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	return []types.Line{
		{Segments: []types.Segment{bSeg(t.ContactTitle, "text-highlight")}},
		normalLine(""),
		normalLine("+------------+------------------------------------------+"),
		{Segments: []types.Segment{
			cSeg("| ", ""),
			bSeg(fmt.Sprintf("%-10s", t.ContactPlatform), "text-primary"),
			cSeg(" | ", ""),
			bSeg(fmt.Sprintf("%-40s", t.ContactInteractiveLink), "text-accent"),
			cSeg(" |", ""),
		}},
		normalLine("+------------+------------------------------------------+"),
		{Segments: []types.Segment{
			cSeg("| Email      | ", ""),
			lSeg("krystof@liskovec.dev", "mailto:krystof@liskovec.dev", "link-text"),
			cSeg("                     |", ""),
		}},
		{Segments: []types.Segment{
			cSeg("| GitHub     | ", ""),
			lSeg("github.com/kristof-liskovec", "https://github.com/kristof-liskovec", "link-text"),
			cSeg("          |", ""),
		}},
		{Segments: []types.Segment{
			cSeg("| LinkedIn   | ", ""),
			lSeg("linkedin.com/in/krystof-liskovec", "https://linkedin.com/in/krystof-liskovec", "link-text"),
			cSeg("     |", ""),
		}},
		normalLine("+------------+------------------------------------------+"),
		normalLine(""),
		normalLine(t.ContactFooter),
	}
}
