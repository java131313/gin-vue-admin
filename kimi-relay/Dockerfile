# Kimi 中继镜像：多阶段构建，产物仅几 MB
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod main.go ./
RUN go build -trimpath -ldflags="-s -w" -o relay .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/relay /relay
EXPOSE 8080
ENTRYPOINT ["/relay"]
