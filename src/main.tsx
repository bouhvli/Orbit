import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { dbReady } from './db/db'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// Settings must exist before the first paint, otherwise the theme flashes.
void dbReady.then(() => {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
