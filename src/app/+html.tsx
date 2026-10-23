import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#F6F6FB" />
        <meta name="description" content="Private messaging for you and your business: personal chats plus a workspace with CRM, calendar and customer inbox." />
        {/* Link previews (WhatsApp, iMessage, Slack, X...): kept in English, with an absolute image URL as scrapers require */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CIFRA" />
        <meta property="og:title" content="CIFRA · Private messaging for you and your business" />
        <meta property="og:description" content="One app, two spaces: personal chats, and a workspace with CRM, calendar and customer inbox." />
        <meta property="og:url" content="https://cifra-mensajeria.netlify.app" />
        <meta property="og:image" content="https://cifra-mensajeria.netlify.app/og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="CIFRA: private messaging for you and your business" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CIFRA · Private messaging for you and your business" />
        <meta name="twitter:description" content="One app, two spaces: personal chats, and a workspace with CRM, calendar and customer inbox." />
        <meta name="twitter:image" content="https://cifra-mensajeria.netlify.app/og.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CIFRA" />
        {/* "black": opaque status bar and the app starts below it. iOS draws its own dark gradient over whatever sits under a
            translucent bar ("black-translucent" / "default"), which showed as a blurred shadow over the first rows. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { height: 100%; background: #F6F6FB; }
          @media (prefers-color-scheme: dark) { html, body, #root { background: #000; } }
          body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
          * { scrollbar-width: thin; }
          textarea, input { outline: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
