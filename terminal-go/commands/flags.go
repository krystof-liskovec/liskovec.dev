package commands

import "strings"

// Options represents parsed command-line flags and positional arguments
type Options struct {
	ShortFlags map[rune]bool
	LongFlags  map[string]bool
	Args       []string
}

// ParseOptions extracts flags and positional arguments from a raw string slice
func ParseOptions(args []string) Options {
	opts := Options{
		ShortFlags: make(map[rune]bool),
		LongFlags:  make(map[string]bool),
		Args:       []string{},
	}

	for _, arg := range args {
		if strings.HasPrefix(arg, "--") && len(arg) > 2 {
			opts.LongFlags[arg[2:]] = true
		} else if strings.HasPrefix(arg, "-") && len(arg) > 1 {
			// Handle combined flags like -la
			for _, r := range arg[1:] {
				opts.ShortFlags[r] = true
			}
		} else {
			opts.Args = append(opts.Args, arg)
		}
	}

	return opts
}

// Has checks if a specific short flag was provided
func (o Options) Has(flag rune) bool {
	return o.ShortFlags[flag]
}

// HasLong checks if a specific long flag was provided
func (o Options) HasLong(flag string) bool {
	return o.LongFlags[flag]
}
