package widget

import (
	"net/url"
	"strings"
)

// hostOf returns the lowercase hostname of a page address or bare host ("" if none).
func hostOf(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
}

// allowedOn reports whether the widget may run on host: no domains = anywhere, a domain
// covers its subdomains, and the app itself is always allowed for previews.
func allowedOn(host string, allowed []string, appHost string) bool {
	if host != "" && host == appHost {
		return true
	}
	if len(allowed) == 0 {
		return true
	}
	for _, d := range allowed {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}
