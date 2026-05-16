# Monolith: Vite frontend + Express backend API, build from repository rootf

# ---- Stage 1: Build the SPA (Single Page Application) using Vite ----
# produces static HTML/CSS/JS assets in the 'dist' directory - copied into the final imaee as ./public
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY Frontend/ ./

# Empty = browser calls /api on the same host as the page (same domain as Express)
ENV VITE_API_URL=

# Public Clerk key (safe to pass as build-arg; it is embedded in client JS anyway)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm install --no-audit --no-fund \
  && npm run build


# ---- Stage 2: Complete API ( TypeScript + JavaScript ) -----
# Prpdices dist/ with index.js and the rest of the server bundle
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app
COPY Backend ./
RUN npm install --no-audit -no-fund \
&& npm run build



# --State 3: runtime image (only prod deps + build assets) ---
# Express serves API routes and static files from public/ (the vite build from stage )
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY Backend/package.json Backend/package-lock.json ./
RUN npm install --omit-dev --no-audit --no-fund && npm cache clean --force

COPY --from=backend-build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 3001
USER node

CMD [ "node", "dist/index.js" ]