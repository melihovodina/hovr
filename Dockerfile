# One image: the Go server serves the API and the exported client.

FROM node:22-alpine AS client
WORKDIR /client
RUN corepack enable
COPY client/package.json client/pnpm-lock.yaml client/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/ ./
# The canonical URL is baked into the export; deploys pass the real one.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm build

FROM golang:1.26-alpine AS server
WORKDIR /server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /hovr ./cmd

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 hovr
WORKDIR /app
COPY --from=server /hovr /app/hovr
COPY --from=client /client/out /app/client
USER hovr
ENV PORT=8080 STATIC_DIR=/app/client
EXPOSE 8080
CMD ["/app/hovr"]
