/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            animation: {
                'fadeIn': 'fadeIn 0.3s ease-out both',
                'slideUp': 'slideUp 0.35s ease-out both',
                'scaleIn': 'scaleIn 0.25s ease-out both',
                'shimmer': 'shimmer 1.6s ease-in-out infinite',
                'spin': 'spin 1s linear infinite',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
                shimmer: { '0%': { backgroundPosition: '-600px 0' }, '100%': { backgroundPosition: '600px 0' } },
            },
            scale: { '102': '1.02', '103': '1.03' },
            borderWidth: { '0.5': '0.5px' },
        },
    },
    plugins: [],
}