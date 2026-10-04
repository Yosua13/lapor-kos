package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNormalizeIndonesianPhone(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "local", input: "0812-3456-7890", want: "6281234567890"},
		{name: "country code", input: "+62 812-3456-7890", want: "6281234567890"},
		{name: "too short", input: "08123", want: ""},
		{name: "foreign", input: "+1 202 555 0199", want: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := normalizeIndonesianPhone(test.input); got != test.want {
				t.Fatalf("normalizeIndonesianPhone(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestPositiveQueryInt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		query   string
		want    int
		wantErr bool
	}{
		{query: "", want: 10},
		{query: "?page=3", want: 3},
		{query: "?page=0", wantErr: true},
		{query: "?page=invalid", wantErr: true},
	}
	for _, test := range tests {
		request := httptest.NewRequest("GET", "/invitations"+test.query, nil)
		context, _ := gin.CreateTestContext(httptest.NewRecorder())
		context.Request = request
		got, err := positiveQueryInt(context, "page", 10)
		if (err != nil) != test.wantErr {
			t.Fatalf("query %q error = %v, wantErr %v", test.query, err, test.wantErr)
		}
		if !test.wantErr && got != test.want {
			t.Fatalf("query %q value = %d, want %d", test.query, got, test.want)
		}
	}
}
