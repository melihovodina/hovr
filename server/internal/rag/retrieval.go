// Package rag answers questions from a bot's knowledge.
package rag

import (
	"context"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/melihovodina/hovr/server/internal/ai"
)

const (
	// DefaultLimit is how many chunks a question is answered from.
	DefaultLimit = 5

	// MinScore filters off-topic questions; calibrated in calibrate_test.go.
	MinScore = 0.59
)

// Relevant reports whether the best match reaches MinScore.
func Relevant(matches []Match) bool {
	return len(matches) > 0 && matches[0].Score >= MinScore
}

// Match is a chunk with its cosine similarity to the question.
type Match struct {
	SourceID    string  `json:"sourceId"`
	SourceTitle string  `json:"sourceTitle"`
	ChunkIndex  int     `json:"chunkIndex"`
	Content     string  `json:"content"`
	Score       float64 `json:"score"`
}

// Retriever embeds questions and searches the chunks table.
type Retriever struct {
	db       *pgxpool.Pool
	embedder ai.Embedder
}

func New(db *pgxpool.Pool, embedder ai.Embedder) *Retriever {
	return &Retriever{db: db, embedder: embedder}
}

// Search returns up to limit chunks of the bot's ready sources, best match first.
func (r *Retriever) Search(ctx context.Context, botID, question string, limit int) ([]Match, error) {
	vec, err := r.embedder.EmbedQuery(ctx, question)
	if err != nil {
		return nil, fmt.Errorf("embed question: %w", err)
	}
	return r.searchVector(ctx, botID, vec, limit)
}

func (r *Retriever) searchVector(ctx context.Context, botID string, vec []float32, limit int) ([]Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Keep scanning the shared index until enough rows pass the bot filter.
	// relaxed_order may be slightly unsorted, so we sort below.
	if _, err := tx.Exec(ctx, `set local hnsw.iterative_scan = relaxed_order`); err != nil {
		return nil, fmt.Errorf("enable iterative scan: %w", err)
	}
	rows, err := tx.Query(ctx, `
		select c.source_id, s.title, c.chunk_index, c.content, 1 - (c.embedding <=> $2) as score
		from chunks c
		join sources s on s.id = c.source_id
		where c.bot_id = $1 and s.status = 'ready'
		order by c.embedding <=> $2
		limit $3`, botID, pgvector.NewVector(vec), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := []Match{}
	for rows.Next() {
		var m Match
		if err := rows.Scan(&m.SourceID, &m.SourceTitle, &m.ChunkIndex, &m.Content, &m.Score); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(matches, func(i, j int) bool { return matches[i].Score > matches[j].Score })
	return matches, nil
}
