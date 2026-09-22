// Package storage keeps files in Supabase Storage buckets, using its REST API with
// the server's secret key.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client talks to one bucket.
type Client struct {
	baseURL string
	bucket  string
	key     string
	http    *http.Client
}

// New creates a client for bucket. secretKey is the project's server-side key; it
// bypasses Storage policies, so it must never reach the browser.
func New(supabaseURL, secretKey, bucket string) *Client {
	return &Client{
		baseURL: supabaseURL + "/storage/v1",
		bucket:  bucket,
		key:     secretKey,
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

// Upload stores data at path; it fails if something is already there.
func (c *Client) Upload(ctx context.Context, path, contentType string, data []byte) error {
	req, err := c.request(ctx, http.MethodPost, "/object/"+c.bucket+"/"+escapePath(path), bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	_, err = c.do(req)
	return err
}

// PublicURL is the address of a file in a public bucket.
func (c *Client) PublicURL(path string) string {
	return c.baseURL + "/object/public/" + c.bucket + "/" + escapePath(path)
}

// Download returns the file at path.
func (c *Client) Download(ctx context.Context, path string) ([]byte, error) {
	req, err := c.request(ctx, http.MethodGet, "/object/"+c.bucket+"/"+escapePath(path), nil)
	if err != nil {
		return nil, err
	}
	return c.do(req)
}

// Delete removes the files at paths. Missing files are not an error.
func (c *Client) Delete(ctx context.Context, paths ...string) error {
	body, err := json.Marshal(map[string][]string{"prefixes": paths})
	if err != nil {
		return err
	}
	req, err := c.request(ctx, http.MethodDelete, "/object/"+c.bucket, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	_, err = c.do(req)
	return err
}

func (c *Client) request(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.key)
	req.Header.Set("Authorization", "Bearer "+c.key)
	return req, nil
}

func (c *Client) do(req *http.Request) ([]byte, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("storage %s: %w", req.Method, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("storage %s: read body: %w", req.Method, err)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("storage %s %s: status %d: %s", req.Method, req.URL.Path, resp.StatusCode, truncate(data))
	}
	return data, nil
}

// escapePath escapes each segment but keeps the slashes between them.
func escapePath(p string) string {
	parts := strings.Split(p, "/")
	for i, s := range parts {
		parts[i] = url.PathEscape(s)
	}
	return strings.Join(parts, "/")
}

func truncate(b []byte) string {
	const max = 300
	if len(b) > max {
		return string(b[:max]) + "…"
	}
	return string(b)
}
