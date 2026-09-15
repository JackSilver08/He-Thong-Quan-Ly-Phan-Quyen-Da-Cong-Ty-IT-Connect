package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/config"
	"github.com/it-connect/access-management/internal/db"
	"github.com/it-connect/access-management/internal/handler"
	"github.com/it-connect/access-management/internal/middleware"
	"github.com/it-connect/access-management/internal/repository"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	repo := repository.New(pool)
	hash, err := auth.HashPassword(cfg.AdminPassword)
	if err != nil {
		slog.Error("hash admin password", "error", err)
		os.Exit(1)
	}
	if err := repo.EnsureAdmin(ctx, cfg.AdminUsername, hash); err != nil {
		slog.Error("ensure admin", "error", err)
		os.Exit(1)
	}

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := false
		for _, o := range cfg.CORSOrigins {
			if strings.TrimSpace(o) == origin {
				allowed = true
				break
			}
		}
		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})
	h := handler.New(repo, cfg)
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	api := r.Group("/api")
	api.POST("/auth/login", h.Login)
	protected := api.Group("")
	protected.Use(middleware.JWT(cfg.JWTSecret))
	protected.GET("/auth/me", h.Me)
	protected.GET("/dashboard", h.Dashboard)
	protected.GET("/companies", h.ListCompanies)
	protected.POST("/companies", h.CreateCompany)
	protected.DELETE("/companies/:id", h.DeleteCompany)
	protected.GET("/users", h.ListUsers)
	protected.POST("/users", h.CreateUser)
	protected.POST("/users/:id/resign", h.ResignUser)
	protected.GET("/projects", h.ListProjects)
	protected.POST("/projects", h.CreateProject)
	protected.GET("/permissions", h.ListPermissions)
	protected.POST("/permissions", h.SetPermission)
	protected.GET("/audit-logs", h.ListAudit)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		slog.Info("API listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error", err)
			os.Exit(1)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctxShutdown); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}
