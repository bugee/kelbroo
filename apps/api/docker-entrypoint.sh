#!/bin/sh
set -e

# Prawa do katalogu ze zdjęciami dań.
#
# Wolumen Dockera zamontowany pod ścieżką, której nie ma w obrazie, powstaje
# jako `root:root` — a API chodzi jako `kelbroo` i nie ma czym do niego pisać.
# Objaw jest mylący: zdjęcia wgrane wcześniej **wyświetlają się** (są do
# odczytu dla wszystkich), a każde nowe wgranie kończy się błędem 500.
#
# Drugie źródło tych samych praw: zadanie `migrate` chodzi jako root i to ono
# wgrywa zdjęcia restauracji pokazowej. Dlatego naprawiamy przy **każdym**
# starcie, a nie tylko przy pierwszym.
#
# Kontener startuje jako root wyłącznie po to; do właściwego procesu schodzimy
# z powrotem na `kelbroo`.
if [ "$(id -u)" = '0' ]; then
  katalog="${MEDIA_ROOT:-/media}"
  mkdir -p "$katalog"
  chown -R kelbroo:kelbroo "$katalog"
  exec su-exec kelbroo "$@"
fi

exec "$@"
