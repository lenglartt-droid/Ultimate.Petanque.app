/**
 * Share Card Preview Page
 * Full-screen preview with format selection (Square, Story, Landscape).
 * Captures the card as PNG and shares via native sheet.
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
import { captureAndShare, CARD_DIMENSIONS, type ShareCardFormat } from '@/services/shareCardService';
import { ShareCardMatch, ShareCardBadge, ShareCardStats, ShareCardChallenge } from '@/components/feature/share-cards';
import { useBadges } from '@/hooks/useBadges';

type CardType = 'match' | 'badge' | 'stats' | 'challenge';

export default function ShareCardScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string; badgeId?: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { matches, challenges, selfPlayer, userStats } = useApp();
  const { badges: userBadges } = useBadges();
  const fr = language === 'fr';

  const [activeFormat, setActiveFormat] = useState<ShareCardFormat>('square');
  const [sharing, setSharing] = useState(false);
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

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const title = `ultimate-petanque-${cardType}-${Date.now()}`;
      await captureAndShare(cardRef.current, title);
    } catch (e) {
      console.log('[ShareCard] Error:', e);
    } finally {
      setSharing(false);
    }
  }, [cardType]);

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
          />
        );
      case 'challenge':
        if (!challenge) return <EmptyCard message={fr ? 'Defi introuvable' : 'Challenge not found'} />;
        return (
          <ShareCardChallenge
            challenge={challenge}
            playerName={playerName}
            language={language}
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
          />
        );
    }
  };

  const typeLabels: Record<CardType, { fr: string; en: string; icon: string }> = {
    match: { fr: 'Resultat de match', en: 'Match Result', icon: 'sports' },
    badge: { fr: 'Badge debloque', en: 'Badge Unlocked', icon: 'military-tech' },
    stats: { fr: 'Mes statistiques', en: 'My Statistics', icon: 'bar-chart' },
    challenge: { fr: 'Resultat de defi', en: 'Challenge Result', icon: 'track-changes' },
  };

  const typeInfo = typeLabels[cardType] || typeLabels.stats;

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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Type label */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={st.typeLabel}>{fr ? typeInfo.fr : typeInfo.en}</Text>
        </Animated.View>

        {/* Format selector */}
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
              </Pressable>
            );
          })}
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

        {/* Platform hints */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={st.hintsRow}>
          <View style={st.hintChip}>
            <MaterialIcons name="crop-square" size={14} color="#E4405F" />
            <Text style={st.hintText}>Instagram</Text>
          </View>
          <View style={st.hintChip}>
            <MaterialIcons name="crop-portrait" size={14} color="#000" />
            <Text style={st.hintText}>TikTok / Stories</Text>
          </View>
          <View style={st.hintChip}>
            <MaterialIcons name="crop-landscape" size={14} color="#1877F2" />
            <Text style={st.hintText}>Facebook</Text>
          </View>
        </Animated.View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom share button */}
      <View style={st.bottomBar}>
        <Pressable
          style={[st.shareBtn, sharing && st.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <MaterialIcons name="share" size={20} color="#FFF" />
              <Text style={st.shareBtnText}>{fr ? 'Partager sur les reseaux' : 'Share on Social Media'}</Text>
            </>
          )}
        </Pressable>
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
  formatRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  formatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  formatChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  formatChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  formatChipTextActive: { color: '#FFF' },
  cardPreviewContainer: { alignItems: 'center', marginBottom: 20 },
  cardWrapper: { borderRadius: 20, overflow: 'hidden', ...theme.shadows.cardElevated },
  hintsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  hintChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  hintText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  bottomBar: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 16 },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
