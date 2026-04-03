/**
 * Admin Quick Navigation Bar
 * 
 * Horizontal scrollable navigation bar shown at top of all admin pages.
 * Highlights the currently active section.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import * as Haptics from '@/services/haptics';

const ADMIN_SECTIONS = [
  { route: '/admin-dashboard', icon: 'dashboard', label: 'Dashboard', color: '#0F172A' },
  { route: '/admin-moderation', icon: 'gavel', label: 'Moderation', color: '#DC2626' },
  { route: '/admin-users', icon: 'people', label: 'Users', color: '#3B82F6' },
  { route: '/admin-clubs', icon: 'home', label: 'Clubs', color: '#7C3AED' },
  { route: '/admin-terrains', icon: 'sports-soccer', label: 'Terrains', color: '#10B981' },
  { route: '/admin-sponsors', icon: 'handshake', label: 'Sponsors', color: '#7C3AED' },
  { route: '/admin-promos', icon: 'confirmation-number', label: 'Promos', color: '#0EA5E9' },
  { route: '/admin-announcements', icon: 'campaign', label: 'Annonces', color: '#7C3AED' },
  { route: '/admin-anticheat', icon: 'security', label: 'Anti-cheat', color: '#EF4444' },
  { route: '/admin-maintenance', icon: 'construction', label: 'Maint.', color: '#D97706' },
  { route: '/admin-reports', icon: 'assessment', label: 'Rapports', color: '#0EA5E9' },
  { route: '/admin-activity-log', icon: 'history', label: 'Journal', color: '#64748B' },
  { route: '/admin-notifications', icon: 'notifications', label: 'Alertes', color: '#DC2626' },
];

interface AdminQuickNavProps {
  currentRoute?: string;
}

export default function AdminQuickNav({ currentRoute }: AdminQuickNavProps) {
  const pathname = usePathname();
  const active = currentRoute || pathname;

  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {ADMIN_SECTIONS.map(section => {
          const isActive = active === section.route || active.includes(section.route.replace('/admin-', ''));
          return (
            <Pressable
              key={section.route}
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
                style={[s.navText, isActive && { color: '#FFF' }]}
                numberOfLines={1}
              >
                {section.label}
              </Text>
            </Pressable>
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
    gap: 6,
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
});
