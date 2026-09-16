// @ts-nocheck
import { AuthUser, SendOTPOptions, SignUpResult, GoogleSignInResult } from '../types';
import { safeSupabaseOperation, getSharedSupabaseClient, setGoogleOnlySupabaseBypass } from '../../core/client';
import { configManager } from '../../core/config';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ensure Web platform correctly handles auth callbacks
WebBrowser.maybeCompleteAuthSession();

/** Redirect target for email magic links / PKCE (must be listed in Supabase → Auth → URL configuration). */
export function getAuthEmailRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'ultimatepetanque',
    path: 'auth',
  });
}

/** Sentinel returned when Google is disabled in Supabase Dashboard (not an app bug). */
export const GOOGLE_PROVIDER_NOT_ENABLED = '__GOOGLE_PROVIDER_NOT_ENABLED__';

/** Google blocks OAuth inside embedded WebViews (common in Expo Go). */
export const GOOGLE_DISALLOWED_USER_AGENT = '__GOOGLE_DISALLOWED_USER_AGENT__';

/** Google Sign-In is not supported inside the Expo Go app shell. */
export const GOOGLE_EXPO_GO_REQUIRES_DEV_BUILD = '__GOOGLE_EXPO_GO_REQUIRES_DEV_BUILD__';

/** Native Google Sign-In package is missing from the installed build. */
export const GOOGLE_NATIVE_SIGNIN_PACKAGE_MISSING = '__GOOGLE_NATIVE_SIGNIN_PACKAGE_MISSING__';

/** Set while the system-browser Google OAuth flow is waiting for a deep-link callback. */
export const GOOGLE_OAUTH_IN_PROGRESS_KEY = '@ultimatepetanque_google_oauth_in_progress';

/** Deep-link URL captured by app/auth.tsx when Custom Tabs reports dismiss on Android. */
export const GOOGLE_OAUTH_CALLBACK_URL_KEY = '@ultimatepetanque_google_oauth_callback_url';

const GOOGLE_PREFER_OAUTH_KEY = '@ultimatepetanque_google_prefer_oauth';
const GOOGLE_ONLY_USER_KEY = '@ultimatepetanque_google_only_user';
const GOOGLE_ONLY_TOKEN_KEY = '@ultimatepetanque_google_only_tokens';
const GOOGLE_ONLY_CREATED_AT_KEY = '@ultimatepetanque_google_only_created_at';
const googleAuthSubscribers = new Set<(user: AuthUser | null) => void>();
let googleNativeConfigured = false;

function getGoogleNativeSignInModule(): any | null {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

function cleanEnvValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getExpoExtraValue(...keys: string[]): string {
  const extra = Constants.expoConfig?.extra || {};

  for (const key of keys) {
    const directExtra = cleanEnvValue(extra[key]);
    if (directExtra) return directExtra;

    const publiclessExtra = cleanEnvValue(extra[key.replace('EXPO_PUBLIC_', '')]);
    if (publiclessExtra) return publiclessExtra;
  }

  return '';
}

function getGoogleWebClientId(): string {
  // Expo only inlines EXPO_PUBLIC_* values when they are referenced with
  // static dot notation. Do not read this with process.env[key].
  return (
    cleanEnvValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
    getExpoExtraValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'GOOGLE_WEB_CLIENT_ID', 'googleWebClientId')
  );
}

function getGoogleIosClientId(): string {
  return (
    cleanEnvValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ||
    getExpoExtraValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID', 'googleIosClientId')
  );
}

function getGoogleAndroidClientId(): string {
  return (
    cleanEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ||
    getExpoExtraValue('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID', 'googleAndroidClientId')
  );
}

function configureNativeGoogleSignIn(GoogleSignin: any) {
  if (googleNativeConfigured) return;

  const webClientId = getGoogleWebClientId();
  const iosClientId = getGoogleIosClientId();

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
    profileImageSize: 120,
    scopes: ['profile', 'email'],
  });

  googleNativeConfigured = true;
}

function extractGoogleIdToken(result: any, tokens?: any): string | null {
  return (
    result?.idToken ||
    result?.data?.idToken ||
    tokens?.idToken ||
    null
  );
}

function isGoogleCancelError(error: any): boolean {
  const code = String(error?.code || error?.message || '').toLowerCase();
  return (
    code.includes('sign_in_cancelled') ||
    code.includes('cancelled') ||
    code.includes('canceled') ||
    code.includes('user cancelled')
  );
}

async function readStoredGoogleOnlyUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_ONLY_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function clearStoredGoogleOnlyUser() {
  await AsyncStorage.multiRemove([GOOGLE_ONLY_USER_KEY, GOOGLE_ONLY_TOKEN_KEY, GOOGLE_ONLY_CREATED_AT_KEY]);
}

function notifyGoogleAuthSubscribers(user: AuthUser | null) {
  googleAuthSubscribers.forEach((callback) => {
    try {
      callback(user);
    } catch (error) {
      console.warn('[Template:AuthService] Auth subscriber failed:', error);
    }
  });
}

function isExpoGoClient(): boolean {
  return Constants.appOwnership === 'expo';
}

function parseOAuthCallbackError(callbackUrl: string): string | null {
  try {
    const params = new URL(callbackUrl).searchParams;
    const err = params.get('error');
    const desc = params.get('error_description');
    const combined = `${err ?? ''} ${desc ?? ''}`.toLowerCase();
    if (combined.includes('disallowed_useragent')) {
      return GOOGLE_DISALLOWED_USER_AGENT;
    }
    if (err || desc) {
      return desc || err;
    }
  } catch {
    // ignore malformed callback URLs
  }
  return null;
}

function mapGoogleOAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return GOOGLE_PROVIDER_NOT_ENABLED;
  }
  if (m.includes('disallowed_useragent') || m.includes("doesn't comply with google")) {
    return GOOGLE_DISALLOWED_USER_AGENT;
  }
  return message;
}

function isGoogleIdTokenAudienceError(message: string): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('unacceptable audience') || m.includes('audience in id_token');
}

function extractOAuthCode(url: string): string | null {
  try {
    const { params } = QueryParams.getQueryParams(url);
    if (typeof params.code === 'string' && params.code.trim()) return params.code.trim();
  } catch {
    // fall through
  }
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
}

function extractOAuthTokens(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const { params } = QueryParams.getQueryParams(url);
    const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
    const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  } catch {
    // fall through
  }
  return null;
}

async function discardLeftoverGoogleOnlySession() {
  const leftover = await readStoredGoogleOnlyUser();
  if (!leftover) {
    setGoogleOnlySupabaseBypass(false);
    return;
  }

  try {
    const nativeGoogle = getGoogleNativeSignInModule();
    await nativeGoogle?.GoogleSignin?.signOut?.();
  } catch {
    // Best-effort native Google sign-out.
  }

  await clearStoredGoogleOnlyUser();
  setGoogleOnlySupabaseBypass(false);
}

// Visibility change listener related variables
let lastVisibilityChange = 0;
let visibilityListener: (() => void) | null = null;

// Operation state tracking to prevent deadlock
let isUpdatingUserInOTPFlow = false;

const TIMEOUT_CONFIG = {
  AUTH_OPERATIONS: 10000,
  DATA_QUERIES: 8000,  
  SESSION_REFRESH: 5000,
  USER_UPDATE: 15000,
};

// Utility function to add timeout to any Promise with proper cleanup
const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string = 'Operation'
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs/1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const isAuthError = (error: any): boolean => {
  if (error.message?.includes('timeout')) return false;
  return error.status === 401 || 
         error.status === 403 || 
         error.message?.includes('invalid_token');
};

// Visibility monitoring logic - used to optimize auth event handling
const setupVisibilityMonitoring = () => {
  if (visibilityListener || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  visibilityListener = () => {
    lastVisibilityChange = Date.now();
  };

  document.addEventListener('visibilitychange', visibilityListener);
};

export const isVisibilityTriggeredAuthEvent = (event: string): boolean => {
  if (event !== 'SIGNED_IN') return false;

  const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
  return timeSinceVisibilityChange < 1000;
};

export const getLastVisibilityChange = (): number => lastVisibilityChange;

// Enhanced event filtering to prevent deadlock
export const shouldIgnoreAuthEvent = (event: string): boolean => {
  // Ignore USER_UPDATED events during updateUser operation to prevent deadlock
  if (event === 'USER_UPDATED' && isUpdatingUserInOTPFlow) {
    return true;
  }
  
  // Ignore visibility-triggered events
  if (isVisibilityTriggeredAuthEvent(event)) {
    return true;
  }
  
  return false;
};

export class AuthService {
  constructor() {
    // Initialize visibility monitoring
    setupVisibilityMonitoring();
  }

  private get supabase() {
    return getSharedSupabaseClient();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      // Older builds stored a local-only Google user that never linked to Supabase.
      // Discard that so the real Google/email account can sign in.
      await discardLeftoverGoogleOnlySession();

      const session = await safeSupabaseOperation(async (client) => {
        const { data: { session }, error } = await withTimeout(
          client.auth.getSession(),
          TIMEOUT_CONFIG.DATA_QUERIES,
          'GetSession'
        );
        
        if (error) throw error;
        return session;
      }, true);
      
      if (!session?.user) return null;

      return this.mapSessionToAuthUser(session.user);

    } catch (error) {
      if (isAuthError(error)) {
        return null;
      }
      
      return null;
    }
  }

  // Unified session.user mapping - used by all auth flows
  private mapSessionToAuthUser(sessionUser: any): AuthUser {
    return {
      id: sessionUser.id,
      email: sessionUser.email || '',
      username: sessionUser.user_metadata?.username || 
               sessionUser.user_metadata?.full_name || 
               sessionUser.user_metadata?.name || 
               sessionUser.email?.split('@')[0] || 
               `user_${sessionUser.id.slice(0, 8)}`,
      created_at: sessionUser.created_at,
      updated_at: sessionUser.updated_at || sessionUser.created_at,
    };
  }

  async sendOTP(email: string, options: SendOTPOptions = {}) {
    await discardLeftoverGoogleOnlySession();
    try {
      const { shouldCreateUser = true, includeMagicLinkRedirect = false } = options;
      // Numeric OTP: do not pass emailRedirectTo (see Supabase passwordless OTP docs).
      // Passing emailRedirectTo + {{ .ConfirmationURL }} in the email template sends a magic link
      // (often redirect_to=http://localhost:3000 when Site URL is unset).
      const signInOptions: { shouldCreateUser: boolean; emailRedirectTo?: string } = {
        shouldCreateUser,
      };
      if (includeMagicLinkRedirect) {
        signInOptions.emailRedirectTo = options.emailRedirectTo ?? getAuthEmailRedirectUri();
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[Template:AuthService] signInWithOtp emailRedirectTo:', signInOptions.emailRedirectTo);
        }
      }

      const emailNormalized = email.trim().toLowerCase();

      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signInWithOtp({
            email: emailNormalized,
            options: signInOptions,
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SendOTP'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Network is slow, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sendOTP error';
      console.warn('[Template:AuthService] SendOTP system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Network connection timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: 'Failed to send verification code', errorType: 'network' };
    }
  }

  async verifyOTPAndLogin(email: string, otp: string, options?: { password?: string }) {
    await discardLeftoverGoogleOnlySession();
    try {
      const token = otp.replace(/\D/g, '');
      const emailNormalized = email.trim().toLowerCase();

      return await safeSupabaseOperation(async (client) => {
        // New signups may need type "signup"; returning users use "email".
        const otpTypes: Array<'email' | 'signup'> = ['email', 'signup'];
        let data: Awaited<ReturnType<typeof client.auth.verifyOtp>>['data'] | null = null;
        let lastError: { message: string } | null = null;

        for (const type of otpTypes) {
          const result = await withTimeout(
            client.auth.verifyOtp({
              email: emailNormalized,
              token,
              type,
            }),
            TIMEOUT_CONFIG.AUTH_OPERATIONS,
            'VerifyOTP'
          );
          if (!result.error) {
            data = result.data;
            lastError = null;
            break;
          }
          lastError = result.error;
          const retryable =
            /invalid|expired|otp/i.test(result.error.message) && type === 'email';
          if (!retryable) break;
        }

        if (lastError) {
          const error = lastError;
          if (error.message.includes('Database error saving new user')) {
            console.warn('[Template:AuthService] Database trigger missing, auth function available but user profile creation failed');
            console.warn('[Template:AuthService] Please refer to SDK documentation to set up user_profiles table and triggers');
          }
          
          if (error.message.includes('timeout')) {
            return { error: 'Verification timeout, please retry', user: null, errorType: 'timeout' };
          }

          const msg = error.message.toLowerCase();
          if (msg.includes('expired')) {
            return { error: 'Code expired. Tap “Get code” to receive a new one.', user: null, errorType: 'business' };
          }
          if (msg.includes('invalid') || msg.includes('otp')) {
            return {
              error: 'Invalid code. Use the latest 6-digit code from your email (not the link).',
              user: null,
              errorType: 'business',
            };
          }
          
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
  
          // Step 2: Update user with password if provided (with deadlock prevention)
          if (options?.password) {
            
            try {
              // Set flag to prevent deadlock
              isUpdatingUserInOTPFlow = true;
              
              const { data: updateData, error: updateError } = await withTimeout(
                client.auth.updateUser({ password: options.password }),
                TIMEOUT_CONFIG.USER_UPDATE,
                'UpdateUser'
              );
              
              
              if (updateError) {
                console.warn('[Template:AuthService] User update failed after OTP verification:', updateError.message);
                // Note: We don't fail the entire operation if user update fails
                // The user is still successfully authenticated via OTP
              }
              
              // Clear flag after a delay to ensure all events are processed
              setTimeout(() => {
                isUpdatingUserInOTPFlow = false;
              }, 2000);
              
            } catch (updateError) {
              // Clear flag on error
              isUpdatingUserInOTPFlow = false;
              // Continue with the authentication flow
            }
          }

          // Standard flow: Check session status (wait a bit if we just updated user)
          if (options?.password) {
            // Wait a moment for the update to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              // Final fallback: Use original verification data
              const fallbackUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || '',
                username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
                created_at: data.user.created_at,
                updated_at: data.user.updated_at || data.user.created_at,
              };
              return { user: fallbackUser };
            }
          } catch (userError) {
            const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
            
            // Use fallback data
            const fallbackUser: AuthUser = {
              id: data.user.id,
              email: data.user.email || '',
              username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
              created_at: data.user.created_at,
              updated_at: data.user.updated_at || data.user.created_at,
            };
            return { user: fallbackUser };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verifyOTP error';
      console.warn('[Template:AuthService] VerifyOTPAndLogin system exception:', errorMessage);
      
      // Clear flag on any error
      isUpdatingUserInOTPFlow = false;
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Login timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Login failed', user: null, errorType: 'network' };
    }
  }

  async signUpWithPassword(email: string, password: string, metadata: Record<string, any> = {}): Promise<SignUpResult> {
    await discardLeftoverGoogleOnlySession();
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signUp({
            email,
            password,
            options: {
              data: metadata
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignUp'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }

        if (data.user && !data.session) {
          return { 
            user: null, 
            needsEmailConfirmation: true 
          };
        }

        if (data.user && data.session) {
          try {
            const authUser = await this.getCurrentUser();
            return { user: authUser };
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after signup:', userError);
            return { error: 'Sign up succeeded but failed to load profile', user: null, errorType: 'network' };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signUp error';
      console.warn('[Template:AuthService] SignUpWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
      }
      
      return { error: 'Sign up failed', errorType: 'network' };
    }
  }

  async signInWithPassword(email: string, password: string) {
    await discardLeftoverGoogleOnlySession();
    try {
      const emailNormalized = email.trim().toLowerCase();

      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signInWithPassword({
            email: emailNormalized,
            password
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignIn'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
          }
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
          try {
            const authUser = await this.getCurrentUser();

            if (authUser) {
              return { user: authUser };
            }
            return { user: this.mapSessionToAuthUser(data.user) };
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after sign in:', userError);
            return { user: this.mapSessionToAuthUser(data.user) };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signIn error';
      console.warn('[Template:AuthService] SignInWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Sign in failed', user: null, errorType: 'network' };
    }
  }

  async logout() {
    try {
      try {
        const nativeGoogle = getGoogleNativeSignInModule();
        await nativeGoogle?.GoogleSignin?.signOut?.();
      } catch {
        // Best-effort native Google sign-out.
      }

      await clearStoredGoogleOnlyUser();
      setGoogleOnlySupabaseBypass(false);
      notifyGoogleAuthSubscribers(null);

      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signOut(),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'Logout'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Logout timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown logout error';
      console.warn('[Template:AuthService] Logout system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Logout timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: errorMessage, errorType: 'network' };
    }
  }

  async refreshSession() {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.refreshSession(),
          TIMEOUT_CONFIG.SESSION_REFRESH,
          'RefreshSession'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            console.warn('[Template:AuthService] Session refresh timeout');
          } else {
            console.warn('[Template:AuthService] Refresh session error:', error);
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error';
      console.warn('[Template:AuthService] RefreshSession system exception:', errorMessage);
    }
  }

  async signInWithGoogle(): Promise<GoogleSignInResult> {
    try {
      await discardLeftoverGoogleOnlySession();

      if (Platform.OS === 'web') {
        return await this.completeGoogleOAuthInBrowser();
      }

      if (isExpoGoClient()) {
        return { error: GOOGLE_EXPO_GO_REQUIRES_DEV_BUILD };
      }

      const preferOAuth = await AsyncStorage.getItem(GOOGLE_PREFER_OAUTH_KEY);
      if (preferOAuth === '1') {
        return await this.completeGoogleOAuthInBrowser();
      }

      const nativeGoogle = getGoogleNativeSignInModule();
      const GoogleSignin = nativeGoogle?.GoogleSignin;
      const statusCodes = nativeGoogle?.statusCodes;

      if (!GoogleSignin) {
        return await this.completeGoogleOAuthInBrowser();
      }

      const webClientId = getGoogleWebClientId();
      if (!webClientId) {
        return {
          error: 'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Create a Google OAuth Web client and add its client ID to .env.'
        };
      }

      if (Platform.OS === 'android' && !getGoogleAndroidClientId()) {
        console.warn('[Template:AuthService] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is missing. Android sign-in may fail if the Google Cloud Android OAuth client is not configured for this package/SHA-1.');
      }

      configureNativeGoogleSignIn(GoogleSignin);

      if (Platform.OS === 'android' && typeof GoogleSignin.hasPlayServices === 'function') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Do not timeout the account picker — users often take longer than 10s.
      const googleResult = await GoogleSignin.signIn();

      if (googleResult?.type === 'cancelled' || googleResult?.type === 'cancel') {
        return { error: 'User cancelled login' };
      }

      let tokens: any = null;
      try {
        tokens = await GoogleSignin.getTokens?.();
      } catch {
        tokens = null;
      }

      const idToken = extractGoogleIdToken(googleResult, tokens);
      if (!idToken) {
        return { error: 'Google login succeeded but no ID token was returned. Check that EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the Web client ID.' };
      }

      const accessToken = tokens?.accessToken || googleResult?.data?.accessToken || googleResult?.accessToken || null;
      const { data, error } = await withTimeout(
        this.supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          access_token: accessToken || undefined,
        }),
        TIMEOUT_CONFIG.USER_UPDATE,
        'GoogleIdToken'
      );

      if (error) {
        // Native ID tokens are minted for EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
        // If that is not the Web client ID stored in Supabase → Auth → Google,
        // GoTrue rejects the token. Complete login through Supabase OAuth instead.
        if (isGoogleIdTokenAudienceError(error.message)) {
          await AsyncStorage.setItem(GOOGLE_PREFER_OAUTH_KEY, '1');
          try {
            await GoogleSignin.signOut?.();
          } catch {
            // Continue to the browser fallback.
          }
          return await this.completeGoogleOAuthInBrowser();
        }
        return { error: mapGoogleOAuthError(error.message) };
      }
      if (!data?.user) {
        return { error: 'Google login succeeded but no session was created.' };
      }

      notifyGoogleAuthSubscribers(this.mapSessionToAuthUser(data.user));
      await AsyncStorage.removeItem(GOOGLE_PREFER_OAUTH_KEY);
      return { error: null };
    } catch (error: any) {
      const nativeGoogle = getGoogleNativeSignInModule();
      const statusCodes = nativeGoogle?.statusCodes;

      if (isGoogleCancelError(error) || error?.code === statusCodes?.SIGN_IN_CANCELLED) {
        return { error: 'User cancelled login' };
      }

      if (error?.code === statusCodes?.IN_PROGRESS) {
        return { error: 'Google sign-in is already in progress' };
      }

      if (error?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: 'Google Play Services is not available or needs an update' };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown Google login error';
      if (isGoogleIdTokenAudienceError(errorMessage)) {
        await AsyncStorage.setItem(GOOGLE_PREFER_OAUTH_KEY, '1');
        return await this.completeGoogleOAuthInBrowser();
      }
      if (errorMessage.includes('timeout')) {
        return { error: 'Google login timeout, please retry' };
      }

      return { error: mapGoogleOAuthError(errorMessage) };
    }
  }

  private async completeGoogleOAuthInBrowser(): Promise<GoogleSignInResult> {
    const redirectTo = getAuthEmailRedirectUri();
    await AsyncStorage.setItem(GOOGLE_OAUTH_IN_PROGRESS_KEY, '1');
    await AsyncStorage.removeItem(GOOGLE_OAUTH_CALLBACK_URL_KEY);

    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        return { error: mapGoogleOAuthError(error.message) };
      }
      if (!data?.url) {
        return { error: 'Failed to start Google login' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        showInRecents: true,
      });

      let callbackUrl: string | null = null;
      if (result.type === 'success' && result.url) {
        callbackUrl = result.url;
      } else {
        callbackUrl = await AsyncStorage.getItem(GOOGLE_OAUTH_CALLBACK_URL_KEY);
      }

      if (!callbackUrl) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { error: 'User cancelled login' };
        }
        return { error: 'Google login did not complete' };
      }

      const parsedError = parseOAuthCallbackError(callbackUrl);
      if (parsedError) {
        return { error: parsedError };
      }

      const code = extractOAuthCode(callbackUrl);
      if (code) {
        const { error: exchangeError } = await withTimeout(
          this.supabase.auth.exchangeCodeForSession(code),
          TIMEOUT_CONFIG.USER_UPDATE,
          'GoogleExchangeCode'
        );
        if (exchangeError) {
          return { error: mapGoogleOAuthError(exchangeError.message) };
        }
        await this.publishCurrentSupabaseUser();
        return { error: null };
      }

      const tokens = extractOAuthTokens(callbackUrl);
      if (tokens) {
        const { error: sessionError } = await withTimeout(
          this.supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          }),
          TIMEOUT_CONFIG.USER_UPDATE,
          'GoogleSetSession'
        );
        if (sessionError) {
          return { error: mapGoogleOAuthError(sessionError.message) };
        }
        await this.publishCurrentSupabaseUser();
        return { error: null };
      }

      return { error: 'Google login missing authorization code' };
    } finally {
      await AsyncStorage.multiRemove([GOOGLE_OAUTH_IN_PROGRESS_KEY, GOOGLE_OAUTH_CALLBACK_URL_KEY]);
    }
  }

  private async publishCurrentSupabaseUser() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      notifyGoogleAuthSubscribers(session?.user ? this.mapSessionToAuthUser(session.user) : null);
    } catch (error) {
      console.warn('[Template:AuthService] Could not publish Google session:', error);
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    googleAuthSubscribers.add(callback);

    let supabaseSubscription: any = null;

    try {
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (shouldIgnoreAuthEvent(event)) {
            return;
          }

          if (session?.user) {
            try {
              const authUser = this.mapSessionToAuthUser(session.user);
              callback(authUser);
            } catch (error) {
              console.warn('[Template:AuthService] Error in auth state change callback:', error);
              callback(null);
            }
          } else {
            callback(null);
          }
        }
      );

      supabaseSubscription = subscription;
    } catch (error) {
      console.warn('[Template:AuthService] Supabase auth listener unavailable:', error);
    }

    return {
      unsubscribe: () => {
        googleAuthSubscribers.delete(callback);
        supabaseSubscription?.unsubscribe?.();
      },
    };
  }
}

export const authService = new AuthService();