package main

import (
	"context"
	"fmt"
	"strings"
	"syscall/js"
	"time"

	"liskovec.dev/terminal/commands"
	"liskovec.dev/terminal/themes"
	"liskovec.dev/terminal/types"
	"liskovec.dev/terminal/vfs"
)

// Global Rendering Package States
var (
	canvas         js.Value
	ctx            js.Value
	canvasWidth    float64
	canvasHeight   float64
	
	globalSession  *types.Session
	outputHistory  []types.Line
	cmdBuffer      string
	cursorActive   bool = true
	historyCursor  int  = -1
	
	themesList     map[string]themes.CanvasTheme
	clickableLinks []types.ClickableLink
	fontSetting    string = "15px 'Share Tech Mono', monospace"
	scaleFactor    float64 = 1.0
	scrollOffset   int = 0
	cursorPosition int = 0

	matrixDrops    []int
)

func main() {
	// Initialize virtual filesystem
	rootNode := vfs.InitVFS()

	// Establish global terminal session
	globalSession = &types.Session{
		CurrentNode: rootNode,
		RootNode:    rootNode,
		History:     make([]string, 0),
		StartTime:   time.Now(),
		ActiveTheme: "viper",
	}

	// Initialize theme mappings
	themesList = themes.GetThemeMap()

	// Apply persisted theme if exists
	if themeNode, _, ok := vfs.ResolvePath(rootNode, rootNode, "/.theme"); ok && !themeNode.IsDir {
		themeName := strings.TrimSpace(themeNode.Content)
		if _, exists := themesList[themeName]; exists {
			globalSession.ActiveTheme = themeName
			// Fire theme swap to sync JS/CSS state
			// Use a small delay to ensure DOM is ready or handled via applyTheme
			time.AfterFunc(10*time.Millisecond, func() {
				js.Global().Call("applyTheme", themeName)
			})
		}
	}

	// Populate command history from /.history if it exists
	if historyNode, _, ok := vfs.ResolvePath(rootNode, rootNode, "/.history"); ok && !historyNode.IsDir {
		lines := strings.Split(strings.TrimSpace(historyNode.Content), "\n")
		for _, line := range lines {
			if line != "" {
				globalSession.History = append(globalSession.History, line)
			}
		}
		historyCursor = len(globalSession.History)
	}

	// Wait for DOMContentLoaded to capture canvas elements
	js.Global().Get("window").Call("addEventListener", "DOMContentLoaded", js.FuncOf(func(this js.Value, args []js.Value) any {
		initCanvasApp()
		return nil
	}))

	// Backup initialization in case DOMContentLoaded already fired
	time.AfterFunc(100*time.Millisecond, func() {
		if ctx.Type() == js.TypeUndefined {
			initCanvasApp()
		}
	})

	// Block the main thread continuously to keep the Go app active in-browser
	select {}
}

func initCanvasApp() {
	doc := js.Global().Get("document")
	canvasElement := doc.Call("getElementById", "terminal-canvas")
	if canvasElement.Type() == js.TypeNull || canvasElement.Type() == js.TypeUndefined {
		return
	}

	canvas = canvasElement
	ctx = canvas.Call("getContext", "2d")

	// Trigger initial resize to fit the viewport container
	resizeCanvas()

	// Play BIOS success beep sound
	js.Global().Call("playBeep", 880, 0.15, "sine")

	// Trigger default Neofetch readout using commands sub-package
	neofetchResult := commands.Execute(context.Background(), "neofetch", globalSession)
	outputHistory = neofetchResult.Output

	// Draw first frame
	redraw()

	// Schedule Cursor blinking loop in background goroutine
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		for range ticker.C {
			cursorActive = !cursorActive
			redraw()
		}
	}()

	// Schedule Matrix Rain animation loop
	go func() {
		ticker := time.NewTicker(50 * time.Millisecond)
		for range ticker.C {
			if globalSession.MatrixMode {
				redraw()
			}
		}
	}()

	// Register Keystroke Capture Listener
	doc.Call("addEventListener", "keydown", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		key := e.Get("key").String()
		ctrlKey := e.Get("ctrlKey").Bool()
		metaKey := e.Get("metaKey").Bool()
		shiftKey := e.Get("shiftKey").Bool()

		// Intercept terminal shortcuts to prevent browser default behaviors
		isCtrlShiftC := ctrlKey && shiftKey && (key == "c" || key == "C")
		isCtrlShiftV := ctrlKey && shiftKey && (key == "v" || key == "V")
		isCtrlC := ctrlKey && !shiftKey && (key == "c" || key == "C")
		isCtrlW := ctrlKey && !shiftKey && (key == "w" || key == "W")
		isCtrlU := ctrlKey && !shiftKey && (key == "u" || key == "U")
		isCtrlL := ctrlKey && !shiftKey && (key == "l" || key == "L")
		isCtrlS := ctrlKey && !shiftKey && (key == "s" || key == "S")
		isCtrlX := ctrlKey && !shiftKey && (key == "x" || key == "X")

		if key == "Tab" || key == "Backspace" || key == "ArrowUp" || key == "ArrowDown" || key == "ArrowLeft" || key == "ArrowRight" || isCtrlShiftC || isCtrlShiftV || isCtrlC || isCtrlW || isCtrlU || isCtrlL || isCtrlS || isCtrlX {
			e.Call("preventDefault")
		}

		handleKeyPress(key, ctrlKey, metaKey, shiftKey)
		return nil
	}))

	// Register Window Resize Listener
	js.Global().Get("window").Call("addEventListener", "resize", js.FuncOf(func(this js.Value, args []js.Value) any {
		resizeCanvas()
		redraw()
		return nil
	}))

	// Register Mouse Wheel Scroll Listener on Canvas
	canvas.Call("addEventListener", "wheel", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		e.Call("preventDefault")
		deltaY := e.Get("deltaY").Float()
		if deltaY < 0 {
			scrollOffset++
		} else if deltaY > 0 {
			scrollOffset--
		}
		redraw()
		return nil
	}))

	// Register Keyboard Copy (Ctrl+C / Cmd+C) Event Listener on Document
	doc.Call("addEventListener", "copy", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		e.Call("preventDefault")

		// Concatenate all lines of history into a formatted plain-text transcript
		var textBuilder strings.Builder
		for _, line := range outputHistory {
			var lineText strings.Builder
			for _, seg := range line.Segments {
				lineText.WriteString(seg.Text)
			}
			textBuilder.WriteString(lineText.String() + "\n")
		}

		clipboardData := e.Get("clipboardData")
		if clipboardData.Type() != js.TypeUndefined && clipboardData.Type() != js.TypeNull {
			clipboardData.Call("setData", "text/plain", textBuilder.String())
		}
		return nil
	}))

	// Register Keyboard Paste (Ctrl+V / Cmd+V) Event Listener on Document
	doc.Call("addEventListener", "paste", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		clipboardData := e.Get("clipboardData")
		if clipboardData.Type() != js.TypeUndefined && clipboardData.Type() != js.TypeNull {
			text := clipboardData.Call("getData", "text").String()
			if text != "" {
				// Insert text at cursorPosition inline
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

	// Register Mouse Click bound checks for Interactive Links
	canvas.Call("addEventListener", "click", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		rect := canvas.Call("getBoundingClientRect")
		mouseX := e.Get("clientX").Float() - rect.Get("left").Float()
		mouseY := e.Get("clientY").Float() - rect.Get("top").Float()

		// Traverse coordinates bounds of currently active clickable segments
		for _, link := range clickableLinks {
			if mouseX >= link.MinX && mouseX <= link.MaxX && mouseY >= link.MinY && mouseY <= link.MaxY {
				js.Global().Get("window").Call("open", link.URL, "_blank")
				js.Global().Call("playBeep", 600, 0.08, "sine")
				break
			}
		}
		return nil
	}))

	// Register Mouse Move Listener for Pointer Cursor on Hover
	canvas.Call("addEventListener", "mousemove", js.FuncOf(func(this js.Value, args []js.Value) any {
		e := args[0]
		rect := canvas.Call("getBoundingClientRect")
		mouseX := e.Get("clientX").Float() - rect.Get("left").Float()
		mouseY := e.Get("clientY").Float() - rect.Get("top").Float()

		found := false
		newHoveredURL := ""
		for _, link := range clickableLinks {
			if mouseX >= link.MinX && mouseX <= link.MaxX && mouseY >= link.MinY && mouseY <= link.MaxY {
				found = true
				newHoveredURL = link.URL
				break
			}
		}

		if globalSession.HoveredLinkURL != newHoveredURL {
			globalSession.HoveredLinkURL = newHoveredURL
			redraw()
		}

		if found {
			canvas.Get("style").Set("cursor", "pointer")
		} else {
			canvas.Get("style").Set("cursor", "default")
		}
		return nil
	}))
}

func resizeCanvas() {
	if canvas.Type() == js.TypeUndefined || canvas.Type() == js.TypeNull {
		return
	}
	if ctx.Type() == js.TypeUndefined || ctx.Type() == js.TypeNull {
		return
	}
	container := js.Global().Get("document").Call("getElementById", "crt-container")
	if container.Type() == js.TypeNull || container.Type() == js.TypeUndefined {
		return
	}

	rect := container.Call("getBoundingClientRect")
	width := rect.Get("width").Float()
	height := rect.Get("height").Float()

	// 1. Calculate dynamic layout scale factor based on container width
	// Baseline desktop resolution is 1000px wide
	sf := width / 1000.0
	if sf > 1.25 {
		sf = 1.25
	} else if sf < 0.85 {
		sf = 0.85
	}
	scaleFactor = sf

	// 2. Adjust font size dynamically to prevent overlapping and overflow on smaller screens
	fontSize := 15.0 * scaleFactor
	fontSetting = fmt.Sprintf("%dpx 'Share Tech Mono', monospace", int(fontSize))

	// Capture Device Pixel Ratio for High-DPI sharp rendering
	dprVal := js.Global().Get("window").Get("devicePixelRatio")
	dpr := 1.0
	if dprVal.Type() != js.TypeUndefined && dprVal.Type() != js.TypeNull {
		dpr = dprVal.Float()
		if dpr <= 0 {
			dpr = 1.0
		}
	}

	// Set actual physical drawing buffer size scaled by DPR
	pixelWidth := float64(int(width * dpr))
	pixelHeight := float64(int(height * dpr))

	canvas.Set("width", pixelWidth)
	canvas.Set("height", pixelHeight)

	// Since setting width/height resets the context state, apply scaling transformation
	ctx.Call("scale", dpr, dpr)

	// Preserve logical dimensions for drawing calculations in Go view.go
	canvasWidth = width
	canvasHeight = height
}
