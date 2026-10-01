#!/usr/bin/env bash
# GridWorld dedicated server: install or update on an Ubuntu / Debian server (run as root), beside whatever else
# runs there. It touches nothing of the other apps: its own folder (/opt/gridworld), its own system user and
# systemd service (gridworld), its own Node.js inside its folder (the system's Node, if any, is left as it is),
# one port of its own (8517 by default; it stops if that port is taken). No web server, proxy or firewall
# setting is changed: put it behind your portal / reverse proxy yourself (it prints an example), or open the port.
#   curl -fsSL https://raw.githubusercontent.com/MrFischoeder/Gridworld/claude/new-session-lkzluz/deploy/install.sh | sudo bash
# Again later = update (the world and its clock are kept in /opt/gridworld/server/data).
# Settings (environment, optional): PORT (8517), HOST (0.0.0.0; 127.0.0.1 if only a proxy on this machine
# should reach it), SERVER_NAME, WORLD_SEED, BRANCH, DIR.
set -euo pipefail
REPO=${REPO:-https://github.com/MrFischoeder/Gridworld.git}
BRANCH=${BRANCH:-claude/new-session-lkzluz}
DIR=${DIR:-/opt/gridworld}
PORT=${PORT:-8517}
HOST=${HOST:-0.0.0.0}
SERVER_NAME=${SERVER_NAME:-GridWorld server}
NODE_VER=v22.12.0
SVC=/etc/systemd/system/gridworld.service

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
for c in git curl tar xz; do command -v $c >/dev/null || NEED="${NEED:-} $c"; done
if [ -n "${NEED:-}" ]; then
  echo "Installing:${NEED/xz/xz-utils}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ${NEED/xz/xz-utils} >/dev/null || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ${NEED/xz/xz-utils} >/dev/null; }
fi

# the port must be free, unless it is our own service already holding it (an update)
if ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q . && ! systemctl is-active -q gridworld 2>/dev/null; then
  echo "Port $PORT is already used by another program. Choose another: PORT=8518 (in front of bash)."; exit 1
fi
if [ -e "$DIR" ] && [ ! -d "$DIR/.git" ]; then echo "$DIR exists and is not GridWorld's. Choose another: DIR=/opt/gridworld-game"; exit 1; fi

# the game's own Node.js, inside its folder
case "$(uname -m)" in x86_64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) echo "Unsupported CPU $(uname -m)"; exit 1;; esac
NODE_DIR="$DIR-node"
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -v)" != "$NODE_VER" ]; then
  echo "Fetching Node.js $NODE_VER for the game (into $NODE_DIR)"
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-$ARCH.tar.xz" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
export PATH="$NODE_DIR/bin:$PATH"

if [ -d "$DIR/.git" ]; then
  echo "Updating $DIR"
  git -c safe.directory="$DIR" -C "$DIR" fetch -q --depth 1 origin "$BRANCH" && git -c safe.directory="$DIR" -C "$DIR" checkout -q -B "$BRANCH" FETCH_HEAD
else
  echo "Downloading the game into $DIR"
  git clone -q --branch "$BRANCH" --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"
echo "Building (a few minutes)"
npm ci --silent --no-audit --no-fund
npm run build --silent >/dev/null
mkdir -p server/data
id gridworld >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin gridworld
chown -R gridworld:gridworld "$DIR"

cat > "$SVC" <<UNIT
[Unit]
Description=GridWorld dedicated server
After=network-online.target
Wants=network-online.target

[Service]
User=gridworld
WorkingDirectory=$DIR
Environment=PORT=$PORT HOST=$HOST "SERVER_NAME=$SERVER_NAME" ${WORLD_SEED:+WORLD_SEED=$WORLD_SEED}
ExecStart=$NODE_DIR/bin/node server/main.mjs
Restart=always
RestartSec=3
MemoryMax=600M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q gridworld
systemctl restart gridworld
sleep 2
if ! systemctl is-active -q gridworld; then echo "The server did not start:"; journalctl -u gridworld -n 30 --no-pager; exit 1; fi
IP=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
cat <<MSG

GridWorld is running on port $PORT (other apps untouched).
  Directly:   http://$IP:$PORT/   (open TCP $PORT in the IONOS firewall policy for that)
  Locally:    curl http://127.0.0.1:$PORT/mp/info

Behind your portal / reverse proxy, e.g. at https://your-domain/gridworld/ (nginx):
  location /gridworld/ {
    proxy_pass http://127.0.0.1:$PORT/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_read_timeout 1h;
  }
(WebSockets must be allowed: the game talks over /gridworld/mp.)

Logs: journalctl -u gridworld -f · restart: systemctl restart gridworld · update: run this script again
Remove: systemctl disable --now gridworld; rm -rf $DIR $DIR-node $SVC; userdel gridworld
MSG
