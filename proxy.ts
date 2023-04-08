import { getSetCookies, Request, setCookie } from "./deps.ts";

const hopByHop = [
  "Keep-Alive",
  "Transfer-Encoding",
  "TE",
  "Connection",
  "Trailer",
  "Upgrade",
  "Proxy-Authorization",
  "Proxy-Authenticate",
];

export const proxy = async (to: URL, req: Request) => {
  const url = new URL(req.url);
  const headers = new Headers(req.headers);

  hopByHop.forEach((h) => headers.delete(h));
  headers.set("origin", to.origin);
  headers.set("host", to.host);
  headers.set("x-forwarded-host", url.host);

  const response = await fetch(to, {
    headers,
    redirect: "manual",
    method: req.method,
  });

  // Change cookies domain
  const responseHeaders = new Headers(response.headers);
  const cookies = getSetCookies(responseHeaders);
  responseHeaders.delete("set-cookie");
  for (const cookie of cookies) {
    setCookie(responseHeaders, { ...cookie, domain: url.hostname });
  }

  return {
    body: response.body,
    status: response.status,
    headers: responseHeaders,
  };
};
