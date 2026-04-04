import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['nodemailer', 'tsdav', 'node-ical'],
};

export default nextConfig;
