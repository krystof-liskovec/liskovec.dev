package renderer

import (
	"strconv"
	"strings"
	"syscall/js"
)

// DrawRect renders a solid filled rectangle
func DrawRect(ctx js.Value, x, y, w, h float64, fillStyle string) {
	ctx.Set("fillStyle", fillStyle)
	ctx.Call("fillRect", x, y, w, h)
}

// DrawStrokeRect renders an outlined rectangle
func DrawStrokeRect(ctx js.Value, x, y, w, h float64, strokeStyle string, lineWidth float64) {
	ctx.Set("strokeStyle", strokeStyle)
	ctx.Set("lineWidth", lineWidth)
	ctx.Call("strokeRect", x, y, w, h)
}

// DrawCircle renders a solid filled circle
func DrawCircle(ctx js.Value, x, y, r float64, fillStyle string) {
	ctx.Call("beginPath")
	ctx.Call("arc", x, y, r, 0, 2*3.14159265, true)
	ctx.Set("fillStyle", fillStyle)
	ctx.Call("fill")
}

// DrawText renders single-line styled text on the canvas
func DrawText(ctx js.Value, text string, x, y float64, font string, fillStyle string, bold bool, glowColor string, glowIntensity string) {
	fontString := font
	if bold {
		fontString = "bold " + font
	}
	ctx.Set("font", fontString)

	// Apply text shadow if glow is enabled
	if glowColor != "" && glowIntensity != "" {
		ctx.Set("shadowColor", glowColor)
		// Extract blur radius from glowIntensity (e.g. "0 0 8px" -> 8)
		blur := 3.0
		if strings.HasSuffix(glowIntensity, "px") {
			parts := strings.Split(glowIntensity, " ")
			if len(parts) > 0 {
				last := parts[len(parts)-1]
				valStr := strings.TrimSuffix(last, "px")
				if val, err := strconv.ParseFloat(valStr, 64); err == nil {
					blur = val * 0.5
				}
			}
		}
		ctx.Set("shadowBlur", blur)
	} else {
		ctx.Set("shadowBlur", 0)
	}

	ctx.Set("fillStyle", fillStyle)
	ctx.Call("fillText", text, x, y)
}

// MeasureText utilizes standard canvas layout engine to calculate exact pixel width
func MeasureText(ctx js.Value, text string, font string, bold bool) float64 {
	fontString := font
	if bold {
		fontString = "bold " + font
	}
	ctx.Set("font", fontString)
	metrics := ctx.Call("measureText", text)
	return metrics.Get("width").Float()
}
