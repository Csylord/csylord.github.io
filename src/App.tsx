import { Navbar } from "./components/Navbar";
import { AIStatement } from "./components/AIStatement";
import { Home } from "./pages/Home";
import { Projects } from "./pages/Projects";
import { About } from "./pages/About";
import "./App.css";

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Home />
        <About />
        <Projects />
        <AIStatement />
      </main>
    </>
  );
}

export default App;