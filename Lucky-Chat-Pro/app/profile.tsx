import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { collection, query, where, getDocs, limit as fbLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import Colors from '@/constants/colors';
import { fontWeight, fontSize, spacing, borderRadius, shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAlert } from '@/contexts/AlertContext';
import { usePremium } from '@/contexts/PremiumContext';
import { AVATAR_PRESETS } from '@/constants/avatars';
import { useConversations } from '@/hooks/useChat';
import { getUserLevel } from '@/lib/levels';

const INTEREST_OPTIONS = [
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'movies', label: 'Movies', icon: '🎬' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'art', label: 'Art', icon: '🎨' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'reading', label: 'Reading', icon: '📚' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'cooking', label: 'Cooking', icon: '👨‍🍳' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'pets', label: 'Pets', icon: '🐾' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'comedy', label: 'Comedy', icon: '😂' },
  { id: 'anime', label: 'Anime', icon: '⛩️' },
];

function getActiveDays(createdAt: any): number {
  if (!createdAt) return 0;
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const diff = Date.now() - date.getTime();
  return Math.max(1, Math.floor(diff / 86400000));
}

function formatJoinDate(createdAt: any): string {
  if (!createdAt) return 'Unknown';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', icon: '♂️' },
  { id: 'female', label: 'Female', icon: '♀️' },
  { id: 'other', label: 'Other', icon: '⚧' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, userProfile, updateUserProfile } = useAuth();
  const { showAlert, showError, showSuccess } = useAppAlert();
  const { isPremium } = usePremium();
  const { conversations } = useConversations(user?.uid || '');

  const [name, setName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile?.avatarId || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(userProfile?.interests || []);
  const [selectedGender, setSelectedGender] = useState<string>(userProfile?.gender || '');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'avatar' | 'interests'>('avatar');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const activeDays = getActiveDays(userProfile?.createdAt);
  const joinDate = formatJoinDate(userProfile?.createdAt);
  const levelInfo = getUserLevel(userProfile?.totalChats || 0, userProfile?.totalMatches || 0);

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Name Required', 'Your display name cannot be empty');
      return;
    }
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (trimmedUsername && (trimmedUsername.length < 3 || trimmedUsername.length > 20)) {
      showError('Invalid Username', 'Username must be between 3 and 20 characters.');
      return;
    }
    setLoading(true);
    try {
      // Check uniqueness if username changed
      if (trimmedUsername && trimmedUsername !== userProfile?.username) {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', trimmedUsername), fbLimit(1)));
        if (!snap.empty && snap.docs[0].id !== user?.uid) {
          showError('Username Taken', `@${trimmedUsername} is already taken. Try another.`);
          setLoading(false);
          return;
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateUserProfile({
        displayName: name.trim(),
        username: trimmedUsername || userProfile?.username || '',
        bio: bio.trim(),
        avatarId: selectedAvatar || '',
        interests: selectedInterests,
        gender: selectedGender as any,
      });
      showSuccess('Profile Saved', 'Your profile has been updated successfully!', () => router.back());
    } catch {
      showError('Save Failed', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 5) {
        showAlert({ title: 'Max 5 Interests', message: 'Remove one interest before adding another.', type: 'warning' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const profileCompletion = () => {
    let score = 0;
    if (name.trim()) score += 25;
    if (bio.trim()) score += 25;
    if (selectedAvatar) score += 25;
    if (selectedInterests.length > 0) score += 25;
    return score;
  };

  const completion = profileCompletion();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} style={styles.saveBtn} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroAvatarWrap}>
            <Avatar
              name={name || userProfile?.displayName || ''}
              uri={!selectedAvatar ? userProfile?.photoURL : undefined}
              avatarId={selectedAvatar || undefined}
              size={96}
              isPremium={isPremium}
            />
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={11} color="#FFB300" />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>{name || 'Your Name'}</Text>
          {userProfile?.username ? (
            <Text style={styles.heroUsername}>@{userProfile.username}</Text>
          ) : null}
          <View style={styles.levelRow}>
            <Text style={styles.levelText}>{levelInfo.emoji} {levelInfo.title}</Text>
            <View style={styles.levelDot} />
            <Text style={styles.levelText}>Level {levelInfo.level}</Text>
          </View>
          {bio ? <Text style={styles.heroBio} numberOfLines={2}>{bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxNum}>{conversations.length}</Text>
              <Text style={styles.statBoxLabel}>Chats</Text>
            </View>
            <View style={styles.statBoxDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statBoxNum}>{activeDays}</Text>
              <Text style={styles.statBoxLabel}>Days Active</Text>
            </View>
            <View style={styles.statBoxDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statBoxNum}>{selectedInterests.length}</Text>
              <Text style={styles.statBoxLabel}>Interests</Text>
            </View>
          </View>

          <View style={styles.joinRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.text.tertiary} />
            <Text style={styles.joinText}>Joined {joinDate}</Text>
          </View>
        </View>

        <View style={styles.completionSection}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionLabel}>Profile Completion</Text>
            <Text style={[styles.completionPct, completion === 100 && { color: Colors.primary }]}>
              {completion}%
            </Text>
          </View>
          <View style={styles.completionBar}>
            <View style={[styles.completionFill, { width: `${completion}%` as any }]} />
          </View>
          {completion < 100 && (
            <Text style={styles.completionHint}>
              {!bio.trim() ? 'Add a bio · ' : ''}
              {!selectedAvatar ? 'Pick an avatar · ' : ''}
              {selectedInterests.length === 0 ? 'Add interests' : ''}
            </Text>
          )}
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'avatar' && styles.tabBtnActive]}
            onPress={() => setActiveTab('avatar')}
          >
            <Ionicons name="happy-outline" size={16} color={activeTab === 'avatar' ? Colors.primary : Colors.text.tertiary} />
            <Text style={[styles.tabBtnText, activeTab === 'avatar' && styles.tabBtnTextActive]}>Avatar</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === 'interests' && styles.tabBtnActive]}
            onPress={() => setActiveTab('interests')}
          >
            <Ionicons name="heart-outline" size={16} color={activeTab === 'interests' ? Colors.primary : Colors.text.tertiary} />
            <Text style={[styles.tabBtnText, activeTab === 'interests' && styles.tabBtnTextActive]}>
              Interests {selectedInterests.length > 0 ? `(${selectedInterests.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {activeTab === 'avatar' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Choose Avatar</Text>
              {selectedAvatar ? (
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAvatar(''); }}>
                  <Text style={styles.clearLink}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              style={styles.avatarScrollBox}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              <View style={styles.avatarGrid}>
                {AVATAR_PRESETS.map((preset) => {
                  const locked = !!preset.isPremium && !isPremium;
                  const selected = selectedAvatar === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => {
                        if (locked) { showAlert({ title: 'Premium Avatar', message: 'Upgrade to Premium to unlock exclusive avatars.', type: 'warning', icon: 'diamond' }); return; }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedAvatar(selected ? '' : preset.id);
                      }}
                      style={[styles.avatarOpt, selected && styles.avatarOptSelected]}
                    >
                      <View style={[
                        styles.avatarCircle,
                        { backgroundColor: preset.bgColor },
                        locked && styles.avatarLocked,
                      ]}>
                        <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
                        {locked && (
                          <View style={styles.lockMask}>
                            <Ionicons name="lock-closed" size={14} color="#fff" />
                          </View>
                        )}
                        {preset.isPremium && !locked && (
                          <View style={styles.premiumDot}>
                            <Ionicons name="diamond" size={8} color="#FFB300" />
                          </View>
                        )}
                      </View>
                      {selected && (
                        <View style={styles.checkMark}>
                          <Ionicons name="checkmark" size={10} color={Colors.white} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {activeTab === 'interests' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Interests</Text>
              <Text style={styles.sectionHint}>{selectedInterests.length}/5 selected</Text>
            </View>
            <Text style={styles.interestSubtitle}>Let others know what you're into</Text>
            <View style={styles.interestGrid}>
              {INTEREST_OPTIONS.map((interest) => {
                const selected = selectedInterests.includes(interest.id);
                return (
                  <Pressable
                    key={interest.id}
                    onPress={() => toggleInterest(interest.id)}
                    style={[styles.interestChip, selected && styles.interestChipSelected]}
                  >
                    <Text style={styles.interestEmoji}>{interest.icon}</Text>
                    <Text style={[styles.interestLabel, selected && styles.interestLabelSelected]}>
                      {interest.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Profile Info</Text>
          <Input
            label="Display Name"
            value={name}
            onChangeText={setName}
            icon="person-outline"
            placeholder="Your name"
          />
          <Input
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            icon="at-outline"
            placeholder="your_username"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself..."
            icon="document-text-outline"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80 }}
          />
          <View style={styles.genderRow}>
            <Text style={styles.genderLabel}>Gender</Text>
            <View style={styles.genderChips}>
              {GENDER_OPTIONS.map((g) => (
                <Pressable
                  key={g.id}
                  style={[styles.genderChip, selectedGender === g.id && styles.genderChipSelected]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedGender(g.id); }}
                >
                  <Text style={styles.genderChipIcon}>{g.icon}</Text>
                  <Text style={[styles.genderChipText, selectedGender === g.id && styles.genderChipTextSelected]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Input
            label="Email"
            value={user?.email || ''}
            editable={false}
            icon="mail-outline"
          />
        </View>

        <View style={styles.saveSection}>
          <Button title="Save Profile" onPress={handleSave} loading={loading} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.lg,
    color: Colors.text.primary,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.primary,
    borderRadius: borderRadius.full,
  },
  saveBtnText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.white,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...shadow.sm,
  },
  heroAvatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  premiumBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  premiumBadgeText: {
    fontFamily: fontWeight.semiBold,
    fontSize: 9,
    color: '#FFB300',
  },
  heroName: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xxl,
    color: Colors.text.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroUsername: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 2,
  },
  heroBio: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxNum: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.primary,
  },
  statBoxLabel: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  statBoxDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border.light,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  joinText: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
  },
  completionSection: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionLabel: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  completionPct: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  completionBar: {
    height: 6,
    backgroundColor: Colors.gray[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  completionHint: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 6,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    ...shadow.sm,
  },
  tabBtnText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
  },
  tabBtnTextActive: {
    color: Colors.primary,
    fontFamily: fontWeight.semiBold,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.md,
    color: Colors.text.primary,
  },
  sectionHint: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
  },
  clearLink: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.danger,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  avatarOpt: {
    position: 'relative',
    padding: 3,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  avatarOptSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLocked: {
    opacity: 0.5,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  lockMask: {
    position: 'absolute',
    inset: 0 as any,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  checkMark: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  interestSubtitle: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: 12,
    marginTop: -8,
  },
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: Colors.gray[100],
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  interestChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  interestEmoji: {
    fontSize: 15,
  },
  interestLabel: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  interestLabelSelected: {
    color: Colors.primary,
  },
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  saveSection: {
    marginBottom: 8,
  },
  avatarScrollBox: {
    maxHeight: 220,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  levelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.tertiary,
  },
  levelText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  genderRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  genderLabel: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  genderChips: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: Colors.gray[100],
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  genderChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  genderChipIcon: {
    fontSize: 14,
  },
  genderChipText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  genderChipTextSelected: {
    color: Colors.primary,
  },
});
