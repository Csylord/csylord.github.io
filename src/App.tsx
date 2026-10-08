import { projects } from './data/projects';
import { ProjectCard} from './components/ProjectCard';
import { AIStatement } from './components/AIStatement';

function App() {
    return (
      <main>
        <header>
          <h1>Liam Walke</h1>
          <p>Aspiring games developer. Looking for opportunities to contribute to innovative game development projects.</p>
        </header>

        <section>
          <h2>About Me</h2>
          <p>
            I am a passionate and dedicated aspiring games developer with a strong interest in creating immersive and engaging gaming experiences. I have experience in game design, programming, and 3D modeling, and I am always eager to learn new skills and technologies to enhance my abilities as a developer.
          </p>
        </section>

        <section>
          <h2>Projects</h2>
          <div className="projects">
            {projects.map((project, index) => (
              <ProjectCard key={index} project={project} />
            ))}
          </div>
        </section>

        <section>
          <h2>Social Links</h2>
          <ul>
            <li><a href="https://github.com/csylord" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="https://linkedin.com/in/liam-walke-7153b1338" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
            <li><a href="https://csylord.itch.io/" target="_blank" rel="noopener noreferrer">Itch.io</a></li>
            <li><a href="https://steamcommunity.com/id/csylord/" target="_blank" rel="noopener noreferrer">Steam</a></li>
          </ul>
        </section>

        <section>
          <AIStatement />
        </section>

        <footer>
          <p>Contact: liam_walke@outlook.com</p>
        </footer>
      </main>
    );
}

export default App;