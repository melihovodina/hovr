package rag

import "strings"

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
