import { projects } from './data/projects';
import { ProjectCard} from './components/ProjectCard';

function App() {
    return (
      <main>
        <header>
          <h1>Liam Walke</h1>
          <p>Aspiring games developer. Looking for opportunities to contribute to innovative game development projects.</p>
        </header>

        <section>
          <h2>Projects</h2>
          <div className="projects">
            {projects.map((project, index) => (
              <ProjectCard key={index} project={project} />
            ))}
          </div>
        </section>

        <footer>
          <p>Contact: liam_walke@outlook.com</p>
        </footer>
      </main>
    );
}

export default App;