// Package chat serves conversations with a bot: answers streamed over SSE, saved
// messages and history.
package chat

import (
	"time"
	"unicode/utf8"

	"github.com/melihovodina/hovr/server/internal/rag"
)

const (
	channelPlayground = "playground"
	roleUser          = "user"
	roleAssistant     = "assistant"

	maxMessageLength = 2000
	// historyTurns is how many earlier messages the model sees.
	historyTurns = 10
	maxTitle     = 80
)

// Conversation is one chat thread as listed in the app.
type Conversation struct {
	ID            string    `json:"id"`
	Channel       string    `json:"channel"`
	Title         string    `json:"title"`
	VisitorEmail  *string   `json:"visitorEmail"`
	Messages      int       `json:"messages"`
	CreatedAt     time.Time `json:"createdAt"`
	LastMessageAt time.Time `json:"lastMessageAt"`
}

// Message is a saved chat message; Answered is set on assistant messages only.
type Message struct {
	ID        int64          `json:"id"`
	Role      string         `json:"role"`
	Content   string         `json:"content"`
	Citations []rag.Citation `json:"citations"`
	Answered  *bool          `json:"answered"`
	CreatedAt time.Time      `json:"createdAt"`
}

// titleFrom shortens the first message into a conversation title.
func titleFrom(message string) string {
	if utf8.RuneCountInString(message) <= maxTitle {
		return message
	}
	r := []rune(message)
	return string(r[:maxTitle-1]) + "…"
}
