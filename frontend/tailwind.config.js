/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        // ── Responsive breakpoints ────────────────────────────────────────────
        screens: {
            'xs': '375px',
            'sm': '640px',
            'md': '768px',
            'lg': '1024px',
            'xl': '1280px',
            '2xl': '1536px',
            '3xl': '1920px',
            '4xl': '2560px',
        },
        extend: {
            // 👇 TAMBAHAN BARU: Kurva animasi khas Apple iOS
            transitionTimingFunction: {
                'apple-spring': 'cubic-bezier(0.25, 1.15, 0.4, 1)',
                'apple-ease': 'cubic-bezier(0.32, 0.72, 0, 1)',
            },
            // 👆 TAMBAHAN BARU SELESAI
            animation: {
                'fadeIn': 'fadeIn 0.3s ease-out both',
                'slideUp': 'slideUp 0.35s ease-out both',
                'scaleIn': 'scaleIn 0.25s ease-out both',
                'shimmer': 'shimmer 1.6s ease-in-out infinite',
                'spin': 'spin 1s linear infinite',
                'drawer': 'drawer 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
                'float-up': 'float-up 3s ease-in-out infinite',
                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                'shimmer-text': 'shimmer-text 3s linear infinite',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(200%)' }
                },
                drawer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
            },
            scale: {
                '102': '1.02',
                '103': '1.03',
            },
            borderWidth: {
                '0.5': '0.5px',
            },
            maxWidth: {
                '8xl': '88rem',
                '9xl': '96rem',
                '10xl': '120rem',
            },
            spacing: {
                'safe-t': 'env(safe-area-inset-top)',
                'safe-b': 'env(safe-area-inset-bottom)',
                'safe-l': 'env(safe-area-inset-left)',
                'safe-r': 'env(safe-area-inset-right)',
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.scrollbar-hide': {
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                },
                '.scrollbar-thin': {
                    'scrollbar-width': 'thin',
                },
                '.safe-area-pb': {
                    'padding-bottom': 'max(12px, env(safe-area-inset-bottom))',
                },
                '.safe-area-pt': {
                    'padding-top': 'env(safe-area-inset-top)',
                },

                // 👇 TAMBAHAN BARU: Class khusus untuk Apple Liquid Glass
                '.bg-liquid-glass': {
                    'background': 'linear-gradient(145deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.15) 100%)',
                    'backdrop-filter': 'blur(40px) saturate(200%) brightness(1.1)',
                    '-webkit-backdrop-filter': 'blur(40px) saturate(200%) brightness(1.1)',
                    'border': '0.5px solid rgba(255, 255, 255, 0.4)',
                    'box-shadow': 'inset 0 1px 1px rgba(255, 255, 255, 0.8), 0 4px 24px rgba(0, 0, 0, 0.08)',
                },
                '.dark .bg-liquid-glass': {
                    'background': 'linear-gradient(145deg, rgba(40, 40, 45, 0.45) 0%, rgba(20, 20, 25, 0.25) 100%)',
                    'border': '0.5px solid rgba(255, 255, 255, 0.12)',
                    'box-shadow': 'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 4px 24px rgba(0, 0, 0, 0.4)',
                },
                // 👆 TAMBAHAN BARU SELESAI
            });
        },
    ],
}