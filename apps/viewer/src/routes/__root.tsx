import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import Footer from '../components/Footer'
import Header from '../components/Header'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'MaterialX Viewer',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const isEmbedRoute = useRouterState({
    select: (state) => state.location.pathname === '/embed',
  })

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className={isEmbedRoute ? 'h-screen w-screen overflow-hidden [overflow-wrap:anywhere]' : 'flex min-h-screen flex-col [overflow-wrap:anywhere]'}>
        {isEmbedRoute ? null : <Header />}
        <main className={isEmbedRoute ? 'h-full w-full' : 'flex-1 page-main'}>{children}</main>
        {isEmbedRoute ? null : <Footer />}
        <Scripts />
      </body>
    </html>
  )
}
