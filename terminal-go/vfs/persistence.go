package vfs

import (
	"encoding/json"
	"syscall/js"

	"liskovec.dev/terminal/types"
)

const storageKey = "liskovec_vfs_storage"

// SaveVFS serializes the root node and saves it to localStorage
func SaveVFS(root *types.VNode) {
	data, err := json.Marshal(root)
	if err != nil {
		return
	}

	js.Global().Get("localStorage").Call("setItem", storageKey, string(data))
}

// LoadVFS attempts to load the VFS from localStorage and re-link parent pointers
func LoadVFS() (*types.VNode, bool) {
	storage := js.Global().Get("localStorage").Call("getItem", storageKey)
	if storage.Type() == js.TypeNull {
		return nil, false
	}

	var root types.VNode
	err := json.Unmarshal([]byte(storage.String()), &root)
	if err != nil {
		return nil, false
	}

	// Re-link parent pointers recursively
	relinkParents(&root, nil)

	return &root, true
}

func relinkParents(node *types.VNode, parent *types.VNode) {
	node.Parent = parent
	for _, child := range node.Children {
		relinkParents(child, node)
	}
}

// ClearVFS removes the persisted filesystem from localStorage
func ClearVFS() {
	js.Global().Get("localStorage").Call("removeItem", storageKey)
}
