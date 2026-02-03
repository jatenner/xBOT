#!/usr/bin/env tsx
/**
 * Parse cookie string and convert to Playwright format
 */

const cookieString = `kdt=10IsWTXYUXRPFdyDASOviRVhD8tJnr2DqGs7Vz2K; guest_id_marketing=v1%3A176013327402968747; guest_id_ads=v1%3A176013327402968747; guest_id=v1%3A176013327402968747; __cuid=3bd6a5d2094d4f9e8a19e75a905d965a; _ga=GA1.1.176015927.1762960005; _ga_BLY4P7T5KW=GS2.1.s1762960005$o1$g1$t1762961775$j60$l0$h0; dnt=1; cf_clearance=THxqhoD791lRRyC3l1NNRs47Ja5GIu3VCurXXs.wG9s-1768439889-1.2.1.1-gvi4O8UmqY_nxifsICH.kNMWgQkR0OLf_no_7KjHjpJBnP4Zm7t687gywWdbFlXkbQBIiaNYvs1pep8MOlgn8Ahbrr4uP6MkBvdrGIneXSKTB4YSZYpSiildcgWH2LbyxzF2eeLxj7rsSnIv2.lM3BUmI61uzjBM_SXDrXeFUt7G84AppvoTVls9GvcYjs7XkyIiLLr9.BgyjRt8pF5wNo9HYMwtUPXjtFFMj0uUr.c; personalization_id="v1_BHRXAfKbaG0ns2+JUtNn/w=="; gt=2018528138062377358; g_state={"i_l":0,"i_ll":1770089595300}; auth_token=9137a0601714d0377fb0a9fd82ecf64f3620a29a; ct0=3cf4dbe886f78e1f3977f1bf2a744175a3fd1d58bb6c6df7936ee232421c2c481162e6f27605f365ea8cbb5cc2c9dbd6bbf21e59ffde05cb056b47a88599cf929248275f209165893c9326b9e99c45ae; att=1-6zqJ2S1jKm9tmwa2a3wgwggueewAvrtaKFbymfxX; lang=en; twid=u%3D1932615318519808000; __cf_bm=xAVFO_SOnPCt4BhuXqBNUMYRd2NaIqzO4R.YDlB3ST0-1770090905.3348646-1.0.1.1-l7fCamIkOBO4cqOA.RyOmjJShzoj5smKH80be1sJuiywuhWcPVi4DSEfdVjOEGZTyMW6znC7VhntcUFjfK.3FCn6MvzmH5b_mMK2Xiykil_Q2p3ApNdEOQ0giaDxlNUI`;

function parseCookieString(cookieStr: string): any[] {
  const cookies: any[] = [];
  const parts = cookieStr.split(';').map(s => s.trim());
  
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=');
    const value = valueParts.join('='); // Handle values with = in them
    
    if (!name || !value) continue;
    
    // Determine cookie properties based on name
    const isHttpOnly = name === 'auth_token' || name.includes('auth');
    const sameSite = name === 'ct0' ? 'Lax' : 'None';
    
    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: '.x.com',
      path: '/',
      expires: -1,
      httpOnly: isHttpOnly,
      secure: true,
      sameSite: sameSite,
    });
  }
  
  return cookies;
}

const cookies = parseCookieString(cookieString);
const output = { cookies };

console.log(JSON.stringify(output, null, 2));
