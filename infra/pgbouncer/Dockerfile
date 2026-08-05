FROM alpine:3.20

RUN addgroup -S pgbouncer \
    && adduser -S -G pgbouncer pgbouncer \
    && apk add --no-cache pgbouncer postgresql16-client \
    && mkdir -p /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer \
    && chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer

COPY entrypoint.sh /usr/local/bin/pgbouncer-entrypoint.sh

RUN sed -i 's/\r$//' /usr/local/bin/pgbouncer-entrypoint.sh \
    && chmod 0755 /usr/local/bin/pgbouncer-entrypoint.sh

USER pgbouncer

EXPOSE 6432

ENTRYPOINT ["/usr/local/bin/pgbouncer-entrypoint.sh"]