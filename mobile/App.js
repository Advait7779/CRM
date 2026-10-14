import React, { useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { canAccessScreen } from './src/config/permissions';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { SidebarProvider } from './src/context/SidebarContext';
import { ModalBlurContext } from './src/context/ModalBlurContext';
import NotificationToast from './src/components/common/NotificationToast';
import SidebarDrawer from './src/components/navigation/SidebarDrawer';
import AppNavigator from './src/navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef();

const LINK_SCREENS = {
  '/accounts': 'Accounts',
  '/renewals': 'Renewals',
  '/tickets': 'Tickets',
  '/installations': 'Installations',
  '/leads': 'Leads',
  '/inventory': 'Inventory',
  '/employees': 'Employees',
  '/my-work': 'MyWork',
  '/hrms': 'Employees',
  '/users': 'Users'
};

function NotificationToastWrapper() {
  const { toastNotification, dismissToast, markRead } = useNotifications();
  const { user } = useAuth();
  if (!toastNotification) return null;

  const handlePress = () => {
    const item = toastNotification;
    dismissToast();
    if (item._id || item.id) {
      markRead(item._id || item.id);
    }
    if (navigationRef.isReady() && item.link) {
      if (item.link === '/tasks') navigationRef.navigate('MainTabs', { screen: 'TasksTab' });
      else if (item.link === '/customers' && canAccessScreen(user?.role, 'Customers')) navigationRef.navigate('MainTabs', { screen: 'CustomersTab' });
      else if (item.link === '/chat') navigationRef.navigate('MainTabs', { screen: 'ChatTab' });
      else {
        const screen = LINK_SCREENS[item.link];
        if (screen && canAccessScreen(user?.role, screen)) navigationRef.navigate(screen);
      }
    }
  };

  return (
    <NotificationToast
      notification={toastNotification}
      onDismiss={dismissToast}
      onPress={handlePress}
    />
  );
}

function MainApp() {
  const { isDark, colors } = useTheme();
  const blurTargetRef = useRef(null);

  return (
    <ModalBlurContext.Provider value={blurTargetRef}>
    <BlurTargetView ref={blurTargetRef} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.card} />
      <NotificationToastWrapper />
      <NavigationContainer
        ref={navigationRef}
        theme={{
          dark: isDark,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.danger
          }
        }}
      >
        <AppNavigator />
      </NavigationContainer>
      <SidebarDrawer navigationRef={navigationRef} />
    </BlurTargetView>
    </ModalBlurContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#f8fafc' }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <SidebarProvider>
              <MainApp />
            </SidebarProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
