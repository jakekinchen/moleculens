/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    // In development, proxy API calls to the live backend to avoid CORS issues.
    // When you deploy to Vercel / production, these rewrites are ignored
    // because the frontend and backend will be on different domains with CORS set up.
    return process.env.NODE_ENV === 'production'
      ? []
      : [
          {
            source: '/prompt/:path*',
            destination: 'https://api.moleculens.com/prompt/:path*',
          },
        ];
  },
};

module.exports = nextConfig; 