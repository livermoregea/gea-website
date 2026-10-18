/** @type {import('next').NextConfig} */
// Allow release verification to build without sharing a running dev server’s output.
const nextConfig = { distDir: process.env.GEA_NEXT_DIST_DIR || ".next" };
export default nextConfig;
