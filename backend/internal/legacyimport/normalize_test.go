package legacyimport

import (
	"testing"
	"time"
)

func TestSplitNameDevice(t *testing.T) {
	cases := []struct {
		name   string
		want   string
		device string
	}{
		{"Lưu Văn Du (laptop)", "Lưu Văn Du", DeviceLaptop},
		{"Lưu Văn Du (laptop cá nhân)", "Lưu Văn Du", DevicePersonalLaptop},
		{"Trần Văn A", "Trần Văn A", ""},
	}
	for _, tc := range cases {
		name, device := splitNameDevice(tc.name)
		if name != tc.want || device != tc.device {
			t.Errorf("splitNameDevice(%q) = (%q, %q), want (%q, %q)", tc.name, name, device, tc.want, tc.device)
		}
	}
}

func TestAccountKind(t *testing.T) {
	cases := map[string]string{
		"Máy CT Trạm Bắc":                  KindDevice,
		"Dùng chung Hành Chính Nhân Sự":    KindShared,
		"Nguyễn Văn A":                     KindPersonal,
	}
	for input, want := range cases {
		if got := accountKind(input); got != want {
			t.Errorf("accountKind(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseLevel(t *testing.T) {
	cases := map[string]string{"X": LevelNone, "R": LevelRead, "W": LevelWrite, "r": LevelRead, " w ": LevelWrite}
	for input, want := range cases {
		got, state := parseLevel(input)
		if got != want || state != cellValid {
			t.Errorf("parseLevel(%q) = (%q, %d), want (%q, %d)", input, got, state, want, cellValid)
		}
	}
	if got, state := parseLevel("Q"); got != "" || state != cellInvalid {
		t.Errorf("parseLevel(Q) = (%q, %d), want invalid", got, state)
	}
	if got, state := parseLevel("   "); got != "" || state != cellEmpty {
		t.Errorf("parseLevel(empty) = (%q, %d), want empty", got, state)
	}
}

func TestParseNote(t *testing.T) {
	joined, rest, err := parseNote("Ngày vào làm: 15/09/2026; Nhân viên mới")
	if err != nil {
		t.Fatalf("parseNote() error = %v", err)
	}
	if joined == nil || !joined.Equal(time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected joined date: %v", joined)
	}
	if rest != "Nhân viên mới" {
		t.Fatalf("unexpected remaining note: %q", rest)
	}
	if _, _, err := parseNote("Ngày vào làm: 31/02/2026"); err == nil {
		t.Fatal("parseNote() accepted an impossible date")
	}
}

func TestSplitDepartment(t *testing.T) {
	base, unit := splitDepartment("Phòng IT (CT)")
	if base != "Phòng IT" || unit != unitSite {
		t.Fatalf("splitDepartment(CT) = (%q, %q)", base, unit)
	}
	base, unit = splitDepartment("Phòng Kế Toán (VP)")
	if base != "Phòng Kế Toán" || unit != "" {
		t.Fatalf("splitDepartment(VP) = (%q, %q)", base, unit)
	}
}

func TestParseFolderHeader(t *testing.T) {
	got := parseFolderHeader("4. DU THAU -> P. DAU THAU")
	if got.Name != "4. DAU THAU" || !got.Renamed {
		t.Fatalf("unexpected folder rename: %#v", got)
	}

	got = parseFolderHeader("THIET KE\n(PHONG THIET KE)")
	if got.Name != "THIET KE" || got.Label == "" {
		t.Fatalf("unexpected multiline folder header: %#v", got)
	}
}

func TestParseShareHeader(t *testing.T) {
	share, parents := parseShareHeader("PUBLIC_SONACONS\n(5. QUAN LY DU AN\\6. THI CONG)")
	if share != "PUBLIC_SONACONS" {
		t.Fatalf("share = %q", share)
	}
	if len(parents) != 2 || parents[0] != "5. QUAN LY DU AN" || parents[1] != "6. THI CONG" {
		t.Fatalf("unexpected parents: %#v", parents)
	}
}
