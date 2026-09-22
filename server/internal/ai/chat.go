package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/genai"
)

// Chat models in order; the next one takes over if one fails before answering.
var chatModels = []string{"gemma-4-26b-a4b-it", "gemini-3.1-flash-lite", "gemini-3.6-flash"}

// firstTextTimeout is how long a model may take to start answering.
const firstTextTimeout = 12 * time.Second

// Roles of a Turn.
const (
	RoleUser  = "user"
	RoleModel = "model"
)

// Turn is one earlier message of the conversation.
type Turn struct {
	Role string
	Text string
}

// ChatModel streams an answer; onText receives the text as it arrives.
type ChatModel interface {
	Stream(ctx context.Context, system string, turns []Turn, onText func(string) error) error
}

// NewChatModel returns the Gemini chat model, or the offline mock when apiKey is empty.
func NewChatModel(ctx context.Context, apiKey string) (ChatModel, error) {
	if apiKey == "" {
		return MockChat{}, nil
	}
	client, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})
	if err != nil {
		return nil, fmt.Errorf("create gemini client: %w", err)
	}
	return &geminiChat{models: client.Models}, nil
}

type geminiChat struct {
	models *genai.Models
}

func (g *geminiChat) Stream(ctx context.Context, system string, turns []Turn, onText func(string) error) error {
	contents := make([]*genai.Content, len(turns))
	for i, t := range turns {
		contents[i] = genai.NewContentFromText(t.Text, genai.Role(t.Role))
	}
	temperature := float32(0.2)
	cfg := &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(system, genai.RoleUser),
		Temperature:       &temperature,
	}

	var errs []error
	for _, model := range chatModels {
		started, err := g.stream(ctx, model, contents, cfg, onText)
		if err == nil || started || ctx.Err() != nil {
			return err
		}
		errs = append(errs, fmt.Errorf("%s: %w", model, err))
	}
	return errors.Join(errs...)
}

// stream runs one model. started reports whether any text was sent, after which
// falling back to another model would repeat the answer.
func (g *geminiChat) stream(ctx context.Context, model string, contents []*genai.Content,
	cfg *genai.GenerateContentConfig, onText func(string) error) (started bool, err error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	timer := time.AfterFunc(firstTextTimeout, cancel)
	defer timer.Stop()

	for resp, err := range g.models.GenerateContentStream(ctx, model, contents, cfg) {
		if err != nil {
			return started, err
		}
		text := resp.Text()
		if text == "" {
			continue
		}
		if !started {
			started = true
			timer.Stop()
		}
		if err := onText(text); err != nil {
			return true, err
		}
	}
	if !started {
		return false, errors.New("empty answer")
	}
	return true, nil
}

// MockChat answers offline: it repeats the first knowledge passage of the prompt.
type MockChat struct{}

func (MockChat) Stream(_ context.Context, system string, _ []Turn, onText func(string) error) error {
	answer := "[no-answer] I'm running offline (no GEMINI_API_KEY) and found nothing about that."
	if _, rest, ok := strings.Cut(system, "\n[1] "); ok {
		passage, _, _ := strings.Cut(rest, "\n")
		answer = "Offline answer from your knowledge: " + passage + " [1]"
	}
	return onText(answer)
}
