package widget

import "testing"

func TestHostOf(t *testing.T) {
	for in, want := range map[string]string{
		"https://Shop.Example.com/pricing?x=1": "shop.example.com",
		"http://localhost:5173/":               "localhost",
		"example.com":                          "example.com",
		"example.com.":                         "example.com",
		"":                                     "",
		"http://%zz":                           "",
	} {
		if got := hostOf(in); got != want {
			t.Errorf("hostOf(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAllowedOn(t *testing.T) {
	allowed := []string{"example.com"}
	cases := []struct {
		host    string
		allowed []string
		want    bool
	}{
		{"example.com", allowed, true},
		{"shop.example.com", allowed, true},
		{"badexample.com", allowed, false},
		{"example.com.evil.io", allowed, false},
		{"", allowed, false},
		{"hovr.app", allowed, true}, // the app, for previews
		{"anything.io", nil, true},
		{"", nil, true},
	}
	for _, tc := range cases {
		if got := allowedOn(tc.host, tc.allowed, "hovr.app"); got != tc.want {
			t.Errorf("allowedOn(%q, %v) = %v, want %v", tc.host, tc.allowed, got, tc.want)
		}
	}
}
