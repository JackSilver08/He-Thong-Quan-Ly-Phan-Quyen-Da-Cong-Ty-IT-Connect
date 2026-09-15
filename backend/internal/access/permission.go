package access

import "fmt"

const (
	None  = "NONE"
	Read  = "READ"
	Write = "WRITE"
)

const (
	Direct    = "DIRECT"
	Role      = "ROLE"
	Inherited = "INHERITED"
)

type Grant struct {
	Level  string
	Source string
	Depth  int
}

// ValidateLevel returns true only for the three supported access levels.
func ValidateLevel(level string) bool {
	switch level {
	case None, Read, Write:
		return true
	default:
		return false
	}
}

// ResolveEffectivePermission chooses the closest applicable grant.
// Within one resource depth, DIRECT outranks ROLE, which outranks INHERITED.
// An explicit NONE is an intentional deny and therefore stops evaluation.
func ResolveEffectivePermission(active bool, grants []Grant) (Grant, error) {
	if !active {
		return Grant{Level: None}, nil
	}
	best := Grant{Level: None, Depth: int(^uint(0) >> 1)}
	found := false
	for _, grant := range grants {
		if !ValidateLevel(grant.Level) {
			return Grant{}, fmt.Errorf("invalid permission level %q", grant.Level)
		}
		if grant.Depth < 0 {
			return Grant{}, fmt.Errorf("permission depth cannot be negative")
		}
		if !found || grant.Depth < best.Depth || (grant.Depth == best.Depth && sourceRank(grant.Source) > sourceRank(best.Source)) {
			best = grant
			found = true
		}
	}
	if !found {
		return Grant{Level: None}, nil
	}
	return best, nil
}

func sourceRank(source string) int {
	switch source {
	case Direct:
		return 3
	case Role:
		return 2
	case Inherited:
		return 1
	default:
		return 0
	}
}
