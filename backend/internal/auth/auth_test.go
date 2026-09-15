package auth

import (
	"strings"
	"testing"
)

func TestHashPasswordAndVerifyPassword(t *testing.T) {
	password := "Correct-Horse-Battery-Staple!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("expected argon2id hash, got %q", hash)
	}
	if !VerifyPassword(hash, password) {
		t.Fatal("VerifyPassword() rejected the original password")
	}
	if VerifyPassword(hash, password+"x") {
		t.Fatal("VerifyPassword() accepted an incorrect password")
	}
}

func TestHashPasswordUsesUniqueSalt(t *testing.T) {
	password := "same-password"
	hash1, err := HashPassword(password)
	if err != nil {
		t.Fatalf("first hash error = %v", err)
	}
	hash2, err := HashPassword(password)
	if err != nil {
		t.Fatalf("second hash error = %v", err)
	}
	if hash1 == hash2 {
		t.Fatal("two password hashes were identical; salt is not unique")
	}
	if !VerifyPassword(hash1, password) || !VerifyPassword(hash2, password) {
		t.Fatal("one of the salted hashes could not be verified")
	}
}

func TestVerifyPasswordRejectsMalformedHash(t *testing.T) {
	cases := []string{
		"",
		"not-a-hash",
		"$bcrypt$invalid",
		"$argon2id$v=19$m=bad,t=3,p=2$salt$hash",
		"$argon2id$v=19$m=65536,t=3,p=2$%%%$%%%",
	}
	for _, tc := range cases {
		t.Run(tc, func(t *testing.T) {
			if VerifyPassword(tc, "password") {
				t.Fatal("VerifyPassword() accepted malformed encoded hash")
			}
		})
	}
}
