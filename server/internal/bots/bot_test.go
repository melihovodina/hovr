package bots

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

func ptr[T any](v T) *T { return &v }

func TestPatchApply(t *testing.T) {
	base := func() *Bot {
		return &Bot{Name: "Northwind", Color: "#C8F547", Position: "right", Greeting: "Hi", ShowBadge: true}
	}

	b := base()
	err := Patch{
		Name:               ptr("  Northwind Coffee "),
		Color:              ptr("#2f6b4f"),
		Position:           ptr("left"),
		Greeting:           ptr(" Ask me about orders. "),
		SuggestedQuestions: ptr([]string{"Do you ship to Canada?", "  ", "Can I pause?"}),
		AllowedDomains:     ptr([]string{"https://Northwind.example/help", "shop.northwind.example", "northwind.example"}),
		ShowBadge:          ptr(false),
	}.apply(b)
	if err != nil {
		t.Fatalf("valid patch rejected: %v", err)
	}
	if b.Name != "Northwind Coffee" || b.Color != "#2F6B4F" || b.Position != "left" || b.Greeting != "Ask me about orders." || b.ShowBadge {
		t.Errorf("fields not applied: %+v", b)
	}
	if len(b.SuggestedQuestions) != 2 {
		t.Errorf("blank question kept: %v", b.SuggestedQuestions)
	}
	if strings.Join(b.AllowedDomains, ",") != "northwind.example,shop.northwind.example" {
		t.Errorf("domains = %v", b.AllowedDomains)
	}

	untouched := base()
	if err := (Patch{}).apply(untouched); err != nil || !reflect.DeepEqual(untouched, base()) {
		t.Errorf("empty patch changed the bot: %+v, %v", untouched, err)
	}

	rejected := map[string]Patch{
		"empty name":      {Name: ptr("   ")},
		"long name":       {Name: ptr(strings.Repeat("a", maxNameLen+1))},
		"bad color":       {Color: ptr("green")},
		"short color":     {Color: ptr("#FFF")},
		"bad position":    {Position: ptr("top")},
		"empty greeting":  {Greeting: ptr(" ")},
		"long greeting":   {Greeting: ptr(strings.Repeat("a", maxGreetingLen+1))},
		"too many qs":     {SuggestedQuestions: ptr([]string{"a", "b", "c", "d", "e", "f"})},
		"long question":   {SuggestedQuestions: ptr([]string{strings.Repeat("a", maxQuestionLen+1)})},
		"not a domain":    {AllowedDomains: ptr([]string{"not a domain"})},
		"domain with ip":  {AllowedDomains: ptr([]string{"127.0.0.1"})},
		"too many domain": {AllowedDomains: ptr(manyDomains(maxDomains + 1))},
	}
	for name, p := range rejected {
		if err := p.apply(base()); !errors.Is(err, apperr.ErrBadInput) {
			t.Errorf("%s: got %v, want a validation error", name, err)
		}
	}
}

func manyDomains(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = "site" + strings.Repeat("x", i+1) + ".example"
	}
	return out
}

func TestNormalizeHost(t *testing.T) {
	cases := map[string]string{
		"example.com":                    "example.com",
		"HTTPS://Shop.Example.com/a?b=1": "shop.example.com",
		"http://example.com:8080":        "example.com",
		"localhost":                      "localhost",
		"":                               "",
	}
	for in, want := range cases {
		got, err := normalizeHost(in)
		if err != nil || got != want {
			t.Errorf("normalizeHost(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
}

func TestNewPublicKey(t *testing.T) {
	a, b := newPublicKey(), newPublicKey()
	if !strings.HasPrefix(a, publicKeyPrefix) || len(a) != len(publicKeyPrefix)+24 || a == b {
		t.Errorf("keys %q %q: want unique pub_ + 24 chars", a, b)
	}
}
