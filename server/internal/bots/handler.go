package bots

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/accounts"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

const notFoundMsg = "Bot not found."

// FileRemover deletes stored files (the bot's uploaded knowledge).
type FileRemover interface {
	Delete(ctx context.Context, paths ...string) error
}

// Handler serves /api/bots. It must be mounted behind auth.RequireUser.
type Handler struct {
	store    *Store
	accounts *accounts.Store
	files    FileRemover
}

func NewHandler(store *Store, accounts *accounts.Store, files FileRemover) *Handler {
	return &Handler{store: store, accounts: accounts, files: files}
}

// Routes registers the bot endpoints on g.
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("", h.list)
	g.POST("", h.create)
	g.GET("/:id", h.get)
	g.PATCH("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

func (h *Handler) list(c *gin.Context) {
	bots, err := h.store.List(c.Request.Context(), auth.UserID(c))
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"bots": bots})
}

func (h *Handler) create(c *gin.Context) {
	var in struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&in)
	name, err := cleanName(in.Name)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	bot, err := h.store.Create(c.Request.Context(), auth.UserID(c), name, newPublicKey())
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusCreated, bot)
}

func (h *Handler) get(c *gin.Context) {
	id, ok := httpx.UUIDParam(c, "id", notFoundMsg)
	if !ok {
		return
	}
	bot, err := h.store.Get(c.Request.Context(), auth.UserID(c), id)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, bot)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := httpx.UUIDParam(c, "id", notFoundMsg)
	if !ok {
		return
	}
	var patch Patch
	if err := c.ShouldBindJSON(&patch); err != nil {
		httpx.Error(c, http.StatusBadRequest, "Something in the request doesn't look right.")
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	bot, err := h.store.Get(ctx, accountID, id)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	if err := patch.apply(bot); err != nil {
		httpx.Write(c, err)
		return
	}
	if !bot.ShowBadge {
		account, err := h.accounts.Get(ctx, accountID)
		if err != nil {
			httpx.Write(c, err)
			return
		}
		if !plans.For(account.Plan).RemoveBadge {
			httpx.Write(c, apperr.UpgradeRequired("Hiding “Powered by hovr” comes with Pro."))
			return
		}
	}
	saved, err := h.store.Save(ctx, accountID, bot)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, saved)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.UUIDParam(c, "id", notFoundMsg)
	if !ok {
		return
	}
	paths, err := h.store.Delete(c.Request.Context(), auth.UserID(c), id)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	if len(paths) > 0 {
		// The bot is already gone; leftover files are logged, not shown.
		if err := h.files.Delete(context.WithoutCancel(c.Request.Context()), paths...); err != nil {
			slog.Warn("delete bot files", "bot", id, "files", len(paths), "err", err)
		}
	}
	c.Status(http.StatusNoContent)
}
