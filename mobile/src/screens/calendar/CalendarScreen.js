import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { apiGet } from '../../config/api';
import Header from '../../components/common/Header';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Wrench,
  RefreshCw,
  Clock,
  ArrowRight,
  Sparkles,
  CalendarDays
} from 'lucide-react-native';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FILTER_TYPES = ['all', 'install', 'task', 'renewal'];

function formatYearMonthDay(year, month, day) {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStr() {
  const now = new Date();
  return formatYearMonthDay(now.getFullYear(), now.getMonth(), now.getDate());
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const todayStr = useMemo(() => getTodayStr(), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState('month');
  const [activeFilter, setActiveFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      const rows = await apiGet('/calendar/events');
      const presentation = {
        task: { label: 'Task Due', category: 'Task', color: '#6366f1', icon: CheckSquare, screen: 'Tasks' },
        renewal: { label: 'Renewal Due', category: 'Renewal', color: '#f59e0b', icon: RefreshCw, screen: 'Renewals' },
        install: { label: 'Installation', category: 'Field Job', color: '#10b981', icon: Wrench, screen: 'Installations' }
      };

      const normalized = (Array.isArray(rows) ? rows : []).map((event) => {
        const meta = presentation[event.type] || presentation.task;
        const rawTitle = String(event.title || '');
        let cleanTitle = rawTitle;
        let subtitle = meta.category;

        if (rawTitle.startsWith('Task:')) {
          cleanTitle = rawTitle.replace(/^Task:\s*/i, '').trim();
          subtitle = 'Assigned Task';
        } else if (rawTitle.startsWith('Renewal:')) {
          cleanTitle = rawTitle.replace(/^Renewal:\s*/i, '').trim();
          subtitle = 'Service Renewal Deadline';
        } else if (rawTitle.includes(':')) {
          const parts = rawTitle.split(':');
          subtitle = `${parts[0].trim()} Deployment`;
          cleanTitle = parts.slice(1).join(':').trim();
        }

        return {
          ...event,
          date: String(event.start || '').slice(0, 10),
          typeLabel: meta.label,
          cleanTitle,
          subtitle,
          color: meta.color,
          icon: meta.icon,
          screen: meta.screen
        };
      });

      setEvents(normalized);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  const monthGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInCurrentMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const cells = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevYear = month === 0 ? year - 1 : year;
      const prevMonth = month === 0 ? 11 : month - 1;
      const dateStr = formatYearMonthDay(prevYear, prevMonth, day);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false
      });
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = formatYearMonthDay(year, month, day);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true
      });
    }

    const totalWeeks = Math.ceil(cells.length / 7);
    const remaining = totalWeeks * 7 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextYear = month === 11 ? year + 1 : year;
      const nextMonth = month === 11 ? 0 : month + 1;
      const dateStr = formatYearMonthDay(nextYear, nextMonth, day);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false
      });
    }

    return cells;
  }, [currentMonth]);

  const weekStrip = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const dayOfWeek = curr.getDay();
    const sunday = new Date(y, m - 1, d - dayOfWeek);

    return Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + idx);
      const dateStr = formatYearMonthDay(date.getFullYear(), date.getMonth(), date.getDate());
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      return { dateStr, dayName, dayNum };
    });
  }, [selectedDate]);

  const shiftMonth = (delta) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const jumpToToday = () => {
    setSelectedDate(todayStr);
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!map.has(ev.date)) {
        map.set(ev.date, []);
      }
      map.get(ev.date).push(ev);
    }
    return map;
  }, [events]);

  const metrics = useMemo(() => {
    const todayCount = (eventsByDate.get(todayStr) || []).length;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 6);
    const sunStr = formatYearMonthDay(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
    const satStr = formatYearMonthDay(saturday.getFullYear(), saturday.getMonth(), saturday.getDate());

    const thisWeekCount = events.filter((e) => e.date >= sunStr && e.date <= satStr).length;
    const totalCount = events.length;

    return { todayCount, thisWeekCount, totalCount };
  }, [events, eventsByDate, todayStr]);

  const dayEvents = useMemo(() => {
    const allForDay = eventsByDate.get(selectedDate) || [];
    if (activeFilter === 'all') return allForDay;
    return allForDay.filter((e) => e.type === activeFilter);
  }, [eventsByDate, selectedDate, activeFilter]);

  const agendaEvents = useMemo(() => {
    const list = events.filter((e) => {
      const matchesFilter = activeFilter === 'all' || e.type === activeFilter;
      return matchesFilter && e.date >= todayStr;
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [events, activeFilter, todayStr]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const selectedDateFormatted = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedDate]);

  const filterCounts = useMemo(() => {
    const counts = { all: events.length, install: 0, task: 0, renewal: 0 };
    for (const e of events) {
      if (counts[e.type] !== undefined) counts[e.type]++;
    }
    return counts;
  }, [events]);

  const handleEventPress = (item) => {
    if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const renderEventCard = ({ item }) => {
    const Icon = item.icon;
    return (
      <TouchableOpacity
        style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.eventColorBar, { backgroundColor: item.color }]} />

        <View style={styles.eventBody}>
          <View style={styles.eventHeaderRow}>
            <View style={[styles.typeBadge, { backgroundColor: `${item.color}18` }]}>
              <Icon size={12} color={item.color} />
              <Text style={[styles.typeBadgeText, { color: item.color }]}>{item.typeLabel}</Text>
            </View>

            <View style={styles.datePill}>
              <Clock size={11} color={colors.textMuted} />
              <Text style={[styles.datePillText, { color: colors.textMuted }]}>{item.date}</Text>
            </View>
          </View>

          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
            {item.cleanTitle}
          </Text>

          <View style={styles.eventFooterRow}>
            <Text style={[styles.eventSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
            <View style={styles.viewAction}>
              <Text style={[styles.viewActionText, { color: item.color }]}>View</Text>
              <ArrowRight size={12} color={item.color} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Calendar"
        subtitle="Operations, field visits & deadlines"
        rightElement={
          <TouchableOpacity
            style={[styles.todayHeaderBtn, { backgroundColor: colors.primary }]}
            onPress={jumpToToday}
            activeOpacity={0.8}
          >
            <CalendarDays size={14} color="#ffffff" />
            <Text style={styles.todayHeaderBtnText}>Today</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={viewMode === 'agenda' ? agendaEvents : dayEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEventCard}
        contentContainerStyle={styles.scrollListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Stat Overview Bar - Compact Vertical Stack */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statIconPill}>
                  <Clock size={14} color="#6366f1" />
                  <Text style={[styles.statNum, { color: colors.text }]}>{metrics.todayCount}</Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>Today</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statIconPill}>
                  <Sparkles size={14} color="#10b981" />
                  <Text style={[styles.statNum, { color: colors.text }]}>{metrics.thisWeekCount}</Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>This Week</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statIconPill}>
                  <CalendarDays size={14} color="#f59e0b" />
                  <Text style={[styles.statNum, { color: colors.text }]}>{metrics.totalCount}</Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>Total Due</Text>
              </View>
            </View>

            {/* Calendar Panel with clean 2-row header */}
            <View style={[styles.calendarPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Row 1: Full-width Segmented View Switcher */}
              <View style={[styles.segmentedSwitch, { backgroundColor: colors.cardSecondary }]}>
                <TouchableOpacity
                  style={[styles.segmentBtn, viewMode === 'month' && { backgroundColor: colors.primary }]}
                  onPress={() => setViewMode('month')}
                >
                  <Text style={[styles.segmentText, { color: viewMode === 'month' ? '#fff' : colors.textMuted }]}>
                    Month
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, viewMode === 'week' && { backgroundColor: colors.primary }]}
                  onPress={() => setViewMode('week')}
                >
                  <Text style={[styles.segmentText, { color: viewMode === 'week' ? '#fff' : colors.textMuted }]}>
                    Week
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, viewMode === 'agenda' && { backgroundColor: colors.primary }]}
                  onPress={() => setViewMode('agenda')}
                >
                  <Text style={[styles.segmentText, { color: viewMode === 'agenda' ? '#fff' : colors.textMuted }]}>
                    Agenda
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Month Navigation Row */}
              {viewMode !== 'agenda' ? (
                <View style={styles.monthNavRow}>
                  <TouchableOpacity
                    style={[styles.navArrowBtn, { backgroundColor: colors.cardSecondary }]}
                    onPress={() => shiftMonth(-1)}
                    accessibilityLabel="Previous month"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronLeft size={18} color={colors.text} />
                  </TouchableOpacity>

                  <View style={styles.monthTitleWrapper}>
                    <Text style={[styles.monthTitle, { color: colors.text }]}>{monthLabel}</Text>
                    {selectedDate === todayStr && (
                      <View style={[styles.todayBadge, { backgroundColor: `${colors.primary}18` }]}>
                        <Text style={[styles.todayBadgeText, { color: colors.primary }]}>TODAY</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.navArrowBtn, { backgroundColor: colors.cardSecondary }]}
                    onPress={() => shiftMonth(1)}
                    accessibilityLabel="Next month"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronRight size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.agendaTitleRow}>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>Upcoming Agenda</Text>
                  <Text style={[styles.agendaSubtitle, { color: colors.textMuted }]}>
                    {agendaEvents.length} scheduled item{agendaEvents.length === 1 ? '' : 's'}
                  </Text>
                </View>
              )}

              {viewMode === 'month' && (
                <View style={styles.monthGridContainer}>
                  <View style={styles.weekHeaderRow}>
                    {WEEK_DAYS.map((day, i) => (
                      <View key={i} style={styles.weekHeaderCell}>
                        <Text style={[styles.weekHeaderText, { color: colors.textMuted }]}>{day}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.daysGrid}>
                    {monthGrid.map((cell, idx) => {
                      const isSelected = cell.dateStr === selectedDate;
                      const isToday = cell.dateStr === todayStr;
                      const cellEvents = eventsByDate.get(cell.dateStr) || [];
                      const hasInstall = cellEvents.some((e) => e.type === 'install');
                      const hasTask = cellEvents.some((e) => e.type === 'task');
                      const hasRenewal = cellEvents.some((e) => e.type === 'renewal');

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.dayCell,
                            isSelected && [styles.selectedCell, { backgroundColor: colors.primary }],
                            !isSelected && isToday && [styles.todayCell, { borderColor: colors.primary }]
                          ]}
                          onPress={() => {
                            setSelectedDate(cell.dateStr);
                            const [y, m] = cell.dateStr.split('-').map(Number);
                            if (m - 1 !== currentMonth.getMonth() || y !== currentMonth.getFullYear()) {
                              setCurrentMonth(new Date(y, m - 1, 1));
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.dayNumberText,
                              {
                                color: isSelected
                                  ? '#ffffff'
                                  : !cell.isCurrentMonth
                                    ? colors.textMuted + '60'
                                    : isToday
                                      ? colors.primary
                                      : colors.text,
                                fontWeight: isSelected || isToday ? '800' : '600'
                              }
                            ]}
                          >
                            {cell.dayNum}
                          </Text>

                          <View style={styles.dotsRow}>
                            {hasInstall ? (
                              <View style={[styles.dot, { backgroundColor: isSelected ? '#ffffff' : '#10b981' }]} />
                            ) : null}
                            {hasTask ? (
                              <View style={[styles.dot, { backgroundColor: isSelected ? '#ffffff' : '#6366f1' }]} />
                            ) : null}
                            {hasRenewal ? (
                              <View style={[styles.dot, { backgroundColor: isSelected ? '#ffffff' : '#f59e0b' }]} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {viewMode === 'week' && (
                <View style={styles.weekStripContainer}>
                  {weekStrip.map((item, idx) => {
                    const isSelected = item.dateStr === selectedDate;
                    const isToday = item.dateStr === todayStr;
                    const dayEvts = eventsByDate.get(item.dateStr) || [];
                    const hasInstall = dayEvts.some((e) => e.type === 'install');
                    const hasTask = dayEvts.some((e) => e.type === 'task');
                    const hasRenewal = dayEvts.some((e) => e.type === 'renewal');

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.weekChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : isToday
                                ? `${colors.primary}12`
                                : colors.cardSecondary,
                            borderColor: isSelected
                              ? colors.primary
                              : isToday
                                ? colors.primary
                                : colors.border
                          }
                        ]}
                        onPress={() => setSelectedDate(item.dateStr)}
                      >
                        <Text style={[styles.weekChipName, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                          {item.dayName}
                        </Text>
                        <Text style={[styles.weekChipNum, { color: isSelected ? '#ffffff' : colors.text }]}>
                          {item.dayNum}
                        </Text>

                        <View style={styles.weekDotsRow}>
                          {hasInstall ? (
                            <View style={[styles.dotSmall, { backgroundColor: isSelected ? '#ffffff' : '#10b981' }]} />
                          ) : null}
                          {hasTask ? (
                            <View style={[styles.dotSmall, { backgroundColor: isSelected ? '#ffffff' : '#6366f1' }]} />
                          ) : null}
                          {hasRenewal ? (
                            <View style={[styles.dotSmall, { backgroundColor: isSelected ? '#ffffff' : '#f59e0b' }]} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Event Type Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {FILTER_TYPES.map((typeKey) => {
                const isSelected = activeFilter === typeKey;
                const labels = {
                  all: `All (${filterCounts.all})`,
                  install: `Installations (${filterCounts.install})`,
                  task: `Tasks (${filterCounts.task})`,
                  renewal: `Renewals (${filterCounts.renewal})`
                };
                const dotColors = {
                  all: colors.primary,
                  install: '#10b981',
                  task: '#6366f1',
                  renewal: '#f59e0b'
                };

                return (
                  <TouchableOpacity
                    key={typeKey}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => setActiveFilter(typeKey)}
                  >
                    {typeKey !== 'all' ? (
                      <View
                        style={[
                          styles.filterDot,
                          { backgroundColor: isSelected ? '#ffffff' : dotColors[typeKey] }
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSelected ? '#ffffff' : colors.text, fontWeight: isSelected ? '700' : '500' }
                      ]}
                    >
                      {labels[typeKey]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Section Header with Date & Count */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {viewMode === 'agenda' ? 'All Upcoming Events' : selectedDateFormatted}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                  {viewMode === 'agenda'
                    ? `${agendaEvents.length} scheduled item${agendaEvents.length === 1 ? '' : 's'}`
                    : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'} on this day`}
                </Text>
              </View>

              {viewMode !== 'agenda' && selectedDate !== todayStr ? (
                <TouchableOpacity
                  style={[styles.jumpTodaySmall, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={jumpToToday}
                >
                  <Text style={[styles.jumpTodaySmallText, { color: colors.primary }]}>Go to Today</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingSpinner message="Syncing operational schedule..." />
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <EmptyState
                title="No events found"
                description={
                  viewMode === 'agenda'
                    ? 'No upcoming tasks, installations, or renewals matching this filter.'
                    : `No items due on ${selectedDate}. You have an open schedule!`
                }
                icon={CalendarIcon}
                actionText={viewMode !== 'agenda' ? 'View All Upcoming' : undefined}
                onAction={viewMode !== 'agenda' ? () => setViewMode('agenda') : undefined}
              />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  todayHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  todayHeaderBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  scrollListContent: {
    paddingBottom: 48
  },
  headerContainer: {
    paddingTop: 12
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 12
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1
  },
  statIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  statNum: {
    fontSize: 17,
    fontWeight: '800'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600'
  },
  calendarPanel: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  todayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  segmentedSwitch: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700'
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  agendaSubtitle: {
    fontSize: 12,
    fontWeight: '600'
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthGridContainer: {
    marginTop: 4
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center'
  },
  weekHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  dayCell: {
    width: '14.285%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 2
  },
  selectedCell: {
    borderRadius: 12
  },
  todayCell: {
    borderWidth: 1.5
  },
  dayNumberText: {
    fontSize: 13
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 4,
    marginTop: 3,
    alignItems: 'center'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2
  },
  weekStripContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 6
  },
  weekChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1
  },
  weekChipName: {
    fontSize: 11,
    fontWeight: '600'
  },
  weekChipNum: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2
  },
  weekDotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    height: 4
  },
  dotSmall: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2
  },
  filterScroll: {
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  filterChipText: {
    fontSize: 12
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1
  },
  jumpTodaySmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1
  },
  jumpTodaySmallText: {
    fontSize: 11,
    fontWeight: '700'
  },
  eventCard: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden'
  },
  eventColorBar: {
    width: 5
  },
  eventBody: {
    flex: 1,
    padding: 14
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20
  },
  eventFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8
  },
  eventSubtitle: {
    fontSize: 12,
    flex: 1
  },
  viewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  viewActionText: {
    fontSize: 12,
    fontWeight: '700'
  },
  emptyCard: {
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10
  }
});
