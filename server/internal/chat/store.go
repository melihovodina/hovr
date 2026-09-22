package chat

import (
	"context"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/bots"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/internal/usage"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var errConversationNotFound = apperr.NotFound("Conversation not found.")

// Store reads and writes conversations. Queries are scoped to the owning account.
type Store struct {
	db     *pgxpool.Pool
	access *bots.Access
	usage  *usage.Counters
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db, access: bots.NewAccess(db), usage: usage.New(db)}
}

// bot is the owner check every chat request starts with.
func (s *Store) bot(ctx context.Context, accountID, botID string) (bots.Owned, error) {
	return s.access.Bot(ctx, accountID, botID)
}

func (s *Store) startConversation(ctx context.Context, botID, channel, visitorID, title string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		insert into conversations (bot_id, channel, visitor_id, title) values ($1, $2, nullif($3, ''), $4) returning id`,
		botID, channel, visitorID, title).Scan(&id)
	return id, apperr.Map(err)
}

// history returns the last n messages of the conversation, oldest first.
func (s *Store) history(ctx context.Context, conversationID string, n int) ([]ai.Turn, error) {
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
	messages, err := s.messages(ctx, id)
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

// visitorConversation returns a widget conversation of this visitor.
func (s *Store) visitorConversation(ctx context.Context, botID, visitorID, id string) (*Conversation, error) {
	return scanConversation(s.db.QueryRow(ctx, `
		select `+conversationColumns+` from conversations c
		where c.id = $1 and c.bot_id = $2 and c.channel = 'widget' and c.visitor_id = $3`, id, botID, visitorID))
}

func (s *Store) messages(ctx context.Context, conversationID string) ([]Message, error) {
	rows, err := s.db.Query(ctx, `
		select id, role, content, citations, answered, created_at from messages
		where conversation_id = $1 order by id`, conversationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Message, error) {
		var m Message
		err := row.Scan(&m.ID, &m.Role, &m.Content, &m.Citations, &m.Answered, &m.CreatedAt)
		return m, err
	})
}

// recordUnanswered adds the question to the inbox, grouping repeats of the same text.
func (s *Store) recordUnanswered(ctx context.Context, botID, conversationID, question string) error {
	_, err := s.db.Exec(ctx, `
		insert into inbox_items (bot_id, question, normalized, last_conversation_id) values ($1, $2, $3, $4)
		on conflict (bot_id, normalized) do update set
			question = excluded.question,
			times_asked = inbox_items.times_asked + 1,
			last_conversation_id = excluded.last_conversation_id,
			last_asked_at = now(),
			status = 'open'`, botID, question, normalizeQuestion(question), conversationID)
	return err
}

// setVisitorEmail stores the email a visitor left in their conversation.
func (s *Store) setVisitorEmail(ctx context.Context, botID, visitorID, id, email string) error {
	tag, err := s.db.Exec(ctx, `
		update conversations set visitor_email = $4
		where id = $1 and bot_id = $2 and channel = 'widget' and visitor_id = $3`, id, botID, visitorID, email)
	if err != nil {
		return apperr.Map(err)
	}
	if tag.RowsAffected() == 0 {
		return errConversationNotFound
	}
	return nil
}
