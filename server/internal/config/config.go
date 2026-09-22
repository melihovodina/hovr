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
	SupabaseJWTSecret      string
	SupabaseSecretKey      string

	GeminiAPIKey string

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
		SupabaseJWTSecret:      os.Getenv("SUPABASE_JWT_SECRET"),
		SupabaseSecretKey:      os.Getenv("SUPABASE_SECRET_KEY"),
		GeminiAPIKey:           os.Getenv("GEMINI_API_KEY"),
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
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
