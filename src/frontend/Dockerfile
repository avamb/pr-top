# syntax=docker/dockerfile:1.6
#
# Multi-stage frontend build.
#
# Stage 1 (build): uses the official Playwright image which ships Node.js and a
# pre-installed, patched Chromium. The build script runs `node scripts/prerender.mjs`
# which uses `import { chromium } from 'playwright'` to statically render public
# marketing routes (SEO Foundation F8/F9). Trying to bolt Chromium onto Alpine at
# build-time is fragile (many missing system libs), so we lean on the vendor image
# for the build step only.
#
# Stage 2 (runtime): standard nginx:alpine — nothing from stage 1 leaks in except
# the built `dist/` static assets. No Node, no Chromium, no Playwright in the
# final image, so runtime size stays roughly identical to the previous nginx-only
# image (~50 MB range, well under the +50 MB budget in F10).

# ---- Stage 1: Build the React app (with SEO prerender) ----
FROM mcr.microsoft.com/playwright:v1.61.1-jammy AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build).
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 avoids re-downloading Chromium —
# the base image already ships the matching browser build under /ms-playwright.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm ci

# Copy application source
COPY . .

# Build-time env vars (pass via docker-compose build args)
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

# Build the production bundle. The `build` script also runs:
#   - scripts/generate-og-image.mjs (sharp OG image, F7)
#   - scripts/prerender.mjs         (playwright/chromium prerender, F8/F9)
#   - scripts/generate-sitemap.mjs  (sitemap.xml, F2)
RUN npm run build

# ---- Stage 2: Serve with nginx ----
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage — this is the ONLY thing that crosses the
# stage boundary. Chromium, Node, and Playwright stay in the discarded builder.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
