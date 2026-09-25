// Node module hooks: resolve @minecraft/server to the mock and load the addon scripts as ES modules
export async function resolve(specifier, context, next) {
  if (specifier === "@minecraft/server") return { url: new URL("./mock-server.mjs", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.includes("/TojiBP/scripts/")) return { ...(await next(url, { ...context, format: "module" })), format: "module" };
  return next(url, context);
}
