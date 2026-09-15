FROM golang:1.27.1 AS build
WORKDIR /src

ENV GOPROXY=https://proxy.golang.org,direct \
    GOSUMDB=sum.golang.org

COPY go.mod ./

# Resolve the module graph after the source is available. BuildKit caches the
# module and compiler caches so subsequent builds are much faster.
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    go mod download && \
    go mod verify && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/it-connect-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/it-connect-api /app/it-connect-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/it-connect-api"]
