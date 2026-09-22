package sources

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"strings"
	"testing"
)

// testPDF builds a minimal one-page PDF with the given lines of text (none = a
// page without text, like a scanned image).
func testPDF(lines ...string) []byte {
	var content strings.Builder
	content.WriteString("BT /F1 12 Tf 72 720 Td 16 TL\n")
	for _, l := range lines {
		fmt.Fprintf(&content, "(%s) Tj T*\n", l)
	}
	content.WriteString("ET")
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", content.Len(), content.String()),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
	var b bytes.Buffer
	b.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objects))
	for i, o := range objects {
		offsets[i] = b.Len()
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", i+1, o)
	}
	xref := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, off := range offsets {
		fmt.Fprintf(&b, "%010d 00000 n \n", off)
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return b.Bytes()
}

// testDOCX builds a minimal .docx whose body is documentXML.
func testDOCX(t *testing.T, documentXML string) []byte {
	t.Helper()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	w, err := z.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
		documentXML + `</w:body></w:document>`))
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func wantFailure(t *testing.T, name string, err error, contains string) {
	t.Helper()
	var f *failure
	if !errors.As(err, &f) || !strings.Contains(f.reason, contains) {
		t.Errorf("%s: error = %v, want a failure mentioning %q", name, err, contains)
	}
}

func TestExtractPDF(t *testing.T) {
	got, err := extract(typePDF, testPDF("Shipping and delivery.", "Orders to Canada arrive in 5 to 8 business days."))
	if err != nil {
		t.Fatal(err)
	}
	if got.Pages != 1 || !strings.Contains(got.Text, "Orders to Canada arrive") {
		t.Errorf("extract = %+v", got)
	}

	_, err = extract(typePDF, testPDF())
	wantFailure(t, "scanned pdf", err, "no text inside")
	_, err = extract(typePDF, []byte("%PDF-1.4 definitely broken"))
	wantFailure(t, "broken pdf", err, "couldn't read this PDF")
}

func TestExtractDOCX(t *testing.T) {
	doc := testDOCX(t, `
		<w:p><w:r><w:t>Returns policy</w:t></w:r></w:p>
		<w:p><w:r><w:t xml:space="preserve">Returns are free </w:t></w:r><w:r><w:t>within 30 days.</w:t></w:r></w:p>
		<w:p><w:r><w:t>Name</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Value</w:t></w:r></w:p>`)
	got, err := extract(typeDOCX, doc)
	if err != nil {
		t.Fatal(err)
	}
	want := "Returns policy\n\nReturns are free within 30 days.\n\nName\tValue"
	if got.Text != want {
		t.Errorf("text = %q, want %q", got.Text, want)
	}

	_, err = extract(typeDOCX, []byte("not a zip"))
	wantFailure(t, "not a zip", err, "couldn't read this Word file")
	_, err = extract(typeDOCX, testDOCX(t, `<w:p></w:p>`))
	wantFailure(t, "empty docx", err, "couldn't find any text")
}

func TestExtractPlainText(t *testing.T) {
	got, err := extract(typeMarkdown, []byte("# FAQ\r\n\r\n\r\n\r\nYes, we sell grinders.   \r\n"))
	if err != nil || got.Text != "# FAQ\n\nYes, we sell grinders." {
		t.Errorf("markdown = %q, %v", got.Text, err)
	}
	_, err = extract(typeText, []byte{0xff, 0xfe, 0x00, 'a'})
	wantFailure(t, "not utf-8", err, "isn't plain text")
	_, err = extract(typeText, []byte(" \n\t\n "))
	wantFailure(t, "blank", err, "couldn't find any text")
	if _, err := extract("image/png", []byte("x")); err == nil || errors.As(err, new(*failure)) {
		t.Errorf("unknown type should be an internal error, got %v", err)
	}
}

func TestNormalizeText(t *testing.T) {
	got := normalizeText("a  \r\nb\r\n\r\n\r\n\r\nc d\n\n")
	if got != "a\nb\n\nc d" {
		t.Errorf("normalizeText = %q", got)
	}
}
