/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable for socket.io compatibility
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
