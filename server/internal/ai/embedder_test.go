package ai

import (
	"context"
	"math"
	"testing"

	"google.golang.org/genai"
)

func cosine(a, b []float32) float64 {
	var dot float64
	for i := range a {
		dot += float64(a[i] * b[i])
	}
	return dot // mock vectors are normalized
}

func TestMockEmbedder(t *testing.T) {
	ctx := context.Background()
	docs, err := Mock{}.EmbedDocuments(ctx, []string{"We ship to Canada.", "Returns are free.", ""})
	if err != nil || len(docs) != 3 {
		t.Fatalf("EmbedDocuments = %d vectors, %v", len(docs), err)
	}
	for i, v := range docs {
		var norm float64
		for _, x := range v {
			norm += float64(x * x)
		}
		if len(v) != Dims || math.Abs(norm-1) > 1e-5 {
			t.Errorf("vector %d: %d dims, norm %f", i, len(v), norm)
		}
	}
	q, _ := Mock{}.EmbedQuery(ctx, "Do you ship to Canada?")
	if cosine(q, docs[0]) <= cosine(q, docs[1]) {
		t.Error("question about shipping is not closest to the shipping text")
	}
	again, _ := Mock{}.EmbedQuery(ctx, "Do you ship to Canada?")
	if cosine(q, again) < 0.9999 {
		t.Error("mock is not deterministic")
	}
}

func TestNewEmbedderWithoutKeyIsMock(t *testing.T) {
	e, err := NewEmbedder(context.Background(), "")
	if _, ok := e.(Mock); !ok || err != nil {
		t.Errorf("NewEmbedder(\"\") = %T, %v; want Mock", e, err)
	}
}

func TestVectorsChecksShape(t *testing.T) {
	good := &genai.EmbedContentResponse{Embeddings: []*genai.ContentEmbedding{{Values: make([]float32, Dims)}}}
	if _, err := vectors(good, 1); err != nil {
		t.Errorf("valid response rejected: %v", err)
	}
	if _, err := vectors(good, 2); err == nil {
		t.Error("count mismatch accepted")
	}
	short := &genai.EmbedContentResponse{Embeddings: []*genai.ContentEmbedding{{Values: make([]float32, 10)}}}
	if _, err := vectors(short, 1); err == nil {
		t.Error("wrong dimensions accepted")
	}
}
