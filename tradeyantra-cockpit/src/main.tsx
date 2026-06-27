import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { Cockpit } from './pages/Cockpit'
import { Folio } from './pages/Folio'
import { Risk } from './pages/Risk'
import { Setup } from './pages/Setup'
import { Reason, Scenario, Graph, Alpha, Memory } from './pages/Brain'
import { Stub } from './pages/Stub'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Cockpit /> },
      { path: 'markets', element: <Stub title="Markets" icon="markets" note="Watchlists, L2 depth, heatmap, movers, OI buildup, FII/DII" /> },
      { path: 'charts', element: <Stub title="Charts" icon="charts" note="Multi-timeframe charts + indicators + AI-drawn levels" /> },
      { path: 'options', element: <Stub title="Options Lab" icon="options" note="Live chain · strategy builder (payoff + Greeks) · IV · OI · max pain" /> },
      { path: 'trade', element: <Stub title="Trade" icon="trade" note="Order ticket, basket, GTT, order & trade book" /> },
      { path: 'folio', element: <Folio /> },
      { path: 'risk', element: <Risk /> },
      { path: 'reason', element: <Reason /> },
      { path: 'scenario', element: <Scenario /> },
      { path: 'graph', element: <Graph /> },
      { path: 'alpha', element: <Alpha /> },
      { path: 'memory', element: <Memory /> },
      { path: 'setup', element: <Setup /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
)
