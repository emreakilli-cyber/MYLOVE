import { AppShell } from './components/AppShell'
import { KilitKapisi } from './components/KilitKapisi'
import { RouterProvider, Routes } from './router'
import { NotFound, routes } from './app/routes'

export default function App() {
  return (
    <RouterProvider>
      <KilitKapisi>
        <AppShell>
          <Routes routes={routes} fallback={<NotFound />} />
        </AppShell>
      </KilitKapisi>
    </RouterProvider>
  )
}
