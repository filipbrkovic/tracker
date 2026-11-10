package main

import (
	"path/filepath"
	"testing"
)

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
