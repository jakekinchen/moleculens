/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // No dev-time rewrites are needed now that the API has been migrated to
  // Next.js route handlers under `/api`.
};

module.exports = nextConfig; 
