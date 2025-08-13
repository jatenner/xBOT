export const SEL = {
  composerBox: `[data-testid="tweetTextarea_0"]`,
  postBtn: `[data-testid="tweetButton"], [data-testid="tweetButtonInline"]`,
  replyBtn: `[data-testid="reply"]`,
  accountSwitch: `[data-testid="SideNav_AccountSwitcher_Button"]`,
  tweetPermalinkAnchor: `a[href*="/status/"]`
} as const;

export type SelectorKey = keyof typeof SEL;