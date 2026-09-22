package billing

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

const maxWebhookBody = 1 << 20

var (
	errUnknownPlan = apperr.BadRequest("Choose the Pro or Business plan.")
	errNoCustomer  = apperr.BadRequest("You don't have a subscription yet.")
	errCheckout    = apperr.BadRequest("We couldn't confirm that payment. If you were charged, contact us.")
)

// Handler serves /api/billing. Everything but the webhook sits behind auth.RequireUser.
type Handler struct {
	store    *Store
	provider Provider
	appURL   string
}

func NewHandler(store *Store, appURL, secretKey, webhookSecret, pricePro, priceBusiness string) *Handler {
	return &Handler{
		store:    store,
		provider: newStripe(secretKey, webhookSecret, pricePro, priceBusiness),
		appURL:   appURL,
	}
}

// Routes registers the signed-in endpoints on g (mounted at /api/billing).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("", h.summary)
	g.POST("/checkout", h.checkout)
	g.POST("/confirm", h.confirm)
	g.POST("/portal", h.portal)
}

// Webhook is registered outside the API group: Stripe is another site, so the
// Origin check doesn't apply; the signature is what proves the request.
func (h *Handler) Webhook(c *gin.Context) {
	payload, err := io.ReadAll(io.LimitReader(c.Request.Body, maxWebhookBody))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "Could not read the request.")
		return
	}
	change, err := h.provider.ParseEvent(payload, c.GetHeader("Stripe-Signature"))
	if err != nil {
		slog.Warn("stripe webhook rejected", "err", err)
		httpx.Error(c, http.StatusBadRequest, "Invalid signature.")
		return
	}
	if change.Ignore || change.CustomerID == "" {
		c.Status(http.StatusOK)
		return
	}
	ctx := c.Request.Context()
	if change.Plan == plans.Free {
		err = h.store.downgrade(ctx, change.CustomerID)
	} else {
		err = h.store.applySubscription(ctx, change.CustomerID, change.SubscriptionID, change.Plan, change.PeriodEnd)
	}
	if err != nil {
		httpx.Internal(c, err) // Stripe retries on a 500
		return
	}
	c.Status(http.StatusOK)
}

func (h *Handler) summary(c *gin.Context) {
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	account, err := h.store.account(ctx, accountID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	usage, err := h.store.counts(ctx, accountID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"plan":            account.Plan,
		"planName":        account.Plan.Name(),
		"limits":          plans.For(account.Plan),
		"usage":           usage,
		"periodEnd":       account.PeriodEnd,
		"hasSubscription": account.SubscriptionID != nil,
	})
}

// checkout returns the URL the browser should open to pay.
func (h *Handler) checkout(c *gin.Context) {
	var in struct {
		Plan plans.Plan `json:"plan"`
	}
	_ = c.ShouldBindJSON(&in)
	if in.Plan != plans.Pro && in.Plan != plans.Business {
		httpx.Write(c, errUnknownPlan)
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	account, err := h.store.account(ctx, accountID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	customerID, err := h.customer(ctx, account)
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	success, cancel := h.appURL+"/app/billing?checkout={CHECKOUT_SESSION_ID}", h.appURL+"/app/billing?checkout=cancelled"
	url, err := h.provider.CheckoutURL(ctx, customerID, in.Plan, success, cancel)
	if errors.Is(err, ErrCustomerMissing) {
		// The stored customer belongs to another Stripe account: start a new one.
		if customerID, err = h.newCustomer(ctx, account); err == nil {
			url, err = h.provider.CheckoutURL(ctx, customerID, in.Plan, success, cancel)
		}
	}
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// confirm applies the plan as soon as the visitor returns, without waiting for the webhook.
func (h *Handler) confirm(c *gin.Context) {
	var in struct {
		SessionID string `json:"sessionId"`
	}
	_ = c.ShouldBindJSON(&in)
	if in.SessionID == "" {
		httpx.Write(c, errCheckout)
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	account, err := h.store.account(ctx, accountID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	checkout, err := h.provider.Checkout(ctx, in.SessionID)
	if err != nil {
		slog.Warn("confirm checkout", "account", accountID, "err", err)
		httpx.Write(c, errCheckout)
		return
	}
	// The session must belong to this account, or anyone could claim someone else's payment.
	if !checkout.Paid || account.CustomerID == nil || *account.CustomerID != checkout.CustomerID {
		httpx.Write(c, errCheckout)
		return
	}
	if checkout.Plan != plans.Pro && checkout.Plan != plans.Business {
		httpx.Write(c, errCheckout)
		return
	}
	err = h.store.applySubscription(ctx, checkout.CustomerID, checkout.SubscriptionID, checkout.Plan, checkout.PeriodEnd)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"plan": checkout.Plan, "planName": checkout.Plan.Name()})
}

// portal sends the user to Stripe to change the card, switch plan or cancel.
func (h *Handler) portal(c *gin.Context) {
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	account, err := h.store.account(ctx, accountID)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	if account.CustomerID == nil {
		httpx.Write(c, errNoCustomer)
		return
	}
	url, err := h.provider.PortalURL(ctx, *account.CustomerID, h.appURL+"/app/billing")
	if errors.Is(err, ErrCustomerMissing) {
		httpx.Write(c, errNoCustomer) // nothing to manage in this Stripe account
		return
	}
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// customer returns the account's Stripe customer, creating it on first checkout.
func (h *Handler) customer(ctx context.Context, account *Account) (string, error) {
	if account.CustomerID != nil {
		return *account.CustomerID, nil
	}
	return h.newCustomer(ctx, account)
}

func (h *Handler) newCustomer(ctx context.Context, account *Account) (string, error) {
	id, err := h.provider.CreateCustomer(ctx, account.ID, account.Email)
	if err != nil {
		return "", err
	}
	return id, h.store.setCustomer(ctx, account.ID, id)
}
