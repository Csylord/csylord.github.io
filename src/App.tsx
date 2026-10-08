import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { About } from "./pages/About";
import { Reveal } from "./components/Reveal";
import "./App.css";
import { ScrollProgress } from "./components/ScrollProgress";
import { Starfield } from "./components/Starfield";

function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollProgress />
      <Navbar />
      <Starfield />
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