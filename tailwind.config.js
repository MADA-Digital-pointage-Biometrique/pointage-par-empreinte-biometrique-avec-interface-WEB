/** @type {import('tailwindcss').Config} */
// Portage statique de frontend/assets/js/theme.js (ancien CDN Play).
// Rebuild : npm run build:css
module.exports = {
    darkMode: "class",
    content: [
        "./frontend/**/*.php",
        "./frontend/assets/js/**/*.js",
    ],
    // Tailles dynamiques de icon() (app.js) : text-[${size}px] non détectable au scan
    safelist: ['text-[16px]', 'text-[18px]', 'text-[20px]', 'text-[22px]', 'text-[24px]', 'text-[32px]'],
    theme: {
        extend: {
            "colors": {
                "orange-main": "#F46A21",
                "orange-gold": "#F9AE3F",
                "text-dark": "#303030",
                "bg-light": "#FFFFFF",
                "bg-subtle": "#F7F8FA",
                "orange-accent": "#FFF1E8",
                "primary": "#F46A21",
                "secondary": "#F9AE3F",
                "tertiary": "#FFF1E8",
                "background": "#F7F8FA",
                "surface": "#FFFFFF",
                "on-surface": "#303030",
                "on-background": "#303030",
                "on-primary": "#FFFFFF",
                "secondary-container": "#F46A21",
                "on-secondary-container": "#FFFFFF",
                "primary-container": "#FFF1E8",
                "on-primary-container": "#F46A21",
                "surface-variant": "#FFF1E8",
                "outline": "#E2E8F0",
                "error": "#BA1A1A",
                "bg-app": "#111827",
                "bg-surface": "#1F2937",
                "bg-surface-2": "#111827",
                "bg-black-100": "#000000",
                "border-default": "#374151",
                "border-strong": "#374151",
                "text-primary": "#F9FAFB",
                "text-secondary": "#9CA3AF",
                "text-on-accent": "#FFFFFF",
                "accent-default": "#3B82F6",
                "accent-hover": "#2563EB",
                "accent-weak": "#1E40AF",
                "status-success-bg": "#15803D",
                "status-success-fg": "#DCFCE7",
                "status-done-bg": "#FEE2E2",
                "status-done-fg": "#B91C1C",
                "status-warning-bg": "#FEF9C3",
                "status-warning-fg": "#A16207",
                "status-info-bg": "#FCE7FD",
                "status-info-fg": "#E527E9",
                "status-paid-bg": "#ECFEFF",
                "status-paid-fg": "#22D3EE",
                "status-danger-bg": "#F7EBF0",
                "status-danger-fg": "#BB5785",
                "status-noshow-bg": "#F5EBEF",
                "status-noshow-fg": "#BB7696",
                "status-nonight-bg": "#FFEDD5",
                "status-nonight-fg": "#F97316",
                "status-free-bg": "#EDE9FE",
                "status-free-fg": "#6D28D9"
            },
            "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "2xl": "1rem",
                "3xl": "1.5rem",
                "full": "9999px"
            },
            "spacing": {
                "container-max": "1440px",
                "sm": "8px",
                "2xl": "48px",
                "xl": "32px",
                "xs": "4px",
                "lg": "24px",
                "md": "16px",
                "gutter": "24px",
                "base": "4px"
            },
            "fontFamily": {
                "body-md": ["Inter"],
                "label-md": ["Inter"],
                "headline-sm": ["Inter"],
                "body-lg": ["Inter"],
                "headline-md": ["Inter"],
                "mono-data": ["Inter"],
                "display-lg": ["Inter"]
            },
            "fontSize": {
                "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
                "headline-sm": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
                "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                "mono-data": ["14px", { "lineHeight": "20px", "fontWeight": "500" }],
                "display-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }]
            }
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
};
