package vfs

import (
	"strings"
	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

// NewDir creates a new directory node
func NewDir(name string, parent *types.VNode) *types.VNode {
	return &types.VNode{
		Name:     name,
		IsDir:    true,
		Parent:   parent,
		Children: make(map[string]*types.VNode),
	}
}

// NewFile creates a new file node
func NewFile(name string, content string, parent *types.VNode) *types.VNode {
	return &types.VNode{
		Name:    name,
		IsDir:   false,
		Content: content,
		Parent:  parent,
	}
}

// WriteFile writes content to a file, creating it if it doesn't exist. Supports appending.
func WriteFile(current *types.VNode, root *types.VNode, pathStr string, content string, append bool) bool {
	node, _, ok := ResolvePath(current, root, pathStr)
	if ok && !node.IsDir {
		if append {
			if node.Content != "" {
				node.Content += "\n" + content
			} else {
				node.Content = content
			}
		} else {
			node.Content = content
		}
		return true
	}

	// If file doesn't exist, resolve parent directory and create it
	parts := strings.Split(pathStr, "/")
	fileName := parts[len(parts)-1]
	dirPath := strings.Join(parts[:len(parts)-1], "/")
	
	parentDir := current
	if strings.HasPrefix(pathStr, "/") {
		parentDir = root
	}

	if dirPath != "" && dirPath != "/" {
		resolvedDir, _, ok := ResolvePath(current, root, dirPath)
		if !ok || !resolvedDir.IsDir {
			return false
		}
		parentDir = resolvedDir
	}

	parentDir.Children[fileName] = NewFile(fileName, content, parentDir)
	return true
}

// ResolvePath traverses the filesystem and returns the node at the specified path
func ResolvePath(current *types.VNode, root *types.VNode, pathStr string) (*types.VNode, string, bool) {
	if pathStr == "" {
		return current, "", true
	}

	var parts []string
	var start *types.VNode

	if strings.HasPrefix(pathStr, "/") {
		start = root
		parts = strings.Split(pathStr, "/")
	} else {
		start = current
		parts = strings.Split(pathStr, "/")
	}

	curr := start
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			if curr.Parent != nil {
				curr = curr.Parent
			}
			continue
		}

		if !curr.IsDir {
			return nil, part, false // Cannot traverse inside a file
		}

		child, ok := curr.Children[part]
		if !ok {
			return nil, part, false // Not found
		}
		curr = child
	}

	return curr, "", true
}

// InitVFS builds the virtual directory tree and populates it with portfolio content
func InitVFS() *types.VNode {
	// Attempt to load from storage first
	if root, ok := LoadVFS(); ok {
		return root
	}

	root := NewDir("/", nil)
	t := i18n.T()

	// Root-level files
	root.Children["welcome.txt"] = NewFile("welcome.txt", t.VfsWelcomeContent, root)
	root.Children["about.txt"] = NewFile("about.txt", t.VfsAboutContent, root)
	root.Children["skills.txt"] = NewFile("skills.txt", t.VfsSkillsContent, root)
	root.Children["contact.txt"] = NewFile("contact.txt", t.VfsContactContent, root)

	// Projects Folder
	projects := NewDir("projects", root)
	root.Children["projects"] = projects

	projects.Children["liskovec_dev.txt"] = NewFile("liskovec_dev.txt", t.VfsLiskovecDevContent, projects)
	projects.Children["gopher_shell.txt"] = NewFile("gopher_shell.txt", t.VfsGopherShellContent, projects)

	// Secrets Folder
	secrets := NewDir("secrets", root)
	root.Children["secrets"] = secrets

	secrets.Children["easter_egg.txt"] = NewFile("easter_egg.txt", t.VfsEasterEggContent, secrets)

	return root
}
