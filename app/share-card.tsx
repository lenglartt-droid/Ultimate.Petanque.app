/**
 * Share Card Preview Page
 * Full-screen preview with format selection, color themes, download option.
 * Captures the card as PNG and shares via native sheet or saves to gallery.
 * Records card creation in history for the gallery.
 */
import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { getEloRank } from '@/services/eloService';
import { fetchPlayerGeoRank } from '@/services/geoLeaderboardService';
import { computeStreakFromDates } from '@/services/streakService';
import {
  captureAndShare,
  downloadCardToGallery,
  CARD_DIMENSIONS,
  CARD_COLOR_THEMES,
  type ShareCardFormat,
  type CardColorTheme,
} from '@/services/shareCardService';
import { addCardHistoryEntry } from '@/services/cardHistoryService';
import {
  ShareCardMatch,
  ShareCardBadge,
  ShareCardStats,
  ShareCardChallenge,
  ShareCardTournament,
} from '@/components/feature/share-cards';
import { useBadges } from '@/hooks/useBadges';
import { getBadgeName } from '@/services/badgeService';

type CardType = 'match' | 'badge' | 'stats' | 'challenge' | 'tournament';

// Platform presets (quick format selection)
const PLATFORM_PRESETS: { id: string; format: ShareCardFormat; label: string; icon: string; color: string }[] = [
  { id: 'instagram', format: 'square', label: 'Instagram', icon: 'crop-square', color: '#E4405F' },
  { id: 'tiktok', format: 'story', label: 'TikTok / Stories', icon: 'crop-portrait', color: '#000000' },
  { id: 'facebook', format: 'landscape', label: 'Facebook', icon: 'crop-landscape', color: '#1877F2' },
];

const TYPE_INFO: Record<CardType, { fr: string; en: string; icon: string; iconColor: string }> = {
  match: { fr: 'Resultat de match', en: 'Match Result', icon: 'sports', iconColor: '#F59E0B' },
  badge: { fr: 'Badge debloque', en: 'Badge Unlocked', icon: 'military-tech', iconColor: '#8B5CF6' },
  stats: { fr: 'Mes statistiques', en: 'My Statistics', icon: 'bar-chart', iconColor: '#3B82F6' },
  challenge: { fr: 'Resultat de defi', en: 'Challenge Result', icon: 'track-changes', iconColor: '#EF4444' },
  tournament: { fr: 'Resultat de tournoi', en: 'Tournament Result', icon: 'emoji-events', iconColor: '#F59E0B' },
};

export default function ShareCardScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string; badgeId?: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { matches, challenges, tournaments, selfPlayer, userStats } = useApp();
  const { badges: userBadges } = useBadges();
  const fr = language === 'fr';

  const [activeFormat, setActiveFormat] = useState<ShareCardFormat>('square');
  const [activeTheme, setActiveTheme] = useState<CardColorTheme>('dark');
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const cardRef = useRef<any>(null);

  const cardType = (params.type as CardType) || 'stats';
  const itemId = params.id;
  const badgeId = params.badgeId;

  // Resolve data
  const match = useMemo(() => {
    if (cardType !== 'match' || !itemId) return null;
    return matches.find(m => m.id === itemId) || null;
  }, [cardType, itemId, matches]);

  const challenge = useMemo(() => {
    if (cardType !== 'challenge' || !itemId) return null;
    return challenges.find(c => c.id === itemId) || null;
  }, [cardType, itemId, challenges]);

  const tournament = useMemo(() => {
    if (cardType !== 'tournament' || !itemId) return null;
    return tournaments.find(t => t.id === itemId) || null;
  }, [cardType, itemId, tournaments]);

  const eloData = useMemo(() => {
    if (!selfPlayer?.eloRating) return null;
    const rank = getEloRank(selfPlayer.eloRating);
    return { rating: selfPlayer.eloRating, color: rank.color, label: rank.label[fr ? 'fr' : 'en'] };
  }, [selfPlayer?.eloRating, fr]);

  const streakData = useMemo(() => {
    const allDates = [...matches.map(m => m.date), ...challenges.map(c => c.date)];
    return computeStreakFromDates(allDates);
  }, [matches, challenges]);

  const [geoRank, setGeoRank] = useState<any>(null);
  React.useEffect(() => {
    if (selfPlayer?.isPublic && selfPlayer?.id) {
      fetchPlayerGeoRank(selfPlayer.id).then(({ geoRank: gr }) => setGeoRank(gr)).catch(() => {});
    }
  }, [selfPlayer?.id, selfPlayer?.isPublic]);

  const playerName = selfPlayer?.name || user?.username || '';

  // Build card title for history
  const getCardTitle = useCallback((): string => {
    switch (cardType) {
      case 'match':
        if (match) return `${match.teamA.score}-${match.teamB.score} (${match.winner === 'A' ? 'V' : 'D'})`;
        return 'Match';
      case 'badge':
        if (badgeId) return getBadgeName(badgeId, language);
        return 'Badge';
      case 'challenge':
        if (challenge) return `${challenge.type} - ${challenge.successRate ? Math.round(challenge.successRate) : 0}%`;
        return 'Defi';
      case 'tournament':
        if (tournament) return tournament.name;
        return 'Tournoi';
      case 'stats':
      default:
        return playerName || 'Stats';
    }
  }, [cardType, match, badgeId, challenge, tournament, playerName, language]);

  const recordHistory = useCallback(async (action: 'shared' | 'downloaded') => {
    const info = TYPE_INFO[cardType];
    await addCardHistoryEntry({
      type: cardType,
      theme: activeTheme,
      format: activeFormat,
      title: getCardTitle(),
      subtitle: fr ? info.fr : info.en,
      iconName: info.icon,
      iconColor: info.iconColor,
      action,
    });
  }, [cardType, activeTheme, activeFormat, getCardTitle, fr]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const title = `ultimate-petanque-${cardType}-${Date.now()}`;
      const success = await captureAndShare(cardRef.current, title);
      if (success) await recordHistory('shared');
    } catch (e) {
      console.log('[ShareCard] Error:', e);
    } finally {
      setSharing(false);
    }
  }, [cardType, recordHistory]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const title = `ultimate-petanque-${cardType}-${Date.now()}`;
      const success = await downloadCardToGallery(cardRef.current, title);
      if (success) {
        await recordHistory('downloaded');
        setDownloadSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setDownloadSuccess(false), 2500);
      }
    } catch (e) {
      console.log('[ShareCard] Download error:', e);
    } finally {
      setDownloading(false);
    }
  }, [cardType, recordHistory]);

  const formatConfig = CARD_DIMENSIONS[activeFormat];

  // Scale card to fit screen
  const screenW = Dimensions.get('window').width - 48;
  const aspectRatio = formatConfig.width / formatConfig.height;
  const cardWidth = Math.min(screenW, 400);
  const cardHeight = cardWidth / aspectRatio;

  const renderCard = () => {
    switch (cardType) {
      case 'match':
        if (!match) return <EmptyCard message={fr ? 'Match introuvable' : 'Match not found'} />;
        return (
          <ShareCardMatch
            match={match}
            playerName={playerName}
            eloRating={eloData?.rating}
            eloColor={eloData?.color}
            eloRankLabel={eloData?.label}
            terrainName={selfPlayer?.terrainName || ''}
            language={language}
            colorTheme={activeTheme}
          />
        );
      case 'badge':
        if (!badgeId) return <EmptyCard message={fr ? 'Badge introuvable' : 'Badge not found'} />;
        const ub = userBadges.find(b => b.badgeId === badgeId);
        return (
          <ShareCardBadge
            badgeId={badgeId}
            playerName={playerName}
            unlockedAt={ub?.unlockedAt}
            language={language}
            colorTheme={activeTheme}
          />
        );
      case 'challenge':
        if (!challenge) return <EmptyCard message={fr ? 'Defi introuvable' : 'Challenge not found'} />;
        return (
          <ShareCardChallenge
            challenge={challenge}
            playerName={playerName}
            language={language}
            colorTheme={activeTheme}
          />
        );
      case 'tournament':
        if (!tournament) return <EmptyCard message={fr ? 'Tournoi introuvable' : 'Tournament not found'} />;
        return (
          <ShareCardTournament
            tournament={tournament}
            playerName={playerName}
            eloRating={eloData?.rating}
            eloColor={eloData?.color}
            eloRankLabel={eloData?.label}
            language={language}
            colorTheme={activeTheme}
          />
        );
      case 'stats':
      default:
        return (
          <ShareCardStats
            playerName={playerName}
            eloRating={eloData?.rating}
            eloColor={eloData?.color}
            eloRankLabel={eloData?.label}
            matchesPlayed={userStats.totalMatches || matches.length}
            winRate={userStats.winRate || 0}
            tirRate={userStats.tirSuccessRate || 0}
            pointRate={userStats.pointSuccessRate || 0}
            carreauRate={userStats.carreauRate || 0}
            currentStreak={streakData.currentStreak}
            bestStreak={streakData.bestStreak}
            geoCity={geoRank?.city?.name}
            geoCountry={geoRank?.country?.name}
            geoCityRank={geoRank?.city?.rank}
            geoCountryRank={geoRank?.country?.rank}
            language={language}
            colorTheme={activeTheme}
          />
        );
    }
  };

  const typeInfo = TYPE_INFO[cardType] || TYPE_INFO.stats;

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Pressable style={st.headerBtn} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={st.headerCenter}>
          <MaterialIcons name={typeInfo.icon as any} size={16} color={theme.primary} />
          <Text style={st.headerTitle}>{fr ? 'Apercu de la carte' : 'Card Preview'}</Text>
        </View>
        <Pressable style={st.headerBtn} onPress={() => { Haptics.selectionAsync(); router.push('/card-gallery' as any); }} hitSlop={12}>
          <MaterialIcons name="photo-library" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Type label */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={st.typeLabel}>{fr ? typeInfo.fr : typeInfo.en}</Text>
        </Animated.View>

        {/* Platform presets (quick select) */}
        <Animated.View entering={FadeInDown.duration(300).delay(30)} style={st.platformRow}>
          {PLATFORM_PRESETS.map(preset => {
            const isActive = activeFormat === preset.format;
            return (
              <Pressable
                key={preset.id}
                style={[st.platformChip, isActive && { backgroundColor: preset.color + '18', borderColor: preset.color + '40' }]}
                onPress={() => { Haptics.selectionAsync(); setActiveFormat(preset.format); }}
              >
                <MaterialIcons name={preset.icon as any} size={14} color={isActive ? preset.color : theme.textMuted} />
                <Text style={[st.platformText, isActive && { color: preset.color, fontWeight: '700' }]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Format selector (technical) */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={st.formatRow}>
          {(Object.keys(CARD_DIMENSIONS) as ShareCardFormat[]).map(fmt => {
            const dim = CARD_DIMENSIONS[fmt];
            const isActive = activeFormat === fmt;
            return (
              <Pressable
                key={fmt}
                style={[st.formatChip, isActive && st.formatChipActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveFormat(fmt); }}
              >
                <MaterialIcons name={dim.icon as any} size={16} color={isActive ? '#FFF' : theme.textSecondary} />
                <Text style={[st.formatChipText, isActive && st.formatChipTextActive]}>
                  {fr ? dim.labelFr : dim.label}
                </Text>
                <Text style={[st.formatChipSize, isActive && { color: 'rgba(255,255,255,0.6)' }]}>
                  {dim.width}x{dim.height}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Color theme selector */}
        <Animated.View entering={FadeInDown.duration(300).delay(70)} style={st.themeRow}>
          <Text style={st.themeSectionLabel}>{fr ? 'THEME' : 'THEME'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.themeScroll}>
            {(Object.keys(CARD_COLOR_THEMES) as CardColorTheme[]).map(themeKey => {
              const t = CARD_COLOR_THEMES[themeKey];
              const isActive = activeTheme === themeKey;
              return (
                <Pressable
                  key={themeKey}
                  style={[st.themeChip, isActive && { borderColor: t.accent, borderWidth: 2.5 }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveTheme(themeKey); }}
                >
                  <View style={[st.themePreview, { backgroundColor: t.gradients[0] }]}>
                    <View style={[st.themePreviewAccent, { backgroundColor: t.accent }]} />
                  </View>
                  <Text style={[st.themeChipText, isActive && { color: t.accent, fontWeight: '700' }]}>
                    {fr ? t.labelFr : t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Card preview */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={st.cardPreviewContainer}>
          <View
            ref={cardRef}
            collapsable={false}
            style={[st.cardWrapper, { width: cardWidth, height: Math.max(200, cardHeight) }]}
          >
            {renderCard()}
          </View>
        </Animated.View>

        {/* Download success feedback */}
        {downloadSuccess ? (
          <Animated.View entering={FadeInDown.duration(200)} style={st.downloadSuccessBanner}>
            <MaterialIcons name="check-circle" size={18} color="#22C55E" />
            <Text style={st.downloadSuccessText}>{fr ? 'Image enregistree dans la galerie' : 'Image saved to gallery'}</Text>
          </Animated.View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={st.bottomBar}>
        <View style={st.bottomActions}>
          {/* Download button */}
          <Pressable
            style={[st.downloadBtn, downloading && st.btnDisabled]}
            onPress={handleDownload}
            disabled={downloading || sharing}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <MaterialIcons name="save-alt" size={20} color={theme.primary} />
                <Text style={st.downloadBtnText}>{fr ? 'Telecharger' : 'Download'}</Text>
              </>
            )}
          </Pressable>

          {/* Share button */}
          <Pressable
            style={[st.shareBtn, sharing && st.btnDisabled]}
            onPress={handleShare}
            disabled={sharing || downloading}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="share" size={20} color="#FFF" />
                <Text style={st.shareBtnText}>{fr ? 'Partager' : 'Share'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 20 }}>
      <MaterialIcons name="error-outline" size={40} color="#64748B" />
      <Text style={{ fontSize: 14, color: '#64748B', marginTop: 10 }}>{message}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, marginBottom: 12, textAlign: 'center' },

  // Platform presets
  platformRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  platformChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  platformText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },

  // Format selector
  formatRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  formatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  formatChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  formatChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  formatChipTextActive: { color: '#FFF' },
  formatChipSize: { fontSize: 9, fontWeight: '500', color: theme.textMuted },

  // Color theme selector
  themeRow: { marginBottom: 16 },
  themeSectionLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  themeScroll: { gap: 8, paddingHorizontal: 4 },
  themeChip: { alignItems: 'center', gap: 5, width: 62, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surface },
  themePreview: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  themePreviewAccent: { width: '100%', height: 6, borderRadius: 3 },
  themeChipText: { fontSize: 9, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },

  // Card preview
  cardPreviewContainer: { alignItems: 'center', marginBottom: 16 },
  cardWrapper: { borderRadius: 20, overflow: 'hidden', ...theme.shadows.cardElevated },

  // Download success
  downloadSuccessBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22C55E15', paddingVertical: 10, borderRadius: 12, marginBottom: 8 },
  downloadSuccessText: { fontSize: 13, fontWeight: '600', color: '#22C55E' },

  // Bottom bar
  bottomBar: { paddingHorizontal: 24, paddingVertical: 14, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  bottomActions: { flexDirection: 'row', gap: 10 },
  downloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 16, backgroundColor: theme.primary + '12', borderWidth: 1.5, borderColor: theme.primary + '30' },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: theme.primary },
  shareBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 15, borderRadius: 16 },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.6 },
});
