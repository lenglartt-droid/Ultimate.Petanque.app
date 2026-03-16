import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import { createMeetup, scheduleMeetupReminder } from '@/services/meetupService';

export default function NewMeetupScreen() {
  const insets = useSafeAreaInsets();
  const { terrains } = useApp();
  const { t, language } = useLanguage();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ terrainId?: string }>();

  const [title, setTitle] = useState('');
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(params.terrainId || null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d;
  });
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTerrainPicker, setShowTerrainPicker] = useState(false);
  const [terrainSearch, setTerrainSearch] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const selectedTerrain = useMemo(
    () => selectedTerrainId ? terrains.find(tr => tr.id === selectedTerrainId) || null : null,
    [selectedTerrainId, terrains]
  );

  const filteredTerrains = useMemo(() => {
    const s = terrainSearch.toLowerCase();
    return terrains.filter(tr => !s || tr.name.toLowerCase().includes(s) || tr.city.toLowerCase().includes(s));
  }, [terrains, terrainSearch]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      showAlert(t('common', 'error'), t('meetup', 'titleRequired'));
      return;
    }
    if (!selectedTerrainId) {
      showAlert(t('common', 'error'), t('meetup', 'terrainRequired'));
      return;
    }
    if (date <= new Date()) {
      showAlert(t('common', 'error'), t('meetup', 'dateMustBeFuture'));
      return;
    }

    setSaving(true);
    const { meetup, error } = await createMeetup({
      terrainId: selectedTerrainId,
      title: title.trim(),
      date: date.toISOString(),
      maxParticipants: parseInt(maxParticipants) || 8,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (error) {
      showAlert(t('common', 'error'), error);
      return;
    }

    if (meetup) {
      // Schedule local reminder
      await scheduleMeetupReminder(meetup, selectedTerrain?.name || '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedCode(meetup.share_code);
    }
  }, [title, selectedTerrainId, date, maxParticipants, notes, selectedTerrain, t, showAlert]);

  const handleCopyCode = useCallback(async () => {
    if (createdCode) {
      await Clipboard.setStringAsync(createdCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('meetup', 'codeCopied'));
    }
  }, [createdCode, t, showAlert]);

  // Success screen
  if (createdCode) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('meetup', 'meetupCreated')}</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={64} color={theme.success} />
          </View>
          <Text style={styles.successTitle}>{t('meetup', 'meetupCreated')}</Text>
          <Text style={styles.successSubtitle}>{t('meetup', 'shareCodeToInvite')}</Text>

          <Pressable style={styles.codeCard} onPress={handleCopyCode}>
            <Text style={styles.codeLabel}>{t('meetup', 'shareCodeLabel')}</Text>
            <Text style={styles.codeValue}>{createdCode}</Text>
            <View style={styles.copyBtn}>
              <MaterialIcons name="content-copy" size={18} color={theme.primary} />
              <Text style={styles.copyBtnText}>{t('meetup', 'copyCode')}</Text>
            </View>
          </Pressable>

          <View style={styles.successInfo}>
            <MaterialIcons name="info-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.successInfoText}>{t('meetup', 'shareInstructions')}</Text>
          </View>

          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t('common', 'close')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('meetup', 'newMeetup')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('meetup', 'meetupTitle')} *</Text>
          <TextInput
            style={styles.fieldInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('meetup', 'titlePlaceholder')}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Terrain */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('meetup', 'terrain')} *</Text>
          <Pressable style={styles.pickerBtn} onPress={() => { setTerrainSearch(''); setShowTerrainPicker(true); }}>
            <View style={[styles.pickerIcon, { backgroundColor: selectedTerrain ? theme.primary + '15' : theme.textMuted + '10' }]}>
              <MaterialIcons name="place" size={20} color={selectedTerrain ? theme.primary : theme.textMuted} />
            </View>
            <Text style={[styles.pickerText, !selectedTerrain && styles.pickerPlaceholder]} numberOfLines={1}>
              {selectedTerrain ? `${selectedTerrain.name} \u2022 ${selectedTerrain.city}` : t('match', 'chooseTerrain')}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('meetup', 'dateAndTime')} *</Text>
          <View style={styles.dateRow}>
            <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
              <MaterialIcons name="calendar-today" size={18} color={theme.primary} />
              <Text style={styles.dateBtnText}>
                {date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={() => setShowTimePicker(true)}>
              <MaterialIcons name="schedule" size={18} color={theme.primary} />
              <Text style={styles.dateBtnText}>
                {date.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Max participants */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('meetup', 'maxParticipants')}</Text>
          <View style={styles.counterRow}>
            <Pressable style={styles.counterBtn} onPress={() => setMaxParticipants(String(Math.max(2, (parseInt(maxParticipants) || 8) - 1)))}>
              <MaterialIcons name="remove" size={20} color={theme.primary} />
            </Pressable>
            <TextInput
              style={styles.counterInput}
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="numeric"
            />
            <Pressable style={styles.counterBtn} onPress={() => setMaxParticipants(String(Math.min(50, (parseInt(maxParticipants) || 8) + 1)))}>
              <MaterialIcons name="add" size={20} color={theme.primary} />
            </Pressable>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('meetup', 'notesLabel')}</Text>
          <TextInput
            style={[styles.fieldInput, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('meetup', 'notesPlaceholder')}
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={[styles.createBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <MaterialIcons name="event" size={22} color="#FFF" />
              <Text style={styles.createBtnText}>{t('meetup', 'createMeetup')}</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const newDate = new Date(date);
              newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
              setDate(newDate);
            }
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          onChange={(_, selectedDate) => {
            setShowTimePicker(false);
            if (selectedDate) {
              const newDate = new Date(date);
              newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
              setDate(newDate);
            }
          }}
        />
      )}

      {/* Terrain Picker Modal */}
      <Modal visible={showTerrainPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTerrainPicker(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTerrainPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t('meetup', 'terrain')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.modalSearch}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput style={styles.modalSearchInput} value={terrainSearch} onChangeText={setTerrainSearch} placeholder={`${t('common', 'search')}...`} placeholderTextColor={theme.textMuted} autoFocus />
          </View>
          <FlatList
            data={filteredTerrains}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: tr }) => (
              <Pressable
                style={[styles.modalItem, selectedTerrainId === tr.id && styles.modalItemActive]}
                onPress={() => { Haptics.selectionAsync(); setSelectedTerrainId(tr.id); setShowTerrainPicker(false); }}
              >
                <View style={[styles.modalItemIcon, { backgroundColor: selectedTerrainId === tr.id ? theme.primary : theme.primary + '15' }]}>
                  <MaterialIcons name="place" size={20} color={selectedTerrainId === tr.id ? '#FFF' : theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{tr.name}</Text>
                  <Text style={styles.modalItemSub}>{tr.city} \u2022 {tr.type}</Text>
                </View>
                {selectedTerrainId === tr.id ? <MaterialIcons name="check-circle" size={20} color={theme.primary} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <MaterialIcons name="place" size={40} color={theme.textMuted} />
                <Text style={styles.modalEmptyText}>{t('common', 'noResults')}</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  formContent: { paddingHorizontal: 16, paddingTop: 20 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  fieldInput: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: theme.border },
  pickerIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  pickerPlaceholder: { color: theme.textMuted, fontWeight: '400' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border },
  dateBtnText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  counterInput: { width: 60, textAlign: 'center', fontSize: 20, fontWeight: '700', color: theme.textPrimary, backgroundColor: theme.surface, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.border },
  bottomAction: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 16 },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Success
  successContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 48 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', marginBottom: 32 },
  codeCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center', width: '100%', borderWidth: 2, borderColor: theme.primary + '20', ...theme.shadows.cardElevated },
  codeLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  codeValue: { fontSize: 32, fontWeight: '900', color: theme.primary, letterSpacing: 3, marginBottom: 16 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary + '15', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  copyBtnText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  successInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: theme.primary + '08', borderRadius: 14, padding: 16, marginTop: 24, width: '100%' },
  successInfoText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  doneBtn: { marginTop: 32, backgroundColor: theme.textPrimary, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14 },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: theme.border },
  modalSearchInput: { flex: 1, fontSize: 15, color: theme.textPrimary, padding: 0 },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: theme.surface, borderRadius: 12, marginBottom: 8 },
  modalItemActive: { borderWidth: 2, borderColor: theme.primary },
  modalItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalItemName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  modalItemSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  modalEmpty: { alignItems: 'center', paddingVertical: 40 },
  modalEmptyText: { fontSize: 14, color: theme.textMuted, marginTop: 10 },
});
