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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '@/hooks/useTheme';

type AuthMode = 'login' | 'register';
type RegisterStep = 'email' | 'otp';

export default function LoginScreen() {
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { theme, isDark } = useTheme();

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
      showAlert('Erreur Google', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      showAlert('Erreur de connexion', error);
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim()) {
      showAlert('Erreur', 'Veuillez entrer votre email');
      return;
    }
    if (!password.trim() || password.length < 6) {
      showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    try {
      const { error } = await sendOTP(email.trim());
      if (error) {
        showAlert('Erreur', error);
        return;
      }

      setRegisterStep('otp');
      showAlert('Code envoyé', 'Un code de vérification a été envoyé à votre email');
    } catch (err: any) {
      showAlert('Erreur', err.message || "Une erreur est survenue lors de l'envoi du code");
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length < 4) {
      showAlert('Erreur', 'Veuillez entrer le code de vérification');
      return;
    }

    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim(), { password });
    if (error) {
      showAlert('Erreur', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
          {/* Hero Header with Logo */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: isDark ? theme.surface : '#F0EDE8' }]}>
              <Image
                source={require('@/assets/images/app-logo.png')}
                style={styles.logo}
                contentFit="contain"
                transition={300}
              />
            </View>
            <Text style={[styles.appName, { color: theme.accent }]}>Ultimate Petanque</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              {mode === 'login' ? 'Content de vous revoir !' : 'Créez votre compte'}
            </Text>
          </Animated.View>

          {/* Mode Tabs */}
          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={[styles.modeTabs, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
            <Pressable
              style={[styles.modeTab, mode === 'login' && { backgroundColor: theme.primary }]}
              onPress={() => handleModeSwitch('login')}
            >
              <Text style={[styles.modeTabText, { color: theme.textSecondary }, mode === 'login' && styles.modeTabTextActive]}>
                Connexion
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'register' && { backgroundColor: theme.primary }]}
              onPress={() => handleModeSwitch('register')}
            >
              <Text style={[styles.modeTabText, { color: theme.textSecondary }, mode === 'register' && styles.modeTabTextActive]}>
                Inscription
              </Text>
            </Pressable>
          </Animated.View>

          {/* Login Form */}
          {mode === 'login' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Email"
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Mot de passe"
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
                style={[styles.submitButton, { backgroundColor: theme.accent }, operationLoading && styles.submitButtonDisabled]}
                onPress={handleLogin}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="login" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Se connecter</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Google Sign-In */}
              <Pressable
                style={[styles.googleButton, { backgroundColor: theme.surface, borderColor: theme.border, ...theme.shadows.card }, operationLoading && styles.googleButtonDisabled]}
                onPress={handleGoogleLogin}
                disabled={operationLoading}
              >
                <MaterialIcons name="login" size={20} color={theme.textPrimary} />
                <Text style={[styles.googleButtonText, { color: theme.textPrimary }]}>Continuer avec Google</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Register Form - Step 1: Email & Password */}
          {mode === 'register' && registerStep === 'email' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Email"
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Mot de passe (min. 6 caractères)"
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

              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Confirmer le mot de passe"
                  placeholderTextColor={theme.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: theme.accent }, operationLoading && styles.submitButtonDisabled]}
                onPress={handleSendOTP}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Recevoir le code</Text>
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
                <Text style={[styles.otpInfoTitle, { color: theme.textPrimary }]}>Vérifiez votre email</Text>
                <Text style={[styles.otpInfoText, { color: theme.textSecondary }]}>
                  Un code à 4 chiffres a été envoyé à {email}
                </Text>
              </View>

              <View style={[styles.inputContainer, { backgroundColor: theme.surface, ...theme.shadows.card }]}>
                <MaterialIcons name="pin" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput, { color: theme.textPrimary }]}
                  placeholder="Code de vérification"
                  placeholderTextColor={theme.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: theme.accent }, operationLoading && styles.submitButtonDisabled]}
                onPress={handleVerifyOTP}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="verified" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Créer mon compte</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.backButton}
                onPress={() => setRegisterStep('email')}
              >
                <MaterialIcons name="arrow-back" size={18} color={theme.textSecondary} />
                <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>Modifier l'email</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Footer */}
          <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              En continuant, vous acceptez nos conditions d'utilisation
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
    marginBottom: 36,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 28,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeTabText: {
    fontSize: 15,
    fontWeight: '600',
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
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
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
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
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
    marginTop: 16,
    marginBottom: 8,
  },
  otpInfoText: {
    fontSize: 14,
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
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
