package sources

import (
	"errors"
	"regexp"
	"testing"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

func TestContentTypeFor(t *testing.T) {
	ok := map[string]string{
		"FAQ.pdf":        typePDF,
		"Guide.DOCX":     typeDOCX,
		"readme.md":      typeMarkdown,
		"notes.markdown": typeMarkdown,
		"policy.txt":     typeText,
	}
	for name, want := range ok {
		if got, err := contentTypeFor(name); err != nil || got != want {
			t.Errorf("contentTypeFor(%q) = %q, %v; want %q", name, got, err, want)
		}
	}
	for _, name := range []string{"virus.exe", "photo.png", "old.doc", "noextension"} {
		if _, err := contentTypeFor(name); !errors.Is(err, apperr.ErrBadInput) {
			t.Errorf("contentTypeFor(%q) accepted", name)
		}
	}
}

func TestSafeFileName(t *testing.T) {
	cases := map[string]string{
		"FAQ.pdf":               "FAQ.pdf",
		"My Brewing Guide.docx": "My-Brewing-Guide.docx",
		"../../etc/passwd":      "passwd",
		`C:\Users\anna\a b.md`:  "a-b.md",
		"???":                   "file",
		"Übersicht.txt":         "Übersicht.txt",
	}
	for in, want := range cases {
		if got := safeFileName(in); got != want {
			t.Errorf("safeFileName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNewID(t *testing.T) {
	uuidV4 := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	seen := map[string]bool{}
	for range 100 {
		id := newID()
		if !uuidV4.MatchString(id) || seen[id] {
			t.Fatalf("newID = %q (duplicate: %v)", id, seen[id])
		}
		seen[id] = true
	}
}
