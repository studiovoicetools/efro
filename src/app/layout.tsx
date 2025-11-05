// app/layout.tsx
import './globals.css'

export const metadata = {
  title: 'AIVA Avatar Integration',
  description: 'Shopify Verkaufsassistent mit KI-Avatar',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}

