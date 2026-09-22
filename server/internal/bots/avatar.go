package bots

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

const maxAvatarSize = 1 << 20 // matches the avatars bucket limit

// Image types the widget can show, by sniffed content type.
var avatarTypes = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}

var errAvatarFormat = apperr.BadRequest("Use a PNG, JPG or WebP image up to 1 MB.")

// AvatarStore keeps bot logos in a public bucket.
type AvatarStore interface {
	Upload(ctx context.Context, path, contentType string, data []byte) error
	Delete(ctx context.Context, paths ...string) error
	PublicURL(path string) string
}

func (h *Handler) uploadAvatar(c *gin.Context) {
	id, ok := httpx.UUIDParam(c, "id", notFoundMsg)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAvatarSize+64<<10)
	header, err := c.FormFile("file")
	if err != nil || header.Size > maxAvatarSize {
		httpx.Write(c, errAvatarFormat)
		return
	}
	f, err := header.Open()
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		httpx.Internal(c, err)
		return
	}
	// Trust the bytes, not the file name or the browser's content type.
	contentType := http.DetectContentType(data)
	ext, ok := avatarTypes[contentType]
	if !ok {
		httpx.Write(c, errAvatarFormat)
		return
	}

	ctx, accountID := c.Request.Context(), auth.UserID(c)
	if _, err := h.store.Get(ctx, accountID, id); err != nil {
		httpx.Write(c, err) // strangers can't write into storage
		return
	}
	// A new name each time, so browsers and CDNs never show a cached old logo.
	path := id + "/" + randomName() + ext
	if err := h.avatars.Upload(ctx, path, contentType, data); err != nil {
		httpx.Internal(c, err)
		return
	}
	url := h.avatars.PublicURL(path)
	bot, previous, err := h.store.SetAvatar(ctx, accountID, id, &url)
	if err != nil {
		h.removeAvatar(&url)
		httpx.Write(c, err)
		return
	}
	h.removeAvatar(previous)
	c.JSON(http.StatusOK, bot)
}

func (h *Handler) deleteAvatar(c *gin.Context) {
	id, ok := httpx.UUIDParam(c, "id", notFoundMsg)
	if !ok {
		return
	}
	bot, previous, err := h.store.SetAvatar(c.Request.Context(), auth.UserID(c), id, nil)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	h.removeAvatar(previous)
	c.JSON(http.StatusOK, bot)
}

// removeAvatar deletes the file behind an avatar URL; failures are only logged.
func (h *Handler) removeAvatar(url *string) {
	if url == nil {
		return
	}
	path, ok := strings.CutPrefix(*url, h.avatars.PublicURL(""))
	if !ok {
		return // not one of our files
	}
	if err := h.avatars.Delete(context.Background(), path); err != nil {
		slog.Warn("delete avatar", "path", path, "err", err)
	}
}

func randomName() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
