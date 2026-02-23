/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "img-src 'self' data: blob: https://res.cloudinary.com",
                            "connect-src 'self' https://*.supabase.co http://localhost:5000 https://*.railway.app https://*.up.railway.app",
                            "font-src 'self' https://fonts.gstatic.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                        ].join('; ')
                    },
                ],
            }
        ]
    },
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '5000',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            }
        ],
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: false,
    }
}

module.exports = nextConfig