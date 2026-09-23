// Package config loads server settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds every setting the server reads at startup.
type Config struct {
	Port        string
	AppURL      string
	DatabaseURL string

	SupabaseURL            string
	SupabasePublishableKey string
	SupabaseSecretKey      string

	GeminiAPIKey string

	StripeSecretKey     string
	StripeWebhookSecret string
	StripePricePro      string
	StripePriceBusiness string

	// TrustedProxies are the addresses whose forwarded headers may name the visitor.
	// Empty means trust none: the client IP is the address the connection came from.
	TrustedProxies []string

	// CSPReportOnly sends the content security policy as Report-Only: violations are
	// reported but nothing is blocked, for watching a policy on a real deployment.
	CSPReportOnly bool

	// ClientIPHeader is a header the host fills with the real visitor and always
	// overwrites, such as Cloudflare's CF-Connecting-IP. Set, it is used instead of
	// walking the forwarded chain; empty, the chain is used.
	ClientIPHeader string

	StaticDir string
}

// Load reads the environment and validates required values.
func Load() (Config, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return Config{}, fmt.Errorf("read .env: %w", err)
	}

	cfg := Config{
		Port:                   getenv("PORT", "8080"),
		AppURL:                 strings.TrimRight(getenv("APP_URL", "http://localhost:3000"), "/"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		SupabaseURL:            strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabasePublishableKey: os.Getenv("SUPABASE_PUBLISHABLE_KEY"),
		SupabaseSecretKey:      os.Getenv("SUPABASE_SECRET_KEY"),
		GeminiAPIKey:           os.Getenv("GEMINI_API_KEY"),
		StripeSecretKey:        os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret:    os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripePricePro:         os.Getenv("STRIPE_PRICE_PRO"),
		StripePriceBusiness:    os.Getenv("STRIPE_PRICE_BUSINESS"),
		TrustedProxies:         splitList(os.Getenv("TRUSTED_PROXIES")),
		ClientIPHeader:         strings.TrimSpace(os.Getenv("CLIENT_IP_HEADER")),
		CSPReportOnly:          os.Getenv("CSP_REPORT_ONLY") == "true",
		StaticDir:              os.Getenv("STATIC_DIR"),
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.SupabaseURL == "" {
		missing = append(missing, "SUPABASE_URL")
	}
	if cfg.SupabasePublishableKey == "" {
		missing = append(missing, "SUPABASE_PUBLISHABLE_KEY")
	}
	if cfg.SupabaseSecretKey == "" {
		missing = append(missing, "SUPABASE_SECRET_KEY")
	}
	if cfg.GeminiAPIKey == "" {
		missing = append(missing, "GEMINI_API_KEY")
	}
	for name, value := range map[string]string{
		"STRIPE_SECRET_KEY":     cfg.StripeSecretKey,
		"STRIPE_WEBHOOK_SECRET": cfg.StripeWebhookSecret,
		"STRIPE_PRICE_PRO":      cfg.StripePricePro,
		"STRIPE_PRICE_BUSINESS": cfg.StripePriceBusiness,
	} {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}

// splitList reads a comma-separated value, ignoring spaces and empty entries.
func splitList(value string) []string {
	var out []string
	for _, part := range strings.Split(value, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
