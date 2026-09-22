// Package ai wraps the models hovr uses: text embeddings now, chat answers later.
package ai

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode"

	"google.golang.org/genai"
)

// Dims is the embedding size; it must match vector(768) in the chunks table.
const Dims = 768

const (
	embeddingModel = "gemini-embedding-001"
	// The Gemini API takes at most 100 texts per batch request.
	maxBatch     = 100
	maxAttempts  = 4
	firstBackoff = 2 * time.Second
)

// Embedder turns text into vectors. Documents and questions are embedded with
// different task types, which makes question → passage matching more accurate.
type Embedder interface {
	EmbedDocuments(ctx context.Context, texts []string) ([][]float32, error)
	EmbedQuery(ctx context.Context, text string) ([]float32, error)
}

// NewEmbedder returns the Gemini embedder, or the offline mock when apiKey is empty.
func NewEmbedder(ctx context.Context, apiKey string) (Embedder, error) {
	if apiKey == "" {
		return Mock{}, nil
	}
	client, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})
	if err != nil {
		return nil, fmt.Errorf("create gemini client: %w", err)
	}
	return &gemini{models: client.Models}, nil
}

type gemini struct {
	models *genai.Models
}

func (g *gemini) EmbedDocuments(ctx context.Context, texts []string) ([][]float32, error) {
	out := make([][]float32, 0, len(texts))
	for start := 0; start < len(texts); start += maxBatch {
		end := min(start+maxBatch, len(texts))
		vecs, err := g.embed(ctx, texts[start:end], "RETRIEVAL_DOCUMENT")
		if err != nil {
			return nil, err
		}
		out = append(out, vecs...)
	}
	return out, nil
}

func (g *gemini) EmbedQuery(ctx context.Context, text string) ([]float32, error) {
	vecs, err := g.embed(ctx, []string{text}, "RETRIEVAL_QUERY")
	if err != nil {
		return nil, err
	}
	return vecs[0], nil
}

// embed sends one batch, retrying with backoff while the API says "too many requests".
func (g *gemini) embed(ctx context.Context, texts []string, task string) ([][]float32, error) {
	contents := make([]*genai.Content, len(texts))
	for i, t := range texts {
		contents[i] = genai.NewContentFromText(t, genai.RoleUser)
	}
	dims := int32(Dims)
	cfg := &genai.EmbedContentConfig{TaskType: task, OutputDimensionality: &dims}

	backoff := firstBackoff
	for attempt := 1; ; attempt++ {
		resp, err := g.models.EmbedContent(ctx, embeddingModel, contents, cfg)
		if err == nil {
			return vectors(resp, len(texts))
		}
		var apiErr genai.APIError
		retryable := errors.As(err, &apiErr) && (apiErr.Code == http.StatusTooManyRequests || apiErr.Code >= 500)
		if !retryable || attempt == maxAttempts {
			return nil, fmt.Errorf("embed %d texts: %w", len(texts), err)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}
		backoff *= 2
	}
}

func vectors(resp *genai.EmbedContentResponse, want int) ([][]float32, error) {
	if len(resp.Embeddings) != want {
		return nil, fmt.Errorf("got %d embeddings for %d texts", len(resp.Embeddings), want)
	}
	out := make([][]float32, want)
	for i, e := range resp.Embeddings {
		if len(e.Values) != Dims {
			return nil, fmt.Errorf("embedding %d has %d dimensions, want %d", i, len(e.Values), Dims)
		}
		out[i] = e.Values
	}
	return out, nil
}

// Mock embeds text offline as a normalized bag of words: texts sharing words get
// similar vectors. Good enough for tests and for running without an API key.
type Mock struct{}

func (Mock) EmbedDocuments(_ context.Context, texts []string) ([][]float32, error) {
	out := make([][]float32, len(texts))
	for i, t := range texts {
		out[i] = mockVector(t)
	}
	return out, nil
}

func (Mock) EmbedQuery(_ context.Context, text string) ([]float32, error) {
	return mockVector(text), nil
}

func mockVector(text string) []float32 {
	v := make([]float32, Dims)
	words := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	for _, w := range words {
		h := fnv.New32a()
		_, _ = h.Write([]byte(w))
		v[h.Sum32()%Dims]++
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
