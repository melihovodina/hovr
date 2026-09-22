// Package overview computes the bot's dashboard numbers from widget conversations.
package overview

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/bots"
)

// Totals are the counts for one period.
type Totals struct {
	Questions     int      `json:"questions"`
	Answered      int      `json:"answered"`
	Missed        int      `json:"missed"`
	AnsweredRate  *float64 `json:"answeredRate"` // null when there was nothing to answer
	Conversations int      `json:"conversations"`
	Leads         int      `json:"leads"`
}

// Day is one point of the answered vs missed chart.
type Day struct {
	Date     string `json:"date"` // YYYY-MM-DD in the requested timezone
	Answered int    `json:"answered"`
	Missed   int    `json:"missed"`
}

// TopQuestion is a question visitors asked, grouped by its normalized text.
type TopQuestion struct {
	Question string `json:"question"`
	Count    int    `json:"count"`
}

// OpenItem is an unanswered question waiting in the inbox.
type OpenItem struct {
	ID          string    `json:"id"`
	Question    string    `json:"question"`
	TimesAsked  int       `json:"timesAsked"`
	LastAskedAt time.Time `json:"lastAskedAt"`
}

type Store struct {
	db     *pgxpool.Pool
	access *bots.Access
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db, access: bots.NewAccess(db)}
}

// totals counts the current period [start, end) and the previous one [prevStart, start).
func (s *Store) totals(ctx context.Context, botID string, prevStart, start, end time.Time) (cur, prev Totals, err error) {
	err = s.db.QueryRow(ctx, `
		select
			count(*) filter (where m.role = 'user' and m.created_at >= $3),
			count(*) filter (where m.answered and m.created_at >= $3),
			count(*) filter (where not m.answered and m.created_at >= $3),
			count(*) filter (where m.role = 'user' and m.created_at < $3),
			count(*) filter (where m.answered and m.created_at < $3),
			count(*) filter (where not m.answered and m.created_at < $3)
		from messages m join conversations c on c.id = m.conversation_id
		where c.bot_id = $1 and c.channel = 'widget' and m.created_at >= $2 and m.created_at < $4`,
		botID, prevStart, start, end).Scan(&cur.Questions, &cur.Answered, &cur.Missed,
		&prev.Questions, &prev.Answered, &prev.Missed)
	if err != nil {
		return cur, prev, err
	}
	err = s.db.QueryRow(ctx, `
		select
			count(*) filter (where created_at >= $3),
			count(*) filter (where created_at >= $3 and visitor_email is not null),
			count(*) filter (where created_at < $3),
			count(*) filter (where created_at < $3 and visitor_email is not null)
		from conversations
		where bot_id = $1 and channel = 'widget' and created_at >= $2 and created_at < $4`,
		botID, prevStart, start, end).Scan(&cur.Conversations, &cur.Leads, &prev.Conversations, &prev.Leads)
	return cur, prev, err
}

// daily returns answered and missed counts per day that has any.
func (s *Store) daily(ctx context.Context, botID string, start, end time.Time, tz string) (map[string]Day, error) {
	rows, err := s.db.Query(ctx, `
		select to_char(m.created_at at time zone $4, 'YYYY-MM-DD') as day,
			count(*) filter (where m.answered), count(*) filter (where not m.answered)
		from messages m join conversations c on c.id = m.conversation_id
		where c.bot_id = $1 and c.channel = 'widget' and m.role = 'assistant'
			and m.created_at >= $2 and m.created_at < $3
		group by day`, botID, start, end, tz)
	if err != nil {
		return nil, err
	}
	days, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Day, error) {
		var d Day
		err := row.Scan(&d.Date, &d.Answered, &d.Missed)
		return d, err
	})
	out := make(map[string]Day, len(days))
	for _, d := range days {
		out[d.Date] = d
	}
	return out, err
}

// topQuestions groups visitors' questions like the inbox does: case, spaces and
// trailing punctuation don't matter.
func (s *Store) topQuestions(ctx context.Context, botID string, start, end time.Time, limit int) ([]TopQuestion, error) {
	rows, err := s.db.Query(ctx, `
		select (array_agg(m.content order by m.id desc))[1], count(*)
		from messages m join conversations c on c.id = m.conversation_id
		where c.bot_id = $1 and c.channel = 'widget' and m.role = 'user'
			and m.created_at >= $2 and m.created_at < $3
		group by lower(regexp_replace(regexp_replace(trim(m.content), '\s+', ' ', 'g'), '[[:punct:][:space:]]+$', ''))
		order by count(*) desc, max(m.id) desc
		limit $4`, botID, start, end, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (TopQuestion, error) {
		var q TopQuestion
		err := row.Scan(&q.Question, &q.Count)
		return q, err
	})
}

// openItems returns how many inbox items are open and the most asked of them.
func (s *Store) openItems(ctx context.Context, botID string, days, limit int) (int, []OpenItem, error) {
	const window = `bot_id = $1 and status = 'open' and ($2 = 0 or last_asked_at > now() - make_interval(days => $2))`
	var total int
	if err := s.db.QueryRow(ctx, `select count(*) from inbox_items where `+window, botID, days).Scan(&total); err != nil {
		return 0, nil, err
	}
	rows, err := s.db.Query(ctx, `
		select id, question, times_asked, last_asked_at from inbox_items where `+window+`
		order by times_asked desc, last_asked_at desc limit $3`, botID, days, limit)
	if err != nil {
		return 0, nil, err
	}
	items, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (OpenItem, error) {
		var i OpenItem
		err := row.Scan(&i.ID, &i.Question, &i.TimesAsked, &i.LastAskedAt)
		return i, err
	})
	return total, items, err
}
