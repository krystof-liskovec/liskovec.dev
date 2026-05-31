package commands

import (
	"context"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("skills", "View technical expertise visual progress bars", getSkills, AutocompleteNone)
}

func getSkills(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	return []types.Line{
		{Segments: []types.Segment{bSeg(t.SkillsTitle, "text-highlight")}},
		normalLine(""),
		{Segments: []types.Segment{bSeg(t.SkillsLanguagesHeader, "text-accent")}},
		{Segments: []types.Segment{bSeg("  Go         ", "text-primary"), cSeg("[██████████████████░░] 90%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  TypeScript ", "text-primary"), cSeg("[████████████████░░░░] 80%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  HTML5/CSS3 ", "text-primary"), cSeg("[██████████████████░░] 90%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  Postgres   ", "text-primary"), cSeg("[██████████████░░░░░░] 70%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  Rust       ", "text-primary"), cSeg("[██████████░░░░░░░░░░] 50%", "theme-glow-accent")}},
		normalLine(""),
		{Segments: []types.Segment{bSeg(t.SkillsFrameworksHeader, "text-accent")}},
		{Segments: []types.Segment{bSeg("  Astro FE   ", "text-primary"), cSeg("[██████████████████░░] 90%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  React      ", "text-primary"), cSeg("[████████████████░░░░] 80%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  Node.js    ", "text-primary"), cSeg("[██████████████░░░░░░] 70%", "theme-glow-accent")}},
		normalLine(""),
		{Segments: []types.Segment{bSeg(t.SkillsInfraHeader, "text-accent")}},
		{Segments: []types.Segment{bSeg("  Git/DevOps ", "text-primary"), cSeg("[██████████████████░░] 90%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  Docker     ", "text-primary"), cSeg("[██████████████░░░░░░] 70%", "theme-glow-accent")}},
		{Segments: []types.Segment{bSeg("  Linux/Bash ", "text-primary"), cSeg("[████████████████░░░░] 80%", "theme-glow-accent")}},
		normalLine(""),
		normalLine(t.SkillsFooter),
	}
}
