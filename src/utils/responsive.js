import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design scale basis (e.g., iPhone 11/12)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales a size based on screen width.
 * Useful for horizontal padding, width, etc.
 */
export const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales a size based on screen height.
 * Useful for vertical padding, height, etc.
 */
export const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Scales a size moderately.
 * Useful for font sizes, border radius, etc.
 */
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Device characterization
 */
export const isSmallPhone = SCREEN_WIDTH < 360;
export const isTablet = SCREEN_WIDTH > 768;
export const isIOS = Platform.OS === 'ios';

/**
 * Safe area responsive padding helper
 * (Actually better to use useSafeAreaInsets inside components)
 */

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

/**
 * Scales font size moderately and clamps to 85–115% of base.
 * Prevents illegibly small text on SE or oversized text on Max devices.
 */
export const fontScale = (size) => {
    const scaled = moderateScale(size, 0.4);
    const min = size * 0.85;
    const max = size * 1.15;
    return Math.round(Math.min(Math.max(scaled, min), max) * 10) / 10;
};

/** True for phones with width < 380pt (iPhone SE, older 4.7" devices) */
export const isCompactDevice = SCREEN_WIDTH < 380;

