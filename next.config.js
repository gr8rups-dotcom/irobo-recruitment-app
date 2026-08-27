/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its built-in font files (Helvetica.afm etc.) from disk via
  // relative paths at runtime. Next's webpack bundling for API routes breaks
  // that lookup (ENOENT for the .afm files) unless pdfkit is kept external
  // and resolved from node_modules as-is instead of being bundled.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};
module.exports = nextConfig;
