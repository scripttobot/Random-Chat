import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar } from '@/components/common/Avatar';
import Colors from '@/constants/colors';
import { fontWeight, fontSize, spacing, borderRadius, shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useMatch } from '@/hooks/useMatch';
import { useChatRequests, useConversations } from '@/hooks/useChat';
import { usePremium, FREE_DAILY_MATCH_LIMIT, REWARD_AD_MATCH_BONUS } from '@/contexts/PremiumContext';
import { shouldShowInterstitial, showInterstitialAd, showRewardedAd, initializeAds } from '@/lib/ads';

function PulseRing({ delay, size, color = Colors.primaryLight }: { delay: number; size: number; color?: string }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.9, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

function SpinRing({ size, duration = 4000 }: { size: number; duration?: number }) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: 'transparent',
        borderTopColor: Colors.primary,
        borderRightColor: Colors.primaryLight,
        transform: [{ rotate: spin }],
      }}
    />
  );
}

function FloatingParticle({ top, left, delay, size = 6 }: { top: string; left: string; delay: number; size?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: top as any,
        left: left as any,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.primary,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

function MatchSparkle({ angle, distance }: { angle: number; distance: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(Math.random() * 600),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const rad = (angle * Math.PI) / 180;
  const tx = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * distance] });
  const ty = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * distance] });
  const opacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.2, 0.6] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        opacity,
        transform: [{ translateX: tx }, { translateY: ty }, { scale }],
      }}
    />
  );
}

function CountdownTimer({ onComplete }: { onComplete: () => void }) {
  const [seconds, setSeconds] = useState(3);
  useEffect(() => {
    if (seconds <= 0) { onComplete(); return; }
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return (
    <View style={matchStyles.countdownRow}>
      <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
      <Text style={matchStyles.countdownText}>Starting in {seconds}s...</Text>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const radarSize = Math.min(screenWidth * 0.7, 280);
  const { user, userProfile } = useAuth();
  const match = useMatch(
    user?.uid || '',
    userProfile?.displayName || '',
    userProfile?.photoURL || '',
    userProfile?.avatarId || '',
    userProfile?.blockedUsers || []
  );
  const { requests } = useChatRequests(user?.uid || '');
  const { conversations } = useConversations(user?.uid || '');
  const premium = usePremium();
  const notifCount = requests.length;

  const [onlineCount, setOnlineCount] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const matchConsumedRef = useRef(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    if (!user) return;
    initializeAds().catch(() => {});
    const q = query(collection(db, 'users'), where('isOnline', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => setOnlineCount(snap.size), () => {});
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleStartMatching = async () => {
    if (!premium.canMatch) return;
    if (userProfile?.allowRandomMatch === false) {
      return;
    }
    matchConsumedRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    match.startScanning();
  };

  const openChatWithAd = async (convoId: string) => {
    if (!premium.isPremium && shouldShowInterstitial()) await showInterstitialAd();
    router.push({ pathname: '/chat/[id]', params: { id: convoId } });
  };

  const consumeMatchAndChat = async (convoId: string) => {
    if (matchConsumedRef.current) return;
    matchConsumedRef.current = true;
    const allowed = await premium.useMatch();
    if (!allowed) { matchConsumedRef.current = false; return; }
    await openChatWithAd(convoId);
  };

  const handleSayHello = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const convoId = await match.acceptMatch();
    if (convoId) await consumeMatchAndChat(convoId);
  };

  const handleAutoChat = async () => {
    const convoId = await match.acceptMatch();
    if (convoId) await consumeMatchAndChat(convoId);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    match.skipMatch();
  };

  const handleWatchAd = async () => {
    setAdLoading(true);
    await showRewardedAd();
    premium.addBonusMatches(REWARD_AD_MATCH_BONUS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdLoading(false);
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const greeting = getGreeting();
  const firstName = userProfile?.displayName?.split(' ')[0] || 'there';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {match.phase === 'idle' && (
        <Animated.View
          style={[
            styles.content,
            { paddingTop: insets.top + 8 + webTopInset },
            { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.push('/profile')} style={styles.headerIconBtn} testID="profile-button">
              <View style={styles.headerAvatarWrap}>
                <Avatar
                  name={userProfile?.displayName || ''}
                  uri={!userProfile?.avatarId ? userProfile?.photoURL : undefined}
                  avatarId={userProfile?.avatarId || undefined}
                  size={34}
                />
                {(userProfile?.showOnlineStatus ?? true) && (
                  <View style={styles.headerOnlineDot} />
                )}
              </View>
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Lucky Chat</Text>
              {premium.isPremium && (
                <View style={styles.premiumPill}>
                  <Ionicons name="diamond" size={9} color="#FFB300" />
                  <Text style={styles.premiumPillText}>Premium</Text>
                </View>
              )}
            </View>

            <Pressable onPress={() => router.push('/notifications')} style={styles.headerIconBtn} testID="notifications-button">
              <View style={styles.notifWrap}>
                <Ionicons name="notifications-outline" size={22} color={Colors.text.primary} />
                {notifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.idleScrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          >
            <View style={styles.greetingCard}>
              <View style={styles.greetingCardInner}>
                <Text style={styles.greetingText}>{greeting}, {firstName}! 👋</Text>
                <Text style={styles.greetingSubText}>
                  {conversations.length > 0
                    ? `You have ${conversations.length} active conversation${conversations.length > 1 ? 's' : ''}`
                    : "Ready to make a new connection?"}
                </Text>
              </View>
              <View style={styles.greetingStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{formatCount(onlineCount)}</Text>
                  <Text style={styles.statLabel}>Online</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{conversations.length}</Text>
                  <Text style={styles.statLabel}>Chats</Text>
                </View>
                {!premium.isPremium && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statNumber, !premium.canMatch && { color: Colors.danger }]}>
                        {premium.matchesRemaining}
                      </Text>
                      <Text style={styles.statLabel}>Matches</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={styles.centerArea}>
              <Text style={styles.heroTitle}>Find your lucky</Text>
              <Text style={styles.heroTitleAccent}>connection</Text>

              {(() => {
                const btnSize = Math.min(screenWidth * 0.42, 156);
                const areaSize = btnSize + 64;
                return (
                  <View style={[styles.buttonArea, { width: areaSize, height: areaSize, marginBottom: 24 }]}>
                    <PulseRing delay={0} size={areaSize} />
                    <PulseRing delay={700} size={areaSize * 0.91} />
                    <PulseRing delay={1400} size={areaSize * 0.82} />
                    <View style={[styles.outerRing, { width: areaSize * 0.87, height: areaSize * 0.87, borderRadius: areaSize * 0.435 }]} />
                    <Pressable
                      onPress={handleStartMatching}
                      style={({ pressed }) => [
                        styles.startButton,
                        { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
                        pressed && styles.startButtonPressed,
                        !premium.canMatch && styles.startButtonDisabled,
                        premium.isPremium && styles.startButtonPremium,
                      ]}
                      testID="start-button"
                      disabled={!premium.canMatch}
                    >
                      {premium.isPremium ? (
                        <Ionicons name="diamond" size={Math.round(btnSize * 0.23)} color="#FFD700" />
                      ) : (
                        <Ionicons name="play" size={Math.round(btnSize * 0.27)} color={Colors.white} />
                      )}
                      <Text style={styles.startText}>{!premium.canMatch ? 'LIMIT' : 'START'}</Text>
                    </Pressable>
                  </View>
                );
              })()}

              {userProfile?.allowRandomMatch === false && (
                <View style={styles.disabledNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.disabledNoticeText}>Random match is disabled in settings</Text>
                </View>
              )}

              {!premium.canMatch && (
                <View style={styles.limitActions}>
                  <Pressable
                    style={({ pressed }) => [styles.watchAdButton, pressed && { opacity: 0.85 }]}
                    onPress={handleWatchAd}
                    disabled={adLoading}
                  >
                    <Ionicons name="play-circle" size={18} color={Colors.white} />
                    <Text style={styles.watchAdText}>
                      {adLoading ? 'Loading...' : `Watch Ad for +${REWARD_AD_MATCH_BONUS} Matches`}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.goPremiumButton, pressed && { opacity: 0.85 }]}
                    onPress={() => router.push('/premium')}
                  >
                    <Ionicons name="diamond" size={16} color="#FFD700" />
                    <Text style={styles.goPremiumText}>Unlock Unlimited — Go Premium</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.bottomBar}>
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlinePillText}>{formatCount(onlineCount)} people online now</Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {match.phase === 'scanning' && (
        <View style={[styles.fullPhase, { paddingTop: insets.top + 12 + webTopInset }]}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                match.stopScanning();
              }}
              style={styles.headerIconBtn}
            >
              <View style={styles.backCircle}>
                <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
              </View>
            </Pressable>
            <Text style={styles.headerTitle}>Lucky Chat</Text>
            <View style={styles.headerIconBtn} />
          </View>

          <View style={styles.scanBody}>
            <View style={[styles.radarWrap, { width: radarSize, height: radarSize }]}>
              <PulseRing delay={0} size={radarSize} color="rgba(45,181,83,0.15)" />
              <PulseRing delay={600} size={radarSize * 0.86} color="rgba(45,181,83,0.15)" />
              <PulseRing delay={1200} size={radarSize * 0.71} color="rgba(45,181,83,0.12)" />
              <SpinRing size={radarSize * 0.86} duration={3000} />
              <SpinRing size={radarSize * 0.64} duration={2000} />

              <View style={[styles.radarOuterRing, { width: radarSize * 0.79, height: radarSize * 0.79, borderRadius: radarSize * 0.395 }]} />
              <View style={[styles.radarMidRing, { width: radarSize * 0.57, height: radarSize * 0.57, borderRadius: radarSize * 0.285 }]} />

              <View style={[styles.radarCenter, { width: radarSize * 0.31, height: radarSize * 0.31, borderRadius: radarSize * 0.155 }]}>
                <Ionicons name="search" size={Math.max(20, radarSize * 0.11)} color={Colors.white} />
              </View>

              <FloatingParticle top="18%" left="74%" delay={0} />
              <FloatingParticle top="72%" left="18%" delay={300} />
              <FloatingParticle top="22%" left="12%" delay={600} />
              <FloatingParticle top="78%" left="72%" delay={900} />
              <FloatingParticle top="45%" left="5%" delay={450} size={5} />
              <FloatingParticle top="20%" left="45%" delay={750} size={5} />
            </View>

            <View style={styles.scanTextArea}>
              <Text style={styles.scanTitle}>Scanning the universe...</Text>
              <Text style={styles.scanSubtitle}>Looking for your perfect match</Text>
            </View>

            <View style={styles.onlineCountRow}>
              <View style={styles.onlineDotGreen} />
              <Text style={styles.onlineCountText}>{onlineCount.toLocaleString()} people available</Text>
            </View>

            <View style={styles.avatarStack}>
              {['😊', '😎', '🤩', '🦋'].map((emoji, i) => (
                <View
                  key={i}
                  style={[styles.stackBubble, i > 0 && { marginLeft: -10 }]}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </View>
              ))}
              <View style={[styles.stackCount, { marginLeft: -8 }]}>
                <Text style={styles.stackCountText}>+{formatCount(onlineCount)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.scanFooter, { bottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                match.stopScanning();
              }}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
              testID="stop-button"
            >
              <Ionicons name="close" size={18} color={Colors.danger} />
              <Text style={styles.cancelText}>Cancel Search</Text>
            </Pressable>
          </View>
        </View>
      )}

      {match.phase === 'matched' && (
        <View style={[styles.fullPhase, { paddingTop: insets.top + 12 + webTopInset }]}>
          <View style={styles.header}>
            <View style={styles.headerIconBtn} />
            <Text style={styles.headerTitle}>Lucky Chat</Text>
            <View style={styles.headerIconBtn} />
          </View>

          <View style={styles.matchBody}>
            <View style={matchStyles.sparkleWrap}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <MatchSparkle key={i} angle={angle} distance={70} />
              ))}
              <View style={matchStyles.matchIconBg}>
                <Ionicons name="heart" size={28} color={Colors.white} />
              </View>
            </View>

            <Text style={matchStyles.title}>It's a Match!</Text>
            <Text style={matchStyles.subtitle}>Your lucky connection is here</Text>

            <View style={matchStyles.avatarRow}>
              <View style={matchStyles.avatarBubble}>
                <Avatar
                  name={userProfile?.displayName || ''}
                  uri={!userProfile?.avatarId ? userProfile?.photoURL : undefined}
                  avatarId={userProfile?.avatarId || undefined}
                  size={88}
                />
                <Text style={matchStyles.avatarLabel} numberOfLines={1}>You</Text>
              </View>

              <View style={matchStyles.vsCircle}>
                <Text style={matchStyles.vsText}>💬</Text>
              </View>

              <View style={matchStyles.avatarBubble}>
                <Avatar
                  name={match.matchedUserName || 'Stranger'}
                  uri={match.matchedUserPhoto || undefined}
                  size={88}
                />
                <Text style={matchStyles.avatarLabel} numberOfLines={1}>
                  {match.matchedUserName?.split(' ')[0] || 'Stranger'}
                </Text>
              </View>
            </View>

            <CountdownTimer onComplete={handleAutoChat} />

            <View style={matchStyles.actions}>
              <Pressable
                onPress={handleSayHello}
                style={({ pressed }) => [matchStyles.sayHelloBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
                testID="chat-button"
              >
                <Ionicons name="chatbubble" size={20} color={Colors.white} />
                <Text style={matchStyles.sayHelloText}>Say Hello!</Text>
              </Pressable>

              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [matchStyles.skipBtn, pressed && { opacity: 0.7 }]}
                testID="skip-button"
              >
                <Text style={matchStyles.skipText}>Skip for now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const matchStyles = StyleSheet.create({
  sparkleWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  matchIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  title: {
    fontFamily: fontWeight.bold,
    fontSize: 30,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 24,
  },
  avatarBubble: {
    alignItems: 'center',
    gap: 8,
  },
  avatarLabel: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
    maxWidth: 80,
    textAlign: 'center',
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    borderWidth: 2,
    borderColor: Colors.white,
    ...shadow.sm,
  },
  vsText: {
    fontSize: 20,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginBottom: 24,
  },
  countdownText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.primary,
  },
  actions: {
    width: '100%',
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: 14,
  },
  sayHelloBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    width: '100%',
    ...shadow.lg,
  },
  sayHelloText: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.lg,
    color: Colors.white,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.md,
    color: Colors.text.tertiary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  fullPhase: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.status.online,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  premiumPillText: {
    fontFamily: fontWeight.semiBold,
    fontSize: 10,
    color: '#FFB300',
  },
  notifWrap: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  notifBadgeText: {
    fontFamily: fontWeight.bold,
    fontSize: 8,
    color: Colors.white,
  },
  greetingCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...shadow.sm,
  },
  greetingCardInner: {
    marginBottom: 12,
  },
  greetingText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.lg,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  greetingSubText: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 3,
  },
  greetingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xl,
    color: Colors.primary,
  },
  statLabel: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border.light,
  },
  idleScrollContent: {
    flexGrow: 1,
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  heroTitle: {
    fontFamily: fontWeight.bold,
    fontSize: 26,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTitleAccent: {
    fontFamily: fontWeight.bold,
    fontSize: 26,
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  buttonArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  startButton: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    boxShadow: '0px 8px 32px rgba(45, 181, 83, 0.35)',
  } as any,
  startButtonPressed: {
    transform: [{ scale: 0.93 }],
    boxShadow: '0px 4px 16px rgba(45, 181, 83, 0.25)',
  } as any,
  startButtonDisabled: {
    backgroundColor: Colors.gray[400],
    boxShadow: 'none',
  } as any,
  startButtonPremium: {
    backgroundColor: Colors.primaryDark,
    boxShadow: '0px 8px 32px rgba(45, 181, 83, 0.5), 0px 0px 16px rgba(255, 215, 0, 0.2)',
  } as any,
  startText: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.md,
    color: Colors.white,
    letterSpacing: 2.5,
    marginTop: 6,
  },
  disabledNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.gray[100],
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  disabledNoticeText: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.xs,
    color: Colors.text.tertiary,
  },
  limitActions: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  watchAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
  },
  watchAdText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.white,
  },
  goPremiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
  },
  goPremiumText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.sm,
    color: Colors.white,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(45,181,83,0.15)',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  onlinePillText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.primary,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  radarWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  radarOuterRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  radarMidRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  radarCenter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    boxShadow: '0px 4px 20px rgba(45,181,83,0.4)',
  } as any,
  scanTextArea: {
    alignItems: 'center',
    marginBottom: 12,
  },
  scanTitle: {
    fontFamily: fontWeight.bold,
    fontSize: fontSize.xxl,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  scanSubtitle: {
    fontFamily: fontWeight.regular,
    fontSize: fontSize.md,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  onlineCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  onlineDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  onlineCountText: {
    fontFamily: fontWeight.medium,
    fontSize: fontSize.sm,
    color: Colors.text.secondary,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stackCount: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stackCountText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.xs,
    color: Colors.white,
  },
  scanFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
  },
  cancelButtonPressed: {
    backgroundColor: Colors.dangerLight,
  },
  cancelText: {
    fontFamily: fontWeight.semiBold,
    fontSize: fontSize.md,
    color: Colors.danger,
  },
  matchBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
