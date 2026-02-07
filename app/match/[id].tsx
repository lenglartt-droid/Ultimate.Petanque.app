import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '@/constants/theme';
import config, { GameFormat } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

interface MeneEdit {
  teamAPoints: number;
  teamBPoints: number;
  duration: number;
}

export default function EditMatchScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMatchById, updateMatch, deleteMatch, players } = useApp();

  const match = getMatchById(id!);

  const [mode, setMode] = useState<'Entraînement' | 'Tournoi'>('Entraînement');
  const [format, setFormat] = useState<GameFormat>('Doublette');
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [teamANames, setTeamANames] = useState('');
  const [teamBNames, setTeamBNames] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [menes, setMenes] = useState<MeneEdit[]>([]);
  const [editingMeneIndex, setEditingMeneIndex] = useState<number | null>(null);
  const [location, setLocation] = useState('');

  const maxScore = config.game.maxScore;

  useEffect(() => {
    if (match) {
      setMode(match.mode);
      setFormat(match.format);
      setTeamAScore(match.teamA.score);
      setTeamBScore(match.teamB.score);
      setTeamANames(match.teamA.playerNames.join(', '));
      setTeamBNames(match.teamB.playerNames.join(', '));
      setMatchDate(new Date(match.date));
      setDuration(match.duration);
      setMenes(match.menes?.map(m => ({
        teamAPoints: m.teamAPoints || 0,
        teamBPoints: m.teamBPoints || 0,
        duration: m.duration || 0,
      })) || []);
      setLocation(match.tournamentName || '');
    }
  }, [match]);

  if (!match) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Match non trouvé</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    Haptics.selectionAsync();
    if (team === 'A') {
      setTeamAScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    } else {
      setTeamBScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(matchDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setMatchDate(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(matchDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setMatchDate(newDate);
    }
  };

  const handleMeneEdit = (index: number, field: 'teamAPoints' | 'teamBPoints', value: number) => {
    setMenes(prev => prev.map((mene, i) => 
      i === index ? { ...mene, [field]: Math.max(0, Math.min(6, value)) } : mene
    ));
  };

  const handleAddMene = () => {
    setMenes(prev => [...prev, { teamAPoints: 0, teamBPoints: 0, duration: 0 }]);
  };

  const handleDeleteMene = (index: number) => {
    Alert.alert('Supprimer', 'Supprimer cette mène ?', [
      { text: 'Annuler', style: 'cancel' },
      { 
        text: 'Supprimer', 
        style: 'destructive',
        onPress: () => setMenes(prev => prev.filter((_, i) => i !== index))
      },
    ]);
  };

  const handleSave = () => {
    // Recalculate scores from menes if there are any
    let finalTeamAScore = teamAScore;
    let finalTeamBScore = teamBScore;
    
    if (menes.length > 0) {
      finalTeamAScore = menes.reduce((sum, m) => sum + m.teamAPoints, 0);
      finalTeamBScore = menes.reduce((sum, m) => sum + m.teamBPoints, 0);
    }

    const winner: 'A' | 'B' = finalTeamAScore > finalTeamBScore ? 'A' : 'B';

    updateMatch(id!, {
      date: matchDate.toISOString(),
      mode,
      format,
      teamA: {
        ...match.teamA,
        playerNames: teamANames.split(',').map(n => n.trim()).filter(n => n),
        score: finalTeamAScore,
      },
      teamB: {
        ...match.teamB,
        playerNames: teamBNames.split(',').map(n => n.trim()).filter(n => n),
        score: finalTeamBScore,
      },
      winner,
      duration,
      menes: menes.map((m, i) => ({
        ...m,
        number: i + 1,
      })),
      tournamentName: location || undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le match',
      'Cette action est irréversible. Voulez-vous vraiment supprimer ce match ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteMatch(id!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Modifier le match</Text>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <MaterialIcons name="delete" size={24} color={theme.error} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date & Time */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>DATE ET HEURE</Text>
            <View style={styles.dateTimeContainer}>
              <Pressable 
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialIcons name="event" size={20} color={theme.primary} />
                <Text style={styles.dateText}>
                  {matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </Pressable>
              <Pressable 
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <MaterialIcons name="access-time" size={20} color={theme.primary} />
                <Text style={styles.dateText}>
                  {matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={matchDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={matchDate}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>LIEU / TOURNOI</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: Parc de la Tête d'Or, Lyon"
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Mode Selection */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>MODE</Text>
            <View style={styles.modeContainer}>
              {config.matchModes.map(m => (
                <Pressable
                  key={m}
                  style={[
                    styles.modeButton,
                    mode === m && styles.modeButtonActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMode(m);
                  }}
                >
                  <MaterialIcons 
                    name={m === 'Entraînement' ? 'fitness-center' : 'emoji-events'} 
                    size={20} 
                    color={mode === m ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.modeText,
                    mode === m && styles.modeTextActive
                  ]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Format Selection */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>FORMAT</Text>
            <View style={styles.formatContainer}>
              {config.game.formats.map(f => (
                <Pressable
                  key={f}
                  style={[
                    styles.formatChip,
                    format === f && styles.formatChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFormat(f);
                  }}
                >
                  <Text style={[
                    styles.formatChipText,
                    format === f && styles.formatChipTextActive
                  ]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Teams */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>ÉQUIPES</Text>
            <View style={styles.teamsCard}>
              <View style={styles.teamInputGroup}>
                <Text style={styles.teamLabel}>Mon équipe</Text>
                <TextInput
                  style={styles.teamInput}
                  value={teamANames}
                  onChangeText={setTeamANames}
                  placeholder="Noms séparés par des virgules"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.teamDivider} />
              <View style={styles.teamInputGroup}>
                <Text style={styles.teamLabel}>Adversaire</Text>
                <TextInput
                  style={styles.teamInput}
                  value={teamBNames}
                  onChangeText={setTeamBNames}
                  placeholder="Noms séparés par des virgules"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
          </Animated.View>

          {/* Score */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>SCORE FINAL</Text>
            <View style={styles.scoreContainer}>
              <View style={styles.teamScore}>
                <Text style={styles.scoreLabel}>Mon équipe</Text>
                <View style={styles.scoreControls}>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('A', -1)}
                  >
                    <MaterialIcons name="remove" size={24} color={theme.textSecondary} />
                  </Pressable>
                  <Text style={[
                    styles.scoreValue,
                    teamAScore > teamBScore && styles.scoreValueWin
                  ]}>
                    {teamAScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('A', 1)}
                  >
                    <MaterialIcons name="add" size={24} color={theme.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>-</Text>
              </View>

              <View style={styles.teamScore}>
                <Text style={styles.scoreLabel}>Adversaire</Text>
                <View style={styles.scoreControls}>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('B', -1)}
                  >
                    <MaterialIcons name="remove" size={24} color={theme.textSecondary} />
                  </Pressable>
                  <Text style={[
                    styles.scoreValue,
                    teamBScore > teamAScore && styles.scoreValueWin
                  ]}>
                    {teamBScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('B', 1)}
                  >
                    <MaterialIcons name="add" size={24} color={theme.primary} />
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Duration */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>DURÉE (MINUTES)</Text>
            <View style={styles.durationContainer}>
              <Pressable 
                style={styles.durationButton}
                onPress={() => setDuration(prev => Math.max(0, prev - 5))}
              >
                <MaterialIcons name="remove" size={24} color={theme.textSecondary} />
              </Pressable>
              <TextInput
                style={styles.durationInput}
                value={duration.toString()}
                onChangeText={(text) => setDuration(parseInt(text) || 0)}
                keyboardType="number-pad"
              />
              <Pressable 
                style={styles.durationButton}
                onPress={() => setDuration(prev => prev + 5)}
              >
                <MaterialIcons name="add" size={24} color={theme.primary} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Mènes */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MÈNES ({menes.length})</Text>
              <Pressable style={styles.addMeneBtn} onPress={handleAddMene}>
                <MaterialIcons name="add" size={18} color={theme.primary} />
                <Text style={styles.addMeneBtnText}>Ajouter</Text>
              </Pressable>
            </View>

            {menes.length > 0 ? (
              <View style={styles.menesCard}>
                {menes.map((mene, index) => (
                  <View key={index} style={styles.meneEditRow}>
                    <Text style={styles.meneNumber}>#{index + 1}</Text>
                    <View style={styles.meneScoreEdit}>
                      <Pressable
                        style={styles.meneScoreBtn}
                        onPress={() => handleMeneEdit(index, 'teamAPoints', mene.teamAPoints - 1)}
                      >
                        <MaterialIcons name="remove" size={16} color={theme.textMuted} />
                      </Pressable>
                      <Text style={[styles.meneScoreValue, mene.teamAPoints > 0 && { color: theme.success }]}>
                        {mene.teamAPoints}
                      </Text>
                      <Pressable
                        style={styles.meneScoreBtn}
                        onPress={() => handleMeneEdit(index, 'teamAPoints', mene.teamAPoints + 1)}
                      >
                        <MaterialIcons name="add" size={16} color={theme.primary} />
                      </Pressable>
                    </View>
                    <Text style={styles.meneSeparator}>-</Text>
                    <View style={styles.meneScoreEdit}>
                      <Pressable
                        style={styles.meneScoreBtn}
                        onPress={() => handleMeneEdit(index, 'teamBPoints', mene.teamBPoints - 1)}
                      >
                        <MaterialIcons name="remove" size={16} color={theme.textMuted} />
                      </Pressable>
                      <Text style={[styles.meneScoreValue, mene.teamBPoints > 0 && { color: theme.error }]}>
                        {mene.teamBPoints}
                      </Text>
                      <Pressable
                        style={styles.meneScoreBtn}
                        onPress={() => handleMeneEdit(index, 'teamBPoints', mene.teamBPoints + 1)}
                      >
                        <MaterialIcons name="add" size={16} color={theme.primary} />
                      </Pressable>
                    </View>
                    <Pressable
                      style={styles.meneDeleteBtn}
                      onPress={() => handleDeleteMene(index)}
                    >
                      <MaterialIcons name="close" size={18} color={theme.error} />
                    </Pressable>
                  </View>
                ))}
                
                {/* Totals */}
                <View style={styles.meneTotalRow}>
                  <Text style={styles.meneTotalLabel}>Total</Text>
                  <Text style={[styles.meneTotalValue, { color: theme.success }]}>
                    {menes.reduce((sum, m) => sum + m.teamAPoints, 0)}
                  </Text>
                  <Text style={styles.meneTotalSeparator}>-</Text>
                  <Text style={[styles.meneTotalValue, { color: theme.error }]}>
                    {menes.reduce((sum, m) => sum + m.teamBPoints, 0)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noMenesCard}>
                <Text style={styles.noMenesText}>Aucune mène enregistrée</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
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
  deleteButton: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  dateText: {
    fontSize: 15,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    fontSize: 15,
    color: theme.textPrimary,
    ...theme.shadows.card,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  modeButtonActive: {
    backgroundColor: theme.primary,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  modeTextActive: {
    color: '#FFF',
  },
  formatContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  formatChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  formatChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  formatChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  formatChipTextActive: {
    color: theme.primary,
  },
  teamsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  teamInputGroup: {
    marginBottom: 4,
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  teamInput: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    fontSize: 15,
    color: theme.textPrimary,
  },
  teamDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 20,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textPrimary,
    width: 60,
    textAlign: 'center',
  },
  scoreValueWin: {
    color: theme.success,
  },
  vsContainer: {
    paddingHorizontal: 8,
  },
  vsText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textMuted,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    gap: 16,
    ...theme.shadows.card,
  },
  durationButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 22,
  },
  durationInput: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    width: 80,
    textAlign: 'center',
  },
  addMeneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.primaryLight + '20',
    borderRadius: theme.borderRadius.full,
  },
  addMeneBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  menesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  meneEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  meneNumber: {
    width: 36,
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  meneScoreEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meneScoreBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 14,
  },
  meneScoreValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    width: 28,
    textAlign: 'center',
  },
  meneSeparator: {
    fontSize: 16,
    color: theme.textMuted,
    marginHorizontal: 12,
  },
  meneDeleteBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meneTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.backgroundSecondary,
  },
  meneTotalLabel: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  meneTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    width: 60,
    textAlign: 'center',
  },
  meneTotalSeparator: {
    fontSize: 16,
    color: theme.textMuted,
    marginHorizontal: 12,
  },
  noMenesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  noMenesText: {
    fontSize: 14,
    color: theme.textMuted,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
});
