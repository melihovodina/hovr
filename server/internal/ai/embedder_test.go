package ai

import (
	"testing"

	"google.golang.org/genai"
)

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
