import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, limit as fbLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar } from '@/components/common/Avatar';
import Colors from '@/constants/colors';
import { fontWeight, fontSize, spacing, borderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useChatActions, usePendingSentRequests, useExistingConversations } from '@/hooks/useChat';
import * as Haptics from 'expo-haptics';
import { getLevelLabel } from '@/lib/levels';
import { useAppAlert } from '@/contexts/AlertContext';

interface SearchUser {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL: string;
  isOnline: boolean;
  showOnlineStatus?: boolean;
  bio: string;
  avatarId?: string;
  isPremium?: boolean;
  boostedUntil?: any;
  interests?: string[];
  discoverable?: boolean;
  gender?: string;
  totalChats?: number;
  totalMatches?: number;
  blockedUsers?: string[];
}

function sortByBoost(users: SearchUser[]): SearchUser[] {
  const now = new Date();
  return [...users].sort((a, b) => {
    const aBoosted = a.isPremium || (a.boostedUntil && (a.boostedUntil.toDate ? a.boostedUntil.toDate() : new Date(a.boostedUntil)) > now);
    const bBoosted = b.isPremium || (b.boostedUntil && (b.boostedUntil.toDate ? b.boostedUntil.toDate() : new Date(b.boostedUntil)) > now);
    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;
    return 0;
  });
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const { showAlert, showError } = useAppAlert();
  const { sendChatRequest } = useChatActions();
  const pendingSentTo = usePendingSentRequests(user?.uid || '');
  const existingConversations = useExistingConversations(user?.uid || '');
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingTo, setSendingTo] = useState<Set<string>>(new Set());

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    loadSuggestedUsers();
  }, [user]);

  const myBlockedList = userProfile?.blockedUsers || [];
  const isPremium = userProfile?.isPremium || false;
  const myGender = userProfile?.gender || '';

  const loadSuggestedUsers = async () => {
    if (!user) return;
    try {
      const suggestLimit = isPremium ? 50 : 10;
      const q = query(collection(db, 'users'), fbLimit(suggestLimit + 20));
      const snapshot = await getDocs(q);
      const users: SearchUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SearchUser;
        if (
          data.uid !== user.uid &&
          data.discoverable !== false &&
          !myBlockedList.includes(data.uid) &&
          !(data.blockedUsers || []).includes(user.uid)
        ) {
          users.push(data);
        }
      });
      let sorted = sortByBoost(users);
      if (isPremium && myGender === 'male') {
        sorted = [
          ...sorted.filter((u) => u.gender === 'female'),
          ...sorted.filter((u) => u.gender !== 'female'),
        ];
      }
      setSuggestedUsers(sorted.slice(0, suggestLimit));
    } catch {
      setSuggestedUsers([]);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSearch = useCallback(async (text: string) => {
    setSearchText(text);
    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const q = query(collection(db, 'users'), fbLimit(200));
      const snapshot = await getDocs(q);
      const users: SearchUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SearchUser;
        const searchLower = text.toLowerCase();
        if (
          data.uid !== user?.uid &&
          data.discoverable !== false &&
          !myBlockedList.includes(data.uid) &&
          !(data.blockedUsers || []).includes(user?.uid || '') &&
          (data.displayName?.toLowerCase().includes(searchLower) ||
           data.username?.toLowerCase().includes(searchLower))
        ) {
          users.push(data);
        }
      });
      setResults(sortByBoost(users));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user, myBlockedList]);

  const handleChatRequest = async (targetUser: SearchUser) => {
    if (!user || !userProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSendingTo((prev) => new Set(prev).add(targetUser.uid));

    try {
      await sendChatRequest(
        user.uid,
        userProfile.displayName,
        userProfile.photoURL || '',
        targetUser.uid,
        targetUser.displayName,
        targetUser.photoURL || '',
        userProfile.avatarId || '',
        targetUser.avatarId || ''
      );
      showAlert({ title: 'Request Sent', message: `Chat request sent to ${targetUser.displayName}!`, type: 'success' });
    } catch {
      showError('Error', 'Failed to send chat request');
    } finally {
      setSendingTo((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.uid);
        return next;
      });
    }
  };

  const handleOpenExistingChat = (conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${conversationId}`);
  };

  const displayUsers = hasSearched ? results : suggestedUsers;

  const renderUser = ({ item }: { item: SearchUser }) => {
    const existingConvoId = existingConversations.get(item.uid);
    const isPending = !existingConvoId && (pendingSentTo.has(item.uid) || sendingTo.has(item.uid));
    const isOnlineVisible = (item.showOnlineStatus ?? true) && item.isOnline;
    const topInterests = (item.interests || []).slice(0, 2);
    const levelLabel = getLevelLabel(item.totalChats || 0, item.totalMatches || 0);

    return (
      <View style={styles.userItem}>
        <Avatar
          name={item.displayName}
          uri={!item.avatarId ? item.photoURL : undefined}
          avatarId={item.avatarId || undefined}
          size={54}
          showOnline
          isOnline={isOnlineVisible}
        />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>{item.displayName}</Text>
            {item.isPremium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={9} color="#FFB300" />
                <Text style={styles.premiumBadgeText}>Pro</Text>
              </View>
            )}
          </View>
          {item.username ? (
            <Text style={styles.userHandleText}>@{item.username}</Text>
          ) : null}
          <Text style={styles.levelText}>{levelLabel}</Text>
          <Text style={styles.userBio} numberOfLines={1}>
            {item.bio || 'New to Lucky Chat'}
          </Text>
          {topInterests.length > 0 && (
            <View style={styles.interestRow}>
              {topInterests.map((id) => (
                <View key={id} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>{id}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {existingConvoId ? (
          <Pressable
            onPress={() => handleOpenExistingChat(existingConvoId)}
            style={({ pressed }) => [styles.chatButton, styles.chatButtonActive, pressed && styles.chatButtonPressed]}
          >
            <Ionicons name="chatbubble" size={13} color={Colors.white} />
            <Text style={styles.chatButtonText}>Message</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handleChatRequest(item)}
            disabled={isPending}
            style={({ pressed }) => [
              styles.chatButton,
              isPending ? styles.chatButtonPending : null,
              pressed && !isPending && styles.chatButtonPressed,
            ]}
          >
            <Text style={[styles.chatButtonText, isPending && styles.chatButtonTextPending]}>
              {isPending ? 'Pending' : 'Chat'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
        <Text style={styles.headerTitle}>Lucky Chat</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.gray[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name"
            placeholderTextColor={Colors.gray[400]}
            value={searchText}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.gray[400]} />
            </Pressable>
          )}
        </View>
      </View>

      {loading || initialLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : displayUsers.length === 0 && hasSearched ? (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={48} color={Colors.gray[300]} />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : displayUsers.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="people-outline" size={48} color={Colors.gray[300]} />
          <Text style={styles.emptyText}>Find new connections</Text>
          <Text style={styles.emptySubtext}>Search for users to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={displayUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              {hasSearched ? 'SEARCH RESULTS' : 'SUGGESTED USERS'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFaded,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontWeight.regular,
    fontSize: fontSize.md,
    color: Colors.text.primary,
    height: '100%',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.lg,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  emptySubtext: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.xs,
    color: Colors.text.secondary,
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
  },
  userName: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.md,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  premiumBadgeText: {
    fontFamily: fontWeight.semiBold,
    fontSize: 9,
    color: '#FFB300',
  },
  userHandleText: {
    fontFamily: fontWeight.medium,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 1,
  },
  levelText: {
    fontFamily: fontWeight.medium,
    fontSize: 10,
    color: Colors.primary,
    marginTop: 1,
    marginBottom: 1,
  },
  userBio: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  interestRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  interestTag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  interestTagText: {
    fontFamily: fontWeight.medium,
    fontSize: 10,
    color: Colors.primary,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: borderRadius.sm,
    minWidth: 76,
    justifyContent: 'center',
  },
  chatButtonActive: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
  },
  chatButtonPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  chatButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  chatButtonText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.white,
  },
  chatButtonTextPending: {
    color: Colors.primary,
  },
});
