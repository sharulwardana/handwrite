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
        // xs   : 375px  → HP kecil (iPhone SE, Galaxy A series)
        // sm   : 640px  → HP besar / landscape
        // md   : 768px  → Tablet portrait
        // lg   : 1024px → Tablet landscape / Laptop kecil
        // xl   : 1280px → Laptop
        // 2xl  : 1536px → Laptop L / Desktop
        // 3xl  : 1920px → Full HD / 4K
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
            animation: {
                'fadeIn': 'fadeIn 0.3s ease-out both',
                'slideUp': 'slideUp 0.35s ease-out both',
                'scaleIn': 'scaleIn 0.25s ease-out both',
                'shimmer': 'shimmer 1.6s ease-in-out infinite',
                'spin': 'spin 1s linear infinite',
                'drawer': 'drawer 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
                shimmer: { '0%': { backgroundPosition: '-600px 0' }, '100%': { backgroundPosition: '600px 0' } },
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
                // Content width di layar sangat lebar (4K / ultrawide)
                '8xl': '88rem',  // 1408px
                '9xl': '96rem',  // 1536px
                '10xl': '120rem', // 1920px
            },
            spacing: {
                // Safe area untuk mobile (notch, home indicator)
                'safe-t': 'env(safe-area-inset-top)',
                'safe-b': 'env(safe-area-inset-bottom)',
                'safe-l': 'env(safe-area-inset-left)',
                'safe-r': 'env(safe-area-inset-right)',
            },
        },
    },
    plugins: [
        // Plugin scrollbar-hide (agar tab bar mobile tidak tampilkan scrollbar)
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
                // Safe area padding untuk bottom nav di mobile
                '.safe-area-pb': {
                    'padding-bottom': 'max(12px, env(safe-area-inset-bottom))',
                },
                '.safe-area-pt': {
                    'padding-top': 'env(safe-area-inset-top)',
                },
            });
        },
    ],
}