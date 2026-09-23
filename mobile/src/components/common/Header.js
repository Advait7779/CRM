import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import { ArrowLeft, Menu } from 'lucide-react-native';

export default function Header({
  title,
  subtitle,
  onBack,
  rightElement,
  showBack = false,
  showMenu
}) {
  const { colors, fonts } = useTheme();
  const { openSidebar } = useSidebar();

  const shouldShowBack = Boolean(showBack);
  const shouldShowMenu = showMenu !== undefined ? Boolean(showMenu) : !shouldShowBack;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.leftRow}>
        {shouldShowBack ? (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.cardSecondary }]}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
        ) : shouldShowMenu ? (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.cardSecondary }]}
            onPress={openSidebar}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.heading }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rightElement: {
    marginLeft: 10,
  }
});
