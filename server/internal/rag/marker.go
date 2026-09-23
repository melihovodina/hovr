package rag

import (
	"regexp"
	"strings"
)

// markerFilter removes a marker from streamed text. Text that could be the start
// of the marker is held back until the next chunk shows whether it is.
type markerFilter struct {
	marker  string
	out     func(string) error
	pending string
	text    strings.Builder // everything sent to out
	found   bool
}

func (f *markerFilter) write(chunk string) error {
	s := f.pending + chunk
	if strings.Contains(s, f.marker) {
		f.found = true
		s = strings.ReplaceAll(s, f.marker, "")
	}
	if f.text.Len() == 0 {
		s = strings.TrimLeft(s, " \n") // the marker usually opens the reply
	}
	keep := partialSuffix(s, f.marker)
	f.pending = s[len(s)-keep:]
	return f.emit(s[:len(s)-keep])
}

func (f *markerFilter) flush() error {
	s := f.pending
	f.pending = ""
	return f.emit(s)
}

func (f *markerFilter) emit(s string) error {
	if s == "" {
		return nil
	}
	f.text.WriteString(s)
	return f.out(s)
}

// partialSuffix is the length of the longest end of s that begins marker.
func partialSuffix(s, marker string) int {
	for n := min(len(s), len(marker)-1); n > 0; n-- {
		if strings.HasSuffix(s, marker[:n]) {
			return n
		}
	}
	return 0
}

// spacedCitationRe is a citation marker with the space in front of it, so taking
// "We ship to Canada [2]." apart leaves no gap before the full stop.
var spacedCitationRe = regexp.MustCompile(`[ \t]*` + citationRe.String())

// StripCitations removes the [n] markers from a finished answer. Visitors are not
// shown the passages, so the markers would point at nothing.
func StripCitations(text string) string {
	return strings.TrimSpace(spacedCitationRe.ReplaceAllString(text, ""))
}

// citationHoldRe is the end of a chunk that could still grow into a marker: an
// open bracket with the digits and commas so far, or the space before one.
var citationHoldRe = regexp.MustCompile(`(?:[ \t]*\[[\d,\s]*|[ \t]+)$`)

// CitationStripper removes citation markers from streamed text, holding back an
// end that might still grow into one.
type CitationStripper struct {
	out     func(string) error
	pending string
}

func NewCitationStripper(out func(string) error) *CitationStripper {
	return &CitationStripper{out: out}
}

func (s *CitationStripper) Write(chunk string) error {
	text := spacedCitationRe.ReplaceAllString(s.pending+chunk, "")
	hold := citationHoldRe.FindStringIndex(text)
	if hold == nil {
		s.pending = ""
		return s.emit(text)
	}
	s.pending = text[hold[0]:]
	return s.emit(text[:hold[0]])
}

// Flush sends what was held back, once no more chunks can arrive.
func (s *CitationStripper) Flush() error {
	text := s.pending
	s.pending = ""
	return s.emit(text)
}

func (s *CitationStripper) emit(text string) error {
	if text == "" {
		return nil
	}
	return s.out(text)
}
