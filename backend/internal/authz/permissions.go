package authz

import (
	"errors"
	"sort"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type Permission string

const (
	PermissionPropertyRead     Permission = "property.read"
	PermissionPropertyUpdate   Permission = "property.update"
	PermissionPropertyArchive  Permission = "property.archive"
	PermissionMembershipRead   Permission = "membership.read"
	PermissionMembershipManage Permission = "membership.manage"

	PermissionRoomRead   Permission = "room.read"
	PermissionRoomWrite  Permission = "room.write"
	PermissionRoomDelete Permission = "room.delete"

	PermissionTenantRead   Permission = "tenant.read"
	PermissionTenantWrite  Permission = "tenant.write"
	PermissionTenantDelete Permission = "tenant.delete"

	PermissionContractRead   Permission = "contract.read"
	PermissionContractWrite  Permission = "contract.write"
	PermissionContractDelete Permission = "contract.delete"

	PermissionPaymentRead   Permission = "payment.read"
	PermissionPaymentWrite  Permission = "payment.write"
	PermissionPaymentVerify Permission = "payment.verify"

	PermissionComplaintRead  Permission = "complaint.read"
	PermissionComplaintWrite Permission = "complaint.write"
	PermissionHouseRuleRead  Permission = "house_rule.read"
	PermissionHouseRuleWrite Permission = "house_rule.write"
	PermissionReportRead     Permission = "report.read"
	PermissionCalendarRead   Permission = "calendar.read"
	PermissionFileRead       Permission = "file.read"
	PermissionFileWrite      Permission = "file.write"
)

var ErrUnknownPermission = errors.New("unknown property permission")

var knownPermissions = []Permission{
	PermissionPropertyRead,
	PermissionPropertyUpdate,
	PermissionPropertyArchive,
	PermissionMembershipRead,
	PermissionMembershipManage,
	PermissionRoomRead,
	PermissionRoomWrite,
	PermissionRoomDelete,
	PermissionTenantRead,
	PermissionTenantWrite,
	PermissionTenantDelete,
	PermissionContractRead,
	PermissionContractWrite,
	PermissionContractDelete,
	PermissionPaymentRead,
	PermissionPaymentWrite,
	PermissionPaymentVerify,
	PermissionComplaintRead,
	PermissionComplaintWrite,
	PermissionHouseRuleRead,
	PermissionHouseRuleWrite,
	PermissionReportRead,
	PermissionCalendarRead,
	PermissionFileRead,
	PermissionFileWrite,
}

var rolePermissions = map[model.PropertyRole]map[Permission]struct{}{
	model.PropertyRoleOwner: permissionSet(knownPermissions...),
	model.PropertyRoleManager: permissionSet(
		PermissionPropertyRead,
		PermissionPropertyUpdate,
		PermissionMembershipRead,
		PermissionRoomRead,
		PermissionRoomWrite,
		PermissionRoomDelete,
		PermissionTenantRead,
		PermissionTenantWrite,
		PermissionTenantDelete,
		PermissionContractRead,
		PermissionContractWrite,
		PermissionContractDelete,
		PermissionPaymentRead,
		PermissionComplaintRead,
		PermissionComplaintWrite,
		PermissionHouseRuleRead,
		PermissionHouseRuleWrite,
		PermissionReportRead,
		PermissionCalendarRead,
		PermissionFileRead,
		PermissionFileWrite,
	),
	model.PropertyRoleFinance: permissionSet(
		PermissionPropertyRead,
		PermissionRoomRead,
		PermissionTenantRead,
		PermissionContractRead,
		PermissionPaymentRead,
		PermissionPaymentWrite,
		PermissionPaymentVerify,
		PermissionReportRead,
		PermissionCalendarRead,
		PermissionFileRead,
	),
	model.PropertyRoleMaintenance: permissionSet(
		PermissionPropertyRead,
		PermissionRoomRead,
		PermissionComplaintRead,
		PermissionComplaintWrite,
		PermissionHouseRuleRead,
		PermissionCalendarRead,
		PermissionFileRead,
		PermissionFileWrite,
	),
	model.PropertyRoleViewer: permissionSet(
		PermissionPropertyRead,
		PermissionRoomRead,
		PermissionContractRead,
		PermissionPaymentRead,
		PermissionComplaintRead,
		PermissionHouseRuleRead,
		PermissionReportRead,
		PermissionCalendarRead,
	),
}

func permissionSet(permissions ...Permission) map[Permission]struct{} {
	set := make(map[Permission]struct{}, len(permissions))
	for _, permission := range permissions {
		set[permission] = struct{}{}
	}
	return set
}

func IsKnown(permission Permission) bool {
	for _, candidate := range knownPermissions {
		if permission == candidate {
			return true
		}
	}
	return false
}

// NormalizePermissions validates, trims, de-duplicates, and sorts explicit
// membership grants so API and database values remain deterministic.
func NormalizePermissions(values []string) ([]string, error) {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		if normalized == "" {
			continue
		}
		if !IsKnown(Permission(normalized)) {
			return nil, ErrUnknownPermission
		}
		set[normalized] = struct{}{}
	}

	result := make([]string, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Strings(result)
	return result, nil
}

func HasPermission(role model.PropertyRole, explicitGrants []string, required Permission) bool {
	if !IsKnown(required) {
		return false
	}
	if defaults, ok := rolePermissions[role]; ok {
		if _, allowed := defaults[required]; allowed {
			return true
		}
	}
	for _, grant := range explicitGrants {
		if Permission(strings.TrimSpace(grant)) == required {
			return true
		}
	}
	return false
}

func HasAll(role model.PropertyRole, explicitGrants []string, required ...Permission) bool {
	for _, permission := range required {
		if !HasPermission(role, explicitGrants, permission) {
			return false
		}
	}
	return true
}

func EffectivePermissions(role model.PropertyRole, explicitGrants []string) []string {
	set := make(map[string]struct{})
	if defaults, ok := rolePermissions[role]; ok {
		for permission := range defaults {
			set[string(permission)] = struct{}{}
		}
	}
	for _, grant := range explicitGrants {
		permission := Permission(strings.TrimSpace(grant))
		if IsKnown(permission) {
			set[string(permission)] = struct{}{}
		}
	}

	result := make([]string, 0, len(set))
	for permission := range set {
		result = append(result, permission)
	}
	sort.Strings(result)
	return result
}

func AllPermissions() []string {
	result := make([]string, 0, len(knownPermissions))
	for _, permission := range knownPermissions {
		result = append(result, string(permission))
	}
	sort.Strings(result)
	return result
}
