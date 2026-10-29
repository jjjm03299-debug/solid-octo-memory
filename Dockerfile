FROM alpine:3.18

# Install Nginx and the NJS dynamic module via apk add
RUN apk update && \
    apk add nginx nginx-mod-http-js

# Copy configuration and script files
COPY nginx.conf /etc/nginx/nginx.conf
COPY cards.js /etc/nginx/cards.js
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
