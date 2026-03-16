FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY locations.conf /etc/nginx/conf.d/locations.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
