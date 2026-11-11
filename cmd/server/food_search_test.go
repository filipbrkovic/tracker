package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFoodSearchProxy(t *testing.T) {
	const secret = "test-token-at-least-16-characters"
	calls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer "+secret || r.URL.Query().Get("q") != "svježi sir" || r.URL.Query().Get("market") != "croatia" {
			t.Errorf("unexpected Worker request: %s", r.URL.String())
		}
		if r.URL.Query().Has("url") {
			t.Error("arbitrary upstream argument forwarded")
		}
		_, _ = io.WriteString(w, `{"provider":"Open Food Facts","results":[]}`)
	}))
	defer upstream.Close()
	proxy, err := newFoodSearchProxy(upstream.URL, secret)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{foodSearch: proxy}
	get := func(path string) *httptest.ResponseRecorder {
		rr := httptest.NewRecorder()
		s.searchFoods(rr, httptest.NewRequest("GET", path, nil))
		return rr
	}
	if got := get("/api/food-search?q=x").Code; got != 400 {
		t.Fatalf("short query: %d", got)
	}
	response := get("/api/food-search?q=svje%C5%BEi%20sir&market=croatia&url=http://other.example")
	if response.Code != 200 || strings.Contains(response.Body.String(), secret) {
		t.Fatalf("response: %d %s", response.Code, response.Body.String())
	}
	if get("/api/food-search?q=svje%C5%BEi%20sir").Code != 429 || calls != 1 {
		t.Fatal("rapid searches not limited")
	}
	config := httptest.NewRecorder()
	s.foodSearchConfig(config, httptest.NewRequest("GET", "/api/food-search/config", nil))
	var result map[string]any
	_ = json.Unmarshal(config.Body.Bytes(), &result)
	if result["enabled"] != true || strings.Contains(config.Body.String(), secret) || strings.Contains(config.Body.String(), upstream.URL) {
		t.Fatal("configuration leaked private settings")
	}
	disabled := httptest.NewRecorder()
	(&server{}).searchFoods(disabled, httptest.NewRequest("GET", "/api/food-search?q=rice", nil))
	if disabled.Code != 503 {
		t.Fatal("unconfigured search must remain optional")
	}
}

func TestFoodSearchProxyErrorsAndURLValidation(t *testing.T) {
	const token = "test-token-at-least-16-characters"
	for _, endpoint := range []string{"http://public.example/search", "https://user:password@example.com", "https://example.com?token=secret", "file:///tmp/search"} {
		if _, err := newFoodSearchProxy(endpoint, token); err == nil {
			t.Fatalf("unsafe endpoint accepted: %s", endpoint)
		}
	}
	for _, tc := range []struct {
		status int
		body   string
		want   int
	}{{429, "busy", 429}, {503, "temporarily unavailable", 502}, {200, "<html>not JSON</html>", 502}, {200, `{"provider":"other","results":[]}`, 502}} {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = io.WriteString(w, tc.body)
		}))
		proxy, err := newFoodSearchProxy(upstream.URL, token)
		if err != nil {
			t.Fatal(err)
		}
		response := httptest.NewRecorder()
		(&server{foodSearch: proxy}).searchFoods(response, httptest.NewRequest("GET", "/api/food-search?q=rice", nil))
		upstream.Close()
		if response.Code != tc.want || !json.Valid(response.Body.Bytes()) {
			t.Fatalf("status %d: got %d %s", tc.status, response.Code, response.Body.String())
		}
	}
}
