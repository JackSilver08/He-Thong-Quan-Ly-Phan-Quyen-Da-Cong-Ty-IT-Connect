package access

import "testing"

func TestResolveInactiveUserAlwaysGetsNone(t *testing.T) {
	got, err := ResolveEffectivePermission(false, []Grant{{Level: Write, Source: Direct, Depth: 0}})
	if err != nil {
		t.Fatal(err)
	}
	if got.Level != None {
		t.Fatalf("inactive user level = %s, want NONE", got.Level)
	}
}

func TestResolveNoGrantDefaultsToNone(t *testing.T) {
	got, err := ResolveEffectivePermission(true, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got.Level != None {
		t.Fatalf("no grant level = %s, want NONE", got.Level)
	}
}

func TestResolveNearestResourceWins(t *testing.T) {
	got, err := ResolveEffectivePermission(true, []Grant{
		{Level: Write, Source: Direct, Depth: 2},
		{Level: Read, Source: Inherited, Depth: 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Level != Read || got.Depth != 1 {
		t.Fatalf("nearest grant = %#v, want READ depth 1", got)
	}
}

func TestResolveExplicitNoneBlocksParent(t *testing.T) {
	got, err := ResolveEffectivePermission(true, []Grant{
		{Level: None, Source: Direct, Depth: 0},
		{Level: Write, Source: Inherited, Depth: 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Level != None || got.Source != Direct {
		t.Fatalf("explicit deny = %#v, want direct NONE", got)
	}
}

func TestResolveDirectBeatsRoleAtSameDepth(t *testing.T) {
	got, err := ResolveEffectivePermission(true, []Grant{
		{Level: Read, Source: Role, Depth: 0},
		{Level: Write, Source: Direct, Depth: 0},
		{Level: None, Source: Inherited, Depth: 0},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Level != Write || got.Source != Direct {
		t.Fatalf("same-depth precedence = %#v, want direct WRITE", got)
	}
}

func TestResolveRejectsInvalidLevel(t *testing.T) {
	if _, err := ResolveEffectivePermission(true, []Grant{{Level: "FULL", Source: Direct, Depth: 0}}); err == nil {
		t.Fatal("invalid permission level was accepted")
	}
}

func TestResolveRejectsNegativeDepth(t *testing.T) {
	if _, err := ResolveEffectivePermission(true, []Grant{{Level: Read, Source: Direct, Depth: -1}}); err == nil {
		t.Fatal("negative permission depth was accepted")
	}
}
