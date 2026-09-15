FROM golang:1.27.1 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/it-connect-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/it-connect-api /app/it-connect-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/it-connect-api"]
