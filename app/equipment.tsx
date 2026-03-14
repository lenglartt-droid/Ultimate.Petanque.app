import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Line, Circle as SvgCircle, Path } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import { BoulesSet } from '@/services/mockData';
import { uploadBoulesSetPhoto } from '@/services/storageService';

function MiniWinChart({ data, chartWidth }: { data: { cumWinRate: number }[]; chartWidth: number }) {
  if (data.length < 2) return null;
  const W = Math.max(100, chartWidth);
  const H = 72;
  const pad = { top: 10, right: 10, bottom: 10, left: 10 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * cW,
    y: pad.top + cH - (d.cumWinRate / 100) * cH,
  }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M ${pad.left},${pad.top + cH} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${pad.left + cW},${pad.top + cH} Z`;
  const mid = pad.top + cH / 2;
  return (
    <Svg width={W} height={H}>
      <Line x1={pad.left} y1={mid} x2={pad.left + cW} y2={mid} stroke={theme.border} strokeWidth={1} strokeDasharray="4,4" />
      <Path d={area} fill={theme.success + '12'} />
      <Polyline points={polyline} fill="none" stroke={theme.success} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <SvgCircle key={i} cx={p.x} cy={p.y} r={3} fill={data[i].cumWinRate >= 50 ? theme.success : theme.error} stroke="#FFF" strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

const HARDNESS_OPTIONS = ['Tendre', 'Demi-tendre', 'Dure'] as const;

export default function EquipmentScreen() {
  const insets = useSafeAreaInsets();
  const { boulesSets, addBoulesSet, updateBoulesSet, deleteBoulesSet, setPrimaryBoulesSet, matches, challenges } = useApp();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState<BoulesSet | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formDiameter, setFormDiameter] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formHardness, setFormHardness] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Detailed stats per set
  const setStats = useMemo(() => {
    const stats: Record<string, { matches: number; wins: number; challenges: number; totalTirs: number; tirsSuccess: number; totalPoints: number; pointsSuccess: number; carreaux: number; winRate: number; tirRate: number; pointRate: number; carreauRate: number; evolution: { cumWinRate: number }[] }> = {};
    boulesSets.forEach(bs => {
      const bsMatches = matches.filter(m => m.boulesSetId === bs.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const bsChallenges = challenges.filter(c => c.boulesSetId === bs.id);
      let totalTirs = 0, tirsSuccess = 0, totalPoints = 0, pointsSuccess = 0, carreaux = 0;
      const wins = bsMatches.filter(m => m.winner === 'A').length;
      bsMatches.forEach(m => {
        if (m.playerActions) {
          m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
            totalTirs += pa.actions.tirs;
            tirsSuccess += pa.actions.tirsSuccess;
            totalPoints += pa.actions.points;
            pointsSuccess += pa.actions.pointsSuccess;
            carreaux += pa.actions.carreaux;
          });
        }
      });
      let cumWins = 0;
      const evolution = bsMatches.map((m, i) => {
        if (m.winner === 'A') cumWins++;
        return { cumWinRate: Math.round((cumWins / (i + 1)) * 100) };
      });
      stats[bs.id] = {
        matches: bsMatches.length, wins, challenges: bsChallenges.length,
        totalTirs, tirsSuccess, totalPoints, pointsSuccess, carreaux,
        winRate: bsMatches.length > 0 ? Math.round((wins / bsMatches.length) * 100) : 0,
        tirRate: totalTirs > 0 ? Math.round((tirsSuccess / totalTirs) * 100) : 0,
        pointRate: totalPoints > 0 ? Math.round((pointsSuccess / totalPoints) * 100) : 0,
        carreauRate: tirsSuccess > 0 ? Math.round((carreaux / tirsSuccess) * 100) : 0,
        evolution,
      };
    });
    return stats;
  }, [boulesSets, matches, challenges]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormBrand('');
    setFormDiameter('');
    setFormWeight('');
    setFormSerialNumber('');
    setFormHardness('');
    setFormNotes('');
    setFormIsPrimary(false);
    setFormPhoto(null);
    setEditingSet(null);
  }, []);

  const openNewForm = useCallback(() => {
    resetForm();
    setFormIsPrimary(boulesSets.length === 0);
    setShowForm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [boulesSets.length, resetForm]);

  const openEditForm = useCallback((set: BoulesSet) => {
    setEditingSet(set);
    setFormName(set.name);
    setFormBrand(set.brand || '');
    setFormDiameter(set.diameter ? String(set.diameter) : '');
    setFormWeight(set.weight ? String(set.weight) : '');
    setFormSerialNumber(set.serialNumber || '');
    setFormHardness(set.hardness || '');
    setFormNotes(set.notes || '');
    setFormIsPrimary(set.isPrimary || false);
    setFormPhoto(set.photo || null);
    setShowForm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePickPhoto = useCallback(async () => {
    Alert.alert(
      language === 'fr' ? 'Photo du set' : 'Set photo',
      language === 'fr' ? 'Choisissez une option' : 'Choose an option',
      [
        {
          text: language === 'fr' ? 'Prendre une photo' : 'Take a photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission'));
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: language === 'fr' ? 'Choisir dans la galerie' : 'Choose from gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission'));
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
        ...(formPhoto ? [{
          text: language === 'fr' ? 'Supprimer la photo' : 'Remove photo',
          style: 'destructive' as const,
          onPress: () => {
            setFormPhoto(null);
            Haptics.selectionAsync();
          },
        }] : []),
        { text: t('common', 'cancel'), style: 'cancel' as const },
      ]
    );
  }, [formPhoto, language, t]);

  const uploadPhoto = useCallback(async (uri: string) => {
    if (!user?.id) return;
    setUploadingPhoto(true);
    try {
      const publicUrl = await uploadBoulesSetPhoto(user.id, uri);
      if (publicUrl) {
        setFormPhoto(publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(t('common', 'error'), language === 'fr' ? 'Impossible de charger la photo' : 'Unable to upload photo');
      }
    } catch (e) {
      console.log('Error uploading boules photo:', e);
      Alert.alert(t('common', 'error'), language === 'fr' ? 'Erreur lors du chargement' : 'Upload error');
    } finally {
      setUploadingPhoto(false);
    }
  }, [user?.id, t, language]);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      Alert.alert(t('common', 'error'), language === 'fr' ? 'Le nom est obligatoire' : 'Name is required');
      return;
    }

    const setData: Omit<BoulesSet, 'id'> = {
      name: formName.trim(),
      brand: formBrand.trim() || undefined,
      diameter: formDiameter ? parseFloat(formDiameter) : undefined,
      weight: formWeight ? parseInt(formWeight, 10) : undefined,
      serialNumber: formSerialNumber.trim() || undefined,
      hardness: formHardness || undefined,
      isPrimary: formIsPrimary,
      notes: formNotes.trim() || undefined,
      photo: formPhoto || undefined,
    };

    if (editingSet) {
      await updateBoulesSet(editingSet.id, setData);
      if (formIsPrimary && !editingSet.isPrimary) {
        await setPrimaryBoulesSet(editingSet.id);
      }
    } else {
      await addBoulesSet(setData);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    resetForm();
  }, [formName, formBrand, formDiameter, formWeight, formSerialNumber, formHardness, formNotes, formIsPrimary, formPhoto, editingSet, addBoulesSet, updateBoulesSet, setPrimaryBoulesSet, resetForm, t, language]);

  const handleDelete = useCallback((set: BoulesSet) => {
    Alert.alert(
      t('common', 'delete'),
      language === 'fr' ? `Supprimer "${set.name}" ?` : `Delete "${set.name}"?`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteBoulesSet(set.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, [deleteBoulesSet, t, language]);

  const handleSetPrimary = useCallback(async (set: BoulesSet) => {
    await setPrimaryBoulesSet(set.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [setPrimaryBoulesSet]);

  const primarySet = boulesSets.find(s => s.isPrimary);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{language === 'fr' ? 'Équipement' : 'Equipment'}</Text>
        <Pressable style={styles.addBtn} onPress={openNewForm}>
          <MaterialIcons name="add" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <View style={styles.heroIconBg}>
            <MaterialIcons name="sports-baseball" size={36} color={theme.accent} />
          </View>
          <Text style={styles.heroTitle}>{language === 'fr' ? 'Mes Sets de Boules' : 'My Boules Sets'}</Text>
          <Text style={styles.heroSubtitle}>
            {boulesSets.length} {language === 'fr' ? 'set(s) enregistré(s)' : 'set(s) registered'}
          </Text>
          {primarySet ? (
            <View style={styles.heroPrimaryBadge}>
              <MaterialIcons name="star" size={14} color={theme.carreauColor} />
              <Text style={styles.heroPrimaryText}>
                {language === 'fr' ? 'Principal' : 'Primary'}: {primarySet.name}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Sets List */}
        {boulesSets.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <MaterialIcons name="sports-baseball" size={48} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{language === 'fr' ? 'Aucun set enregistré' : 'No sets registered'}</Text>
            <Text style={styles.emptyDesc}>
              {language === 'fr'
                ? 'Ajoutez vos sets de boules pour suivre vos performances par équipement'
                : 'Add your boules sets to track performance by equipment'}
            </Text>
            <Pressable style={styles.emptyBtn} onPress={openNewForm}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyBtnText}>{language === 'fr' ? 'Ajouter un set' : 'Add a set'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          boulesSets.map((set, idx) => {
            const stats = setStats[set.id] || { matches: 0, wins: 0, challenges: 0, totalTirs: 0, tirsSuccess: 0, totalPoints: 0, pointsSuccess: 0, carreaux: 0, winRate: 0, tirRate: 0, pointRate: 0, carreauRate: 0, evolution: [] };
            const chartWidth = Dimensions.get('window').width - 96;

            return (
              <Animated.View key={set.id} entering={FadeInDown.duration(400).delay(100 + idx * 60)}>
                <Pressable
                  style={[styles.setCard, set.isPrimary && styles.setCardPrimary]}
                  onPress={() => openEditForm(set)}
                >
                  {/* Primary badge */}
                  {set.isPrimary ? (
                    <View style={styles.primaryBadge}>
                      <MaterialIcons name="star" size={12} color="#FFF" />
                      <Text style={styles.primaryBadgeText}>{language === 'fr' ? 'Principal' : 'Primary'}</Text>
                    </View>
                  ) : null}

                  {/* Header row with photo */}
                  <View style={styles.setHeader}>
                    {set.photo ? (
                      <View style={styles.setPhotoBg}>
                        <Image source={{ uri: set.photo }} style={styles.setPhoto} contentFit="cover" transition={200} />
                      </View>
                    ) : (
                      <View style={[styles.setIconBg, set.isPrimary && { backgroundColor: theme.accent + '20' }]}>
                        <MaterialIcons name="sports-baseball" size={24} color={set.isPrimary ? theme.accent : theme.textSecondary} />
                      </View>
                    )}
                    <View style={styles.setInfo}>
                      <Text style={styles.setName}>{set.name}</Text>
                      <Text style={styles.setMeta}>
                        {[
                          set.brand,
                          set.diameter ? `${set.diameter} mm` : '',
                          set.weight ? `${set.weight} g` : '',
                          set.hardness,
                        ].filter(Boolean).join(' \u2022 ')}
                      </Text>
                    </View>
                    <View style={styles.setActions}>
                      {!set.isPrimary ? (
                        <Pressable
                          style={styles.setActionBtn}
                          onPress={(e) => { e.stopPropagation(); handleSetPrimary(set); }}
                          hitSlop={8}
                        >
                          <MaterialIcons name="star-outline" size={20} color={theme.textMuted} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[styles.setActionBtn, { backgroundColor: theme.error + '10' }]}
                        onPress={(e) => { e.stopPropagation(); handleDelete(set); }}
                        hitSlop={8}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={theme.error} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Serial number */}
                  {set.serialNumber ? (
                    <View style={styles.serialRow}>
                      <MaterialIcons name="tag" size={14} color={theme.textMuted} />
                      <Text style={styles.serialText}>N\u00B0{set.serialNumber}</Text>
                    </View>
                  ) : null}

                  {/* Specs bars */}
                  {(set.diameter || set.weight) ? (
                    <View style={styles.specsBars}>
                      {set.diameter ? (
                        <View style={styles.specBar}>
                          <View style={styles.specHeader}>
                            <Text style={styles.specLabel}>{language === 'fr' ? 'Diamètre' : 'Diameter'}</Text>
                            <Text style={styles.specValue}>{set.diameter} mm</Text>
                          </View>
                          <View style={styles.specTrack}>
                            <View style={[styles.specFill, { width: `${Math.max(0, Math.min(100, ((Number(set.diameter) - 70.5) / (80 - 70.5)) * 100))}%`, backgroundColor: theme.primary }]} />
                          </View>
                          <View style={styles.specRange}>
                            <Text style={styles.specRangeText}>70.5 mm</Text>
                            <Text style={styles.specRangeText}>80.0 mm</Text>
                          </View>
                        </View>
                      ) : null}
                      {set.weight ? (
                        <View style={styles.specBar}>
                          <View style={styles.specHeader}>
                            <Text style={styles.specLabel}>{language === 'fr' ? 'Poids' : 'Weight'}</Text>
                            <Text style={styles.specValue}>{set.weight} g</Text>
                          </View>
                          <View style={styles.specTrack}>
                            <View style={[styles.specFill, { width: `${Math.max(0, Math.min(100, ((set.weight - 650) / (800 - 650)) * 100))}%`, backgroundColor: theme.accent }]} />
                          </View>
                          <View style={styles.specRange}>
                            <Text style={styles.specRangeText}>650 g</Text>
                            <Text style={styles.specRangeText}>800 g</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Performance */}
                  {stats.matches > 0 ? (
                    <View style={styles.perfSection}>
                      <View style={styles.perfHeader}>
                        <MaterialIcons name="analytics" size={14} color={theme.textSecondary} />
                        <Text style={styles.perfTitle}>{language === 'fr' ? 'Performances' : 'Performance'}</Text>
                        <Text style={styles.perfMatchCount}>{stats.matches} {language === 'fr' ? 'matchs' : 'matches'}{stats.challenges > 0 ? ` \u2022 ${stats.challenges} ${language === 'fr' ? 'défis' : 'challenges'}` : ''}</Text>
                      </View>
                      <View style={styles.perfBars}>
                        <View style={styles.perfBarRow}>
                          <MaterialIcons name="emoji-events" size={13} color={theme.success} />
                          <Text style={styles.perfBarLabel}>{language === 'fr' ? 'Victoires' : 'Wins'}</Text>
                          <View style={styles.perfBarTrack}>
                            <View style={[styles.perfBarFill, { width: `${stats.winRate}%`, backgroundColor: theme.success }]} />
                          </View>
                          <Text style={[styles.perfBarValue, { color: stats.winRate >= 50 ? theme.success : theme.error }]}>{stats.winRate}%</Text>
                        </View>
                        {stats.totalTirs > 0 ? (
                          <View style={styles.perfBarRow}>
                            <MaterialIcons name="gps-fixed" size={13} color={theme.accent} />
                            <Text style={styles.perfBarLabel}>{language === 'fr' ? 'Tirs' : 'Shots'}</Text>
                            <View style={styles.perfBarTrack}>
                              <View style={[styles.perfBarFill, { width: `${stats.tirRate}%`, backgroundColor: theme.accent }]} />
                            </View>
                            <Text style={[styles.perfBarValue, { color: theme.accent }]}>{stats.tirRate}%</Text>
                          </View>
                        ) : null}
                        {stats.totalPoints > 0 ? (
                          <View style={styles.perfBarRow}>
                            <MaterialIcons name="adjust" size={13} color={theme.primary} />
                            <Text style={styles.perfBarLabel}>Points</Text>
                            <View style={styles.perfBarTrack}>
                              <View style={[styles.perfBarFill, { width: `${stats.pointRate}%`, backgroundColor: theme.primary }]} />
                            </View>
                            <Text style={[styles.perfBarValue, { color: theme.primary }]}>{stats.pointRate}%</Text>
                          </View>
                        ) : null}
                        {stats.tirsSuccess > 0 ? (
                          <View style={styles.perfBarRow}>
                            <MaterialIcons name="stars" size={13} color={theme.carreauColor} />
                            <Text style={styles.perfBarLabel}>{language === 'fr' ? 'Carreaux' : 'Carreaux'}</Text>
                            <View style={styles.perfBarTrack}>
                              <View style={[styles.perfBarFill, { width: `${stats.carreauRate}%`, backgroundColor: theme.carreauColor }]} />
                            </View>
                            <Text style={[styles.perfBarValue, { color: theme.carreauColor }]}>{stats.carreauRate}%</Text>
                          </View>
                        ) : null}
                      </View>
                      {stats.evolution.length >= 2 ? (
                        <View style={styles.perfChartSection}>
                          <Text style={styles.perfChartTitle}>{language === 'fr' ? 'Évolution du taux de victoire' : 'Win rate evolution'}</Text>
                          <View style={styles.perfChartContainer}>
                            <View style={{ flex: 1 }}>
                              <MiniWinChart data={stats.evolution} chartWidth={chartWidth} />
                            </View>
                            <View style={styles.perfChartLabels}>
                              <Text style={styles.perfChartLabelText}>100%</Text>
                              <Text style={styles.perfChartLabelText}>50%</Text>
                              <Text style={styles.perfChartLabelText}>0%</Text>
                            </View>
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.perfCounters}>
                        <View style={styles.perfCounter}>
                          <Text style={styles.perfCounterValue}>{stats.wins}/{stats.matches}</Text>
                          <Text style={styles.perfCounterLabel}>{language === 'fr' ? 'V/M' : 'W/M'}</Text>
                        </View>
                        {stats.totalTirs > 0 ? (
                          <View style={styles.perfCounter}>
                            <Text style={styles.perfCounterValue}>{stats.tirsSuccess}/{stats.totalTirs}</Text>
                            <Text style={styles.perfCounterLabel}>{language === 'fr' ? 'Tirs' : 'Shots'}</Text>
                          </View>
                        ) : null}
                        {stats.totalPoints > 0 ? (
                          <View style={styles.perfCounter}>
                            <Text style={styles.perfCounterValue}>{stats.pointsSuccess}/{stats.totalPoints}</Text>
                            <Text style={styles.perfCounterLabel}>Pts</Text>
                          </View>
                        ) : null}
                        {stats.carreaux > 0 ? (
                          <View style={styles.perfCounter}>
                            <Text style={[styles.perfCounterValue, { color: theme.carreauColor }]}>{stats.carreaux}</Text>
                            <Text style={styles.perfCounterLabel}>C</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : stats.challenges > 0 ? (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <MaterialIcons name="flag" size={14} color={theme.accent} />
                        <Text style={styles.statValue}>{stats.challenges}</Text>
                        <Text style={styles.statLabel}>{language === 'fr' ? 'défis' : 'challenges'}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Notes */}
                  {set.notes ? (
                    <View style={styles.notesRow}>
                      <MaterialIcons name="notes" size={14} color={theme.textMuted} />
                      <Text style={styles.notesText} numberOfLines={2}>{set.notes}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })
        )}

        {/* Add button at bottom */}
        {boulesSets.length > 0 ? (
          <Pressable style={styles.addSetBtn} onPress={openNewForm}>
            <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
            <Text style={styles.addSetBtnText}>{language === 'fr' ? 'Ajouter un set de boules' : 'Add a boules set'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); resetForm(); }}
      >
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={() => { setShowForm(false); resetForm(); }}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingSet
                ? (language === 'fr' ? 'Modifier le set' : 'Edit set')
                : (language === 'fr' ? 'Nouveau set' : 'New set')}
            </Text>
            <Pressable style={styles.modalSaveBtn} onPress={handleSave}>
              <Text style={styles.modalSaveBtnText}>{t('common', 'save')}</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Photo */}
              <Pressable style={styles.photoPickerContainer} onPress={handlePickPhoto} disabled={uploadingPhoto}>
                {uploadingPhoto ? (
                  <View style={styles.photoPickerLoading}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.photoPickerLoadingText}>{language === 'fr' ? 'Envoi...' : 'Uploading...'}</Text>
                  </View>
                ) : formPhoto ? (
                  <View style={styles.photoPickerFilled}>
                    <Image source={{ uri: formPhoto }} style={styles.photoPickerImage} contentFit="cover" transition={200} />
                    <View style={styles.photoPickerOverlay}>
                      <View style={styles.photoPickerOverlayBadge}>
                        <MaterialIcons name="camera-alt" size={16} color="#FFF" />
                        <Text style={styles.photoPickerOverlayText}>{language === 'fr' ? 'Modifier' : 'Change'}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPickerEmpty}>
                    <View style={styles.photoPickerEmptyIcon}>
                      <MaterialIcons name="add-a-photo" size={28} color={theme.primary} />
                    </View>
                    <Text style={styles.photoPickerEmptyTitle}>{language === 'fr' ? 'Ajouter une photo' : 'Add a photo'}</Text>
                    <Text style={styles.photoPickerEmptyDesc}>{language === 'fr' ? 'Photo de vos boules' : 'Photo of your boules'}</Text>
                  </View>
                )}
              </Pressable>

              {/* Name */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'fr' ? 'NOM DU SET *' : 'SET NAME *'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder={language === 'fr' ? 'Ex: Obut ATX Compétition' : 'Ex: Obut ATX Competition'}
                  placeholderTextColor={theme.textMuted}
                  autoFocus={!editingSet}
                />
              </View>

              {/* Brand */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'fr' ? 'MARQUE' : 'BRAND'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formBrand}
                  onChangeText={setFormBrand}
                  placeholder={language === 'fr' ? 'Ex: Obut, MS Pétanque, La Boule Noire...' : 'Ex: Obut, MS Pétanque, La Boule Noire...'}
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Diameter & Weight */}
              <View style={styles.formRow}>
                <View style={styles.formRowField}>
                  <Text style={styles.formLabel}>{language === 'fr' ? 'DIAMÈTRE (mm)' : 'DIAMETER (mm)'}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formDiameter}
                    onChangeText={setFormDiameter}
                    placeholder="70.5 - 80.0"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formRowField}>
                  <Text style={styles.formLabel}>{language === 'fr' ? 'POIDS (g)' : 'WEIGHT (g)'}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formWeight}
                    onChangeText={setFormWeight}
                    placeholder="650 - 800"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Serial Number */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'fr' ? 'NUMÉRO DE SÉRIE' : 'SERIAL NUMBER'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formSerialNumber}
                  onChangeText={setFormSerialNumber}
                  placeholder={language === 'fr' ? 'Optionnel' : 'Optional'}
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Hardness */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'fr' ? 'DURETÉ' : 'HARDNESS'}</Text>
                <View style={styles.hardnessRow}>
                  {HARDNESS_OPTIONS.map(h => (
                    <Pressable
                      key={h}
                      style={[styles.hardnessChip, formHardness === h && styles.hardnessChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFormHardness(formHardness === h ? '' : h);
                      }}
                    >
                      <Text style={[styles.hardnessChipText, formHardness === h && styles.hardnessChipTextActive]}>
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Primary toggle */}
              <Pressable
                style={[styles.primaryToggle, formIsPrimary && styles.primaryToggleActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFormIsPrimary(!formIsPrimary);
                }}
              >
                <MaterialIcons
                  name={formIsPrimary ? 'star' : 'star-outline'}
                  size={22}
                  color={formIsPrimary ? theme.carreauColor : theme.textMuted}
                />
                <View style={styles.primaryToggleContent}>
                  <Text style={[styles.primaryToggleTitle, formIsPrimary && { color: theme.carreauColor }]}>
                    {language === 'fr' ? 'Set principal' : 'Primary set'}
                  </Text>
                  <Text style={styles.primaryToggleDesc}>
                    {language === 'fr'
                      ? 'Synchronisé avec votre profil joueur'
                      : 'Synced with your player profile'}
                  </Text>
                </View>
                <View style={[styles.toggleIndicator, formIsPrimary && styles.toggleIndicatorActive]}>
                  <View style={[styles.toggleDot, formIsPrimary && styles.toggleDotActive]} />
                </View>
              </Pressable>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'fr' ? 'NOTES' : 'NOTES'}</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder={language === 'fr' ? 'Remarques, sensations, préférences...' : 'Remarks, feelings, preferences...'}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '15', borderRadius: 20 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // Hero
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl, padding: 24, alignItems: 'center', marginBottom: 20, ...theme.shadows.card },
  heroIconBg: { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.accent + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary },
  heroPrimaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: theme.carreauColor + '12', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  heroPrimaryText: { fontSize: 13, fontWeight: '600', color: theme.carreauColor },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconBg: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', maxWidth: 280, marginBottom: 24, lineHeight: 22 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.borderRadius.lg },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // Set card
  setCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 12, ...theme.shadows.card },
  setCardPrimary: { borderWidth: 2, borderColor: theme.accent + '40' },
  primaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.carreauColor, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 10 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  setHeader: { flexDirection: 'row', alignItems: 'center' },
  setIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  setPhotoBg: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', marginRight: 12 },
  setPhoto: { width: 48, height: 48 },
  setInfo: { flex: 1 },
  setName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  setMeta: { fontSize: 13, color: theme.textSecondary },
  setActions: { flexDirection: 'row', gap: 8 },
  setActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  serialRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  serialText: { fontSize: 12, color: theme.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Specs bars
  specsBars: { marginTop: 12, gap: 10 },
  specBar: { gap: 2 },
  specHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  specLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  specTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  specFill: { height: '100%', borderRadius: 3 },
  specValue: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  specRange: { flexDirection: 'row', justifyContent: 'space-between' },
  specRangeText: { fontSize: 9, color: theme.textMuted },

  // Stats
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 11, color: theme.textMuted },

  // Performance section
  perfSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  perfHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  perfTitle: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, flex: 1 },
  perfMatchCount: { fontSize: 10, color: theme.textMuted },
  perfBars: { gap: 6 },
  perfBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perfBarLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, width: 52 },
  perfBarTrack: { flex: 1, height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  perfBarFill: { height: '100%', borderRadius: 3 },
  perfBarValue: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' as const },
  perfChartSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '60' },
  perfChartTitle: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  perfChartContainer: { flexDirection: 'row' as const, alignItems: 'center' as const },
  perfChartLabels: { width: 30, justifyContent: 'space-between' as const, height: 72, paddingVertical: 8, marginLeft: 4 },
  perfChartLabelText: { fontSize: 8, color: theme.textMuted, textAlign: 'right' as const },
  perfCounters: { flexDirection: 'row' as const, gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '60' },
  perfCounter: { flex: 1, alignItems: 'center' as const, backgroundColor: theme.backgroundSecondary, paddingVertical: 8, borderRadius: theme.borderRadius.sm },
  perfCounterValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  perfCounterLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2 },

  // Notes
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  notesText: { flex: 1, fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', lineHeight: 18 },

  // Add button
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary + '10', paddingVertical: 16, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: theme.primary + '25', borderStyle: 'dashed', marginTop: 8 },
  addSetBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  modalSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.primary, borderRadius: theme.borderRadius.md },
  modalSaveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  formScroll: { flex: 1 },
  formContent: { padding: 16, gap: 16 },
  formField: {},
  formLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  formInput: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, color: theme.textPrimary, ...theme.shadows.card },
  formTextArea: { minHeight: 80, paddingTop: 14 },
  formRow: { flexDirection: 'row', gap: 12 },
  formRowField: { flex: 1 },
  hardnessRow: { flexDirection: 'row', gap: 8 },
  hardnessChip: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  hardnessChipActive: { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  hardnessChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  hardnessChipTextActive: { color: theme.primary },

  // Photo picker
  photoPickerContainer: { borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.card },
  photoPickerLoading: { height: 160, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoPickerLoadingText: { fontSize: 13, color: theme.textSecondary },
  photoPickerFilled: { position: 'relative', height: 180 },
  photoPickerImage: { width: '100%', height: '100%' },
  photoPickerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  photoPickerOverlayBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.full },
  photoPickerOverlayText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  photoPickerEmpty: { height: 140, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.primary + '25', borderStyle: 'dashed', borderRadius: theme.borderRadius.lg },
  photoPickerEmptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  photoPickerEmptyTitle: { fontSize: 14, fontWeight: '600', color: theme.primary },
  photoPickerEmptyDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },

  // Primary toggle
  primaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  primaryToggleActive: { borderColor: theme.carreauColor + '40', backgroundColor: theme.carreauColor + '08' },
  primaryToggleContent: { flex: 1 },
  primaryToggleTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  primaryToggleDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  toggleIndicator: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleIndicatorActive: { backgroundColor: theme.carreauColor },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleDotActive: { alignSelf: 'flex-end' },
});
