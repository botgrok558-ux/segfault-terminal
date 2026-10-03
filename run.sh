#!/usr/bin/env bash
# Start/restart the $SEGFAULT terminal in the background on the box.
cd "$(dirname "$0")"
PIDFILE=data/server.pid
mkdir -p data
if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then kill "$(cat $PIDFILE)"; sleep 0.5; fi
PORT="${PORT:-8080}" nohup node server.js >> data/server.log 2>&1 &
echo $! > "$PIDFILE"
sleep 1
tail -n 1 data/server.log
