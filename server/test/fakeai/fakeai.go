// Package fakeai gives tests a deterministic embedder that needs no network or
// API key. Only test files import it.
package fakeai

import (
	"context"
	"hash/fnv"
	"math"
	"strings"
	"unicode"

	"github.com/melihovodina/hovr/server/internal/ai"
)

// Embedder embeds text as a normalized bag of words: texts sharing words get
// similar vectors.
type Embedder struct{}

func (Embedder) EmbedDocuments(_ context.Context, texts []string) ([][]float32, error) {
	out := make([][]float32, len(texts))
	for i, t := range texts {
		out[i] = vector(t)
	}
	return out, nil
}

func (Embedder) EmbedQuery(_ context.Context, text string) ([]float32, error) {
	return vector(text), nil
}

func vector(text string) []float32 {
	v := make([]float32, ai.Dims)
	words := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	for _, w := range words {
		h := fnv.New32a()
		_, _ = h.Write([]byte(w))
		v[h.Sum32()%ai.Dims]++
	}
	var norm float64
	for _, x := range v {
		norm += float64(x * x)
	}
	if norm == 0 {
		v[0] = 1 // empty text still needs a valid, non-zero vector
		return v
	}
	scale := float32(1 / math.Sqrt(norm))
	for i := range v {
		v[i] *= scale
	}
	return v
}
