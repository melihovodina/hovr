package widget

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var errBotNotFound = apperr.NotFound("This chat isn't available.")

// Config is what the widget needs to draw itself.
type Config struct {
	Name                string   `json:"name"`
	Color               string   `json:"color"`
	ChatBackground      *string  `json:"chatBackground"`
	VisitorMessageColor *string  `json:"visitorMessageColor"`
	BotMessageColor     *string  `json:"botMessageColor"`
	AvatarURL           *string  `json:"avatarUrl"`
	Position            string   `json:"position"`
	Greeting            string   `json:"greeting"`
	SuggestedQuestions  []string `json:"suggestedQuestions"`
	ShowBadge           bool     `json:"showBadge"`
}

type bot struct {
	ID             string
	AccountID      string
	Plan           plans.Plan
	AllowedDomains []string
	Config
}

// Store reads bots by their public key; nothing here is scoped to a signed-in user.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) bot(ctx context.Context, publicKey string) (*bot, error) {
	var b bot
	err := s.db.QueryRow(ctx, `
		select b.id, b.account_id, a.plan, b.allowed_domains, b.name, b.color,
			b.chat_background, b.visitor_message_color, b.bot_message_color, b.avatar_url, b.position,
			b.greeting, b.suggested_questions, b.show_badge
		from bots b join accounts a on a.id = b.account_id
		where b.public_key = $1`, publicKey).Scan(&b.ID, &b.AccountID, &b.Plan, &b.AllowedDomains,
		&b.Name, &b.Color, &b.ChatBackground, &b.VisitorMessageColor, &b.BotMessageColor,
		&b.AvatarURL, &b.Position, &b.Greeting, &b.SuggestedQuestions, &b.ShowBadge)
	if err != nil {
		return nil, apperr.MapNotFound(err, errBotNotFound)
	}
	// A downgraded plan brings the badge back even if it was hidden before.
	if !plans.For(b.Plan).RemoveBadge {
		b.ShowBadge = true
	}
	return &b, nil
}

// touchLastSeen records the site the widget was last opened on, at most every few minutes.
func (s *Store) touchLastSeen(ctx context.Context, botID, host string) error {
	_, err := s.db.Exec(ctx, `
		update bots set last_seen_host = $2, last_seen_at = now()
		where id = $1 and (last_seen_host is distinct from $2 or last_seen_at < now() - interval '5 minutes')`,
		botID, host)
	return err
}
