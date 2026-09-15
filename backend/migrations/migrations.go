// Package migrations embeds the versioned SQL migrations (goose format).
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
