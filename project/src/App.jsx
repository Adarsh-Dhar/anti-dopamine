import { useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')

  const handleClick = () => {
    console.log('hello world')
    setMessage('hello world')
  }

  return (
    <div className="extension-container">
      <h1>Hello World Extension</h1>
      <button onClick={handleClick}>
        Click Me
      </button>
      {message && <p className="message">{message}</p>}
    </div>
  )
}

export default App
