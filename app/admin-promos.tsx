import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { getSupabaseClient } from '@/template';
import { useAuth, useAlert } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import theme, { blurhash } from '@/constants/theme';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllReports, updateReportStatus, PlayerReport } from '@/services/reportService';
import { fetchSuspiciousPlayers, updateSuspiciousStatus } from '@/services/trustScoreService';
import { getTrustScoreColor } from '@/services/trustScoreService';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { fetchDeviceClusters, getDeviceRegistrationStats, DeviceCluster } from '@/services/multiAccountService';
import { fetchAmbassadors, invalidateAmbassadorCache, Ambassador } from '@/services/ambassadorService';
import { fetchAmbassadorAnalytics, fetchDailyAnalyticsCounts, AmbassadorAnalytics } from '@/services/ambassadorAnalyticsService';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { uploadImageToStorage } from '@/services/storageService';

interface PromoCode {
  id: string;
  code: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Redemption {
  id: string;
  user_id: string;
  promo_code_id: string;
  redeemed_at: string;
  user_email?: string;
}

export default function AdminPromosScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { isAdmin } = useApp();
  const { language } = useLanguage();
  const supabase = getSupabaseClient();

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRedemptionsModal, setShowRedemptionsModal] = useState(false);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  // Create form
  const [newCode, setNewCode] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('1');
  const [newHasExpiry, setNewHasExpiry] = useState(false);
  const [newExpiryDays, setNewExpiryDays] = useState('30');
  const [creating, setCreating] = useState(false);

  // Bulk generation form
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState('PROMO');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkMaxUses, setBulkMaxUses] = useState('1');
  const [bulkHasExpiry, setBulkHasExpiry] = useState(false);
  const [bulkExpiryDays, setBulkExpiryDays] = useState('30');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const fr = language === 'fr';

  // ===== LAST ANALYSIS STATE =====
  const [lastAnalysis, setLastAnalysis] = useState<{
    date: string;
    analyzed: number;
    flagged: number;
    suspicious: number;
    previousFlaggedCount: number;
  } | null>(null);

  // ===== REPORTS STATE =====
  const [showReportsSection, setShowReportsSection] = useState(false);
  const [reports, setReports] = useState<PlayerReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [updatingReport, setUpdatingReport] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (reportsLoaded) return;
    setReportsLoading(true);
    const { reports: reps } = await fetchAllReports();
    setReports(reps);
    setReportsLoading(false);
    setReportsLoaded(true);
  }, [reportsLoaded]);

  const handleUpdateReportStatus = useCallback(async (reportId: string, status: PlayerReport['status']) => {
    setUpdatingReport(reportId);
    const { error: err } = await updateReportStatus(reportId, status);
    setUpdatingReport(null);
    if (err) {
      showAlert(fr ? 'Erreur' : 'Error', err);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    }
  }, [fr, showAlert]);

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  // ===== DETECTION STATE =====
  const [showDetectionSection, setShowDetectionSection] = useState(false);
  const [suspiciousPlayers, setSuspiciousPlayers] = useState<any[]>([]);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionLoaded, setDetectionLoaded] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [updatingSuspicious, setUpdatingSuspicious] = useState<string | null>(null);

  const loadSuspicious = useCallback(async () => {
    if (detectionLoaded) return;
    setDetectionLoading(true);
    const { players: sp } = await fetchSuspiciousPlayers();
    setSuspiciousPlayers(sp);
    setDetectionLoading(false);
    setDetectionLoaded(true);
  }, [detectionLoaded]);

  const handleRunAnalysis = useCallback(async () => {
    setRunningAnalysis(true);
    setAnalysisResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('detect-suspicious', { body: {} });
      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const textContent = await error.context?.text();
            errorMessage = textContent || error.message;
          } catch { /* silent */ }
        }
        showAlert(fr ? 'Erreur' : 'Error', errorMessage);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnalysisResult(data);

        // Save analysis result and detect new suspects
        const prevFlagged = lastAnalysis?.flagged || 0;
        const newAnalysisData = {
          date: new Date().toISOString(),
          analyzed: data.analyzed || 0,
          flagged: data.flagged || 0,
          suspicious: data.suspicious || 0,
          previousFlaggedCount: prevFlagged,
        };
        setLastAnalysis(newAnalysisData);
        AsyncStorage.setItem('@admin_last_analysis', JSON.stringify(newAnalysisData)).catch(() => {});

        // Notify if new suspects detected
        const newSuspects = (data.flagged || 0) - prevFlagged;
        if (newSuspects > 0) {
          showAlert(
            fr ? 'Nouveaux suspects detectes' : 'New suspects detected',
            fr ? `${newSuspects} nouveau(x) joueur(s) suspect(s) depuis la derniere analyse.` : `${newSuspects} new suspicious player(s) since last analysis.`
          );
        } else if (prevFlagged > 0 && (data.flagged || 0) === 0) {
          showAlert(
            fr ? 'Aucun suspect' : 'No suspects',
            fr ? 'Aucun joueur suspect detecte. Tout est en ordre.' : 'No suspicious players detected. All clear.'
          );
        }

        setDetectionLoaded(false);
        loadSuspicious();
      }
    } catch (e: any) {
      showAlert(fr ? 'Erreur' : 'Error', e.message);
    } finally {
      setRunningAnalysis(false);
    }
  }, [supabase, fr, showAlert, loadSuspicious]);

  const handleUpdateSuspiciousStatus = useCallback(async (id: string, status: string) => {
    setUpdatingSuspicious(id);
    const { error: err } = await updateSuspiciousStatus(id, status);
    setUpdatingSuspicious(null);
    if (err) {
      showAlert(fr ? 'Erreur' : 'Error', err);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuspiciousPlayers(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    }
  }, [fr, showAlert]);

  const suspiciousFlaggedCount = suspiciousPlayers.filter(p => p.status === 'flagged' || p.status === 'watch').length;

  // ===== AMBASSADORS STATE =====
  const [showAmbassadorSection, setShowAmbassadorSection] = useState(false);
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(false);
  const [ambassadorsLoaded, setAmbassadorsLoaded] = useState(false);
  const [showAmbassadorModal, setShowAmbassadorModal] = useState(false);
  const [editingAmbassador, setEditingAmbassador] = useState<any>(null);
  const [ambForm, setAmbForm] = useState({ displayName: '', bio: '', photo: '', youtubeUrl: '', tiktokUrl: '', instagramHandle: '', twitterHandle: '', websiteUrl: '', isFeatured: false, playerId: '' });
  const [ambSaving, setAmbSaving] = useState(false);
  const [ambDeleting, setAmbDeleting] = useState<string | null>(null);
  const [ambPlayerSearch, setAmbPlayerSearch] = useState('');
  const [ambPlayerResults, setAmbPlayerResults] = useState<any[]>([]);
  const [ambSearching, setAmbSearching] = useState(false);
  const [ambUploadingPhoto, setAmbUploadingPhoto] = useState(false);
  const [ambassadorAnalytics, setAmbassadorAnalytics] = useState<Map<string, AmbassadorAnalytics>>(new Map());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [sparklineData, setSparklineData] = useState<Map<string, number[]>>(new Map());

  const loadAmbassadors = useCallback(async () => {
    if (ambassadorsLoaded) return;
    setAmbassadorsLoading(true);
    invalidateAmbassadorCache();
    const { data, error } = await supabase.from('ambassadors').select('*').order('sort_order', { ascending: true });
    if (!error && data) setAmbassadors(data);
    setAmbassadorsLoading(false);
    setAmbassadorsLoaded(true);
    // Load analytics in parallel
    setAnalyticsLoading(true);
    Promise.all([
      fetchAmbassadorAnalytics(analyticsPeriod),
      fetchDailyAnalyticsCounts(30),
    ]).then(([analyticsRes, dailyRes]) => {
      setAmbassadorAnalytics(analyticsRes.stats);
      if (!dailyRes.error) setSparklineData(dailyRes.data);
      setAnalyticsLoading(false);
    });
  }, [ambassadorsLoaded, supabase, analyticsPeriod]);

  const reloadAnalytics = useCallback(async (period: 'today' | '7d' | '30d' | 'all') => {
    setAnalyticsLoading(true);
    const { stats } = await fetchAmbassadorAnalytics(period);
    setAmbassadorAnalytics(stats);
    setAnalyticsLoading(false);
  }, []);

  const handleSearchPlayers = useCallback(async (query: string) => {
    setAmbPlayerSearch(query);
    if (query.trim().length < 2) { setAmbPlayerResults([]); return; }
    setAmbSearching(true);
    const { data } = await supabase.from('players').select('id, name, user_id, avatar, club, role').ilike('name', `%${query.trim()}%`).limit(10);
    setAmbPlayerResults(data || []);
    setAmbSearching(false);
  }, [supabase]);

  const handlePickAmbassadorPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert(fr ? 'Permission requise' : 'Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAmbUploadingPhoto(true);
      const url = await uploadImageToStorage('avatars', `avatars/ambassadors/${Date.now()}`, result.assets[0].uri);
      setAmbUploadingPhoto(false);
      if (url) { setAmbForm(prev => ({ ...prev, photo: url })); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else { showAlert(fr ? 'Erreur upload' : 'Upload error'); }
    }
  }, [fr, showAlert]);

  const handleOpenAmbassadorForm = useCallback((amb?: any) => {
    if (amb) {
      setEditingAmbassador(amb);
      setAmbForm({
        displayName: amb.display_name || '',
        bio: amb.bio || '',
        photo: amb.photo || '',
        youtubeUrl: amb.youtube_url || '',
        tiktokUrl: amb.tiktok_url || '',
        instagramHandle: amb.instagram_handle || '',
        twitterHandle: amb.twitter_handle || '',
        websiteUrl: amb.website_url || '',
        isFeatured: amb.is_featured || false,
        playerId: amb.player_id || '',
      });
    } else {
      setEditingAmbassador(null);
      setAmbForm({ displayName: '', bio: '', photo: '', youtubeUrl: '', tiktokUrl: '', instagramHandle: '', twitterHandle: '', websiteUrl: '', isFeatured: false, playerId: '' });
    }
    setAmbPlayerSearch('');
    setAmbPlayerResults([]);
    setShowAmbassadorModal(true);
  }, []);

  const handleSaveAmbassador = useCallback(async () => {
    if (!ambForm.displayName.trim()) { showAlert(fr ? 'Nom requis' : 'Name required'); return; }
    setAmbSaving(true);
    try {
      const payload: any = {
        display_name: ambForm.displayName.trim(),
        bio: ambForm.bio.trim() || null,
        photo: ambForm.photo || null,
        youtube_url: ambForm.youtubeUrl.trim() || null,
        tiktok_url: ambForm.tiktokUrl.trim() || null,
        instagram_handle: ambForm.instagramHandle.trim() || null,
        twitter_handle: ambForm.twitterHandle.trim() || null,
        website_url: ambForm.websiteUrl.trim() || null,
        is_featured: ambForm.isFeatured,
        player_id: ambForm.playerId || null,
        updated_at: new Date().toISOString(),
      };
      if (editingAmbassador) {
        const { error } = await supabase.from('ambassadors').update(payload).eq('id', editingAmbassador.id);
        if (error) throw error;
      } else {
        // Need a user_id — use the linked player's user_id or current admin
        let userId = user?.id;
        if (ambForm.playerId) {
          const { data: pl } = await supabase.from('players').select('user_id').eq('id', ambForm.playerId).single();
          if (pl?.user_id) userId = pl.user_id;
        }
        payload.user_id = userId;
        const { error } = await supabase.from('ambassadors').insert(payload);
        if (error) throw error;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAmbassadorModal(false);
      setAmbassadorsLoaded(false);
      invalidateAmbassadorCache();
      loadAmbassadors();
    } catch (e: any) {
      showAlert(fr ? 'Erreur' : 'Error', e.message);
    } finally { setAmbSaving(false); }
  }, [ambForm, editingAmbassador, supabase, user, fr, showAlert, loadAmbassadors]);

  const handleDeleteAmbassador = useCallback(async (id: string) => {
    showAlert(
      fr ? 'Supprimer cet ambassadeur ?' : 'Delete this ambassador?',
      fr ? 'Cette action est irreversible.' : 'This action cannot be undone.',
      [
        { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: fr ? 'Supprimer' : 'Delete', style: 'destructive', onPress: async () => {
          setAmbDeleting(id);
          const { error } = await supabase.from('ambassadors').delete().eq('id', id);
          setAmbDeleting(null);
          if (error) { showAlert(fr ? 'Erreur' : 'Error', error.message); }
          else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAmbassadors(prev => prev.filter(a => a.id !== id)); invalidateAmbassadorCache(); }
        }},
      ]
    );
  }, [supabase, fr, showAlert]);

  const handleToggleAmbassadorFeatured = useCallback(async (amb: any) => {
    Haptics.selectionAsync();
    const newVal = !amb.is_featured;
    setAmbassadors(prev => prev.map(a => a.id === amb.id ? { ...a, is_featured: newVal } : a));
    const { error } = await supabase.from('ambassadors').update({ is_featured: newVal, updated_at: new Date().toISOString() }).eq('id', amb.id);
    if (error) { setAmbassadors(prev => prev.map(a => a.id === amb.id ? { ...a, is_featured: amb.is_featured } : a)); showAlert(fr ? 'Erreur' : 'Error', error.message); }
    else { invalidateAmbassadorCache(); }
  }, [supabase, fr, showAlert]);

  // ===== MULTI-ACCOUNT STATE =====
  const [showMultiAccountSection, setShowMultiAccountSection] = React.useState(false);
  const [deviceClusters, setDeviceClusters] = React.useState<DeviceCluster[]>([]);
  const [multiAccountLoading, setMultiAccountLoading] = React.useState(false);
  const [multiAccountLoaded, setMultiAccountLoaded] = React.useState(false);
  const [deviceStats, setDeviceStats] = React.useState({ totalDevices: 0, totalRegistrations: 0, multiAccountDevices: 0 });

  const loadMultiAccounts = useCallback(async () => {
    if (multiAccountLoaded) return;
    setMultiAccountLoading(true);
    const [clustersRes, statsRes] = await Promise.all([
      fetchDeviceClusters(),
      getDeviceRegistrationStats(),
    ]);
    setDeviceClusters(clustersRes.clusters);
    if (!statsRes.error) setDeviceStats(statsRes);
    setMultiAccountLoading(false);
    setMultiAccountLoaded(true);
  }, [multiAccountLoaded]);

  const multiAccountCount = deviceClusters.length;

  // Export CSV
  const handleExportCSV = useCallback(async () => {
    if (promoCodes.length === 0) {
      showAlert(fr ? 'Aucune donnee' : 'No data', fr ? 'Aucun code promo a exporter.' : 'No promo codes to export.');
      return;
    }
    Haptics.selectionAsync();

    const headers = ['Code', fr ? 'Statut' : 'Status', fr ? 'Utilisations' : 'Uses', 'Max', fr ? 'Date creation' : 'Created', fr ? 'Expiration' : 'Expires'];
    const rows = promoCodes.map(p => {
      const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
      const isFull = p.current_uses >= p.max_uses;
      let status = p.is_active ? (isExpired ? (fr ? 'Expire' : 'Expired') : isFull ? (fr ? 'Epuise' : 'Exhausted') : (fr ? 'Actif' : 'Active')) : (fr ? 'Desactive' : 'Disabled');
      const created = new Date(p.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US');
      const expires = p.expires_at ? new Date(p.expires_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US') : (fr ? 'Jamais' : 'Never');
      return [p.code, status, String(p.current_uses), String(p.max_uses), created, expires];
    });

    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

    try {
      if (Platform.OS === 'web') {
        // Web: copy to clipboard
        const { Clipboard } = await import('react-native');
        // @ts-ignore
        if (Clipboard?.setString) { Clipboard.setString(csvContent); }
        showAlert(fr ? 'Copie !' : 'Copied!', fr ? 'CSV copie dans le presse-papiers.' : 'CSV copied to clipboard.');
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}promo_codes_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fr ? 'Exporter codes promo' : 'Export promo codes' });
      } else {
        showAlert(fr ? 'Erreur' : 'Error', fr ? 'Partage non disponible' : 'Sharing not available');
      }
    } catch (e: any) {
      showAlert(fr ? 'Erreur' : 'Error', e.message || 'Export failed');
    }
  }, [promoCodes, fr, showAlert]);

  // Load promo codes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (e: any) {
      console.log('Error loading promo codes:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  // Load last analysis from persistent storage
  useEffect(() => {
    AsyncStorage.getItem('@admin_last_analysis').then(stored => {
      if (stored) {
        try { setLastAnalysis(JSON.parse(stored)); } catch { /* silent */ }
      }
    });
  }, []);

  // Load redemptions for a specific code
  const loadRedemptions = useCallback(async (codeId: string) => {
    try {
      const { data, error } = await supabase
        .from('promo_code_redemptions')
        .select('*')
        .eq('promo_code_id', codeId)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails for each redemption
      const redemptionsWithEmails: Redemption[] = [];
      for (const r of (data || [])) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', r.user_id)
          .single();
        redemptionsWithEmails.push({
          ...r,
          user_email: profile?.email || r.user_id.slice(0, 8) + '...',
        });
      }
      setRedemptions(redemptionsWithEmails);
    } catch (e: any) {
      console.log('Error loading redemptions:', e);
      setRedemptions([]);
    }
  }, [supabase]);

  // Create promo code
  const handleCreate = useCallback(async () => {
    const code = newCode.trim().toUpperCase();
    if (!code) {
      showAlert(fr ? 'Erreur' : 'Error', fr ? 'Le code est requis' : 'Code is required');
      return;
    }
    const maxUses = parseInt(newMaxUses) || 1;
    Haptics.selectionAsync();
    setCreating(true);

    try {
      const insertData: any = {
        code,
        max_uses: maxUses,
        current_uses: 0,
        is_active: true,
      };

      if (newHasExpiry) {
        const days = parseInt(newExpiryDays) || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        insertData.expires_at = expiresAt.toISOString();
      }

      const { error } = await supabase.from('promo_codes').insert(insertData);

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          showAlert(fr ? 'Erreur' : 'Error', fr ? 'Ce code existe deja' : 'This code already exists');
        } else {
          showAlert(fr ? 'Erreur' : 'Error', error.message);
        }
        setCreating(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      setNewCode('');
      setNewMaxUses('1');
      setNewHasExpiry(false);
      setNewExpiryDays('30');
      await loadData();
    } catch (e: any) {
      showAlert(fr ? 'Erreur' : 'Error', e.message);
    } finally {
      setCreating(false);
    }
  }, [newCode, newMaxUses, newHasExpiry, newExpiryDays, supabase, fr, showAlert, loadData]);

  // Generate random alphanumeric string
  const generateRandomCode = useCallback((prefix: string, length: number = 6): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < length; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}-${suffix}` : suffix;
  }, []);

  // Bulk generate promo codes
  const handleBulkGenerate = useCallback(async () => {
    const prefix = bulkPrefix.trim().toUpperCase();
    const count = parseInt(bulkCount) || 10;
    const maxUses = parseInt(bulkMaxUses) || 1;

    if (count < 1 || count > 100) {
      showAlert(fr ? 'Erreur' : 'Error', fr ? 'La quantite doit etre entre 1 et 100' : 'Quantity must be between 1 and 100');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: count });

    try {
      let expiresAt: string | null = null;
      if (bulkHasExpiry) {
        const days = parseInt(bulkExpiryDays) || 30;
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      // Generate unique codes
      const existingCodes = new Set(promoCodes.map(p => p.code));
      const codes: string[] = [];
      let attempts = 0;
      while (codes.length < count && attempts < count * 10) {
        const code = generateRandomCode(prefix);
        if (!existingCodes.has(code) && !codes.includes(code)) {
          codes.push(code);
        }
        attempts++;
      }

      if (codes.length < count) {
        showAlert(fr ? 'Erreur' : 'Error', fr ? 'Impossible de generer assez de codes uniques' : 'Could not generate enough unique codes');
        setBulkGenerating(false);
        return;
      }

      // Insert in batches of 20
      const batchSize = 20;
      let inserted = 0;
      for (let i = 0; i < codes.length; i += batchSize) {
        const batch = codes.slice(i, i + batchSize).map(code => ({
          code,
          max_uses: maxUses,
          current_uses: 0,
          is_active: true,
          expires_at: expiresAt,
        }));

        const { error } = await supabase.from('promo_codes').insert(batch);
        if (error) {
          showAlert(fr ? 'Erreur' : 'Error', `${fr ? 'Erreur lot' : 'Batch error'} ${i + 1}: ${error.message}`);
          break;
        }
        inserted += batch.length;
        setBulkProgress({ current: inserted, total: count });
      }

      if (inserted > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert(
          fr ? 'Succes' : 'Success',
          fr ? `${inserted} codes promo generes avec le prefixe "${prefix}"` : `${inserted} promo codes generated with prefix "${prefix}"`
        );
        setShowBulkModal(false);
        setBulkPrefix('PROMO');
        setBulkCount('10');
        setBulkMaxUses('1');
        setBulkHasExpiry(false);
        setBulkExpiryDays('30');
        await loadData();
      }
    } catch (e: any) {
      showAlert(fr ? 'Erreur' : 'Error', e.message);
    } finally {
      setBulkGenerating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  }, [bulkPrefix, bulkCount, bulkMaxUses, bulkHasExpiry, bulkExpiryDays, supabase, fr, showAlert, loadData, promoCodes, generateRandomCode]);

  // Toggle active/inactive
  const handleToggleActive = useCallback(async (promo: PromoCode) => {
    Haptics.selectionAsync();
    const newActive = !promo.is_active;
    setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: newActive } : p));

    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', promo.id);

      if (error) throw error;
    } catch (e: any) {
      // Revert on error
      setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: promo.is_active } : p));
      showAlert(fr ? 'Erreur' : 'Error', e.message);
    }
  }, [supabase, fr, showAlert]);

  // View redemptions
  const handleViewRedemptions = useCallback((codeId: string) => {
    Haptics.selectionAsync();
    setSelectedCodeId(codeId);
    setShowRedemptionsModal(true);
    loadRedemptions(codeId);
  }, [loadRedemptions]);

  // Not admin guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{fr ? 'Codes promo' : 'Promo Codes'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="lock" size={56} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>{fr ? 'Acces refuse' : 'Access Denied'}</Text>
          <Text style={styles.emptyDesc}>{fr ? 'Cette page est reservee aux administrateurs.' : 'This page is restricted to administrators.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Stats summary
  const totalCodes = promoCodes.length;
  const activeCodes = promoCodes.filter(p => p.is_active).length;
  const totalRedemptions = promoCodes.reduce((sum, p) => sum + p.current_uses, 0);
  const expiredCodes = promoCodes.filter(p => p.expires_at && new Date(p.expires_at) < new Date()).length;

  const selectedCode = promoCodes.find(p => p.id === selectedCodeId);

  const renderPromoItem = ({ item: promo }: { item: PromoCode }) => {
    const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
    const usagePercent = promo.max_uses > 0 ? Math.round((promo.current_uses / promo.max_uses) * 100) : 0;
    const isFull = promo.current_uses >= promo.max_uses;

    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.promoCard}>
        <View style={styles.promoTopRow}>
          <View style={styles.promoCodeBadge}>
            <Text style={styles.promoCodeText}>{promo.code}</Text>
          </View>
          <Switch
            value={promo.is_active}
            onValueChange={() => handleToggleActive(promo)}
            trackColor={{ false: theme.border, true: theme.success + '60' }}
            thumbColor={promo.is_active ? theme.success : theme.textMuted}
          />
        </View>

        {/* Status badges */}
        <View style={styles.promoStatusRow}>
          {promo.is_active && !isExpired && !isFull ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.success + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.success }]}>{fr ? 'Actif' : 'Active'}</Text>
            </View>
          ) : null}
          {!promo.is_active ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.textMuted + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.textMuted }]} />
              <Text style={[styles.statusText, { color: theme.textMuted }]}>{fr ? 'Desactive' : 'Disabled'}</Text>
            </View>
          ) : null}
          {isExpired ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.error + '15' }]}>
              <MaterialIcons name="timer-off" size={12} color={theme.error} />
              <Text style={[styles.statusText, { color: theme.error }]}>{fr ? 'Expire' : 'Expired'}</Text>
            </View>
          ) : null}
          {isFull ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.warning + '15' }]}>
              <MaterialIcons name="block" size={12} color={theme.warning} />
              <Text style={[styles.statusText, { color: theme.warning }]}>{fr ? 'Epuise' : 'Exhausted'}</Text>
            </View>
          ) : null}
        </View>

        {/* Usage bar */}
        <View style={styles.usageSection}>
          <View style={styles.usageLabels}>
            <Text style={styles.usageLabel}>{fr ? 'Utilisations' : 'Uses'}</Text>
            <Text style={styles.usageCount}>{promo.current_uses} / {promo.max_uses}</Text>
          </View>
          <View style={styles.usageBarTrack}>
            <View style={[styles.usageBarFill, { width: `${Math.min(usagePercent, 100)}%`, backgroundColor: isFull ? theme.warning : theme.primary }]} />
          </View>
        </View>

        {/* Meta info */}
        <View style={styles.promoMetaRow}>
          <View style={styles.promoMetaItem}>
            <MaterialIcons name="event" size={14} color={theme.textMuted} />
            <Text style={styles.promoMetaText}>
              {new Date(promo.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          {promo.expires_at ? (
            <View style={styles.promoMetaItem}>
              <MaterialIcons name="timer" size={14} color={isExpired ? theme.error : theme.textMuted} />
              <Text style={[styles.promoMetaText, isExpired && { color: theme.error }]}>
                {fr ? 'Exp.' : 'Exp.'} {new Date(promo.expires_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          ) : (
            <View style={styles.promoMetaItem}>
              <MaterialIcons name="all-inclusive" size={14} color={theme.textMuted} />
              <Text style={styles.promoMetaText}>{fr ? 'Sans expiration' : 'No expiry'}</Text>
            </View>
          )}
        </View>

        {/* View redemptions button */}
        {promo.current_uses > 0 ? (
          <Pressable style={styles.viewRedemptionsBtn} onPress={() => handleViewRedemptions(promo.id)}>
            <MaterialIcons name="people" size={16} color={theme.primary} />
            <Text style={styles.viewRedemptionsBtnText}>
              {fr ? `Voir les ${promo.current_uses} utilisation(s)` : `View ${promo.current_uses} redemption(s)`}
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
          </Pressable>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{fr ? 'Codes promo' : 'Promo Codes'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Ambassador button */}
          <Pressable
            style={[styles.bulkBtn, ambassadors.length > 0 && { backgroundColor: '#7C3AED' + '15' }]}
            onPress={() => { Haptics.selectionAsync(); setShowAmbassadorSection(!showAmbassadorSection); if (!ambassadorsLoaded) { setAmbassadorsLoaded(false); loadAmbassadors(); } }}
          >
            <MaterialIcons name="verified" size={20} color={ambassadors.length > 0 ? '#7C3AED' : theme.primary} />
            {ambassadors.length > 0 ? (
              <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#7C3AED', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{ambassadors.length}</Text>
              </View>
            ) : null}
          </Pressable>
          {/* Multi-account button */}
          <Pressable
            style={[styles.bulkBtn, multiAccountCount > 0 && { backgroundColor: '#7C3AED' + '15' }]}
            onPress={() => { Haptics.selectionAsync(); setShowMultiAccountSection(!showMultiAccountSection); if (!multiAccountLoaded) loadMultiAccounts(); }}
          >
            <MaterialIcons name="devices" size={20} color={multiAccountCount > 0 ? '#7C3AED' : theme.primary} />
            {multiAccountCount > 0 ? (
              <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#7C3AED', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{multiAccountCount}</Text>
              </View>
            ) : null}
          </Pressable>
          {/* Detection button */}
          <Pressable
            style={[styles.bulkBtn, suspiciousFlaggedCount > 0 && { backgroundColor: '#F97316' + '15' }]}
            onPress={() => { Haptics.selectionAsync(); setShowDetectionSection(!showDetectionSection); if (!detectionLoaded) loadSuspicious(); }}
          >
            <MaterialIcons name="shield" size={20} color={suspiciousFlaggedCount > 0 ? '#F97316' : theme.primary} />
            {suspiciousFlaggedCount > 0 ? (
              <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#F97316', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{suspiciousFlaggedCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.bulkBtn, pendingReportsCount > 0 && { backgroundColor: theme.error + '15' }]}
            onPress={() => { Haptics.selectionAsync(); setShowReportsSection(!showReportsSection); if (!reportsLoaded) loadReports(); }}
          >
            <MaterialIcons name="flag" size={20} color={pendingReportsCount > 0 ? theme.error : theme.primary} />
            {pendingReportsCount > 0 ? (
              <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: theme.error, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{pendingReportsCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.bulkBtn} onPress={handleExportCSV}>
            <MaterialIcons name="file-download" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.bulkBtn} onPress={() => { Haptics.selectionAsync(); setShowBulkModal(true); }}>
            <MaterialIcons name="dynamic-feed" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => { Haptics.selectionAsync(); setShowCreateModal(true); }}>
            <MaterialIcons name="add" size={24} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={promoCodes}
          keyExtractor={item => item.id}
          renderItem={renderPromoItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Stats Cards */}
              <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.primary + '12' }]}>
                  <MaterialIcons name="confirmation-number" size={22} color={theme.primary} />
                  <Text style={[styles.statValue, { color: theme.primary }]}>{totalCodes}</Text>
                  <Text style={styles.statLabel}>{fr ? 'Total' : 'Total'}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.success + '12' }]}>
                  <MaterialIcons name="check-circle" size={22} color={theme.success} />
                  <Text style={[styles.statValue, { color: theme.success }]}>{activeCodes}</Text>
                  <Text style={styles.statLabel}>{fr ? 'Actifs' : 'Active'}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.accent + '12' }]}>
                  <MaterialIcons name="redeem" size={22} color={theme.accent} />
                  <Text style={[styles.statValue, { color: theme.accent }]}>{totalRedemptions}</Text>
                  <Text style={styles.statLabel}>{fr ? 'Utilises' : 'Redeemed'}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.error + '12' }]}>
                  <MaterialIcons name="timer-off" size={22} color={theme.error} />
                  <Text style={[styles.statValue, { color: theme.error }]}>{expiredCodes}</Text>
                  <Text style={styles.statLabel}>{fr ? 'Expires' : 'Expired'}</Text>
                </View>
              </Animated.View>

              {/* ===== LAST ANALYSIS SUMMARY ===== */}
              <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.analysisSummaryCard}>
                <View style={styles.analysisSummaryHeader}>
                  <View style={styles.analysisSummaryIcon}>
                    <MaterialIcons name="shield" size={20} color="#F97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analysisSummaryTitle}>{fr ? 'Anti-triche' : 'Anti-cheat'}</Text>
                    {lastAnalysis ? (
                      <Text style={styles.analysisSummaryDate}>
                        {fr ? 'Derniere analyse : ' : 'Last analysis: '}
                        {(() => {
                          const diff = Date.now() - new Date(lastAnalysis.date).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return fr ? 'a l\'instant' : 'just now';
                          if (mins < 60) return `${mins} min`;
                          const hours = Math.floor(mins / 60);
                          if (hours < 24) return `${hours}h`;
                          const days = Math.floor(hours / 24);
                          return `${days}${fr ? 'j' : 'd'}`;
                        })()}
                      </Text>
                    ) : (
                      <Text style={styles.analysisSummaryDate}>{fr ? 'Aucune analyse effectuee' : 'No analysis performed yet'}</Text>
                    )}
                  </View>
                  <Pressable
                    style={[styles.analysisSummaryBtn, runningAnalysis && { opacity: 0.6 }]}
                    onPress={() => {
                      if (!showDetectionSection) { setShowDetectionSection(true); if (!detectionLoaded) loadSuspicious(); }
                      handleRunAnalysis();
                    }}
                    disabled={runningAnalysis}
                  >
                    {runningAnalysis ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="radar" size={16} color="#FFF" />}
                    <Text style={styles.analysisSummaryBtnText}>{runningAnalysis ? (fr ? 'Analyse...' : 'Analyzing...') : (fr ? 'Analyser' : 'Analyze')}</Text>
                  </Pressable>
                </View>
                {lastAnalysis ? (
                  <View style={styles.analysisSummaryStats}>
                    <View style={styles.analysisSummaryStat}>
                      <Text style={styles.analysisSummaryStatValue}>{lastAnalysis.analyzed}</Text>
                      <Text style={styles.analysisSummaryStatLabel}>{fr ? 'Analyses' : 'Analyzed'}</Text>
                    </View>
                    <View style={styles.analysisSummaryStatDivider} />
                    <View style={styles.analysisSummaryStat}>
                      <Text style={[styles.analysisSummaryStatValue, lastAnalysis.flagged > 0 && { color: '#F97316' }]}>{lastAnalysis.flagged}</Text>
                      <Text style={styles.analysisSummaryStatLabel}>{fr ? 'Signales' : 'Flagged'}</Text>
                    </View>
                    <View style={styles.analysisSummaryStatDivider} />
                    <View style={styles.analysisSummaryStat}>
                      <Text style={[styles.analysisSummaryStatValue, lastAnalysis.suspicious > 0 && { color: theme.error }]}>{lastAnalysis.suspicious}</Text>
                      <Text style={styles.analysisSummaryStatLabel}>{fr ? 'Suspects' : 'Suspicious'}</Text>
                    </View>
                    {lastAnalysis.previousFlaggedCount > 0 && lastAnalysis.flagged > lastAnalysis.previousFlaggedCount ? (
                      <>
                        <View style={styles.analysisSummaryStatDivider} />
                        <View style={styles.analysisSummaryStat}>
                          <Text style={[styles.analysisSummaryStatValue, { color: theme.error }]}>+{lastAnalysis.flagged - lastAnalysis.previousFlaggedCount}</Text>
                          <Text style={styles.analysisSummaryStatLabel}>{fr ? 'Nouveaux' : 'New'}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.analysisSummaryEmpty}>
                    <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                    <Text style={styles.analysisSummaryEmptyText}>
                      {fr ? 'Lancez une premiere analyse pour scanner les joueurs publics et detecter les comportements suspects.' : 'Run a first analysis to scan public players and detect suspicious behavior.'}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* ===== AMBASSADORS SECTION ===== */}
              {showAmbassadorSection ? (
                <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#7C3AED' + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="verified" size={18} color="#7C3AED" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary, flex: 1 }}>
                      {fr ? 'AMBASSADEURS' : 'AMBASSADORS'} ({ambassadors.length})
                    </Text>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                      onPress={() => handleOpenAmbassadorForm()}
                    >
                      <MaterialIcons name="add" size={14} color="#FFF" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>{fr ? 'Ajouter' : 'Add'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowAmbassadorSection(false)} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Analytics period filter */}
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                    {([
                      { key: 'today' as const, label: fr ? "Aujourd'hui" : 'Today' },
                      { key: '7d' as const, label: fr ? '7 jours' : '7 days' },
                      { key: '30d' as const, label: fr ? '30 jours' : '30 days' },
                      { key: 'all' as const, label: fr ? 'Tout' : 'All' },
                    ]).map(f => {
                      const isActive = analyticsPeriod === f.key;
                      return (
                        <Pressable
                          key={f.key}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                            backgroundColor: isActive ? '#7C3AED' : theme.backgroundSecondary,
                            borderWidth: 1.5, borderColor: isActive ? '#7C3AED' : theme.border,
                          }}
                          onPress={() => { setAnalyticsPeriod(f.key); reloadAnalytics(f.key); }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#FFF' : theme.textSecondary }}>{f.label}</Text>
                        </Pressable>
                      );
                    })}
                    {analyticsLoading ? <ActivityIndicator size="small" color="#7C3AED" style={{ marginLeft: 4 }} /> : null}
                  </View>

                  {ambassadorsLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                      <ActivityIndicator size="large" color="#7C3AED" />
                    </View>
                  ) : ambassadors.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.surface, borderRadius: 16, padding: 20 }}>
                      <MaterialIcons name="verified" size={40} color={theme.textMuted} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 8 }}>{fr ? 'Aucun ambassadeur' : 'No ambassadors'}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>
                        {fr ? 'Ajoutez votre premier ambassadeur pour le mettre en avant dans l\'app.' : 'Add your first ambassador to feature them in the app.'}
                      </Text>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
                        onPress={() => handleOpenAmbassadorForm()}
                      >
                        <MaterialIcons name="add" size={18} color="#FFF" />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{fr ? 'Ajouter un ambassadeur' : 'Add an ambassador'}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    ambassadors.map((amb) => (
                      <View key={amb.id} style={[styles.promoCard, { borderLeftWidth: 3, borderLeftColor: '#7C3AED' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          {amb.photo ? (
                            <Image source={{ uri: amb.photo }} style={{ width: 48, height: 48, borderRadius: 16 }} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                          ) : (
                            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#7C3AED' + '20', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: '#7C3AED' }}>{(amb.display_name || '?').charAt(0)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>{amb.display_name}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#7C3AED' + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                <MaterialIcons name="verified" size={10} color="#7C3AED" />
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#7C3AED' }}>AMB</Text>
                              </View>
                            </View>
                            {amb.bio ? <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>{amb.bio}</Text> : null}
                          </View>
                          <Switch
                            value={amb.is_featured}
                            onValueChange={() => handleToggleAmbassadorFeatured(amb)}
                            trackColor={{ false: theme.border, true: '#7C3AED' + '60' }}
                            thumbColor={amb.is_featured ? '#7C3AED' : theme.textMuted}
                          />
                        </View>

                        {/* Social links summary */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {amb.is_featured ? (
                            <View style={{ backgroundColor: '#7C3AED' + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>{fr ? 'En vedette' : 'Featured'}</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: theme.textMuted + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted }}>{fr ? 'Standard' : 'Standard'}</Text>
                            </View>
                          )}
                          {amb.youtube_url ? <View style={{ backgroundColor: '#FF0000' + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: '#FF0000' }}>YouTube</Text></View> : null}
                          {amb.tiktok_url ? <View style={{ backgroundColor: '#000' + '08', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: '#000' }}>TikTok</Text></View> : null}
                          {amb.instagram_handle ? <View style={{ backgroundColor: '#E4405F' + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: '#E4405F' }}>@{amb.instagram_handle.replace('@', '')}</Text></View> : null}
                          {amb.twitter_handle ? <View style={{ backgroundColor: '#1DA1F2' + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: '#1DA1F2' }}>{amb.twitter_handle}</Text></View> : null}
                          {amb.website_url ? <View style={{ backgroundColor: theme.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary }}>Web</Text></View> : null}
                          {amb.player_id ? <View style={{ backgroundColor: theme.success + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontWeight: '600', color: theme.success }}>{fr ? 'Joueur lie' : 'Linked player'}</Text></View> : null}
                        </View>

                        {/* Sparkline */}
                        {(() => {
                          const daily = sparklineData.get(amb.id);
                          if (!daily || daily.length < 2 || daily.every(d => d === 0)) return null;
                          const max = Math.max(...daily, 1);
                          const w = 220;
                          const h = 32;
                          const step = w / (daily.length - 1);
                          const pts = daily.map((val, i) => {
                            const x = i * step;
                            const y = h - (val / max) * (h - 4) - 2;
                            return `${x},${y}`;
                          });
                          const lineD = `M${pts.join(' L')}`;
                          const areaD = `${lineD} L${w},${h} L0,${h} Z`;
                          const total30d = daily.reduce((a, b) => a + b, 0);
                          return (
                            <View style={{ marginBottom: 10, backgroundColor: '#7C3AED' + '04', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#7C3AED' + '08' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <MaterialIcons name="show-chart" size={11} color="#7C3AED" />
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.3 }}>{fr ? 'Activite 30j' : '30d Activity'}</Text>
                                </View>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C3AED' }}>{total30d} {fr ? 'events' : 'events'}</Text>
                              </View>
                              <Svg width={w} height={h}>
                                <SvgPath d={areaD} fill="#7C3AED" opacity={0.08} />
                                <SvgPath d={lineD} stroke="#7C3AED" strokeWidth={1.5} fill="none" opacity={0.6} />
                              </Svg>
                            </View>
                          );
                        })()}

                        {/* Analytics stats */}
                        {(() => {
                          const analytics = ambassadorAnalytics.get(amb.id);
                          return (
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, backgroundColor: '#7C3AED' + '06', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#7C3AED' + '12' }}>
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                  <MaterialIcons name="visibility" size={12} color="#7C3AED" />
                                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{analytics?.bannerImpressions || 0}</Text>
                                </View>
                                <Text style={{ fontSize: 8, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase' }}>Impr.</Text>
                              </View>
                              <View style={{ width: 1, backgroundColor: '#7C3AED' + '15', height: 28, alignSelf: 'center' }} />
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                  <MaterialIcons name="person" size={12} color={theme.primary} />
                                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{analytics?.profileViews || 0}</Text>
                                </View>
                                <Text style={{ fontSize: 8, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase' }}>{fr ? 'Vues' : 'Views'}</Text>
                              </View>
                              <View style={{ width: 1, backgroundColor: '#7C3AED' + '15', height: 28, alignSelf: 'center' }} />
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                  <MaterialIcons name="touch-app" size={12} color={theme.success} />
                                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.success }}>{analytics?.socialClicks || 0}</Text>
                                </View>
                                <Text style={{ fontSize: 8, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase' }}>{fr ? 'Clics' : 'Clicks'}</Text>
                              </View>
                              {analytics && analytics.socialClicks > 0 ? (
                                <>
                                  <View style={{ width: 1, backgroundColor: '#7C3AED' + '15', height: 28, alignSelf: 'center' }} />
                                  <View style={{ flex: 1.5, justifyContent: 'center', paddingLeft: 4 }}>
                                    {Object.entries(analytics.socialBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([platform, count]) => (
                                      <View key={platform} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'capitalize' }}>{platform}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: theme.textPrimary }}>{count}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </>
                              ) : null}
                            </View>
                          );
                        })()}

                        {/* Actions */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: '#7C3AED' + '12' }}
                            onPress={() => handleOpenAmbassadorForm(amb)}
                          >
                            <MaterialIcons name="edit" size={14} color="#7C3AED" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>{fr ? 'Modifier' : 'Edit'}</Text>
                          </Pressable>
                          <Pressable
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.error + '12' }}
                            onPress={() => handleDeleteAmbassador(amb.id)}
                            disabled={ambDeleting === amb.id}
                          >
                            {ambDeleting === amb.id ? <ActivityIndicator size="small" color={theme.error} /> : <MaterialIcons name="delete" size={14} color={theme.error} />}
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>{fr ? 'Supprimer' : 'Delete'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </Animated.View>
              ) : null}

              {/* Multi-Account Detection Section */}
              {showMultiAccountSection ? (
                <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#7C3AED' + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="devices" size={18} color="#7C3AED" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary, flex: 1 }}>
                      {fr ? 'MULTI-COMPTES' : 'MULTI-ACCOUNTS'} ({deviceClusters.length})
                    </Text>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                      onPress={() => { setMultiAccountLoaded(false); loadMultiAccounts(); }}
                    >
                      <MaterialIcons name="refresh" size={14} color="#FFF" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>{fr ? 'Rafraichir' : 'Refresh'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowMultiAccountSection(false)} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Device stats */}
                  {multiAccountLoaded ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1, backgroundColor: '#7C3AED' + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{deviceStats.totalDevices}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Appareils' : 'Devices'}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: theme.primary + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{deviceStats.totalRegistrations}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Inscriptions' : 'Signups'}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: (deviceStats.multiAccountDevices > 0 ? theme.error : theme.success) + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: deviceStats.multiAccountDevices > 0 ? theme.error : theme.success }}>{deviceStats.multiAccountDevices}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Partages' : 'Shared'}</Text>
                      </View>
                    </View>
                  ) : null}

                  {multiAccountLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                      <ActivityIndicator size="large" color="#7C3AED" />
                    </View>
                  ) : deviceClusters.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.surface, borderRadius: 16, padding: 20 }}>
                      <MaterialIcons name="verified-user" size={40} color={theme.success} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 8 }}>{fr ? 'Aucun multi-compte detecte' : 'No multi-accounts detected'}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>{fr ? 'Aucun appareil ne partage plusieurs comptes.' : 'No device shares multiple accounts.'}</Text>
                    </View>
                  ) : (
                    deviceClusters.map((cluster, ci) => {
                      const isHighRisk = cluster.accounts.length >= 3;
                      const riskColor = isHighRisk ? theme.error : '#F97316';
                      return (
                        <View key={ci} style={[styles.promoCard, { borderLeftWidth: 3, borderLeftColor: riskColor }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: riskColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialIcons name="devices" size={18} color={riskColor} />
                              </View>
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                                  {cluster.accounts.length} {fr ? 'comptes' : 'accounts'}
                                </Text>
                                <Text style={{ fontSize: 10, color: theme.textMuted, fontFamily: 'monospace' }}>
                                  {cluster.fingerprint.slice(0, 17)}
                                </Text>
                              </View>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: riskColor + '15' }]}>
                              <View style={[styles.statusDot, { backgroundColor: riskColor }]} />
                              <Text style={[styles.statusText, { color: riskColor }]}>
                                {isHighRisk ? (fr ? 'Risque eleve' : 'High risk') : (fr ? 'A surveiller' : 'Watch')}
                              </Text>
                            </View>
                          </View>

                          {/* Account list */}
                          {cluster.accounts.map((acc, ai) => (
                            <View key={ai} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: ai === 0 ? 1 : 0, borderTopColor: theme.border + '60' }}>
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialIcons name="person" size={14} color={theme.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }} numberOfLines={1}>{acc.email}</Text>
                                <Text style={{ fontSize: 10, color: theme.textMuted }}>
                                  {new Date(acc.registeredAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                              </View>
                              {ai === 0 ? (
                                <View style={{ backgroundColor: theme.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.primary }}>{fr ? 'Premier' : 'First'}</Text>
                                </View>
                              ) : (
                                <View style={{ backgroundColor: riskColor + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: riskColor }}>+{ai}</Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      );
                    })
                  )}
                </Animated.View>
              ) : null}

              {/* Detection Section */}
              {showDetectionSection ? (
                <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F97316' + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="shield" size={18} color="#F97316" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary, flex: 1 }}>
                      {fr ? 'DETECTION AUTOMATIQUE' : 'AUTO DETECTION'} ({suspiciousPlayers.length})
                    </Text>
                    <Pressable
                      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F97316', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }, runningAnalysis && { opacity: 0.6 }]}
                      onPress={handleRunAnalysis}
                      disabled={runningAnalysis}
                    >
                      {runningAnalysis ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="radar" size={14} color="#FFF" />}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>
                        {runningAnalysis ? (fr ? 'Analyse...' : 'Analyzing...') : (fr ? 'Analyser' : 'Analyze')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setShowDetectionSection(false)} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Analysis result */}
                  {analysisResult ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1, backgroundColor: theme.primary + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{analysisResult.analyzed}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Analyses' : 'Analyzed'}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#F97316' + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#F97316' }}>{analysisResult.flagged}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Signales' : 'Flagged'}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: theme.error + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.error }}>{analysisResult.suspicious}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textMuted }}>{fr ? 'Suspects' : 'Suspicious'}</Text>
                      </View>
                    </View>
                  ) : null}

                  {detectionLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                      <ActivityIndicator size="large" color="#F97316" />
                    </View>
                  ) : suspiciousPlayers.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.surface, borderRadius: 16, padding: 20 }}>
                      <MaterialIcons name="verified-user" size={40} color={theme.success} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 8 }}>{fr ? 'Aucun joueur suspect' : 'No suspicious players'}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>{fr ? 'Lancez une analyse pour scanner les comportements suspects.' : 'Run an analysis to scan for suspicious behavior.'}</Text>
                    </View>
                  ) : (
                    suspiciousPlayers.map((sp) => {
                      const tsColor = getTrustScoreColor(sp.trustScore);
                      const statusLabels: Record<string, string> = {
                        flagged: fr ? 'Signale' : 'Flagged',
                        watch: fr ? 'Surveillance' : 'Watch',
                        ok: 'OK',
                        cleared: fr ? 'Blanchi' : 'Cleared',
                      };
                      return (
                        <View key={sp.id} style={[styles.promoCard, { borderLeftWidth: 3, borderLeftColor: tsColor }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tsColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: '900', color: tsColor }}>{sp.trustScore}</Text>
                              </View>
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>{sp.playerName || sp.playerId.slice(0, 8)}</Text>
                                <Text style={{ fontSize: 10, color: theme.textMuted }}>{statusLabels[sp.status] || sp.status}</Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 10, color: theme.textMuted }}>
                              {new Date(sp.analyzedAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                            </Text>
                          </View>

                          {/* Flags */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {sp.flags.map((flag: string, fi: number) => (
                              <View key={fi} style={{ backgroundColor: tsColor + '10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: tsColor }}>{flag.replace(/_/g, ' ')}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Details */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                            {sp.details.sharedDeviceAccounts !== undefined ? (
                              <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>
                                <MaterialIcons name="devices" size={11} color="#7C3AED" /> {sp.details.sharedDeviceAccounts} {fr ? 'autres comptes' : 'other accounts'}
                              </Text>
                            ) : null}
                            {sp.details.matchesPlayed !== undefined ? (
                              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{sp.details.matchesPlayed} matchs</Text>
                            ) : null}
                            {sp.details.uniqueOpponents !== undefined ? (
                              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{sp.details.uniqueOpponents} {fr ? 'adv.' : 'opp.'}</Text>
                            ) : null}
                            {sp.details.maxMatchesPerDay !== undefined ? (
                              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{sp.details.maxMatchesPerDay} {fr ? 'matchs/jour' : 'matches/day'}</Text>
                            ) : null}
                            {sp.details.accountAgeDays !== undefined ? (
                              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{sp.details.accountAgeDays}j</Text>
                            ) : null}
                          </View>

                          {/* Actions */}
                          {sp.status !== 'cleared' ? (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <Pressable
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.success + '12' }}
                                onPress={() => handleUpdateSuspiciousStatus(sp.id, 'cleared')}
                                disabled={updatingSuspicious === sp.id}
                              >
                                <MaterialIcons name="verified-user" size={14} color={theme.success} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.success }}>{fr ? 'Blanchir' : 'Clear'}</Text>
                              </Pressable>
                              <Pressable
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.error + '12' }}
                                onPress={() => handleUpdateSuspiciousStatus(sp.id, 'flagged')}
                                disabled={updatingSuspicious === sp.id}
                              >
                                <MaterialIcons name="gavel" size={14} color={theme.error} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>{fr ? 'Signaler' : 'Flag'}</Text>
                              </Pressable>
                              <Pressable
                                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: theme.backgroundSecondary }}
                                onPress={() => router.push(`/player/${sp.playerId}` as any)}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{fr ? 'Voir' : 'View'}</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <MaterialIcons name="check-circle" size={14} color={theme.success} />
                              <Text style={{ fontSize: 12, color: theme.success, fontWeight: '600' }}>{fr ? 'Blanchi' : 'Cleared'}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </Animated.View>
              ) : null}

              {/* Reports Section */}
              {showReportsSection ? (
                <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.error + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="flag" size={18} color={theme.error} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary, flex: 1 }}>
                      {fr ? 'SIGNALEMENTS' : 'REPORTS'} ({reports.length})
                    </Text>
                    <Pressable onPress={() => setShowReportsSection(false)} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  {reportsLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                      <ActivityIndicator size="large" color={theme.error} />
                    </View>
                  ) : reports.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.surface, borderRadius: 16, padding: 20 }}>
                      <MaterialIcons name="check-circle" size={40} color={theme.success} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 8 }}>{fr ? 'Aucun signalement' : 'No reports'}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{fr ? 'Aucun signalement de joueur pour le moment.' : 'No player reports at the moment.'}</Text>
                    </View>
                  ) : (
                    reports.map((report) => {
                      const statusColors: Record<string, string> = {
                        pending: theme.warning, reviewed: theme.primary,
                        dismissed: theme.textMuted, action_taken: theme.error,
                      };
                      const statusLabels: Record<string, string> = {
                        pending: fr ? 'En attente' : 'Pending',
                        reviewed: fr ? 'Traite' : 'Reviewed',
                        dismissed: fr ? 'Rejete' : 'Dismissed',
                        action_taken: fr ? 'Action prise' : 'Action taken',
                      };
                      const reasonLabels: Record<string, string> = {
                        fake_stats: fr ? 'Stats frauduleuses' : 'Fake stats',
                        multiple_accounts: fr ? 'Multi-comptes' : 'Multi-accounts',
                        inappropriate_content: fr ? 'Contenu inapproprie' : 'Inappropriate',
                        spam: 'Spam',
                        other: fr ? 'Autre' : 'Other',
                      };
                      const sc = statusColors[report.status] || theme.textMuted;
                      return (
                        <View key={report.id} style={[styles.promoCard, { borderLeftWidth: 3, borderLeftColor: sc }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={[styles.statusBadge, { backgroundColor: sc + '15' }]}>
                              <View style={[styles.statusDot, { backgroundColor: sc }]} />
                              <Text style={[styles.statusText, { color: sc }]}>{statusLabels[report.status]}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>
                              {new Date(report.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <View style={{ backgroundColor: theme.error + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>{reasonLabels[report.reason] || report.reason}</Text>
                            </View>
                          </View>

                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 }}>
                            {fr ? 'Joueur :' : 'Player:'} {report.reported_player_name || report.reported_player_id.slice(0, 8)}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                            {fr ? 'Par :' : 'By:'} {report.reporter_email || report.reporter_id.slice(0, 8)}
                          </Text>
                          {report.details ? (
                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', marginBottom: 8 }}>
                              "{report.details}"
                            </Text>
                          ) : null}

                          {report.status === 'pending' ? (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <Pressable
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.primary + '12' }}
                                onPress={() => handleUpdateReportStatus(report.id, 'reviewed')}
                                disabled={updatingReport === report.id}
                              >
                                <MaterialIcons name="check" size={14} color={theme.primary} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{fr ? 'Traite' : 'Reviewed'}</Text>
                              </Pressable>
                              <Pressable
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.textMuted + '12' }}
                                onPress={() => handleUpdateReportStatus(report.id, 'dismissed')}
                                disabled={updatingReport === report.id}
                              >
                                <MaterialIcons name="close" size={14} color={theme.textMuted} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted }}>{fr ? 'Rejeter' : 'Dismiss'}</Text>
                              </Pressable>
                              <Pressable
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.error + '12' }}
                                onPress={() => handleUpdateReportStatus(report.id, 'action_taken')}
                                disabled={updatingReport === report.id}
                              >
                                <MaterialIcons name="gavel" size={14} color={theme.error} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>{fr ? 'Action' : 'Action'}</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </Animated.View>
              ) : null}

              <Text style={styles.sectionTitle}>
                {fr ? 'TOUS LES CODES' : 'ALL CODES'} ({totalCodes})
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <MaterialIcons name="confirmation-number" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{fr ? 'Aucun code promo' : 'No promo codes'}</Text>
              <Text style={styles.emptyDesc}>{fr ? 'Creez votre premier code promo.' : 'Create your first promo code.'}</Text>
            </View>
          }
        />
      )}

      {/* Create Promo Code Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="add-circle" size={22} color={theme.carreauColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{fr ? 'Nouveau code promo' : 'New Promo Code'}</Text>
                <Text style={styles.modalSubtitle}>{fr ? 'Creez un code pour debloquer le premium' : 'Create a code to unlock premium'}</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowCreateModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Code */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Code' : 'Code'} *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newCode}
                  onChangeText={setNewCode}
                  placeholder="Ex: PREMIUM2026"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              {/* Max uses */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Utilisations max' : 'Max uses'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={newMaxUses}
                  onChangeText={setNewMaxUses}
                  placeholder="1"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              {/* Expiry toggle */}
              <View style={styles.formToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>{fr ? 'Date d\'expiration' : 'Expiry date'}</Text>
                  <Text style={styles.formHint}>{fr ? 'Le code expirera apres ce delai' : 'Code expires after this period'}</Text>
                </View>
                <Switch
                  value={newHasExpiry}
                  onValueChange={setNewHasExpiry}
                  trackColor={{ false: theme.border, true: theme.primary + '60' }}
                  thumbColor={newHasExpiry ? theme.primary : theme.textMuted}
                />
              </View>

              {newHasExpiry ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{fr ? 'Expire dans (jours)' : 'Expires in (days)'}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExpiryDays}
                    onChangeText={setNewExpiryDays}
                    placeholder="30"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>{fr ? 'Annuler' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreateBtn, (!newCode.trim() || creating) && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!newCode.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="add" size={18} color="#FFF" />
                    <Text style={styles.modalCreateText}>{fr ? 'Creer' : 'Create'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Generate Modal */}
      <Modal visible={showBulkModal} animationType="slide" transparent onRequestClose={() => { if (!bulkGenerating) setShowBulkModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="dynamic-feed" size={22} color={theme.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{fr ? 'Generation en lot' : 'Bulk Generate'}</Text>
                <Text style={styles.modalSubtitle}>{fr ? 'Creer plusieurs codes en une action' : 'Create multiple codes at once'}</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => { if (!bulkGenerating) setShowBulkModal(false); }}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Preview */}
              <View style={styles.bulkPreview}>
                <MaterialIcons name="visibility" size={16} color={theme.primary} />
                <Text style={styles.bulkPreviewLabel}>{fr ? 'Apercu :' : 'Preview:'}</Text>
                <Text style={styles.bulkPreviewCode}>
                  {bulkPrefix.trim().toUpperCase() ? `${bulkPrefix.trim().toUpperCase()}-A3X7K9` : 'A3X7K9'}
                </Text>
              </View>

              {/* Prefix */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Prefixe' : 'Prefix'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={bulkPrefix}
                  onChangeText={setBulkPrefix}
                  placeholder="PROMO"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!bulkGenerating}
                />
                <Text style={styles.formHint}>{fr ? 'Les codes seront PREFIXE-XXXXXX' : 'Codes will be PREFIX-XXXXXX'}</Text>
              </View>

              {/* Quantity */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Quantite' : 'Quantity'} *</Text>
                <View style={styles.bulkQuantityRow}>
                  {['5', '10', '25', '50'].map(q => (
                    <Pressable
                      key={q}
                      style={[styles.bulkQuantityChip, bulkCount === q && styles.bulkQuantityChipActive]}
                      onPress={() => { if (!bulkGenerating) setBulkCount(q); }}
                    >
                      <Text style={[styles.bulkQuantityChipText, bulkCount === q && styles.bulkQuantityChipTextActive]}>{q}</Text>
                    </Pressable>
                  ))}
                  <TextInput
                    style={styles.bulkQuantityInput}
                    value={bulkCount}
                    onChangeText={setBulkCount}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={theme.textMuted}
                    editable={!bulkGenerating}
                  />
                </View>
              </View>

              {/* Max uses per code */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Utilisations max / code' : 'Max uses / code'}</Text>
                <TextInput
                  style={styles.formInput}
                  value={bulkMaxUses}
                  onChangeText={setBulkMaxUses}
                  placeholder="1"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  editable={!bulkGenerating}
                />
              </View>

              {/* Expiry toggle */}
              <View style={styles.formToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>{fr ? 'Date d\'expiration' : 'Expiry date'}</Text>
                  <Text style={styles.formHint}>{fr ? 'Tous les codes expireront apres ce delai' : 'All codes will expire after this period'}</Text>
                </View>
                <Switch
                  value={bulkHasExpiry}
                  onValueChange={(v) => { if (!bulkGenerating) setBulkHasExpiry(v); }}
                  trackColor={{ false: theme.border, true: theme.primary + '60' }}
                  thumbColor={bulkHasExpiry ? theme.primary : theme.textMuted}
                />
              </View>

              {bulkHasExpiry ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{fr ? 'Expire dans (jours)' : 'Expires in (days)'}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={bulkExpiryDays}
                    onChangeText={setBulkExpiryDays}
                    placeholder="30"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    editable={!bulkGenerating}
                  />
                </View>
              ) : null}

              {/* Summary */}
              <View style={styles.bulkSummary}>
                <MaterialIcons name="info-outline" size={16} color={theme.primary} />
                <Text style={styles.bulkSummaryText}>
                  {fr
                    ? `${parseInt(bulkCount) || 0} codes \u00d7 ${parseInt(bulkMaxUses) || 1} utilisation(s) = ${(parseInt(bulkCount) || 0) * (parseInt(bulkMaxUses) || 1)} activations premium max`
                    : `${parseInt(bulkCount) || 0} codes \u00d7 ${parseInt(bulkMaxUses) || 1} use(s) = ${(parseInt(bulkCount) || 0) * (parseInt(bulkMaxUses) || 1)} max premium activations`}
                </Text>
              </View>
            </ScrollView>

            {/* Progress bar during generation */}
            {bulkGenerating ? (
              <View style={styles.bulkProgressContainer}>
                <View style={styles.bulkProgressTrack}>
                  <View style={[styles.bulkProgressFill, { width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }]} />
                </View>
                <Text style={styles.bulkProgressText}>
                  {bulkProgress.current}/{bulkProgress.total} {fr ? 'codes crees...' : 'codes created...'}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => { if (!bulkGenerating) setShowBulkModal(false); }} disabled={bulkGenerating}>
                <Text style={[styles.modalCancelText, bulkGenerating && { opacity: 0.4 }]}>{fr ? 'Annuler' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreateBtn, { backgroundColor: theme.success }, (!(parseInt(bulkCount) > 0) || bulkGenerating) && { opacity: 0.5 }]}
                onPress={handleBulkGenerate}
                disabled={!(parseInt(bulkCount) > 0) || bulkGenerating}
              >
                {bulkGenerating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="auto-awesome" size={18} color="#FFF" />
                    <Text style={styles.modalCreateText}>
                      {fr ? `Generer ${parseInt(bulkCount) || 0} codes` : `Generate ${parseInt(bulkCount) || 0} codes`}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ambassador Form Modal */}
      <Modal visible={showAmbassadorModal} animationType="slide" transparent onRequestClose={() => { if (!ambSaving) setShowAmbassadorModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: '#7C3AED' + '15' }]}>
                <MaterialIcons name="verified" size={22} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{editingAmbassador ? (fr ? 'Modifier ambassadeur' : 'Edit Ambassador') : (fr ? 'Nouvel ambassadeur' : 'New Ambassador')}</Text>
                <Text style={styles.modalSubtitle}>{fr ? 'Profil enrichi visible dans l\'app' : 'Enhanced profile visible in the app'}</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => { if (!ambSaving) setShowAmbassadorModal(false); }}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              {/* Photo */}
              <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
                <Pressable onPress={handlePickAmbassadorPhoto} disabled={ambUploadingPhoto}>
                  {ambUploadingPhoto ? (
                    <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#7C3AED' + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="large" color="#7C3AED" />
                    </View>
                  ) : ambForm.photo ? (
                    <View style={{ position: 'relative' }}>
                      <Image source={{ uri: ambForm.photo }} style={{ width: 80, height: 80, borderRadius: 24 }} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                      <View style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.surface }}>
                        <MaterialIcons name="camera-alt" size={12} color="#FFF" />
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#7C3AED' + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#7C3AED' + '30', borderStyle: 'dashed' as any }}>
                      <MaterialIcons name="camera-alt" size={28} color="#7C3AED" />
                    </View>
                  )}
                </Pressable>
                {ambForm.photo ? (
                  <Pressable onPress={() => setAmbForm(prev => ({ ...prev, photo: '' }))} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: theme.error, fontWeight: '600' }}>{fr ? 'Supprimer la photo' : 'Remove photo'}</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Display name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Nom affiche' : 'Display name'} *</Text>
                <TextInput style={styles.formInput} value={ambForm.displayName} onChangeText={(v) => setAmbForm(prev => ({ ...prev, displayName: v }))} placeholder="Ex: Marco Pétanque" placeholderTextColor={theme.textMuted} autoCapitalize="words" />
              </View>

              {/* Bio */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bio</Text>
                <TextInput style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 }]} value={ambForm.bio} onChangeText={(v) => setAmbForm(prev => ({ ...prev, bio: v }))} placeholder={fr ? 'Courte description...' : 'Short description...'} placeholderTextColor={theme.textMuted} multiline numberOfLines={3} />
              </View>

              {/* Link to player */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{fr ? 'Lier a un joueur' : 'Link to player'}</Text>
                {ambForm.playerId ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.success + '10', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.success + '30' }}>
                    <MaterialIcons name="person" size={20} color={theme.success} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>{ambForm.playerId.slice(0, 8)}...</Text>
                    <Pressable onPress={() => setAmbForm(prev => ({ ...prev, playerId: '' }))} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border }}>
                      <MaterialIcons name="search" size={18} color={theme.textMuted} />
                      <TextInput
                        style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }}
                        value={ambPlayerSearch}
                        onChangeText={handleSearchPlayers}
                        placeholder={fr ? 'Rechercher un joueur...' : 'Search a player...'}
                        placeholderTextColor={theme.textMuted}
                      />
                      {ambSearching ? <ActivityIndicator size="small" color={theme.primary} /> : null}
                    </View>
                    {ambPlayerResults.length > 0 ? (
                      <View style={{ backgroundColor: theme.surface, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: theme.border, maxHeight: 180 }}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {ambPlayerResults.map((pl) => (
                            <Pressable
                              key={pl.id}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' }}
                              onPress={() => {
                                setAmbForm(prev => ({ ...prev, playerId: pl.id, displayName: prev.displayName || pl.name }));
                                setAmbPlayerResults([]);
                                setAmbPlayerSearch('');
                                Haptics.selectionAsync();
                              }}
                            >
                              {pl.avatar ? (
                                <Image source={{ uri: pl.avatar }} style={{ width: 32, height: 32, borderRadius: 10 }} contentFit="cover" cachePolicy="memory-disk" />
                              ) : (
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>{pl.name.charAt(0)}</Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>{pl.name}</Text>
                                <Text style={{ fontSize: 11, color: theme.textMuted }}>{pl.role}{pl.club ? ` \u2022 ${pl.club}` : ''}</Text>
                              </View>
                              <MaterialIcons name="add-circle-outline" size={20} color={theme.primary} />
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              {/* Social links */}
              <Text style={[styles.formLabel, { marginTop: 16, marginBottom: 4 }]}>{fr ? 'Reseaux sociaux' : 'Social links'}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 8 }}>
                <MaterialIcons name="play-arrow" size={20} color="#FF0000" />
                <TextInput style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }} value={ambForm.youtubeUrl} onChangeText={(v) => setAmbForm(prev => ({ ...prev, youtubeUrl: v }))} placeholder="https://youtube.com/@..." placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 8 }}>
                <MaterialIcons name="music-note" size={20} color="#000" />
                <TextInput style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }} value={ambForm.tiktokUrl} onChangeText={(v) => setAmbForm(prev => ({ ...prev, tiktokUrl: v }))} placeholder="https://tiktok.com/@..." placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 8 }}>
                <MaterialIcons name="camera-alt" size={20} color="#E4405F" />
                <TextInput style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }} value={ambForm.instagramHandle} onChangeText={(v) => setAmbForm(prev => ({ ...prev, instagramHandle: v }))} placeholder="@username" placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 8 }}>
                <MaterialIcons name="alternate-email" size={20} color="#1DA1F2" />
                <TextInput style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }} value={ambForm.twitterHandle} onChangeText={(v) => setAmbForm(prev => ({ ...prev, twitterHandle: v }))} placeholder="@handle" placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 8 }}>
                <MaterialIcons name="language" size={20} color={theme.primary} />
                <TextInput style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.textPrimary }} value={ambForm.websiteUrl} onChangeText={(v) => setAmbForm(prev => ({ ...prev, websiteUrl: v }))} placeholder="https://..." placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              </View>

              {/* Featured toggle */}
              <View style={[styles.formToggleRow, { marginTop: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>{fr ? 'Mettre en vedette' : 'Featured'}</Text>
                  <Text style={styles.formHint}>{fr ? 'Visible sur la page d\'accueil' : 'Visible on the home page'}</Text>
                </View>
                <Switch
                  value={ambForm.isFeatured}
                  onValueChange={(v) => setAmbForm(prev => ({ ...prev, isFeatured: v }))}
                  trackColor={{ false: theme.border, true: '#7C3AED' + '60' }}
                  thumbColor={ambForm.isFeatured ? '#7C3AED' : theme.textMuted}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => { if (!ambSaving) setShowAmbassadorModal(false); }} disabled={ambSaving}>
                <Text style={[styles.modalCancelText, ambSaving && { opacity: 0.4 }]}>{fr ? 'Annuler' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreateBtn, { backgroundColor: '#7C3AED' }, (!ambForm.displayName.trim() || ambSaving) && { opacity: 0.5 }]}
                onPress={handleSaveAmbassador}
                disabled={!ambForm.displayName.trim() || ambSaving}
              >
                {ambSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name={editingAmbassador ? 'check' : 'add'} size={18} color="#FFF" />
                    <Text style={styles.modalCreateText}>{editingAmbassador ? (fr ? 'Sauvegarder' : 'Save') : (fr ? 'Ajouter' : 'Add')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Redemptions Modal */}
      <Modal visible={showRedemptionsModal} animationType="slide" transparent onRequestClose={() => setShowRedemptionsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="people" size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{fr ? 'Utilisations' : 'Redemptions'}</Text>
                {selectedCode ? (
                  <Text style={styles.modalSubtitle}>{selectedCode.code} \u2022 {selectedCode.current_uses} / {selectedCode.max_uses}</Text>
                ) : null}
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowRedemptionsModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {redemptions.length > 0 ? (
                redemptions.map((r, idx) => (
                  <View key={r.id} style={[styles.redemptionItem, idx === redemptions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.redemptionIcon}>
                      <MaterialIcons name="person" size={18} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.redemptionEmail}>{r.user_email}</Text>
                      <Text style={styles.redemptionDate}>
                        {new Date(r.redeemed_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 12 }}>
                    {fr ? 'Chargement...' : 'Loading...'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bulkBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },

  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: theme.borderRadius.lg, padding: 14,
    alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: theme.textSecondary,
    letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },

  // Promo card
  promoCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl,
    padding: 18, marginBottom: 12, ...theme.shadows.card,
  },
  promoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  promoCodeBadge: {
    backgroundColor: theme.primary + '12', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.primary + '25',
  },
  promoCodeText: { fontSize: 18, fontWeight: '800', color: theme.primary, letterSpacing: 2 },

  promoStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  usageSection: { marginBottom: 12 },
  usageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  usageLabel: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  usageCount: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  usageBarTrack: { height: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 4, overflow: 'hidden' },
  usageBarFill: { height: '100%', borderRadius: 4 },

  promoMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  promoMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  promoMetaText: { fontSize: 12, color: theme.textMuted },

  viewRedemptionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary + '10', paddingVertical: 10, borderRadius: theme.borderRadius.md,
    marginTop: 4,
  },
  viewRedemptionsBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyListContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modalHeaderIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
  },

  formGroup: { marginTop: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
  formHint: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  formInput: {
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, fontWeight: '600',
    color: theme.textPrimary, borderWidth: 1, borderColor: theme.border,
  },
  formToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, padding: 14,
  },

  modalActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  modalCreateBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: theme.primary,
  },
  modalCreateText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Redemptions
  redemptionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  redemptionIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.accent + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  redemptionEmail: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  redemptionDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },

  // Bulk generate
  bulkPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: theme.primary + '08', borderRadius: theme.borderRadius.md,
    padding: 12, borderWidth: 1, borderColor: theme.primary + '20',
  },
  bulkPreviewLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  bulkPreviewCode: { fontSize: 16, fontWeight: '800', color: theme.primary, letterSpacing: 1.5 },
  bulkQuantityRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bulkQuantityChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.borderRadius.md,
    backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border,
  },
  bulkQuantityChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  bulkQuantityChipText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  bulkQuantityChipTextActive: { color: '#FFF' },
  bulkQuantityInput: {
    flex: 1, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, fontWeight: '700',
    color: theme.textPrimary, borderWidth: 1, borderColor: theme.border, textAlign: 'center',
  },
  bulkSummary: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, padding: 12,
  },
  bulkSummaryText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  bulkProgressContainer: { paddingHorizontal: 20, paddingBottom: 8 },
  bulkProgressTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  bulkProgressFill: { height: '100%', backgroundColor: theme.success, borderRadius: 3 },
  bulkProgressText: { fontSize: 12, fontWeight: '600', color: theme.success, textAlign: 'center' },

  // Analysis Summary
  analysisSummaryCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F97316' + '20',
    ...theme.shadows.card,
  },
  analysisSummaryHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
  },
  analysisSummaryIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F97316' + '12',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  analysisSummaryTitle: {
    fontSize: 15, fontWeight: '700' as const, color: theme.textPrimary,
  },
  analysisSummaryDate: {
    fontSize: 11, color: theme.textMuted, marginTop: 2,
  },
  analysisSummaryBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  analysisSummaryBtnText: {
    fontSize: 12, fontWeight: '700' as const, color: '#FFF',
  },
  analysisSummaryStats: {
    flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  analysisSummaryStat: {
    flex: 1, alignItems: 'center' as const,
  },
  analysisSummaryStatValue: {
    fontSize: 20, fontWeight: '800' as const, color: theme.textPrimary,
  },
  analysisSummaryStatLabel: {
    fontSize: 10, fontWeight: '600' as const, color: theme.textMuted, marginTop: 2,
    textTransform: 'uppercase' as const, letterSpacing: 0.3,
  },
  analysisSummaryStatDivider: {
    width: 1, height: 28, backgroundColor: theme.border,
  },
  analysisSummaryEmpty: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border,
  },
  analysisSummaryEmptyText: {
    flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17,
  },
});
