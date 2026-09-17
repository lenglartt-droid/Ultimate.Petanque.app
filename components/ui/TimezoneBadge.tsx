/**
 * TimezoneBadge — inline badge that shows a time formatted for a facility's
 * timezone plus a compact "your time" conversion when the device sits in a
 * different timezone. Renders nothing when timezones match.
 *
 * Also exposes TimezoneMismatchBanner, a top-of-screen banner alerting the
 * user that the facility they're viewing lives in a different timezone.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '@/constants/theme';
import {
  formatTimeInTimezone,
  getDeviceTimezone,
  parseTerrainTimezone,
  shortTimezoneLabel,
  timezonesDiffer,
} from '@/services/timezoneService';

interface TimezoneBadgeProps {
  date: Date | string;
  terrainTimezone?: string | null;
  locale?: string;
  compact?: boolean;
  /** Prefix label displayed before the facility time (e.g. "Start"). */
  prefix?: string;
}

export function TimezoneBadge({
  date,
  terrainTimezone,
  locale = 'fr-FR',
  compact = false,
  prefix,
}: TimezoneBadgeProps) {
  const d = date instanceof Date ? date : new Date(date);
  const facilityTz = parseTerrainTimezone(terrainTimezone);
  const deviceTz = getDeviceTimezone();
  const differ = !!facilityTz && timezonesDiffer(facilityTz, deviceTz, d);
  if (!facilityTz || !differ) return null;
  const facilityTime = formatTimeInTimezone(d, facilityTz, locale);
  const deviceTime = formatTimeInTimezone(d, deviceTz, locale);
  const label = shortTimezoneLabel(facilityTz);
  if (compact) {
    return (
      <View style={styles.compact}>
        <MaterialIcons name="public" size={10} color="#8B5CF6" />
        <Text style={styles.compactText} numberOfLines={1}>
          {facilityTime} {label} ({deviceTime})
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.badge}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="public" size={12} color="#8B5CF6" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.primary} numberOfLines={1}>
          {prefix ? `${prefix} ` : ''}
          {facilityTime} {label}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          ({deviceTime} {locale.startsWith('fr') ? 'chez vous' : 'your time'})
        </Text>
      </View>
    </View>
  );
}

interface TimezoneMismatchBannerProps {
  terrainTimezone?: string | null;
  facilityName?: string | null;
  locale?: string;
}

export function TimezoneMismatchBanner({
  terrainTimezone,
  facilityName,
  locale = 'fr-FR',
}: TimezoneMismatchBannerProps) {
  const facilityTz = parseTerrainTimezone(terrainTimezone);
  const deviceTz = getDeviceTimezone();
  if (!facilityTz || !timezonesDiffer(facilityTz, deviceTz)) return null;
  const now = new Date();
  const facilityNow = formatTimeInTimezone(now, facilityTz, locale);
  const deviceNow = formatTimeInTimezone(now, deviceTz, locale);
  const facilityLabel = shortTimezoneLabel(facilityTz);
  const deviceLabel = shortTimezoneLabel(deviceTz);
  const isFr = locale.startsWith('fr');
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <MaterialIcons name="public" size={16} color="#8B5CF6" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>
          {isFr ? 'Fuseau horaire different' : 'Different timezone'}
        </Text>
        <Text style={styles.bannerText} numberOfLines={2}>
          {isFr
            ? `${facilityName ? `${facilityName} : ` : ''}${facilityNow} ${facilityLabel} (${deviceNow} ${deviceLabel})`
            : `${facilityName ? `${facilityName}: ` : ''}${facilityNow} ${facilityLabel} (${deviceNow} ${deviceLabel})`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF610',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#8B5CF625',
    marginTop: 6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#8B5CF618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  secondary: { fontSize: 10, fontWeight: '600', color: '#8B5CF6', marginTop: 1 },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#8B5CF610',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compactText: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#8B5CF608',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#8B5CF625',
    marginBottom: 12,
  },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#8B5CF615',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: 12, fontWeight: '800', color: '#7C3AED' },
  bannerText: { fontSize: 11, fontWeight: '600', color: '#8B5CF6', marginTop: 2 },
});
