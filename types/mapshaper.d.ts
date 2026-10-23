// mapshaper ships without type declarations; only the programmatic API used by scripts/build-geo.ts.
declare module "mapshaper" {
  const mapshaper: {
    applyCommands(commands: string, input?: Record<string, unknown>): Promise<Record<string, string | Buffer>>;
  };
  export default mapshaper;
}
