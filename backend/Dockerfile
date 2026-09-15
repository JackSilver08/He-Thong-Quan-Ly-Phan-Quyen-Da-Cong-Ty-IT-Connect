FROM golang:1.27.1 AS build
WORKDIR /src

# Copy the module definition first so Docker can cache the dependency layer.
COPY go.mod ./

# Copy source before resolving the module graph. This is intentional: `go mod tidy`
# needs the actual imports to produce a complete, reproducible module graph and go.sum.
COPY . .
RUN go mod tidy
RUN go mod download
RUN go mod verify
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/it-connect-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/it-connect-api /app/it-connect-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/it-connect-api"]
