import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/placeholder.css'

import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root bulunamadı')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
