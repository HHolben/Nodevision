<!-- Nodevision/ApplicationSystem/Sync/WiredSyncDiagnostics.md -->
<!-- This document inventories the wired and direct-network sync implementation and describes a safe diagnostic workflow that avoids changing sync state or transferring private Notebook contents. -->

# Wired Sync Diagnostics

This note inventories the current wired/direct-network sync implementation and documents the new safe diagnostic workflow. The diagnostics are read-only: they do not run sync, transfer Notebook file contents, apply manifests, import packages, edit trusted peers, disable the firewall, or change NetworkManager connections.

## Existing Architecture

Wired mode is selected in the Sync Panel at `ApplicationSystem/public/PanelInstances/InfoPanels/SyncPanel.mjs`. The visible label is `Direct / USB Ethernet`, and the normalized transport value is `usb`. The panel also supports `Wireless + Direct`, normalized as `combined`, which sends both the wireless/LAN peer URL and the wired/direct peer URL for the same trusted device.

The UI stores transport state in browser local storage:

- `nodevision.sync.syncTransport`
- `nodevision.sync.peerUrl`
- `nodevision.sync.wirelessPeerUrl`
- `nodevision.sync.usbPeerUrl`

Transport normalization lives in `ApplicationSystem/public/SyncTransportSettings.mjs` and `ApplicationSystem/server/routes/syncPanelRoutes.mjs`. Values such as `usb`, `usb-network`, `usb ethernet`, `direct`, and `direct network` normalize to `usb`. Values such as `combined`, `hybrid`, `wifi+ethernet`, and `wireless + direct` normalize to `combined`.

Peer discovery is implemented by `ApplicationSystem/Sync/PeerDiscovery.mjs`. It uses UDP over IPv4, not mDNS. The defaults are:

- discovery port: `39000`
- multicast group: `239.255.255.250`
- listener bind address: `0.0.0.0`
- broadcaster bind address: `0.0.0.0`
- broadcast fallback: `255.255.255.255`
- advertised HTTP port: explicit option, then `process.env.PORT`, then `3000`

Direct/USB mode also probes explicit and inferred HTTP peer URLs from `ApplicationSystem/server/routes/syncPanelRoutes.mjs`. Candidate hosts come from non-wireless local IPv4 interfaces, ARP entries, common USB/direct addresses, and any manually entered peer URL. Probes call `GET /api/peer/status`.

Actual wired sync uses the same `HttpSyncTransport` class as LAN sync: `ApplicationSystem/Sync/SyncTransport.mjs`. USB Network is an alias for direct HTTP peer sync, not a separate transport implementation. Combined mode uses `MultiEndpointHttpSyncTransport` from the same module after the server probes the requested endpoints and verifies they identify as the selected peer. Read operations can use the first successful endpoint, while write operations are distributed across the configured endpoints rather than duplicated. Combined mode does not stripe bytes from a single file across both links; it combines available paths at the sync-operation level. `HttpSyncTransport` calls:

- `GET /api/peer/status`
- `POST /api/peer/scope/manifest`
- `POST /api/peer/scope/file-get`
- `POST /api/peer/scope/file-push`

Peer URL construction is split between `getPeerUrlFromDiscoveredPeer()` in `ApplicationSystem/public/SyncTransportSettings.mjs`, `buildDiscoveredPeerUrl()` in `ApplicationSystem/server/routes/syncPanelRoutes.mjs`, and the new diagnostic helper `buildPeerUrl()` in `ApplicationSystem/Sync/WiredSyncDiagnostics.mjs`.

Express listen binding is configured by `ApplicationSystem/core/runtimeNetworkConfig.mjs` and `ApplicationSystem/core/runtime.js`. The default runtime host is `127.0.0.1`, but `ApplicationSystem/Desktop/nodevision-open.sh` starts desktop mode with `HOST="${HOST:-0.0.0.0}"`. The CLI and Electron entrypoints default to `127.0.0.1` unless `HOST` or runtime config overrides it. A peer cannot reach Nodevision over Ethernet if the server is listening only on loopback.

No Fedora firewall management code was found in the sync implementation. Firewall diagnostics are observational only.

## Discovery Dependencies

Current sync discovery depends on:

- mDNS: no current Nodevision sync dependency found.
- UDP broadcast/multicast: yes, via `PeerDiscovery.mjs`.
- Subnet probing: partially, for direct/USB HTTP status probes derived from non-wireless IPv4 interfaces and common direct-link hosts.
- Configured peer URL: yes, required for strict direct/USB sync requests. Combined mode can accept `peerUrls[]`, `wirelessPeerUrl`, and `usbPeerUrl`; it works best when both wireless and direct URLs are filled in.
- IPv4 link-local: supported as an address class; direct cable setups without DHCP commonly need IPv4 link-local or static IPv4 on both laptops.
- IPv6 link-local: detected by diagnostics; existing peer URL helpers have limited support because IPv6 link-local URLs need a zone identifier.
- NetworkManager metadata: not required by code; Fedora commands are documented only as optional operator diagnostics.

## Important Mismatch Found

Before this change, direct HTTP discovery in `syncPanelRoutes.mjs` expected `localDevice.publicKey` or `publicKey` from `GET /api/peer/status`. The public status route used `getLocalPeerInfo()`, but `getLocalPeerInfo()` returned only `deviceId` and `deviceName`. That meant an explicit HTTP status probe could reach the peer and still be discarded because no public key was present. This was a schema mismatch, not a missing route. `getLocalPeerInfo()` now includes `publicKey`, matching UDP discovery behavior where the public key is already advertised.

## Route Inventory

| Stage | Method | Route | Authentication required | Expected success | Source file |
| ----- | ------ | ----- | ----------------------- | ---------------- | ----------- |
| Public diagnostic ping | GET | `/api/sync/diagnostics/ping` | No | `200` JSON identifying Nodevision sync diagnostics, protocol version, public identity summary, port, timestamp | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Public diagnostic ping alias | GET | `/api/peer/diagnostics/ping` | No | `200` JSON identifying Nodevision sync diagnostics, protocol version, public identity summary, port, timestamp | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Public capability hint | GET | `/api/sync/capabilities` | No | `200` JSON with protocol version, supported transports, supported sync modes, protected-mode flags | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Public capability hint alias | GET | `/api/peer/capabilities` | No | `200` JSON with protocol version, supported transports, supported sync modes, protected-mode flags | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Public peer status | GET | `/api/peer/status` | No for public status; localhost/session includes trusted-peer status list | `200` JSON with local device identity and sync capability flags | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Signed peer hello | POST | `/api/peer/hello` | Signed trusted peer | `200` JSON with peer and signed response; updates trusted peer last-seen/hello status | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic signed peer authentication | POST | `/api/sync/diagnostics/peer-auth` | Signed trusted peer | `200` JSON showing trust, public-key, signature, and timestamp decisions without trust-record writes | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic signed peer authentication alias | POST | `/api/peer/diagnostics/peer-auth` | Signed trusted peer | `200` JSON showing trust, public-key, signature, and timestamp decisions without trust-record writes | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic signed capabilities | POST | `/api/sync/diagnostics/capabilities` | Signed trusted peer | `200` JSON with authenticated capability metadata only | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic signed capabilities alias | POST | `/api/peer/diagnostics/capabilities` | Signed trusted peer | `200` JSON with authenticated capability metadata only | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Legacy SyncTest manifest | POST | `/api/peer/manifest` | Signed trusted peer | `200` JSON full SyncTest manifest; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Scoped manifest | POST | `/api/peer/scope/manifest` | Signed trusted peer | `200` JSON full scoped manifest; normal sync route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped manifest summary | POST | `/api/sync/diagnostics/scope-manifest-summary` | Signed trusted peer | `200` JSON with manifest entry count, declared bytes, and small sanitized sample only | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped manifest summary alias | POST | `/api/peer/diagnostics/scope-manifest-summary` | Signed trusted peer | `200` JSON with manifest entry count, declared bytes, and small sanitized sample only | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Legacy SyncTest file get | POST | `/api/peer/file-get` | Signed trusted peer | `200` JSON with file content; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Legacy SyncTest file push | POST | `/api/peer/file-push` | Signed trusted peer; protected mode can block | `200` JSON after writing a SyncTest file; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Scoped JSON file get | POST | `/api/peer/scope/file-get` | Signed trusted peer | `200` JSON with file content; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Scoped JSON file push | POST | `/api/peer/scope/file-push` | Signed trusted peer; protected mode can block | `200` JSON after writing scoped file content; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Scoped stream file get | GET | `/api/peer/scope/file-stream` | Signed trusted peer | `200` binary stream; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped stream auth validation | POST | `/api/sync/diagnostics/scope-file-stream-auth` | Signed trusted peer | `200` JSON after auth, timestamp, scope, and relative-path validation, before file read | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped stream auth validation alias | POST | `/api/peer/diagnostics/scope-file-stream-auth` | Signed trusted peer | `200` JSON after auth, timestamp, scope, and relative-path validation, before file read | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped stream push auth validation | POST | `/api/sync/diagnostics/scope-file-stream-push-auth` | Signed trusted peer | `200` JSON or protected-mode `403` after auth, timestamp, scope, and relative-path validation, before file write | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Diagnostic scoped stream push auth validation alias | POST | `/api/peer/diagnostics/scope-file-stream-push-auth` | Signed trusted peer | `200` JSON or protected-mode `403` after auth, timestamp, scope, and relative-path validation, before file write | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Scoped stream file push | POST | `/api/peer/scope/file-stream-push` | Signed trusted peer; protected mode can block | `200` JSON after writing streamed content; diagnostics do not call this route | `ApplicationSystem/server/routes/peerRoutes.mjs` |
| Sync Panel status | GET | `/api/sync/status` | Local UI session | `200` JSON with discovery state, discovered peers, and USB/direct interface diagnostics | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel wired diagnostics | POST | `/api/sync/diagnostics/wired` | Local UI session | `200` or `409` JSON diagnostic report; performs no sync action | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel discovery scanning | POST | `/api/sync/discovery/scanning` | Local UI session | `200` JSON after starting/stopping discovery listener and optional direct HTTP probes | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel discovery discoverable | POST | `/api/sync/discovery/discoverable` | Local UI session | `200` JSON after starting/stopping discovery broadcaster and optional direct HTTP probes | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel select peer | POST | `/api/sync/select-peer` | Local UI session | `200` JSON after selecting an already discovered peer | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel trust peer | POST | `/api/sync/trust-peer` | Local UI session; user action | `200` JSON after writing TrustedPeers.json; diagnostics do not call this route | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel preflight | POST | `/api/sync/preflight` | Local UI session plus signed peer requests | `200` JSON dry-run plan; diagnostics do not apply sync | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel run | POST | `/api/sync/run` | Local UI session plus signed peer requests | `200` JSON; default dry run is true but route can apply sync | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |
| Sync Panel job start | POST | `/api/sync/jobs/start` | Local UI session plus signed peer requests | `202` JSON job; can apply sync when dryRun is false | `ApplicationSystem/server/routes/syncPanelRoutes.mjs` |

Routes newly added for this diagnostic work are `/api/sync/diagnostics/ping`, `/api/sync/capabilities`, `/api/sync/diagnostics/peer-auth`, `/api/sync/diagnostics/capabilities`, `/api/sync/diagnostics/scope-manifest-summary`, `/api/sync/diagnostics/scope-file-stream-auth`, `/api/sync/diagnostics/scope-file-stream-push-auth`, peer-family aliases under `/api/peer/diagnostics/*` plus `/api/peer/capabilities`, and `/api/sync/diagnostics/wired`. The CLI and UI prefer the `/api/peer/*` diagnostic aliases, then fall back to `/api/sync/*` for compatibility. The prior Sync Panel did not reference these routes. The prior direct HTTP discovery/schema mismatch was `/api/peer/status` lacking the public key that the discovery probe expected.

## CLI Usage

```bash
node scripts/diagnose-wired-sync.mjs local
node scripts/diagnose-wired-sync.mjs peer --url http://PEER_IP:3000
node scripts/diagnose-wired-sync.mjs endpoint --url http://PEER_IP:3000 --route /api/peer/diagnostics/ping
node scripts/diagnose-wired-sync.mjs full --url http://PEER_IP:3000 --output wired-diagnostic-local-to-peer.json
node scripts/diagnose-wired-sync.mjs discovery --duration-ms 7000 --output wired-discovery.json
node scripts/diagnose-wired-sync.mjs compare report-a.json report-b.json
```

Every command prints structured JSON followed by a short summary. Required-stage failures return a nonzero process exit code.

Result statuses are `pass`, `fail`, `warning`, `skipped`, and `not-applicable`. Each failure includes a stable code, plain-language explanation, evidence, next recommended test, and problem location (`local`, `remote`, `directional`, or `unknown`).

## Diagnostic Stages

The full diagnostic runs in strict order:

1. Ethernet hardware and link state
2. Network interface detection
3. Address assignment
4. Local routing
5. Firewall accessibility observation
6. Nodevision server binding
7. Raw HTTP reachability
8. Public peer-identification endpoints
9. Signed peer-authentication endpoints
10. Trust and identity validation
11. Discovery logic
12. Sync manifest exchange
13. Individual transport components

The diagnostic stops required downstream peer checks when the first required network or identity layer cannot succeed, but it preserves all evidence collected so far.

## Failure Classifications

The diagnostic code registry includes:

```text
WIRED_ADAPTER_NOT_FOUND
WIRED_LINK_NO_CARRIER
WIRED_INTERFACE_DOWN
WIRED_ADDRESS_MISSING
WIRED_SUBNET_MISMATCH
WIRED_ROUTE_MISSING
PEER_HOST_UNREACHABLE
PEER_PORT_REFUSED
PEER_CONNECTION_TIMEOUT
DIRECTIONAL_CONNECTIVITY_FAILURE
LOCAL_SERVER_NOT_RUNNING
LOCAL_SERVER_LOOPBACK_ONLY
LOCAL_SERVER_PORT_MISMATCH
FIREWALL_SUSPECTED
DIAGNOSTIC_ROUTE_MISSING
DIAGNOSTIC_ROUTE_PROTECTED
PEER_ROUTE_NOT_FOUND
PEER_PROTOCOL_MISMATCH
PEER_IDENTITY_MISSING
PEER_IDENTITY_DUPLICATE
PEER_NOT_TRUSTED
PEER_PUBLIC_KEY_MISMATCH
PEER_SIGNATURE_REJECTED
PEER_TIMESTAMP_REJECTED
PEER_SCOPE_REJECTED
PROTECTED_MODE_REJECTED
MANIFEST_REQUEST_FAILED
EXPLICIT_CONNECTION_SUCCEEDED
AUTOMATIC_DISCOVERY_FAILED
```

## Local Diagnostics

`local` reports every non-loopback interface using `/sys/class/net`, `/proc/net/route`, and `os.networkInterfaces()`. It redacts MAC addresses, classifies IPv4/IPv6 scope, detects default routes, checks carrier and administrative state, detects likely USB Ethernet interfaces, and selects the most likely direct wired interface.

Address failures are reported as address-configuration failures, not discovery failures. If a direct cable has no DHCP server, both laptops need either IPv4 link-local addresses in `169.254.0.0/16` or explicit static IPv4 addresses on the same subnet.

Server binding is checked through `/proc/net/tcp` and `/proc/net/tcp6` where available. The diagnostic distinguishes no listener, loopback-only listener, all-IPv4 listener, selected-interface listener, IPv6-only listener, and port mismatch.

The local endpoint self-test first calls `http://127.0.0.1:<port>/api/peer/diagnostics/ping`, falling back to `/api/sync/diagnostics/ping`; when a wired IPv4 address exists, it repeats the same candidate test through `http://<local-wired-ip>:<port>`.

## Remote Diagnostics

`peer` and `full` require an explicit peer base URL. The staged order is:

- TCP connect to host and port, classifying `ENETUNREACH`, `EHOSTUNREACH`, `ECONNREFUSED`, `ETIMEDOUT`, connection reset, and malformed URLs.
- Public diagnostic ping.
- Public peer status.
- Public capability hint.
- Local signing identity check.
- Signed diagnostic peer-auth check without trust-record mutation.
- Signed capability-only check.
- Duplicate device identity check.
- Signed manifest summary request with counts and declared bytes only.
- Signed stream-auth validation that stops before file read.
- Signed stream-push auth validation that stops before file write and reports protected-mode rejection separately.

No actual file-get, file-push, file-stream, package import, or sync apply route is called by diagnostics.

## Bidirectional Reports

Run a `full` report on both laptops and compare the JSON files:

```bash
node scripts/diagnose-wired-sync.mjs full \
  --url http://<framework13-wired-ip>:<port> \
  --output wired-diagnostic-framework12-to-framework13.json

node scripts/diagnose-wired-sync.mjs full \
  --url http://<framework12-wired-ip>:<port> \
  --output wired-diagnostic-framework13-to-framework12.json

node scripts/diagnose-wired-sync.mjs compare \
  wired-diagnostic-framework12-to-framework13.json \
  wired-diagnostic-framework13-to-framework12.json
```

Comparison detects one-way reachability, loopback-only binding, one-way trust, duplicate identity, protocol mismatch, subnet mismatch, and explicit-IP success with automatic discovery failure.

## Discovery Diagnostics

`discovery` runs a bounded UDP diagnostic and records candidate interfaces, local addresses considered, advertisements sent, advertisements received, endpoint responses, duplicate peer handling, errors, timeouts, and the final peer list. It is bounded by `--duration-ms` and does not continuously log packets.

For UDP discovery, confirm that UDP port `39000` is allowed on the wired interface's Fedora firewalld zone and that broadcasts/multicast are not being routed only through Wi-Fi. For explicit URL mode, treat manual connection as explicit connectivity, not automatic discovery.

## Sync Panel Diagnostics

The Sync Panel now shows a Wired Diagnostics section only in `Direct / USB Ethernet` mode. It can:

- detect wired interfaces
- test the local server
- test a peer URL
- run full diagnostics
- export the latest JSON report

The panel shows the first blocking layer and keeps per-stage results visible, allowing it to distinguish:

```text
Explicit connection works; automatic discovery failed.
```

from:

```text
The peer server cannot be reached over the wired interface.
```

## Automated Tests

`ApplicationSystem/Sync/test-wired-sync-diagnostics.mjs` covers:

- IPv4 and IPv6 peer URL construction, including bracketed IPv6 and IPv6 link-local zone identifiers.
- Rejection of localhost and invalid ports for remote peer URLs.
- Non-loopback interface selection that does not prefer Wi-Fi just because Wi-Fi has the default route.
- Link-local IPv4 reporting and missing IPv4 reporting.
- Diagnostic endpoint registration.
- Directional comparison reporting.

## Fedora Two-Machine Procedure

Run the following non-destructive commands on both laptops.

### 1. Inspect Link And Addresses

```bash
ip -brief link
```

Success: the USB Ethernet interface is present, not loopback, and shows `UP` or a state consistent with carrier. Failure: no Ethernet-like interface appears, the interface is `DOWN`, or link state stays `NO-CARRIER`.

```bash
ip -brief address
```

Success: each wired interface has an IPv4 address, either `169.254.x.y/16` or static private addresses on the same subnet. Failure: no IPv4 address appears, or the two laptops are on different subnets.

```bash
ip route
```

Success: there is a connected route for the wired subnet on the wired interface. Failure: no route exists for the peer's subnet, or the route points to Wi-Fi.

```bash
nmcli device status
nmcli connection show
```

Success: NetworkManager sees the adapter and connection. Failure: the adapter is unmanaged, disconnected, or has no address configuration.

### 2. Inspect Nodevision Listening State

```bash
ss -lntp
```

Success: Nodevision is listening on the configured TCP port on `0.0.0.0:<port>` or the wired IP. Failure: it is absent, on a different port, only on `127.0.0.1:<port>`, or only on IPv6 when the peer URL is IPv4.

### 3. Inspect Firewall Without Permanent Changes

```bash
firewall-cmd --get-active-zones
firewall-cmd --list-all
```

Success: the active zone for the wired interface allows the Nodevision TCP port and, for automatic UDP discovery, UDP `39000`. Failure: the wired interface is in a restrictive zone without those ports/services.

Do not permanently disable firewalld for diagnostics. If a temporary confirmation is needed, use a time-limited rule that expires automatically, choosing the actual active zone and Nodevision port:

```bash
sudo firewall-cmd --zone=<zone> --add-port=<nodevision-port>/tcp --timeout=5m
sudo firewall-cmd --zone=<zone> --add-port=39000/udp --timeout=5m
```

The TCP port is needed by the Nodevision HTTP server. UDP `39000` is needed only for automatic discovery beacons.

### 4. Test Basic Peer Reachability

From Framework 12:

```bash
ping -I <framework12-wired-interface> <framework13-wired-ip>
curl -v http://<framework13-wired-ip>:<port>/api/peer/diagnostics/ping
node scripts/diagnose-wired-sync.mjs full \
  --url http://<framework13-wired-ip>:<port> \
  --output wired-diagnostic-framework12-to-framework13.json
```

From Framework 13:

```bash
ping -I <framework13-wired-interface> <framework12-wired-ip>
curl -v http://<framework12-wired-ip>:<port>/api/peer/diagnostics/ping
node scripts/diagnose-wired-sync.mjs full \
  --url http://<framework12-wired-ip>:<port> \
  --output wired-diagnostic-framework13-to-framework12.json
```

Ping success proves only ICMP reachability. It does not prove TCP, HTTP, Nodevision route registration, authentication, trust, or discovery.

### 5. Compare Both Directions

Copy both report files onto one laptop or shared folder, then run:

```bash
node scripts/diagnose-wired-sync.mjs compare \
  wired-diagnostic-framework12-to-framework13.json \
  wired-diagnostic-framework13-to-framework12.json
```

Then test automatic discovery separately:

```bash
node scripts/diagnose-wired-sync.mjs discovery --duration-ms 7000 --output wired-discovery-framework12.json
node scripts/diagnose-wired-sync.mjs discovery --duration-ms 7000 --output wired-discovery-framework13.json
```

If explicit IP diagnostics pass but discovery produces `AUTOMATIC_DISCOVERY_FAILED`, focus next on UDP `39000`, multicast/broadcast routing, interface selection, duplicate suppression, and Fedora firewalld zone assignment.

## Current Findings

Code inspection confirmed one application-layer mismatch: direct HTTP discovery expected `/api/peer/status` to expose a public key, but the route did not include one before this change. That has been corrected.

The supplied Fedora outputs also narrowed the physical and network layers. StarBook eventually had `enp0s13f0u1` on `169.254.42.12/16` with a connected `169.254.0.0/16` route, and Theseus2 had `enp0s13f0u3` on `169.254.42.13/16` with the matching route. Both Nodevision processes were listening on `0.0.0.0:3000`. That means the first confirmed failing layer is no longer Ethernet carrier, address assignment, routing, or server binding.

The first reproduced application failure was StarBook reaching Theseus2 by explicit URL, then receiving a generic `401 Unauthorized` from `/api/sync/diagnostics/ping` and failing signed diagnostic peer auth. The patch therefore registers equivalent `/api/peer/*` diagnostic aliases, prefers those aliases in the CLI and Sync Panel direct probe, and classifies a generic diagnostic `401` as `DIAGNOSTIC_ROUTE_PROTECTED` instead of a misleading signature failure.

Remaining hypotheses, ranked by current evidence:

1. One running Nodevision process is from an older checkout or was not restarted after the diagnostic routes were added.
2. A route or auth middleware is protecting `/api/sync/*`; `/api/peer/diagnostics/ping` should confirm whether the peer route family is reachable.
3. Trust is configured in only one direction, or a trusted public key no longer matches the peer identity.
4. Explicit IP works, but automatic UDP discovery still selects, advertises, or de-duplicates the wrong address.
5. Fedora firewalld blocks UDP `39000`, affecting automatic discovery even when TCP `3000` works.

Do not consider wired sync fixed until both explicit peer URL diagnostics and automatic discovery have passed in both directions on the two Fedora laptops.
