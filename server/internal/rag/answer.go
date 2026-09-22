package rag

import (
	"context"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/melihovodina/hovr/server/internal/ai"
)

// Question is a visitor's message with the conversation so far.
type Question struct {
	BotID   string
	BotName string
	Message string
	History []ai.Turn // oldest first
}

// Citation is a passage the answer used; N is the [n] marker in the text.
type Citation struct {
	N           int     `json:"n"`
	SourceID    string  `json:"sourceId"`
	SourceTitle string  `json:"sourceTitle"`
	Score       float64 `json:"score"`
}

// Answer is the finished reply.
type Answer struct {
	Text      string
	Answered  bool // false when the model said the knowledge doesn't cover it
	Citations []Citation
}

// Answerer retrieves knowledge and streams the model's answer.
type Answerer struct {
	retriever *Retriever
	model     ai.ChatModel
}

func NewAnswerer(retriever *Retriever, model ai.ChatModel) *Answerer {
	return &Answerer{retriever: retriever, model: model}
}

// Answer streams the reply through onText and returns it complete.
func (a *Answerer) Answer(ctx context.Context, q Question, onText func(string) error) (*Answer, error) {
	matches, err := a.search(ctx, q)
	if err != nil {
		return nil, err
	}
	turns := append(slices.Clip(q.History), ai.Turn{Role: ai.RoleUser, Text: q.Message})
	filter := &markerFilter{marker: noAnswer, out: onText}
	if err := a.model.Stream(ctx, buildPrompt(q.BotName, matches), turns, filter.write); err != nil {
		return nil, err
	}
	if err := filter.flush(); err != nil {
		return nil, err
	}
	text := strings.TrimSpace(filter.text.String())
	return &Answer{Text: text, Answered: !filter.found, Citations: cited(text, matches)}, nil
}

// search finds passages for the message. Short follow-ups ("and to the UK?") match
// poorly alone, so they are searched again together with the previous question.
func (a *Answerer) search(ctx context.Context, q Question) ([]Match, error) {
	matches, err := a.retriever.Search(ctx, q.BotID, q.Message, DefaultLimit)
	if err != nil || Relevant(matches) {
		return matches, err
	}
	for i := len(q.History) - 1; i >= 0; i-- {
		if q.History[i].Role == ai.RoleUser {
			matches, err = a.retriever.Search(ctx, q.BotID, q.History[i].Text+"\n"+q.Message, DefaultLimit)
			if err != nil || Relevant(matches) {
				return matches, err
			}
			break
		}
	}
	return nil, nil
}

var citationRe = regexp.MustCompile(`\[(\d+(?:\s*,\s*\d+)*)\]`)

// cited returns the passages the text refers to, in order of first mention.
func cited(text string, matches []Match) []Citation {
	out := []Citation{}
	seen := map[int]bool{}
	for _, group := range citationRe.FindAllStringSubmatch(text, -1) {
		for _, s := range strings.Split(group[1], ",") {
			n, _ := strconv.Atoi(strings.TrimSpace(s))
			if n < 1 || n > len(matches) || seen[n] {
				continue
			}
			seen[n] = true
			m := matches[n-1]
			out = append(out, Citation{N: n, SourceID: m.SourceID, SourceTitle: m.SourceTitle, Score: m.Score})
		}
	}
	return out
}
