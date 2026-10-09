# pnpm 12's npm installer requires Node >=22.13; Vite 7 requires >=22.12.
FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app

RUN npm install --global pnpm@12.8.1 \
    && test "$(pnpm --version)" = "12.8.1"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Public, build-time configuration: baked into JS, never a secret.
# Dokploy must provide this build argument; runtime env cannot change it.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN node --input-type=module -e '\
    const value = process.env.VITE_API_URL; \
    const fail = () => { \
      console.error("VITE_API_URL is required: supply an absolute http(s) API base URL without credentials, whitespace, query or fragment."); \
      process.exit(1); \
    }; \
    if (!value || /\s/.test(value)) fail(); \
    let url; \
    try { url = new URL(value); } catch { fail(); } \
    if (!/^https?:\/\//i.test(value) || !["https:", "http:"].includes(url.protocol) \
        || !url.hostname || url.username || url.password || value.includes("?") || value.includes("#")) fail();'

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.js ./
COPY src ./src
COPY public ./public
RUN pnpm run build

FROM nginx:1.28.3-alpine AS runtime
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
# Bypass entrypoint scripts that mutate configuration at startup.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
