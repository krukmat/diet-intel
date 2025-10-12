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
            return res.render('profiles/edit', { error: 'Invalid handle format' });
        }

        if (bio && bio.length > 280) {
            return res.render('profiles/edit', { error: 'Bio too long' });
        }

        const updateData = {};
        if (handle !== undefined) updateData.handle = handle;
        if (bio !== undefined) updateData.bio = bio;
        if (visibility !== undefined) updateData.visibility = visibility;

        await dietIntelAPI.updateProfile(updateData, token);

        res.redirect(`/profiles/${res.locals.currentUser.id}`);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).send('Error updating profile');
    }
});

// GET /:userId - Show profile
router.get('/:userId', checkAuth, async (req, res) => {
    const token = req.cookies.access_token;
    const userId = req.params.userId;

    try {
        const profile = await dietIntelAPI.getProfile(userId, token);

        res.render('profiles/show', {
            profile,
            currentUser: res.locals.currentUser,
            canEdit: res.locals.currentUser?.id === req.params.userId
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
