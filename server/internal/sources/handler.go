package sources

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

// Handler serves /api/bots/:id/sources. It must be mounted behind auth.RequireUser.
type Handler struct {
	store  *Store
	files  FileStore
	worker *Worker
}

func NewHandler(store *Store, files FileStore, worker *Worker) *Handler {
	return &Handler{store: store, files: files, worker: worker}
}

// Routes registers the source endpoints on g (mounted at /api/bots/:id/sources).
func (h *Handler) Routes(g *gin.RouterGroup) {
	g.GET("", h.list)
	g.POST("/file", h.uploadFile)
	g.POST("/text", h.addText)
	g.DELETE("/:sourceId", h.delete)
}

func (h *Handler) list(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	list, err := h.store.List(ctx, accountID, botID)
	if err == nil && len(list) == 0 {
		err = h.store.BotExists(ctx, accountID, botID) // empty list or not your bot?
	}
	if err != nil {
		httpx.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"sources": list})
}

func (h *Handler) uploadFile(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	// Cap the whole request a little above the file limit (multipart overhead).
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileSize+1<<20)
	header, err := c.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			httpx.Write(c, apperr.BadRequest("Files can be up to 10 MB."))
			return
		}
		httpx.Write(c, apperr.BadRequest("Choose a file to upload."))
		return
	}
	if header.Size > maxFileSize {
		httpx.Write(c, apperr.BadRequest("Files can be up to 10 MB."))
		return
	}
	contentType, err := contentTypeFor(header.Filename)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	title := strings.TrimSpace(c.PostForm("title"))
	if title == "" {
		title = header.Filename
	}
	if title, err = cleanTitle(title); err != nil {
		httpx.Write(c, err)
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

	h.create(c, newSource{
		BotID:       botID,
		Type:        typeFile,
		Title:       title,
		ContentType: contentType,
		SizeBytes:   int64(len(data)),
	}, safeFileName(header.Filename), data)
}

func (h *Handler) addText(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	var in struct {
		Title string `json:"title"`
		Text  string `json:"text"`
	}
	_ = c.ShouldBindJSON(&in)
	title, err := cleanTitle(in.Title)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	text, err := cleanText(in.Text)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	h.create(c, newSource{
		BotID:       botID,
		Type:        typeTextSource,
		Title:       title,
		ContentType: typeText,
		SizeBytes:   int64(len(text)),
	}, textFileName, []byte(text))
}

// create uploads the content, then inserts the queued source and wakes the worker.
// If the insert is refused (plan limit, not your bot) the upload is removed again.
func (h *Handler) create(c *gin.Context, src newSource, fileName string, data []byte) {
	ctx, accountID := c.Request.Context(), auth.UserID(c)
	src.ID = newID()
	src.StoragePath = src.BotID + "/" + src.ID + "/" + fileName

	// Cheap ownership check first, so strangers can't write into storage at all.
	if err := h.store.BotExists(ctx, accountID, src.BotID); err != nil {
		httpx.Write(c, err)
		return
	}
	if err := h.files.Upload(ctx, src.StoragePath, src.ContentType, data); err != nil {
		httpx.Internal(c, err)
		return
	}
	source, err := h.store.Create(ctx, accountID, src)
	if err != nil {
		h.removeFile(src.StoragePath)
		httpx.Write(c, err)
		return
	}
	h.worker.Notify()
	c.JSON(http.StatusCreated, source)
}

func (h *Handler) delete(c *gin.Context) {
	botID, ok := httpx.UUIDParam(c, "id", errBotNotFound.Message)
	if !ok {
		return
	}
	id, ok := httpx.UUIDParam(c, "sourceId", errSourceNotFound.Message)
	if !ok {
		return
	}
	path, err := h.store.Delete(c.Request.Context(), auth.UserID(c), botID, id)
	if err != nil {
		httpx.Write(c, err)
		return
	}
	if path != "" {
		h.removeFile(path)
	}
	c.Status(http.StatusNoContent)
}

// removeFile deletes a stored file; failures are logged, not shown (the source row,
// which is what users see, is already gone).
func (h *Handler) removeFile(path string) {
	if err := h.files.Delete(context.Background(), path); err != nil {
		slog.Warn("delete stored file", "path", path, "err", err)
	}
}
