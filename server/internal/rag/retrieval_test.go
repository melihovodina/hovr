package rag

import (
	"context"
	"crypto/rand"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

func newBot(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	account := testdb.NewUser(t, pool, plans.Free)
	var bot string
	err := pool.QueryRow(context.Background(),
		`insert into bots (account_id, name, public_key) values ($1, 'Test bot', $2) returning id`,
		account, "pub_"+rand.Text()).Scan(&bot)
	if err != nil {
		t.Fatalf("create bot: %v", err)
	}
	return bot
}

// addSource inserts a source with one chunk per text.
func addSource(t *testing.T, pool *pgxpool.Pool, bot, title, status string, texts ...string) {
	t.Helper()
	ctx := context.Background()
	var source string
	err := pool.QueryRow(ctx,
		`insert into sources (bot_id, type, title, status) values ($1, 'text', $2, $3) returning id`,
		bot, title, status).Scan(&source)
	if err != nil {
		t.Fatalf("create source: %v", err)
	}
	vecs, _ := ai.Mock{}.EmbedDocuments(ctx, texts)
	for i, text := range texts {
		_, err := pool.Exec(ctx,
			`insert into chunks (source_id, bot_id, chunk_index, content, embedding) values ($1, $2, $3, $4, $5)`,
			source, bot, i, text, pgvector.NewVector(vecs[i]))
		if err != nil {
			t.Fatalf("insert chunk: %v", err)
		}
	}
}

func TestSearch(t *testing.T) {
	pool := testdb.Connect(t)
	r := New(pool, ai.Mock{})
	ctx := context.Background()

	bot, other := newBot(t, pool), newBot(t, pool)
	addSource(t, pool, bot, "Shipping", "ready",
		"We ship to Canada and the UK.", "Orders to Canada arrive in 5 to 8 days.")
	addSource(t, pool, bot, "Payments", "ready", "We accept Visa and PayPal.")
	addSource(t, pool, bot, "Draft", "processing", "We ship to Canada for free.") // not ready yet
	addSource(t, pool, other, "Other bot", "ready", "We ship to Canada overnight.")

	matches, err := r.Search(ctx, bot, "do you ship to Canada", DefaultLimit)
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 3 {
		t.Fatalf("got %d matches, want the bot's 3 ready chunks: %+v", len(matches), matches)
	}
	if matches[0].SourceTitle != "Shipping" || matches[0].Content != "We ship to Canada and the UK." {
		t.Errorf("best match = %+v, want the shipping chunk", matches[0])
	}
	for i, m := range matches {
		if m.SourceTitle == "Draft" || m.SourceTitle == "Other bot" {
			t.Errorf("match %d comes from %q", i, m.SourceTitle)
		}
		if i > 0 && m.Score > matches[i-1].Score {
			t.Errorf("matches not sorted by score at %d", i)
		}
	}

	if limited, _ := r.Search(ctx, bot, "Canada", 1); len(limited) != 1 {
		t.Errorf("limit 1 returned %d matches", len(limited))
	}
	if none, err := r.Search(ctx, newBot(t, pool), "anything", DefaultLimit); err != nil || len(none) != 0 {
		t.Errorf("bot without knowledge: %d matches, %v", len(none), err)
	}
}

func TestRelevant(t *testing.T) {
	cases := []struct {
		matches []Match
		want    bool
	}{
		{nil, false},
		{[]Match{{Score: MinScore - 0.01}}, false},
		{[]Match{{Score: MinScore}}, true},
		{[]Match{{Score: 0.8}, {Score: 0.2}}, true},
	}
	for _, tc := range cases {
		if got := Relevant(tc.matches); got != tc.want {
			t.Errorf("Relevant(%v) = %v, want %v", tc.matches, got, tc.want)
		}
	}
}
