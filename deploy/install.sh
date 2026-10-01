#!/usr/bin/env bash
# GridWorld dedicated server: install or update on a fresh Ubuntu / Debian VPS (run as root).
#   curl -fsSL https://raw.githubusercontent.com/MrFischoeder/Gridworld/claude/new-session-lkzluz/deploy/install.sh | sudo bash
# Again later = update to the newest version (the world and its clock are kept in /opt/gridworld/server/data).
# Settings (environment, optional): BRANCH, PORT (8080), WORLD_SEED, SERVER_NAME, DOMAIN (a domain pointed at this
# VPS: then Caddy serves the game over https on 443 with a free certificate, and the port stays local).
set -euo pipefail
REPO=${REPO:-https://github.com/MrFischoeder/Gridworld.git}
BRANCH=${BRANCH:-claude/new-session-lkzluz}
DIR=${DIR:-/opt/gridworld}
PORT=${PORT:-8080}
SERVER_NAME=${SERVER_NAME:-GridWorld server}
DOMAIN=${DOMAIN:-}

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
id gridworld >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin gridworld

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"
npm ci --silent
npm run build --silent
mkdir -p server/data
chown -R gridworld:gridworld "$DIR"

LISTEN=0.0.0.0; [ -n "$DOMAIN" ] && LISTEN=127.0.0.1
cat > /etc/systemd/system/gridworld.service <<UNIT
[Unit]
Description=GridWorld dedicated server
After=network-online.target
Wants=network-online.target

[Service]
User=gridworld
WorkingDirectory=$DIR
Environment=PORT=$PORT HOST=$LISTEN "SERVER_NAME=$SERVER_NAME" ${WORLD_SEED:+WORLD_SEED=$WORLD_SEED}
ExecStart=/usr/bin/env node server/main.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q gridworld
systemctl restart gridworld

if [ -n "$DOMAIN" ]; then
  if ! command -v caddy >/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  printf '%s {\n\tencode gzip\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" > /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
  command -v ufw >/dev/null && ufw status | grep -q active && ufw allow 80/tcp && ufw allow 443/tcp || true
  URL="https://$DOMAIN/"
else
  command -v ufw >/dev/null && ufw status | grep -q active && ufw allow "$PORT/tcp" || true
  IP=$(curl -fsS -m 5 https://api.ipify.org || hostname -I | awk '{print $1}')
  URL="http://$IP:$PORT/"
fi
sleep 1
systemctl is-active -q gridworld && echo "GridWorld server is running: $URL" || { echo "The server did not start:"; journalctl -u gridworld -n 30 --no-pager; exit 1; }
echo "Logs: journalctl -u gridworld -f · restart: systemctl restart gridworld · update: run this script again"
