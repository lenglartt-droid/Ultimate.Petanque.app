/**
 * Admin Role Guard
 * 
 * Wraps admin pages to redirect non-admin users automatically.
 * Shows a brief loading state while checking, then redirects if not admin.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/contexts/AppContext';
import { useAlert } from '@/template';
import theme from '@/constants/theme';

interface AdminGuardProps {
  children: React.ReactNode;
  language?: string;
}

export default function AdminGuard({ children, language = 'fr' }: AdminGuardProps) {
  const { isAdmin } = useApp();
  const { showAlert } = useAlert();
  const [checked, setChecked] = useState(false);
  const fr = language === 'fr';

  useEffect(() => {
    // Small delay to let AppContext hydrate
    const timer = setTimeout(() => {
      setChecked(true);
      if (!isAdmin) {
        showAlert(
          fr ? 'Acces refuse' : 'Access denied',
          fr ? 'Vous devez etre administrateur pour acceder a cette page.' : 'You must be an administrator to access this page.'
        );
        router.replace('/profile');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isAdmin]);

  if (!checked || !isAdmin) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={s.text}>{fr ? 'Verification...' : 'Verifying...'}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
