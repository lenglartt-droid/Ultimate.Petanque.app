// ============================================
// DEVICE FINGERPRINT SERVICE
// Generates device fingerprint and enforces
// account creation cooldown
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

const STORAGE_KEY = '@device_registration_history';
const MAX_ACCOUNTS_PER_DEVICE = 3;
const COOLDOWN_HOURS = 24; // hours between account creations

interface DeviceRegistrationHistory {
  fingerprint: string;
  registrations: { email: string; date: string }[];
}

/**
 * Generate a stable device fingerprint using available platform info
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    let parts: string[] = [Platform.OS, Platform.Version?.toString() || 'unknown'];

    // Try expo-device for more info
    try {
      const Device = require('expo-device');
      if (Device?.brand) parts.push(Device.brand);
      if (Device?.modelName) parts.push(Device.modelName);
      if (Device?.osName) parts.push(Device.osName);
      if (Device?.deviceYearClass) parts.push(String(Device.deviceYearClass));
    } catch { /* silent - expo-device may not be available */ }

    // Try expo-application for app-level ID
    try {
      const Application = require('expo-application');
      if (Platform.OS === 'android' && Application?.getAndroidId) {
        const androidId = await Application.getAndroidId();
        if (androidId) parts.push(androidId);
      } else if (Platform.OS === 'ios') {
        const installId = await Application?.getInstallationTimeAsync?.();
        if (installId) parts.push(String(installId));
      }
    } catch { /* silent */ }

    // Add a persistent random ID as fallback (generated once per install)
    let persistentId = await AsyncStorage.getItem('@device_persistent_id');
    if (!persistentId) {
      persistentId = generateRandomId();
      await AsyncStorage.setItem('@device_persistent_id', persistentId);
    }
    parts.push(persistentId);

    // Create a simple hash from all parts
    const raw = parts.join('|');
    return simpleHash(raw);
  } catch {
    // Ultimate fallback
    let fallbackId = await AsyncStorage.getItem('@device_persistent_id');
    if (!fallbackId) {
      fallbackId = generateRandomId();
      await AsyncStorage.setItem('@device_persistent_id', fallbackId);
    }
    return simpleHash(`${Platform.OS}|${fallbackId}`);
  }
}

/**
 * Check if device can create a new account
 * Returns { allowed, reason } 
 */
export async function canCreateAccount(email: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const fingerprint = await getDeviceFingerprint();

    // 1. Check local history first (fast)
    const localHistory = await getLocalHistory();
    if (localHistory) {
      // Check max accounts
      if (localHistory.registrations.length >= MAX_ACCOUNTS_PER_DEVICE) {
        return { allowed: false, reason: 'max_accounts_reached' };
      }

      // Check cooldown
      const lastRegistration = localHistory.registrations[localHistory.registrations.length - 1];
      if (lastRegistration) {
        const lastDate = new Date(lastRegistration.date);
        const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
          return { allowed: false, reason: 'cooldown_active' };
        }
      }

      // Check duplicate email
      if (localHistory.registrations.some(r => r.email.toLowerCase() === email.toLowerCase())) {
        // Same email = likely re-registering, allow it
        return { allowed: true };
      }
    }

    // 2. Check server-side (comprehensive)
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('device_registrations')
      .select('email, registered_at')
      .eq('device_fingerprint', fingerprint)
      .order('registered_at', { ascending: false })
      .limit(MAX_ACCOUNTS_PER_DEVICE + 1);

    if (!error && data) {
      // Filter registrations in the last 30 days
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30);
      const recentRegistrations = data.filter(d => new Date(d.registered_at) > recentCutoff);

      if (recentRegistrations.length >= MAX_ACCOUNTS_PER_DEVICE) {
        return { allowed: false, reason: 'max_accounts_reached' };
      }

      // Check cooldown from server data
      if (data.length > 0) {
        const lastDate = new Date(data[0].registered_at);
        const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
          // Allow if same email
          if (data[0].email?.toLowerCase() === email.toLowerCase()) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'cooldown_active' };
        }
      }
    }

    return { allowed: true };
  } catch {
    // On error, allow (don't block legitimate users)
    return { allowed: true };
  }
}

/**
 * Record a new account creation for this device
 */
export async function recordAccountCreation(email: string): Promise<void> {
  try {
    const fingerprint = await getDeviceFingerprint();
    const now = new Date().toISOString();

    // Save locally
    const history = await getLocalHistory() || { fingerprint, registrations: [] };
    history.registrations.push({ email: email.toLowerCase(), date: now });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // Save server-side (best effort)
    const supabase = getSupabaseClient();
    await supabase.from('device_registrations').insert({
      device_fingerprint: fingerprint,
      email: email.toLowerCase(),
      registered_at: now,
    }).then(() => {}).catch(() => {});
  } catch { /* silent */ }
}

// ============================================
// HELPERS
// ============================================

async function getLocalHistory(): Promise<DeviceRegistrationHistory | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* silent */ }
  return null;
}

function generateRandomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Convert to hex and pad
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Generate a longer fingerprint by hashing in sections
  let hash2 = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const char = str.charCodeAt(i);
    hash2 = ((hash2 << 7) - hash2) + char;
    hash2 |= 0;
  }
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return `${hex}-${hex2}`;
}
