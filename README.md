# VTEX Search API Smart Proxy

Proxies requests to the VTEX public Search API, adding some missing features,
trimming responses and better caching strategies.

This proxy can be used as a data source for [deco](https://deco.cx) pages.

### Running locally

Create a `.env` file to enable development mode:

```
DEVELOPMENT=true
```

### Future

[] Reflection on JSON response to build out TypeScript types offered by each
route, automatically.
