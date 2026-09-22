package chat

import (
	"context"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
	"github.com/melihovodina/hovr/server/pkg/validate"
)

// Channels of a conversation.
const (
	ChannelPlayground = "playground"
	ChannelWidget     = "widget"
)

// Request is one message to answer. Playground requests carry AccountID, widget
// requests VisitorID; either one owns the conversation.
type Request struct {
	BotID          string
	BotName        string
	Plan           plans.Plan
	AccountID      string
	Channel        string
	VisitorID      string
	ConversationID string // empty starts a new conversation
	Message        string
}

// Service answers messages for the app and the widget.
type Service struct {
	store    *Store
	answerer *rag.Answerer
}

func NewService(store *Store, answerer *rag.Answerer) *Service {
	return &Service{store: store, answerer: answerer}
}

// Respond answers over SSE: "conversation" {id}, "text" {text}... then "done"
// {message} or "error" {error}. Refusals before streaming are plain JSON errors.
func (s *Service) Respond(c *gin.Context, r Request) {
	message, err := validate.Text(r.Message, 1, maxMessageLength, "Messages can be 1 to 2000 characters.")
	if err != nil {
		httpx.Write(c, err)
		return
	}
	ctx := c.Request.Context()
	var history []ai.Turn
	if r.ConversationID != "" {
		if err := s.checkOwner(ctx, r); err != nil {
			httpx.Write(c, err)
			return
		}
		if history, err = s.store.history(ctx, r.ConversationID, historyTurns); err != nil {
			httpx.Write(c, err)
			return
		}
	}
	// Playground chats are free; only visitors' messages count.
	counted := r.Channel == ChannelWidget
	if counted {
		if err := s.store.countMessage(ctx, r.AccountID, r.Plan); err != nil {
			httpx.Write(c, err)
			return
		}
	}
	conversationID := r.ConversationID
	if conversationID == "" {
		if conversationID, err = s.store.startConversation(ctx, r.BotID, r.Channel, r.VisitorID, titleFrom(message)); err != nil {
			s.refund(ctx, counted, r.AccountID)
			httpx.Write(c, err)
			return
		}
	}
	if _, err := s.store.addMessage(ctx, conversationID, roleUser, message, nil, nil); err != nil {
		s.refund(ctx, counted, r.AccountID)
		httpx.Write(c, err)
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no") // proxies must not buffer the stream
	send := func(event string, data any) error {
		c.SSEvent(event, data)
		c.Writer.Flush()
		return ctx.Err()
	}
	_ = send("conversation", gin.H{"id": conversationID})

	// Work that must finish even if the visitor leaves mid-stream.
	bg := context.WithoutCancel(ctx)
	answer, err := s.answerer.Answer(ctx, rag.Question{
		BotID: r.BotID, BotName: r.BotName, Message: message, History: history,
	}, func(text string) error { return send("text", gin.H{"text": text}) })
	if err != nil {
		s.refund(bg, counted, r.AccountID)
		if ctx.Err() == nil {
			slog.Error("answer failed", "bot", r.BotID, "err", err)
			_ = send("error", gin.H{"error": "The bot couldn't answer right now. Try again in a moment."})
		}
		return
	}
	saved, err := s.store.addMessage(bg, conversationID, roleAssistant, answer.Text, answer.Citations, &answer.Answered)
	if err != nil {
		slog.Error("save answer", "conversation", conversationID, "err", err)
		_ = send("error", gin.H{"error": "Something went wrong. Try again."})
		return
	}
	if !answer.Answered && r.Channel == ChannelWidget {
		if err := s.store.recordUnanswered(bg, r.BotID, conversationID, message); err != nil {
			slog.Error("record unanswered", "bot", r.BotID, "err", err)
		}
	}
	_ = send("done", gin.H{"message": saved})
}

// refund gives back a counted message when the question never got an answer.
func (s *Service) refund(ctx context.Context, counted bool, accountID string) {
	if !counted {
		return
	}
	if err := s.store.refundMessage(context.WithoutCancel(ctx), accountID); err != nil {
		slog.Error("refund message", "account", accountID, "err", err)
	}
}

func (s *Service) checkOwner(ctx context.Context, r Request) error {
	if !httpx.IsUUID(r.ConversationID) {
		return errConversationNotFound
	}
	if r.Channel == ChannelWidget {
		_, err := s.store.visitorConversation(ctx, r.BotID, r.VisitorID, r.ConversationID)
		return err
	}
	_, err := s.store.conversation(ctx, r.AccountID, r.BotID, r.ConversationID)
	return err
}

// VisitorMessages returns a visitor's widget conversation, to restore it after a reload.
func (s *Service) VisitorMessages(ctx context.Context, botID, visitorID, conversationID string) ([]Message, error) {
	if !httpx.IsUUID(conversationID) {
		return nil, errConversationNotFound
	}
	if _, err := s.store.visitorConversation(ctx, botID, visitorID, conversationID); err != nil {
		return nil, err
	}
	return s.store.messages(ctx, conversationID)
}

// SaveLead stores the email a visitor left so the team can get back to them.
func (s *Service) SaveLead(ctx context.Context, botID, visitorID, conversationID, email string) error {
	if !httpx.IsUUID(conversationID) {
		return errConversationNotFound
	}
	email, ok := validate.Email(email)
	if !ok || len(email) > 254 {
		return apperr.BadRequest("Enter a valid email address.")
	}
	return s.store.setVisitorEmail(ctx, botID, visitorID, conversationID, email)
}
