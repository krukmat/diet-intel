import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, ScrollView, Alert, ToastAndroid, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../contexts/ProfileContext';
import { apiService } from '../services/ApiService';

// EPIC_A.A1: Pantalla principal de perfil con manejo de privacidad (~120 tokens)

export const ProfileScreen: React.FC = () => {
  const { profile, loading, error, refreshProfile, isOwner } = useProfile();
  const navigation = useNavigation();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false); // EPIC_A.A3: Block state
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [blockProcessing, setBlockProcessing] = useState(false); // EPIC_A.A3: Block processing state

  useEffect(() => {
    refreshProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      setIsFollowing(profile.follow_relation === 'active');
      setIsBlocked(profile.block_relation === 'blocked'); // EPIC_A.A3
      setIsBlockedBy(profile.block_relation === 'blocked_by');
    } else {
      setIsFollowing(false);
      setIsBlocked(false);
      setIsBlockedBy(false);
    }
  }, [profile]);

  const showMessage = (message: string, title?: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(title ?? 'Notice', message);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile || isProcessing || (isBlocked || isBlockedBy)) {
      return;
    }

    const wasFollowing = isFollowing;
    setIsProcessing(true);

    try {
      if (wasFollowing) {
        await apiService.unfollowUser(profile.user_id);
        setIsFollowing(false);
        showMessage('Unfollowed user');
      } else {
        const response = await apiService.followUser(profile.user_id);
        const result = response.data;

        if (!result?.ok) {
          const blockedMessage = result?.status === 'blocked'
            ? 'You cannot follow this user right now.'
            : 'Unable to follow this user.';
          showMessage(blockedMessage, 'Follow action');
          return;
        }

        setIsFollowing(true);
        showMessage('Now following user');
      }

      await refreshProfile();
    } catch (err) {
      console.error('ProfileScreen follow toggle error', err);
      const errorMessage = wasFollowing ? 'Unable to unfollow user' : 'Unable to follow user';
      showMessage(errorMessage, 'Follow action failed');
      setIsFollowing(wasFollowing);
    } finally {
      setIsProcessing(false);
    }
  };

  // EPIC_A.A3: Block toggle handler
  const handleBlockToggle = async () => {
    if (!profile || blockProcessing) {
      return;
    }

    const wasBlocked = isBlocked;
    const wasBlockedBy = isBlockedBy;

    // Prevent unblocking of users who blocked us
    if (!wasBlocked && wasBlockedBy) {
      showMessage('You cannot block this user right now.', 'Block action');
      return;
    }

    setBlockProcessing(true);

    try {
      if (wasBlocked) {
        await apiService.unblockUser(profile.user_id);
        setIsBlocked(false);
        showMessage('User unblocked');
      } else if (!wasBlockedBy) {
        await apiService.blockUser(profile.user_id);
        setIsBlocked(true);
        setIsFollowing(false); // Block automatically removes follow
        showMessage('User blocked');
      }

      await refreshProfile();
    } catch (err) {
      console.error('ProfileScreen block toggle error', err);
      showMessage('Block action failed', 'Error');
      // Restore previous state on error
      setIsBlocked(wasBlocked);
      setIsBlockedBy(wasBlockedBy);
    } finally {
      setBlockProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No profile data</Text>
      </View>
    );
  }

  const viewerIsOwner = isOwner(profile.user_id);

  return (
    <ScrollView style={styles.container}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View testID="avatar-placeholder" style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        )}
      </View>

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <Text style={styles.handle}>@{profile.handle}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        <Text style={styles.visibility}>
          Profile: {profile.visibility === 'public' ? 'Public' : 'Followers Only'}
        </Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile.stats.followers_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile.stats.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile.stats.posts_count}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile.stats.points_total}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
      </View>

      {/* Posts Notice - KEY FEATURE */}
      {profile.posts_notice && (
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyText}>{profile.posts_notice}</Text>
        </View>
      )}

      {/* Action Buttons - EPIC A.A2/A.A3 */}
      <View style={styles.actionsContainer}>
        {!viewerIsOwner && (
          <>
            {/* Follow/Unfollow Button */}
            <TouchableOpacity
              testID="follow-toggle-button"
              style={[
                styles.followButton,
                isFollowing ? styles.followingButton : styles.followButtonPrimary,
                (isProcessing || isBlocked || isBlockedBy) && styles.followButtonDisabled,
              ]}
              onPress={handleFollowToggle}
              disabled={isProcessing || blockProcessing || isBlocked || isBlockedBy}
            >
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followingButtonText,
                ]}
              >
                {isProcessing ? 'Processing...' :
                 isBlocked || isBlockedBy ? 'Follow' : // Show Follow even when not following, but disabled
                 isFollowing ? 'Unfollow' : 'Follow'}
              </Text>
            </TouchableOpacity>

            {/* EPIC_A.A3: Block/Unblock Button */}
            <TouchableOpacity
              testID="block-toggle-button"
              style={[
                styles.blockButton,
                blockProcessing && styles.buttonDisabled,
              ]}
              onPress={handleBlockToggle}
              disabled={blockProcessing}
            >
              <Text style={styles.blockButtonText}>
                {blockProcessing ? 'Processing...' :
                 isBlocked ? 'Unblock' : 'Block'}
              </Text>
            </TouchableOpacity>

            {/* EPIC_A.A3: Block status notice */}
            {isBlockedBy && (
              <View style={styles.blockNotice}>
                <Text style={styles.blockNoticeText}>This user has blocked you</Text>
              </View>
            )}
          </>
        )}

        {/* Owner Edit Button */}
        {viewerIsOwner && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('profile-edit' as never)}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  handle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 12,
  },
  visibility: {
    fontSize: 14,
    color: '#888',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  privacyNotice: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  privacyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  actionsContainer: {
    marginTop: 20,
    gap: 12,
  },
  buttonContainer: {
    marginTop: 20,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  blockButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  blockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  blockNotice: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  blockNoticeText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  followButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  followButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: '#e4e7eb',
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: '#1f2933',
  },
  errorText: {
    fontSize: 16,
    color: '#d9534f',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
