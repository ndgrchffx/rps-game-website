/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Matikan untuk socket.io compat
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Jangan bundle server-only packages ke client
};

export default nextConfig;
