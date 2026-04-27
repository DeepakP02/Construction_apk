import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

const CustomButton = ({ title, onPress, type = 'primary', loading = false, style, disabled = false }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const isPrimary = type === 'primary';

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.outer, style]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading || disabled}
                style={[
                    styles.container,
                    isPrimary ? styles.primary : styles.outline,
                    disabled && styles.disabled,
                ]}
            >
                {loading ? (
                    <ActivityIndicator color={isPrimary ? COLORS.white : COLORS.primary} />
                ) : (
                    <Text style={[styles.text, isPrimary ? styles.primaryText : styles.outlineText]}>
                        {title}
                    </Text>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    /** Lets flex + minWidth on parent rows size the button (width:100% breaks some flex rows). */
    outer: {
        alignSelf: 'stretch',
        minWidth: 72
    },
    container: {
        height: 52, // Standard professional height
        borderRadius: SIZES.radius,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 12,
        minWidth: 72
    },
    primary: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    outline: {
        backgroundColor: '#F1F5F9',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    primaryText: {
        color: COLORS.white, // White on dark navy primary
    },
    outlineText: {
        color: COLORS.primary,
    },

});

export default CustomButton;
