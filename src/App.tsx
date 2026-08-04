import { AppShell } from './components/AppShell'
import { RouterProvider, Routes } from './router'
import { NotFound, routes } from './app/routes'

export default function App() {
  return (
    <RouterProvider>
      <AppShell>
        <Routes routes={routes} fallback={<NotFound />} />
      </AppShell>
    </RouterProvider>
  )
}
