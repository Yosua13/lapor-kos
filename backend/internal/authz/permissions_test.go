package authz

import (
	"errors"
	"reflect"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

func TestRolePermissions(t *testing.T) {
	tests := []struct {
		name       string
		role       model.PropertyRole
		permission Permission
		want       bool
	}{
		{name: "owner can manage memberships", role: model.PropertyRoleOwner, permission: PermissionMembershipManage, want: true},
		{name: "manager cannot manage memberships", role: model.PropertyRoleManager, permission: PermissionMembershipManage, want: false},
		{name: "manager can manage rooms", role: model.PropertyRoleManager, permission: PermissionRoomWrite, want: true},
		{name: "finance can verify payments", role: model.PropertyRoleFinance, permission: PermissionPaymentVerify, want: true},
		{name: "finance cannot delete rooms", role: model.PropertyRoleFinance, permission: PermissionRoomDelete, want: false},
		{name: "maintenance can update complaints", role: model.PropertyRoleMaintenance, permission: PermissionComplaintWrite, want: true},
		{name: "viewer cannot write", role: model.PropertyRoleViewer, permission: PermissionHouseRuleWrite, want: false},
		{name: "unknown role has no defaults", role: model.PropertyRole("unknown"), permission: PermissionPropertyRead, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := HasPermission(test.role, nil, test.permission); got != test.want {
				t.Fatalf("HasPermission() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestExplicitGrantAndHasAll(t *testing.T) {
	grants := []string{string(PermissionRoomWrite)}
	if !HasPermission(model.PropertyRoleViewer, grants, PermissionRoomWrite) {
		t.Fatal("explicit known grant was not honored")
	}
	if !HasAll(model.PropertyRoleViewer, grants, PermissionPropertyRead, PermissionRoomWrite) {
		t.Fatal("HasAll rejected valid default plus explicit grant")
	}
	if HasAll(model.PropertyRoleViewer, grants, PermissionRoomWrite, PermissionTenantDelete) {
		t.Fatal("HasAll accepted a missing permission")
	}
}

func TestNormalizePermissions(t *testing.T) {
	got, err := NormalizePermissions([]string{
		"  " + string(PermissionRoomWrite) + " ",
		string(PermissionPaymentRead),
		string(PermissionRoomWrite),
	})
	if err != nil {
		t.Fatalf("NormalizePermissions() unexpected error: %v", err)
	}
	want := []string{string(PermissionPaymentRead), string(PermissionRoomWrite)}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("NormalizePermissions() = %#v, want %#v", got, want)
	}

	if _, err := NormalizePermissions([]string{"database.drop"}); !errors.Is(err, ErrUnknownPermission) {
		t.Fatalf("NormalizePermissions() error = %v, want ErrUnknownPermission", err)
	}
}

func TestEffectivePermissionsAreSortedAndUnique(t *testing.T) {
	got := EffectivePermissions(model.PropertyRoleViewer, []string{
		string(PermissionRoomWrite),
		string(PermissionRoomWrite),
		"unknown.permission",
	})
	for index := 1; index < len(got); index++ {
		if got[index-1] >= got[index] {
			t.Fatalf("effective permissions are not strictly sorted and unique: %#v", got)
		}
	}
	if !HasPermission(model.PropertyRoleViewer, got, PermissionRoomWrite) {
		t.Fatal("effective permissions omitted the explicit grant")
	}
}
