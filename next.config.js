const createAnalyzer = require('@next/bundle-analyzer');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: getRemotePatterns(),
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
  },
};

if (process.env.ANALYZE === 'true') {
  const withAnalyzer = createAnalyzer({ enabled: true });
  module.exports = withAnalyzer(nextConfig);
} else {
  module.exports = nextConfig;
}

function getRemotePatterns() {
  // add here the remote patterns for your images
  const remotePatterns = [];

  if (SUPABASE_URL) {
    const hostname = new URL(SUPABASE_URL).hostname;
    remotePatterns.push({
      protocol: 'https',
      hostname,
    });
  }

  return IS_PRODUCTION
    ? remotePatterns
    : [
        {
          protocol: 'http',
          hostname: '127.0.0.1',
        },
      ];
}
