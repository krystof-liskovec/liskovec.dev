package commands

import (
	"context"
	"strings"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

// CommandHandler defines the standard signature for all shell command execution functions
type CommandHandler func(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line

// AutocompleteType defines how arguments should be autocompleted for a command
type AutocompleteType int

const (
	AutocompleteNone AutocompleteType = iota
	AutocompletePath                  // Files and directories
	AutocompleteDir                   // Directories only
	AutocompleteTheme                 // Theme names
)

// Command holds metadata and execution handler references for a command
type Command struct {
	Name             string
	Description      string
	Handler          CommandHandler
	AutocompleteType AutocompleteType
}

// Registry maps command names to their handlers
var Registry = map[string]Command{}

// Register adds a new CLI command to the global session shell registry
func Register(name string, description string, handler CommandHandler, autoType AutocompleteType) {
	Registry[strings.ToLower(name)] = Command{
		Name:             name,
		Description:      description,
		Handler:          handler,
		AutocompleteType: autoType,
	}
}

// Execute parses input CLI commands, queries Registry, and triggers active handlers
func Execute(ctx context.Context, input string, session *types.Session) types.ExecResult {
	session.History = append(session.History, input)
	
	// Log command to persistent /.history file
	vfs.WriteFile(session.RootNode, session.RootNode, "/.history", input, true)
	vfs.SaveVFS(session.RootNode)

	args := ParseCommand(input)

	if len(args) == 0 {
		return types.ExecResult{
			Output:     []types.Line{},
			CurrentDir: session.CurrentNode.Path(),
		}
	}

	// Handle redirection
	var redirectFile string
	var appendMode bool
	var finalArgs []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		if arg == ">" || arg == ">>" {
			if i+1 < len(args) {
				redirectFile = args[i+1]
				appendMode = (arg == ">>")
				i++ // skip file name
				continue
			}
		}
		// Also handle cases like echo "hi">file
		if strings.Contains(arg, ">") && !strings.HasPrefix(arg, "\"") {
			parts := strings.SplitN(arg, ">", 2)
			if parts[0] != "" {
				finalArgs = append(finalArgs, parts[0])
			}
			if strings.HasPrefix(arg, ">>") {
				appendMode = true
				if len(parts) > 1 && parts[1] != "" {
					redirectFile = parts[1]
				} else if i+1 < len(args) {
					redirectFile = args[i+1]
					i++
				}
			} else {
				if parts[1] != "" {
					redirectFile = parts[1]
				} else if i+1 < len(args) {
					redirectFile = args[i+1]
					i++
				}
			}
			continue
		}
		finalArgs = append(finalArgs, arg)
	}

	if len(finalArgs) == 0 {
		return types.ExecResult{
			Output:     []types.Line{},
			CurrentDir: session.CurrentNode.Path(),
		}
	}

	cmdName := strings.ToLower(finalArgs[0])
	cmdArgs := finalArgs[1:]

	result := types.ExecResult{
		CurrentDir: session.CurrentNode.Path(),
	}

	// Dynamic lookup inside Command Registry
	cmd, found := Registry[cmdName]
	if !found {
		t := i18n.T()
		result.Output = []types.Line{
			{Segments: []types.Segment{
				cSeg(t.ShellCmdNotFound, "text-error"),
				bSeg(cmdName, "text-error"),
			}},
			normalLine(t.ShellTypeHelp),
		}
		return result
	}

	// Trigger command execution
	output := cmd.Handler(ctx, session, cmdArgs, &result)

	// Apply redirection if requested
	if redirectFile != "" {
		var contentBuilder strings.Builder
		for i, line := range output {
			var lineBuilder strings.Builder
			for _, seg := range line.Segments {
				lineBuilder.WriteString(seg.Text)
			}
			contentBuilder.WriteString(lineBuilder.String())
			if i < len(output)-1 {
				contentBuilder.WriteString("\n")
			}
		}

		vfs.WriteFile(session.CurrentNode, session.RootNode, redirectFile, contentBuilder.String(), appendMode)
		vfs.SaveVFS(session.RootNode)
		result.Output = []types.Line{} // Clear output if redirected
	} else {
		result.Output = output
	}

	return result
}

// ParseCommand parses raw terminal input respecting double quotes
func ParseCommand(input string) []string {
	input = strings.TrimSpace(input)
	if input == "" {
		return []string{}
	}

	var args []string
	var current strings.Builder
	inQuotes := false

	for i := 0; i < len(input); i++ {
		char := input[i]
		if char == '"' {
			inQuotes = !inQuotes
			continue
		}
		if char == ' ' && !inQuotes {
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
			continue
		}
		current.WriteByte(char)
	}
	if current.Len() > 0 {
		args = append(args, current.String())
	}
	return args
}

// Helper methods to build colored text segments quickly
func cSeg(text string, color string) types.Segment {
	return types.Segment{Text: text, Color: color}
}

func bSeg(text string, color string) types.Segment {
	return types.Segment{Text: text, Color: color, Bold: true}
}

func lSeg(text string, link string, color string) types.Segment {
	return types.Segment{Text: text, Link: link, Color: color}
}

func normalLine(text string) types.Line {
	return types.Line{Segments: []types.Segment{{Text: text}}}
}
