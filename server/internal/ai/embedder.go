// Package ai wraps the Gemini models hovr uses: text embeddings and chat answers.
package ai

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

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

// NewEmbedder returns the Gemini embedder.
func NewEmbedder(ctx context.Context, apiKey string) (Embedder, error) {
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
