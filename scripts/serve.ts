const server = Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  async fetch(request) {
    const url = new URL(request.url);
    let requestPath: string;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (requestPath.split("/").some((segment) => segment === "..")) {
      return new Response("Not found", { status: 404 });
    }
    const path = requestPath === "/" ? "/index.html" : requestPath;
    const file = Bun.file(`dist${path}`);

    if (await file.exists()) {
      return new Response(file);
    }

    return new Response(Bun.file("dist/index.html"), { headers: { "content-type": "text/html; charset=utf-8" } });
  },
});

console.log(`Serving VC歌词分享网 at ${server.url}`);
