import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // The TACLAB shop's own domain: proxy.ts marks its requests with x-taclab-shop and these
      // internal rewrites put /x under /shop/x. Not done in proxy.ts itself: behind Caddy the URL a
      // proxy sees (https://localhost) never matches the server's own origin (http://127.0.0.1), so
      // a proxy rewrite became an external fetch and failed. All beforeFiles rules run on the
      // rewritten path, hence "/:path+" before "/" (else "/" -> "/shop" -> "/shop/shop").
      beforeFiles: [
        { source: "/:path+", has: [{ type: "header", key: "x-taclab-shop" }], destination: "/shop/:path+" },
        { source: "/", has: [{ type: "header", key: "x-taclab-shop" }], destination: "/shop" },
      ],
    };
  },
};

export default nextConfig;
