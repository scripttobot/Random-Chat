# Lucky Chat

React Native Expo messaging app with Firebase backend (no external server needed).

## Architecture

- **Frontend**: React Native Expo SDK 54 with Expo Router (file-based routing)
- **Backend**: Firebase (Auth, Firestore, Storage) — client-side only, no server
- **Dev Server**: Expo Web on port 5000
- **Language**: TypeScript

## Running the App

- Workflow: `Start application` runs `npx expo start --web --port 5000`
- Preview available in Replit webview

## Core Features

- Firebase Auth (Email/Password, Google Sign-In)
- Omegle-style random matching with scanQueue
- Real-time Messenger-style chat
- 24-hour rolling message cleanup (ephemeral messaging)
- User search with chat request system
- Profile with 24 free + 32 premium emoji avatars
- Online status tracking
- Message edit/delete with long-press menu
- Level system (5 tiers: Newbie → Lucky Legend) based on totalChats + totalMatches
- Block user system (from chat header menu, message long-press, or settings)
- Gender-based suggested users (free=10, paid=50, male paid sees females first)
- Boost Profile with real-time countdown timer
- Gender selector in profile form (Male/Female/Other)
- Compact scrollable avatar grid in profile (maxHeight 220px)

## Bug Fixes Applied

- **Random match duplicates**: `tryFindMatch()` now queries existing accepted conversations first; skips candidates already in conversation with current user
- **Search page "Chat" vs "Message"**: Added `useExistingConversations` hook (Map<userId, conversationId>); search page shows "Message" button (navigates to chat) for existing conversation partners, "Pending" for pending requests, "Chat" for new connections
- **Input overflow**: `Input.tsx` wrapper now uses `minHeight: 52` instead of fixed `height: 52`; multiline variant uses `alignItems: 'flex-start'` + `paddingVertical`; removed `height: '100%'` from input style; `outlineStyle: 'none'` for clean web rendering

## Key Files

- `app/` — Expo Router screens (tabs, auth, chat, premium, profile)
- `app/(tabs)/` — Main navigation (Home, Search, Chats, Settings)
- `app/auth/` — Login, Register, Forgot Password screens
- `app/chat/[id].tsx` — Individual chat conversation
- `hooks/useChat.ts` — Chat operations (send, edit, delete, requests)
- `hooks/useMatch.ts` — Random matching algorithm
- `hooks/useEphemeral.ts` — 24h message cleanup
- `contexts/AuthContext.tsx` — Auth + profile management
- `contexts/PremiumContext.tsx` — Premium/subscription state
- `lib/firebase.ts` — Firebase config (hardcoded keys)
- `lib/ads.ts` — AdMob integration (test IDs)
- `lib/query-client.ts` — React Query config
- `components/` — Reusable UI (ads, chat, common)
- `constants/` — Colors, theme, avatars
- `firestore.rules` — Firestore security rules

## Firebase Config

All Firebase keys are hardcoded in `lib/firebase.ts`:
- Project ID: lucky-chat-7c535
- No environment variables needed for Firebase

## Monetization

- AdMob integration (Banner, Interstitial, Rewarded ads)
- Premium subscription model with match limits
- Premium avatars and profile boost

## Dependencies

Key packages: expo, expo-router, firebase, react-native-web, react-native-reanimated, react-native-gesture-handler, @tanstack/react-query, expo-blur, expo-linear-gradient

## GitHub

- Repo: https://github.com/scripttobot/Lucky-Chat
