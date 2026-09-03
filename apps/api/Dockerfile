FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --include-workspace-root
COPY packages/domain packages/domain
COPY apps/api apps/api
COPY apps/web apps/web
COPY fixtures fixtures
COPY tsconfig.base.json tsconfig.base.json
RUN npm run build -w @mi20/web

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --workspace=@mi20/domain --workspace=@mi20/api --include-workspace-root
COPY packages/domain packages/domain
COPY apps/api apps/api
COPY fixtures fixtures
COPY --from=build /app/apps/web/dist apps/web/dist
ENV AUTH_DISABLED=true
ENV PORT=5080
ENV WEB_DIST=/app/apps/web/dist
EXPOSE 5080
CMD ["npm", "run", "start", "-w", "@mi20/api"]
