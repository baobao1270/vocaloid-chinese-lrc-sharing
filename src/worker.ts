export interface Env {
  ASSETS: Fetcher;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/health") {
      return Promise.resolve(Response.json({ ok: true }));
    }

    return env.ASSETS.fetch(request);
  },
};
