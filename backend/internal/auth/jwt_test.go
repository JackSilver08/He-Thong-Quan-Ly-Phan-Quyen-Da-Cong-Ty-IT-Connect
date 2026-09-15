package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestIssueAndParseToken(t *testing.T) {
	secret := "test-secret"
	token, err := IssueToken(secret, "user-123", "admin", "ADMIN", 1)
	if err != nil {
		t.Fatalf("IssueToken() error = %v", err)
	}

	claims, err := ParseToken(secret, token)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.UserID != "user-123" || claims.Username != "admin" || claims.Role != "ADMIN" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.Time.After(time.Now()) {
		t.Fatal("token does not have a future expiry")
	}
}

func TestParseTokenRejectsWrongSecret(t *testing.T) {
	token, err := IssueToken("secret-a", "user-123", "alice", "USER", 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseToken("secret-b", token); err == nil {
		t.Fatal("ParseToken() accepted a token signed by a different secret")
	}
}

func TestParseTokenRejectsTampering(t *testing.T) {
	token, err := IssueToken("secret", "user-123", "alice", "USER", 1)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("unexpected JWT parts: %d", len(parts))
	}
	parts[1] = strings.TrimRight(parts[1], "=") + "tampered"
	tampered := strings.Join(parts, ".")
	if _, err := ParseToken("secret", tampered); err == nil {
		t.Fatal("ParseToken() accepted a tampered token")
	}
}

func TestParseTokenRejectsExpiredToken(t *testing.T) {
	claims := Claims{
		UserID: "user-123",
		Username: "alice",
		Role: "USER",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			IssuedAt: jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
		},
	}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseToken("secret", raw); err == nil {
		t.Fatal("ParseToken() accepted an expired token")
	}
}

func TestParseTokenRejectsUnexpectedSigningMethod(t *testing.T) {
	claims := Claims{
		UserID: "user-123",
		Username: "alice",
		Role: "USER",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS384, claims).SignedString([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseToken("secret", raw); err == nil {
		t.Fatal("ParseToken() accepted a token using HS384")
	}
}
