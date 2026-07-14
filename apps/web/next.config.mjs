/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.*", "localhost"],
  webpack: (config) => {
    // pdfjs-dist (via react-pdf) optionally requires the native `canvas`
    // package for Node-side rendering; it's unused and unresolvable in the
    // browser bundle, so it must be aliased away instead of bundled.
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
