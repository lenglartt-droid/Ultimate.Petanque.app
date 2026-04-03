/**
 * Admin Announcements Page
 *
 * Allows admins to send targeted push notifications with:
 * - FR/EN title + message inputs
 * - Target selector: All / City / Club / Level
 * - Real-time message preview
 * - Push send with confirmation
 * - Announcement history log
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import {
  sendAnnouncement,
  getAnnouncementHistory,
  getTargetCities,
  getTargetClubs,
  Announcement,
} from '@/services/announcementService';

type TargetType = 'all' | 'city' | 'club' | 'level';

const TARGET_OPTIONS: { key: TargetType; icon: string; color: string; labelFr: string; labelEn: string }[] = [
  { key: 'all', icon: 'public', color: '#10B981', labelFr: 'Tous', labelEn: 'All users' },
  { key: 'city', icon: 'location-city', color: '#2563EB', labelFr: 'Par ville', labelEn: 'By city' },
  { key: 'club', icon: 'home', color: '#7C3AED', labelFr: 'Par club', labelEn: 'By club' },
  { key: 'level', icon: 'signal-cellular-alt', color: '#D97706', labelFr: 'Par niveau', labelEn: 'By level' },
];

const LEVEL_OPTIONS = [
  { id: 'Débutant', labelFr: 'Debutant', labelEn: 'Beginner', icon: 'school' },
  { id: 'Intermédiaire', labelFr: 'Intermediaire', labelEn: 'Intermediate', icon: 'trending-up' },
  { id: 'Confirmé', labelFr: 'Confirme', labelEn: 'Advanced', icon: 'stars' },
  { id: 'Expert', labelFr: 'Expert', labelEn: 'Expert', icon: 'emoji-events' },
];

export default function AdminAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  // Form state
  const [titleFr, setTitleFr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [messageFr, setMessageFr] = useState('');
  const [messageEn, setMessageEn] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [history, setHistory] = useState<Announcement[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; city: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Search for city/club picker
  const [valueSearch, setValueSearch] = useState('');
  const [showValuePicker, setShowValuePicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [historyResult, citiesResult, clubsResult] = await Promise.all([
        getAnnouncementHistory(30),
        getTargetCities(),
        getTargetClubs(),
      ]);
      setHistory(historyResult.announcements);
      setCities(citiesResult);
      setClubs(clubsResult);
    } catch (e) {
      console.log('Error loading announcement data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Filtered picker items
  const filteredPickerItems = useMemo(() => {
    const search = valueSearch.toLowerCase().trim();
    if (targetType === 'city') {
      return cities.filter(c => !search || c.toLowerCase().includes(search));
    }
    if (targetType === 'club') {
      return clubs.filter(c => !search || c.name.toLowerCase().includes(search) || c.city.toLowerCase().includes(search));
    }
    return [];
  }, [targetType, cities, clubs, valueSearch]);

  const hasMessage = (titleFr.trim() || titleEn.trim()) && (messageFr.trim() || messageEn.trim());
  const hasTarget = targetType === 'all' || targetValue.trim().length > 0;
  const canSend = hasMessage && hasTarget && !submitting;

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    const targetLabel = targetType === 'all'
      ? (fr ? 'tous les utilisateurs' : 'all users')
      : `${targetType}: ${targetValue}`;

    Alert.alert(
      fr ? 'Envoyer l\'annonce ?' : 'Send announcement?',
      fr
        ? `Push envoye a ${targetLabel}. Cette action est irreversible.`
        : `Push sent to ${targetLabel}. This action is irreversible.`,
      [
        { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: fr ? 'Envoyer' : 'Send',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            const result = await sendAnnouncement({
              titleFr: titleFr.trim() || titleEn.trim(),
              titleEn: titleEn.trim() || titleFr.trim(),
              messageFr: messageFr.trim() || messageEn.trim(),
              messageEn: messageEn.trim() || messageFr.trim(),
              targetType,
              targetValue: targetType === 'all' ? undefined : targetValue.trim(),
              adminName: user?.username || user?.email || 'Admin',
            });

            if (result.error) {
              showAlert(fr ? 'Erreur' : 'Error', result.error);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showAlert(
                fr ? 'Annonce envoyee' : 'Announcement sent',
                fr
                  ? `${result.pushSent || 0} envoyes, ${result.pushErrors || 0} erreur(s)`
                  : `${result.pushSent || 0} sent, ${result.pushErrors || 0} error(s)`
              );
              // Reset form
              setTitleFr('');
              setTitleEn('');
              setMessageFr('');
              setMessageEn('');
              setTargetType('all');
              setTargetValue('');
              await loadData();
            }
            setSubmitting(false);
          },
        },
      ]
    );
  }, [canSend, titleFr, titleEn, messageFr, messageEn, targetType, targetValue, fr, user, showAlert, loadData]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(fr ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const getTargetIcon = (type: string) => TARGET_OPTIONS.find(t => t.key === type)?.icon || 'public';
  const getTargetColor = (type: string) => TARGET_OPTIONS.find(t => t.key === type)?.color || '#10B981';

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Annonces' : 'Announcements'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Annonces' : 'Announcements'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Stats summary */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{history.length}</Text>
              <Text style={s.statLabel}>{fr ? 'Total' : 'Total'}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: '#10B981' }]}>
                {history.reduce((sum, a) => sum + a.pushSentCount, 0)}
              </Text>
              <Text style={s.statLabel}>{fr ? 'Envoyes' : 'Sent'}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: '#EF4444' }]}>
                {history.reduce((sum, a) => sum + a.pushErrorCount, 0)}
              </Text>
              <Text style={s.statLabel}>{fr ? 'Erreurs' : 'Errors'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)}>
          <View style={s.formCard}>
            <View style={s.formHeader}>
              <View style={[s.formHeaderIcon, { backgroundColor: '#7C3AED12' }]}>
                <MaterialIcons name="campaign" size={20} color="#7C3AED" />
              </View>
              <Text style={s.formHeaderTitle}>{fr ? 'Nouvelle annonce' : 'New announcement'}</Text>
            </View>

            {/* Target selector */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabel}>
                <MaterialIcons name="people" size={16} color="#64748B" />
                <Text style={s.fieldLabelText}>{fr ? 'Destinataires' : 'Recipients'}</Text>
              </View>
              <View style={s.targetGrid}>
                {TARGET_OPTIONS.map(opt => {
                  const isActive = targetType === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      style={[s.targetChip, isActive && { backgroundColor: opt.color, borderColor: opt.color }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTargetType(opt.key);
                        setTargetValue('');
                        setShowValuePicker(opt.key !== 'all');
                      }}
                    >
                      <MaterialIcons name={opt.icon as any} size={14} color={isActive ? '#FFF' : '#64748B'} />
                      <Text style={[s.targetChipText, isActive && { color: '#FFF' }]}>
                        {fr ? opt.labelFr : opt.labelEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Target value selector */}
              {targetType === 'level' ? (
                <View style={s.levelGrid}>
                  {LEVEL_OPTIONS.map(lvl => {
                    const isActive = targetValue === lvl.id;
                    return (
                      <Pressable
                        key={lvl.id}
                        style={[s.levelChip, isActive && { backgroundColor: '#D97706', borderColor: '#D97706' }]}
                        onPress={() => { Haptics.selectionAsync(); setTargetValue(lvl.id); }}
                      >
                        <MaterialIcons name={lvl.icon as any} size={14} color={isActive ? '#FFF' : '#64748B'} />
                        <Text style={[s.levelChipText, isActive && { color: '#FFF' }]}>
                          {fr ? lvl.labelFr : lvl.labelEn}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {(targetType === 'city' || targetType === 'club') ? (
                <View style={s.valuePickerWrap}>
                  <View style={s.valueSearchRow}>
                    <MaterialIcons name="search" size={18} color="#94A3B8" />
                    <TextInput
                      style={s.valueSearchInput}
                      value={targetValue || valueSearch}
                      onChangeText={(text) => {
                        setValueSearch(text);
                        setTargetValue(text);
                        setShowValuePicker(true);
                      }}
                      placeholder={targetType === 'city' ? (fr ? 'Rechercher une ville...' : 'Search city...') : (fr ? 'Rechercher un club...' : 'Search club...')}
                      placeholderTextColor="#94A3B8"
                    />
                    {targetValue ? (
                      <Pressable onPress={() => { setTargetValue(''); setValueSearch(''); setShowValuePicker(true); }}>
                        <MaterialIcons name="close" size={18} color="#94A3B8" />
                      </Pressable>
                    ) : null}
                  </View>
                  {showValuePicker && filteredPickerItems.length > 0 ? (
                    <View style={s.valueList}>
                      {(targetType === 'city' ? filteredPickerItems as string[] : []).slice(0, 8).map((city: string) => (
                        <Pressable
                          key={city}
                          style={[s.valueItem, targetValue === city && s.valueItemActive]}
                          onPress={() => { Haptics.selectionAsync(); setTargetValue(city); setShowValuePicker(false); }}
                        >
                          <MaterialIcons name="location-city" size={14} color={targetValue === city ? '#2563EB' : '#94A3B8'} />
                          <Text style={[s.valueItemText, targetValue === city && { color: '#2563EB', fontWeight: '700' }]}>{city}</Text>
                        </Pressable>
                      ))}
                      {targetType === 'club' ? (filteredPickerItems as { id: string; name: string; city: string }[]).slice(0, 8).map((cl) => (
                        <Pressable
                          key={cl.id}
                          style={[s.valueItem, targetValue === cl.name && s.valueItemActive]}
                          onPress={() => { Haptics.selectionAsync(); setTargetValue(cl.name); setShowValuePicker(false); }}
                        >
                          <MaterialIcons name="home" size={14} color={targetValue === cl.name ? '#7C3AED' : '#94A3B8'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.valueItemText, targetValue === cl.name && { color: '#7C3AED', fontWeight: '700' }]}>{cl.name}</Text>
                            <Text style={s.valueItemSub}>{cl.city}</Text>
                          </View>
                        </Pressable>
                      )) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Selected target badge */}
              {targetType !== 'all' && targetValue ? (
                <View style={[s.selectedBadge, { backgroundColor: getTargetColor(targetType) + '12', borderColor: getTargetColor(targetType) + '30' }]}>
                  <MaterialIcons name={getTargetIcon(targetType) as any} size={14} color={getTargetColor(targetType)} />
                  <Text style={[s.selectedBadgeText, { color: getTargetColor(targetType) }]}>{targetValue}</Text>
                  <Pressable onPress={() => { setTargetValue(''); setShowValuePicker(true); }} hitSlop={8}>
                    <MaterialIcons name="close" size={14} color={getTargetColor(targetType)} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Title FR */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabel}>
                <Text style={s.fieldLabelFlag}>{"\u{1F1EB}\u{1F1F7}"}</Text>
                <Text style={s.fieldLabelText}>{fr ? 'Titre (FR)' : 'Title (FR)'}</Text>
              </View>
              <TextInput
                style={[s.textInput, { minHeight: 44 }]}
                placeholder={fr ? 'Titre de l\'annonce...' : 'Announcement title...'}
                placeholderTextColor="#94A3B8"
                value={titleFr}
                onChangeText={setTitleFr}
                maxLength={80}
              />
              <Text style={s.charCount}>{titleFr.length}/80</Text>
            </View>

            {/* Title EN */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabel}>
                <Text style={s.fieldLabelFlag}>{"\u{1F1EC}\u{1F1E7}"}</Text>
                <Text style={s.fieldLabelText}>{fr ? 'Titre (EN)' : 'Title (EN)'}</Text>
              </View>
              <TextInput
                style={[s.textInput, { minHeight: 44 }]}
                placeholder="Announcement title..."
                placeholderTextColor="#94A3B8"
                value={titleEn}
                onChangeText={setTitleEn}
                maxLength={80}
              />
              <Text style={s.charCount}>{titleEn.length}/80</Text>
            </View>

            {/* Message FR */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabel}>
                <Text style={s.fieldLabelFlag}>{"\u{1F1EB}\u{1F1F7}"}</Text>
                <Text style={s.fieldLabelText}>{fr ? 'Message (FR)' : 'Message (FR)'}</Text>
              </View>
              <TextInput
                style={s.textInput}
                placeholder={fr ? 'Contenu de l\'annonce...' : 'Announcement content...'}
                placeholderTextColor="#94A3B8"
                value={messageFr}
                onChangeText={setMessageFr}
                multiline
                numberOfLines={3}
                maxLength={300}
              />
              <Text style={s.charCount}>{messageFr.length}/300</Text>
            </View>

            {/* Message EN */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabel}>
                <Text style={s.fieldLabelFlag}>{"\u{1F1EC}\u{1F1E7}"}</Text>
                <Text style={s.fieldLabelText}>{fr ? 'Message (EN)' : 'Message (EN)'}</Text>
              </View>
              <TextInput
                style={s.textInput}
                placeholder="Announcement content..."
                placeholderTextColor="#94A3B8"
                value={messageEn}
                onChangeText={setMessageEn}
                multiline
                numberOfLines={3}
                maxLength={300}
              />
              <Text style={s.charCount}>{messageEn.length}/300</Text>
            </View>
          </View>
        </Animated.View>

        {/* Preview */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <View style={s.previewSection}>
            <View style={s.formHeader}>
              <View style={[s.formHeaderIcon, { backgroundColor: '#0EA5E912' }]}>
                <MaterialIcons name="preview" size={20} color="#0EA5E9" />
              </View>
              <Text style={s.formHeaderTitle}>{fr ? 'Apercu du push' : 'Push preview'}</Text>
            </View>

            <View style={s.previewFrame}>
              <View style={s.previewStatusBar}>
                <Text style={s.previewTime}>9:41</Text>
                <View style={s.previewNotch} />
                <View style={s.previewBattery} />
              </View>

              {hasMessage ? (
                <View style={s.previewNotif}>
                  <View style={s.previewNotifHeader}>
                    <View style={s.previewAppIcon}>
                      <MaterialIcons name="sports-baseball" size={12} color="#FFF" />
                    </View>
                    <Text style={s.previewAppName}>Ultimate Petanque</Text>
                    <Text style={s.previewNotifTime}>{fr ? 'maintenant' : 'now'}</Text>
                  </View>
                  <Text style={s.previewNotifTitle} numberOfLines={1}>
                    {(fr ? titleFr : titleEn) || titleFr || titleEn || (fr ? 'Titre...' : 'Title...')}
                  </Text>
                  <Text style={s.previewNotifBody} numberOfLines={2}>
                    {(fr ? messageFr : messageEn) || messageFr || messageEn || (fr ? 'Message...' : 'Message...')}
                  </Text>
                  {targetType !== 'all' && targetValue ? (
                    <View style={s.previewTargetRow}>
                      <MaterialIcons name={getTargetIcon(targetType) as any} size={10} color="#94A3B8" />
                      <Text style={s.previewTargetText}>{targetValue}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={s.previewEmpty}>
                  <MaterialIcons name="visibility-off" size={20} color="#64748B" />
                  <Text style={s.previewEmptyText}>{fr ? 'Saisissez titre et message' : 'Enter title and message'}</Text>
                </View>
              )}

              <View style={s.previewContent}>
                <View style={s.previewPlaceholder} />
                <View style={[s.previewPlaceholder, { width: '70%' }]} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Send button */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)}>
          <Pressable
            style={({ pressed }) => [s.sendBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, !canSend && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="#FFF" />
                <Text style={s.sendBtnText}>{fr ? 'Envoyer l\'annonce' : 'Send announcement'}</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* History */}
        <Animated.View entering={FadeIn.duration(300).delay(200)}>
          <Pressable
            style={s.historyToggle}
            onPress={() => { setShowHistory(!showHistory); Haptics.selectionAsync(); }}
          >
            <View style={[s.formHeaderIcon, { backgroundColor: '#64748B12' }]}>
              <MaterialIcons name="history" size={20} color="#64748B" />
            </View>
            <Text style={[s.formHeaderTitle, { flex: 1 }]}>
              {fr ? 'Historique' : 'History'} ({history.length})
            </Text>
            <MaterialIcons name={showHistory ? 'expand-less' : 'expand-more'} size={22} color="#94A3B8" />
          </Pressable>
        </Animated.View>

        {showHistory ? (
          <View style={s.historyList}>
            {history.length === 0 ? (
              <View style={s.historyEmpty}>
                <MaterialIcons name="campaign" size={32} color="#CBD5E1" />
                <Text style={s.historyEmptyText}>{fr ? 'Aucune annonce' : 'No announcements yet'}</Text>
              </View>
            ) : (
              history.map((ann, idx) => {
                const tColor = getTargetColor(ann.targetType);
                return (
                  <Animated.View key={ann.id} entering={FadeInDown.duration(200).delay(idx * 30)}>
                    <View style={[s.historyCard, { borderLeftColor: tColor }]}>
                      <View style={s.historyCardHeader}>
                        <View style={[s.historyIconBg, { backgroundColor: tColor + '12' }]}>
                          <MaterialIcons name={getTargetIcon(ann.targetType) as any} size={16} color={tColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.historyTitle} numberOfLines={1}>
                            {(fr ? ann.titleFr : ann.titleEn) || ann.titleFr}
                          </Text>
                          <Text style={s.historyDate}>{formatDate(ann.createdAt)}</Text>
                        </View>
                        <View style={s.historyPushBadge}>
                          <MaterialIcons name="notifications" size={10} color={theme.primary} />
                          <Text style={s.historyPushText}>{ann.pushSentCount}</Text>
                          {ann.pushErrorCount > 0 ? (
                            <Text style={s.historyPushError}>/{ann.pushErrorCount}err</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={s.historyMessage}>
                        <View style={s.historyMsgRow}>
                          <Text style={s.historyMsgFlag}>{"\u{1F1EB}\u{1F1F7}"}</Text>
                          <Text style={s.historyMsgText} numberOfLines={2}>{ann.messageFr}</Text>
                        </View>
                        {ann.messageEn !== ann.messageFr ? (
                          <View style={s.historyMsgRow}>
                            <Text style={s.historyMsgFlag}>{"\u{1F1EC}\u{1F1E7}"}</Text>
                            <Text style={s.historyMsgText} numberOfLines={2}>{ann.messageEn}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={s.historyFooter}>
                        <View style={[s.historyTargetBadge, { backgroundColor: tColor + '12' }]}>
                          <MaterialIcons name={getTargetIcon(ann.targetType) as any} size={11} color={tColor} />
                          <Text style={[s.historyTargetText, { color: tColor }]}>
                            {ann.targetType === 'all' ? (fr ? 'Tous' : 'All') : ann.targetValue || ann.targetType}
                          </Text>
                        </View>
                        <Text style={s.historyAdmin}>{ann.adminName || 'Admin'}</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // Form
  formCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  formHeaderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 },

  // Fields
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  fieldLabelFlag: { fontSize: 16 },
  fieldLabelText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  textInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, fontSize: 14, color: '#0F172A', lineHeight: 20, minHeight: 72, textAlignVertical: 'top', borderWidth: 1.5, borderColor: '#E2E8F0' },
  charCount: { fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 4 },

  // Target
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  targetChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  targetChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  // Level
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  levelChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  // Value picker
  valuePickerWrap: { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', overflow: 'hidden' },
  valueSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  valueSearchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 12 },
  valueList: { borderTopWidth: 1, borderTopColor: '#E2E8F0', maxHeight: 200 },
  valueItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  valueItemActive: { backgroundColor: '#EFF6FF' },
  valueItemText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  valueItemSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Selected badge
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginTop: 8, alignSelf: 'flex-start' },
  selectedBadgeText: { fontSize: 13, fontWeight: '700' },

  // Preview
  previewSection: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  previewFrame: { backgroundColor: '#0F172A', borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: '#1E293B' },
  previewStatusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  previewTime: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  previewNotch: { width: 80, height: 20, borderRadius: 10, backgroundColor: '#000' },
  previewBattery: { width: 22, height: 10, borderRadius: 3, backgroundColor: '#4ADE80', borderWidth: 1, borderColor: '#22C55E' },
  previewNotif: { backgroundColor: '#1E293B', marginHorizontal: 8, marginTop: 8, borderRadius: 16, padding: 12 },
  previewNotifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  previewAppIcon: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  previewAppName: { fontSize: 9, fontWeight: '700', color: '#94A3B8', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewNotifTime: { fontSize: 9, color: '#64748B' },
  previewNotifTitle: { fontSize: 12, fontWeight: '700', color: '#F8FAFC', marginBottom: 3 },
  previewNotifBody: { fontSize: 11, color: '#CBD5E1', lineHeight: 15 },
  previewTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  previewTargetText: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  previewEmpty: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  previewEmptyText: { fontSize: 11, color: '#64748B' },
  previewContent: { padding: 16, gap: 10 },
  previewPlaceholder: { height: 12, borderRadius: 6, backgroundColor: '#1E293B', width: '90%' },

  // Send button
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 16, marginBottom: 20, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // History
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  historyList: { gap: 6, marginBottom: 16 },
  historyEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  historyEmptyText: { fontSize: 13, color: '#94A3B8' },
  historyCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', borderLeftWidth: 3 },
  historyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  historyIconBg: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  historyDate: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  historyPushBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  historyPushText: { fontSize: 11, fontWeight: '700', color: theme.primary },
  historyPushError: { fontSize: 9, color: '#EF4444', fontWeight: '600' },
  historyMessage: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6 },
  historyMsgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  historyMsgFlag: { fontSize: 12 },
  historyMsgText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },
  historyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  historyTargetBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  historyTargetText: { fontSize: 10, fontWeight: '700' },
  historyAdmin: { fontSize: 10, color: '#CBD5E1', fontWeight: '500' },
});
