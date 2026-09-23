package router

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// widgetPaths are the pages that live in an iframe on a customer's site, so they are
// the only ones any origin may embed.
var widgetPaths = map[string]bool{"/widget": true, "/widget/": true, "/widget.html": true}

// securityHeaders sets the headers the browser needs to defend the pages we serve.
// API responses only get nosniff: they are JSON read by our own code, and a policy
// written for documents says nothing useful about them.
//
// reportOnly sends the policy as Content-Security-Policy-Report-Only, which reports
// violations without blocking anything. It exists so a policy can be watched on a
// real deployment before it starts refusing to render pages.
func securityHeaders(storageOrigin string, reportOnly bool) gin.HandlerFunc {
	page := policy(storageOrigin, "'none'")
	embeddable := policy(storageOrigin, "*")
	header := "Content-Security-Policy"
	if reportOnly {
		header += "-Report-Only"
	}

	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Next()
			return
		}
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if widgetPaths[c.Request.URL.Path] {
			// No X-Frame-Options: it has no "some origins" value, and any value here
			// would be a flat DENY or SAMEORIGIN, which is exactly what must not happen.
			h.Set(header, embeddable)
		} else {
			h.Set(header, page)
			// For browsers that predate frame-ancestors.
			h.Set("X-Frame-Options", "DENY")
		}
		c.Next()
	}
}

// policy builds the content security policy. Inline scripts are allowed because the
// static export ships them (Next's bootstrap, the theme script that runs before paint,
// the JSON-LD block); their hashes change every build, and a nonce needs a server
// rendering the page, which an export does not have.
func policy(storageOrigin, frameAncestors string) string {
	img := "'self' data: blob:"
	if storageOrigin != "" {
		img += " " + storageOrigin
	}
	return strings.Join([]string{
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src " + img,
		"font-src 'self'",
		"connect-src 'self'",
		"form-action 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors " + frameAncestors,
	}, "; ")
}
