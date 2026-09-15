package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env             string
	Port            string
	DatabaseURL     string
	JWTSecret       string
	JWTExpiresHours int
	CORSOrigins     []string
	AdminUsername   string
	AdminPassword   string
}

func Load() Config {
	hours := 8
	if v, err := strconv.Atoi(os.Getenv("JWT_EXPIRES_HOURS")); err == nil && v > 0 {
		hours = v
	}
	origins := []string{"http://localhost:3000"}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		origins = strings.Split(raw, ",")
	}
	return Config{
		Env:             getenv("APP_ENV", "development"),
		Port:            getenv("PORT", "8080"),
		DatabaseURL:     getenv("DATABASE_URL", "postgres://itconnect:itconnect@localhost:5432/itconnect?sslmode=disable"),
		JWTSecret:       getenv("JWT_SECRET", "development-secret"),
		JWTExpiresHours: hours,
		CORSOrigins:     origins,
		AdminUsername:   getenv("ADMIN_USERNAME", "admin"),
		AdminPassword:   getenv("ADMIN_PASSWORD", "Admin@123456"),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
