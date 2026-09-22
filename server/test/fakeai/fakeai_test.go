package fakeai

import (
	"context"
	"math"
	"testing"

	"github.com/melihovodina/hovr/server/internal/ai"
)

func cosine(a, b []float32) float64 {
	var dot float64
	for i := range a {
		dot += float64(a[i] * b[i])
	}
	return dot // vectors are normalized
}

func TestEmbedder(t *testing.T) {
	ctx := context.Background()
	docs, err := Embedder{}.EmbedDocuments(ctx, []string{"We ship to Canada.", "Returns are free.", ""})
	if err != nil || len(docs) != 3 {
		t.Fatalf("EmbedDocuments = %d vectors, %v", len(docs), err)
	}
	for i, v := range docs {
		var norm float64
		for _, x := range v {
			norm += float64(x * x)
		}
		if len(v) != ai.Dims || math.Abs(norm-1) > 1e-5 {
			t.Errorf("vector %d: %d dims, norm %f", i, len(v), norm)
		}
	}
	q, _ := Embedder{}.EmbedQuery(ctx, "Do you ship to Canada?")
	if cosine(q, docs[0]) <= cosine(q, docs[1]) {
		t.Error("question about shipping is not closest to the shipping text")
	}
	again, _ := Embedder{}.EmbedQuery(ctx, "Do you ship to Canada?")
	if cosine(q, again) < 0.9999 {
		t.Error("embedder is not deterministic")
	}
}
