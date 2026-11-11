package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

// Credentials stay on the self-hosted server. The browser only sends a food
// query and market, never a diary, weight record or arbitrary upstream URL.
type foodSearchProxy struct {
	endpoint *url.URL
	token    string
	client   *http.Client
	mu       sync.Mutex
	next     time.Time
}

func newFoodSearchProxy(endpoint, token string) (*foodSearchProxy, error) {
	if endpoint == "" {
		return nil, nil
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("invalid food search Worker URL")
	}
	local := u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"
	if u.Scheme != "https" && !(u.Scheme == "http" && local) {
		return nil, errors.New("food search Worker must use HTTPS (HTTP allowed for loopback development)")
	}
	if len(token) < 16 {
		return nil, errors.New("food search token must contain at least 16 characters")
	}
	if u.Path == "" || u.Path == "/" {
		u.Path = "/search"
	}
	return &foodSearchProxy{endpoint: u, token: token, client: &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (s *server) foodSearchConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"enabled": s.foodSearch != nil, "provider": "Open Food Facts"})
}

func (s *server) searchFoods(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	fail := func(status int, message string) {
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}
	p := s.foodSearch
	if p == nil {
		fail(503, "Online food search is not connected yet.")
		return
	}
	q := strings.Join(strings.Fields(r.URL.Query().Get("q")), " ")
	market := r.URL.Query().Get("market")
	if market == "" {
		market = "croatia"
	}
	if utf8.RuneCountInString(q) < 2 || utf8.RuneCountInString(q) > 100 || strings.IndexFunc(q, unicode.IsControl) >= 0 {
		fail(400, "Enter between 2 and 100 characters.")
		return
	}
	if market != "croatia" && market != "world" {
		fail(400, "Choose Croatia or worldwide.")
		return
	}
	p.mu.Lock()
	now := time.Now()
	limited := now.Before(p.next)
	if !limited {
		p.next = now.Add(6 * time.Second)
	}
	p.mu.Unlock()
	if limited {
		w.Header().Set("Retry-After", "6")
		fail(429, "Please wait a few seconds before searching again.")
		return
	}
	u := *p.endpoint
	params := u.Query()
	params.Set("q", q)
	params.Set("market", market)
	u.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		fail(502, "Food search could not be reached.")
		return
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Accept", "application/json")
	response, err := p.client.Do(req)
	if err != nil {
		fail(502, "Food search could not be reached. Please try again later.")
		return
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		if response.StatusCode == 429 {
			w.Header().Set("Retry-After", "60")
			fail(429, "The food database is busy. Please try again in a minute.")
		} else {
			fail(502, "Food search is temporarily unavailable. Please try again later.")
		}
		return
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 512*1024+1))
	if err != nil || len(body) > 512*1024 || !json.Valid(body) {
		fail(502, "Food search returned an unreadable response.")
		return
	}
	var result struct {
		Provider string            `json:"provider"`
		Results  []json.RawMessage `json:"results"`
	}
	if json.Unmarshal(body, &result) != nil || result.Provider != "Open Food Facts" || result.Results == nil || len(result.Results) > 8 {
		fail(502, "Food search returned an unexpected response.")
		return
	}
	_, _ = w.Write(body)
}
