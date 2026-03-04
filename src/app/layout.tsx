import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

const bootstrapThemeAndBackgroundScript = `
  (function() {
    var USER_BACKGROUND_CACHE_KEY = 'teamy.user-background.preferences.v1';
    var USER_BACKGROUND_AUTH_KEY = 'teamy.user-background.auth.v1';

    function applyTheme() {
      var theme = localStorage.getItem('theme');
      var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var resolvedTheme = !theme || theme === 'system' ? systemTheme : theme;
      if (resolvedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }

    function ensureStyleElement() {
      var styleEl = document.getElementById('user-background-styles-inline');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'user-background-styles-inline';
        document.head.appendChild(styleEl);
      }
      return styleEl;
    }

    var headerCss = [
      'header,',
      'header.bg-teamy-primary,',
      'header[class*="bg-teamy-primary"] {',
      '  background-color: #0056C7 !important;',
      '  background-image: none !important;',
      '  background: #0056C7 !important;',
      '}',
      '.dark header,',
      '.dark header.bg-teamy-primary,',
      '.dark header[class*="bg-teamy-primary"],',
      'html.dark header,',
      'html.dark header.bg-teamy-primary {',
      '  background-color: rgb(15 23 42) !important;',
      '  background-image: none !important;',
      '  background: rgb(15 23 42) !important;',
      '}',
    ].join('\\n');

    var resetCss = [
      ':root {',
      '  --user-background: none;',
      '  --user-background-image: none;',
      '}',
      'body,',
      'html {',
      '  background: var(--user-background) !important;',
      '  background-image: var(--user-background-image) !important;',
      '}',
      'body {',
      '  background-attachment: fixed !important;',
      '  background-size: cover !important;',
      '  background-position: center !important;',
      '  background-repeat: no-repeat !important;',
      '}',
    ].join('\\n');

    var gridCss = [
      'html {',
      '  background-color: hsl(var(--background)) !important;',
      '  background-image: none !important;',
      '}',
      'body {',
      '  background-color: transparent !important;',
      '  background-attachment: fixed !important;',
      '  background-size: 24px 24px !important;',
      '  background-position: 0 0 !important;',
      '  background-repeat: repeat !important;',
      '}',
      'body.grid-pattern {',
      '  background-image:',
      '    linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),',
      '    linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;',
      '}',
      '.dark body.grid-pattern {',
      '  background-image:',
      '    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),',
      '    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;',
      '}',
    ].join('\\n');

    var transparentSurfaceCss = [
      '.bg-slate-50,',
      '.bg-slate-900,',
      '.dark\\\\:bg-slate-900,',
      '[class*="bg-slate"],',
      'section.bg-slate-50,',
      'section.bg-slate-900,',
      'section[class*="bg-slate"],',
      'div.bg-slate-50,',
      'div.bg-slate-900,',
      'div[class*="bg-slate"],',
      'div.bg-background,',
      'section.bg-background {',
      '  background-color: transparent !important;',
      '  background: transparent !important;',
      '}',
    ].join('\\n');

    function applyGrid(styleEl) {
      document.body.classList.add('grid-pattern');
      styleEl.textContent = headerCss + '\\n' + gridCss;
    }

    function applySolid(styleEl, color) {
      document.body.classList.remove('grid-pattern');
      styleEl.textContent =
        headerCss +
        '\\n' +
        resetCss.replace('--user-background: none;', '--user-background: ' + color + ';') +
        '\\n' +
        [
          'body,',
          'html,',
          'body.grid-pattern,',
          'html.grid-pattern,',
          '.grid-pattern,',
          '*[class*="grid-pattern"] {',
          '  background: ' + color + ' !important;',
          '  background-image: none !important;',
          '  background-attachment: fixed !important;',
          '}',
        ].join('\\n') +
        '\\n' +
        transparentSurfaceCss;
    }

    function applyGradient(styleEl, gradient) {
      document.body.classList.remove('grid-pattern');
      styleEl.textContent =
        headerCss +
        '\\n' +
        resetCss.replace('--user-background: none;', '--user-background: ' + gradient + ';') +
        '\\n' +
        [
          'body,',
          'html,',
          'body.grid-pattern,',
          'html.grid-pattern,',
          '.grid-pattern,',
          '*[class*="grid-pattern"] {',
          '  background: ' + gradient + ' !important;',
          '  background-image: ' + gradient + ' !important;',
          '  background-attachment: fixed !important;',
          '}',
        ].join('\\n') +
        '\\n' +
        transparentSurfaceCss;
    }

    function applyImage(styleEl, imageUrl) {
      var normalizedImageUrl = String(imageUrl).replace(/["\\\\]/g, '\\\\$&');
      var imageCss = 'url("' + normalizedImageUrl + '")';
      document.body.classList.remove('grid-pattern');
      styleEl.textContent =
        headerCss +
        '\\n' +
        resetCss.replace('--user-background-image: none;', '--user-background-image: ' + imageCss + ';') +
        '\\n' +
        [
          'body,',
          'html,',
          'body.grid-pattern,',
          'html.grid-pattern,',
          '.grid-pattern,',
          '*[class*="grid-pattern"] {',
          '  background-image: ' + imageCss + ' !important;',
          '  background-color: transparent !important;',
          '  background-size: cover !important;',
          '  background-position: center !important;',
          '  background-repeat: no-repeat !important;',
          '  background-attachment: fixed !important;',
          '}',
        ].join('\\n') +
        '\\n' +
        transparentSurfaceCss;
    }

    function applyCachedBackground() {
      var styleEl = ensureStyleElement();
      if (!styleEl || !document.body) {
        return;
      }

      var isAuthenticated = localStorage.getItem(USER_BACKGROUND_AUTH_KEY) === '1';
      if (!isAuthenticated) {
        applyGrid(styleEl);
        return;
      }

      var raw = localStorage.getItem(USER_BACKGROUND_CACHE_KEY);
      if (!raw) {
        applyGrid(styleEl);
        return;
      }

      var preferences = null;
      try {
        preferences = JSON.parse(raw);
      } catch (_parseError) {
        applyGrid(styleEl);
        return;
      }

      var backgroundType =
        preferences && typeof preferences.backgroundType === 'string'
          ? preferences.backgroundType
          : 'grid';

      if (
        backgroundType === 'solid' &&
        preferences &&
        typeof preferences.backgroundColor === 'string' &&
        preferences.backgroundColor
      ) {
        applySolid(styleEl, preferences.backgroundColor);
        return;
      }

      if (
        backgroundType === 'gradient' &&
        preferences &&
        Array.isArray(preferences.gradientColors) &&
        preferences.gradientColors.length >= 2
      ) {
        var gradientColors = preferences.gradientColors.filter(function(color) {
          return typeof color === 'string' && color.length > 0;
        });

        if (gradientColors.length >= 2) {
          var gradientStops = gradientColors
            .map(function(color, index) {
              var stop = (index / (gradientColors.length - 1)) * 100;
              return color + ' ' + stop + '%';
            })
            .join(', ');
          var gradientDirection =
            typeof preferences.gradientDirection === 'string'
              ? preferences.gradientDirection
              : '135deg';
          applyGradient(
            styleEl,
            'linear-gradient(' + gradientDirection + ', ' + gradientStops + ')'
          );
          return;
        }
      }

      if (
        backgroundType === 'image' &&
        preferences &&
        typeof preferences.backgroundImageUrl === 'string' &&
        preferences.backgroundImageUrl
      ) {
        applyImage(styleEl, preferences.backgroundImageUrl);
        return;
      }

      applyGrid(styleEl);
    }

    try {
      applyTheme();
      applyCachedBackground();
    } catch (_error) {}
  })();
`

export const metadata: Metadata = {
  title: 'Teamy',
  description: 'Team management platform',
  icons: {
    icon: [
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icon-32x32.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <body className="font-sans antialiased grid-pattern" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: bootstrapThemeAndBackgroundScript,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
