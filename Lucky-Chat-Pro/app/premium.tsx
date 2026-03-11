import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { fontWeight, fontSize, spacing, borderRadius, shadow } from '@/constants/theme';
import { useSubscription } from '@/lib/revenuecat';
import { useAppAlert } from '@/contexts/AlertContext';

const FEATURES = [
  { icon: 'infinite-outline' as const, title: 'Unlimited Matches', desc: 'No daily limit on random matching' },
  { icon: 'ban-outline' as const, title: 'Ad-Free Experience', desc: 'No banner, interstitial, or rewarded ads' },
  { icon: 'rocket-outline' as const, title: 'Profile Boost', desc: 'Always appear first in search results' },
  { icon: 'checkmark-done-outline' as const, title: 'Read Receipts', desc: 'See when your messages are read' },
  { icon: 'pencil-outline' as const, title: 'Typing Indicator', desc: 'See when someone is typing to you' },
  { icon: 'happy-outline' as const, title: 'Premium Avatars', desc: '30+ exclusive emoji avatars' },
  { icon: 'star-outline' as const, title: 'Premium Badge', desc: 'Stand out with a star badge on your profile' },
  { icon: 'heart-outline' as const, title: 'Message Reactions', desc: 'React to messages with emojis' },
  { icon: 'color-palette-outline' as const, title: 'Chat Themes', desc: 'Customize chat background colors' },
  { icon: 'arrow-undo-outline' as const, title: 'Undo Delete', desc: 'Recover deleted messages within 5 minutes' },
  { icon: 'people-outline' as const, title: 'See Who Viewed You', desc: 'Know who checked your profile' },
  { icon: 'filter-outline' as const, title: 'Advanced Filters', desc: 'Filter matches by gender, age and interests' },
];

const PLAN_PACKAGE_KEYS: Record<string, string> = {
  weekly: '$rc_weekly',
  monthly: '$rc_monthly',
  annual: '$rc_annual',
};

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { isSubscribed, offerings, purchase, restore, isPurchasing, isRestoring, isLoading } = useSubscription();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const { showAlert, showError, showSuccess } = useAppAlert();
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [confirmVisible, setConfirmVisible] = useState(false);

  const currentOffering = offerings?.current;

  const getPackage = (key: string) =>
    currentOffering?.availablePackages?.find((p) => p.packageType === key || p.identifier === key);

  const weeklyPkg = getPackage('$rc_weekly') || getPackage('WEEKLY');
  const monthlyPkg = getPackage('$rc_monthly') || getPackage('MONTHLY');
  const annualPkg = getPackage('$rc_annual') || getPackage('ANNUAL');

  const weeklyPrice = weeklyPkg?.product?.priceString || '$0.99/wk';
  const monthlyPrice = monthlyPkg?.product?.priceString || '$1.99/mo';
  const annualPrice = annualPkg?.product?.priceString || '$9.99/yr';

  const selectedPackage =
    selectedPlan === 'weekly' ? weeklyPkg :
    selectedPlan === 'annual' ? annualPkg :
    monthlyPkg;

  const handleSubscribe = () => {
    if (!selectedPackage) {
      showError('Not Available', 'Unable to load products. Please check your connection and try again.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmVisible(true);
  };

  const confirmPurchase = async () => {
    setConfirmVisible(false);
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess('Welcome to Premium!', 'Your subscription is now active. Enjoy all premium features!', () => router.back());
    } catch (e: any) {
      if (e?.userCancelled) return;
      showError('Purchase Failed', e?.message || 'Something went wrong. Please try again.');
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const info = await restore();
      const active = info?.entitlements?.active?.['premium'];
      if (active) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Subscription Restored!', 'Your premium subscription has been successfully restored.', () => router.back());
      } else {
        showAlert({ title: 'No Subscription Found', message: 'We could not find an active subscription linked to your Google Play account.', type: 'warning' });
      }
    } catch (e: any) {
      showError('Restore Failed', e?.message || 'Something went wrong. Please try again.');
    }
  };

  const plans = [
    {
      key: 'weekly' as const,
      label: 'Weekly',
      price: weeklyPrice,
      sub: 'Try it out',
      badge: null,
    },
    {
      key: 'monthly' as const,
      label: 'Monthly',
      price: monthlyPrice,
      sub: 'Cancel anytime',
      badge: 'POPULAR',
    },
    {
      key: 'annual' as const,
      label: 'Annual',
      price: annualPrice,
      sub: 'Best value — save 58%',
      badge: 'BEST VALUE',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Lucky Premium</Text>
        <Pressable onPress={handleRestore} style={styles.restoreBtn} disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.restoreBtnText}>Restore</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.crownBadge}>
            <Ionicons name="diamond" size={40} color="#FFD700" />
          </View>
          <Text style={styles.heroTitle}>Unlock Everything</Text>
          <Text style={styles.heroSubtitle}>
            Get the ultimate Lucky Chat experience with Premium
          </Text>
        </View>

        {isSubscribed && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.activeBadgeText}>Premium Active — Enjoy your benefits!</Text>
          </View>
        )}

        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={20} color={Colors.primary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
              <Ionicons name="checkmark" size={18} color={Colors.primary} />
            </View>
          ))}
        </View>

        {!isSubscribed && (
          <>
            <Text style={styles.planSectionTitle}>Choose your plan</Text>
            <View style={styles.plansRow}>
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.key;
                return (
                  <Pressable
                    key={plan.key}
                    style={[styles.planCard, isSelected && styles.planCardSelected]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPlan(plan.key);
                    }}
                  >
                    {plan.badge && (
                      <View style={[styles.planBadge, isSelected && styles.planBadgeSelected]}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>{plan.label}</Text>
                    <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{plan.price}</Text>
                    <Text style={[styles.planSub, isSelected && styles.planSubSelected]}>{plan.sub}</Text>
                    {isSelected && <View style={styles.planCheckDot}><Ionicons name="checkmark" size={12} color={Colors.white} /></View>}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.subscribeBtn,
                (isPurchasing || isLoading) && styles.subscribeBtnDisabled,
                pressed && styles.subscribeBtnPressed,
              ]}
              onPress={handleSubscribe}
              disabled={isPurchasing || isLoading}
            >
              {isPurchasing ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color="#FFD700" />
                  <Text style={styles.subscribeBtnText}>
                    Subscribe — {selectedPlan === 'weekly' ? weeklyPrice : selectedPlan === 'annual' ? annualPrice : monthlyPrice}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.restoreRow} onPress={handleRestore} disabled={isRestoring}>
              <Text style={styles.restoreRowText}>
                {isRestoring ? 'Restoring...' : 'Already subscribed? Restore purchase'}
              </Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Subscription auto-renews via Google Play. Cancel anytime in Play Store settings.
              Payment will be charged to your Google Play account at purchase confirmation.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIcon}>
              <Ionicons name="diamond" size={32} color="#FFD700" />
            </View>
            <Text style={styles.modalTitle}>Confirm Subscription</Text>
            <Text style={styles.modalDesc}>
              You are about to subscribe to Lucky Chat{' '}
              {selectedPlan === 'weekly' ? `Weekly for ${weeklyPrice}` :
               selectedPlan === 'annual' ? `Annual for ${annualPrice}` :
               `Monthly for ${monthlyPrice}`}.
            </Text>
            <Text style={styles.modalNote}>
              Payment will be charged through Google Play. Subscription renews automatically.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmPurchase}>
                <Text style={styles.modalConfirmText}>Subscribe Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontWeight.bold, fontSize: fontSize.xl, color: Colors.text.primary },
  restoreBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  restoreBtnText: { fontFamily: fontWeight.semiBold, fontSize: fontSize.sm, color: Colors.primary },
  content: { paddingHorizontal: spacing.xxl },
  heroSection: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  crownBadge: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, ...shadow.md,
  },
  heroTitle: { fontFamily: fontWeight.bold, fontSize: 26, color: Colors.text.primary, marginBottom: 8 },
  heroSubtitle: {
    fontFamily: fontWeight.regular, fontSize: fontSize.md,
    color: Colors.text.secondary, textAlign: 'center', lineHeight: 22,
  },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primaryLight, paddingVertical: 12,
    borderRadius: borderRadius.md, marginBottom: 20,
  },
  activeBadgeText: { fontFamily: fontWeight.semiBold, fontSize: fontSize.md, color: Colors.primary },
  featuresSection: { gap: 14, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.primaryFaded, alignItems: 'center', justifyContent: 'center',
  },
  featureInfo: { flex: 1 },
  featureTitle: { fontFamily: fontWeight.semiBold, fontSize: fontSize.sm, color: Colors.text.primary },
  featureDesc: { fontFamily: fontWeight.regular, fontSize: fontSize.xs, color: Colors.text.tertiary, marginTop: 1 },
  planSectionTitle: {
    fontFamily: fontWeight.bold, fontSize: fontSize.lg,
    color: Colors.text.primary, marginBottom: 14, textAlign: 'center',
  },
  plansRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  planCard: {
    flex: 1, borderWidth: 2, borderColor: Colors.border.medium,
    borderRadius: borderRadius.lg, paddingVertical: 16, paddingHorizontal: 10,
    alignItems: 'center', position: 'relative', backgroundColor: Colors.white,
  },
  planCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaded },
  planBadge: {
    position: 'absolute', top: -10, backgroundColor: Colors.gray[300],
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full,
  },
  planBadgeSelected: { backgroundColor: Colors.primary },
  planBadgeText: { fontFamily: fontWeight.bold, fontSize: 9, color: Colors.white, letterSpacing: 0.5 },
  planLabel: { fontFamily: fontWeight.bold, fontSize: fontSize.sm, color: Colors.text.secondary, marginBottom: 6 },
  planLabelSelected: { color: Colors.primary },
  planPrice: { fontFamily: fontWeight.bold, fontSize: fontSize.md, color: Colors.text.primary, marginBottom: 4 },
  planPriceSelected: { color: Colors.primary },
  planSub: { fontFamily: fontWeight.regular, fontSize: 10, color: Colors.text.tertiary, textAlign: 'center' },
  planSubSelected: { color: Colors.primaryDark },
  planCheckDot: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: 16, marginBottom: 14,
    ...shadow.md,
    boxShadow: '0px 4px 16px rgba(45,181,83,0.35)',
  } as any,
  subscribeBtnDisabled: { opacity: 0.65 },
  subscribeBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  subscribeBtnText: { fontFamily: fontWeight.bold, fontSize: fontSize.md, color: Colors.white },
  restoreRow: { alignItems: 'center', marginBottom: 16 },
  restoreRowText: { fontFamily: fontWeight.regular, fontSize: fontSize.sm, color: Colors.primary },
  disclaimer: {
    fontFamily: fontWeight.regular, fontSize: fontSize.xs,
    color: Colors.text.tertiary, textAlign: 'center', lineHeight: 17, marginBottom: 4,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: Colors.white, borderRadius: borderRadius.xl,
    padding: 24, width: '100%', maxWidth: 360, alignItems: 'center',
  },
  modalIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...shadow.sm,
  },
  modalTitle: { fontFamily: fontWeight.bold, fontSize: fontSize.xl, color: Colors.text.primary, marginBottom: 8 },
  modalDesc: {
    fontFamily: fontWeight.regular, fontSize: fontSize.md,
    color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 10,
  },
  modalNote: {
    fontFamily: fontWeight.regular, fontSize: fontSize.xs,
    color: Colors.text.tertiary, textAlign: 'center', lineHeight: 16, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: {
    flex: 1, paddingVertical: 13, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border.medium, alignItems: 'center',
  },
  modalCancelText: { fontFamily: fontWeight.semiBold, fontSize: fontSize.md, color: Colors.text.secondary },
  modalConfirm: {
    flex: 1, paddingVertical: 13, borderRadius: borderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalConfirmText: { fontFamily: fontWeight.bold, fontSize: fontSize.md, color: Colors.white },
});
