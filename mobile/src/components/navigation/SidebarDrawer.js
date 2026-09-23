import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  PanResponder,
  Easing,
  Modal,
  StatusBar,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useNotifications } from '../../context/NotificationContext';
import { canAccessScreen } from '../../config/permissions';
import { apiGet } from '../../config/api';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  Wrench,
  CreditCard,
  RefreshCw,
  Headphones,
  Package,
  CheckSquare,
  Calendar,
  ChevronDown,
  ChevronRight,
  Zap,
  Shield,
  ShieldCheck,
  X,
  MessageSquare,
  ClipboardCheck,
  Search,
  Bell
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(295, Math.round(SCREEN_WIDTH * 0.82));

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !global._IS_FABRIC &&
  !global.__turboModuleProxy &&
  !global.RN$Bridgeless
) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {}
}

export default function SidebarDrawer({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const { unreadCount } = useNotifications();

  const [visible, setVisible] = useState(false);
  const [openSections, setOpenSections] = useState({
    Sales: false,
    Operations: false,
    Finance: false,
    Management: false
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track chat unread count when opened - deferred until after drawer animation completes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet('/chat/unread-count');
        if (isMounted && data?.unreadCount !== undefined) {
          setUnreadChatCount(data.unreadCount);
        }
      } catch {
        // quiet fallback
      }
    }, 450);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Smooth, relaxed slide-in and slide-out using Native Driver for silky 60fps
  useEffect(() => {
    let animTimer = null;

    if (isOpen) {
      setVisible(true);
      slideAnim.stopAnimation();
      fadeAnim.stopAnimation();
      slideAnim.setValue(-SIDEBAR_WIDTH);
      fadeAnim.setValue(0);

      // Allow 1 frame for the native modal to layout before smoothly sliding in
      animTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 16);
    } else {
      slideAnim.stopAnimation();
      fadeAnim.stopAnimation();

      animTimer = setTimeout(() => {
        setVisible(false);
      }, 320);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 280,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          if (animTimer) clearTimeout(animTimer);
          setVisible(false);
        }
      });
    }

    return () => {
      if (animTimer) clearTimeout(animTimer);
    };
  }, [isOpen, slideAnim, fadeAnim]);

  // PanResponder to swipe left to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 15 && gesture.dx < 0 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          slideAnim.setValue(Math.max(-SIDEBAR_WIDTH, gesture.dx));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -50 || gesture.vx < -0.5) {
          closeSidebar();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const toggleSection = useCallback((sectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  }, []);

  const navigateTo = useCallback((screen, params) => {
    closeSidebar();
    setVisible(false);
    if (navigationRef?.isReady?.()) {
      if (params) {
        navigationRef.navigate(screen, params);
      } else {
        navigationRef.navigate(screen);
      }
    }
  }, [closeSidebar, navigationRef]);

  // Active route detection
  const currentRoute = navigationRef?.isReady?.() ? navigationRef.getCurrentRoute()?.name : null;
  const isDashboard = !currentRoute || currentRoute === 'DashboardTab' || currentRoute === 'MainTabs';

  // Role permissions
  const role = user?.role;

  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 48
  );

  // When closed and not animating, do not render modal so it cannot block touches
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={closeSidebar}
      statusBarTranslucent
    >
      <View style={styles.modalContainer} pointerEvents={visible && isOpen ? 'auto' : 'none'}>
        {/* Backdrop overlay */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.65],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closeSidebar}
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
          />
        </Animated.View>

        {/* Sidebar Drawer */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.drawer,
            {
              paddingTop: topPadding,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBox}>
                <Shield size={20} color="#6366f1" />
              </View>
              <View style={styles.brandTextCol}>
                <Text style={styles.brandTitle} numberOfLines={1}>CRM-KGSOFTWARE</Text>
                <Text style={styles.brandSubtitle}>MANAGEMENT SUITE</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={closeSidebar}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close sidebar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Navigation Items List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            bounces={false}
          >
            {/* Dashboard */}
            <TouchableOpacity
              style={[styles.navItem, isDashboard && styles.navItemActive]}
              onPress={() => navigateTo('MainTabs', { screen: 'DashboardTab' })}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <LayoutDashboard size={19} color="#3b82f6" />
                <Text style={[styles.itemLabel, isDashboard && styles.itemLabelActive]}>Dashboard</Text>
              </View>
            </TouchableOpacity>

            {/* My Tasks */}
            {canAccessScreen(role, 'Tasks') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('MainTabs', { screen: 'TasksTab' })}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <CheckSquare size={19} color="#10b981" />
                  <Text style={styles.itemLabel}>My Tasks</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* My Work & HR */}
            {canAccessScreen(role, 'MyWork') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('MyWork')}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <ClipboardCheck size={19} color="#6366f1" />
                  <Text style={styles.itemLabel}>My Work & HR</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Calendar */}
            {canAccessScreen(role, 'Calendar') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('Calendar')}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <Calendar size={19} color="#ef4444" />
                  <Text style={styles.itemLabel}>Calendar</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Chat */}
            {canAccessScreen(role, 'Chat') && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigateTo('MainTabs', { screen: 'ChatTab' })}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <MessageSquare size={19} color="#10b981" />
                  <Text style={styles.itemLabel}>Chat</Text>
                </View>
                {unreadChatCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{unreadChatCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Collapsible: Sales */}
            {(canAccessScreen(role, 'Leads') || canAccessScreen(role, 'Customers') || canAccessScreen(role, 'Quotations')) && (
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => toggleSection('Sales')}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <Zap size={19} color="#f59e0b" />
                    <Text style={styles.itemLabel}>Sales</Text>
                  </View>
                  {openSections.Sales ? (
                    <ChevronDown size={16} color="#64748b" />
                  ) : (
                    <ChevronRight size={16} color="#64748b" />
                  )}
                </TouchableOpacity>
                {openSections.Sales && (
                  <View style={styles.subList}>
                    {canAccessScreen(role, 'Leads') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Leads')}
                        activeOpacity={0.7}
                      >
                        <Users size={16} color="#fb923c" />
                        <Text style={styles.subItemLabel}>Lead Management</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Customers') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('MainTabs', { screen: 'CustomersTab' })}
                        activeOpacity={0.7}
                      >
                        <UserCheck size={16} color="#10b981" />
                        <Text style={styles.subItemLabel}>Customers</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Quotations') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Quotations')}
                        activeOpacity={0.7}
                      >
                        <FileText size={16} color="#3b82f6" />
                        <Text style={styles.subItemLabel}>Quotations</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Collapsible: Operations */}
            {(canAccessScreen(role, 'Installations') || canAccessScreen(role, 'Renewals') || canAccessScreen(role, 'Tickets')) && (
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => toggleSection('Operations')}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <Wrench size={19} color="#8b5cf6" />
                    <Text style={styles.itemLabel}>Operations</Text>
                  </View>
                  {openSections.Operations ? (
                    <ChevronDown size={16} color="#64748b" />
                  ) : (
                    <ChevronRight size={16} color="#64748b" />
                  )}
                </TouchableOpacity>
                {openSections.Operations && (
                  <View style={styles.subList}>
                    {canAccessScreen(role, 'Installations') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Installations')}
                        activeOpacity={0.7}
                      >
                        <Wrench size={16} color="#8b5cf6" />
                        <Text style={styles.subItemLabel}>Installations</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Renewals') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Renewals')}
                        activeOpacity={0.7}
                      >
                        <RefreshCw size={16} color="#ec4899" />
                        <Text style={styles.subItemLabel}>Renewals</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Tickets') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Tickets')}
                        activeOpacity={0.7}
                      >
                        <Headphones size={16} color="#fb7185" />
                        <Text style={styles.subItemLabel}>Service Tickets</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Collapsible: Finance */}
            {canAccessScreen(role, 'Accounts') && (
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => toggleSection('Finance')}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <CreditCard size={19} color="#f59e0b" />
                    <Text style={styles.itemLabel}>Finance</Text>
                  </View>
                  {openSections.Finance ? (
                    <ChevronDown size={16} color="#64748b" />
                  ) : (
                    <ChevronRight size={16} color="#64748b" />
                  )}
                </TouchableOpacity>
                {openSections.Finance && (
                  <View style={styles.subList}>
                    <TouchableOpacity
                      style={styles.subItem}
                      onPress={() => navigateTo('Accounts')}
                      activeOpacity={0.7}
                    >
                      <CreditCard size={16} color="#fb923c" />
                      <Text style={styles.subItemLabel}>Accounts</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Collapsible: Management */}
            {(canAccessScreen(role, 'Inventory') || canAccessScreen(role, 'Employees') || canAccessScreen(role, 'Users')) && (
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => toggleSection('Management')}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <Shield size={19} color="#06b6d4" />
                    <Text style={styles.itemLabel}>Management</Text>
                  </View>
                  {openSections.Management ? (
                    <ChevronDown size={16} color="#64748b" />
                  ) : (
                    <ChevronRight size={16} color="#64748b" />
                  )}
                </TouchableOpacity>
                {openSections.Management && (
                  <View style={styles.subList}>
                    {canAccessScreen(role, 'Inventory') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Inventory')}
                        activeOpacity={0.7}
                      >
                        <Package size={16} color="#10b981" />
                        <Text style={styles.subItemLabel}>Inventory</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Employees') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Employees')}
                        activeOpacity={0.7}
                      >
                        <Users size={16} color="#a78bfa" />
                        <Text style={styles.subItemLabel}>Employees</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Employees') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Employees')}
                        activeOpacity={0.7}
                      >
                        <ClipboardCheck size={16} color="#06b6d4" />
                        <Text style={styles.subItemLabel}>HRMS</Text>
                      </TouchableOpacity>
                    )}
                    {canAccessScreen(role, 'Users') && (
                      <TouchableOpacity
                        style={styles.subItem}
                        onPress={() => navigateTo('Users')}
                        activeOpacity={0.7}
                      >
                        <ShieldCheck size={16} color="#f97316" />
                        <Text style={styles.subItemLabel}>System Users</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Quick Tools Divider */}
            <View style={styles.divider} />

            {/* Global Search */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo('GlobalSearch')}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <Search size={19} color="#6366f1" />
                <Text style={styles.itemLabel}>Global Search</Text>
              </View>
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo('Notifications')}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <Bell size={19} color="#f59e0b" />
                <Text style={styles.itemLabel}>Notifications</Text>
              </View>
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* User Info Footer (Matching Web App Screenshot) */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 14) }]}>
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => navigateTo('Profile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="My profile and settings"
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Super Admin'}
                </Text>
                <Text style={styles.userRole} numberOfLines={1}>
                  {user?.role ? user.role.replace(/_/g, ' ') : 'Super Admin'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030712',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#0b0f19',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 25,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  accordionContainer: {
    marginBottom: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  itemLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subList: {
    paddingLeft: 28,
    paddingTop: 4,
    gap: 2,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  subItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  chatBadge: {
    backgroundColor: '#10b981',
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chatBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  notifBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 8,
    marginHorizontal: 4,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  userRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
    textTransform: 'capitalize',
    marginTop: 1,
  },
});
