import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth, useAlert } from '@/template';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

type AuthMode = 'login' | 'register';
type RegisterStep = 'email' | 'otp';

export default function LoginScreen() {
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { t } = useLanguage();

  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('email');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setRegisterStep('email');
    setShowPassword(false);
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      showAlert(t('login', 'googleError'), error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(t('common', 'error'), t('login', 'fillAllFields'));
      return;
    }

    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      showAlert(t('login', 'loginError'), error);
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim()) {
      showAlert(t('common', 'error'), t('login', 'enterEmail'));
      return;
    }
    if (!password.trim() || password.length < 6) {
      showAlert(t('common', 'error'), t('login', 'passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      showAlert(t('common', 'error'), t('login', 'passwordMismatch'));
      return;
    }

    try {
      const { error } = await sendOTP(email.trim());
      if (error) {
        showAlert(t('common', 'error'), error);
        return;
      }

      // Update state first, then show confirmation
      setRegisterStep('otp');
      showAlert(t('login', 'codeSentSuccess'), t('login', 'codeSentMessage'));
    } catch (err: any) {
      showAlert(t('common', 'error'), err.message || t('common', 'error'));
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length < 4) {
      showAlert(t('common', 'error'), t('login', 'enterCode'));
      return;
    }

    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim(), { password });
    if (error) {
      showAlert(t('common', 'error'), error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
            <Image
              source={require('@/assets/images/app-logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.appName}>Ultimate Petanque</Text>
            <Text style={styles.tagline}>
              {mode === 'login' ? t('login', 'welcomeBack') : t('login', 'createAccount')}
            </Text>
          </Animated.View>

          {/* Mode Tabs */}
          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
              onPress={() => handleModeSwitch('login')}
            >
              <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
                {t('login', 'signIn')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
              onPress={() => handleModeSwitch('register')}
            >
              <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>
                {t('login', 'signUp')}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Login Form */}
          {mode === 'login' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login', 'email')}
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login', 'password')}
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.textMuted}
                  />
                </Pressable>
              </View>

              <Pressable
                style={[styles.submitButton, operationLoading && styles.submitButtonDisabled]}
                onPress={handleLogin}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="login" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>{t('login', 'login')}</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('common', 'or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In */}
              <Pressable
                style={[styles.googleButton, operationLoading && styles.googleButtonDisabled]}
                onPress={handleGoogleLogin}
                disabled={operationLoading}
              >
                <MaterialIcons name="login" size={20} color={theme.textPrimary} />
                <Text style={styles.googleButtonText}>{t('login', 'continueWithGoogle')}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Register Form - Step 1: Email & Password */}
          {mode === 'register' && registerStep === 'email' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login', 'email')}
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login', 'passwordMin')}
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.textMuted}
                  />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login', 'confirmPassword')}
                  placeholderTextColor={theme.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <Pressable
                style={[styles.submitButton, operationLoading && styles.submitButtonDisabled]}
                onPress={handleSendOTP}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>{t('login', 'getCode')}</Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          )}

          {/* Register Form - Step 2: OTP Verification */}
          {mode === 'register' && registerStep === 'otp' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
              <View style={styles.otpInfo}>
                <MaterialIcons name="mark-email-read" size={48} color={theme.primary} />
                <Text style={styles.otpInfoTitle}>{t('login', 'verifyEmail')}</Text>
                <Text style={styles.otpInfoText}>
                  {t('login', 'codeSent')} {email}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="pin" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder={t('login', 'verificationCode')}
                  placeholderTextColor={theme.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <Pressable
                style={[styles.submitButton, operationLoading && styles.submitButtonDisabled]}
                onPress={handleVerifyOTP}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="verified" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>{t('login', 'createMyAccount')}</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.backButton}
                onPress={() => setRegisterStep('email')}
              >
                <MaterialIcons name="arrow-back" size={18} color={theme.textSecondary} />
                <Text style={styles.backButtonText}>{t('login', 'editEmail')}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Footer */}
          <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.footer}>
            <Text style={styles.footerText}>
              {t('login', 'termsText')}
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
    borderRadius: 24,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
    marginBottom: 24,
    ...theme.shadows.card,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
  },
  modeTabActive: {
    backgroundColor: theme.primary,
  },
  modeTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFF',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    ...theme.shadows.card,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: theme.textPrimary,
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  eyeButton: {
    padding: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  otpInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  otpInfoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  otpInfoText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
  },
  // Divider styles
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    fontSize: 13,
    color: theme.textMuted,
    paddingHorizontal: 16,
  },
  // Google button styles
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadows.card,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
});
