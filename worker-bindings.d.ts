// D1 is optional in the shared template; the AX dashboard uses bundled aggregates.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
