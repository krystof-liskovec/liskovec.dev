package types

import (
	"context"
	"syscall/js"
	"time"
)

// InteractiveProgram defines the interface for full-screen applications that capture input
type InteractiveProgram interface {
	HandleKeyPress(key string, ctrlKey, metaKey, shiftKey bool) bool // Returns true if redraw needed
	Render(ctx js.Value, width, height float64, scaleFactor float64, fontSetting string, theme interface{})
}

// Segment represents a portion of a line with custom styles or interactive links
type Segment struct {
	Text  string `json:"text"`
	Color string `json:"color,omitempty"`
	Link  string `json:"link,omitempty"`
	Bold  bool   `json:"bold,omitempty"`
}

// Line represents a single terminal line containing styled segments
type Line struct {
	Segments []Segment `json:"segments"`
}

// ExecResult encapsulates the response of running a CLI command
type ExecResult struct {
	Output             []Line `json:"output"`
	Clear              bool   `json:"clear"`
	Theme              string `json:"theme,omitempty"`
	OpenURL            string `json:"openUrl,omitempty"`
	CurrentDir         string `json:"currentDir"`
	IsBlocking         bool   `json:"-"`
	UseAlternateBuffer bool   `json:"-"`
}

// VNode represents a directory or file node in our virtual filesystem
type VNode struct {
	Name     string            `json:"name"`
	IsDir    bool              `json:"isDir"`
	Content  string            `json:"content,omitempty"`
	Parent   *VNode            `json:"-"`
	Children map[string]*VNode `json:"children,omitempty"`
}

// Session represents the active user terminal session state
type Session struct {
	CurrentNode    *VNode
	RootNode       *VNode
	History        []string
	StartTime      time.Time
	ActiveTheme    string
	HoveredLinkURL string
	MatrixMode     bool
	IsRunning      bool
	CancelCmd      context.CancelFunc
	SavedHistory   []Line
	ActiveProgram  InteractiveProgram
}

// ClickableLink tracks the coordinates of interactive links on canvas
type ClickableLink struct {
	MinX float64
	MaxX float64
	MinY float64
	MaxY float64
	URL  string
}



// Path returns the absolute path representation of this node
func (n *VNode) Path() string {
	if n == nil {
		return ""
	}
	if n.Parent == nil {
		return "/"
	}
	parentPath := n.Parent.Path()
	if parentPath == "/" {
		return "/" + n.Name
	}
	return parentPath + "/" + n.Name
}
