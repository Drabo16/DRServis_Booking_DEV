/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'], // Pro Google avatary
  },
  // serverActions jsou defaultně zapnuté v Next.js 14, není potřeba je konfigurovat

  // Optimalizace pro dev mód
  swcMinify: true,
  reactStrictMode: true,

  // modularizeImports pro lucide-react způsobuje problémy s Turbopackem
  // TODO: Povolit až bude Turbopack stabilní
  // modularizeImports: {
  //   'lucide-react': {
  //     transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
  //     skipDefaultConversion: true,
  //   },
  // },
}

module.exports = nextConfig
