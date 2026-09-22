package sources

import (
	"fmt"
	"strings"
	"testing"
)

func TestChunkShortText(t *testing.T) {
	got := chunkText("Returns are free within 30 days.")
	if len(got) != 1 || got[0] != "Returns are free within 30 days." {
		t.Errorf("chunkText = %q", got)
	}
	if got := chunkText(""); len(got) != 0 {
		t.Errorf("empty text gave %d chunks", len(got))
	}
}

func TestChunkKeepsParagraphsWhole(t *testing.T) {
	var paras []string
	for i := range 20 {
		paras = append(paras, fmt.Sprintf("Paragraph %d talks about one topic in two sentences. It ends here.", i))
	}
	chunks := chunkText(strings.Join(paras, "\n\n"))
	if len(chunks) < 2 {
		t.Fatalf("expected several chunks, got %d", len(chunks))
	}
	joined := strings.Join(chunks, "\n\n")
	for _, p := range paras {
		if !strings.Contains(joined, p) {
			t.Errorf("paragraph lost or split: %q", p)
		}
	}
	for i, c := range chunks {
		if n := runeLen(c); n > maxChunkLen {
			t.Errorf("chunk %d is %d characters, max %d", i, n, maxChunkLen)
		}
	}
}

func TestChunkSplitsLongParagraphAtSentences(t *testing.T) {
	var sentences []string
	for i := range 40 {
		sentences = append(sentences, fmt.Sprintf("Sentence number %d explains a small detail of the shipping policy.", i))
	}
	chunks := chunkText(strings.Join(sentences, " ")) // one huge paragraph
	if len(chunks) < 2 {
		t.Fatalf("expected the paragraph to be split, got %d chunk", len(chunks))
	}
	for i, c := range chunks {
		if runeLen(c) > maxChunkLen {
			t.Errorf("chunk %d too long: %d", i, runeLen(c))
		}
		if !strings.HasSuffix(c, ".") {
			t.Errorf("chunk %d ends mid-sentence: …%q", i, c[max(0, len(c)-30):])
		}
	}
	// Overlap: each chunk starts with the last sentence of the previous one.
	for i := 1; i < len(chunks); i++ {
		if last := lastSentence(chunks[i-1]); !strings.HasPrefix(chunks[i], last) {
			t.Errorf("chunk %d doesn't start with the previous chunk's last sentence %q", i, last)
		}
	}
}

func TestChunkHardSplitsGiantSentence(t *testing.T) {
	giant := strings.TrimSpace(strings.Repeat("word ", 1000)) // ~5000 chars, no sentence end
	chunks := chunkText(giant)
	if len(chunks) < 4 {
		t.Fatalf("giant sentence gave %d chunks", len(chunks))
	}
	total := 0
	for i, c := range chunks {
		if runeLen(c) > maxChunkLen {
			t.Errorf("chunk %d too long: %d", i, runeLen(c))
		}
		total += len(strings.Fields(c))
	}
	if total < 1000 {
		t.Errorf("words lost: %d of 1000", total)
	}
}

func TestSplitSentences(t *testing.T) {
	got := splitSentences("We ship to Canada. Delivery takes 5.5 days! Really?\nYes")
	want := []string{"We ship to Canada.", "Delivery takes 5.5 days!", "Really?", "Yes"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Errorf("splitSentences = %q, want %q", got, want)
	}
}
