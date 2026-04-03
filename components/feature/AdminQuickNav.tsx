/**
 * Admin Quick Navigation Bar
 * 
 * Grouped horizontal navigation with category headers.
 * Highlights the currently active section with underline indicator.
 * Includes a prominent Dashboard home button.
 * Auto-scrolls to the active page on mount.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import * as Haptics from '@/services/haptics';

interface NavSection {
  route: string;
  icon: string;
  label: string;
  color: string;
  group: string;
}

const ADMIN_SECTIONS: NavSection[] = [
  { route: '/admin-moderation', icon: 'gavel', label: 'Moderation', color: '#DC2626', group: 'moderation' },
  { route: '/admin-anticheat', icon: 'security', label: 'Anti-cheat', color: '#EF4444', group: 'moderation' },
  { route: '/admin-users', icon: 'people', label: 'Users', color: '#3B82F6', group: 'data' },
  { route: '/admin-clubs', icon: 'home', label: 'Clubs', color: '#7C3AED', group: 'data' },
  { route: '/admin-terrains', icon: 'sports-soccer', label: 'Terrains', color: '#10B981', group: 'data' },
  { route: '/admin-sponsors', icon: 'handshake', label: 'Sponsors', color: '#7C3AED', group: 'marketing' },
  { route: '/admin-promos', icon: 'confirmation-number', label: 'Promos', color: '#0EA5E9', group: 'marketing' },
  { route: '/admin-announcements', icon: 'campaign', label: 'Annonces', color: '#7C3AED', group: 'marketing' },
  { route: '/admin-maintenance', icon: 'construction', label: 'Maint.', color: '#D97706', group: 'system' },
  { route: '/admin-reports', icon: 'assessment', label: 'Rapports', color: '#0EA5E9', group: 'system' },
  { route: '/admin-activity-log', icon: 'history', label: 'Journal', color: '#64748B', group: 'system' },
  { route: '/admin-notifications', icon: 'notifications', label: 'Alertes', color: '#DC2626', group: 'system' },
  { route: '/admin-changelog', icon: 'update', label: 'Changelog', color: '#0EA5E9', group: 'system' },
];

const GROUP_SEPARATORS: Record<string, string> = {
  moderation: '',
  data: '\u2022',
  marketing: '\u2022',
  system: '\u2022',
};

interface AdminQuickNavProps {
  currentRoute?: string;
}

export default function AdminQuickNav({ currentRoute }: AdminQuickNavProps) {
  const pathname = usePathname();
  const active = currentRoute || pathname;
  const scrollRef = useRef<ScrollView>(null);
  const itemPositions = useRef<Map<string, number>>(new Map());
  const isDashboard = active === '/admin-dashboard';

  // Track item positions for accurate auto-scroll
  const handleItemLayout = useCallback((route: string, event: LayoutChangeEvent) => {
    itemPositions.current.set(route, event.nativeEvent.layout.x);
  }, []);

  // Auto-scroll to active item with accurate position
  useEffect(() => {
    const timer = setTimeout(() => {
      const pos = itemPositions.current.get(active);
      if (pos !== undefined && scrollRef.current) {
        // Center the active item: scroll so it's roughly in the middle
        scrollRef.current.scrollTo({ x: Math.max(0, pos - 100), animated: true });
      } else {
        // Fallback: estimate position
        const idx = ADMIN_SECTIONS.findIndex(s => active === s.route || active.includes(s.route.replace('/admin-', '')));
        if (idx > 2 && scrollRef.current) {
          scrollRef.current.scrollTo({ x: Math.max(0, idx * 95 - 100), animated: true });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [active]);

  let lastGroup = '';

  return (
    <View style={s.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Dashboard Home Button — always visible */}
        <Pressable
          style={[s.homeBtn, isDashboard && s.homeBtnActive]}
          onPress={() => {
            if (!isDashboard) {
              Haptics.selectionAsync();
              router.replace('/admin-dashboard' as any);
            }
          }}
        >
          <MaterialIcons name="dashboard" size={18} color={isDashboard ? '#FFF' : '#0F172A'} />
        </Pressable>

        <View style={s.homeSeparator} />

        {/* Section items */}
        {ADMIN_SECTIONS.map((section) => {
          const isActive = active === section.route || active.includes(section.route.replace('/admin-', ''));
          const showSep = section.group !== lastGroup && lastGroup !== '';
          lastGroup = section.group;

          return (
            <React.Fragment key={section.route}>
              {showSep ? (
                <View style={s.separator}>
                  <View style={s.separatorDot} />
                </View>
              ) : null}
              <Pressable
                style={[s.navItem, isActive && s.navItemActive]}
                onPress={() => {
                  if (!isActive) {
                    Haptics.selectionAsync();
                    router.replace(section.route as any);
                  }
                }}
                onLayout={(e) => handleItemLayout(section.route, e)}
              >
                <MaterialIcons
                  name={section.icon as any}
                  size={16}
                  color={isActive ? section.color : '#94A3B8'}
                />
                <Text
                  style={[s.navText, isActive && { color: section.color, fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  {section.label}
                </Text>
                {/* Active underline indicator */}
                {isActive ? <View style={[s.activeIndicator, { backgroundColor: section.color }]} /> : null}
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingTop: 8,
    paddingBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 5,
    alignItems: 'center',
  },
  homeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  homeBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  homeSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 10,
    borderRadius: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#F8FAFC',
  },
  navText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 1.5,
  },
  separator: {
    width: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
});
