import { Header } from './components/Header'
import { NavFlyout } from './components/NavFlyout'
import { ItemModal } from './components/ItemModal'
import { useUI } from './store/ui'
import { Dashboard } from './views/Dashboard'
import { Focus } from './views/Focus'
import { Objectives } from './views/Objectives'
import { Board } from './views/Board'
import { Placeholder } from './views/Placeholder'

export function App() {
  const ui = useUI()

  let view
  switch (ui.view) {
    case 'dashboard':
      view = <Dashboard />
      break
    case 'focus':
      view = <Focus />
      break
    case 'objectives':
      view = <Objectives />
      break
    case 'board':
      view = <Board />
      break
    default:
      view = <Placeholder />
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#EEF1F5',
      }}
    >
      <Header />
      <NavFlyout />
      <div id="appBody" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <main id="appMain" style={{ flex: 1, overflow: 'auto', padding: '24px 26px' }}>
          {view}
        </main>
        <ItemModal />
      </div>
    </div>
  )
}
