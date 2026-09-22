package accounts

import (
	"context"
	"errors"
	"testing"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/test/testdb"
)

func TestGet(t *testing.T) {
	pool := testdb.Connect(t)
	store := NewStore(pool)
	ctx := context.Background()

	free := testdb.NewUser(t, pool, plans.Free)
	pro := testdb.NewUser(t, pool, plans.Pro)

	for id, want := range map[string]plans.Plan{free: plans.Free, pro: plans.Pro} {
		a, err := store.Get(ctx, id)
		if err != nil || a.ID != id || a.Plan != want {
			t.Errorf("Get(%s) = %+v, %v; want plan %s", id, a, err, want)
		}
	}
	if _, err := store.Get(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing account: %v, want ErrNotFound", err)
	}
}
