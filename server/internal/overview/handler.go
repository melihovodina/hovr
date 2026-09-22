package overview

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/bots"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

const (
	defaultDays  = 7
	maxDays      = 90
	topQuestions = 5
	needsYouSize = 3
)

// Handler serves the dashboard numbers. It must be mounted behind auth.RequireUser.
type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// Routes registers the endpoint on g (mounted at /api/bots/<bot>).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("/stats", h.stats)
}

func (h *Handler) stats(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", bots.ErrNotFound.Message)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	bot, err := h.store.access.Bot(ctx, auth.UserID(c), botID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	days := clampDays(c.Query("days"))
	loc := location(c.Query("tz"))
	// Whole days in the owner's timezone, the last one being today there.
	now := time.Now().In(loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -(days - 1))
	end := start.AddDate(0, 0, days)
	prevStart := start.AddDate(0, 0, -days)

	current, previous, err := h.store.totals(ctx, botID, prevStart, start, end)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	current.AnsweredRate, previous.AnsweredRate = rate(current), rate(previous)

	byDay, err := h.store.daily(ctx, botID, start, end, loc.String())
	if err != nil {
		httpx.Write(c, err)
		return
	}
	series := make([]Day, days)
	for i := range series {
		date := start.AddDate(0, 0, i).Format(time.DateOnly)
		day, ok := byDay[date]
		if !ok {
			day = Day{Date: date}
		}
		series[i] = day
	}

	top, err := h.store.topQuestions(ctx, botID, start, end, topQuestions)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	openCount, items, err := h.store.openItems(ctx, botID, plans.For(bot.Plan).HistoryDays, needsYouSize)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"days":          days,
		"timezone":      loc.String(),
		"current":       current,
		"previous":      previous,
		"daily":         series,
		"topQuestions":  top,
		"openQuestions": openCount,
		"needsYou":      items,
	})
}

func clampDays(q string) int {
	days, err := strconv.Atoi(q)
	if err != nil || days < 1 {
		return defaultDays
	}
	return min(days, maxDays)
}

// location falls back to UTC for unknown timezones, so a bad value still shows numbers.
// "Local" is the server's zone and means nothing to Postgres, so it counts as unknown.
func location(tz string) *time.Location {
	if tz == "" || tz == "Local" {
		return time.UTC
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.UTC
	}
	return loc
}

func rate(t Totals) *float64 {
	total := t.Answered + t.Missed
	if total == 0 {
		return nil
	}
	r := float64(t.Answered) / float64(total)
	return &r
}
