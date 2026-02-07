import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthRouter, useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { Redirect } from 'expo-router';
import theme from '@/constants/theme';

function ProfileChecker() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    const checkProfile = async () => {
      if (!user?.id) {
        setChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // If no username set, redirect to onboarding
        setNeedsOnboarding(!data?.username || data.username.trim() === '');
      } catch (err) {
        console.log('Profile check error:', err);
        setNeedsOnboarding(true);
      } finally {
        setChecking(false);
      }
    };

    checkProfile();
  }, [user?.id]);

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

export default function RootScreen() {
  return (
    <AuthRouter loginRoute="/login">
      <ProfileChecker />
    </AuthRouter>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
  },
});
