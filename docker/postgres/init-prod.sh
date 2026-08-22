#!/bin/sh
# Rola aplikacyjna dla produkcji. Hasło pochodzi ze zmiennej środowiskowej,
# nigdy z pliku w repozytorium.
set -e

if [ -z "$APP_DB_PASSWORD" ]; then
  echo "APP_DB_PASSWORD nie jest ustawione — przerywam inicjalizację." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
  CREATE ROLE kelbroo_app WITH LOGIN PASSWORD '$APP_DB_PASSWORD' NOBYPASSRLS;
SQL
