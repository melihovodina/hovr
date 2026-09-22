// Package sources is the bot's knowledge: uploaded files and pasted text, turned by
// a background worker into embedded chunks the bot answers from.
package sources

import (
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/validate"
)

// Source statuses, matching the source_status enum.
const (
	statusQueued     = "queued"
	statusProcessing = "processing"
	statusReady      = "ready"
	statusFailed     = "failed"
)

// Source types, matching the source_type enum.
const (
	typeFile       = "file"
	typeTextSource = "text"
	typeInbox      = "inbox"
)

const (
	maxFileSize  = 10 << 20 // 10 MB, same as the storage bucket limit
	maxTitleLen  = 120
	maxTextLen   = 200_000
	textFileName = "text.txt"
)

// Source is one piece of knowledge as the app shows it.
type Source struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	ContentType string     `json:"contentType"`
	SizeBytes   int64      `json:"sizeBytes"`
	Pages       int        `json:"pages"`
	Chunks      int        `json:"chunks"`
	Status      string     `json:"status"`
	Error       *string    `json:"error"`
	CreatedAt   time.Time  `json:"createdAt"`
	ProcessedAt *time.Time `json:"processedAt"`
}

// failure is a processing error whose message is shown on the source ("This PDF
// has no text inside..."). Other errors are internal and get a generic message.
type failure struct{ reason string }

func (f *failure) Error() string { return f.reason }

func fail(reason string) error { return &failure{reason: reason} }

// contentTypeFor accepts a file by its extension; the content is checked later by
// the extractor, so a renamed file fails with a clear reason instead of garbage.
func contentTypeFor(filename string) (string, error) {
	ct, ok := contentTypes[strings.ToLower(filepath.Ext(filename))]
	if !ok {
		return "", apperr.BadRequest("Upload a PDF, Word (.docx), Markdown or text file.")
	}
	return ct, nil
}

func cleanTitle(title string) (string, error) {
	return validate.Text(title, 1, maxTitleLen, "Give it a title up to 120 characters.")
}

func cleanText(text string) (string, error) {
	return validate.Text(text, 1, maxTextLen, "Paste some text, up to 200,000 characters.")
}

// safeFileName keeps a file name readable in storage paths and download links.
func safeFileName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	clean := strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)
	clean = strings.Trim(clean, "-.")
	if clean == "" {
		return "file"
	}
	if runeLen(clean) > 100 {
		clean = string([]rune(clean)[:100])
	}
	return clean
}
