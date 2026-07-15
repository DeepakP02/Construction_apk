// ══════════════════════════════════════════════════════
// BUILDMASTER PRO — Premium Light SaaS Theme
// ══════════════════════════════════════════════════════

export const COLORS = {
    // ── Core Brand ──────────────────────────────────────
    primary: '#2E3647',         // Dark Navy (Consistent across header/tab)
    primaryDark: '#1E293B',     // Deeper Slate (Dark mode variants)
    primaryAccent: '#3B82F6',   // Sky Blue (interactive) — alias for compatibility
    primaryLight: '#F1F5F9',    // Light Slate Tint (bg accents)

    // Badge Colors (for backward compat)
    badgeBlue: '#3B82F6',
    badgeGreen: '#16A34A',
    badgeRed: '#DC2626',
    badgeOrange: '#D97706',
    badgeTeal: '#0D9488',

    // ── Background / Surface ────────────────────────────
    background: '#F1F5F9',      // Slate 100 – clean page bg
    surface: '#FFFFFF',         // Cards, modals
    surfaceSecondary: '#F8FAFC', // Subtle secondary surface
    card: '#FFFFFF',
    border: '#E2E8F0',          // Slate 200
    divider: '#F1F5F9',
    separator: '#F1F5F9',       // Explicit separator alias

    // ── Text ────────────────────────────────────────────
    textPrimary: '#0F172A',     // Slate 900
    textSecondary: '#475569',   // Slate 600
    textMuted: '#94A3B8',       // Slate 400
    white: '#FFFFFF',
    black: '#000000',

    // ── Semantics ────────────────────────────────────────
    success: '#16A34A',         // Green 600
    successLight: '#DCFCE7',
    danger: '#DC2626',          // Red 600
    dangerLight: '#FEE2E2',
    warning: '#D97706',         // Amber 600
    warningLight: '#FEF3C7',
    info: '#0284C7',            // Sky 600
    infoLight: '#E0F2FE',

    // ── UI State ────────────────────────────────────────
    disabled: '#CBD5E1',        // Slate 300 – disabled elements
    inputBg: '#F9FAFB',         // Input background
    inputBorder: '#E2E8F0',     // Input border (rest)
    focusBorder: '#2E3647',     // Input border (focused) = primary

    // ── Gradients ───────────────────────────────────────
    headerGradient: ['#1E3A8A', '#1D4ED8'],   // deep navy → royal blue
    accentGradient: ['#3B82F6', '#1D4ED8'],
    greenGradient: ['#16A34A', '#15803D'],
    amberGradient: ['#D97706', '#B45309'],
};

export const SIZES = {
    radius: 16,
    radiusLg: 24,
    radiusXL: 32,
    // ── Standardised component radii ────────────────────
    radiusCard: 16,
    radiusBtn: 14,
    radiusInput: 14,
    radiusModal: 24,
    radiusBottomSheet: 24,
    radiusImage: 16,
};

export const SPACING = {
    xs: 4,
    s: 8,
    sm: 12,
    m: 16,
    md: 20,
    l: 24,
    xl: 32,
    '2xl': 40,
    xxl: 48,
};

// ── Typography Scale ────────────────────────────────────
// Consistent font sizes & weights across the entire app.
export const TYPOGRAPHY = {
    screenTitle:  { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
    cardTitle:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
    subtitle:     { fontSize: 16, fontWeight: '700' },
    body:         { fontSize: 15, fontWeight: '500' },
    caption:      { fontSize: 13, fontWeight: '600' },
    label:        { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
    badge:        { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
};

/** Layout tokens aligned with PM panels (floating tab bar + home indicator). */
export const LAYOUT = {
    /** Default ScrollView/FlatList paddingBottom so content clears the absolute tab bar */
    tabBarContentPadding: 100,
    /** Standard horizontal gutter for scroll pages */
    screenPaddingX: 16,
    screenPaddingXCompact: 12,
};

/**
 * @param {number} [insetsBottom=0] — useSafeAreaInsets().bottom
 * @returns {number} paddingBottom for vertical scroll content
 */
export function contentBottomForTabBar(insetsBottom = 0) {
    return Math.max(insetsBottom + 90, LAYOUT.tabBarContentPadding);
}

export const SHADOWS = {
    small: {
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    card: {
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    medium: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
        elevation: 6,
    },
    large: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
    },
};
