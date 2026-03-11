import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Platform,
  Modal,
  Keyboard,
  Share,
  FlatList,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import Colors from '@/constants/colors';
import { fontWeight, fontSize, spacing, borderRadius, shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/contexts/PremiumContext';
import { showRewardedAd, initializeAds } from '@/lib/ads';
import { AVATAR_PRESETS } from '@/constants/avatars';
import { useConversations } from '@/hooks/useChat';
import { getUserLevel } from '@/lib/levels';
import { useAppAlert } from '@/contexts/AlertContext';

function formatJoinDate(createdAt: any): string {
  if (!createdAt) return 'Unknown';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getActiveDays(createdAt: any): number {
  if (!createdAt) return 0;
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return Math.max(1, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function formatBoostCountdown(boostedUntil: any): string | null {
  if (!boostedUntil) return null;
  const endDate = boostedUntil.toDate ? boostedUntil.toDate() : new Date(boostedUntil);
  const remaining = endDate.getTime() - Date.now();
  if (remaining <= 0) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${mins}m ${secs}s remaining`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, userProfile, logout, updateUserProfile, changePassword, deleteAccount, blockUser, unblockUser } = useAuth();
  const premium = usePremium();
  const isPremium = premium.isPremium;
  const { showAlert, showError, showSuccess, showConfirm } = useAppAlert();
  const { conversations } = useConversations(user?.uid || '');
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [blockedUsersVisible, setBlockedUsersVisible] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [boostCountdown, setBoostCountdown] = useState<string | null>(null);
  const [blockedProfiles, setBlockedProfiles] = useState<any[]>([]);
  const boostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notificationsEnabled = userProfile?.notificationsEnabled ?? true;
  const discoverable = userProfile?.discoverable ?? true;
  const showOnlineStatus = userProfile?.showOnlineStatus ?? true;
  const allowRandomMatch = userProfile?.allowRandomMatch ?? true;
  const blockedList = userProfile?.blockedUsers || [];

  const levelInfo = getUserLevel(userProfile?.totalChats || 0, userProfile?.totalMatches || 0);

  useEffect(() => {
    initializeAds().catch(() => {});
  }, []);

  useEffect(() => {
    if (boostTimerRef.current) clearInterval(boostTimerRef.current);
    const boostedUntil = userProfile?.boostedUntil;
    if (!boostedUntil || isPremium) { setBoostCountdown(null); return; }
    const tick = () => {
      const label = formatBoostCountdown(boostedUntil);
      setBoostCountdown(label);
      if (!label && boostTimerRef.current) {
        clearInterval(boostTimerRef.current);
        boostTimerRef.current = null;
      }
    };
    tick();
    boostTimerRef.current = setInterval(tick, 1000);
    return () => { if (boostTimerRef.current) clearInterval(boostTimerRef.current); };
  }, [userProfile?.boostedUntil, isPremium]);

  const loadBlockedProfiles = async () => {
    if (!blockedList.length) { setBlockedProfiles([]); return; }
    try {
      const profiles = await Promise.all(
        blockedList.map(async (uid) => {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) return { uid, ...snap.data() };
          return { uid, displayName: 'Deleted User', avatarId: '', photoURL: '' };
        })
      );
      setBlockedProfiles(profiles);
    } catch {
      setBlockedProfiles([]);
    }
  };

  const handleBoostProfile = async () => {
    if (isPremium) {
      showAlert({ title: 'Always Boosted', message: 'Premium users always appear first in search results.', type: 'success' });
      return;
    }
    if (premium.isBoosted && boostCountdown) {
      showAlert({ title: 'Boost Active', message: `Your profile is already boosted — ${boostCountdown}`, type: 'info' });
      return;
    }
    setBoostLoading(true);
    const rewarded = await showRewardedAd();
    if (rewarded) {
      await premium.boostProfile(30);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess('Profile Boosted!', 'You will appear first in search results for the next 30 minutes.');
    }
    setBoostLoading(false);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleToggle = async (field: string, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const update: any = { [field]: value };
      if (field === 'showOnlineStatus') {
        update.isOnline = value;
      }
      if (field === 'notificationsEnabled' && value && Platform.OS !== 'web') {
        try {
          const Notifications = require('expo-notifications');
          await Notifications.requestPermissionsAsync();
        } catch {}
      } else if (field === 'notificationsEnabled' && value && Platform.OS === 'web') {
        showAlert({ title: 'Browser Notifications', message: 'Notifications are managed in your browser settings.', type: 'info' });
      }
      await updateUserProfile(update);
    } catch {
      showError('Error', 'Failed to update setting');
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showConfirm(
      'Logout',
      'Are you sure you want to sign out of your account?',
      async () => {
        try { await logout(); router.replace('/auth/login'); }
        catch { showError('Error', 'Failed to logout. Please try again.'); }
      },
      { confirmText: 'Logout', destructive: true }
    );
  };

  const handleDeleteAccount = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showConfirm(
      'Delete Account',
      'This will permanently remove all your data. This action cannot be undone.',
      async () => {
        try { await deleteAccount(); router.replace('/auth/login'); }
        catch { showError('Error', 'Failed to delete account. Please re-login and try again.'); }
      },
      { confirmText: 'Delete Account', destructive: true }
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Lucky Chat — meet new people and chat randomly! 🍀',
        title: 'Lucky Chat',
      });
    } catch {}
  };

  const handleUnblock = async (targetUid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await unblockUser(targetUid);
    setBlockedProfiles((prev) => prev.filter((p) => p.uid !== targetUid));
  };

  const joinDate = formatJoinDate(userProfile?.createdAt);
  const activeDays = getActiveDays(userProfile?.createdAt);

  const boostTitle = boostLoading
    ? 'Loading Ad...'
    : isPremium
    ? 'Always Boosted (Premium)'
    : boostCountdown
    ? `Boost Active — ${boostCountdown}`
    : 'Boost Profile';

  const boostSubtitle = isPremium
    ? 'You always appear first in search'
    : boostCountdown
    ? 'Your profile is at the top of search'
    : 'Watch an ad to appear first for 30 min';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 + webTopInset, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileCardLeft}>
            <View style={styles.profileAvatarWrap}>
              <Avatar
                name={userProfile?.displayName || ''}
                uri={!userProfile?.avatarId ? userProfile?.photoURL : undefined}
                avatarId={userProfile?.avatarId || undefined}
                size={64}
                isPremium={isPremium}
              />
              {isPremium && (
                <View style={styles.premiumRing} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName} numberOfLines={1}>{userProfile?.displayName || 'User'}</Text>
                {isPremium && (
                  <View style={styles.premiumTag}>
                    <Ionicons name="diamond" size={10} color="#FFB300" />
                    <Text style={styles.premiumTagText}>Premium</Text>
                  </View>
                )}
              </View>
              {userProfile?.username ? (
                <Text style={styles.profileUsername}>@{userProfile.username}</Text>
              ) : null}
              <Text style={styles.levelBadge}>{levelInfo.emoji} {levelInfo.title} · Level {levelInfo.level}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.editProfileBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="pencil" size={15} color={Colors.primary} />
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.statsCards}>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{conversations.length}</Text>
            <Text style={styles.statCardLabel}>Chats</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{activeDays}</Text>
            <Text style={styles.statCardLabel}>Days Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{userProfile?.interests?.length || 0}</Text>
            <Text style={styles.statCardLabel}>Interests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{isPremium ? '★' : 'Free'}</Text>
            <Text style={styles.statCardLabel}>Plan</Text>
          </View>
        </View>

        <SectionLabel title="PREMIUM" />
        <View style={styles.card}>
          {!isPremium ? (
            <SettingsRow
              icon="diamond-outline"
              iconBg="#FFF8E1"
              iconColor="#FFB300"
              title="Go Premium"
              subtitle="Unlimited matches, no ads, priority search"
              onPress={() => router.push('/premium')}
              badge="UPGRADE"
            />
          ) : (
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="diamond" size={20} color="#FFB300" />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Premium Active</Text>
                <Text style={styles.rowSubtitle}>All premium features are unlocked</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            </View>
          )}
          <View style={styles.divider} />
          <SettingsRow
            icon="rocket-outline"
            iconBg={boostCountdown ? Colors.primaryLight : '#E3F2FD'}
            iconColor={boostCountdown ? Colors.primary : '#1976D2'}
            title={boostTitle}
            subtitle={boostSubtitle}
            onPress={handleBoostProfile}
          />
        </View>

        <SectionLabel title="ACCOUNT" />
        <View style={styles.card}>
          <SettingsRow
            icon="person-circle-outline"
            title="Edit Profile"
            subtitle="Name, bio, avatar, gender & interests"
            onPress={() => router.push('/profile')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="lock-closed-outline"
            iconBg={Colors.primaryLight}
            title="Change Password"
            subtitle="Update your login password"
            onPress={() => setChangePasswordVisible(true)}
          />
        </View>

        <SectionLabel title="PRIVACY & SAFETY" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="search-outline" size={20} color="#1976D2" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Discoverable in Search</Text>
              <Text style={styles.rowSubtitle}>Others can find you by searching</Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={(v) => handleToggle('discoverable', v)}
              trackColor={{ false: Colors.gray[300], true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="radio-button-on-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Show Online Status</Text>
              <Text style={styles.rowSubtitle}>Let others see when you're active</Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={(v) => handleToggle('showOnlineStatus', v)}
              trackColor={{ false: Colors.gray[300], true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="shuffle-outline" size={20} color="#E65100" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Allow Random Matching</Text>
              <Text style={styles.rowSubtitle}>Others can match with you via Lucky Spin</Text>
            </View>
            <Switch
              value={allowRandomMatch}
              onValueChange={(v) => handleToggle('allowRandomMatch', v)}
              trackColor={{ false: Colors.gray[300], true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <SectionLabel title="NOTIFICATIONS" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Push Notifications</Text>
              <Text style={styles.rowSubtitle}>New messages and match alerts</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => handleToggle('notificationsEnabled', v)}
              trackColor={{ false: Colors.gray[300], true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <SectionLabel title="MY STATS" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Member Since</Text>
              <Text style={styles.rowSubtitle}>{joinDate}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="chatbubbles-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Active Conversations</Text>
              <Text style={styles.rowSubtitle}>{conversations.length} chat{conversations.length !== 1 ? 's' : ''} open</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="trophy-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Your Level</Text>
              <Text style={styles.rowSubtitle}>{levelInfo.emoji} {levelInfo.title} · {levelInfo.current} pts{levelInfo.level < 5 ? ` · Next at ${levelInfo.nextAt}` : ' · Max level!'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="flash-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Matches Today</Text>
              <Text style={styles.rowSubtitle}>
                {isPremium ? 'Unlimited (Premium)' : `${premium.matchesRemaining} remaining`}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Email</Text>
              <Text style={styles.rowSubtitle}>{user?.email || 'Not set'}</Text>
            </View>
          </View>
        </View>

        <SectionLabel title="ABOUT LUCKY CHAT" />
        <View style={styles.card}>
          <SettingsRow
            icon="share-social-outline"
            iconBg="#E8F5E9"
            title="Share Lucky Chat"
            subtitle="Invite friends to join"
            onPress={handleShareApp}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text-outline"
            iconBg={Colors.primaryLight}
            title="Terms of Service"
            subtitle="Our terms and conditions"
            onPress={() => showAlert({ title: 'Terms of Service', message: 'By using Lucky Chat, you agree to use the app respectfully and not share harmful content. All chats are ephemeral for privacy.', type: 'info', icon: 'document-text' })}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg="#E3F2FD"
            iconColor="#1976D2"
            title="Privacy Policy"
            subtitle="How we handle your data"
            onPress={() => showAlert({ title: 'Privacy Policy', message: 'We store minimal user data (name, email, bio). We never sell your data. Messages are ephemeral and auto-deleted after 24 hours.', type: 'info', icon: 'shield-checkmark' })}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="bug-outline"
            iconBg="#FFF3E0"
            iconColor="#E65100"
            title="Report a Bug"
            subtitle="Help us improve the app"
            onPress={() => showAlert({ title: 'Report a Bug', message: 'Thank you for helping! Please email us at support@luckychat.app describing the issue and we will fix it ASAP.', type: 'info', icon: 'bug' })}
          />
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>App Version</Text>
              <Text style={styles.rowSubtitle}>Lucky Chat v1.0.0</Text>
            </View>
          </View>
        </View>

        <SectionLabel title="DANGER ZONE" color={Colors.danger} />
        <View style={styles.card}>
          <SettingsRow
            icon="ban-outline"
            iconBg="#FFF3E0"
            iconColor="#E65100"
            title="Blocked Users"
            subtitle={blockedList.length > 0 ? `${blockedList.length} user${blockedList.length !== 1 ? 's' : ''} blocked` : 'No blocked users'}
            onPress={() => {
              loadBlockedProfiles();
              setBlockedUsersVisible(true);
            }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="log-out-outline"
            iconBg={Colors.primaryLight}
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            titleColor={Colors.primary}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            iconBg={Colors.dangerLight}
            iconColor={Colors.danger}
            title="Delete Account"
            subtitle="Permanently remove all your data"
            onPress={handleDeleteAccount}
            titleColor={Colors.danger}
          />
        </View>

        <Text style={styles.footerText}>Made with 💚 by Lucky Chat Team</Text>
      </ScrollView>

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
        onChangePassword={changePassword}
      />

      <BlockedUsersModal
        visible={blockedUsersVisible}
        onClose={() => setBlockedUsersVisible(false)}
        blockedProfiles={blockedProfiles}
        onUnblock={handleUnblock}
      />
    </View>
  );
}

function SectionLabel({ title, color }: { title: string; color?: string }) {
  return (
    <Text style={[styles.sectionLabel, color ? { color } : null]}>{title}</Text>
  );
}

function SettingsRow({
  icon, title, subtitle, onPress, titleColor, iconBg, iconColor, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  titleColor?: string;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg || Colors.gray[100] }]}>
        <Ionicons name={icon} size={20} color={iconColor || Colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowTitleRow}>
          <Text style={[styles.rowTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
          {badge ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
    </Pressable>
  );
}

function BlockedUsersModal({ visible, onClose, blockedProfiles, onUnblock }: {
  visible: boolean;
  onClose: () => void;
  blockedProfiles: any[];
  onUnblock: (uid: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20, maxHeight: '75%' }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Blocked Users</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </Pressable>
          </View>
          {blockedProfiles.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyBlockText}>No blocked users</Text>
              <Text style={styles.emptyBlockSubtext}>Users you block will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={blockedProfiles}
              keyExtractor={(item) => item.uid}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.blockedRow}>
                  <Avatar
                    name={item.displayName || ''}
                    uri={!item.avatarId ? item.photoURL : undefined}
                    avatarId={item.avatarId || undefined}
                    size={44}
                  />
                  <View style={styles.blockedInfo}>
                    <Text style={styles.blockedName} numberOfLines={1}>{item.displayName || 'Unknown'}</Text>
                    <Text style={styles.blockedSub}>Blocked</Text>
                  </View>
                  <Pressable
                    onPress={() => onUnblock(item.uid)}
                    style={({ pressed }) => [styles.unblockBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.unblockText}>Unblock</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChangePasswordModal({ visible, onClose, onChangePassword }: {
  visible: boolean;
  onClose: () => void;
  onChangePassword: (c: string, n: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const { showError: showPwError, showSuccess: showPwSuccess } = useAppAlert();

  const handleChange = async () => {
    if (!currentPassword) { showPwError('Missing Field', 'Please enter your current password'); return; }
    if (newPassword.length < 6) { showPwError('Too Short', 'Password must be at least 6 characters'); return; }
    if (newPassword.length > 12) { showPwError('Too Long', 'Password must be at most 12 characters'); return; }
    if (newPassword !== confirmPassword) { showPwError('Mismatch', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      onClose();
      showPwSuccess('Password Changed', 'Your password has been updated successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch {
      showPwError('Change Failed', 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <Pressable style={styles.overlay} onPress={Keyboard.dismiss}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change Password</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} isPassword />
              <Input label="New Password (6-12 chars)" value={newPassword} onChangeText={setNewPassword} isPassword maxLength={12} />
              <Input label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} isPassword maxLength={12} />
              <Button title="Change Password" onPress={handleChange} loading={loading} style={{ marginBottom: 16 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
  },
  pageTitle: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xxl,
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...shadow.sm,
  },
  profileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  profileAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  premiumRing: {
    position: 'absolute',
    inset: -3 as any,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: '#FFB300',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  profileName: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.lg,
    color: Colors.text.primary,
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  premiumTagText: {
    fontFamily: fontWeight.semiBold,
    fontSize: 10,
    color: '#FFB300',
  },
  profileHandle: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  profileUsername: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.primary,
    marginTop: 1,
  },
  levelBadge: {
    fontFamily: fontWeight.medium,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginLeft: 8,
    flexShrink: 0,
  },
  editProfileBtnText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.primary,
  },
  statsCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  statCardNum: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.primary,
  },
  statCardLabel: {
    fontFamily: fontWeight.regular,
    fontSize: 10,
    color: Colors.text.tertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: Colors.gray[50],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.md,
    color: Colors.text.primary,
  },
  rowSubtitle: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  badgePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  badgePillText: {
    fontFamily: fontWeight.bold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginLeft: 66,
  },
  footerText: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xxl,
    paddingTop: 12,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.gray[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.text.primary,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  blockedInfo: {
    flex: 1,
    minWidth: 0,
  },
  blockedName: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.md,
    color: Colors.text.primary,
  },
  blockedSub: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  unblockBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  unblockText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.primary,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyBlockText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.lg,
    color: Colors.text.primary,
  },
  emptyBlockSubtext: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
  },
});
