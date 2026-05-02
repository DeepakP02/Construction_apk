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
    card: '#FFFFFF',
    border: '#E2E8F0',          // Slate 200
    divider: '#F1F5F9',

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
};

export const SPACING = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
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
    card: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    medium: {
        shadowColor: '#1D4ED8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 8,
    },
    large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
    },
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
};
