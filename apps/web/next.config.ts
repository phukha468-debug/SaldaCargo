import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saldacargo/ui", "@saldacargo/shared-types", "@saldacargo/api-client", "@saldacargo/constants"],
};

export default nextConfig;
