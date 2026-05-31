package main

import (
	"fmt"
	"math/rand"
	"strings"
	"syscall/js"
	
	"liskovec.dev/terminal/renderer"
	"liskovec.dev/terminal/types"
)

// redraw composits the entire visual state of the terminal onto the HTML5 Canvas
func redraw() {
	if ctx.Type() == js.TypeUndefined {
		return
	}

	theme := themesList[globalSession.ActiveTheme]

	if globalSession.ActiveProgram != nil {
		globalSession.ActiveProgram.Render(ctx, canvasWidth, canvasHeight, scaleFactor, fontSetting, theme)
		return
	}

	// 1. Clear Canvas Background
	renderer.DrawRect(ctx, 0, 0, canvasWidth, canvasHeight, theme.BgColor)

	// Special Matrix Rain Layer
	if globalSession.MatrixMode {
		drawMatrixRain()
	}

	// 2. Draw outer bounding window border stroke outline
	renderer.DrawStrokeRect(ctx, 0, 0, canvasWidth, canvasHeight, theme.WindowBorder, 1)

	// 3. Draw Title Bar Background Header
	titleBarHeight := 35.0 * scaleFactor
	renderer.DrawRect(ctx, 0, 0, canvasWidth, titleBarHeight, theme.TitleBgColor)
	renderer.DrawRect(ctx, 0, titleBarHeight-1, canvasWidth, 1, theme.WindowBorder)

	// 4. Draw Title text
	titleText := "guest@liskovec.dev: " + globalSession.CurrentNode.Path()
	titleFont := fmt.Sprintf("%dpx 'Share Tech Mono', monospace", int(13.0*scaleFactor))
	renderer.DrawText(ctx, titleText, 20*scaleFactor, 22*scaleFactor, titleFont, theme.TitleTextColor, false, "", "")

	// 6. Draw Right Status Indicator
	statusTextX := canvasWidth - (155 * scaleFactor)
	statusFont := fmt.Sprintf("%dpx 'Share Tech Mono', monospace", int(11.0*scaleFactor))
	renderer.DrawCircle(ctx, statusTextX, 17*scaleFactor, 4*scaleFactor, theme.TextSuccess)
	renderer.DrawText(ctx, "Go-WASM Graphical OS", statusTextX+(12*scaleFactor), 21*scaleFactor, statusFont, theme.TextSuccess, false, "", "")

	// 7. Render lines of history with scrollback buffer
	lineHeight := 22.0 * scaleFactor
	paddingTop := 55.0 * scaleFactor
	paddingLeft := 20.0 * scaleFactor

	availableHeight := canvasHeight - paddingTop - (40.0 * scaleFactor)
	maxLines := int(availableHeight / lineHeight)

	// Wrap only the last few lines of history that could possibly be visible
	// (maxLines * 4 is a very safe limit that covers both the visible viewport and ample scrollback)
	linesToWrap := outputHistory
	safetyBuffer := maxLines * 4
	if len(outputHistory) > safetyBuffer {
		linesToWrap = outputHistory[len(outputHistory)-safetyBuffer:]
	}

	// Wrap dynamically based on active logical width
	maxWidth := canvasWidth - (40.0 * scaleFactor)
	var wrappedHistory []types.Line
	for _, line := range linesToWrap {
		wrappedHistory = append(wrappedHistory, wrapLine(line, maxWidth, ctx)...)
	}

	// 8. Construct prompt prefix and row, wrap it dynamically, and append to totalLines
	var wrappedPromptLines []types.Line
	if !globalSession.IsRunning {
		promptPrefix := "guest@liskovec.dev:" + globalSession.CurrentNode.Path() + "$ "
		promptLine := types.Line{
			Segments: []types.Segment{
				{Text: promptPrefix, Color: "prompt-prefix", Bold: true},
				{Text: cmdBuffer, Color: "text-body"},
			},
		}
		wrappedPromptLines = wrapLine(promptLine, maxWidth, ctx)
	}

	// Combine all lines
	totalLines := append(wrappedHistory, wrappedPromptLines...)

	// Calculate scroll bounds
	maxScrollOffset := len(totalLines) - maxLines
	if maxScrollOffset < 0 {
		maxScrollOffset = 0
	}

	// Clamp scrollOffset dynamically during redraw to avoid out-of-bounds on canvas resize
	if scrollOffset > maxScrollOffset {
		scrollOffset = maxScrollOffset
	}
	if scrollOffset < 0 {
		scrollOffset = 0
	}

	// Slice the visible lines based on scrollOffset
	var visibleLines []types.Line
	startIndex := len(totalLines) - maxLines - scrollOffset
	endIndex := len(totalLines) - scrollOffset
	if startIndex < 0 {
		startIndex = 0
	}
	if endIndex > len(totalLines) {
		endIndex = len(totalLines)
	}
	visibleLines = totalLines[startIndex:endIndex]

	// Reset Clickable Coordinates lists
	clickableLinks = []types.ClickableLink{}

	// Global variables for cursor tracing inside the prompt line
	cursorDrawn := false
	charAccumulator := 0

	y := paddingTop
	for index, line := range visibleLines {
		x := paddingLeft
		isLastPromptLine := (startIndex + index) == len(totalLines)-1
		isPromptLine := (startIndex + index) >= len(wrappedHistory)

		for _, seg := range line.Segments {
			segColor := theme.TextBody
			switch seg.Color {
			case "prompt-prefix":
				segColor = theme.TextPrimary
			case "text-primary":
				segColor = theme.TextPrimary
			case "text-accent":
				segColor = theme.TextAccent
			case "text-highlight":
				segColor = theme.TextHighlight
			case "text-muted":
				segColor = theme.TextMuted
			case "text-error":
				segColor = theme.TextError
			case "text-success":
				segColor = theme.TextSuccess
			case "link-text":
				segColor = theme.TextAccent
			}

			bold := seg.Bold
			// Draw styled character segment
			renderer.DrawText(ctx, seg.Text, x, y, fontSetting, segColor, bold, theme.GlowColor, theme.GlowIntensity)

			width := renderer.MeasureText(ctx, seg.Text, fontSetting, bold)

			// Highlight links on hover
			if seg.Link != "" && globalSession.HoveredLinkURL == seg.Link {
				// Re-draw text with highlight color if hovered
				renderer.DrawText(ctx, seg.Text, x, y, fontSetting, theme.TextHighlight, bold, theme.GlowColor, theme.GlowIntensity)
				// Draw underline
				renderer.DrawRect(ctx, x, y+2, width, 1, theme.TextHighlight)
			}

			// Record coordinate boundaries for hyperlinks
			if seg.Link != "" {
				clickableLinks = append(clickableLinks, types.ClickableLink{
					MinX: x,
					MaxX: x + width,
					MinY: y - (16.0 * scaleFactor),
					MaxY: y + (4.0 * scaleFactor),
					URL:  seg.Link,
				})
			}

			// Render inline cursor if it falls inside this cmdBuffer segment
			if isPromptLine && cursorActive && !cursorDrawn && seg.Color != "prompt-prefix" {
				textLen := len(seg.Text)
				if cursorPosition >= charAccumulator && cursorPosition <= charAccumulator+textLen {
					offset := cursorPosition - charAccumulator
					cursorSubstr := seg.Text[:offset]
					cursorX := x + renderer.MeasureText(ctx, cursorSubstr, fontSetting, seg.Bold)
					renderer.DrawRect(ctx, cursorX+2, y-(14.0*scaleFactor), 9*scaleFactor, 16*scaleFactor, theme.TextBody)
					cursorDrawn = true
				}
				charAccumulator += textLen
			}

			x += width
		}

		// Draw blinking cursor block at the end of the text on the active prompt line if it hasn't been drawn yet
		if isLastPromptLine && cursorActive && !cursorDrawn {
			renderer.DrawRect(ctx, x+2, y-(14.0*scaleFactor), 9*scaleFactor, 16*scaleFactor, theme.TextBody)
		}

		y += lineHeight
	}

	// 9. Draw Vertical Scrollbar if content is scrollable
	if maxScrollOffset > 0 {
		scrollbarWidth := 6.0 * scaleFactor
		scrollbarRightPadding := 4.0 * scaleFactor
		scrollbarX := canvasWidth - scrollbarWidth - scrollbarRightPadding

		// Draw subtle scroll track background
		renderer.DrawRect(ctx, scrollbarX, paddingTop, scrollbarWidth, availableHeight, "rgba(0, 0, 0, 0.08)")

		// Draw scroll thumb
		scrollbarHeight := availableHeight * float64(maxLines) / float64(len(totalLines))
		if scrollbarHeight < 20.0*scaleFactor {
			scrollbarHeight = 20.0 * scaleFactor // Guarantee a minimum floor height
		}

		// Y position from top based on scroll offset ratio (inversion handles natural scrolling direction)
		scrollRatio := 0.0
		if maxScrollOffset > 0 {
			scrollRatio = 1.0 - float64(scrollOffset)/float64(maxScrollOffset)
		}
		scrollbarY := paddingTop + (availableHeight-scrollbarHeight)*scrollRatio

		// Render track thumb
		renderer.DrawRect(ctx, scrollbarX, scrollbarY, scrollbarWidth, scrollbarHeight, theme.TextMuted)
	}
}

// drawMatrixRain renders the digital waterfall background effect
func drawMatrixRain() {
	charSize := 15.0 * scaleFactor
	columns := int(canvasWidth / charSize)
	rows := int(canvasHeight / charSize)

	if len(matrixDrops) != columns {
		matrixDrops = make([]int, columns)
		for i := range matrixDrops {
			// Randomly distribute drops across the height
			matrixDrops[i] = rand.Intn(rows + 50) - 50
		}
	}

	matrixChars := "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%#@!&"
	
	for i := 0; i < columns; i++ {
		headY := matrixDrops[i]
		x := float64(i) * charSize

		// Draw a trail of 12 characters
		trailLen := 15
		for j := 0; j < trailLen; j++ {
			yIdx := headY - j
			if yIdx < 0 {
				continue
			}
			y := float64(yIdx) * charSize
			if y > canvasHeight + charSize {
				continue
			}

			// Random character for each segment of the trail to make it feel alive
			char := string(matrixChars[rand.Intn(len(matrixChars))])

			// Fade color based on distance from head
			opacity := 1.0 - (float64(j) / float64(trailLen))
			color := fmt.Sprintf("rgba(0, 255, 65, %f)", opacity)
			
			if j == 0 {
				// Head character is bright white-green and has a strong glow
				renderer.DrawText(ctx, char, x, y, fontSetting, "#e0ffe0", true, "#00ff41", "0 0 12px")
			} else if j < 4 {
				// Top of trail is solid green
				renderer.DrawText(ctx, char, x, y, fontSetting, "#00ff41", false, "#00ff41", "0 0 4px")
			} else {
				// Rest of trail fades out
				renderer.DrawText(ctx, char, x, y, fontSetting, color, false, "", "")
			}
		}

		// Increment Y position
		matrixDrops[i]++

		// Reset drop if it goes off screen with a random chance to stagger
		if float64(matrixDrops[i]-trailLen)*charSize > canvasHeight {
			if rand.Intn(100) < 5 {
				matrixDrops[i] = 0
			}
		}
	}
}

// wrapLine processes a single Line containing styled segments and splits it into multiple wrapped lines
func wrapLine(line types.Line, maxWidth float64, ctx js.Value) []types.Line {
	// If the line is empty, return as-is
	if len(line.Segments) == 0 {
		return []types.Line{line}
	}
	isEmpty := true
	for _, seg := range line.Segments {
		if seg.Text != "" {
			isEmpty = false
			break
		}
	}
	if isEmpty {
		return []types.Line{line}
	}

	var wrappedLines []types.Line
	var currentSegments []types.Segment
	currentWidth := 0.0

	pushCurrent := func() {
		if len(currentSegments) > 0 {
			wrappedLines = append(wrappedLines, types.Line{Segments: currentSegments})
			currentSegments = nil
			currentWidth = 0.0
		}
	}

	for _, seg := range line.Segments {
		words := splitTextIntoWordsAndSpaces(seg.Text)

		for _, word := range words {
			wordWidth := renderer.MeasureText(ctx, word, fontSetting, seg.Bold)

			if currentWidth+wordWidth > maxWidth {
				// Push current accumulated line
				pushCurrent()

				// Align nicely at margin: skip space at start of wrapped lines
				trimmedWord := word
				if word == " " {
					continue
				}
				if strings.HasPrefix(trimmedWord, " ") {
					trimmedWord = strings.TrimPrefix(trimmedWord, " ")
					wordWidth = renderer.MeasureText(ctx, trimmedWord, fontSetting, seg.Bold)
				}

				currentSegments = append(currentSegments, types.Segment{
					Text:  trimmedWord,
					Color: seg.Color,
					Link:  seg.Link,
					Bold:  seg.Bold,
				})
				currentWidth = wordWidth
			} else {
				currentSegments = append(currentSegments, types.Segment{
					Text:  word,
					Color: seg.Color,
					Link:  seg.Link,
					Bold:  seg.Bold,
				})
				currentWidth += wordWidth
			}
		}
	}
	pushCurrent()

	// Fallback to empty line if all segments were empty spaces
	if len(wrappedLines) == 0 {
		return []types.Line{{Segments: []types.Segment{}}}
	}

	return wrappedLines
}

// splitTextIntoWordsAndSpaces breaks down character streams keeping word groupings and whitespaces intact
func splitTextIntoWordsAndSpaces(text string) []string {
	var parts []string
	var current strings.Builder

	for i := 0; i < len(text); i++ {
		char := text[i]
		if char == ' ' {
			if current.Len() > 0 {
				parts = append(parts, current.String())
				current.Reset()
			}
			parts = append(parts, " ")
		} else {
			current.WriteByte(char)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}
