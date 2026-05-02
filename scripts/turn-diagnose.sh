#!/usr/bin/env bash
# TURN/STUN server diagnostic.
# Run this ON the TURN server (the box at 51.83.186.85) as root or with sudo.
# It dumps everything needed to debug why clients see code=701 timeouts.
# Usage:  sudo bash turn-diagnose.sh [turn_port]
# Default port: 3478

set -u
PORT="${1:-3478}"
TLS_PORT="${2:-5349}"

section() {
  printf '\n========== %s ==========\n' "$1"
}

run() {
  printf '$ %s\n' "$*"
  "$@" 2>&1 || printf '(exit %d)\n' "$?"
}

section "HOST INFO"
run uname -a
run cat /etc/os-release
run date
run uptime
run id

section "PUBLIC IP (as seen from the internet)"
run curl -4 -s --max-time 5 https://api.ipify.org
echo
run curl -6 -s --max-time 5 https://api64.ipify.org
echo

section "NETWORK INTERFACES & ROUTES"
run ip -4 addr
run ip -6 addr
run ip route

section "TURN PROCESS"
if command -v systemctl >/dev/null; then
  run systemctl status coturn --no-pager -l
fi
run pgrep -a turnserver
run pgrep -a coturn

section "LISTENING PORTS (UDP + TCP on $PORT, $TLS_PORT)"
if command -v ss >/dev/null; then
  run ss -ulnp
  run ss -tlnp
else
  run netstat -ulnp
  run netstat -tlnp
fi

section "PORT BINDING CHECK ($PORT)"
run ss -ulnp "sport = :$PORT"
run ss -tlnp "sport = :$PORT"

section "FIREWALL: iptables"
run iptables -L -n -v
run iptables -t nat -L -n -v
run ip6tables -L -n -v 2>/dev/null

section "FIREWALL: nftables"
run nft list ruleset

section "FIREWALL: ufw"
if command -v ufw >/dev/null; then
  run ufw status verbose
fi

section "FIREWALL: firewalld"
if command -v firewall-cmd >/dev/null; then
  run firewall-cmd --state
  run firewall-cmd --list-all
fi

section "COTURN CONFIG"
for f in /etc/turnserver.conf /etc/coturn/turnserver.conf /etc/default/coturn; do
  if [ -f "$f" ]; then
    printf '\n--- %s ---\n' "$f"
    grep -vE '^\s*(#|$)' "$f" || true
  fi
done

section "COTURN LOGS (last 80 lines)"
for f in /var/log/turnserver.log /var/log/coturn/turn.log /var/log/turn_*.log; do
  if ls $f >/dev/null 2>&1; then
    for path in $f; do
      printf '\n--- %s ---\n' "$path"
      tail -n 80 "$path" 2>&1 || true
    done
  fi
done
if command -v journalctl >/dev/null; then
  printf '\n--- journalctl -u coturn (last 80) ---\n'
  journalctl -u coturn --no-pager -n 80 2>&1 || true
fi

section "LOOPBACK STUN BINDING TEST (port $PORT)"
# Tries a STUN binding request from the box itself.
if command -v turnutils_stunclient >/dev/null; then
  run turnutils_stunclient -p "$PORT" 127.0.0.1
  PUBIP="$(curl -4 -s --max-time 5 https://api.ipify.org || true)"
  if [ -n "${PUBIP:-}" ]; then
    printf '\n# probing public IP %s\n' "$PUBIP"
    run turnutils_stunclient -p "$PORT" "$PUBIP"
  fi
else
  echo "turnutils_stunclient not installed (apt install coturn-utils or coturn package)"
fi

section "EXTERNAL REACHABILITY HINTS"
echo "From any other machine, run:"
echo "  nc -vzu <THIS_PUBLIC_IP> $PORT       # UDP probe"
echo "  nc -vz  <THIS_PUBLIC_IP> $PORT       # TCP probe"
echo "Or browser-side: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"

section "DONE"
echo "Copy this entire output and paste it back."
