package main

import (
	"context"
	"encoding/json"
	"strings"
	"syscall/js"
	"time"

	"liskovec.dev/terminal/commands"
	"liskovec.dev/terminal/types"
)

// handleKeyPress routes keystroke inputs to update terminal state
func handleKeyPress(key string, ctrlKey, metaKey, shiftKey bool) {
	if globalSession.ActiveProgram != nil {
		if globalSession.ActiveProgram.HandleKeyPress(key, ctrlKey, metaKey, shiftKey) {
			redraw()
		}
		return
	}

	// 1. Handle standard Terminal Interrupt (Ctrl+C)
	if ctrlKey && !shiftKey && (key == "c" || key == "C") {
		if globalSession.IsRunning && globalSession.CancelCmd != nil {
			globalSession.CancelCmd()
			globalSession.IsRunning = false
			js.Global().Call("playBeep", 440, 0.1, "sawtooth")
			redraw()
			return
		}

		promptLine := types.Line{
			Segments: []types.Segment{
				{Text: "guest@liskovec.dev:" + globalSession.CurrentNode.Path() + "$ ", Color: "prompt-prefix", Bold: true},
				{Text: cmdBuffer + "^C", Color: "text-body"},
			},
		}
		outputHistory = append(outputHistory, promptLine)
		cmdBuffer = ""
		cursorPosition = 0
		scrollOffset = 0
		cursorActive = true
		redraw()
		return
	}

	// If a command is running, we ignore other inputs (except Ctrl+C which is handled above)
	if globalSession.IsRunning {
		return
	}

	// Snap scrollOffset back to prompt on any active input
	if key != "PageUp" && key != "PageDown" {
		scrollOffset = 0
	}

	// 2. Handle authentic Terminal Copy (Ctrl+Shift+C)
	if ctrlKey && shiftKey && (key == "c" || key == "C") {
		var textBuilder strings.Builder
		for _, line := range outputHistory {
			var lineText strings.Builder
			for _, seg := range line.Segments {
				lineText.WriteString(seg.Text)
			}
			textBuilder.WriteString(lineText.String() + "\n")
		}

		js.Global().Get("navigator").Get("clipboard").Call("writeText", textBuilder.String())
		js.Global().Call("playBeep", 880, 0.05, "sine") // Subtle confirmation beep
		return
	}

	// 2.5 Handle Ctrl+W / Alt+Backspace (Delete word before cursor)
	isAltBackspace := metaKey && key == "Backspace"
	if (ctrlKey && !shiftKey && (key == "w" || key == "W")) || isAltBackspace {
		if cursorPosition > 0 {
			left := cmdBuffer[:cursorPosition]
			right := cmdBuffer[cursorPosition:]
			
			// Trim trailing spaces
			trimmedLeft := strings.TrimRight(left, " ")
			if len(trimmedLeft) == 0 {
				cmdBuffer = right
				cursorPosition = 0
			} else {
				// Find last space
				lastSpace := strings.LastIndex(trimmedLeft, " ")
				if lastSpace == -1 {
					cmdBuffer = right
					cursorPosition = 0
				} else {
					cmdBuffer = trimmedLeft[:lastSpace+1] + right
					cursorPosition = lastSpace + 1
				}
			}
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}
		return
	}

	// 2.6 Handle Ctrl+U (Delete entire line before cursor)
	if ctrlKey && !shiftKey && (key == "u" || key == "U") {
		if cursorPosition > 0 {
			cmdBuffer = cmdBuffer[cursorPosition:]
			cursorPosition = 0
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}
		return
	}

	// 2.7 Handle Ctrl+L (Clear terminal history)
	if ctrlKey && !shiftKey && (key == "l" || key == "L") {
		outputHistory = []types.Line{}
		scrollOffset = 0
		redraw()
		return
	}

	// 3. Handle authentic Terminal Paste (Ctrl+Shift+V)
	if ctrlKey && shiftKey && (key == "v" || key == "V") {
		js.Global().Get("navigator").Get("clipboard").Call("readText").Call("then", js.FuncOf(func(this js.Value, args []js.Value) any {
			if len(args) > 0 {
				text := args[0].String()
				if text != "" {
					left := cmdBuffer[:cursorPosition]
					right := cmdBuffer[cursorPosition:]
					cmdBuffer = left + text + right
					cursorPosition += len(text)
					scrollOffset = 0
					cursorActive = true
					redraw()
				}
			}
			return nil
		}))
		return
	}

	switch key {
	case "Enter":
		rawCmd := cmdBuffer
		
		// Print current prompt prefix + typed chars to history list
		promptLine := types.Line{
			Segments: []types.Segment{
				{Text: "guest@liskovec.dev:" + globalSession.CurrentNode.Path() + "$ ", Color: "prompt-prefix", Bold: true},
				{Text: cmdBuffer, Color: "text-highlight"},
			},
		}
		outputHistory = append(outputHistory, promptLine)

		if rawCmd != "" {
			// Set session to running state
			globalSession.IsRunning = true
			
			// Create cancellation context
			cmdCtx, cancel := context.WithCancel(context.Background())
			globalSession.CancelCmd = cancel

			go func() {
				// Execute CLI command router (which appends to globalSession.History)
				result := commands.Execute(cmdCtx, rawCmd, globalSession)
				
				// Handle immediate actions before potential blocking
				if result.Clear {
					outputHistory = []types.Line{}
				}
				if result.Theme != "" {
					js.Global().Call("applyTheme", result.Theme)
				}
				if result.OpenURL != "" {
					js.Global().Get("window").Call("open", result.OpenURL, "_blank")
				}

				if result.UseAlternateBuffer {
					globalSession.SavedHistory = make([]types.Line, len(outputHistory))
					copy(globalSession.SavedHistory, outputHistory)
					outputHistory = []types.Line{}
					redraw()
				}

				if result.IsBlocking {
					// If blocking, show intermediate output if any
					if len(result.Output) > 0 {
						outputHistory = append(outputHistory, result.Output...)
						redraw()
					}
					// Wait for interrupt
					<-cmdCtx.Done()
				} else {
					// Optional: simulated "work" delay to make it feel blocking for normal commands
					select {
					case <-time.After(100 * time.Millisecond):
					case <-cmdCtx.Done():
						// Even if interrupted, we might need to restore history
						if result.UseAlternateBuffer {
							outputHistory = globalSession.SavedHistory
							globalSession.SavedHistory = nil
						}
						globalSession.IsRunning = false
						return
					}

					if len(result.Output) > 0 {
						outputHistory = append(outputHistory, result.Output...)
					}
				}

				// Restore history if alternate buffer was used
				if result.UseAlternateBuffer {
					outputHistory = globalSession.SavedHistory
					globalSession.SavedHistory = nil
				}

				historyCursor = len(globalSession.History)
				globalSession.IsRunning = false
				globalSession.CancelCmd = nil
				redraw()
			}()
		}

		cmdBuffer = ""
		cursorPosition = 0
		js.Global().Call("playBeep", 600, 0.05, "sine") // Execution audio tone
		cursorActive = true
		redraw()

	case "Backspace":
		if cursorPosition > 0 {
			left := cmdBuffer[:cursorPosition-1]
			right := cmdBuffer[cursorPosition:]
			cmdBuffer = left + right
			cursorPosition--
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}

	case "Delete":
		if cursorPosition < len(cmdBuffer) {
			left := cmdBuffer[:cursorPosition]
			right := cmdBuffer[cursorPosition+1:]
			cmdBuffer = left + right
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}

	case "Tab":
		queryResultStr := jsAutocomplete(js.Value{}, []js.Value{js.ValueOf(cmdBuffer)})
		var matches []string
		_ = json.Unmarshal([]byte(queryResultStr.String()), &matches)

		if len(matches) == 0 {
			js.Global().Call("playBeep", 220, 0.08, "sawtooth") // Error buzz tone
			return
		}

		if len(matches) == 1 {
			// Autocomplete single match string
			parts := commands.ParseCommand(cmdBuffer)
			if len(parts) == 1 && !strings.HasSuffix(cmdBuffer, " ") {
				cmdBuffer = matches[0] + " "
			} else if len(parts) > 1 {
				parts[len(parts)-1] = matches[0]
				cmdBuffer = strings.Join(parts, " ")
			} else {
				cmdBuffer += matches[0]
			}
			cursorPosition = len(cmdBuffer)
			js.Global().Call("playBeep", 600, 0.04, "sine")
			cursorActive = true
			redraw()
		} else {
			// Write suggestions list into historical output lines
			outputHistory = append(outputHistory, types.Line{
				Segments: []types.Segment{{Text: "Completions: " + strings.Join(matches, "   "), Color: "text-muted"}},
			})
			js.Global().Call("playBeep", 520, 0.06, "sine")
			cursorActive = true
			redraw()
		}

	case "ArrowUp":
		if len(globalSession.History) == 0 {
			return
		}
		if historyCursor > 0 {
			historyCursor--
			cmdBuffer = globalSession.History[historyCursor]
			cursorPosition = len(cmdBuffer)
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}

	case "ArrowDown":
		if len(globalSession.History) == 0 {
			return
		}
		if historyCursor < len(globalSession.History)-1 {
			historyCursor++
			cmdBuffer = globalSession.History[historyCursor]
			cursorPosition = len(cmdBuffer)
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		} else {
			historyCursor = len(globalSession.History)
			cmdBuffer = ""
			cursorPosition = 0
			cursorActive = true
			redraw()
		}

	case "ArrowLeft":
		if cursorPosition > 0 {
			cursorPosition--
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}

	case "ArrowRight":
		if cursorPosition < len(cmdBuffer) {
			cursorPosition++
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}

	case "PageUp":
		scrollOffset += 5
		cursorActive = true
		redraw()

	case "PageDown":
		scrollOffset -= 5
		if scrollOffset < 0 {
			scrollOffset = 0
		}
		cursorActive = true
		redraw()

	default:
		// Accept normal printable keystroke characters
		if len(key) == 1 && !ctrlKey && !metaKey {
			left := cmdBuffer[:cursorPosition]
			right := cmdBuffer[cursorPosition:]
			cmdBuffer = left + key + right
			cursorPosition++
			js.Global().Call("playKeyClick")
			cursorActive = true
			redraw()
		}
	}
}

// jsAutocomplete handles autocomplete lookups in Go package context
func jsAutocomplete(this js.Value, args []js.Value) js.Value {
	if len(args) < 1 {
		return js.ValueOf("[]")
	}

	input := args[0].String()
	trimmed := strings.TrimLeft(input, " ")
	parts := commands.ParseCommand(trimmed)

	// Case A: Autocompleting the command itself
	if len(parts) == 0 || (len(parts) == 1 && !strings.HasSuffix(input, " ")) {
		prefix := ""
		if len(parts) == 1 {
			prefix = parts[0]
		}

		var matches []string
		for cmdName := range commands.Registry {
			if strings.HasPrefix(cmdName, prefix) {
				matches = append(matches, cmdName)
			}
		}

		jsonData, _ := json.Marshal(matches)
		return js.ValueOf(string(jsonData))
	}

	// Case B: Autocompleting command arguments based on metadata
	cmdName := strings.ToLower(parts[0])
	
	// Support sudo redirection
	if cmdName == "sudo" && len(parts) > 1 {
		cmdName = strings.ToLower(parts[1])
	}

	cmd, exists := commands.Registry[cmdName]
	if !exists || cmd.AutocompleteType == commands.AutocompleteNone {
		return js.ValueOf("[]")
	}

	prefix := ""
	if !strings.HasSuffix(input, " ") {
		prefix = parts[len(parts)-1]
	}

	var matches []string

	switch cmd.AutocompleteType {
	case commands.AutocompletePath, commands.AutocompleteDir:
		for _, child := range globalSession.CurrentNode.Children {
			name := child.Name
			if cmd.AutocompleteType == commands.AutocompleteDir && !child.IsDir {
				continue
			}

			if strings.HasPrefix(name, prefix) {
				if child.IsDir {
					matches = append(matches, name+"/")
				} else {
					matches = append(matches, name)
				}
			}
		}

	case commands.AutocompleteTheme:
		for themeName := range themesList {
			if strings.HasPrefix(themeName, prefix) {
				matches = append(matches, themeName)
			}
		}
	}

	jsonData, _ := json.Marshal(matches)
	return js.ValueOf(string(jsonData))
}
