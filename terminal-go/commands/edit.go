package commands

import (
	"context"
	"fmt"
	"strings"
	"syscall/js"

	"liskovec.dev/terminal/renderer"
	"liskovec.dev/terminal/themes"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

type EditorProgram struct {
	Session  *types.Session
	FilePath string
	FileName string
	Lines    []string
	CursorX  int
	CursorY  int
	ScrollY  int
	Modified bool
}

func init() {
	Register("edit", "Simple full-screen text editor", doEdit, AutocompletePath)
}

func doEdit(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	if len(args) == 0 {
		return []types.Line{normalLine("edit: missing file operand")}
	}

	filePath := args[0]
	fileName := filePath
	content := ""

	// Attempt to resolve file
	node, _, ok := vfs.ResolvePath(session.CurrentNode, session.RootNode, filePath)
	if ok {
		if node.IsDir {
			return []types.Line{normalLine("edit: '" + filePath + "' is a directory")}
		}
		content = node.Content
		fileName = node.Name
	}

	// Prepare lines
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		lines = []string{""}
	}

	// Setup editor program
	editor := &EditorProgram{
		Session:  session,
		FilePath: filePath,
		FileName: fileName,
		Lines:    lines,
		CursorX:  0,
		CursorY:  0,
		ScrollY:  0,
		Modified: false,
	}

	result.IsBlocking = true
	result.UseAlternateBuffer = true
	session.ActiveProgram = editor

	return []types.Line{}
}

func (e *EditorProgram) HandleKeyPress(key string, ctrlKey, metaKey, shiftKey bool) bool {
	// 1. Handle Ctrl+X (Exit)
	if ctrlKey && (key == "x" || key == "X") {
		e.Session.ActiveProgram = nil
		if e.Session.CancelCmd != nil {
			e.Session.CancelCmd()
		}
		return true
	}

	// 2. Handle Ctrl+S (Save)
	if ctrlKey && (key == "s" || key == "S") {
		content := strings.Join(e.Lines, "\n")
		vfs.WriteFile(e.Session.RootNode, e.Session.RootNode, e.FilePath, content, false)
		vfs.SaveVFS(e.Session.RootNode)
		e.Modified = false
		return true
	}

	// 3. Navigation
	switch key {
	case "ArrowUp":
		if e.CursorY > 0 {
			e.CursorY--
			if e.CursorX > len(e.Lines[e.CursorY]) {
				e.CursorX = len(e.Lines[e.CursorY])
			}
		}
		return true
	case "ArrowDown":
		if e.CursorY < len(e.Lines)-1 {
			e.CursorY++
			if e.CursorX > len(e.Lines[e.CursorY]) {
				e.CursorX = len(e.Lines[e.CursorY])
			}
		}
		return true
	case "ArrowLeft":
		if e.CursorX > 0 {
			e.CursorX--
		} else if e.CursorY > 0 {
			e.CursorY--
			e.CursorX = len(e.Lines[e.CursorY])
		}
		return true
	case "ArrowRight":
		if e.CursorX < len(e.Lines[e.CursorY]) {
			e.CursorX++
		} else if e.CursorY < len(e.Lines)-1 {
			e.CursorY++
			e.CursorX = 0
		}
		return true
	case "Backspace":
		if e.CursorX > 0 {
			line := e.Lines[e.CursorY]
			// Handle utf-8 safely if needed, but for now ASCII
			e.Lines[e.CursorY] = line[:e.CursorX-1] + line[e.CursorX:]
			e.CursorX--
			e.Modified = true
		} else if e.CursorY > 0 {
			// Join with previous line
			prevLineLen := len(e.Lines[e.CursorY-1])
			e.Lines[e.CursorY-1] += e.Lines[e.CursorY]
			e.Lines = append(e.Lines[:e.CursorY], e.Lines[e.CursorY+1:]...)
			e.CursorY--
			e.CursorX = prevLineLen
			e.Modified = true
		}
		return true
	case "Delete":
		line := e.Lines[e.CursorY]
		if e.CursorX < len(line) {
			e.Lines[e.CursorY] = line[:e.CursorX] + line[e.CursorX+1:]
			e.Modified = true
		} else if e.CursorY < len(e.Lines)-1 {
			// Join next line into this one
			e.Lines[e.CursorY] += e.Lines[e.CursorY+1]
			e.Lines = append(e.Lines[:e.CursorY+1], e.Lines[e.CursorY+2:]...)
			e.Modified = true
		}
		return true
	case "Enter":
		line := e.Lines[e.CursorY]
		remaining := line[e.CursorX:]
		e.Lines[e.CursorY] = line[:e.CursorX]
		
		// Insert new line
		newLines := make([]string, 0, len(e.Lines)+1)
		newLines = append(newLines, e.Lines[:e.CursorY+1]...)
		newLines = append(newLines, remaining)
		newLines = append(newLines, e.Lines[e.CursorY+1:]...)
		e.Lines = newLines
		
		e.CursorY++
		e.CursorX = 0
		e.Modified = true
		return true
	case "Tab":
		line := e.Lines[e.CursorY]
		e.Lines[e.CursorY] = line[:e.CursorX] + "    " + line[e.CursorX:]
		e.CursorX += 4
		e.Modified = true
		return true
	}

	// 4. Typing
	if len(key) == 1 && !ctrlKey && !metaKey {
		line := e.Lines[e.CursorY]
		e.Lines[e.CursorY] = line[:e.CursorX] + key + line[e.CursorX:]
		e.CursorX++
		e.Modified = true
		return true
	}

	return false
}

func (e *EditorProgram) Render(ctx js.Value, width, height float64, scaleFactor float64, fontSetting string, theme interface{}) {
	canvasTheme := theme.(themes.CanvasTheme)
	
	// 1. Clear Background
	renderer.DrawRect(ctx, 0, 0, width, height, canvasTheme.BgColor)

	// 2. Draw Top Status Bar
	statusBarHeight := 30.0 * scaleFactor
	renderer.DrawRect(ctx, 0, 0, width, statusBarHeight, canvasTheme.TitleBgColor)
	
	modifiedFlag := ""
	if e.Modified {
		modifiedFlag = "[modified]"
	}
	statusText := fmt.Sprintf(" EDITING: %s %s", e.FileName, modifiedFlag)
	statusFont := fmt.Sprintf("%dpx 'Share Tech Mono', monospace", int(12.0*scaleFactor))
	renderer.DrawText(ctx, statusText, 10*scaleFactor, 20*scaleFactor, statusFont, canvasTheme.TitleTextColor, true, "", "")

	// 3. Render Editor Buffer
	lineHeight := 20.0 * scaleFactor
	paddingTop := statusBarHeight + 15.0*scaleFactor
	paddingLeft := 15.0 * scaleFactor
	
	availableHeight := height - paddingTop - (35.0 * scaleFactor) // reserve for bottom bar
	maxLines := int(availableHeight / lineHeight)
	
	// Auto-scroll logic
	if e.CursorY >= e.ScrollY + maxLines {
		e.ScrollY = e.CursorY - maxLines + 1
	}
	if e.CursorY < e.ScrollY {
		e.ScrollY = e.CursorY
	}

	for i := 0; i < maxLines; i++ {
		lineIdx := e.ScrollY + i
		if lineIdx >= len(e.Lines) {
			break
		}
		
		y := paddingTop + float64(i)*lineHeight
		lineText := e.Lines[lineIdx]
		
		// Draw line number
		numText := fmt.Sprintf("%3d ", lineIdx+1)
		renderer.DrawText(ctx, numText, paddingLeft, y, fontSetting, canvasTheme.TextMuted, false, "", "")
		
		numWidth := renderer.MeasureText(ctx, numText, fontSetting, false)
		
		// Draw line content
		renderer.DrawText(ctx, lineText, paddingLeft + numWidth, y, fontSetting, canvasTheme.TextBody, false, "", "")
		
		// Draw cursor if on this line
		if lineIdx == e.CursorY {
			cursorSubstr := lineText[:e.CursorX]
			cursorXOffset := renderer.MeasureText(ctx, cursorSubstr, fontSetting, false)
			
			// Pulsing cursor or just block
			renderer.DrawRect(ctx, paddingLeft + numWidth + cursorXOffset + 2, y - 14.0*scaleFactor, 9*scaleFactor, 16*scaleFactor, canvasTheme.TextAccent)
			
			// Redraw character on top of cursor for readability
			if e.CursorX < len(lineText) {
				char := string(lineText[e.CursorX])
				renderer.DrawText(ctx, char, paddingLeft + numWidth + cursorXOffset + 2, y, fontSetting, canvasTheme.BgColor, false, "", "")
			}
		}
	}

	// 4. Draw Bottom Helper Bar
	bottomBarY := height - (30.0 * scaleFactor)
	renderer.DrawRect(ctx, 0, bottomBarY, width, 30.0*scaleFactor, canvasTheme.TitleBgColor)
	
	helperText := " ^S Save    ^X Exit "
	renderer.DrawText(ctx, helperText, 10*scaleFactor, bottomBarY + 20*scaleFactor, statusFont, canvasTheme.TextSuccess, false, "", "")
}
