// Profile follow/unfollow functionality - EPIC A.A2

function toggleFollow(event, targetUserId) {
    if (event) {
        event.preventDefault();
    }

    const followButton = event?.currentTarget || document.querySelector('.btn-follow');
    const form = followButton ? followButton.closest('.follow-form') : document.querySelector('.follow-form');
    const actionInput = form ? form.querySelector('#follow-action') : null;
    const feedback = document.getElementById('follow-feedback');

    if (!followButton || !form || !actionInput) {
        console.error('Follow button or form not found');
        return;
    }

    if (targetUserId) {
        followButton.dataset.targetUserId = targetUserId;
    }

    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = '';
        feedback.className = 'follow-feedback';
    }

    const requestAction = actionInput.value;
    const originalText = followButton.textContent.trim();
    const isFollowRequest = requestAction === 'follow';

    followButton.disabled = true;

    fetch(form.action, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            action: requestAction
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.ok) {
            const reason = data.status === 'blocked'
                ? 'You cannot follow this user.'
                : 'Follow action could not be completed.';
            throw new Error(reason);
        }

        const nextAction = isFollowRequest ? 'unfollow' : 'follow';
        const nextText = isFollowRequest ? 'Unfollow' : 'Follow';
        const isNowFollowing = isFollowRequest;

        actionInput.value = nextAction;
        followButton.textContent = nextText;
        followButton.classList.toggle('following', isNowFollowing);

        if (data.followers_count !== undefined) {
            updateCount('.stat-label', 'Followers', data.followers_count);
        }
        if (data.following_count !== undefined) {
            updateCount('.stat-label', 'Following', data.following_count);
        }
    })
    .catch(error => {
        console.error('Follow action failed:', error);
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = error.message;
            feedback.className = 'follow-feedback error';
        } else {
            showFollowError(error.message);
        }
    })
    .finally(() => {
        followButton.disabled = false;
    });
}

function updateCount(selector, labelText, newValue) {
    const labels = document.querySelectorAll(selector);
    labels.forEach(label => {
        if (label.textContent.trim() === labelText) {
            const numberSpan = label.previousElementSibling;
            if (numberSpan && numberSpan.classList.contains('stat-number')) {
                numberSpan.textContent = newValue;
            }
        }
    });
}

function showFollowError(message) {
    // Simple error notification - could be enhanced with toast library
    const errorDiv = document.createElement('div');
    errorDiv.className = 'follow-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    errorDiv.textContent = `Follow action failed: ${message}`;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Initialize follow functionality when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile follow functionality loaded');

    // Add any initialization logic here
    // For example, fetch initial follow state if needed
});

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggleFollow,
        updateCount,
        showFollowError
    };
}
