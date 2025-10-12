/**
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom');

const initialDom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = initialDom.window;
global.document = initialDom.window.document;
global.HTMLElement = initialDom.window.HTMLElement;
global.Node = initialDom.window.Node;

global.fetch = jest.fn();

const { toggleFollow, updateCount, showFollowError } = require('../public/js/profile.js');

const createMarkup = () => `
  <div class="follow-actions">
    <div id="follow-feedback" class="follow-feedback" hidden></div>
    <form class="follow-form" action="/profiles/test/follow" method="POST">
      <input type="hidden" name="action" id="follow-action" value="follow">
      <button type="submit" id="follow-button" class="btn btn-follow">Follow</button>
    </form>
  </div>
  <div class="profile-stats">
    <div class="stat-item">
      <span class="stat-number">10</span>
      <span class="stat-label">Followers</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">5</span>
      <span class="stat-label">Following</span>
    </div>
  </div>
`;

const createEvent = (target) => ({
  preventDefault: jest.fn(),
  currentTarget: target,
});

const assignDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('Profile Follow Client Logic - EPIC A.A2', () => {
  beforeEach(() => {
    const dom = new JSDOM(`<body>${createMarkup()}</body>`, { url: 'http://localhost:3000' });
    assignDomGlobals(dom);
    fetch.mockReset();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('toggleFollow', () => {
    test('sends follow request and updates UI on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          followers_count: 11,
          following_count: 6,
        }),
      });

      const button = document.getElementById('follow-button');
      const actionInput = document.getElementById('follow-action');
      const feedback = document.getElementById('follow-feedback');

      await toggleFollow(createEvent(button), 'test');
      await flushPromises();

      expect(fetch).toHaveBeenCalledTimes(1);
      const [requestUrl, options] = fetch.mock.calls[0];
      expect(new URL(requestUrl).pathname).toBe('/profiles/test/follow');
      expect(options.body.toString()).toBe('action=follow');

      expect(button.textContent.trim()).toBe('Unfollow');
      expect(button.classList.contains('following')).toBe(true);
      expect(actionInput.value).toBe('unfollow');
      expect(button.disabled).toBe(false);
      expect(feedback.hidden).toBe(true);

      const counts = document.querySelectorAll('.stat-number');
      expect(counts[0].textContent).toBe('11');
      expect(counts[1].textContent).toBe('6');
    });

    test('shows block message and keeps state when backend returns ok=false', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          status: 'blocked',
          followers_count: 10,
          following_count: 5,
        }),
      });

      const button = document.getElementById('follow-button');
      const actionInput = document.getElementById('follow-action');
      const feedback = document.getElementById('follow-feedback');

      await toggleFollow(createEvent(button), 'test');
      await flushPromises();

      expect(button.textContent.trim()).toBe('Follow');
      expect(actionInput.value).toBe('follow');
      expect(feedback.hidden).toBe(false);
      expect(feedback.textContent).toBe('You cannot follow this user.');
    });

    test('renders HTTP error message from fetch', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const feedback = document.getElementById('follow-feedback');

      await toggleFollow(createEvent(document.getElementById('follow-button')), 'test');
      await flushPromises();

      expect(feedback.hidden).toBe(false);
      expect(feedback.textContent).toContain('HTTP 429');
    });

    test('renders network error when fetch rejects', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      const feedback = document.getElementById('follow-feedback');

      await toggleFollow(createEvent(document.getElementById('follow-button')), 'test');
      await flushPromises();

      expect(feedback.hidden).toBe(false);
      expect(feedback.textContent).toContain('Network failure');
    });
  });

  describe('updateCount', () => {
    test('updates follower count', () => {
      updateCount('.stat-label', 'Followers', 15);

      const followers = document.querySelector('.stat-number');
      expect(followers.textContent).toBe('15');
    });

    test('updates following count', () => {
      updateCount('.stat-label', 'Following', 8);

      const following = document.querySelectorAll('.stat-number')[1];
      expect(following.textContent).toBe('8');
    });

    test('does nothing when label not found', () => {
      const original = document.querySelector('.stat-number').textContent;
      updateCount('.stat-label', 'Posts', 20);
      expect(document.querySelector('.stat-number').textContent).toBe(original);
    });
  });

  describe('showFollowError', () => {
    test('creates and auto-removes toast', () => {
      jest.useFakeTimers();

      showFollowError('Test error');
      const toast = document.querySelector('.follow-error');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toContain('Test error');

      jest.advanceTimersByTime(5000);
      jest.runAllTimers();
      expect(document.querySelector('.follow-error')).toBeFalsy();
    });

    test('positions toast in top-right corner', () => {
      showFollowError('Position');
      const toast = document.querySelector('.follow-error');
      expect(toast.style.top).toBe('20px');
      expect(toast.style.right).toBe('20px');
    });
  });
});
