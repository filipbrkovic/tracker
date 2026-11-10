package main

import (
	"net/http"
	"net/url"
	"strings"
)

// Private networking is the authorization boundary. This additionally rejects
// browser requests originating from unrelated sites; it is not authentication.
func sameOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			u, err := url.Parse(origin)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || !strings.EqualFold(u.Host, r.Host) {
				http.Error(w, "cross-origin requests are disabled", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
