import React from 'react';
import { View, TextInput, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { verticalScale, moderateScale } from '../utils/responsive';

const CustomInput = ({ label, placeholder, value, onChangeText, secureTextEntry, error, icon, keyboardType, autoCapitalize, ...props }) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
            <View style={[
                styles.inputContainer,
                error && styles.errorInput,
                isFocused && styles.focusedInput
            ]}>
                {icon && (
                    <MaterialCommunityIcons
                        name={icon}
                        size={moderateScale(20)}
                        color={isFocused ? COLORS.focusBorder : COLORS.textSecondary}
                        style={styles.icon}
                    />
                )}
                <TextInput
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry}
                    style={styles.input}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.m,
        width: '100%',
    },
    label: {
        color: COLORS.textSecondary,
        ...TYPOGRAPHY.label,
        marginBottom: SPACING.s,
        marginLeft: 4,
    },
    inputContainer: {
        height: Math.max(verticalScale(52), 48),
        backgroundColor: COLORS.inputBg,
        borderRadius: SIZES.radiusInput,
        borderWidth: 1.5,
        borderColor: COLORS.inputBorder,
        paddingHorizontal: SPACING.m,
        flexDirection: 'row',
        alignItems: 'center',
    },
    focusedInput: {
        borderColor: COLORS.focusBorder,
        backgroundColor: '#EFF6FF',
    },
    icon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: moderateScale(15),
        fontWeight: '500',
    },
    errorInput: {
        borderColor: COLORS.danger,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: moderateScale(12),
        marginTop: SPACING.xs,
        marginLeft: 4,
        fontWeight: '600',
    },
});

export default CustomInput;

