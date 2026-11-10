package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestProductionOriginBoundary(t *testing.T) {
	handler := sameOrigin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for _, tc := range []struct {
		origin string
		status int
	}{{"", 204}, {"http://localcal.test", 204}, {"https://unrelated.test", 403}, {"null", 403}} {
		req := httptest.NewRequest("POST", "http://localcal.test/api/sync/default", nil)
		req.Header.Set("Origin", tc.origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != tc.status {
			t.Fatalf("origin %q: got %d", tc.origin, response.Code)
		}
	}
}

func TestOfflineDiaryItemsPersistAcrossRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "tracker.db")
	st, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	a := record{Collection: "diary", ID: "2026-11-10", Updated: 200, Data: mustRaw(map[string]any{"items": []map[string]any{{"id": "a", "kcal": 10}}, "itemUpdated": map[string]any{"a": 200}})}
	b := record{Collection: "diary", ID: a.ID, Updated: 100, Data: mustRaw(map[string]any{"items": []map[string]any{{"id": "b", "kcal": 20}}, "itemUpdated": map[string]any{"b": 100}})}
	for _, r := range []record{a, b} {
		if _, err := st.upsert("default", []record{r}); err != nil {
			t.Fatal(err)
		}
	}
	st.Close()
	st, err = openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	rec, _, err := st.get("default", "diary", a.ID)
	if err != nil {
		t.Fatal(err)
	}
	day, _ := unmarshalObject(rec.Data)
	if len(diaryItems(day)) != 2 {
		t.Fatalf("lost offline addition: %s", rec.Data)
	}
	deleted := record{Collection: "diary", ID: a.ID, Updated: 300, Data: mustRaw(map[string]any{"items": []any{}, "itemDeleted": map[string]any{"a": 300}})}
	if _, err = st.upsert("default", []record{deleted, a}); err != nil {
		t.Fatal(err)
	}
	rec, _, _ = st.get("default", "diary", a.ID)
	day, _ = unmarshalObject(rec.Data)
	items := diaryItems(day)
	if len(items) != 1 || getString(items[0], "id") != "b" {
		t.Fatalf("resurrection: %s", rec.Data)
	}
}
