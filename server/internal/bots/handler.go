package bots

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Handler serves /api/bots. It must be mounted behind auth.RequireUser.
type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
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
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"bots": bots})
}

func (h *Handler) create(c *gin.Context) {
	var in struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Give your bot a name."})
		return
	}
	name, err := cleanName(in.Name)
	if err != nil {
		respondErr(c, err)
		return
	}
	key, err := newPublicKey()
	if err != nil {
		serverError(c, err)
		return
	}
	bot, err := h.store.Create(c.Request.Context(), auth.UserID(c), name, key)
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, bot)
}

func (h *Handler) get(c *gin.Context) {
	id, ok := botID(c)
	if !ok {
		return
	}
	bot, err := h.store.Get(c.Request.Context(), auth.UserID(c), id)
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, bot)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := botID(c)
	if !ok {
		return
	}
	var patch Patch
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Something in the request doesn't look right."})
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	bot, err := h.store.Get(ctx, accountID, id)
	if err != nil {
		respondErr(c, err)
		return
	}
	if err := patch.apply(bot); err != nil {
		respondErr(c, err)
		return
	}
	if !bot.ShowBadge {
		plan, err := h.store.Plan(ctx, accountID)
		if err != nil {
			serverError(c, err)
			return
		}
		if !plans.For(plan).RemoveBadge {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "Hiding “Powered by hovr” comes with Pro.",
				"code":  "upgrade_required",
			})
			return
		}
	}
	saved, err := h.store.Save(ctx, accountID, bot)
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, saved)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := botID(c)
	if !ok {
		return
	}
	if err := h.store.Delete(c.Request.Context(), auth.UserID(c), id); err != nil {
		respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// botID reads :id; anything that isn't a UUID can't be one of our bots.
func botID(c *gin.Context) (string, bool) {
	id := c.Param("id")
	if !uuidRe.MatchString(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bot not found."})
		return "", false
	}
	return id, true
}

func respondErr(c *gin.Context, err error) {
	var validation *ValidationError
	var limit *LimitError
	switch {
	case errors.As(err, &validation):
		c.JSON(http.StatusBadRequest, gin.H{"error": validation.Message})
	case errors.As(err, &limit):
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error": fmt.Sprintf("Your %s plan includes %s. Upgrade to add more.", limit.Plan.Name(), botCount(limit.Max)),
			"code":  "upgrade_required",
		})
	case errors.Is(err, errNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Bot not found."})
	default:
		serverError(c, err)
	}
}

func serverError(c *gin.Context, err error) {
	slog.Error("bots request failed", "path", c.FullPath(), "err", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Try again."})
}

func botCount(n int) string {
	if n == 1 {
		return "1 bot"
	}
	return fmt.Sprintf("%d bots", n)
}
