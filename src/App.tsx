import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { About } from "./pages/About";
import { Reveal } from "./components/Reveal";
import "./App.css";
import { ScrollProgress } from "./components/ScrollProgress";

function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollProgress />
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Reveal>
          <Home />
        </Reveal>
        <Reveal delay={200}>
          <About />
        </Reveal>
        <Reveal delay={400}>
          <Projects />
        </Reveal>
      </main>
    </>
  );
}

export default App;