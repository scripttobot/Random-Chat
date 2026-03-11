import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontWeight, fontSize, borderRadius, spacing } from '@/constants/theme';

export type AlertType = 'info' | 'success' | 'error' | 'warning' | 'confirm' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  icon?: string;
}

interface Props extends AppAlertConfig {
  visible: boolean;
  onDismiss: () => void;
}

const TYPE_CONFIG: Record<AlertType, { icon: string; color: string; bg: string }> = {
  info:        { icon: 'information-circle', color: '#3B82F6', bg: '#EFF6FF' },
  success:     { icon: 'checkmark-circle',   color: '#2DB553', bg: '#F0FDF4' },
  error:       { icon: 'close-circle',        color: '#EF4444', bg: '#FEF2F2' },
  warning:     { icon: 'warning',             color: '#F59E0B', bg: '#FFFBEB' },
  confirm:     { icon: 'help-circle',         color: '#8B5CF6', bg: '#F5F3FF' },
  destructive: { icon: 'trash',               color: '#EF4444', bg: '#FEF2F2' },
};

export default function AppAlert({ visible, onDismiss, title, message, type = 'info', buttons, icon }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const cfg = TYPE_CONFIG[type];
  const iconName = (icon || cfg.icon) as any;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim,    { toValue: 0.88, duration: 160, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default', onPress: undefined }];

  const handlePress = (btn: AlertButton) => {
    onDismiss();
    setTimeout(() => { btn.onPress?.(); }, 200);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      <View style={styles.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
              <Ionicons name={iconName} size={30} color={cfg.color} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.divider} />

          {resolvedButtons.length <= 2 ? (
            <View style={[styles.btnRow, resolvedButtons.length === 1 && styles.btnRowSingle]}>
              {resolvedButtons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const isLast = i === resolvedButtons.length - 1;
                return (
                  <React.Fragment key={i}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        resolvedButtons.length === 1 && styles.btnFull,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => handlePress(btn)}
                    >
                      <Text style={[
                        styles.btnText,
                        isDestructive && styles.btnDestructive,
                        isCancel && styles.btnCancel,
                        !isDestructive && !isCancel && styles.btnPrimary,
                      ]}>
                        {btn.text}
                      </Text>
                    </Pressable>
                    {!isLast && <View style={styles.btnDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          ) : (
            <View style={styles.btnStack}>
              {resolvedButtons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                return (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.btnStacked, pressed && styles.btnPressed]}
                    onPress={() => handlePress(btn)}
                  >
                    <Text style={[
                      styles.btnText,
                      isDestructive && styles.btnDestructive,
                      isCancel && styles.btnCancel,
                      !isDestructive && !isCancel && styles.btnPrimary,
                    ]}>
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const CARD_WIDTH = Math.min(Dimensions.get('window').width - 64, 320);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  centerer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingTop: 28,
    paddingHorizontal: 0,
    paddingBottom: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 24,
    overflow: 'hidden',
  },
  iconWrap: {
    marginBottom: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontWeight.bold,
    fontSize: 18,
    color: '#1A1A2E',
    textAlign: 'center',
    letterSpacing: -0.3,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  message: {
    fontFamily: fontWeight.regular,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  btnRowSingle: {},
  btn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    flex: 1,
  },
  btnPressed: {
    backgroundColor: '#F3F4F6',
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  btnStack: {
    width: '100%',
  },
  btnStacked: {
    paddingVertical: 15,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  btnText: {
    fontFamily: fontWeight.semiBold,
    fontSize: 16,
    letterSpacing: -0.1,
  },
  btnPrimary: {
    color: '#2DB553',
  },
  btnDestructive: {
    color: '#EF4444',
  },
  btnCancel: {
    color: '#6B7280',
    fontFamily: fontWeight.regular,
  },
});
