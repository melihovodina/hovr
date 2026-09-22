// Package inbox shows what the bot couldn't answer and who left an email, so the
// owner can teach the bot and reply to visitors.
package inbox

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var (
	errBotNotFound  = apperr.NotFound("Bot not found.")
	errItemNotFound = apperr.NotFound("Question not found.")
)

// Item is a question the bot couldn't answer, grouped over everyone who asked it.
type Item struct {
	ID                 string    `json:"id"`
	Question           string    `json:"question"`
	TimesAsked         int       `json:"timesAsked"`
	Status             string    `json:"status"`
	LastConversationID *string   `json:"lastConversationId"`
	VisitorEmail       *string   `json:"visitorEmail"` // if that visitor left one
	AnswerSourceID     *string   `json:"answerSourceId"`
	LastAskedAt        time.Time `json:"lastAskedAt"`
	CreatedAt          time.Time `json:"createdAt"`
}

// Lead is a widget conversation where the visitor left an email.
type Lead struct {
	ConversationID string    `json:"conversationId"`
	Email          string    `json:"email"`
	Question       string    `json:"question"` // the visitor's first message
	Missed         bool      `json:"missed"`   // the bot couldn't answer something
	CreatedAt      time.Time `json:"createdAt"`
	LastMessageAt  time.Time `json:"lastMessageAt"`
}

// Store reads and updates inbox items and leads. Callers check the bot's owner first.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) botPlan(ctx context.Context, accountID, botID string) (plans.Plan, error) {
	var plan plans.Plan
	err := s.db.QueryRow(ctx, `
		select a.plan from bots b join accounts a on a.id = b.account_id
		where b.id = $1 and a.id = $2`, botID, accountID).Scan(&plan)
	return plan, apperr.MapNotFound(err, errBotNotFound)
}

const itemColumns = `i.id, i.question, i.times_asked, i.status, i.last_conversation_id,
	(select c.visitor_email from conversations c where c.id = i.last_conversation_id),
	i.answer_source_id, i.last_asked_at, i.created_at`

func scanItem(row pgx.CollectableRow) (Item, error) {
	var i Item
	err := row.Scan(&i.ID, &i.Question, &i.TimesAsked, &i.Status, &i.LastConversationID,
		&i.VisitorEmail, &i.AnswerSourceID, &i.LastAskedAt, &i.CreatedAt)
	return i, err
}

// List returns items with the status, most recently asked first; days = 0 means no window.
func (s *Store) List(ctx context.Context, botID, status string, days int) ([]Item, error) {
	rows, err := s.db.Query(ctx, `
		select `+itemColumns+` from inbox_items i
		where i.bot_id = $1 and i.status = $2 and ($3 = 0 or i.last_asked_at > now() - make_interval(days => $3))
		order by i.last_asked_at desc limit 500`, botID, status, days)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanItem)
}

func (s *Store) Get(ctx context.Context, botID, id string, days int) (*Item, error) {
	rows, err := s.db.Query(ctx, `
		select `+itemColumns+` from inbox_items i
		where i.id = $1 and i.bot_id = $2 and ($3 = 0 or i.last_asked_at > now() - make_interval(days => $3))`,
		id, botID, days)
	if err != nil {
		return nil, err
	}
	item, err := pgx.CollectExactlyOneRow(rows, scanItem)
	if err != nil {
		return nil, apperr.MapNotFound(err, errItemNotFound)
	}
	return &item, nil
}

// SetStatus marks an item done (with the source that answers it) or open again.
func (s *Store) SetStatus(ctx context.Context, botID, id, status string, sourceID *string) (*Item, error) {
	rows, err := s.db.Query(ctx, `
		update inbox_items i set status = $3, answer_source_id = coalesce($4, i.answer_source_id)
		where i.id = $1 and i.bot_id = $2 returning `+itemColumns, id, botID, status, sourceID)
	if err != nil {
		return nil, err
	}
	item, err := pgx.CollectExactlyOneRow(rows, scanItem)
	if err != nil {
		return nil, apperr.MapNotFound(err, errItemNotFound)
	}
	return &item, nil
}

// Leads returns visitors who left an email, newest first.
func (s *Store) Leads(ctx context.Context, botID string, days int) ([]Lead, error) {
	rows, err := s.db.Query(ctx, `
		select c.id, c.visitor_email,
			coalesce((select m.content from messages m where m.conversation_id = c.id and m.role = 'user'
				order by m.id limit 1), ''),
			exists (select 1 from messages m where m.conversation_id = c.id and m.answered = false),
			c.created_at, c.last_message_at
		from conversations c
		where c.bot_id = $1 and c.visitor_email is not null
			and ($2 = 0 or c.created_at > now() - make_interval(days => $2))
		order by c.created_at desc limit 1000`, botID, days)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Lead, error) {
		var l Lead
		err := row.Scan(&l.ConversationID, &l.Email, &l.Question, &l.Missed, &l.CreatedAt, &l.LastMessageAt)
		return l, err
	})
}
