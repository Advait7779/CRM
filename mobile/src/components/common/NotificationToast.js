import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const EMOJI_MAP = {
  task: '📋', ticket: '🎫', lead: '🎯', payment: '💰', 
  renewal: '🔄', invoice: '📄', leave: '🏖️', chat: '💬',
  customer: '👤', installation: '🔧', system: '🔔'
};

export default function NotificationToast({ notification, onPress, onDismiss }) {
  const { colors, fonts } = useTheme();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 5
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [notification, translateY, opacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy < -20) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -150,
              duration: 200,
              useNativeDriver: true
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true
            })
          ]).start(() => {
            if (onDismiss) onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 5
          }).start();
        }
      }
    })
  ).current;

  if (!notification) return null;

  const icon = EMOJI_MAP[notification.type] || EMOJI_MAP.system;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity
        }
      ]}
      {...panResponder.panHandlers}
    >
      <SafeAreaView>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          style={[
            styles.toast,
            {
              backgroundColor: colors.card,
              borderLeftColor: colors.primary,
            }
          ]}
        >
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={[styles.message, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={2}>
              {notification.message}
            </Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  toast: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
  }
});
