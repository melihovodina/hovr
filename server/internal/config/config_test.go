package config

import (
	"reflect"
	"testing"
)

func TestSplitList(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"", nil},
		{"   ", nil},
		{"10.0.0.0/8", []string{"10.0.0.0/8"}},
		{" 10.0.0.0/8 , ::1 ", []string{"10.0.0.0/8", "::1"}},
		{"10.0.0.0/8,,", []string{"10.0.0.0/8"}},
	}
	for _, tc := range cases {
		if got := splitList(tc.in); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("splitList(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
