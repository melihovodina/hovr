package chat

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var (
	errBotNotFound          = apperr.NotFound("Bot not found.")
	errConversationNotFound = apperr.NotFound("Conversation not found.")
)

// Store reads and writes conversations. Queries are scoped to the owning account.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

type botInfo struct {
	Name string
	Plan plans.Plan
}

func (s *Store) bot(ctx context.Context, accountID, botID string) (botInfo, error) {
	var b botInfo
	err := s.db.QueryRow(ctx, `
		select b.name, a.plan from bots b join accounts a on a.id = b.account_id
		where b.id = $1 and a.id = $2`, botID, accountID).Scan(&b.Name, &b.Plan)
	return b, apperr.MapNotFound(err, errBotNotFound)
}

// countMessage adds one to this month's usage, or refuses when the plan's limit is reached.
func (s *Store) countMessage(ctx context.Context, accountID string, plan plans.Plan) error {
	limit := plans.For(plan).MessagesPerMonth
	var n int
	err := s.db.QueryRow(ctx, `
		insert into usage_counters (account_id, period, messages) values ($1, $2, 1)
		on conflict (account_id, period) do update set messages = usage_counters.messages + 1
		where usage_counters.messages < $3
		returning messages`, accountID, period(), limit).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.UpgradeRequired(fmt.Sprintf(
			"You've used all %d messages of the %s plan this month. Upgrade to keep chatting.", limit, plan.Name()))
	}
	return err
}

func (s *Store) refundMessage(ctx context.Context, accountID string) error {
	_, err := s.db.Exec(ctx, `
		update usage_counters set messages = messages - 1
		where account_id = $1 and period = $2 and messages > 0`, accountID, period())
	return err
}

// period is the usage month, "YYYY-MM" in UTC.
func period() string {
	return time.Now().UTC().Format("2006-01")
}

func (s *Store) startConversation(ctx context.Context, botID, channel, title string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		insert into conversations (bot_id, channel, title) values ($1, $2, $3) returning id`,
		botID, channel, title).Scan(&id)
	return id, apperr.Map(err)
}

// history returns the last n messages of the conversation, oldest first.
func (s *Store) history(ctx context.Context, accountID, botID, conversationID string, n int) ([]ai.Turn, error) {
	if _, err := s.conversation(ctx, accountID, botID, conversationID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		select role, content from messages where conversation_id = $1 order by id desc limit $2`,
		conversationID, n)
	if err != nil {
		return nil, err
	}
	turns, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (ai.Turn, error) {
		var t ai.Turn
		err := row.Scan(&t.Role, &t.Text)
		if t.Role == roleAssistant {
			t.Role = ai.RoleModel
		}
		return t, err
	})
	slices.Reverse(turns)
	return turns, err
}

// addMessage stores a message and moves the conversation to the top of the list.
func (s *Store) addMessage(ctx context.Context, conversationID, role, content string,
	citations []rag.Citation, answered *bool) (*Message, error) {
	if citations == nil {
		citations = []rag.Citation{}
	}
	m := Message{Role: role, Content: content, Citations: citations, Answered: answered}
	err := s.db.QueryRow(ctx, `
		with m as (
			insert into messages (conversation_id, role, content, citations, answered)
			values ($1, $2, $3, $4, $5) returning id, created_at
		), c as (
			update conversations set last_message_at = now() where id = $1
		)
		select id, created_at from m`, conversationID, role, content, citations, answered).Scan(&m.ID, &m.CreatedAt)
	if err != nil {
		return nil, apperr.Map(err)
	}
	return &m, nil
}

const conversationColumns = `c.id, c.channel, coalesce(c.title, ''), c.visitor_email,
	(select count(*) from messages m where m.conversation_id = c.id), c.created_at, c.last_message_at`

func scanConversation(row pgx.Row) (*Conversation, error) {
	var c Conversation
	err := row.Scan(&c.ID, &c.Channel, &c.Title, &c.VisitorEmail, &c.Messages, &c.CreatedAt, &c.LastMessageAt)
	if err != nil {
		return nil, apperr.MapNotFound(err, errConversationNotFound)
	}
	return &c, nil
}

func (s *Store) conversation(ctx context.Context, accountID, botID, id string) (*Conversation, error) {
	return scanConversation(s.db.QueryRow(ctx, `
		select `+conversationColumns+` from conversations c join bots b on b.id = c.bot_id
		where c.id = $1 and c.bot_id = $2 and b.account_id = $3`, id, botID, accountID))
}

// List returns the bot's conversations, most recent first.
func (s *Store) List(ctx context.Context, accountID, botID string) ([]Conversation, error) {
	if _, err := s.bot(ctx, accountID, botID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		select `+conversationColumns+` from conversations c
		where c.bot_id = $1 order by c.last_message_at desc limit 200`, botID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Conversation, error) {
		c, err := scanConversation(row)
		if err != nil {
			return Conversation{}, err
		}
		return *c, nil
	})
}

// Messages returns a conversation with all its messages.
func (s *Store) Messages(ctx context.Context, accountID, botID, id string) (*Conversation, []Message, error) {
	c, err := s.conversation(ctx, accountID, botID, id)
	if err != nil {
		return nil, nil, err
	}
	rows, err := s.db.Query(ctx, `
		select id, role, content, citations, answered, created_at from messages
		where conversation_id = $1 order by id`, id)
	if err != nil {
		return nil, nil, err
	}
	messages, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Message, error) {
		var m Message
		err := row.Scan(&m.ID, &m.Role, &m.Content, &m.Citations, &m.Answered, &m.CreatedAt)
		return m, err
	})
	return c, messages, err
}

func (s *Store) Delete(ctx context.Context, accountID, botID, id string) error {
	tag, err := s.db.Exec(ctx, `
		delete from conversations c using bots b
		where c.id = $1 and c.bot_id = $2 and b.id = c.bot_id and b.account_id = $3`, id, botID, accountID)
	if err != nil {
		return apperr.Map(err)
	}
	if tag.RowsAffected() == 0 {
		return errConversationNotFound
	}
	return nil
}
