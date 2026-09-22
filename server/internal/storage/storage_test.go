package storage

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient(t *testing.T) {
	type call struct{ method, path, auth, apikey, contentType, body string }
	var calls []call
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		calls = append(calls, call{r.Method, r.URL.EscapedPath(), r.Header.Get("Authorization"),
			r.Header.Get("apikey"), r.Header.Get("Content-Type"), string(b)})
		if r.URL.Path == "/storage/v1/object/sources/missing.pdf" {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"not_found"}`))
			return
		}
		_, _ = w.Write([]byte("file-bytes"))
	}))
	defer srv.Close()

	c := New(srv.URL, "secret", "sources")
	ctx := context.Background()
	if err := c.Upload(ctx, "bot/src/My FAQ.pdf", "application/pdf", []byte("%PDF")); err != nil {
		t.Fatal(err)
	}
	data, err := c.Download(ctx, "bot/src/My FAQ.pdf")
	if err != nil || string(data) != "file-bytes" {
		t.Fatalf("Download = %q, %v", data, err)
	}
	if err := c.Delete(ctx, "a/b.pdf", "c/d.txt"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Download(ctx, "missing.pdf"); err == nil {
		t.Error("404 from storage not reported as an error")
	}

	up, down, del := calls[0], calls[1], calls[2]
	if up.method != http.MethodPost || up.path != "/storage/v1/object/sources/bot/src/My%20FAQ.pdf" ||
		up.contentType != "application/pdf" || up.body != "%PDF" {
		t.Errorf("upload call = %+v", up)
	}
	if down.method != http.MethodGet || down.path != up.path {
		t.Errorf("download call = %+v", down)
	}
	var delBody map[string][]string
	_ = json.Unmarshal([]byte(del.body), &delBody)
	if del.method != http.MethodDelete || del.path != "/storage/v1/object/sources" || len(delBody["prefixes"]) != 2 {
		t.Errorf("delete call = %+v", del)
	}
	for _, c := range calls {
		if c.auth != "Bearer secret" || c.apikey != "secret" {
			t.Errorf("%s %s: missing secret key headers", c.method, c.path)
		}
	}
}

func TestPublicURL(t *testing.T) {
	c := New("http://127.0.0.1:54321", "secret", "avatars")
	want := "http://127.0.0.1:54321/storage/v1/object/public/avatars/bot/logo%20v2.png"
	if got := c.PublicURL("bot/logo v2.png"); got != want {
		t.Errorf("PublicURL = %q, want %q", got, want)
	}
}
