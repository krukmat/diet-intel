/**
 * EPIC_A.A4: Feed page JavaScript utilities
 *
 * Enhances the feed UI with AJAX functionality and better UX.
 */

/**
 * Handles loading more feed items via AJAX
 */
function loadMoreFeed(cursor, limit = <%= pagination.limit %>) {
    const loadButton = document.getElementById('load-more-btn');
    const originalText = loadButton.textContent;

    // Update UI to show loading state
    loadButton.textContent = 'Loading...';
    loadButton.disabled = true;
    loadButton.classList.add('opacity-50');

    // Build URL with pagination parameters
    const params = new URLSearchParams({
        limit: limit.toString(),
        cursor: cursor
    });

    // Make AJAX request
    fetch(`/feed?${params}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.items && data.items.length > 0) {
            // Append new items to the feed
            appendFeedItems(data.items);

            // Update or hide load more button
            if (data.next_cursor) {
                // Update button to use new cursor
                loadButton.textContent = originalText;
                loadButton.disabled = false;
                loadButton.classList.remove('opacity-50');
                loadButton.onclick = () => loadMoreFeed(data.next_cursor, limit);
            } else {
                // No more items, hide the button
                loadButton.style.display = 'none';
            }
        } else {
            // No more items available
            loadButton.textContent = 'No more activity';
            loadButton.disabled = true;
            loadButton.classList.add('opacity-50');
        }
    })
    .catch(error => {
        console.error('Error loading more feed items:', error);

        // Show error state on button
        loadButton.textContent = 'Error - Try again';
        loadButton.disabled = false;
        loadButton.classList.remove('opacity-50');
        loadButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white');

        // Reset after 3 seconds
        setTimeout(() => {
            loadButton.textContent = originalText;
            loadButton.classList.remove('bg-red-500', 'hover:bg-red-600', 'text-white');
        }, 3000);
    });
}

/**
 * Appends new feed items to the existing feed list
 */
function appendFeedItems(items) {
    const feedContainer = document.querySelector('.space-y-4');

    if (!feedContainer) {
        console.error('Feed container not found');
        return;
    }

    items.forEach(item => {
        const itemElement = createFeedItemElement(item);
        feedContainer.appendChild(itemElement);
    });
}

/**
 * Creates a DOM element for a single feed item
 */
function createFeedItemElement(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex items-start space-x-4 p-4 border-b border-gray-200 last:border-b-0';

    // Avatar placeholder
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold';
    const initials = item.actor_id.substring(0, 2).toUpperCase();
    avatarDiv.textContent = initials;
    itemDiv.appendChild(avatarDiv);

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1 min-w-0';

    const textDiv = document.createElement('div');
    textDiv.className = 'text-sm text-gray-900';

    let actionText = '';
    const targetIdShort = item.payload.target_id ? item.payload.target_id.substring(0, 8) : 'someone';
    const blockerIdShort = item.payload.blocker_id ? item.payload.blocker_id.substring(0, 8) : 'someone';
    const blockedIdShort = item.payload.blocked_id ? item.payload.blocked_id.substring(0, 8) : 'someone';

    switch (item.event_name) {
        case 'UserAction.UserFollowed':
            actionText = `<span class="font-medium">${targetIdShort}</span> was followed`;
            break;
        case 'UserAction.UserUnfollowed':
            actionText = `<span class="font-medium">${targetIdShort}</span> was unfollowed`;
            break;
        case 'UserAction.UserBlocked': {
            actionText = `<span class="font-medium">${blockedIdShort}</span> was blocked`;
            if (item.payload.reason) {
                actionText += ` <span class="text-gray-500">(${item.payload.reason})</span>`;
            }
            break;
        }
        case 'UserAction.UserUnblocked':
            actionText = `<span class="font-medium">${blockedIdShort}</span> was unblocked`;
            break;
        default:
            actionText = '<span class="text-gray-500">Unknown activity</span>';
    }

    textDiv.innerHTML = actionText;
    contentDiv.appendChild(textDiv);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-500 mt-1';
    timeDiv.textContent = new Date(item.created_at).toLocaleString();
    contentDiv.appendChild(timeDiv);

    itemDiv.appendChild(contentDiv);

    return itemDiv;
}

/**
 * Auto-refresh feed items periodically (optional enhancement)
 */
function setupAutoRefresh(intervalMinutes = 5) {
    const intervalMs = intervalMinutes * 60 * 1000;

    setInterval(() => {
        // Only auto-refresh if user hasn't interacted recently
        if (document.hidden) return; // Skip if tab not visible

        console.log('Auto-refreshing feed...');

        // Reload the current page to get fresh data
        // In a more advanced implementation, this could do partial updates
        window.location.reload();

    }, intervalMs);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Set up auto-refresh for active users (optional)
    // setupAutoRefresh(5); // Every 5 minutes

    console.log('Feed page initialized');
});
