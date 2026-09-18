# VUA — Linux CLI / Native Integration Status

**Date:** 2026-09-17  
**Status:** CLI integration configured; OS packaging remains open.

## Current implementation

The repository exposes the CLI through npm:

```json
"bin": {
  "vua": "./bin/vua.js"
}
```

The CLI entry point is a Node.js executable with a shebang and can be invoked through npm/npx or linked locally:

```bash
npm install
npm link
vua status
vua adapters
vua bench
vua verify proof.json
vua mcp
```

The runtime contains a Linux adapter and can execute in Linux environments including Alpine/PRoot and standard Linux userspace.

## What "native Linux" means here

Current state:

- direct Linux userspace execution: **YES**;
- CLI command `vua`: **YES**;
- npm package metadata/bin mapping: **YES**;
- Linux adapter: **YES**;
- MCP stdio/local HTTP integration: **YES**;
- standalone ELF executable: **NO**;
- Debian `.deb`: **NO**;
- RPM package: **NO**;
- Alpine `.apk`: **NO**;
- systemd unit installed by the package: **NO**.

Therefore the precise product language is **Linux-native CLI/runtime**, not "native ELF Linux binary".

## npm package status

`package.json` identifies the package as:

```text
@vortexfoundation/vua
```

and exposes the executable name:

```text
vua
```

The repository configuration is therefore prepared for npm packaging. Publication to the public registry is a separate release operation and must not be inferred from the presence of the `name` and `bin` fields.

## Linux integration target

The next packaging layer, if required, should provide:

```text
/usr/bin/vua
/etc/vua/                 optional system configuration
/usr/lib/vua/              optional runtime assets
/usr/lib/systemd/system/   optional VUA MCP service
```

with explicit ownership, permissions, uninstall behavior and a clean-install/restart test.

Until those artifacts exist, Linux integration should be documented as **application-level integration**, not OS-level distribution integration.
