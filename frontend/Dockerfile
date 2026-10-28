FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY templates/ ./
COPY static/ ./static/
COPY templates/login.html ./index.html

EXPOSE 80
