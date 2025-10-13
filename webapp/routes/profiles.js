const express = require('express');
const router = express.Router();
const { requireAuth, checkAuth } = require('../middleware/auth');
const dietIntelAPI = require('../utils/api');

// GET /profiles/me/edit - Show edit form
router.get('/me/edit', requireAuth, async (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.redirect('/login');

    try {
        const currentUser = await dietIntelAPI.getCurrentUser(token);
        const profile = await dietIntelAPI.getProfile(currentUser.id, token);

        res.render('profiles/edit', {
            profile,
            currentUser,
            canEdit: true
        });
    } catch (error) {
        console.error('Profile edit error:', error);
        res.status(500).send('Error loading profile edit');
    }
});

// POST /me - Update profile
router.post('/me', requireAuth, async (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.redirect('/login');

    try {
        // Simple validation
        const { handle, bio, visibility } = req.body;

        if (handle && (!handle.match(/^[a-z0-9_]{3,30}$/))) {
            return res.render('profiles/edit', {
                profile: { ...req.body, user_id: res.locals.currentUser.id },
                currentUser: res.locals.currentUser,
                canEdit: true,
                error: 'Invalid handle format'
            });
        }

        if (bio && bio.length > 280) {
            return res.render('profiles/edit', {
                profile: { ...req.body, user_id: res.locals.currentUser.id },
                currentUser: res.locals.currentUser,
                canEdit: true,
                error: 'Bio too long'
            });
        }

        const updateData = {};
        if (handle !== undefined) updateData.handle = handle;
        if (bio !== undefined) updateData.bio = bio;
        if (visibility !== undefined) updateData.visibility = visibility;

        await dietIntelAPI.updateProfile(updateData, token);

        res.redirect(`/profiles/${res.locals.currentUser.id}`);
    } catch (error) {
        console.error('Profile update error:', error);

        // Handle 422 ValidationError responses from backend - MEJORA IMPLEMENTADA
        if (error.response?.status === 422) {
            return res.render('profiles/edit', {
                profile: { ...req.body, user_id: res.locals.currentUser.id },
                currentUser: res.locals.currentUser,
                canEdit: true,
                error: error.response.data.detail || 'Validation error'
            });
        }

        // For other errors, still render edit form with error
        return res.render('profiles/edit', {
            profile: { ...req.body, user_id: res.locals.currentUser.id },
            currentUser: res.locals.currentUser,
            canEdit: true,
            error: 'An error occurred while updating your profile'
        });
    }
});

// POST /:targetId/follow - Follow/Unfollow user (EPIC A.A2)
router.post('/:targetId/follow', requireAuth, async (req, res) => {
    const token = req.cookies.access_token;
    const targetId = req.params.targetId;
    const currentUserId = res.locals.currentUser.id;

    if (!token) return res.redirect('/login');

    try {
        // Prevent self-follow/unfollow
        if (targetId === currentUserId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const { action } = req.body; // 'follow' or 'unfollow'
        let result;

        if (action === 'follow') {
            result = await dietIntelAPI.followUser(targetId, token);
        } else if (action === 'unfollow') {
            result = await dietIntelAPI.unfollowUser(targetId, token);
        } else {
            return res.status(400).json({ error: 'Invalid action. Use "follow" or "unfollow"' });
        }

        // Return updated counts as JSON for AJAX requests
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json(result);
        }

        // For regular form submissions, redirect back to profile
        res.redirect(`/profiles/${targetId}`);

    } catch (error) {
        console.error('Follow action error:', error);

        // Handle API errors gracefully
        if (error.response?.status === 400) {
            return res.status(400).json({ error: error.response.data?.detail || 'Invalid request' });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
        }

        return res.status(500).json({ error: 'Follow action failed' });
    }
});

// POST /:targetId/block - Block/Unblock user (EPIC A.A3)
router.post('/:targetId/block', requireAuth, async (req, res) => {
    const token = req.cookies.access_token;
    const targetId = req.params.targetId;
    const currentUserId = res.locals.currentUser.id;

    if (!token) return res.redirect('/login');

    try {
        // Prevent self-block/unblock
        if (targetId === currentUserId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        const { action } = req.body; // 'block' or 'unblock'
        let result;

        if (action === 'block') {
            result = await dietIntelAPI.blockUser(targetId, token);
        } else if (action === 'unblock') {
            result = await dietIntelAPI.unblockUser(targetId, token);
        } else {
            return res.status(400).json({ error: 'Invalid action. Use "block" or "unblock"' });
        }

        // Return result as JSON for AJAX requests
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json(result);
        }

        // For regular form submissions, redirect back to profile
        res.redirect(`/profiles/${targetId}`);

    } catch (error) {
        console.error('Block action error:', error);

        // Handle API errors gracefully
        if (error.response?.status === 400) {
            return res.status(400).json({ error: error.response.data?.detail || 'Invalid request' });
        }

        if (error.response?.status === 403) {
            return res.status(403).json({ error: 'Moderation features disabled' });
        }

        return res.status(500).json({ error: 'Block action failed' });
    }
});

// GET /:userId - Show profile
router.get('/:userId', checkAuth, async (req, res) => {
    const token = req.cookies.access_token;
    const userId = req.params.userId;

    try {
        const profile = await dietIntelAPI.getProfile(userId, token);

        // EPIC A.A2: Get follow stats if viewing another user's profile
        let followStats = null;
        if (res.locals.currentUser && res.locals.currentUser.id !== userId) {
            try {
                // This would be enhanced in future to get specific follow relationship
                // For now, assume this is available via existing profile.follow_relation
            } catch (followError) {
                console.warn('Could not load follow relationship:', followError);
            }
        }

        res.render('profiles/show', {
            profile,
            currentUser: res.locals.currentUser,
            canEdit: res.locals.currentUser?.id === req.params.userId,
            followStats
        });
    } catch (error) {
        console.error('Profile view error:', error);

        // Handle 404 gracefully
        if (error.response?.status === 404) {
            return res.status(404).render('error', { message: 'Profile not found' });
        }

        res.status(500).send('Error loading profile');
    }
});

module.exports = router;
