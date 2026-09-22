package sources

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	// Chunks aim for about this many characters: a few sentences, one idea.
	targetChunkLen = 900
	// No chunk is longer than this.
	maxChunkLen = 1200
	// The last sentence of a chunk is repeated at the start of the next one if it is
	// at most this long, so a fact on a boundary is never cut off from its context.
	maxOverlapLen = 250
)

// chunkText splits text along paragraphs and sentences; a sentence is cut only
// when it alone is longer than maxChunkLen.
func chunkText(text string) []string {
	var units []string
	for _, para := range strings.Split(text, "\n\n") {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}
		if runeLen(para) <= maxChunkLen {
			units = append(units, para)
			continue
		}
		for _, s := range splitSentences(para) {
			units = append(units, hardSplit(s, maxChunkLen)...)
		}
	}

	var chunks []string
	var cur strings.Builder
	flush := func() {
		if cur.Len() == 0 {
			return
		}
		chunk := cur.String()
		chunks = append(chunks, chunk)
		cur.Reset()
		if last := lastSentence(chunk); last != chunk && runeLen(last) <= maxOverlapLen {
			cur.WriteString(last)
		}
	}
	for _, u := range units {
		if cur.Len() > 0 && runeLen(cur.String())+2+runeLen(u) > targetChunkLen {
			flush()
			// The carried-over sentence must not push this unit past the hard limit.
			if runeLen(cur.String())+2+runeLen(u) > maxChunkLen {
				cur.Reset()
			}
		}
		if cur.Len() > 0 {
			cur.WriteString("\n\n")
		}
		cur.WriteString(u)
	}
	if cur.Len() > 0 && (len(chunks) == 0 || cur.String() != lastSentence(chunks[len(chunks)-1])) {
		chunks = append(chunks, cur.String())
	}
	return chunks
}

// splitSentences splits at ., ! or ? followed by whitespace, and at line breaks.
func splitSentences(s string) []string {
	var out []string
	start := 0
	runes := []rune(s)
	for i, r := range runes {
		end := false
		switch {
		case r == '\n':
			end = true
		case r == '.' || r == '!' || r == '?':
			end = i+1 == len(runes) || unicode.IsSpace(runes[i+1])
		}
		if end {
			if part := strings.TrimSpace(string(runes[start : i+1])); part != "" {
				out = append(out, part)
			}
			start = i + 1
		}
	}
	if part := strings.TrimSpace(string(runes[start:])); part != "" {
		out = append(out, part)
	}
	return out
}

// hardSplit cuts a very long sentence at whitespace so each piece fits max.
func hardSplit(s string, max int) []string {
	if runeLen(s) <= max {
		return []string{s}
	}
	var out []string
	var cur strings.Builder
	for _, word := range strings.Fields(s) {
		if cur.Len() > 0 && runeLen(cur.String())+1+runeLen(word) > max {
			out = append(out, cur.String())
			cur.Reset()
		}
		if cur.Len() > 0 {
			cur.WriteByte(' ')
		}
		cur.WriteString(word)
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

func lastSentence(chunk string) string {
	sentences := splitSentences(chunk)
	if len(sentences) == 0 {
		return ""
	}
	return sentences[len(sentences)-1]
}

func runeLen(s string) int { return utf8.RuneCountInString(s) }
