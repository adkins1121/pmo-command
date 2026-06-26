import { Header } from './components/Header'
import { NavFlyout } from './components/NavFlyout'
import { ItemModal } from './components/ItemModal'
import { AiAssistant } from './components/AiAssistant'
import { EditDrawer } from './components/EditDrawer'
import { useUI } from './store/ui'
import { Dashboard } from './views/Dashboard'
import { Focus } from './views/Focus'
import { Objectives } from './views/Objectives'
import { Board } from './views/Board'
import { Activity } from './views/Activity'
import { Integrations } from './views/Integrations'
import { Standup } from './views/Standup'
import { Timeline } from './views/Timeline'
import { Insights } from './views/Insights'
import { Dependencies } from './views/Dependencies'
import { EnvironmentView } from './views/Environment'
import { Admin } from './views/Admin'
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
    case 'standup':
      view = <Standup />
      break
    case 'objectives':
      view = <Objectives />
      break
    case 'board':
      view = <Board />
      break
    case 'timeline':
      view = <Timeline />
      break
    case 'deps':
      view = <Dependencies />
      break
    case 'env':
      view = <EnvironmentView />
      break
    case 'insights':
      view = <Insights />
      break
    case 'activity':
      view = <Activity />
      break
    case 'integrations':
      view = <Integrations />
      break
    case 'admin':
      view = <Admin />
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
        <EditDrawer />
      </div>
      <AiAssistant />
    </div>
  )
}
