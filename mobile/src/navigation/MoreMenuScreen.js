import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Header from '../components/common/Header';
import { canAccessScreen } from '../config/permissions';
import {
  Target,
  RefreshCw,
  FileCheck,
  CreditCard,
  Package,
  Wrench,
  Headphones,
  Users,
  Calendar,
  ShieldCheck,
  User,
  Search,
  Bell,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react-native';

export default function MoreMenuScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const menuSections = [
    {
      title: 'QUICK ACCESS',
      items: [
        { title: 'Global Search', desc: 'Find CRM records across modules', icon: Search, color: '#6366f1', screen: 'GlobalSearch' },
        { title: 'Notifications', desc: 'Unread updates and activity', icon: Bell, color: '#f59e0b', screen: 'Notifications' },
        { title: 'My Work & HR', desc: 'Attendance, leave, documents and payslips', icon: ClipboardCheck, color: '#6366f1', screen: 'MyWork' }
      ]
    },
    {
      title: 'SALES & CUSTOMERS',
      items: [
        { title: 'Service Renewals', desc: 'Expiring client contracts', icon: RefreshCw, color: '#f59e0b', screen: 'Renewals' },
      ]
    },
    {
      title: 'OPERATIONS & FIELD',
      items: [
        { title: 'Field Installations', desc: 'GPS / CCTV / Web deployments', icon: Wrench, color: '#10b981', screen: 'Installations' },
        { title: 'Inventory & Stock', desc: 'Hardware SKUs & barcodes', icon: Package, color: '#8b5cf6', screen: 'Inventory' },
        { title: 'Support Tickets', desc: 'Client service requests', icon: Headphones, color: '#ef4444', screen: 'Tickets' },
        { title: 'Schedule & Calendar', desc: 'Appointments & daily events', icon: Calendar, color: '#06b6d4', screen: 'Calendar' },
      ]
    },
    {
      title: 'FINANCE & MANAGEMENT',
      items: [
        { title: 'Accounts & Billing', desc: 'Invoices & GST collection', icon: CreditCard, color: '#10b981', screen: 'Accounts' },
        { title: 'Employees Directory', desc: 'Staff directory & payroll', icon: Users, color: '#6366f1', screen: 'Employees' },
        { title: 'User Management', desc: 'System roles & access control', icon: ShieldCheck, color: '#dc2626', screen: 'Users' },
        { title: 'My Profile & Settings', desc: 'Theme, password & API server', icon: User, color: colors.primary, screen: 'Profile' }
      ]
    }
  ];

  const visibleSections = menuSections
    .map(section => ({ ...section, items: section.items.filter(item => canAccessScreen(user?.role, item.screen)) }))
    .filter(section => section.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="CRM Modules"
        subtitle="All system tools and operations"
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {visibleSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {section.items.map((item, iIdx) => {
                const Icon = item.icon;
                const isLast = iIdx === section.items.length - 1;
                return (
                  <TouchableOpacity
                    key={iIdx}
                    style={[
                      styles.menuItem,
                      { borderBottomColor: colors.border },
                      isLast && { borderBottomWidth: 0 }
                    ]}
                    onPress={() => navigation.navigate(item.screen)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    accessibilityHint={item.desc}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${item.color}20` }]}>
                      <Icon size={20} color={item.color} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.itemDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                    </View>
                    {item.screen === 'Notifications' && unreadCount > 0 && (
                      <View style={[styles.menuBadge, { backgroundColor: colors.danger }]}>
                        <Text style={styles.menuBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                    <ChevronRight size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  menuBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  }
});
