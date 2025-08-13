export const SELECTORS = {
  composeArea: [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]'
  ],
  postButton: ['[data-testid="tweetButtonInline"]','[data-testid="tweetButton"]'],
  replyButton: ['[data-testid="reply"]','[data-testid="toolBarReply"]'],
  metrics: {
    impressions: ['[data-testid="app-text-transition-container"] span:has-text("Views")', 'a[href$="/analytics"]'],
    likes: ['[data-testid="like"] span','div[aria-label*="Like"]'],
    replies: ['[data-testid="reply"] span'],
    bookmarks: ['[data-testid="bookmark"] span']
  },
  accountSwitcher: ['[data-testid="SideNav_AccountSwitcher_Button"]']
};

// Legacy compatibility
export const SEL = {
  composerBox: SELECTORS.composeArea[0],
  postBtn: SELECTORS.postButton.join(', '),
  replyBtn: SELECTORS.replyButton[0],
  accountSwitch: SELECTORS.accountSwitcher[0],
  tweetPermalinkAnchor: `a[href*="/status/"]`
} as const;