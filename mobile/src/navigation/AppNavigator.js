import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View } from 'react-native';

// Auth Stack
import LoginScreen from '../screens/auth/LoginScreen';

// Main App Navigation
import BottomTabs from './BottomTabs';
import CustomerDetailScreen from '../screens/customers/CustomerDetailScreen';
import ChatConversationScreen from '../screens/chat/ChatConversationScreen';
import LeadsScreen from '../screens/leads/LeadsScreen';
import RenewalsScreen from '../screens/renewals/RenewalsScreen';
import QuotationsScreen from '../screens/quotations/QuotationsScreen';
import AccountsScreen from '../screens/accounts/AccountsScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import InstallationsScreen from '../screens/installations/InstallationsScreen';
import TicketsScreen from '../screens/tickets/TicketsScreen';
import EmployeesScreen from '../screens/employees/EmployeesScreen';
import MyWorkScreen from '../screens/employees/MyWorkScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import UsersScreen from '../screens/users/UsersScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import GlobalSearchScreen from '../screens/system/GlobalSearchScreen';
import NotificationsScreen from '../screens/system/NotificationsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 240,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'fade', animationDuration: 220 }}
        />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={BottomTabs} />
          <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
          <Stack.Screen name="ChatConversation" component={ChatConversationScreen} />
          <Stack.Screen name="Leads" component={LeadsScreen} />
          <Stack.Screen name="Renewals" component={RenewalsScreen} />
          <Stack.Screen name="Quotations" component={QuotationsScreen} />
          <Stack.Screen name="Accounts" component={AccountsScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Installations" component={InstallationsScreen} />
          <Stack.Screen name="Tickets" component={TicketsScreen} />
          <Stack.Screen name="Employees" component={EmployeesScreen} />
          <Stack.Screen name="MyWork" component={MyWorkScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Users" component={UsersScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="GlobalSearch"
            component={GlobalSearchScreen}
            options={{ animation: 'fade_from_bottom', animationDuration: 220 }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ animation: 'slide_from_bottom', animationDuration: 220 }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
