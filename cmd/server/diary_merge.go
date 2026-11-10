package main

import (
	"encoding/json"
	"sort"
)

// Item clocks preserve independent offline additions inside legacy day records.
// Missing items are not deletions: deletion requires an explicit tombstone.
func mergeDiaryRecords(old, incoming record) record {
	a, e1 := unmarshalObject(old.Data)
	b, e2 := unmarshalObject(incoming.Data)
	if e1 != nil || e2 != nil {
		return incoming
	}
	result := b
	if old.Updated > incoming.Updated {
		result = a
	}
	clocks, deleted := map[string]any{}, map[string]any{}
	items := map[string]map[string]any{}
	for _, day := range []map[string]any{a, b} {
		ds, _ := day["itemDeleted"].(map[string]any)
		for id, v := range ds {
			if number(v) > number(deleted[id]) {
				deleted[id] = v
			}
		}
		us, _ := day["itemUpdated"].(map[string]any)
		for _, item := range diaryItems(day) {
			id := getString(item, "id")
			ts := number(us[id])
			if ts == 0 {
				ts = 1
			}
			if ts > number(clocks[id]) || (ts == number(clocks[id]) && string(mustRaw(item)) > string(mustRaw(items[id]))) {
				items[id] = item
				clocks[id] = ts
			}
		}
	}
	ids := []string{}
	for id := range items {
		if number(deleted[id]) < number(clocks[id]) {
			ids = append(ids, id)
		} else {
			delete(clocks, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool {
		pi, pj := number(items[ids[i]]["position"]), number(items[ids[j]]["position"])
		if pi != pj {
			return pi < pj
		}
		return ids[i] < ids[j]
	})
	out := []map[string]any{}
	for _, id := range ids {
		out = append(out, items[id])
	}
	result["items"], result["itemUpdated"], result["itemDeleted"] = out, clocks, deleted
	incoming.Data = mustRaw(result)
	if old.Updated > incoming.Updated {
		incoming.Updated = old.Updated
	}
	return incoming
}

func number(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	case int:
		return float64(n)
	}
	return 0
}

// MCP mutations use their before-image to distinguish edits from stale copies.
func stampDiaryRecord(old record, next *record) {
	a, _ := unmarshalObject(old.Data)
	b, err := unmarshalObject(next.Data)
	if err != nil {
		return
	}
	clocks, _ := b["itemUpdated"].(map[string]any)
	if clocks == nil {
		clocks = map[string]any{}
	}
	deleted, _ := b["itemDeleted"].(map[string]any)
	if deleted == nil {
		deleted = map[string]any{}
	}
	prev := map[string]map[string]any{}
	for _, item := range diaryItems(a) {
		prev[getString(item, "id")] = item
	}
	for _, item := range diaryItems(b) {
		id := getString(item, "id")
		if string(mustRaw(item)) != string(mustRaw(prev[id])) {
			clocks[id] = next.Updated
		}
		delete(prev, id)
	}
	for id := range prev {
		deleted[id] = next.Updated
	}
	b["itemUpdated"], b["itemDeleted"] = clocks, deleted
	next.Data, _ = json.Marshal(b)
}
