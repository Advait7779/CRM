import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { Platform, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import TabScreenTransition from '../components/common/TabScreenTransition';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare
} from 'lucide-react-native';

const Tab = createBottomTabNavigator();

// Wrap tab screens with smooth 60fps fade + translateY entrance transition
function withTabTransition(Component) {
  return function AnimatedTabScreen(props) {
    return (
      <TabScreenTransition>
        <Component {...props} />
      </TabScreenTransition>
    );
  };
}

const AnimatedDashboard = withTabTransition(DashboardScreen);
const AnimatedCustomers = withTabTransition(CustomersScreen);
const AnimatedChatList = withTabTransition(ChatListScreen);
const AnimatedTasks = withTabTransition(TasksScreen);

// Tactile spring-animated tab button for smooth responsive tab switching
function AnimatedTabBarButton({ children, onPress, accessibilityState, style, ...rest }) {
  const isSelected = Boolean(accessibilityState?.selected);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 130,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isSelected, scaleAnim]);

  const handlePress = (e) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 130,
        useNativeDriver: true,
      }),
    ]).start();
    if (onPress) onPress(e);
  };

  return (
    <TouchableOpacity
      {...rest}
      accessibilityState={accessibilityState}
      onPress={handlePress}
      activeOpacity={0.8}
      style={[style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BottomTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Provide extra clearance for Android 3-button navigation (toggle buttons) and iOS home indicator
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 14);
  const tabHeight = 56 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        }
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AnimatedDashboard}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size || 22} color={color} />
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={AnimatedCustomers}
        options={{
          tabBarLabel: 'Customers',
          tabBarIcon: ({ color, size }) => <Users size={size || 22} color={color} />
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={AnimatedChatList}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size || 22} color={color} />
        }}
      />
      <Tab.Screen
        name="TasksTab"
        component={AnimatedTasks}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size || 22} color={color} />
        }}
      />
    </Tab.Navigator>
  );
}
