package inbox

import (
	"encoding/csv"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/internal/sources"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

const (
	statusOpen = "open"
	statusDone = "done"
)

var errBadStatus = apperr.BadRequest(`Status must be "open" or "done".`)

// Handler serves /api/bots/:id/inbox and /leads. It must be mounted behind auth.RequireUser.
type Handler struct {
	store   *Store
	chats   *chat.Store
	sources *sources.Handler
}

func NewHandler(store *Store, chats *chat.Store, sources *sources.Handler) *Handler {
	return &Handler{store: store, chats: chats, sources: sources}
}

// Routes registers the endpoints on g (mounted at /api/bots/:id).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("/inbox", h.list)
	g.GET("/inbox/:itemId", h.get)
	g.PATCH("/inbox/:itemId", h.setStatus)
	g.POST("/inbox/:itemId/answer", h.answer)
	g.GET("/leads", h.leads)
	g.GET("/leads.csv", h.exportLeads)
}

// bot checks the owner and returns the bot id with the plan's limits.
func (h *Handler) bot(c *gin.Context) (string, plans.Limits, bool) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return "", plans.Limits{}, false
	}
	plan, err := h.store.botPlan(c.Request.Context(), auth.UserID(c), botID)
	if err != nil {
		httpx.Write(c, err)
		return "", plans.Limits{}, false
	}
	return botID, plans.For(plan), true
}

// item loads the :itemId item within the plan's history window.
func (h *Handler) item(c *gin.Context) (string, *Item, bool) {
	botID, limits, ok := h.bot(c)
	if !ok {
		return "", nil, false
	}
	id, ok := httpx.UUIDParam(c, "itemId", errItemNotFound.Message)
	if !ok {
		return "", nil, false
	}
	item, err := h.store.Get(c.Request.Context(), botID, id, limits.HistoryDays)
	if err != nil {
		httpx.Write(c, err)
		return "", nil, false
	}
	return botID, item, true
}

func (h *Handler) list(c *gin.Context) {
	botID, limits, ok := h.bot(c)
	if !ok {
		return
	}
	status := c.DefaultQuery("status", statusOpen)
	if status != statusOpen && status != statusDone {
		httpx.Write(c, errBadStatus)
		return
	}
	items, err := h.store.List(c.Request.Context(), botID, status, limits.HistoryDays)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "historyDays": limits.HistoryDays})
}

// get returns the item with the last conversation it came from (null if deleted).
func (h *Handler) get(c *gin.Context) {
	botID, item, ok := h.item(c)
	if !ok {
		return
	}
	var messages []chat.Message
	if item.LastConversationID != nil {
		_, msgs, err := h.chats.Messages(c.Request.Context(), auth.UserID(c), botID, *item.LastConversationID)
		if err != nil && !errors.Is(err, apperr.ErrNotFound) {
			httpx.Write(c, err)
			return
		}
		messages = msgs
	}
	c.JSON(http.StatusOK, gin.H{"item": item, "messages": messages})
}

func (h *Handler) setStatus(c *gin.Context) {
	botID, item, ok := h.item(c)
	if !ok {
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	_ = c.ShouldBindJSON(&in)
	if in.Status != statusOpen && in.Status != statusDone {
		httpx.Write(c, errBadStatus)
		return
	}
	saved, err := h.store.SetStatus(c.Request.Context(), botID, item.ID, in.Status, nil)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, saved)
}

// answer is "Teach your bot": the answer becomes a knowledge source and the item is done.
func (h *Handler) answer(c *gin.Context) {
	botID, item, ok := h.item(c)
	if !ok {
		return
	}
	var in struct {
		Answer string `json:"answer"`
	}
	_ = c.ShouldBindJSON(&in)
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	source, err := h.sources.AddAnswer(ctx, accountID, botID, item.Question, in.Answer)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	saved, err := h.store.SetStatus(ctx, botID, item.ID, statusDone, &source.ID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"item": saved, "source": source})
}

func (h *Handler) leads(c *gin.Context) {
	botID, limits, ok := h.bot(c)
	if !ok {
		return
	}
	leads, err := h.store.Leads(c.Request.Context(), botID, limits.HistoryDays)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"leads": leads, "historyDays": limits.HistoryDays, "canExport": limits.ExportLeads})
}

func (h *Handler) exportLeads(c *gin.Context) {
	botID, limits, ok := h.bot(c)
	if !ok {
		return
	}
	if !limits.ExportLeads {
		httpx.Write(c, apperr.UpgradeRequired("Exporting leads comes with Business."))
		return
	}
	leads, err := h.store.Leads(c.Request.Context(), botID, limits.HistoryDays)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="hovr-leads.csv"`)
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"email", "first question", "bot couldn't answer", "date"})
	for _, l := range leads {
		missed := "no"
		if l.Missed {
			missed = "yes"
		}
		_ = w.Write([]string{csvSafe(l.Email), csvSafe(l.Question), missed, l.CreatedAt.UTC().Format(time.DateTime)})
	}
	w.Flush()
}

// csvSafe stops spreadsheets from running visitor text as a formula.
func csvSafe(s string) string {
	if s != "" && (s[0] == '=' || s[0] == '+' || s[0] == '-' || s[0] == '@' || s[0] == '\t' || s[0] == '\r') {
		return "'" + s
	}
	return s
}
