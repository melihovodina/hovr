package chat

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/pkg/httpx"
	"github.com/melihovodina/hovr/server/pkg/validate"
)

// Handler serves /api/bots/:id/chat and /conversations. It must be mounted behind auth.RequireUser.
type Handler struct {
	store    *Store
	answerer *rag.Answerer
}

func NewHandler(store *Store, answerer *rag.Answerer) *Handler {
	return &Handler{store: store, answerer: answerer}
}

// Routes registers the chat endpoints on g (mounted at /api/bots/:id).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.POST("/chat", h.chat)
	g.GET("/conversations", h.list)
	g.GET("/conversations/:conversationId", h.get)
	g.DELETE("/conversations/:conversationId", h.delete)
}

// chat answers a message over SSE: "conversation" {id}, "text" {text}... then
// "done" {message} or "error" {error}. Refusals before streaming are plain JSON errors.
func (h *Handler) chat(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	var in struct {
		Message        string `json:"message"`
		ConversationID string `json:"conversationId"`
	}
	_ = c.ShouldBindJSON(&in)
	message, err := validate.Text(in.Message, 1, maxMessageLength, "Messages can be 1 to 2000 characters.")
	if err != nil {
		httpx.Write(c, err)
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	bot, err := h.store.bot(ctx, accountID, botID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	var history []ai.Turn
	if in.ConversationID != "" {
		if !httpx.IsUUID(in.ConversationID) {
			httpx.Write(c, errConversationNotFound)
			return
		}
		if history, err = h.store.history(ctx, accountID, botID, in.ConversationID, historyTurns); err != nil {
			httpx.Write(c, err)
			return
		}
	}
	if err := h.store.countMessage(ctx, accountID, bot.Plan); err != nil {
		httpx.Write(c, err)
		return
	}
	conversationID := in.ConversationID
	if conversationID == "" {
		if conversationID, err = h.store.startConversation(ctx, botID, channelPlayground, titleFrom(message)); err != nil {
			httpx.Write(c, err)
			return
		}
	}
	if _, err := h.store.addMessage(ctx, conversationID, roleUser, message, nil, nil); err != nil {
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

	answer, err := h.answerer.Answer(ctx, rag.Question{
		BotID: botID, BotName: bot.Name, Message: message, History: history,
	}, func(text string) error { return send("text", gin.H{"text": text}) })
	if err != nil {
		// No answer, so the message doesn't count.
		if err := h.store.refundMessage(context.WithoutCancel(ctx), accountID); err != nil {
			slog.Error("refund message", "account", accountID, "err", err)
		}
		if ctx.Err() == nil {
			slog.Error("answer failed", "bot", botID, "err", err)
			_ = send("error", gin.H{"error": "The bot couldn't answer right now. Try again in a moment."})
		}
		return
	}
	// Keep the answer even if the visitor left while it was streaming.
	saved, err := h.store.addMessage(context.WithoutCancel(ctx), conversationID, roleAssistant,
		answer.Text, answer.Citations, &answer.Answered)
	if err != nil {
		slog.Error("save answer", "conversation", conversationID, "err", err)
		_ = send("error", gin.H{"error": "Something went wrong. Try again."})
		return
	}
	_ = send("done", gin.H{"message": saved})
}

func (h *Handler) list(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	list, err := h.store.List(c.Request.Context(), auth.UserID(c), botID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": list})
}

func (h *Handler) get(c *gin.Context) {
	botID, id, ok := h.ids(c)
	if !ok {
		return
	}
	conversation, messages, err := h.store.Messages(c.Request.Context(), auth.UserID(c), botID, id)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation": conversation, "messages": messages})
}

func (h *Handler) delete(c *gin.Context) {
	botID, id, ok := h.ids(c)
	if !ok {
		return
	}
	if err := h.store.Delete(c.Request.Context(), auth.UserID(c), botID, id); err != nil {
		httpx.Write(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) ids(c *gin.Context) (botID, id string, ok bool) {
	if botID, ok = httpx.UUIDParam(c, "id", errBotNotFound.Message); !ok {
		return
	}
	id, ok = httpx.UUIDParam(c, "conversationId", errConversationNotFound.Message)
	return
}
