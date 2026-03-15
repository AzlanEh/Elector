#!/usr/bin/env node
/**
 * Detects the current LAN IP and writes it to apps/native/.env
 * Run before `expo start` to avoid stale IP issues with DHCP.
 */
import { networkInterfaces } from "os";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../apps/native/.env");

function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    // Skip loopback and virtual interfaces (docker, bridge, etc.)
    if (/^(lo|docker|br-|virbr|vmnet)/.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const ip = getLanIp();
if (!ip) {
  console.error("Could not detect LAN IP. Is the network interface up?");
  process.exit(1);
}

const content = `EXPO_PUBLIC_SERVER_URL=http://${ip}:3000\n`;
writeFileSync(envPath, content, "utf8");
console.log(`apps/native/.env updated: EXPO_PUBLIC_SERVER_URL=http://${ip}:3000`);
