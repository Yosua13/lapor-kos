# syntax=docker/dockerfile:1

FROM golang:1.25-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/lapor-kos-api ./cmd/api

FROM alpine:3.22

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget

COPY --from=builder /out/lapor-kos-api /app/lapor-kos-api

ENV PORT=8081
EXPOSE 8081

CMD ["/app/lapor-kos-api"]
