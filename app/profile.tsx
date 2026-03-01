import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Club } from '@/services/mockData';
import { getUnreadShareNotificationCount } from '@/services/shareService';
import { useLanguage } from '@/hooks/useLanguage';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, operationLoading, sendOTP } = useAuth();
  const { showAlert } = useAlert();
  const { clubs, addClub, updatePlayer, selfPlayer, userStats, matches, challenges, tournaments, refreshData } = useApp();
  const supabase = getSupabaseClient();
  const { t, language, setLanguage } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Profile fields
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole>('Milieu');
  const [level, setLevel] = useState<string>('Intermédiaire');
  const [club, setClub] = useState('');
  const [clubId, setClubId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Club picker state
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubCity, setNewClubCity] = useState('');
  
  // Share notifications count
  const [unreadShareCount, setUnreadShareCount] = useState(0);
  
  // Expandable settings sections
  const [showNotifSection, setShowNotifSection] = useState(false);
  const [showShareSection, setShowShareSection] = useState(false);
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp'>('confirm');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  
  // Load unread share notification count
  useEffect(() => {
    if (!user?.id) return;
    const loadCount = async () => {
      const count = await getUnreadShareNotificationCount();
      setUnreadShareCount(count);
    };
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
  


  // Filtered clubs based on search
  const filteredClubs = useMemo(() => {
    if (!clubSearch.trim()) return clubs;
    const search = clubSearch.toLowerCase();
    return clubs.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.city.toLowerCase().includes(search)
    );
  }, [clubs, clubSearch]);

  const levels = [
    { id: 'Débutant', icon: 'school' },
    { id: 'Intermédiaire', icon: 'trending-up' },
    { id: 'Confirmé', icon: 'stars' },
    { id: 'Expert', icon: 'emoji-events' },
  ];

  const roles: { id: PlayerRole; icon: string }[] = [
    { id: 'Tireur', icon: 'gps-fixed' },
    { id: 'Pointeur', icon: 'adjust' },
    { id: 'Milieu', icon: 'swap-horiz' },
  ];

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setUsername(data.username || '');
          setRole(data.role || 'Milieu');
          setLevel(data.level || 'Intermédiaire');
          setClub(data.club || '');
          setAvatarUrl(data.avatar || null);
        }
        
        // Load club ID from player record if available
        if (selfPlayer?.clubId) {
          setClubId(selfPlayer.clubId);
        }
        if (selfPlayer?.avatar) {
          setAvatarUrl(selfPlayer.avatar);
        }
        if (selfPlayer?.phone) {
          setPhone(selfPlayer.phone);
        }
        if (selfPlayer?.email) {
          setEmail(selfPlayer.email);
        }
        

      } catch (error) {
        console.log('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id, selfPlayer]);



  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission'));
        return;
      }

      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: any) {
      console.log('Error picking image:', error);
      showAlert(t('common', 'error'), t('profile', 'errorSelectImage'));
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission'));
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: any) {
      console.log('Error taking photo:', error);
      showAlert(t('common', 'error'), t('profile', 'errorTakePhoto'));
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.id || !asset.base64) return;

    setUploadingPhoto(true);
    try {
      // Generate unique filename
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(asset.base64), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        // Try creating bucket if it doesn't exist
        if (uploadError.message?.includes('not found')) {
          showAlert(t('profile', 'configurationLabel'), t('profile', 'storageNotConfigured'));
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update player record
      await supabase
        .from('players')
        .update({ avatar: publicUrl })
        .eq('id', user.id);

      // Update local state
      setAvatarUrl(publicUrl);
      await updatePlayer(user.id, { avatar: publicUrl });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('profile', 'photoUpdated'));
    } catch (error: any) {
      console.log('Error uploading avatar:', error);
      showAlert(t('common', 'error'), error.message || t('profile', 'errorUploadPhoto'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      t('profile', 'photoProfile'),
      t('profile', 'chooseOption'),
      [
        { text: t('profile', 'takePhoto'), onPress: handleTakePhoto },
        { text: t('profile', 'chooseGallery'), onPress: handlePickImage },
        ...(avatarUrl ? [{ text: t('profile', 'removePhoto'), style: 'destructive' as const, onPress: handleRemovePhoto }] : []),
        { text: t('common', 'cancel'), style: 'cancel' as const },
      ]
    );
  };

  const handleRemovePhoto = async () => {
    if (!user?.id) return;

    try {
      // Update profile
      await supabase
        .from('user_profiles')
        .update({ avatar: null })
        .eq('id', user.id);

      // Update player record
      await supabase
        .from('players')
        .update({ avatar: null })
        .eq('id', user.id);

      setAvatarUrl(null);
      await updatePlayer(user.id, { avatar: undefined });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Error removing avatar:', error);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      showAlert(t('common', 'error'), t('profile', 'usernameRequired'));
      return;
    }

    setSaving(true);
    try {
      // Update user profile
      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: username.trim(),
          role,
          level,
          club: club || null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Also update the player record
      if (user?.id) {
        await updatePlayer(user.id, {
          name: username.trim(),
          role,
          level,
          club: club || undefined,
          clubId: clubId || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('profile', 'profileUpdated'));
      setIsEditing(false);
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || t('profile', 'errorUpdateProfile'));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectClub = (selectedClub: Club) => {
    Haptics.selectionAsync();
    setClub(selectedClub.name);
    setClubId(selectedClub.id);
    setShowClubPicker(false);
    setClubSearch('');
  };

  const handleCreateClub = async () => {
    if (!newClubName.trim() || !newClubCity.trim()) {
      showAlert(t('common', 'error'), t('profile', 'nameAndCityRequired'));
      return;
    }

    try {
      const newClub: Omit<Club, 'id'> = {
        name: newClubName.trim(),
        city: newClubCity.trim(),
        location: { latitude: 0, longitude: 0 },
        membersCount: 1,
      };
      await addClub(newClub);
      
      setClub(newClubName.trim());
      setShowCreateClub(false);
      setShowClubPicker(false);
      setNewClubName('');
      setNewClubCity('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || t('profile', 'errorCreateClub'));
    }
  };

  const handleRemoveClub = () => {
    Haptics.selectionAsync();
    setClub('');
    setClubId(null);
  };

  const handleSendDeleteOtp = async () => {
    const confirmWord = t('profile', 'deleteConfirmWord');
    if (deleteConfirmText.trim().toUpperCase() !== confirmWord) return;
    if (!user?.email) {
      showAlert(t('common', 'error'), 'Email not found');
      return;
    }
    setSendingOtp(true);
    try {
      const { error } = await sendOTP(user.email);
      if (error) {
        showAlert(t('common', 'error'), error);
        return;
      }
      setDeleteStep('otp');
    } catch (e: any) {
      showAlert(t('common', 'error'), e.message || 'Unknown error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (otpCode.trim().length < 4) return;

    setDeletingAccount(true);
    try {
      // Verify OTP first
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: user?.email || '',
        token: otpCode.trim(),
        type: 'email',
      });
      if (otpError) {
        showAlert(t('profile', 'deleteAccountOtpError'), otpError.message);
        setDeletingAccount(false);
        return;
      }

      // OTP verified, proceed with deletion
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const textContent = await error.context?.text();
            const parsed = textContent ? JSON.parse(textContent) : null;
            errorMessage = parsed?.error || textContent || error.message;
          } catch {
            errorMessage = error.message || 'Failed to read response';
          }
        }
        showAlert(t('profile', 'deleteAccountError'), errorMessage);
        setDeletingAccount(false);
        return;
      }

      // Account deleted successfully - close modal and logout
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      showAlert(t('profile', 'deleteAccountSuccess'), t('profile', 'deleteAccountSuccessMsg'));
      // Small delay so the user sees the success message
      setTimeout(async () => {
        await logout();
      }, 1500);
    } catch (e: any) {
      showAlert(t('profile', 'deleteAccountError'), e.message || 'Unknown error');
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('profile', 'logoutConfirm'),
      t('profile', 'logoutMessage'),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('profile', 'logoutConfirm'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await logout();
            if (error) {
              showAlert(t('common', 'error'), error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile', 'myProfile')}</Text>
        {isEditing ? (
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.cancelButton}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelButtonText}>{t('common', 'cancel')}</Text>
            </Pressable>
            <Pressable 
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('common', 'save')}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable 
            style={styles.editButton}
            onPress={() => setIsEditing(true)}
          >
            <MaterialIcons name="edit" size={20} color={theme.primary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          {/* Avatar with photo picker */}
          <Pressable 
            style={styles.avatarContainer}
            onPress={showPhotoOptions}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {username ? username.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <MaterialIcons name="camera-alt" size={16} color="#FFF" />
            </View>
          </Pressable>

          {/* Name and Role */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{username || t('share', 'userFallback')}</Text>
            <View style={styles.heroMeta}>
              <View style={styles.heroBadge}>
                <MaterialIcons 
                  name={roles.find(r => r.id === role)?.icon as any || 'person'} 
                  size={14} 
                  color={theme.primary} 
                />
                <Text style={styles.heroBadgeText}>{t('roles', role)}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons 
                  name={levels.find(l => l.id === level)?.icon as any || 'trending-up'} 
                  size={14} 
                  color={theme.accent} 
                />
                <Text style={[styles.heroBadgeText, { color: theme.accent }]}>{t('levels', level)}</Text>
              </View>
            </View>
            {club && (
              <View style={styles.heroClub}>
                <MaterialIcons name="location-city" size={14} color={theme.textSecondary} />
                <Text style={styles.heroClubText}>{club}</Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{matches.length}</Text>
              <Text style={styles.quickStatLabel}>{t('profile', 'matches')}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatValue, { color: theme.success }]}>
                {userStats.winRate}%
              </Text>
              <Text style={styles.quickStatLabel}>{t('profile', 'victories')}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{challenges.length}</Text>
              <Text style={styles.quickStatLabel}>{t('profile', 'challenges')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Edit Mode Fields */}
        {isEditing && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.editSection}>
            <Text style={styles.sectionTitle}>{t('profile', 'editProfile')}</Text>
            
            {/* Username */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <MaterialIcons name="person" size={18} color={theme.primary} />
                <Text style={styles.fieldLabel}>{t('profile', 'username')}</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={username}
                onChangeText={setUsername}
                placeholder={t('profile', 'usernamePlaceholder')}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {/* Role Selection */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <MaterialIcons name="sports" size={18} color={theme.accent} />
                <Text style={styles.fieldLabel}>{t('profile', 'preferredRole')}</Text>
              </View>
              <View style={styles.optionGrid}>
                {roles.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[styles.optionCard, role === r.id && styles.optionCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRole(r.id);
                    }}
                  >
                    <MaterialIcons 
                      name={r.icon as any} 
                      size={24} 
                      color={role === r.id ? theme.primary : theme.textSecondary} 
                    />
                    <Text style={[styles.optionText, role === r.id && styles.optionTextActive]}>
                      {t('roles', r.id)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Level Selection */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <MaterialIcons name="trending-up" size={18} color={theme.carreauColor} />
                <Text style={styles.fieldLabel}>{t('profile', 'level')}</Text>
              </View>
              <View style={styles.levelGrid}>
                {levels.map((l) => (
                  <Pressable
                    key={l.id}
                    style={[styles.levelCard, level === l.id && styles.levelCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLevel(l.id);
                    }}
                  >
                    <MaterialIcons 
                      name={l.icon as any} 
                      size={20} 
                      color={level === l.id ? theme.carreauColor : theme.textSecondary} 
                    />
                    <Text style={[styles.levelText, level === l.id && styles.levelTextActive]}>
                      {t('levels', l.id)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Contact Info */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <MaterialIcons name="contact-phone" size={18} color={theme.warning} />
                <Text style={styles.fieldLabel}>{t('profile', 'contact')}</Text>
              </View>
              <View style={styles.contactFieldContainer}>
                <View style={styles.contactFieldRow}>
                  <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={styles.contactFieldInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t('profile', 'phone')}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.contactFieldDivider} />
                <View style={styles.contactFieldRow}>
                  <MaterialIcons name="email" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={styles.contactFieldInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('profile', 'emailAddress')}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            {/* Club Selection */}
            <View style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <MaterialIcons name="location-city" size={18} color={theme.success} />
                <Text style={styles.fieldLabel}>Club</Text>
              </View>
              {club ? (
                <View style={styles.selectedClubContainer}>
                  <View style={styles.selectedClubInfo}>
                    <View style={styles.selectedClubIcon}>
                      <MaterialIcons name="home" size={20} color={theme.success} />
                    </View>
                    <Text style={styles.selectedClubName}>{club}</Text>
                  </View>
                  <View style={styles.selectedClubActions}>
                    <Pressable 
                      style={styles.changeClubBtn}
                      onPress={() => setShowClubPicker(true)}
                    >
                      <MaterialIcons name="swap-horiz" size={18} color={theme.primary} />
                    </Pressable>
                    <Pressable 
                      style={styles.removeClubBtn}
                      onPress={handleRemoveClub}
                    >
                      <MaterialIcons name="close" size={18} color={theme.error} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.selectClubButton}
                  onPress={() => setShowClubPicker(true)}
                >
                  <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
                  <Text style={styles.selectClubButtonText}>{t('profile', 'selectClub')}</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Financial Summary Button */}
        {!isEditing && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            {(() => {
              const myClub = selfPlayer?.clubId ? clubs.find(c => c.id === selfPlayer.clubId) : null;
              const membershipCost = myClub?.membershipCost || 0;
              const totalRegistrationCosts = tournaments.reduce((sum, t) => sum + (t.registrationCost || 0), 0);
              const totalPrizesWon = tournaments.reduce((sum, t) => sum + (t.prizeWon || 0), 0);
              const totalCosts = membershipCost + totalRegistrationCosts;
              const balance = totalPrizesWon - totalCosts;
              const podiums = tournaments.filter(t => ['1er', '2ème', '3ème'].includes(t.finalResult || '')).length;
              return (
                <Pressable
                  style={styles.financialButton}
                  onPress={() => router.push('/financial')}
                >
                  <View style={[styles.financialButtonIcon, { backgroundColor: (balance >= 0 ? theme.success : theme.error) + '15' }]}>
                    <MaterialIcons name="account-balance-wallet" size={24} color={balance >= 0 ? theme.success : theme.error} />
                  </View>
                  <View style={styles.financialButtonInfo}>
                    <Text style={styles.financialButtonTitle}>{t('profile', 'financialSummary')}</Text>
                    <View style={styles.financialButtonMeta}>
                      <Text style={[styles.financialButtonBalance, { color: balance >= 0 ? theme.success : theme.error }]}>
                        {balance >= 0 ? '+' : ''}{balance.toFixed(0)} €
                      </Text>
                      {podiums > 0 && (
                        <>
                          <View style={styles.financialButtonDot} />
                          <MaterialIcons name="emoji-events" size={12} color={theme.carreauColor} />
                          <Text style={styles.financialButtonPodiums}>{podiums} {t('palmares', 'podiums')}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
                </Pressable>
              );
            })()}
          </Animated.View>
        )}

        {/* View Mode - My Player Card & Palmares Links */}
        {!isEditing && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Pressable 
              style={styles.playerCardLink}
              onPress={() => router.push('/player/me')}
            >
              <View style={styles.playerCardLinkIcon}>
                <MaterialIcons name="badge" size={24} color={theme.primary} />
              </View>
              <View style={styles.playerCardLinkInfo}>
                <Text style={styles.playerCardLinkTitle}>{t('profile', 'myPlayerCard')}</Text>
                <Text style={styles.playerCardLinkSubtitle}>{t('profile', 'viewDetailedStats')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
            </Pressable>

            <Pressable 
              style={[styles.playerCardLink, { marginTop: 10 }]}
              onPress={() => router.push('/palmares')}
            >
              <View style={[styles.playerCardLinkIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="emoji-events" size={24} color={theme.carreauColor} />
              </View>
              <View style={styles.playerCardLinkInfo}>
                <Text style={styles.playerCardLinkTitle}>{t('profile', 'myPalmares')}</Text>
                <Text style={styles.playerCardLinkSubtitle}>{t('profile', 'tournamentsResultsGains')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
            </Pressable>

          </Animated.View>
        )}

        {/* Account Section */}
        {!isEditing && (
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile', 'settings')}</Text>

            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/password');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="lock" size={20} color={theme.primary} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{t('profile', 'password')}</Text>
                <Text style={styles.menuItemSubtext}>{t('profile', 'changePassword')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>

            {/* Notifications expandable */}
            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                Haptics.selectionAsync();
                setShowNotifSection(prev => !prev);
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="notifications" size={20} color={theme.success} />
                {unreadShareCount > 0 && (
                  <View style={styles.shareNotifBadge}>
                    <Text style={styles.shareNotifBadgeText}>{unreadShareCount > 9 ? '9+' : unreadShareCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{t('profile', 'notifications')}</Text>
                <Text style={styles.menuItemSubtext}>{t('profile', 'shareAndTournaments')}</Text>
              </View>
              <MaterialIcons name={showNotifSection ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
            </Pressable>

            {showNotifSection && (
              <View style={styles.subMenuContainer}>
                <Pressable 
                  style={styles.subMenuItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setUnreadShareCount(0);
                    router.push('/share-notifications');
                  }}
                >
                  <View style={[styles.subMenuIcon, { backgroundColor: theme.warning + '15' }]}>
                    <MaterialIcons name="share" size={16} color={theme.warning} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.subMenuItemText}>{t('profile', 'shareNotifications')}</Text>
                    <Text style={styles.menuItemSubtext}>
                      {unreadShareCount > 0 
                        ? `${unreadShareCount} ${t('profile', 'newAccess')}`
                        : t('profile', 'seeWhoAccessed')}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>

                <Pressable 
                  style={styles.subMenuItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/notifications');
                  }}
                >
                  <View style={[styles.subMenuIcon, { backgroundColor: theme.success + '15' }]}>
                    <MaterialIcons name="event" size={16} color={theme.success} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.subMenuItemText}>{t('profile', 'tournamentNotifications')}</Text>
                    <Text style={styles.menuItemSubtext}>{t('profile', 'remindersScheduling')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>
              </View>
            )}

            {/* Partage expandable */}
            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                Haptics.selectionAsync();
                setShowShareSection(prev => !prev);
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="folder-shared" size={20} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{t('profile', 'sharing')}</Text>
                <Text style={styles.menuItemSubtext}>{t('profile', 'codesAndManagement')}</Text>
              </View>
              <MaterialIcons name={showShareSection ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
            </Pressable>

            {showShareSection && (
              <View style={styles.subMenuContainer}>
                <Pressable 
                  style={styles.subMenuItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/share');
                  }}
                >
                  <View style={[styles.subMenuIcon, { backgroundColor: theme.success + '15' }]}>
                    <MaterialIcons name="qr-code-2" size={16} color={theme.success} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.subMenuItemText}>{t('profile', 'shareCode')}</Text>
                    <Text style={styles.menuItemSubtext}>{t('profile', 'enterCodeToView')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>

                <Pressable 
                  style={styles.subMenuItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/shared-items');
                  }}
                >
                  <View style={[styles.subMenuIcon, { backgroundColor: theme.warning + '15' }]}>
                    <MaterialIcons name="manage-accounts" size={16} color={theme.warning} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.subMenuItemText}>{t('profile', 'shareManagement')}</Text>
                    <Text style={styles.menuItemSubtext}>{t('profile', 'viewManageShared')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>
              </View>
            )}

            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/faq');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="help-outline" size={20} color={theme.carreauColor} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{t('profile', 'help')}</Text>
                <Text style={styles.menuItemSubtext}>{t('profile', 'helpCenter')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>

            {/* Language Switcher */}
            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                Haptics.selectionAsync();
                setLanguage(language === 'fr' ? 'en' : 'fr');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#6366F1' + '15' }]}>
                <MaterialIcons name="language" size={20} color="#6366F1" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{t('profile', 'language')}</Text>
                <Text style={styles.menuItemSubtext}>{language === 'fr' ? 'Français' : 'English'}</Text>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Logout & Delete Account */}
        {!isEditing && (
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.logoutSection}>
            <Pressable 
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={operationLoading}
            >
              {operationLoading ? (
                <ActivityIndicator color={theme.error} />
              ) : (
                <>
                  <MaterialIcons name="logout" size={20} color={theme.error} />
                  <Text style={styles.logoutButtonText}>{t('profile', 'logout')}</Text>
                </>
              )}
            </Pressable>

            <Pressable 
              style={styles.deleteAccountButton}
              onPress={() => setShowDeleteModal(true)}
            >
              <MaterialIcons name="delete-forever" size={18} color={theme.textMuted} />
              <Text style={styles.deleteAccountButtonText}>{t('profile', 'deleteAccount')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* App Version */}
        <Text style={styles.versionText}>{t('common', 'version')}</Text>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!deletingAccount && !sendingOtp) {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setDeleteStep('confirm');
            setOtpCode('');
          }
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                if (!deletingAccount && !sendingOtp) {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteStep('confirm');
                  setOtpCode('');
                }
              }}
              disabled={deletingAccount || sendingOtp}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t('profile', 'deleteAccount')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.deleteModalContent}>
            {deleteStep === 'confirm' ? (
              <>
                <View style={styles.deleteWarningIcon}>
                  <MaterialIcons name="warning" size={48} color={theme.error} />
                </View>
                <Text style={styles.deleteWarningTitle}>{t('profile', 'deleteAccountConfirm')}</Text>
                <Text style={styles.deleteWarningText}>{t('profile', 'deleteAccountWarning')}</Text>

                <View style={styles.deleteConfirmInput}>
                  <Text style={styles.deleteConfirmLabel}>{t('profile', 'deleteAccountTyping')}</Text>
                  <TextInput
                    style={styles.deleteConfirmField}
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    placeholder={t('profile', 'deleteConfirmWord')}
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="characters"
                    editable={!sendingOtp}
                  />
                </View>

                <Pressable
                  style={[
                    styles.deleteOtpSendButton,
                    deleteConfirmText.trim().toUpperCase() !== t('profile', 'deleteConfirmWord') && styles.deleteConfirmButtonDisabled,
                  ]}
                  onPress={handleSendDeleteOtp}
                  disabled={deleteConfirmText.trim().toUpperCase() !== t('profile', 'deleteConfirmWord') || sendingOtp}
                >
                  {sendingOtp ? (
                    <View style={styles.deleteConfirmButtonInner}>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.deleteConfirmButtonText}>{t('profile', 'deleteAccountSendingOtp')}</Text>
                    </View>
                  ) : (
                    <View style={styles.deleteConfirmButtonInner}>
                      <MaterialIcons name="email" size={20} color="#FFF" />
                      <Text style={styles.deleteConfirmButtonText}>{t('profile', 'deleteAccountSendOtp')}</Text>
                    </View>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.deleteWarningIcon, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="mark-email-read" size={48} color={theme.primary} />
                </View>
                <Text style={styles.deleteWarningTitle}>{t('profile', 'deleteAccountOtpTitle')}</Text>
                <Text style={styles.deleteWarningText}>
                  {t('profile', 'deleteAccountOtpDesc')}{' '}
                  <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{user?.email}</Text>
                </Text>

                <View style={styles.deleteConfirmInput}>
                  <TextInput
                    style={[styles.deleteConfirmField, { borderColor: theme.primary + '30' }]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder={t('profile', 'deleteAccountOtpPlaceholder')}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!deletingAccount}
                    autoFocus
                  />
                </View>

                <Pressable
                  style={styles.otpResendBtn}
                  onPress={handleSendDeleteOtp}
                  disabled={sendingOtp}
                >
                  <MaterialIcons name="refresh" size={16} color={theme.primary} />
                  <Text style={styles.otpResendBtnText}>
                    {sendingOtp ? t('profile', 'deleteAccountSendingOtp') : t('profile', 'deleteAccountResendOtp')}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.deleteConfirmButton,
                    otpCode.trim().length < 4 && styles.deleteConfirmButtonDisabled,
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={otpCode.trim().length < 4 || deletingAccount}
                >
                  {deletingAccount ? (
                    <View style={styles.deleteConfirmButtonInner}>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.deleteConfirmButtonText}>{t('profile', 'deletingAccount')}</Text>
                    </View>
                  ) : (
                    <View style={styles.deleteConfirmButtonInner}>
                      <MaterialIcons name="delete-forever" size={20} color="#FFF" />
                      <Text style={styles.deleteConfirmButtonText}>{t('profile', 'deleteAccountVerifyAndDelete')}</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  style={styles.otpBackBtn}
                  onPress={() => { setDeleteStep('confirm'); setOtpCode(''); }}
                  disabled={deletingAccount}
                >
                  <MaterialIcons name="arrow-back" size={18} color={theme.textSecondary} />
                  <Text style={styles.otpBackBtnText}>{t('common', 'back')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Club Picker Modal */}
      <Modal
        visible={showClubPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowClubPicker(false);
          setShowCreateClub(false);
          setClubSearch('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowClubPicker(false);
                setShowCreateClub(false);
                setClubSearch('');
              }}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {showCreateClub ? t('profile', 'newClub') : t('profile', 'chooseClub')}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {!showCreateClub ? (
            <>
              {/* Search */}
              <View style={styles.clubSearchContainer}>
                <MaterialIcons name="search" size={20} color={theme.textMuted} />
                <TextInput
                  style={styles.clubSearchInput}
                  value={clubSearch}
                  onChangeText={setClubSearch}
                  placeholder={t('profile', 'searchClub')}
                  placeholderTextColor={theme.textMuted}
                />
                {clubSearch.length > 0 && (
                  <Pressable onPress={() => setClubSearch('')}>
                    <MaterialIcons name="close" size={20} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Create club button */}
              <Pressable
                style={styles.createClubModalBtn}
                onPress={() => setShowCreateClub(true)}
              >
                <MaterialIcons name="add-business" size={22} color={theme.primary} />
                <Text style={styles.createClubModalBtnText}>{t('profile', 'createNewClub')}</Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>

              {/* Clubs list */}
              <ScrollView
                style={styles.clubsList}
                contentContainerStyle={styles.clubsListContent}
                showsVerticalScrollIndicator={false}
              >
                {filteredClubs.length > 0 ? (
                  filteredClubs.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.clubPickerItem,
                        clubId === c.id && styles.clubPickerItemActive,
                      ]}
                      onPress={() => handleSelectClub(c)}
                    >
                      <View style={[
                        styles.clubPickerIcon,
                        clubId === c.id && styles.clubPickerIconActive,
                      ]}>
                        <MaterialIcons
                          name="location-city"
                          size={24}
                          color={clubId === c.id ? '#FFF' : theme.textSecondary}
                        />
                      </View>
                      <View style={styles.clubPickerInfo}>
                        <Text style={styles.clubPickerName}>{c.name}</Text>
                        <Text style={styles.clubPickerCity}>{c.city}</Text>
                      </View>
                      {clubId === c.id && (
                        <MaterialIcons name="check-circle" size={24} color={theme.accent} />
                      )}
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.emptyClubsContainer}>
                    <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                    <Text style={styles.emptyClubsText}>
                      {clubSearch ? t('profile', 'noClubFound') : t('profile', 'noClubRegistered')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.createClubFormModal}>
              <View style={styles.createClubFormField}>
                <Text style={styles.createClubLabel}>{t('profile', 'clubName')} *</Text>
                <TextInput
                  style={styles.createClubInput}
                  value={newClubName}
                  onChangeText={setNewClubName}
                  placeholder="Ex: Pétanque Club de Lyon"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
              </View>

              <View style={styles.createClubFormField}>
                <Text style={styles.createClubLabel}>{t('profile', 'clubCity')} *</Text>
                <TextInput
                  style={styles.createClubInput}
                  value={newClubCity}
                  onChangeText={setNewClubCity}
                  placeholder="Ex: Lyon"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.createClubActions}>
                <Pressable
                  style={styles.createClubCancelBtn}
                  onPress={() => {
                    setShowCreateClub(false);
                    setNewClubName('');
                    setNewClubCity('');
                  }}
                >
                  <Text style={styles.createClubCancelBtnText}>{t('common', 'cancel')}</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.createClubConfirmBtn,
                    (!newClubName.trim() || !newClubCity.trim()) && styles.createClubConfirmBtnDisabled,
                  ]}
                  onPress={handleCreateClub}
                  disabled={!newClubName.trim() || !newClubCity.trim()}
                >
                  <Text style={styles.createClubConfirmBtnText}>{t('profile', 'createClub')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary + '15',
    borderRadius: 20,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  // Hero Section
  heroSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoading: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFF',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.surface,
  },
  heroInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  heroClub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroClubText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  quickStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.border,
    marginHorizontal: 16,
  },
  // Edit Section
  editSection: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 4,
  },
  fieldCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  fieldInput: {
    fontSize: 16,
    color: theme.textPrimary,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 8,
  },
  optionTextActive: {
    color: theme.primary,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelCardActive: {
    borderColor: theme.carreauColor,
    backgroundColor: theme.carreauColor + '10',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  levelTextActive: {
    color: theme.carreauColor,
  },
  // Club selection
  selectedClubContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 12,
  },
  selectedClubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectedClubIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedClubName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  selectedClubActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeClubBtn: {
    padding: 8,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.sm,
  },
  removeClubBtn: {
    padding: 8,
    backgroundColor: theme.error + '15',
    borderRadius: theme.borderRadius.sm,
  },
  selectClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary + '10',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.primary + '30',
    borderStyle: 'dashed',
  },
  selectClubButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  // Player card link
  playerCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  playerCardLinkIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  playerCardLinkInfo: {
    flex: 1,
  },
  playerCardLinkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  playerCardLinkSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  menuItemSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Logout
  logoutSection: {
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.error + '10',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.error + '30',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.error,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  deleteAccountButtonText: {
    fontSize: 14,
    color: theme.textMuted,
    textDecorationLine: 'underline',
  },
  // Delete modal
  deleteModalContent: {
    padding: 24,
    alignItems: 'center',
  },
  deleteWarningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deleteWarningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteWarningText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteConfirmInput: {
    width: '100%',
    marginBottom: 24,
  },
  deleteConfirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  deleteConfirmField: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.error,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
    letterSpacing: 2,
    borderWidth: 2,
    borderColor: theme.error + '30',
  },
  deleteOtpSendButton: {
    width: '100%',
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  deleteConfirmButton: {
    width: '100%',
    backgroundColor: theme.error,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  deleteConfirmButtonDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
  deleteConfirmButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  otpResendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  otpResendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  otpBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 12,
  },
  otpBackBtnText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  versionText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  // Financial button
  financialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  financialButtonIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  financialButtonInfo: {
    flex: 1,
  },
  financialButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  financialButtonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  financialButtonBalance: {
    fontSize: 15,
    fontWeight: '700',
  },
  financialButtonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.textMuted,
    marginHorizontal: 8,
  },
  financialButtonPodiums: {
    fontSize: 13,
    color: theme.carreauColor,
    fontWeight: '600',
    marginLeft: 3,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  clubSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    gap: 10,
  },
  clubSearchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    padding: 0,
  },
  createClubModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '10',
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    gap: 12,
    marginBottom: 8,
  },
  createClubModalBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  clubsList: {
    flex: 1,
  },
  clubsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  clubPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  clubPickerItemActive: {
    borderWidth: 2,
    borderColor: theme.accent,
  },
  clubPickerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubPickerIconActive: {
    backgroundColor: theme.accent,
  },
  clubPickerInfo: {
    flex: 1,
  },
  clubPickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  clubPickerCity: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  emptyClubsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyClubsText: {
    fontSize: 15,
    color: theme.textMuted,
    marginTop: 12,
  },
  createClubFormModal: {
    padding: 16,
  },
  createClubFormField: {
    marginBottom: 20,
  },
  createClubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  createClubInput: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.textPrimary,
    ...theme.shadows.card,
  },
  createClubActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  createClubCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  createClubCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  createClubConfirmBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  createClubConfirmBtnDisabled: {
    backgroundColor: theme.textMuted,
  },
  createClubConfirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Contact fields in edit mode
  contactFieldContainer: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  contactFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 10,
  },
  contactFieldInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    paddingVertical: 14,
  },
  contactFieldDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 44,
  },
  // Sub-menu styles
  subMenuContainer: {
    marginLeft: 24,
    marginBottom: 10,
    borderLeftWidth: 2,
    borderLeftColor: theme.border,
    paddingLeft: 12,
    gap: 6,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    ...theme.shadows.card,
  },
  subMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subMenuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  // Share notification badge
  shareNotifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: theme.surface,
  },
  shareNotifBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#6366F1' + '15',
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
});
