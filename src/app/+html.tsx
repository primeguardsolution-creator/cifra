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
        <meta name="description" content="CIFRA — mensajería privada con tu espacio personal y tu espacio Business, a un toque de distancia." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CIFRA" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { height: 100%; }
          body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
          * { scrollbar-width: thin; }
          textarea, input { outline: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
