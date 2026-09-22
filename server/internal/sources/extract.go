package sources

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

// Content types we accept, decided by file extension.
const (
	typePDF      = "application/pdf"
	typeDOCX     = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	typeMarkdown = "text/markdown"
	typeText     = "text/plain"
)

var contentTypes = map[string]string{
	".pdf":      typePDF,
	".docx":     typeDOCX,
	".md":       typeMarkdown,
	".markdown": typeMarkdown,
	".txt":      typeText,
}

// extracted is the plain text of a document plus its page count (PDF only).
type extracted struct {
	Text  string
	Pages int
}

// extract pulls plain text out of a file. User-facing failure reasons are returned
// as *failure; anything else is an internal error.
func extract(contentType string, data []byte) (extracted, error) {
	var (
		out extracted
		err error
	)
	switch contentType {
	case typePDF:
		out, err = extractPDF(data)
	case typeDOCX:
		out.Text, err = extractDOCX(data)
	case typeMarkdown, typeText:
		if !utf8.Valid(data) {
			return out, fail("This file isn't plain text. Save it as UTF-8 and upload it again.")
		}
		out.Text = string(data)
	default:
		return out, fmt.Errorf("unsupported content type %q", contentType)
	}
	if err != nil {
		return out, err
	}
	out.Text = normalizeText(out.Text)
	if strings.TrimSpace(out.Text) == "" {
		if contentType == typePDF {
			return out, fail("This PDF has no text inside. Is it a scanned image?")
		}
		return out, fail("We couldn't find any text in this file.")
	}
	return out, nil
}

func extractPDF(data []byte) (out extracted, err error) {
	// The PDF parser can panic on broken files; treat that as an unreadable file.
	defer func() {
		if r := recover(); r != nil {
			err = fail("We couldn't read this PDF. It may be damaged or password-protected.")
		}
	}()
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return out, fail("We couldn't read this PDF. It may be damaged or password-protected.")
	}
	out.Pages = r.NumPage()
	var b strings.Builder
	for i := 1; i <= out.Pages; i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			continue // skip a broken page, keep the rest
		}
		b.WriteString(text)
		b.WriteString("\n\n")
	}
	out.Text = b.String()
	return out, nil
}

// extractDOCX reads word/document.xml from the .docx zip: text runs (w:t), tabs,
// line breaks and paragraph ends. Formatting is dropped.
func extractDOCX(data []byte) (string, error) {
	unreadable := fail("We couldn't read this Word file. Save it as .docx and upload it again.")
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", unreadable
	}
	var doc io.ReadCloser
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			if doc, err = f.Open(); err != nil {
				return "", unreadable
			}
			break
		}
	}
	if doc == nil {
		return "", unreadable
	}
	defer doc.Close()

	var b strings.Builder
	dec := xml.NewDecoder(doc)
	inText := false
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", unreadable
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "t":
				inText = true
			case "tab":
				b.WriteByte('\t')
			case "br", "cr":
				b.WriteByte('\n')
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "t":
				inText = false
			case "p":
				b.WriteString("\n\n")
			}
		case xml.CharData:
			if inText {
				b.Write(t)
			}
		}
	}
	return b.String(), nil
}

// normalizeText unifies line endings, trims trailing spaces on each line and
// collapses runs of blank lines, so paragraphs are separated by exactly one.
func normalizeText(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	s = strings.ReplaceAll(s, "\u00a0", " ") // non-breaking spaces
	lines := strings.Split(s, "\n")
	var b strings.Builder
	blank := 0
	for _, line := range lines {
		line = strings.TrimRight(line, " \t")
		if strings.TrimSpace(line) == "" {
			blank++
			continue
		}
		if b.Len() > 0 {
			if blank > 0 {
				b.WriteString("\n\n")
			} else {
				b.WriteByte('\n')
			}
		}
		blank = 0
		b.WriteString(line)
	}
	return b.String()
}
