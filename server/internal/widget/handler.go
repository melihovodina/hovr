// Package widget serves the public API of the embeddable chat. Requests come from
// the widget iframe on our own origin; host is the customer's site it is shown on.
package widget

import (
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
	"github.com/melihovodina/hovr/server/pkg/ratelimit"
)

var (
	publicKeyRe = regexp.MustCompile(`^pub_[A-Za-z0-9_-]{8,64}$`)
	visitorRe   = regexp.MustCompile(`^[A-Za-z0-9_-]{8,64}$`)

	errNotAllowed = &apperr.Error{Status: http.StatusForbidden,
		Message: "This chat isn't set up for this website.", Code: "domain_not_allowed"}
	errBadVisitor   = apperr.BadRequest("Missing visitor id.")
	errTooManyCalls = &apperr.Error{Status: http.StatusTooManyRequests,
		Message: "You're sending messages too fast. Wait a moment and try again.", Code: "rate_limited"}
)

// Handler serves /api/widget/:key.
type Handler struct {
	store   *Store
	chat    *chat.Service
	appHost string

	perVisitor *ratelimit.Limiter // messages per IP and bot
	perBot     *ratelimit.Limiter // messages per bot, from everyone
	reads      *ratelimit.Limiter // other calls per IP
}

func NewHandler(store *Store, chat *chat.Service, appURL string) *Handler {
	return &Handler{
		store:      store,
		chat:       chat,
		appHost:    hostOf(appURL),
		perVisitor: ratelimit.New(10, time.Minute),
		perBot:     ratelimit.New(60, time.Minute),
		reads:      ratelimit.New(60, time.Minute),
	}
}

// Routes registers the public widget endpoints on g (mounted at /api/widget/:key).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("/config", h.config)
	g.POST("/chat", h.message)
	g.GET("/conversations/:conversationId", h.conversation)
	g.POST("/lead", h.lead)
}

// load finds the bot and checks the site; it writes the error response itself.
func (h *Handler) load(c *gin.Context, host string) (*bot, bool) {
	key := c.Param("key")
	if !publicKeyRe.MatchString(key) {
		httpx.Write(c, errBotNotFound)
		return nil, false
	}
	b, err := h.store.bot(c.Request.Context(), key)
	if err != nil {
		httpx.Write(c, err)
		return nil, false
	}
	if !allowedOn(hostOf(host), b.AllowedDomains, h.appHost) {
		httpx.Write(c, errNotAllowed)
		return nil, false
	}
	return b, true
}

func (h *Handler) config(c *gin.Context) {
	if !h.reads.Allow(c.ClientIP()) {
		httpx.Write(c, errTooManyCalls)
		return
	}
	host := c.Query("host")
	b, ok := h.load(c, host)
	if !ok {
		return
	}
	if site := hostOf(host); site != "" && site != h.appHost {
		if err := h.store.touchLastSeen(c.Request.Context(), b.ID, site); err != nil {
			slog.Warn("touch last seen", "bot", b.ID, "err", err)
		}
	}
	c.JSON(http.StatusOK, b.Config)
}

func (h *Handler) message(c *gin.Context) {
	var in struct {
		Message        string `json:"message"`
		ConversationID string `json:"conversationId"`
		VisitorID      string `json:"visitorId"`
		Host           string `json:"host"`
	}
	_ = c.ShouldBindJSON(&in)
	if !visitorRe.MatchString(in.VisitorID) {
		httpx.Write(c, errBadVisitor)
		return
	}
	b, ok := h.load(c, in.Host)
	if !ok {
		return
	}
	if !h.perVisitor.Allow(c.ClientIP()+"|"+b.ID) || !h.perBot.Allow(b.ID) {
		httpx.Write(c, errTooManyCalls)
		return
	}
	h.chat.Respond(c, chat.Request{
		BotID: b.ID, BotName: b.Name, Plan: b.Plan, AccountID: b.AccountID, Channel: chat.ChannelWidget,
		VisitorID: in.VisitorID, ConversationID: in.ConversationID, Message: in.Message,
	})
}

func (h *Handler) conversation(c *gin.Context) {
	if !h.reads.Allow(c.ClientIP()) {
		httpx.Write(c, errTooManyCalls)
		return
	}
	visitor := c.Query("visitorId")
	if !visitorRe.MatchString(visitor) {
		httpx.Write(c, errBadVisitor)
		return
	}
	b, ok := h.load(c, c.Query("host"))
	if !ok {
		return
	}
	messages, err := h.chat.VisitorMessages(c.Request.Context(), b.ID, visitor, c.Param("conversationId"))
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (h *Handler) lead(c *gin.Context) {
	if !h.reads.Allow(c.ClientIP()) {
		httpx.Write(c, errTooManyCalls)
		return
	}
	var in struct {
		ConversationID string `json:"conversationId"`
		VisitorID      string `json:"visitorId"`
		Email          string `json:"email"`
		Host           string `json:"host"`
	}
	_ = c.ShouldBindJSON(&in)
	if !visitorRe.MatchString(in.VisitorID) {
		httpx.Write(c, errBadVisitor)
		return
	}
	b, ok := h.load(c, in.Host)
	if !ok {
		return
	}
	if err := h.chat.SaveLead(c.Request.Context(), b.ID, in.VisitorID, in.ConversationID, in.Email); err != nil {
		httpx.Write(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
