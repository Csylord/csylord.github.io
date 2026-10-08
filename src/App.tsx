import { Routes, Route } from "react-router-dom";
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/ai" element={<AIStatement />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer>
        <p>Contact: liam_walke@outlook.com</p>
      </footer>
    </>
  );
}

export default App;