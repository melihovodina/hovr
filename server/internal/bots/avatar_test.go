package bots

import (
	"bytes"
	"encoding/json"
	"image"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/melihovodina/hovr/server/internal/plans"
)

func testImage(t *testing.T, format string) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	var buf bytes.Buffer
	var err error
	if format == "png" {
		err = png.Encode(&buf, img)
	} else {
		err = jpeg.Encode(&buf, img, nil)
	}
	if err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func (e *testEnv) uploadAvatar(user, bot, name string, data []byte) (*httptest.ResponseRecorder, map[string]any) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("file", name)
	_, _ = part.Write(data)
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/bots/"+bot+"/avatar", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

// avatarPath is the stored file behind a bot's avatarUrl.
func avatarPath(bot map[string]any) string {
	url, _ := bot["avatarUrl"].(string)
	return strings.TrimPrefix(url, "https://storage.test/public/")
}

func TestAvatar(t *testing.T) {
	e := newTestEnv(t)
	anna, bob := e.newUser(plans.Free), e.newUser(plans.Free)
	_, created := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Northwind"}`)
	id := created["id"].(string)

	w, bot := e.uploadAvatar(anna, id, "logo.png", testImage(t, "png"))
	first := avatarPath(bot)
	if w.Code != http.StatusOK || !strings.HasPrefix(first, id+"/") || !strings.HasSuffix(first, ".png") || !e.avatars.Has(first) {
		t.Fatalf("upload: %d %s", w.Code, w.Body)
	}

	// The file name says PNG, the bytes say JPEG: the bytes win.
	w, bot = e.uploadAvatar(anna, id, "logo.png", testImage(t, "jpeg"))
	second := avatarPath(bot)
	if w.Code != http.StatusOK || !strings.HasSuffix(second, ".jpg") || e.avatars.Has(first) || e.avatars.Count() != 1 {
		t.Errorf("replace: %d %s, old file kept: %v", w.Code, w.Body, e.avatars.Has(first))
	}

	rejected := map[string][]byte{
		"text":    []byte("hello"),
		"svg":     []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"too big": append(testImage(t, "png"), make([]byte, maxAvatarSize)...),
	}
	for name, data := range rejected {
		if w, _ := e.uploadAvatar(anna, id, "logo.png", data); w.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", name, w.Code)
		}
	}
	if w, _ := e.uploadAvatar(bob, id, "logo.png", testImage(t, "png")); w.Code != http.StatusNotFound {
		t.Errorf("bob uploads to anna's bot: %d, want 404", w.Code)
	}
	e.avatars.Down = true
	if w, _ := e.uploadAvatar(anna, id, "logo.png", testImage(t, "png")); w.Code != http.StatusInternalServerError {
		t.Errorf("storage down: %d, want 500", w.Code)
	}
	e.avatars.Down = false
	if e.avatars.Count() != 1 {
		t.Errorf("stored avatars = %d, want 1 after refused uploads", e.avatars.Count())
	}

	w, bot = e.do(anna, http.MethodDelete, "/api/bots/"+id+"/avatar", "")
	if w.Code != http.StatusOK || bot["avatarUrl"] != nil || e.avatars.Count() != 0 {
		t.Errorf("remove: %d %s", w.Code, w.Body)
	}

	// Deleting the bot removes its avatar too.
	_, bot = e.uploadAvatar(anna, id, "logo.png", testImage(t, "png"))
	if w, _ := e.do(anna, http.MethodDelete, "/api/bots/"+id, ""); w.Code != http.StatusNoContent || e.avatars.Has(avatarPath(bot)) {
		t.Errorf("delete bot: %d, avatar left: %v", w.Code, e.avatars.Has(avatarPath(bot)))
	}
}
