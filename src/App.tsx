import { Navbar } from "./components/Navbar";
import { AIStatement } from "./components/AIStatement";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { About } from "./pages/About";
import { Reveal } from "./components/Reveal";
import "./App.css";

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Reveal>
          <Home />
        </Reveal>
        <Reveal delay={200}>
          <About />
        </Reveal>
        <Reveal delay={400}>
          <Projects />
        </Reveal>
        <Reveal delay={600}>
          <AIStatement />
        </Reveal>
      </main>
    </>
  );
}

export default App;