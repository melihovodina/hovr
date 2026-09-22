// Package httpx holds the JSON error responses and request helpers every handler uses.
// Errors always have the shape {"error": "message people can read", "code": "optional"}.
package httpx

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

// Write responds with err: an *apperr.Error becomes its status, message and code;
// anything else is unexpected and becomes a logged 500.
func Write(c *gin.Context, err error) {
	var e *apperr.Error
	if !errors.As(err, &e) {
		Internal(c, err)
		return
	}
	body := gin.H{"error": e.Message}
	if e.Code != "" {
		body["code"] = e.Code
	}
	c.JSON(e.Status, body)
}

// Error responds with a readable error message.
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// Abort is Error for middleware: it also stops the handler chain.
func Abort(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": message})
}

// Internal logs the real error and responds with a generic message.
func Internal(c *gin.Context, err error) {
	slog.Error("request failed", "method", c.Request.Method, "path", c.FullPath(), "err", err)
	Error(c, http.StatusInternalServerError, "Something went wrong. Try again.")
}

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// UUIDParam reads a UUID path parameter. Anything else can't be one of our records,
// so it responds 404 with notFound and returns false.
func UUIDParam(c *gin.Context, name, notFound string) (string, bool) {
	id := c.Param(name)
	if !uuidRe.MatchString(id) {
		Error(c, http.StatusNotFound, notFound)
		return "", false
	}
	return id, true
}
