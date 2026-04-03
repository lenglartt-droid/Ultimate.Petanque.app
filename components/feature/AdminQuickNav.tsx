/**
 * Admin Quick Navigation Bar
 * 
 * Grouped horizontal navigation with category headers.
 * Highlights the currently active section.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
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
  { route: '/admin-dashboard', icon: 'dashboard', label: 'Dashboard', color: '#0F172A', group: 'main' },
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
  main: '',
  moderation: '\u2022',
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

  // Auto-scroll to active item
  useEffect(() => {
    const idx = ADMIN_SECTIONS.findIndex(s => active === s.route || active.includes(s.route.replace('/admin-', '')));
    if (idx > 3 && scrollRef.current) {
      // Approximate scroll position
      scrollRef.current.scrollTo({ x: Math.max(0, idx * 90 - 120), animated: true });
    }
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
        {ADMIN_SECTIONS.map((section, idx) => {
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
                style={[s.navItem, isActive && { backgroundColor: section.color, borderColor: section.color }]}
                onPress={() => {
                  if (!isActive) {
                    Haptics.selectionAsync();
                    router.replace(section.route as any);
                  }
                }}
              >
                <MaterialIcons
                  name={section.icon as any}
                  size={14}
                  color={isActive ? '#FFF' : '#64748B'}
                />
                <Text
                  style={[s.navText, isActive && { color: '#FFF', fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  {section.label}
                </Text>
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
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 5,
    alignItems: 'center',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
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
