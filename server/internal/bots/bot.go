// Package bots manages a user's chatbots: settings, embed key and plan limits.
package bots

import (
	"crypto/rand"
	"encoding/base64"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/validate"
)

// Bot is one chatbot with its widget settings.
type Bot struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	PublicKey          string     `json:"publicKey"`
	AllowedDomains     []string   `json:"allowedDomains"`
	Color              string     `json:"color"`
	AvatarURL          *string    `json:"avatarUrl"`
	Position           string     `json:"position"`
	Greeting           string     `json:"greeting"`
	SuggestedQuestions []string   `json:"suggestedQuestions"`
	ShowBadge          bool       `json:"showBadge"`
	LastSeenHost       *string    `json:"lastSeenHost"`
	LastSeenAt         *time.Time `json:"lastSeenAt"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

// Patch holds the fields a PATCH request may change; nil means "leave as is".
type Patch struct {
	Name               *string   `json:"name"`
	AllowedDomains     *[]string `json:"allowedDomains"`
	Color              *string   `json:"color"`
	Position           *string   `json:"position"`
	Greeting           *string   `json:"greeting"`
	SuggestedQuestions *[]string `json:"suggestedQuestions"`
	ShowBadge          *bool     `json:"showBadge"`
}

const (
	maxNameLen      = 80
	maxGreetingLen  = 280
	maxSuggestions  = 5
	maxQuestionLen  = 120
	maxDomains      = 20
	publicKeyPrefix = "pub_"
)

var colorRe = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

// apply validates p and writes it onto b.
func (p Patch) apply(b *Bot) error {
	if p.Name != nil {
		name, err := cleanName(*p.Name)
		if err != nil {
			return err
		}
		b.Name = name
	}
	if p.Color != nil {
		if !colorRe.MatchString(*p.Color) {
			return apperr.BadRequest("Pick a color like #2F6B4F.")
		}
		b.Color = strings.ToUpper(*p.Color)
	}
	if p.Position != nil {
		if *p.Position != "left" && *p.Position != "right" {
			return apperr.BadRequest("Position must be left or right.")
		}
		b.Position = *p.Position
	}
	if p.Greeting != nil {
		greeting, err := validate.Text(*p.Greeting, 1, maxGreetingLen,
			"Keep the hello message between 1 and 280 characters.")
		if err != nil {
			return err
		}
		b.Greeting = greeting
	}
	if p.SuggestedQuestions != nil {
		questions, err := cleanQuestions(*p.SuggestedQuestions)
		if err != nil {
			return err
		}
		b.SuggestedQuestions = questions
	}
	if p.AllowedDomains != nil {
		domains, err := cleanDomains(*p.AllowedDomains)
		if err != nil {
			return err
		}
		b.AllowedDomains = domains
	}
	if p.ShowBadge != nil {
		b.ShowBadge = *p.ShowBadge
	}
	return nil
}

func cleanName(name string) (string, error) {
	return validate.Text(name, 1, maxNameLen, "Give your bot a name up to 80 characters.")
}

func cleanQuestions(in []string) ([]string, error) {
	out := make([]string, 0, len(in))
	for _, q := range in {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}
		if utf8.RuneCountInString(q) > maxQuestionLen {
			return nil, apperr.BadRequest("Keep each suggested question under %d characters.", maxQuestionLen)
		}
		out = append(out, q)
	}
	if len(out) > maxSuggestions {
		return nil, apperr.BadRequest("Add up to %d suggested questions.", maxSuggestions)
	}
	return out, nil
}

// cleanDomains turns entries like "https://Shop.Example.com/path" into "shop.example.com",
// drops duplicates and rejects anything that isn't a hostname.
func cleanDomains(in []string) ([]string, error) {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, raw := range in {
		host, err := normalizeHost(raw)
		if err != nil {
			return nil, err
		}
		if host == "" || seen[host] {
			continue
		}
		seen[host] = true
		out = append(out, host)
	}
	if len(out) > maxDomains {
		return nil, apperr.BadRequest("Add up to %d websites.", maxDomains)
	}
	return out, nil
}

var hostRe = regexp.MustCompile(`^(localhost|([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})$`)

func normalizeHost(raw string) (string, error) {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return "", nil
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || !hostRe.MatchString(u.Hostname()) {
		return "", apperr.BadRequest("%q doesn't look like a website address.", strings.TrimPrefix(raw, "https://"))
	}
	return u.Hostname(), nil
}

// newPublicKey returns the id used in the embed code. It is public by design:
// allowed domains and rate limits protect the bot, not the secrecy of the key.
func newPublicKey() string {
	b := make([]byte, 18)
	_, _ = rand.Read(b) // never fails; it crashes the program instead
	return publicKeyPrefix + base64.RawURLEncoding.EncodeToString(b)
}

var errBotNotFound = apperr.NotFound("Bot not found.")
