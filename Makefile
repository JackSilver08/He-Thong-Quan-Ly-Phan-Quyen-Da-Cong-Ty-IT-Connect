.PHONY: dev up down fmt test

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
