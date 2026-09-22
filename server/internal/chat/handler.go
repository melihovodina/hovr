package chat

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

// Handler serves /api/bots/:id/chat and /conversations. It must be mounted behind auth.RequireUser.
type Handler struct {
	store   *Store
	service *Service
}

func NewHandler(store *Store, service *Service) *Handler {
	return &Handler{store: store, service: service}
}

// Routes registers the chat endpoints on g (mounted at /api/bots/:id).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.POST("/chat", h.chat)
	g.GET("/conversations", h.list)
	g.GET("/conversations/:conversationId", h.get)
	g.DELETE("/conversations/:conversationId", h.delete)
}

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
	accountID := auth.UserID(c)
	bot, err := h.store.bot(c.Request.Context(), accountID, botID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	h.service.Respond(c, Request{
		BotID: botID, BotName: bot.Name, Plan: bot.Plan, AccountID: accountID,
		Channel: ChannelPlayground, ConversationID: in.ConversationID, Message: in.Message,
	})
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
