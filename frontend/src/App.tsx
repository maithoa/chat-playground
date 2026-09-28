import { useState } from 'react'
import { ModelSelector } from './components/ModelSelector';
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  const [selected, setSelected] = useState<{ provider: string; model: string }>({
    provider: "",
    model: "",
  });

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <ModelSelector
          onSelect={(providerId, modelId) => {
            setSelected({ provider: providerId, model: modelId });
          }}
        />
      </section>


      <div className="ticks"></div>
      <section id="spacer"></section>

      <div style={{ marginTop: "16px", fontSize: "13px", color: "#555" }}>
        Selecting: <strong>{selected.provider}</strong> / <strong>{selected.model}</strong>
      </div>
    </>
  )
}

export default App
