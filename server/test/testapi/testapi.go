// Package testapi builds a gin engine for handler tests, with the X-Test-User header
// standing in for auth.RequireUser. Only test files import it.
package testapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/auth"
)

// UserHeader names the signed-in user of a request.
const UserHeader = "X-Test-User"

func init() { gin.SetMode(gin.TestMode) }

// Router returns an engine and a group mounted at path, where each request runs as
// the user in the X-Test-User header.
func Router(path string) (*gin.Engine, *gin.RouterGroup) {
	r := gin.New()
	g := r.Group(path, func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader(UserHeader), "")
		c.Next()
	})
	return r, g
}

// Call sends a JSON request as user and returns the recorder with the decoded body.
func Call(r *gin.Engine, user, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(UserHeader, user)
	return Send(r, req)
}

// Send serves a prepared request, for multipart bodies and extra headers.
func Send(r *gin.Engine, req *http.Request) (*httptest.ResponseRecorder, map[string]any) {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}
