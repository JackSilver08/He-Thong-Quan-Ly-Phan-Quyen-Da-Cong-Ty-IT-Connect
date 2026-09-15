.PHONY: dev up down fmt test start

# Khởi động toàn bộ hệ thống, build nếu cần.
start:
	docker compose up --build

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down

fmt:
	cd backend && gofmt -w ./cmd ./internal

test:
	cd backend && go test ./...
