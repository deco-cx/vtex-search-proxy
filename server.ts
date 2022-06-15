import { RouterContext } from "https://deno.land/x/oak@v10.6.0/mod.ts";
import {
  Application,
  bold,
  createServerTimingMiddleware,
  cyan,
  green,
  HttpError,
  magenta,
  red,
  Router,
  yellow,
} from "./deps.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const dev = Deno.env.get("DEVELOPMENT") === "true";
const hostname = dev ? "vtex-search-proxy.local" : "vtex-search-proxy.deno.dev";
const searchURL = (account: string, search: string, restQueryString?: string) =>
  `https://deco.vtexcommercestable.com.br/api/catalog_system/pub/products/search/${search}?an=${account}&${restQueryString}`;
const productURL = (account: string, linkText: string) =>
  `https://deco.vtexcommercestable.com.br/api/catalog_system/pub/products/search/${linkText}/p?an=${account}`;
const { start, end, serverTimingMiddleware } = createServerTimingMiddleware();
const app = new Application();

app.use(serverTimingMiddleware);

// Error handler middleware
app.use(async (context, next) => {
  try {
    await next();
  } catch (e) {
    if (e instanceof HttpError) {
      // deno-lint-ignore no-explicit-any
      context.response.status = e.status as any;
      if (e.expose || dev) {
        context.response.body = { status: e.status, message: e.message };
      } else {
        context.response.body = { status: e.status };
      }
    } else if (e instanceof Error) {
      context.response.status = 500;
      context.response.body = { error: e.message };
      console.log("Unhandled Error:", red(bold(e.message)));
      console.log(e.stack);
    }
  }
});

// Logger
app.use(async (context, next) => {
  await next();
  const rt = context.response.headers.get("X-Response-Time");
  console.log(
    `${green(context.response.status.toString())} ${
      green(context.request.method)
    } ${cyan(context.request.url.pathname)}${
      yellow(context.request.url.search)
    } - ${
      bold(
        String(rt),
      )
    }`,
  );
});

// Response Time
app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  context.response.headers.set("X-Response-Time", `${ms}ms`);
});

// Create an oak Router
const router = new Router();

const notFound = (context: RouterContext<any>) => {
  context.response.status = 404;
  context.response.body = null;
};

router.get("/", (context) => {
  context.response.body = {
    message: "Welcome to the VTEX Search Proxy!",
    routes: {
      search: "/:accountName/:search?qs=...",
      product: "/:accountName/:linkText/p",
    },
    ref: "https://developers.vtex.com/vtex-rest-api/reference/productsearch",
  };
});

router.get("/apple-touch-icon-precomposed.png", notFound);
router.get("/apple-touch-icon.png", notFound);
router.get("/favicon.ico", async (context) => {
  let file;
  try {
    file = await Deno.open("public/favicon.ico", { read: true });
  } catch {
    context.response.status = 404;
    context.response.body = { error: "not found" };
    return;
  }

  context.response.headers.set("content-type", "image/x-icon");
  context.response.headers.set(
    "cache-control",
    "public, max-age=30, stale-while-revalidate=302400, stale-if-error=604800",
  );
  context.response.body = file.readable;
});

router.get("/:account/:search?", async (context) => {
  const { account, search } = context.params;
  const restQueryString = context.request.url.searchParams.toString();
  start("proxy");
  const originURL = searchURL(account, search || "", restQueryString);
  console.log(`${magenta("PROXY")} ${yellow(originURL)}`);
  const results = await fetch(originURL);
  end("proxy");
  results.headers.forEach((value, key) => {
    if (key.startsWith("x-vtex-")) {
      context.response.headers.set(key, value);
    }
  });
  context.response.headers.set(
    "content-type",
    "application/json; charset=utf-8",
  );
  context.response.headers.set(
    "cache-control",
    "public, max-age=30, stale-while-revalidate=302400, stale-if-error=604800",
  );
  context.response.body = results.body;
});

router.get("/:account/:linkText/p", async (context) => {
  const { account, linkText } = context.params;
  start("proxy");
  const originURL = productURL(account, linkText);
  console.log(`${magenta("PROXY")} ${yellow(originURL)}`);
  const results = await fetch(originURL);
  results.headers.forEach((value, key) => {
    if (key.startsWith("x-vtex-")) {
      context.response.headers.set(key, value);
    }
  });
  end("proxy");
  context.response.headers.set(
    "cache-control",
    "public, max-age=30, stale-while-revalidate=302400, stale-if-error=604800",
  );
  context.response.body = results.body;
});

app.use(router.routes());
app.use(router.allowedMethods());

// Log hello
app.addEventListener("listen", () => {
  console.log(`Listening on ${cyan(`http://${hostname}:${PORT}`)}`);
});

// Start server
await app.listen({ port: PORT });
