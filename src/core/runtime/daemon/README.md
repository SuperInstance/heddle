# Runtime Daemon

Owns local control-plane server discovery through the global daemon registry.
The registry service records two distinct facts:

- the one live local control-plane server, when one is registered
- known workspace descriptors that clients may target by request

Workspace records are catalog/identity facts. They must not imply server
ownership. Server liveness is top-level process state so TUI, web, daemon, and
future embedded hosts can all discover the same machine-level control plane.

Call `RuntimeDaemonRegistryService`, `RuntimeHostResolver`, and
`RuntimeHostMessages` directly. File I/O stays inside
`FileDaemonRegistryRepository`, and the persisted JSON contract lives in
`schemas.ts`.
