package rag

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/test/fakeai"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// fakeModel replies with chunks and records what it was asked.
type fakeModel struct {
	chunks []string
	system string
	turns  []ai.Turn
}

func (f *fakeModel) Stream(_ context.Context, system string, turns []ai.Turn, onText func(string) error) error {
	f.system, f.turns = system, turns
	for _, c := range f.chunks {
		if err := onText(c); err != nil {
			return err
		}
	}
	return nil
}

func TestMarkerFilter(t *testing.T) {
	cases := []struct {
		chunks []string
		text   string
		found  bool
	}{
		{[]string{"We ship ", "to Canada [1]."}, "We ship to Canada [1].", false},
		{[]string{"[no-answer] I don't know."}, "I don't know.", true},
		{[]string{"[no-", "ans", "wer]", " Sorry."}, "Sorry.", true},
		{[]string{"Sorry. [no-answer]"}, "Sorry. ", true},
		{[]string{"See [1", "] and [no"}, "See [1] and [no", false},
	}
	for _, tc := range cases {
		var sent strings.Builder
		f := &markerFilter{marker: noAnswer, out: func(s string) error { sent.WriteString(s); return nil }}
		for _, c := range tc.chunks {
			_ = f.write(c)
		}
		_ = f.flush()
		if sent.String() != tc.text || f.found != tc.found {
			t.Errorf("%q: sent %q found %v, want %q %v", tc.chunks, sent.String(), f.found, tc.text, tc.found)
		}
	}
}

func TestCited(t *testing.T) {
	matches := []Match{{SourceID: "a", SourceTitle: "A"}, {SourceID: "b", SourceTitle: "B"}}
	got := cited("Yes [2]. Also [1, 2] and [7].", matches)
	want := []Citation{{N: 2, SourceID: "b", SourceTitle: "B"}, {N: 1, SourceID: "a", SourceTitle: "A"}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("cited = %+v, want %+v", got, want)
	}
	if got := cited("No citations.", matches); len(got) != 0 {
		t.Errorf("cited without markers = %+v", got)
	}
}

func TestBuildPrompt(t *testing.T) {
	p := buildPrompt("Northwind", []Match{{SourceTitle: "Shipping", Content: " We ship to Canada. "}})
	for _, want := range []string{"website of Northwind", "\n[1] (Shipping) We ship to Canada.\n", noAnswer} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt lacks %q", want)
		}
	}
	if p := buildPrompt("Northwind", nil); !strings.Contains(p, "(nothing relevant to this message)") {
		t.Error("empty knowledge not stated")
	}
}

func TestAnswer(t *testing.T) {
	pool := testdb.Connect(t)
	bot := newBot(t, pool)
	addSource(t, pool, bot, "Shipping", "ready", "Shipping to Canada takes five days")
	ctx := context.Background()

	model := &fakeModel{chunks: []string{"Five days ", "[1]."}}
	history := []ai.Turn{{Role: ai.RoleUser, Text: "hi"}, {Role: ai.RoleModel, Text: "Hello!"}}
	a, err := NewAnswerer(New(pool, fakeai.Embedder{}), model).Answer(ctx,
		Question{BotID: bot, BotName: "Northwind", Message: "shipping to Canada", History: history}, func(string) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if a.Text != "Five days [1]." || !a.Answered || len(a.Citations) != 1 || a.Citations[0].SourceTitle != "Shipping" {
		t.Errorf("answer = %+v", a)
	}
	if !strings.Contains(model.system, "[1] (Shipping) Shipping to Canada takes five days") {
		t.Errorf("passage missing from prompt:\n%s", model.system)
	}
	if len(model.turns) != 3 || model.turns[2].Text != "shipping to Canada" || len(history) != 2 {
		t.Errorf("turns = %+v", model.turns)
	}

	// A follow-up that matches nothing alone is searched with the previous question.
	model = &fakeModel{chunks: []string{"Five days [1]."}}
	history = []ai.Turn{{Role: ai.RoleUser, Text: "shipping to Canada"}, {Role: ai.RoleModel, Text: "Yes."}}
	_, _ = NewAnswerer(New(pool, fakeai.Embedder{}), model).Answer(ctx,
		Question{BotID: bot, BotName: "Northwind", Message: "takes how long", History: history}, func(string) error { return nil })
	if !strings.Contains(model.system, "[1] (Shipping)") {
		t.Error("follow-up did not find the passage")
	}

	// Off-topic: no passages, and the model's marker means not answered.
	model = &fakeModel{chunks: []string{"[no-answer] I don't know."}}
	a, _ = NewAnswerer(New(pool, fakeai.Embedder{}), model).Answer(ctx,
		Question{BotID: bot, BotName: "Northwind", Message: "capital of France"}, func(string) error { return nil })
	if a.Answered || a.Text != "I don't know." || !strings.Contains(model.system, "nothing relevant") {
		t.Errorf("off-topic answer = %+v", a)
	}
}
