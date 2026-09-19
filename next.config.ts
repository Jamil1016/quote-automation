import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer (and its fontkit / png deps) must run in Node and not be
  // bundled by the route compiler.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
