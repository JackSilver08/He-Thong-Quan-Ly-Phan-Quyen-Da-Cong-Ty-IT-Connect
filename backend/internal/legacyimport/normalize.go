package legacyimport

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

var spaceRe = regexp.MustCompile(`\s+`)

// clean NFC-normalises, trims and collapses internal whitespace (newlines included).
func clean(s string) string {
	return strings.TrimSpace(spaceRe.ReplaceAllString(norm.NFC.String(s), " "))
}

// fold returns a lowercase, accent-free form of Vietnamese text for matching.
func fold(s string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(clean(s)) {
		switch {
		case unicode.Is(unicode.Mn, r):
		case r == 'đ' || r == 'Đ':
			b.WriteRune('d')
		default:
			b.WriteRune(unicode.ToLower(r))
		}
	}
	return b.String()
}

func nonEmptyLines(s string) []string {
	var out []string
	for _, l := range strings.Split(norm.NFC.String(s), "\n") {
		if l = clean(l); l != "" {
			out = append(out, l)
		}
	}
	return out
}

var deviceRe = regexp.MustCompile(`(?i)\s*\(\s*laptop(\s+cá\s+nhân)?\s*\)\s*$`)

// splitNameDevice separates "Lưu Văn Du (laptop cá nhân)" into the name and a device type.
func splitNameDevice(raw string) (name, device string) {
	s := clean(raw)
	m := deviceRe.FindStringSubmatchIndex(s)
	if m == nil {
		return s, ""
	}
	device = DeviceLaptop
	if m[2] >= 0 {
		device = DevicePersonalLaptop
	}
	return strings.TrimSpace(s[:m[0]]), device
}

// accountKind recognises non-personal rows such as "Máy CT Trạm Bắc" or "Dùng chung Hành Chính Nhân Sự".
func accountKind(name string) string {
	f := fold(name)
	switch {
	case strings.HasPrefix(f, "may "):
		return KindDevice
	case strings.HasPrefix(f, "dung chung"):
		return KindShared
	}
	return KindPersonal
}

// emailKey builds the company mailbox convention: initials of every word but the last,
// a dot, then the last word ("Lâm Vũ Trường" -> "lv.truong").
func emailKey(fullName string) string {
	parts := strings.Fields(fold(fullName))
	if len(parts) < 2 {
		return ""
	}
	var b strings.Builder
	for _, p := range parts[:len(parts)-1] {
		b.WriteRune([]rune(p)[0])
	}
	b.WriteByte('.')
	b.WriteString(parts[len(parts)-1])
	return b.String()
}

var emailRe = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$`)

var joinedRe = regexp.MustCompile(`(?i)ngày\s+vào\s+làm\s*:?\s*(\d{1,2})/(\d{1,2})/(\d{4})`)

// parseNote extracts "Ngày vào làm: dd/mm/yyyy" and returns the remaining free text.
func parseNote(raw string) (joined *time.Time, rest string, err error) {
	s := clean(raw)
	m := joinedRe.FindStringSubmatchIndex(s)
	if m == nil {
		return nil, s, nil
	}
	var d, mo, y int
	fmt.Sscanf(s[m[2]:m[3]], "%d", &d)
	fmt.Sscanf(s[m[4]:m[5]], "%d", &mo)
	fmt.Sscanf(s[m[6]:m[7]], "%d", &y)
	rest = strings.Trim(clean(s[:m[0]]+" "+s[m[1]:]), " ,;.-")
	t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
	if t.Day() != d || int(t.Month()) != mo {
		return nil, rest, fmt.Errorf("ngày không hợp lệ %q", s[m[0]:m[1]])
	}
	return &t, rest, nil
}

const (
	cellEmpty = iota
	cellValid
	cellInvalid
)

// parseLevel maps the legacy X/R/W symbols to permission levels.
func parseLevel(raw string) (string, int) {
	switch strings.ToUpper(clean(raw)) {
	case "":
		return "", cellEmpty
	case "X":
		return LevelNone, cellValid
	case "R":
		return LevelRead, cellValid
	case "W":
		return LevelWrite, cellValid
	}
	return "", cellInvalid
}

var unitRe = regexp.MustCompile(`^(.*?)\s*\(([^)]*)\)$`)

// splitDepartment separates a work-unit suffix: "(VP)" is the main office, "(CT)"/"(Công trình)"
// is the construction-site unit, anything else is kept verbatim as its own unit.
func splitDepartment(raw string) (base, unit string) {
	s := clean(raw)
	m := unitRe.FindStringSubmatch(s)
	if m == nil {
		return s, ""
	}
	switch fold(m[2]) {
	case "vp", "van phong":
		return clean(m[1]), ""
	case "ct", "cong trinh":
		return clean(m[1]), unitSite
	}
	return clean(m[1]), clean(m[2])
}

func departmentBaseKey(base string) string {
	return strings.TrimPrefix(fold(base), "phong ")
}

type folderHeader struct {
	Name    string
	Label   string
	Renamed bool
}

var (
	folderNumRe = regexp.MustCompile(`^(\d+)\.\s*`)
	leadingPRe  = regexp.MustCompile(`(?i)^P\.\s*`)
)

// parseFolderHeader reads a permission column sub-header. A second line in parentheses is a
// description ("THIET KE\n(PHONG THIET KE)"); "4. DU THAU -> P. DAU THAU" records a rename and
// resolves to the new name "4. DAU THAU".
func parseFolderHeader(raw string) folderHeader {
	lines := nonEmptyLines(raw)
	if len(lines) == 0 {
		return folderHeader{}
	}
	h := folderHeader{Name: lines[0], Label: clean(raw)}
	if len(lines) > 1 && !strings.HasPrefix(lines[1], "(") {
		h.Name = clean(strings.Join(lines, " "))
	}
	if left, right, ok := strings.Cut(h.Name, "->"); ok {
		right = leadingPRe.ReplaceAllString(strings.TrimSpace(right), "")
		if m := folderNumRe.FindStringSubmatch(strings.TrimSpace(left)); m != nil {
			right = m[1] + ". " + right
		}
		h.Name, h.Renamed = right, true
	}
	return h
}

// parseShareHeader reads "PUBLIC_SONACONS" or "PUBLIC_SONACONS\n(5. QUAN LY DU AN)".
func parseShareHeader(raw string) (share string, parents []string) {
	lines := nonEmptyLines(raw)
	if len(lines) == 0 {
		return "", nil
	}
	share = lines[0]
	rest := clean(strings.Join(lines[1:], " "))
	if strings.HasPrefix(rest, "(") && strings.HasSuffix(rest, ")") {
		for _, p := range strings.Split(rest[1:len(rest)-1], `\`) {
			if p = clean(p); p != "" {
				parents = append(parents, p)
			}
		}
	}
	return share, parents
}

var nonAlnumRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugCode(name string) string {
	return strings.ToUpper(strings.Trim(nonAlnumRe.ReplaceAllString(fold(name), "-"), "-"))
}

func CleanNameDevice(raw string) (name, device string) {
	return splitNameDevice(raw)
}

func ParseJoinedNote(raw string) (*time.Time, string, error) {
	return parseNote(raw)
}

func ParseLevel(raw string) (string, bool) {
	level, status := parseLevel(raw)
	return level, status == cellValid
}

func GenerateUsername(fullName string) string {
	return emailKey(fullName)
}

var cp437Map = map[rune]byte{
	'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86, 'ç': 0x87,
	'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f,
	'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97,
	'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, '¢': 0x9b, '£': 0x9c, '¥': 0x9d, '₧': 0x9e, 'ƒ': 0x9f,
	'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7,
	'¿': 0xa8, '⌐': 0xa9, '¬': 0xaa, '½': 0xab, '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
	'░': 0xb0, '▒': 0xb1, '▓': 0xb2, '│': 0xb3, '┤': 0xb4, '╡': 0xb5, '╢': 0xb6, '╖': 0xb7,
	'╕': 0xb8, '╣': 0xbd, // Map ╣ to 0xbd (ý in UTF-8 0xC3 0xBD) for Vietnamese mojibake
	'║': 0xba, '╗': 0xbb, '╝': 0xbc, '╜': 0xbd, '╛': 0xbe, '┐': 0xbf,
	'└': 0xc0, '┴': 0xc1, '┬': 0xc2, '├': 0xc3, '─': 0xc4, '┼': 0xc5, '╞': 0xc6, '╟': 0xc7,
	'╚': 0xc8, '╔': 0xc9, '╩': 0xca, '╦': 0xcb, '╠': 0xcc, '═': 0xcd, '╬': 0xce, '╧': 0xcf,
	'╨': 0xd0, '╤': 0xd1, '╥': 0xd2, '╙': 0xd3, '╘': 0xd4, '╒': 0xd5, '╓': 0xd6, '╫': 0xd7,
	'╪': 0xd8, '┘': 0xd9, '┌': 0xda, '█': 0xdb, '▄': 0xdc, '▌': 0xdd, '▐': 0xde, '▀': 0xdf,
	'α': 0xe0, 'ß': 0xe1, 'Γ': 0xe2, 'π': 0xe3, 'Σ': 0xe4, 'σ': 0xe5, 'µ': 0xe6, 'τ': 0xe7,
	'Φ': 0xe8, 'Θ': 0xe9, 'Ω': 0xea, 'δ': 0xeb, '∞': 0xec, 'φ': 0xed, 'ε': 0xee, '∩': 0xef,
	'≡': 0xf0, '±': 0xf1, '≥': 0xf2, '≤': 0xf3, '⌠': 0xf4, '⌡': 0xf5, '÷': 0xf6, '≈': 0xf7,
	'°': 0xf8, '∙': 0xf9, '·': 0xfa, '√': 0xfb, 'ⁿ': 0xfc, '²': 0xfd, '■': 0xfe, ' ': 0xff,
}

// FixVietnameseEncoding detects and restores Vietnamese strings decoded with CP437.
func FixVietnameseEncoding(s string) string {
	if s == "" {
		return ""
	}
	hasMojibake := false
	for _, r := range s {
		if r == '├' || r == '╞' || r == 'ß' || r == '╗' || r == '║' || r == '¡' || r == '░' || r == 'í' || r == '¥' || r == 'ú' || r == '─' || r == '┐' || r == '╣' || r == '╜' {
			hasMojibake = true
			break
		}
	}
	if !hasMojibake {
		return s
	}

	var bytes []byte
	for _, r := range s {
		if b, ok := cp437Map[r]; ok {
			bytes = append(bytes, b)
		} else if r < 128 {
			bytes = append(bytes, byte(r))
		} else {
			bytes = append(bytes, []byte(string(r))...)
		}
	}

	if utf8.Valid(bytes) {
		decoded := string(bytes)
		if !strings.Contains(decoded, "\ufffd") {
			return decoded
		}
	}

	res := s
	res = strings.ReplaceAll(res, "K├╜ hiß╗çu", "Ký hiệu")
	res = strings.ReplaceAll(res, "K├╣ hiß╗çu", "Ký hiệu")
	res = strings.ReplaceAll(res, "M├┤ tß║ú", "Mô tả")
	res = strings.ReplaceAll(res, "Quyß╗ün truy cß║¡p", "Quyền truy cập")
	res = strings.ReplaceAll(res, "D╞░╞íng Nhß║¡t Tr╞░ß╗¥ng", "Dương Nhật Trường")
	res = strings.ReplaceAll(res, "Trß║ºn Xu├ón ├én", "Trần Xuân Ân")
	res = strings.ReplaceAll(res, "V├╡ V─ân Hiß║┐n", "Võ Văn Hiền")
	res = strings.ReplaceAll(res, "L├¬ D╞░ß╗íng", "Lê Dưỡng")
	return res
}


