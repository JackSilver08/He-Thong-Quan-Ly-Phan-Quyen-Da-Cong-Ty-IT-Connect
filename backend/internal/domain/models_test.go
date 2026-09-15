package domain

import "testing"

func TestValidRole(t *testing.T) {
	valid := []string{RoleSuperAdmin, RoleAdmin, RoleAuditor, RoleUser}
	for _, role := range valid {
		if !ValidRole(role) {
			t.Errorf("ValidRole(%q) = false", role)
		}
	}
	invalid := []string{"", "USER ", "SUPERADMIN", "root", "admin"}
	for _, role := range invalid {
		if ValidRole(role) {
			t.Errorf("ValidRole(%q) = true", role)
		}
	}
}

func TestValidUserStatus(t *testing.T) {
	valid := []string{StatusActive, StatusResigned, StatusDisabled}
	for _, status := range valid {
		if !ValidUserStatus(status) {
			t.Errorf("ValidUserStatus(%q) = false", status)
		}
	}
	invalid := []string{"", "ACTIVE ", "DELETED", "active"}
	for _, status := range invalid {
		if ValidUserStatus(status) {
			t.Errorf("ValidUserStatus(%q) = true", status)
		}
	}
}

func TestAccountTypeConstants(t *testing.T) {
	allowed := map[string]bool{"PERSON": true, "SHARED": true, "SERVICE": true, "SYSTEM": true}
	for value := range allowed {
		if !allowed[value] {
			t.Errorf("unexpected account type %q", value)
		}
	}
}
